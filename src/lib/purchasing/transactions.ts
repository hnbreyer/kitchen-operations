import { createHash } from "node:crypto";
import { PrismaClient, type Prisma } from "@prisma/client";
import { db } from "../db";
import { businessDate } from "../calendar";
import { exactDecimal, isUnit, units } from "../menus/quantities";
import { text, versionDate, nextVersion } from "../menus/validation";
import { estimatedCost } from "../menus/pricing";
import { purchaseQuantity } from "./management";
export const paymentSources = {
  OWNER: "Owner paid",
  BUSINESS: "Business paid",
  SCHOOL: "School paid directly",
} as const;
export type PurchaseInput = {
  confirmed: boolean;
  organicConfirmed: boolean;
  date: string;
  supplier: string;
  funding: string;
  paymentSource: string;
  operationId: string;
  shoppingListId: string;
  notes: string;
  receiptReference: string;
  items: {
    ingredientId: string;
    quantity: string;
    unit: string;
    price: string;
    priceUnit: string;
    shoppingItemId: string;
  }[];
};
export type ReimbursementInput = {
  date: string;
  notes: string;
  allocations: { purchaseId: string; amount: string }[];
};
export const purchaseInclude = {
  items: true,
  allocations: { include: { reimbursement: true } },
  operation: true,
} satisfies Prisma.PurchaseInclude;
export type RecordedPurchase = Prisma.PurchaseGetPayload<{
  include: typeof purchaseInclude;
}>;
function key(id: string) {
  if (!/^[a-zA-Z0-9_-]{8,100}$/.test(id))
    throw new Error("Reload the form before submitting.");
}
function digest(input: unknown) {
  return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}
