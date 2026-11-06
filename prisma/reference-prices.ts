import type { Prisma } from "@prisma/client";
// Approximate Brazilian retail references for planning/testing, not supplier quotes.
// The original eight are user-supplied; additional rounded estimates are documented in README.
// Quote whole kg/L amounts; never round them to fractional centavos per g/mL.
export const referencePrices = [
  { names: ["bananas"], baseUnit: "GRAM", price: 800, unit: "KILOGRAM" },
  { names: ["brown rice"], baseUnit: "GRAM", price: 750, unit: "KILOGRAM" },
  { names: ["carrots"], baseUnit: "GRAM", price: 650, unit: "KILOGRAM" },
  {
    names: ["chickpeas", "chickpeas (dry)"],
    baseUnit: "GRAM",
    price: 2300,
    unit: "KILOGRAM",
  },
  {
    names: ["green lentils", "green lentils (dry)"],
    baseUnit: "GRAM",
    price: 2200,
    unit: "KILOGRAM",
  },
  { names: ["oranges"], baseUnit: "GRAM", price: 500, unit: "KILOGRAM" },
  { names: ["pumpkin"], baseUnit: "GRAM", price: 600, unit: "KILOGRAM" },
  // R$ 8.00 / 200 mL is exactly R$ 40.00 / L.
  {
    names: ["unsweetened coconut milk"],
    baseUnit: "MILLILITER",
    price: 4000,
    unit: "LITER",
  },
  { names: ["lemons"], baseUnit: "EACH", price: 200, unit: "EACH" },
  { names: ["olive oil"], baseUnit: "MILLILITER", price: 6000, unit: "LITER" },
  { names: ["rolled oats"], baseUnit: "GRAM", price: 2000, unit: "KILOGRAM" },
  { names: ["spinach"], baseUnit: "GRAM", price: 3000, unit: "KILOGRAM" },
  { names: ["tomatoes"], baseUnit: "GRAM", price: 1200, unit: "KILOGRAM" },
  {
    names: ["unsweetened cocoa"],
    baseUnit: "GRAM",
    price: 20000,
    unit: "KILOGRAM",
  },
  // Assume bottled still drinking water, not a municipal utility tariff.
  { names: ["water"], baseUnit: "MILLILITER", price: 200, unit: "LITER" },
] as const;
export async function fillUnsetReferencePrices(
  db: Pick<Prisma.TransactionClient, "ingredient">,
) {
  let updated = 0;
  for (const reference of referencePrices) {
    const result = await db.ingredient.updateMany({
      where: {
        normalizedName: { in: [...reference.names] },
        baseUnit: reference.baseUnit,
        referencePriceCentavos: null,
      },
      data: {
        referencePriceCentavos: reference.price,
        referencePriceUnit: reference.unit,
      },
    });
    updated += result.count;
  }
  return updated;
}
