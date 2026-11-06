import { isUnit, scalingFraction, units, type BaseUnit } from "./quantities";
export type ReferencePricing = {
  baseUnit: BaseUnit;
  displayUnit: string;
  referencePriceCentavos: number | null;
  referencePriceUnit?: string | null;
};
export function referenceQuote(ingredient: ReferencePricing) {
  const unit = ingredient.referencePriceUnit ?? ingredient.displayUnit;
  const price = ingredient.referencePriceCentavos;
  return price != null &&
    Number.isSafeInteger(price) &&
    price >= 0 &&
    isUnit(unit) &&
    units[unit].base === ingredient.baseUnit
    ? { price, unit }
    : null;
}
function costForFraction(
  numerator: bigint,
  denominator: bigint,
  unit: BaseUnit,
  price: number | null,
  priceUnit: string | null,
) {
  if (
    numerator < 0n ||
    denominator < 1n ||
    price == null ||
    !Number.isSafeInteger(price) ||
    price < 0 ||
    !priceUnit ||
    !isUnit(priceUnit) ||
    units[priceUnit].base !== unit
  )
    return null;
  const n = numerator * BigInt(price),
    d = denominator * BigInt(units[priceUnit].factor);
  const rounded = (n + d / 2n) / d;
  return rounded <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(rounded) : null;
}
export function estimatedCost(
  quantityMilli: number,
  unit: BaseUnit,
  price: number | null,
  priceUnit: string | null,
) {
  if (!Number.isSafeInteger(quantityMilli) || quantityMilli < 0) return null;
  return costForFraction(BigInt(quantityMilli), 1n, unit, price, priceUnit);
}
export function estimatedRecipeIngredientCost(
  quantityMilli: number,
  standard: number,
  desired: number,
  unit: BaseUnit,
  quote: { price: number; unit: string } | null,
) {
  if (!quote) return null;
  const { numerator, denominator } = scalingFraction(
    quantityMilli,
    standard,
    desired,
  );
  return costForFraction(numerator, denominator, unit, quote.price, quote.unit);
}
export function summarizeCosts(costs: (number | null)[]) {
  const known = costs.filter(
    (cost): cost is number =>
      cost != null && Number.isSafeInteger(cost) && cost >= 0,
  );
  const sum = known.reduce((total, cost) => total + BigInt(cost), 0n);
  const subtotalCentavos =
    sum <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(sum) : null;
  const unknownCount = costs.length - known.length;
  return {
    pricedCount: known.length,
    unknownCount,
    subtotalCentavos,
    totalCentavos: unknownCount ? null : subtotalCentavos,
  };
}
export function shoppingQuote(
  savedPrice: number | null,
  savedUnit: string | null,
  ingredient: ReferencePricing,
) {
  if (savedPrice != null)
    return { price: savedPrice, unit: savedUnit, source: "list" as const };
  const quote = referenceQuote(ingredient);
  return quote
    ? { ...quote, source: "catalog" as const }
    : { price: null, unit: null, source: "unavailable" as const };
}
