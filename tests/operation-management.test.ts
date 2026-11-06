import { afterAll, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";
import {
  emptyOperation,
  parseOperationInput,
  OperationValidationError,
} from "../src/lib/operation-input";
import {
  saveOperationRecord,
  changeOperationStatus,
  deleteOperationRecord,
} from "../src/lib/operation-management";
import {
  businessDate,
  calendarDays,
  dateKey,
  operationsOnDate,
  adjacentMonth,
  parseMonth,
} from "../src/lib/calendar";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db"))
  throw new Error("Run npm test to use the isolated test database.");
const db = new PrismaClient();
afterAll(() => db.$disconnect());
function form(overrides: Record<string, string | undefined> = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    ...emptyOperation,
    name: "Fictional planning test",
    startDate: "2027-02-27",
    endDate: "2027-03-02",
    locationId: "seed-school",
    ...overrides,
  }))
    data.set(key, value ?? "");
  return data;
}
it("creates each operation type with persisted dates and only applicable retreat fields", async () => {
  for (const type of ["RETREAT", "CITY_SERVICE", "PRIVATE_EVENT"] as const) {
    const retreat =
      type === "RETREAT"
        ? {
            expectedDiners: "35",
            billableParticipants: "26",
            expectedStaffDiners: "6",
            additionalMealBuffer: "3",
          }
        : { expectedDiners: "20" };
    const created = await saveOperationRecord(
      form({ type, ...retreat }),
      null,
      null,
      db,
    );
    const stored = await db.operation.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(stored.type).toBe(type);
    expect(dateKey(stored.startDate)).toBe("2027-02-27");
    expect(dateKey(stored.endDate)).toBe("2027-03-02");
    expect(stored.staffDiscountPercent).toBe(type === "RETREAT" ? 60 : null);
    expect(stored.expectedStaffDiners).toBe(type === "RETREAT" ? 6 : null);
    expect(stored.additionalMealBuffer).toBe(type === "RETREAT" ? 3 : null);
    await db.operation.delete({ where: { id: stored.id } });
  }
});
it("edits attendance, persists status, protects stale changes, and confirms scoped deletion", async () => {
  const created = await saveOperationRecord(form(), null, null, db);
  let stored = await db.operation.findUniqueOrThrow({
    where: { id: created.id },
  });
  const originalVersion = stored.updatedAt.toISOString();
  await saveOperationRecord(
    form({
      name: "Attendance confirmed",
      expectedDiners: "36",
      billableParticipants: "28",
      expectedStaffDiners: "6",
      additionalMealBuffer: "2",
      notes: "Two extra unbilled diners.",
    }),
    stored.id,
    originalVersion,
    db,
  );
  stored = await db.operation.findUniqueOrThrow({ where: { id: stored.id } });
  expect(stored.name).toBe("Attendance confirmed");
  expect(stored.expectedDiners! + stored.additionalMealBuffer!).toBe(38);
  expect(stored.billableParticipants).toBe(28);
  expect(stored.staffDiscountPercent).toBe(60);
  await expect(
    saveOperationRecord(form(), stored.id, originalVersion, db),
  ).rejects.toThrow("changed");
  for (const status of ["CONFIRMED", "COMPLETED", "CANCELLED", "DRAFT"]) {
    await changeOperationStatus(
      stored.id,
      stored.updatedAt.toISOString(),
      status,
      db,
    );
    stored = await db.operation.findUniqueOrThrow({ where: { id: stored.id } });
    expect(stored.status).toBe(status);
    expect(stored.notes).toBe("Two extra unbilled diners.");
    expect(stored.expectedDiners).toBe(36);
  }
  await expect(
    changeOperationStatus(
      stored.id,
      stored.updatedAt.toISOString(),
      "UNKNOWN",
      db,
    ),
  ).rejects.toThrow();
  await expect(
    deleteOperationRecord(stored.id, stored.updatedAt.toISOString(), "", db),
  ).rejects.toThrow("highlighted");
  expect(
    await db.operation.findUnique({ where: { id: stored.id } }),
  ).not.toBeNull();
  const before = await db.operation.count();
  await deleteOperationRecord(
    stored.id,
    stored.updatedAt.toISOString(),
    stored.id,
    db,
  );
  expect(await db.operation.count()).toBe(before - 1);
  expect(
    await db.location.findUnique({ where: { id: "seed-school" } }),
  ).not.toBeNull();
});
it("clears retreat fields when converting an operation to another type", async () => {
  const created = await saveOperationRecord(
    form({ expectedStaffDiners: "4", additionalMealBuffer: "2" }),
    null,
    null,
    db,
  );
  const stored = await db.operation.findUniqueOrThrow({
    where: { id: created.id },
  });
  await saveOperationRecord(
    form({ type: "CITY_SERVICE" }),
    stored.id,
    stored.updatedAt.toISOString(),
    db,
  );
  const converted = await db.operation.findUniqueOrThrow({
    where: { id: stored.id },
  });
  expect(converted.expectedStaffDiners).toBeNull();
  expect(converted.additionalMealBuffer).toBeNull();
  expect(converted.staffDiscountPercent).toBeNull();
  await db.operation.delete({ where: { id: stored.id } });
});
it("validates date ranges, counts, retreat-only fields, statuses, and locations on the server", async () => {
  for (const overrides of [
    { name: " " },
    { endDate: "2027-02-26" },
    { startDate: "2027-02-30" },
    { expectedDiners: "-1" },
    { expectedStaffDiners: "1.2" },
    { additionalMealBuffer: "2147483648" },
    { type: "CITY_SERVICE", expectedStaffDiners: "2" },
    { type: "PRIVATE_EVENT", billableParticipants: "2" },
    { expectedDiners: "3", expectedStaffDiners: "4" },
    { status: "UNKNOWN" },
  ])
    expect(() => parseOperationInput(form(overrides))).toThrow(
      OperationValidationError,
    );
  await expect(
    saveOperationRecord(
      form({ locationId: "missing-location" }),
      null,
      null,
      db,
    ),
  ).rejects.toThrow(OperationValidationError);
  const pending = parseOperationInput(form());
  expect(pending.expectedDiners).toBeNull();
  expect(pending.expectedStaffDiners).toBeNull();
});
it("enforces staff count and discount policies in SQLite", async () => {
  const created = await saveOperationRecord(
    form({ expectedDiners: "20" }),
    null,
    null,
    db,
  );
  await expect(
    db.operation.update({
      where: { id: created.id },
      data: { expectedStaffDiners: 21 },
    }),
  ).rejects.toThrow();
  await expect(
    db.operation.update({
      where: { id: created.id },
      data: { staffDiscountPercent: 0 },
    }),
  ).rejects.toThrow();
  await expect(
    db.operation.update({
      where: { id: created.id },
      data: { staffDiscountPercent: null },
    }),
  ).rejects.toThrow();
  await db.operation.update({
    where: { id: created.id },
    data: { expectedStaffDiners: 6 },
  });
  await expect(
    db.operation.update({
      where: { id: created.id },
      data: { expectedDiners: 5 },
    }),
  ).rejects.toThrow();
  await db.operation.delete({ where: { id: created.id } });
});
it("handles inclusive cross-month ranges, leap years, and business-timezone date conversion", () => {
  for (const timezone of [
    "America/Sao_Paulo",
    "America/Manaus",
    "America/New_York",
    "Pacific/Auckland",
  ]) {
    for (const day of ["2027-03-14", "2027-11-07", "2028-02-29"])
      expect(dateKey(businessDate(day, timezone), timezone)).toBe(day);
  }
  const retreat = {
    startDate: businessDate("2027-02-27"),
    endDate: businessDate("2027-03-02"),
  };
  for (const day of ["2027-02-27", "2027-02-28", "2027-03-01", "2027-03-02"])
    expect(operationsOnDate([retreat], day)).toHaveLength(1);
  for (const day of ["2027-02-26", "2027-03-03"])
    expect(operationsOnDate([retreat], day)).toEqual([]);
  expect(calendarDays("2028-02").days).toHaveLength(29);
  expect(calendarDays("2027-02").offset).toBe(0);
  expect(adjacentMonth("2027-12", 1)).toBe("2028-01");
  expect(parseMonth("2027-13", businessDate("2027-04-03"))).toBe("2027-04");
});
