import { OperationType, OperationStatus } from "@prisma/client";
export const operationTypes = Object.values(OperationType);
export const typeLabels: Record<OperationType, string> = {
  RETREAT: "Retreat",
  CITY_SERVICE: "City service",
  PRIVATE_EVENT: "Private event",
};
export const statusLabels: Record<OperationStatus, string> = {
  DRAFT: "Draft",
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};
export function parseOperationType(value: unknown): OperationType | undefined {
  return typeof value === "string" &&
    operationTypes.includes(value as OperationType)
    ? (value as OperationType)
    : undefined;
}
export function validateOperation(input: {
  name: string;
  type: OperationType;
  startDate: Date;
  endDate: Date;
  expectedDiners?: number | null;
  billableParticipants?: number | null;
  expectedStaffDiners?: number | null;
  additionalMealBuffer?: number | null;
}) {
  if (!input.name.trim()) throw new Error("Operation name is required.");
  if (!operationTypes.includes(input.type))
    throw new Error("Invalid operation type.");
  if (
    !Number.isFinite(input.startDate.getTime()) ||
    !Number.isFinite(input.endDate.getTime()) ||
    input.endDate < input.startDate
  )
    throw new Error("A valid date range is required.");
  for (const count of [
    input.expectedDiners,
    input.billableParticipants,
    input.expectedStaffDiners,
    input.additionalMealBuffer,
  ]) {
    if (count != null && (!Number.isSafeInteger(count) || count < 0))
      throw new Error("Participant counts must be nonnegative whole numbers.");
  }
  if (
    input.type !== "RETREAT" &&
    [
      input.billableParticipants,
      input.expectedStaffDiners,
      input.additionalMealBuffer,
    ].some((value) => value != null)
  )
    throw new Error(
      "Billing, staff, and meal buffer fields apply only to retreats.",
    );
  if (
    input.expectedDiners != null &&
    input.expectedStaffDiners != null &&
    input.expectedStaffDiners > input.expectedDiners
  )
    throw new Error("Staff diners cannot exceed expected diners.");
}
export function sourcingPolicy(type: OperationType) {
  return {
    inventoryOwner: type === "RETREAT" ? "SCHOOL" : "BUSINESS",
    organicRequired: type === "RETREAT",
  } as const;
}