export function money(value: string, allowZero = false) {
  return exactDecimal(text(value, "Amount", 30, true), 100, allowZero);
}
export function purchaseBalance(
  p: Pick<
    RecordedPurchase,
    "funding" | "paymentSource" | "totalCentavos" | "allocations"
  >,
) {
  const reimbursed = p.allocations.reduce((s, a) => s + a.amountCentavos, 0);
  const eligible = p.funding === "SCHOOL" && p.paymentSource === "OWNER";
  const outstanding = eligible ? p.totalCentavos - reimbursed : 0;
  return {
    reimbursed,
    outstanding,
    eligible,
    status: !eligible
      ? "Not eligible"
      : outstanding === 0
        ? "Reimbursed"
        : reimbursed
          ? "Partially reimbursed"
          : "Pending",
  };
}
async function repeat<T extends { requestHash: string }>(
  existing: T | null,
  hash: string,
) {
  if (existing && existing.requestHash !== hash)
    throw new Error(
      "This submission was already recorded with different values. Open a new form.",
    );
  return existing;
}
export async function recordPurchase(
  id: string,
  input: PurchaseInput,
  client: PrismaClient = db,
) {
  key(id);
  const requestHash = digest(input);
  const execute = () =>
    client.$transaction(
      async (tx) => {
        const previous = await repeat(
          await tx.purchase.findUnique({ where: { id } }),
          requestHash,
        );
        if (previous) return previous;
        if (input.confirmed !== true)
          throw new Error(
            "Confirm the actual purchase amounts before recording.",
          );
        if (input.funding === "SCHOOL" && input.organicConfirmed !== true)
          throw new Error(
            "Confirm organic sourcing for school retreat ingredients.",
          );
        const purchaseDate = businessDate(input.date);
        const supplier = text(input.supplier, "Supplier", 160, true);
        if (
          !["SCHOOL", "BUSINESS"].includes(input.funding) ||
          !Object.hasOwn(paymentSources, input.paymentSource)
        )
          throw new Error("Select funding responsibility and payment source.");
        const operationId = text(input.operationId, "Operation", 100) || null;
        const operation = operationId
          ? await tx.operation.findUnique({ where: { id: operationId } })
          : null;
        if (operationId && !operation)
          throw new Error("The selected operation no longer exists.");
        if (
          input.funding === "SCHOOL"
            ? operation?.type !== "RETREAT" ||
              input.paymentSource === "BUSINESS"
            : operation?.type === "RETREAT" || input.paymentSource === "SCHOOL"
        )
          throw new Error(
            "School funding requires a retreat and owner or school payment. Business funding requires shared purchasing, city service or a private event.",
          );
        const shoppingListId =
          text(input.shoppingListId, "Shopping list", 100) || null;
        if (shoppingListId) {
          const list = await tx.shoppingList.findUnique({
            where: { id: shoppingListId },
          });
          if (
            !list ||
            list.operationId !== operationId ||
            list.ownership !== input.funding
          )
            throw new Error(
              "Shopping list must belong to the selected operation and funding responsibility.",
            );
        }
        if (
          !Array.isArray(input.items) ||
          !input.items.length ||
          input.items.length > 100
        )
          throw new Error("Enter between 1 and 100 ingredient items.");
        const seen = new Set<string>();
        const items = [];
        for (const row of input.items) {
          const ingredient = await tx.ingredient.findUnique({
            where: { id: row.ingredientId },
          });
          if (!ingredient)
            throw new Error("Select an existing ingredient for each item.");
          if (seen.has(ingredient.id))
            throw new Error("Combine duplicate ingredients into one item.");
          seen.add(ingredient.id);
          const quantityMilli = purchaseQuantity(
            row.quantity,
            row.unit,
            ingredient.baseUnit,
            false,
          );
          const priceCentavos = money(row.price, true);
          if (
            !isUnit(row.priceUnit) ||
            units[row.priceUnit].base !== ingredient.baseUnit
          )
            throw new Error(
              "Actual price unit must match the ingredient measurement type.",
            );
          const lineTotalCentavos = estimatedCost(
            quantityMilli,
            ingredient.baseUnit,
            priceCentavos,
            row.priceUnit,
          );
          if (lineTotalCentavos == null || lineTotalCentavos > 2147483647)
            throw new Error("Actual line amount exceeds the supported range.");
          const shoppingItemId =
            text(row.shoppingItemId, "Shopping item", 100) || null;
          if (shoppingItemId) {
            const item = await tx.shoppingItem.findUnique({
              where: { id: shoppingItemId },
            });
            if (
              !shoppingListId ||
              !item ||
              item.listId !== shoppingListId ||
              item.ingredientId !== ingredient.id
            )
              throw new Error(
                "The linked shopping item does not match this purchase.",
              );
          }
          items.push({
            ingredientId: ingredient.id,
            ingredientName: ingredient.name,
            quantityMilli: BigInt(quantityMilli),
            unit: ingredient.baseUnit,
            priceCentavos,
            priceUnit: row.priceUnit,
            lineTotalCentavos,
            shoppingItemId,
          });
        }
        const totalCentavos = items.reduce(
          (s, i) => s + i.lineTotalCentavos,
          0,
        );
        if (totalCentavos > 2147483647)
          throw new Error("Purchase total exceeds the supported range.");
        await tx.purchase.create({
          data: {
            id,
            requestHash,
            purchaseDate,
            organicConfirmed:
              input.funding === "SCHOOL" && input.organicConfirmed === true,
            supplier,
            funding: input.funding as "SCHOOL" | "BUSINESS",
            paymentSource: input.paymentSource,
            operationId,
            shoppingListId,
            totalCentavos,
            notes: text(input.notes, "Notes") || null,
            receiptReference:
              text(input.receiptReference, "Receipt reference", 500) || null,
            items: { create: items },
          },
        });
        return tx.purchase.update({ where: { id }, data: { finalized: true } });
      },
      { timeout: 15000 },
    );
  try {
    return await execute();
  } catch (error) {
    const existing = await repeat(
      await client.purchase.findUnique({ where: { id } }),
      requestHash,
    );
    if (existing?.finalized) return existing;
    throw error;
  }
}
export async function recordReimbursement(
  id: string,
  input: ReimbursementInput,
  client: PrismaClient = db,
) {
  key(id);
  const requestHash = digest(input);
  try {
    return await client.$transaction(
      async (tx) => {
        const previous = await repeat(
          await tx.reimbursement.findUnique({ where: { id } }),
          requestHash,
        );
        if (previous) return previous;
        const paymentDate = businessDate(input.date);
        if (
          !Array.isArray(input.allocations) ||
          !input.allocations.length ||
          input.allocations.length > 100
        )
          throw new Error("Allocate the payment to 1–100 purchases.");
        const seen = new Set<string>();
        const allocations = [];
        for (const row of input.allocations) {
          if (seen.has(row.purchaseId))
            throw new Error(
              "A purchase may appear only once in a reimbursement.",
            );
          seen.add(row.purchaseId);
          const amountCentavos = money(row.amount);
          const purchase = await tx.purchase.findUnique({
            where: { id: row.purchaseId },
            include: purchaseInclude,
          });
          if (!purchase || !purchase.finalized)
            throw new Error("Purchase not found.");
          if (paymentDate < purchase.purchaseDate)
            throw new Error(
              "Reimbursement date cannot precede the purchase date.",
            );
          const balance = purchaseBalance(purchase);
          if (!balance.eligible || amountCentavos > balance.outstanding)
            throw new Error(
              "Allocation exceeds the eligible outstanding purchase balance. Reload balances before saving.",
            );
          allocations.push({ purchaseId: row.purchaseId, amountCentavos });
        }
        const totalCentavos = allocations.reduce(
          (s, a) => s + a.amountCentavos,
          0,
        );
        if (totalCentavos > 2147483647)
          throw new Error("Payment total exceeds the supported range.");
        await tx.reimbursement.create({
          data: {
            id,
            requestHash,
            paymentDate,
            totalCentavos,
            notes: text(input.notes, "Notes") || null,
            allocations: { create: allocations },
          },
        });
        return tx.reimbursement.update({
          where: { id },
          data: { finalized: true },
        });
      },
      { timeout: 15000 },
    );
  } catch (error) {
    const existing = await repeat(
      await client.reimbursement.findUnique({ where: { id } }),
      requestHash,
    );
    if (existing?.finalized) return existing;
    throw error;
  }
}
export async function editPurchaseMetadata(
  id: string,
  version: string,
  form: FormData,
  client: PrismaClient = db,
) {
  const updatedAt = versionDate(version);
  const result = await client.purchase.updateMany({
    where: { id, updatedAt, finalized: true },
    data: {
      supplier: text(form.get("supplier"), "Supplier", 160, true),
      notes: text(form.get("notes") ?? "", "Notes") || null,
      receiptReference:
        text(form.get("receiptReference") ?? "", "Receipt reference", 500) ||
        null,
      updatedAt: nextVersion(updatedAt),
    },
  });
  if (!result.count)
    throw new Error("This purchase changed. Reload before editing.");
}
