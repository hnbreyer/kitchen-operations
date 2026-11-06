import type { PrismaClient } from "@prisma/client";
import {
  recordPurchase,
  recordReimbursement,
  type PurchaseInput,
} from "../src/lib/purchasing/transactions";
// Explicit opt-in only. Never imported by the normal seed or production initialization.
export async function seedTransactions(db: PrismaClient) {
  const base: PurchaseInput = {
    date: "2026-11-01",
    supplier: "",
    funding: "SCHOOL",
    paymentSource: "OWNER",
    operationId: "seed-operation-0",
    shoppingListId: "",
    notes: "",
    receiptReference: "",
    confirmed: true,
    organicConfirmed: true,
    items: [],
  };
  const examples = [
    {
      id: "seed-purchase-retreat-rice",
      supplier: "Harvest Market",
      ingredientId: "seed-rice",
      quantity: "5",
      unit: "KILOGRAM",
      price: "8.00",
      priceUnit: "KILOGRAM",
    },
    {
      id: "seed-purchase-retreat-produce",
      supplier: "Green Basket Produce",
      ingredientId: "seed-carrots",
      quantity: "4",
      unit: "KILOGRAM",
      price: "7.00",
      priceUnit: "KILOGRAM",
    },
    {
      id: "seed-purchase-retreat-full",
      supplier: "Valley Grocery",
      ingredientId: "seed-chickpeas",
      quantity: "2",
      unit: "KILOGRAM",
      price: "24.00",
      priceUnit: "KILOGRAM",
      operationId: "seed-operation-1",
    },
    {
      id: "seed-purchase-city",
      supplier: "Central Food Store",
      ingredientId: "seed-lentils",
      quantity: "3",
      unit: "KILOGRAM",
      price: "22.50",
      priceUnit: "KILOGRAM",
      operationId: "seed-operation-2",
      funding: "BUSINESS",
    },
    {
      id: "seed-purchase-shared",
      supplier: "Pantry Shop",
      ingredientId: "seed-oats",
      quantity: "1",
      unit: "KILOGRAM",
      price: "20.00",
      priceUnit: "KILOGRAM",
      operationId: "",
      funding: "BUSINESS",
    },
  ];
  for (const example of examples) {
    if (await db.purchase.findUnique({ where: { id: example.id } })) continue;
    const { id, supplier, operationId, funding, ...item } = example;
    await recordPurchase(
      id,
      {
        ...base,
        supplier,
        operationId: operationId ?? base.operationId,
        funding: funding ?? base.funding,
        items: [{ ...item, shoppingItemId: "" }],
      },
      db,
    );
  }
  for (const example of [
    {
      id: "seed-reimbursement-partial",
      allocations: [
        { purchaseId: "seed-purchase-retreat-rice", amount: "20.00" },
        { purchaseId: "seed-purchase-retreat-produce", amount: "8.00" },
      ],
      notes: "First school repayment",
    },
    {
      id: "seed-reimbursement-full",
      allocations: [
        { purchaseId: "seed-purchase-retreat-full", amount: "48.00" },
      ],
      notes: "Ingredient repayment received",
    },
  ]) {
    if (await db.reimbursement.findUnique({ where: { id: example.id } }))
      continue;
    await recordReimbursement(
      example.id,
      {
        date: "2026-11-02",
        notes: example.notes,
        allocations: example.allocations,
      },
      db,
    );
  }
}
