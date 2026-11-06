import { PrismaClient, type Prisma } from "@prisma/client";
import { db } from "../db";
import { editablePlan } from "../menus/planning";
import {
  exactDecimal,
  isUnit,
  units,
  type BaseUnit,
} from "../menus/quantities";
import {
  MenuError,
  text,
  nextVersion,
  versionDate,
  readJson,
  record,
} from "../menus/validation";
import { getPurchasingContext, type PurchasingContext } from "./context";
import { MAX_QUANTITY } from "./requirements";
export function purchaseQuantity(
  value: string,
  unit: string,
  base: BaseUnit,
  allowZero = true,
) {
  if (!isUnit(unit) || units[unit].base !== base)
    throw new MenuError("Select a compatible unit for this ingredient.");
  return exactDecimal(value, units[unit].factor, allowZero, MAX_QUANTITY);
}
function price(form: FormData, base: BaseUnit) {
  const value = text(form.get("price") ?? "", "Estimated price", 30),
    priceUnit = String(form.get("priceUnit") ?? base);
  if (!isUnit(priceUnit) || units[priceUnit].base !== base)
    throw new MenuError(
      "Estimated price unit must match the ingredient measurement type.",
    );
  return {
    estimatedPriceCentavos:
      value === "" ? null : exactDecimal(value, 100, true),
    priceUnit: value === "" ? null : priceUnit,
  };
}
function validContext(context: PurchasingContext | null, fingerprint: string) {
  if (!context || !context.operation.mealPlan)
    throw new MenuError("Plan meals before generating a shopping list.");
  if (context.fingerprint !== fingerprint)
    throw new MenuError(
      "Requirements changed. Reload and review the current quantities.",
    );
  if (context.issues.length)
    throw new MenuError(
      "Resolve missing or invalid meal quantities before generating or reviewing a list.",
    );
  return context;
}
async function listForWrite(
  tx: Prisma.TransactionClient,
  operationId: string,
  version: string,
) {
  const list = await tx.shoppingList.findUnique({ where: { operationId } });
  if (!list) throw new MenuError("Generate a shopping list first.");
  const updatedAt = versionDate(version);
  if (
    !(
      await tx.shoppingList.updateMany({
        where: { id: list.id, updatedAt },
        data: { updatedAt: nextVersion(updatedAt) },
      })
    ).count
  )
    throw new MenuError("This shopping list changed. Reload before saving.");
  return list;
}
export async function generateShoppingList(
  operationId: string,
  fingerprint: string,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const context = validContext(
      await getPurchasingContext(operationId, tx),
      fingerprint,
    );
    if (context.operation.shoppingList)
      throw new MenuError(
        "A shopping list already exists. Review changes instead of generating duplicates.",
      );
    if (!context.requirements.length)
      throw new MenuError("No ingredient requirements are available.");
    return tx.shoppingList.create({
      data: {
        operationId,
        ownership: context.policy.inventoryOwner,
        organicRequired: context.policy.organicRequired,
        sourceFingerprint: context.fingerprint,
        items: {
          create: context.requirements.map((r) => ({
            ingredientId: r.ingredientId,
            ingredientName: r.name,
            unit: r.unit,
            requiredMilli: BigInt(r.requiredMilli),
            availableMilli:
              r.availableMilli == null ? null : BigInt(r.availableMilli),
            plannedMilli: BigInt(r.suggestedMilli),
            estimatedPriceCentavos: r.priceCentavos,
            priceUnit: r.priceUnit,
          })),
        },
      },
    });
  });
}
export async function saveShoppingItem(
  operationId: string,
  version: string,
  itemId: string | null,
  form: FormData,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const list = await listForWrite(tx, operationId, version);
    const existing = itemId
      ? await tx.shoppingItem.findFirst({
          where: { id: itemId, listId: list.id },
        })
      : null;
    if (itemId && !existing)
      throw new MenuError("This shopping item no longer exists.");
    const ingredientId =
      existing?.ingredientId ?? String(form.get("ingredientId") ?? "");
    const ingredient = await tx.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) throw new MenuError("Select a catalog ingredient.");
    const plannedMilli = purchaseQuantity(
      String(form.get("quantity") ?? ""),
      String(form.get("unit") ?? ""),
      ingredient.baseUnit,
    );
    if (existing && existing.unit !== ingredient.baseUnit)
      throw new MenuError(
        "The ingredient measurement type changed. Review this item.",
      );
    const data = {
      plannedMilli: BigInt(plannedMilli),
      ...price(form, ingredient.baseUnit),
      notes: text(form.get("notes") ?? "", "Shopping notes", 2000) || null,
      purchased: form.get("purchased") === "yes",
    };
    if (existing)
      return tx.shoppingItem.update({ where: { id: existing.id }, data });
    if (
      await tx.shoppingItem.findUnique({
        where: { listId_ingredientId: { listId: list.id, ingredientId } },
      })
    )
      throw new MenuError(
        "This ingredient is already on the list, possibly excluded. Edit or restore its existing item.",
      );
    return tx.shoppingItem.create({
      data: {
        listId: list.id,
        ingredientId,
        ingredientName: ingredient.name,
        unit: ingredient.baseUnit,
        requiredMilli: 0n,
        plannedMilli: data.plannedMilli,
        manual: true,
        ...price(form, ingredient.baseUnit),
        notes: data.notes,
        purchased: data.purchased,
      },
    });
  });
}
export async function shoppingItemProgress(
  operationId: string,
  version: string,
  itemId: string,
  intent: string,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const list = await listForWrite(tx, operationId, version);
    const item = await tx.shoppingItem.findFirst({
      where: { id: itemId, listId: list.id },
    });
    if (!item) throw new MenuError("Shopping item not found.");
    const data =
      intent === "purchased"
        ? { purchased: !item.purchased }
        : intent === "exclude"
          ? { excluded: !item.excluded }
          : null;
    if (!data) throw new MenuError("Invalid shopping action.");
    return tx.shoppingItem.update({ where: { id: item.id }, data });
  });
}
export async function reviewShoppingList(
  operationId: string,
  version: string,
  fingerprint: string,
  form: FormData,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const context = validContext(
      await getPurchasingContext(operationId, tx),
      fingerprint,
    );
    const list = await listForWrite(tx, operationId, version);
    const value = readJson(form.get("decisions"));
    if (!Array.isArray(value) || value.length > 1000)
      throw new MenuError("Invalid shopping review.");
    const decisions = value.map(record),
      allIds = new Set([
        ...context.requirements.map((r) => r.ingredientId),
        ...context.operation.shoppingList!.items.map((i) => i.ingredientId),
      ]);
    if (
      decisions.length !== allIds.size ||
      new Set(decisions.map((d) => d.ingredientId)).size !== allIds.size
    )
      throw new MenuError("Review every ingredient exactly once.");
    for (const decision of decisions) {
      const ingredientId = String(decision.ingredientId),
        choice = String(decision.choice);
      if (
        !allIds.has(ingredientId) ||
        !["KEEP", "SUGGESTED", "EXCLUDE"].includes(choice)
      )
        throw new MenuError("Choose how to handle every ingredient.");
      const requirement = context.requirements.find(
          (r) => r.ingredientId === ingredientId,
        ),
        old = context.operation.shoppingList!.items.find(
          (i) => i.ingredientId === ingredientId,
        );
      const ingredient = context.catalog.find((i) => i.id === ingredientId);
      if (!ingredient) throw new MenuError("A catalog ingredient is missing.");
      const unit = requirement?.unit ?? old!.unit;
      if (old && old.unit !== unit)
        throw new MenuError(
          "Incompatible measurement types require correction before review.",
        );
      const requiredMilli = BigInt(requirement?.requiredMilli ?? 0),
        availableMilli =
          requirement?.availableMilli == null
            ? null
            : BigInt(requirement.availableMilli);
      if (old) {
        const updates = {
          requiredMilli,
          availableMilli,
          ...(choice === "SUGGESTED"
            ? {
                plannedMilli: BigInt(requirement?.suggestedMilli ?? 0),
                excluded: false,
              }
            : choice === "EXCLUDE"
              ? { excluded: true }
              : {}),
        };
        await tx.shoppingItem.update({
          where: { id: old.id },
          data: {
            ...updates,
            ...(decision.usePrice === true
              ? {
                  estimatedPriceCentavos: requirement?.priceCentavos ?? null,
                  priceUnit: requirement?.priceUnit ?? null,
                }
              : {}),
          },
        });
      } else {
        await tx.shoppingItem.create({
          data: {
            listId: list.id,
            ingredientId,
            ingredientName: requirement!.name,
            unit,
            requiredMilli,
            availableMilli,
            plannedMilli: BigInt(
              choice === "SUGGESTED" ? requirement!.suggestedMilli : 0,
            ),
            excluded: choice !== "SUGGESTED",
            estimatedPriceCentavos: requirement!.priceCentavos,
            priceUnit: requirement!.priceUnit,
          },
        });
      }
    }
    await tx.shoppingList.update({
      where: { id: list.id },
      data: {
        sourceFingerprint: context.fingerprint,
        updatedAt: nextVersion(versionDate(version)),
      },
    });
  });
}
export async function saveAvailableStock(
  operationId: string,
  ingredientId: string,
  version: string | null,
  form: FormData,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const context = await getPurchasingContext(operationId, tx);
    if (!context) throw new MenuError("Operation not found.");
    const ingredient = context.catalog.find((i) => i.id === ingredientId);
    if (!ingredient) throw new MenuError("Ingredient not found.");
    if (
      context.policy.inventoryOwner === "SCHOOL" &&
      context.scopeKey === "BUSINESS"
    )
      throw new MenuError(
        "Availability cannot be saved for an operation with this reserved identifier.",
      );
    const existing = await tx.availableStock.findUnique({
      where: {
        scopeKey_ingredientId: { scopeKey: context.scopeKey, ingredientId },
      },
    });
    if (
      existing &&
      (existing.ownership !== context.policy.inventoryOwner ||
        existing.operationId !==
          (context.policy.inventoryOwner === "SCHOOL" ? operationId : null))
    )
      throw new MenuError(
        "This availability record belongs to a different ownership context.",
      );
    const data = {
      quantityMilli: BigInt(
        purchaseQuantity(
          String(form.get("quantity") ?? ""),
          String(form.get("unit") ?? ""),
          ingredient.baseUnit,
        ),
      ),
      unit: ingredient.baseUnit,
      notes:
        text(form.get("notes") ?? "", "Stock estimate notes", 2000) || null,
    };
    if (existing) {
      const updatedAt = versionDate(version);
      if (
        !(
          await tx.availableStock.updateMany({
            where: { id: existing.id, updatedAt },
            data: { ...data, updatedAt: nextVersion(updatedAt) },
          })
        ).count
      )
        throw new MenuError(
          "This availability estimate changed. Reload before saving.",
        );
      return;
    }
    if (version)
      throw new MenuError(
        "This availability estimate changed. Reload before saving.",
      );
    await tx.availableStock.create({
      data: {
        ...data,
        ingredientId,
        scopeKey: context.scopeKey,
        ownership: context.policy.inventoryOwner,
        operationId:
          context.policy.inventoryOwner === "SCHOOL" ? operationId : null,
      },
    });
  });
}
export async function saveSubstitution(
  operationId: string,
  version: string,
  originalIngredientId: string,
  form: FormData,
  remove = false,
  client: PrismaClient = db,
) {
  return client.$transaction(async (tx) => {
    const context = await getPurchasingContext(operationId, tx);
    if (
      !context ||
      !context.operation.mealPlan ||
      !editablePlan(context.operation)
    )
      throw new MenuError(
        "Substitutions can be edited only for active draft or confirmed meal plans.",
      );
    const updatedAt = versionDate(version);
    if (
      !(
        await tx.operation.updateMany({
          where: { id: operationId, updatedAt },
          data: { updatedAt: nextVersion(updatedAt) },
        })
      ).count
    )
      throw new MenuError(
        "The operation changed. Reload before editing substitutions.",
      );
    if (remove) {
      await tx.ingredientSubstitution.deleteMany({
        where: { operationId, originalIngredientId },
      });
      return;
    }
    if (
      !context.meals.some((m) =>
        m.dishes.some((d) =>
          d.snapshot.ingredients.some(
            (i) => i.ingredientId === originalIngredientId,
          ),
        ),
      )
    )
      throw new MenuError(
        "Select an original ingredient used by the saved meal plan.",
      );
    const replacementIngredientId = String(
        form.get("replacementIngredientId") ?? "",
      ),
      replacement = context.catalog.find(
        (i) => i.id === replacementIngredientId,
      );
    if (!replacement || replacementIngredientId === originalIngredientId)
      throw new MenuError("Select a different replacement ingredient.");
    const data = {
      replacementIngredientId,
      quantityMilli: BigInt(
        purchaseQuantity(
          String(form.get("quantity") ?? ""),
          String(form.get("unit") ?? ""),
          replacement.baseUnit,
          false,
        ),
      ),
      unit: replacement.baseUnit,
      notes: text(form.get("notes") ?? "", "Substitution notes", 2000) || null,
    };
    return tx.ingredientSubstitution.upsert({
      where: {
        operationId_originalIngredientId: { operationId, originalIngredientId },
      },
      create: { operationId, originalIngredientId, ...data },
      update: data,
    });
  });
}
