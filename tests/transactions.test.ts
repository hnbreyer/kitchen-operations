import { afterAll, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import {
  recordPurchase,
  recordReimbursement,
  purchaseInclude,
  purchaseBalance,
  editPurchaseMetadata,
  type PurchaseInput,
} from "../src/lib/purchasing/transactions";
import { seedTransactions } from "../prisma/seed-transactions";
import { deleteOperationRecord } from "../src/lib/operation-management";
if (!process.env.DATABASE_URL?.endsWith("/prisma/test.db"))
  throw new Error("Use npm test with the isolated database.");
const db = new PrismaClient();
afterAll(() => db.$disconnect());
const fixture = (change: Partial<PurchaseInput> = {}): PurchaseInput => ({
  date: "2040-01-01",
  supplier: "Purchase test supplier",
  funding: "SCHOOL",
  paymentSource: "OWNER",
  operationId: "seed-operation-0",
  shoppingListId: "",
  notes: "Receipt checked",
  receiptReference: "R-100",
  confirmed: true,
  organicConfirmed: true,
  items: [
    {
      ingredientId: "seed-rice",
      quantity: "1.5",
      unit: "KILOGRAM",
      price: "9.00",
      priceUnit: "KILOGRAM",
      shoppingItemId: "",
    },
    {
      ingredientId: "seed-coconut-milk",
      quantity: "200",
      unit: "MILLILITER",
      price: "40.00",
      priceUnit: "LITER",
      shoppingItemId: "",
    },
  ],
  ...change,
});
it("records actual prices, exact quantities, and totals independently of reference prices and preserves shopping plans", async () => {
  const before = await db.shoppingItem.findMany({ orderBy: { id: "asc" } });
  const id = randomUUID();
  const input = fixture();
  const p = await recordPurchase(id, input, db);
  expect(p.totalCentavos).toBe(2150);
  const loaded = await db.purchase.findUniqueOrThrow({
    where: { id },
    include: purchaseInclude,
  });
  expect(
    loaded.items.find((i) => i.ingredientId === "seed-rice")!.quantityMilli,
  ).toBe(1500000n);
  expect(
    loaded.items.find((i) => i.ingredientId === "seed-rice")!.priceCentavos,
  ).toBe(900);
  const ingredient = await db.ingredient.findUniqueOrThrow({
    where: { id: "seed-rice" },
  });
  await db.ingredient.update({
    where: { id: "seed-rice" },
    data: { referencePriceCentavos: 2000 },
  });
  expect(
    (
      await db.purchase.findUniqueOrThrow({
        where: { id },
        include: purchaseInclude,
      })
    ).items,
  ).toEqual(loaded.items);
  await db.ingredient.update({
    where: { id: "seed-rice" },
    data: { referencePriceCentavos: ingredient.referencePriceCentavos },
  });
  expect((await recordPurchase(id, input, db)).id).toBe(id);
  expect(await db.purchase.count({ where: { id } })).toBe(1);
  await expect(
    recordPurchase(id, { ...input, supplier: "Different" }, db),
  ).rejects.toThrow("different values");
  expect(await db.shoppingItem.findMany({ orderBy: { id: "asc" } })).toEqual(
    before,
  );
});
it("supports partial and full repayments spanning purchases and prevents overpayments, duplicates and backdating", async () => {
  const ids = [randomUUID(), randomUUID()];
  for (const id of ids) await recordPurchase(id, fixture(), db);
  const partial = {
    date: "2040-01-02",
    notes: "Part payment",
    allocations: ids.map((purchaseId) => ({ purchaseId, amount: "10.00" })),
  };
  const paymentId = randomUUID();
  expect(
    (await recordReimbursement(paymentId, partial, db)).totalCentavos,
  ).toBe(2000);
  await recordReimbursement(paymentId, partial, db);
  expect(
    await db.reimbursementAllocation.count({
      where: { reimbursementId: paymentId },
    }),
  ).toBe(2);
  for (const id of ids) {
    const b = purchaseBalance(
      await db.purchase.findUniqueOrThrow({
        where: { id },
        include: purchaseInclude,
      }),
    );
    expect(b.status).toBe("Partially reimbursed");
    expect(b.outstanding).toBe(1150);
  }
  await expect(
    recordReimbursement(
      randomUUID(),
      { ...partial, allocations: [{ purchaseId: ids[0], amount: "11.51" }] },
      db,
    ),
  ).rejects.toThrow("exceeds");
  await expect(
    recordReimbursement(
      randomUUID(),
      {
        ...partial,
        allocations: [
          { purchaseId: ids[0], amount: "1.00" },
          { purchaseId: ids[0], amount: "1.00" },
        ],
      },
      db,
    ),
  ).rejects.toThrow("only once");
  await expect(
    recordReimbursement(randomUUID(), { ...partial, date: "2039-12-31" }, db),
  ).rejects.toThrow("precede");
  await recordReimbursement(
    randomUUID(),
    {
      ...partial,
      allocations: ids.map((purchaseId) => ({ purchaseId, amount: "11.50" })),
    },
    db,
  );
  for (const id of ids)
    expect(
      purchaseBalance(
        await db.purchase.findUniqueOrThrow({
          where: { id },
          include: purchaseInclude,
        }),
      ),
    ).toMatchObject({ status: "Reimbursed", outstanding: 0, reimbursed: 2150 });
});
it("keeps business and school-paid purchases ineligible and rejects invalid ownership and incompatible units atomically", async () => {
  for (const data of [
    fixture({
      funding: "BUSINESS",
      operationId: "seed-operation-2",
      paymentSource: "BUSINESS",
    }),
    fixture({ funding: "BUSINESS", operationId: "" }),
    fixture({ paymentSource: "SCHOOL" }),
  ]) {
    const p = await recordPurchase(randomUUID(), data, db);
    await expect(
      recordReimbursement(
        randomUUID(),
        {
          date: "2040-01-02",
          notes: "",
          allocations: [{ purchaseId: p.id, amount: "1.00" }],
        },
        db,
      ),
    ).rejects.toThrow("eligible");
  }
  for (const data of [
    fixture({ operationId: "" }),
    fixture({ funding: "BUSINESS" }),
    fixture({ paymentSource: "BUSINESS" }),
    fixture({ confirmed: false }),
    fixture({ organicConfirmed: false }),
    fixture({ items: [{ ...fixture().items[0], unit: "LITER" }] }),
    fixture({ items: [{ ...fixture().items[0], price: "-1" }] }),
    fixture({ items: [{ ...fixture().items[0], quantity: "0" }] }),
  ]) {
    const id = randomUUID();
    await expect(recordPurchase(id, data, db)).rejects.toThrow();
    expect(await db.purchase.findUnique({ where: { id } })).toBeNull();
  }
});
it("protects history, guards metadata with versions, and blocks raw database over-allocation", async () => {
  const p = await recordPurchase(randomUUID(), fixture(), db);
  const f = new FormData();
  f.set("supplier", "Corrected supplier");
  f.set("notes", "Receipt filed");
  f.set("receiptReference", "R-101");
  await editPurchaseMetadata(p.id, p.updatedAt.toISOString(), f, db);
  await expect(
    editPurchaseMetadata(p.id, p.updatedAt.toISOString(), f, db),
  ).rejects.toThrow("changed");
  await expect(
    db.purchase.update({ where: { id: p.id }, data: { totalCentavos: 1 } }),
  ).rejects.toThrow();
  const loaded = await db.purchase.findUniqueOrThrow({
    where: { id: p.id },
    include: purchaseInclude,
  });
  await expect(
    db.purchaseItem.update({
      where: { id: loaded.items[0].id },
      data: { priceCentavos: 1 },
    }),
  ).rejects.toThrow();
  await expect(db.purchase.delete({ where: { id: p.id } })).rejects.toThrow();
  const operation = await db.operation.findUniqueOrThrow({
    where: { id: p.operationId! },
  });
  await expect(
    db.operation.update({
      where: { id: operation.id },
      data: { type: "PRIVATE_EVENT" },
    }),
  ).rejects.toThrow();
  await expect(
    deleteOperationRecord(
      operation.id,
      operation.updatedAt.toISOString(),
      operation.id,
      db,
    ),
  ).rejects.toThrow();
  const bad = randomUUID();
  await expect(
    db.$transaction(async (tx) => {
      await tx.reimbursement.create({
        data: {
          id: bad,
          requestHash: "test",
          paymentDate: new Date("2040-01-02T15:00:00Z"),
          totalCentavos: 999999,
        },
      });
      await tx.reimbursementAllocation.create({
        data: {
          reimbursementId: bad,
          purchaseId: p.id,
          amountCentavos: 999999,
        },
      });
    }),
  ).rejects.toThrow();
  expect(await db.reimbursement.findUnique({ where: { id: bad } })).toBeNull();
  const payment = await recordReimbursement(
    randomUUID(),
    {
      date: "2040-01-02",
      notes: "",
      allocations: [{ purchaseId: p.id, amount: "1.00" }],
    },
    db,
  );
  await expect(
    db.reimbursementAllocation.update({
      where: {
        reimbursementId_purchaseId: {
          reimbursementId: payment.id,
          purchaseId: p.id,
        },
      },
      data: { amountCentavos: 1 },
    }),
  ).rejects.toThrow();
  await expect(
    db.reimbursement.delete({ where: { id: payment.id } }),
  ).rejects.toThrow();
});
it("links actual purchases to matching shopping items without altering planned quantities or task checkmarks", async () => {
  const list = await db.shoppingList.findUniqueOrThrow({
    where: { operationId: "seed-operation-2" },
    include: { items: true },
  });
  const item = list.items.find((i) => i.ingredientId === "seed-rice")!;
  const p = await recordPurchase(
    randomUUID(),
    fixture({
      funding: "BUSINESS",
      operationId: list.operationId,
      shoppingListId: list.id,
      items: [{ ...fixture().items[0], shoppingItemId: item.id }],
    }),
    db,
  );
  expect(
    (await db.purchaseItem.findFirstOrThrow({ where: { purchaseId: p.id } }))
      .shoppingItemId,
  ).toBe(item.id);
  expect(await db.shoppingItem.findUnique({ where: { id: item.id } })).toEqual(
    item,
  );
  await expect(
    recordPurchase(randomUUID(), fixture({ shoppingListId: list.id }), db),
  ).rejects.toThrow("Shopping list");
});
it("adds financial examples only on explicit invocation and preserves all existing financial records on repeats", async () => {
  await seedTransactions(db);
  const before = {
    p: await db.purchase.findMany({ orderBy: { id: "asc" } }),
    items: await db.purchaseItem.findMany({ orderBy: { id: "asc" } }),
    r: await db.reimbursement.findMany({ orderBy: { id: "asc" } }),
    a: await db.reimbursementAllocation.findMany({
      orderBy: [{ reimbursementId: "asc" }, { purchaseId: "asc" }],
    }),
  };
  await seedTransactions(db);
  expect(await db.purchase.findMany({ orderBy: { id: "asc" } })).toEqual(
    before.p,
  );
  expect(await db.purchaseItem.findMany({ orderBy: { id: "asc" } })).toEqual(
    before.items,
  );
  expect(await db.reimbursement.findMany({ orderBy: { id: "asc" } })).toEqual(
    before.r,
  );
  expect(
    await db.reimbursementAllocation.findMany({
      orderBy: [{ reimbursementId: "asc" }, { purchaseId: "asc" }],
    }),
  ).toEqual(before.a);
  expect(
    purchaseBalance(
      await db.purchase.findUniqueOrThrow({
        where: { id: "seed-purchase-retreat-full" },
        include: purchaseInclude,
      }),
    ).status,
  ).toBe("Reimbursed");
});
