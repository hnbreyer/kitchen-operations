import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { dateKey } from "@/lib/calendar";
import { decimalString } from "@/lib/menus/quantities";
import { PurchaseForm } from "@/components/purchasing/transaction-forms";
import type { PurchaseInput } from "@/lib/purchasing/transactions";
export const dynamic = "force-dynamic";
export default async function NewPurchase({
  searchParams,
}: {
  searchParams: Promise<{ operation?: string; list?: string }>;
}) {
  const query = await searchParams;
  const [catalog, operations, list] = await Promise.all([
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
    db.operation.findMany({
      orderBy: { startDate: "desc" },
      select: { id: true, name: true, type: true },
    }),
    query.list
      ? db.shoppingList.findUnique({
          where: { id: query.list },
          include: { items: { where: { excluded: false } } },
        })
      : null,
  ]);
  if (query.list && !list) notFound();
  if (query.operation && !operations.some((o) => o.id === query.operation))
    notFound();
  const operationId = list?.operationId ?? query.operation ?? "";
  const operation = operations.find((o) => o.id === operationId);
  const initial: PurchaseInput = {
    date: dateKey(new Date()),
    supplier: "",
    funding: operation?.type === "RETREAT" ? "SCHOOL" : "BUSINESS",
    paymentSource: "OWNER",
    operationId: operation?.id ?? "",
    shoppingListId: list?.id ?? "",
    notes: "",
    receiptReference: "",
    confirmed: false,
    organicConfirmed: false,
    items:
      list?.items
        .filter((i) => i.plannedMilli > 0n)
        .map((i) => ({
          ingredientId: i.ingredientId,
          quantity: decimalString(i.plannedMilli),
          unit: i.unit,
          price: "",
          priceUnit:
            catalog.find((c) => c.id === i.ingredientId)?.referencePriceUnit ??
            i.unit,
          shoppingItemId: i.id,
        })) ?? [],
  };
  if (!initial.items.length)
    initial.items.push({
      ingredientId: "",
      quantity: "",
      unit: "GRAM",
      price: "",
      priceUnit: "KILOGRAM",
      shoppingItemId: "",
    });
  return (
    <>
      <Link className="text-link" href="/purchasing">
        ← Back to purchasing
      </Link>
      <div className="page-heading">
        <div>
          <h1>Record ingredient purchase</h1>
          <p>
            {list
              ? "Starting from planned shopping quantities. Replace them with actual purchased quantities and prices."
              : "Record ingredients actually acquired for an operation or shared business use."}
          </p>
        </div>
      </div>
      {catalog.length ? (
        <PurchaseForm
          token={randomUUID()}
          catalog={catalog}
          operations={operations}
          initial={initial}
        />
      ) : (
        <section className="panel">
          <p>Add ingredients before recording a purchase.</p>
          <Link href="/recipes/ingredients/new" className="button">
            New ingredient
          </Link>
        </section>
      )}
    </>
  );
}
