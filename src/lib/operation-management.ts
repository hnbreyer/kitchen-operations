import { PrismaClient, OperationStatus } from "@prisma/client";
import { db } from "./db";
import { dateKey } from "./calendar";
import type { PlannedMeal } from "./menus/types";
import {
  parseOperationInput,
  OperationValidationError,
} from "./operation-input";
export class OperationConflictError extends Error {}
export async function saveOperationRecord(
  form: FormData,
  id: string | null = null,
  version: string | null = null,
  client: PrismaClient = db,
) {
  const data = parseOperationInput(form);
  if (!(await client.location.findUnique({ where: { id: data.locationId } })))
    throw new OperationValidationError({
      locationId: "The selected location no longer exists.",
    });
  if (!id) return client.operation.create({ data });
  const plan = await client.operationMealPlan.findUnique({
    where: { operationId: id },
  });
  if (
    plan &&
    (JSON.parse(plan.scheduleJson) as PlannedMeal[]).some(
      (meal) =>
        meal.date < dateKey(data.startDate) ||
        meal.date > dateKey(data.endDate),
    )
  )
    throw new OperationConflictError(
      "These dates would exclude existing planned meals. Adjust the meal plan first or keep the current dates.",
    );
  const oldOperation = await client.operation.findUnique({
    where: { id },
    include: {
      purchases: { select: { id: true } },
      shoppingList: true,
      stockEstimates: { select: { id: true } },
    },
  });
  if (
    oldOperation &&
    (oldOperation.type === "RETREAT") !== (data.type === "RETREAT") &&
    (oldOperation.shoppingList || oldOperation.stockEstimates.length)
  )
    throw new OperationConflictError(
      "Existing shopping or school availability records prevent changing ingredient ownership. Keep this operation type and create a separate operation if needed.",
    );
  if (
    oldOperation &&
    oldOperation.type !== data.type &&
    oldOperation.purchases.length
  )
    throw new OperationConflictError(
      "Purchase history prevents changing operation type. Keep this operation and create a separate operation if needed.",
    );
  const updatedAt = version ? new Date(version) : new Date(NaN);
  if (!Number.isFinite(updatedAt.getTime()))
    throw new OperationConflictError("Reload the operation before saving.");
  const result = await client.operation.updateMany({
    where: { id, updatedAt },
    data: {
      ...data,
      updatedAt: new Date(Math.max(Date.now(), updatedAt.getTime() + 1)),
    },
  });
  if (!result.count)
    throw new OperationConflictError(
      "This operation changed or was removed. Reload it before saving.",
    );
  return { id };
}
export async function changeOperationStatus(
  id: string,
  version: string,
  status: string,
  client: PrismaClient = db,
) {
  if (!Object.values(OperationStatus).includes(status as OperationStatus))
    throw new OperationValidationError({ status: "Select a valid status." });
  const updatedAt = new Date(version);
  if (!Number.isFinite(updatedAt.getTime()))
    throw new OperationConflictError("Reload the operation before saving.");
  const result = await client.operation.updateMany({
    where: { id, updatedAt },
    data: {
      status: status as OperationStatus,
      updatedAt: new Date(Math.max(Date.now(), updatedAt.getTime() + 1)),
    },
  });
  if (!result.count)
    throw new OperationConflictError(
      "This operation changed or was removed. Reload it before saving.",
    );
}
export async function deleteOperationRecord(
  id: string,
  version: string,
  confirmation: string,
  client: PrismaClient = db,
) {
  if (confirmation !== id)
    throw new OperationValidationError({
      confirmation: "Confirm permanent deletion before continuing.",
    });
  const updatedAt = new Date(version);
  if (!Number.isFinite(updatedAt.getTime()))
    throw new OperationConflictError("Reload the operation before deleting.");
  if (await client.operationMealPlan.findUnique({ where: { operationId: id } }))
    throw new OperationConflictError(
      "This operation has a saved meal plan. Cancel the operation to retain its history instead of deleting it.",
    );
  if (
    (await client.shoppingList.findUnique({ where: { operationId: id } })) ||
    (await client.availableStock.count({ where: { operationId: id } })) ||
    (await client.ingredientSubstitution.count({ where: { operationId: id } }))
  )
    throw new OperationConflictError(
      "This operation has ingredient-planning records. Cancel it to retain its history instead of deleting it.",
    );
  if (await client.purchase.count({ where: { operationId: id } }))
    throw new OperationConflictError(
      "This operation has purchase history. Cancel it instead of deleting it.",
    );
  // Planning foreign keys also restrict deletion if records are added concurrently.
  const result = await client.operation.deleteMany({
    where: { id, updatedAt },
  });
  if (!result.count)
    throw new OperationConflictError(
      "This operation changed or was removed. Reload it before deleting.",
    );
}
