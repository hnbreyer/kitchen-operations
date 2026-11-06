import { OperationStatus, OperationType } from "@prisma/client";
import { businessDate } from "./calendar";
import { validateOperation } from "./domain";
export type OperationFormValues = {
  name: string;
  type: string;
  startDate: string;
  endDate: string;
  locationId: string;
  status: string;
  expectedDiners: string;
  billableParticipants: string;
  expectedStaffDiners: string;
  additionalMealBuffer: string;
  notes: string;
};
export const emptyOperation: OperationFormValues = {
  name: "",
  type: "RETREAT",
  startDate: "",
  endDate: "",
  locationId: "",
  status: "DRAFT",
  expectedDiners: "",
  billableParticipants: "",
  expectedStaffDiners: "",
  additionalMealBuffer: "",
  notes: "",
};
export type ActionState = { message?: string; errors?: Record<string, string> };
export class OperationValidationError extends Error {
  constructor(public errors: Record<string, string>) {
    super("Please check the highlighted fields.");
  }
}
export function parseOperationInput(form: FormData) {
  const values = Object.fromEntries(
    Object.keys(emptyOperation).map((key) => [
      key,
      typeof form.get(key) === "string" ? (form.get(key) as string).trim() : "",
    ]),
  ) as OperationFormValues;
  const errors: Record<string, string> = {};
  if (!values.name || values.name.length > 160)
    errors.name = "Enter an operation name of 1–160 characters.";
  if (!Object.values(OperationType).includes(values.type as OperationType))
    errors.type = "Select a valid operation type.";
  if (
    !Object.values(OperationStatus).includes(values.status as OperationStatus)
  )
    errors.status = "Select a valid status.";
  if (!values.locationId) errors.locationId = "Select a location.";
  if (values.notes.length > 10000)
    errors.notes = "Notes must be at most 10,000 characters.";
  const dates: Record<string, Date> = {};
  for (const key of ["startDate", "endDate"] as const) {
    try {
      dates[key] = businessDate(values[key]);
    } catch (e) {
      errors[key] = (e as Error).message;
    }
  }
  if (dates.startDate && dates.endDate && dates.endDate < dates.startDate)
    errors.endDate = "End date must be on or after start date.";
  const counts: Record<string, number | null> = {};
  for (const key of [
    "expectedDiners",
    "billableParticipants",
    "expectedStaffDiners",
    "additionalMealBuffer",
  ] as const) {
    const value = values[key];
    if (key !== "expectedDiners" && values.type !== "RETREAT" && value !== "")
      errors[key] = "This field applies only to retreats.";
    if (
      value !== "" &&
      (!/^\d+$/.test(value) ||
        !Number.isSafeInteger(Number(value)) ||
        Number(value) > 2147483647)
    )
      errors[key] =
        "Enter a nonnegative whole number up to 2,147,483,647, or leave unconfirmed.";
    counts[key] = value === "" ? null : Number(value);
  }
  if (
    counts.expectedDiners != null &&
    counts.expectedStaffDiners != null &&
    counts.expectedStaffDiners > counts.expectedDiners
  )
    errors.expectedStaffDiners =
      "Staff diners are included in expected diners and cannot exceed that total.";
  if (Object.keys(errors).length) throw new OperationValidationError(errors);
  const data = {
    name: values.name,
    type: values.type as OperationType,
    status: values.status as OperationStatus,
    startDate: dates.startDate,
    endDate: dates.endDate,
    locationId: values.locationId,
    expectedDiners: counts.expectedDiners,
    billableParticipants: counts.billableParticipants,
    expectedStaffDiners: counts.expectedStaffDiners,
    additionalMealBuffer: counts.additionalMealBuffer,
    staffDiscountPercent: values.type === "RETREAT" ? 60 : null,
    notes: values.notes || null,
  };
  validateOperation(data);
  return data;
}
