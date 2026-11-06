import { afterAll, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PrismaClient } from "@prisma/client";
import { getOperations } from "../src/lib/operations";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db")) {
  throw new Error("Run npm test to use the isolated test database.");
}
const db = new PrismaClient();
afterAll(() => db.$disconnect());
it("retrieves seeded operations with locations and filters each type from SQLite", async () => {
  const { all } = await getOperations(undefined, db);
  expect(all.length).toBe(11);
  expect(all.every((o) => o.location.name.length > 0)).toBe(true);
  for (const [type, count] of [
    ["RETREAT", 6],
    ["CITY_SERVICE", 3],
    ["PRIVATE_EVENT", 2],
  ] as const) {
    const result = await getOperations(type, db);
    expect(result.all).toHaveLength(count);
    expect(result.all.every((o) => o.type === type)).toBe(true);
  }
});
it("keeps an operation upcoming through its entire final business-local day", async () => {
  const retreat = await db.operation.findUniqueOrThrow({
    where: { id: "seed-operation-0" },
  });
  const laterThatDay = new Date(retreat.endDate.getTime() + 8 * 60 * 60 * 1000);
  expect(
    (await getOperations("RETREAT", db, laterThatDay)).upcoming.some(
      (o) => o.id === retreat.id,
    ),
  ).toBe(true);
});
it("enforces count and date constraints even when validation is bypassed", async () => {
  await expect(
    db.operation.update({
      where: { id: "seed-operation-0" },
      data: { expectedDiners: -1 },
    }),
  ).rejects.toThrow();
  await expect(
    db.operation.update({
      where: { id: "seed-operation-0" },
      data: { endDate: new Date("2000-01-01") },
    }),
  ).rejects.toThrow();
  await expect(
    db.operation.update({
      where: { id: "seed-operation-2" },
      data: { billableParticipants: 4 },
    }),
  ).rejects.toThrow();
});
it("orders upcoming first, excludes completed/cancelled, and handles an empty database", async () => {
  const data = await getOperations(undefined, db, new Date("2000-01-01"));
  expect(data.upcoming.map((o) => o.startDate.getTime())).toEqual(
    [...data.upcoming.map((o) => o.startDate.getTime())].sort((a, b) => a - b),
  );
  await db.$transaction(async (tx) => {
    await tx.operation.update({
      where: { id: "seed-operation-0" },
      data: { status: "CANCELLED" },
    });
    await tx.operation.update({
      where: { id: "seed-operation-1" },
      data: { status: "COMPLETED" },
    });
  });
  const result = await getOperations("RETREAT", db, new Date("2000-01-01"));
  expect(result.upcoming).toHaveLength(4);
  expect(result.all).toHaveLength(6);
  // Query a real empty SQLite database without deleting protected financial history.
  const directory = mkdtempSync(join(tmpdir(), "kitchen-empty-operations-"));
  const empty = new PrismaClient({
    datasources: { db: { url: `file:${join(directory, "empty.db")}` } },
  });
  try {
    for (const name of ["Location", "Operation"]) {
      const schema = await db.$queryRaw<
        { sql: string }[]
      >`SELECT sql FROM sqlite_master WHERE type='table' AND name=${name}`;
      await empty.$executeRawUnsafe(schema[0].sql);
    }
    expect((await getOperations(undefined, empty)).all).toEqual([]);
    expect((await getOperations(undefined, empty)).upcoming).toEqual([]);
  } finally {
    await empty.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
  await db.operation.update({
    where: { id: "seed-operation-0" },
    data: { status: "CONFIRMED" },
  });
  await db.operation.update({
    where: { id: "seed-operation-1" },
    data: { status: "DRAFT" },
  });
});
