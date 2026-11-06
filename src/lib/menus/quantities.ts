export const units = {
  GRAM: { label: "g", base: "GRAM", factor: 1000 },
  KILOGRAM: { label: "kg", base: "GRAM", factor: 1000000 },
  MILLILITER: { label: "mL", base: "MILLILITER", factor: 1000 },
  LITER: { label: "L", base: "MILLILITER", factor: 1000000 },
  EACH: { label: "each", base: "EACH", factor: 1000 },
} as const;
export type Unit = keyof typeof units;
export type BaseUnit = "GRAM" | "MILLILITER" | "EACH";
export const categories = {
  BREAKFAST: "Breakfast",
  MAIN: "Main dish",
  SIDE: "Side dish",
  DESSERT: "Dessert",
  BEVERAGE: "Beverage",
} as const;
export function isUnit(unit: string): unit is Unit {
  return Object.hasOwn(units, unit);
}
export function exactDecimal(
  value: string,
  factor: number,
  allowZero = false,
  maximum = 2147483647,
) {
  if (value.length > 32 || !/^\d+(\.\d{1,6})?$/.test(value))
    throw new Error("Enter a positive decimal number using a period.");
  const [whole, decimals = ""] = value.split(".");
  const denominator = 10n ** BigInt(decimals.length);
  const numerator = BigInt(whole + decimals) * BigInt(factor);
  if (numerator % denominator)
    throw new Error("This value has more precision than supported.");
  const result = numerator / denominator;
  if (result < (allowZero ? 0n : 1n) || result > BigInt(maximum))
    throw new Error("The value is outside the supported range.");
  return Number(result);
}
export function toQuantityMilli(value: string, unit: string, base: BaseUnit) {
  if (!isUnit(unit) || units[unit].base !== base)
    throw new Error("The selected unit is incompatible with this ingredient.");
  return exactDecimal(value, units[unit].factor);
}
export function portions(value: string | number) {
  if (
    !/^\d+$/.test(String(value)) ||
    Number(value) < 1 ||
    Number(value) > 100000
  )
    throw new Error("Portions must be a whole number between 1 and 100,000.");
  return Number(value);
}
export function decimalString(value: bigint, digits = 3) {
  const text = value.toString().padStart(digits + 1, "0");
  const decimals = text.slice(-digits).replace(/0+$/, "");
  return `${text.slice(0, -digits)}${decimals ? `.${decimals}` : ""}`;
}
export function scalingFraction(
  quantityMilli: number,
  standard: number,
  desired: number,
) {
  portions(standard);
  portions(desired);
  if (
    !Number.isInteger(quantityMilli) ||
    quantityMilli <= 0 ||
    quantityMilli > 2147483647
  )
    throw new Error("Invalid recipe quantity.");
  const numerator = BigInt(quantityMilli) * BigInt(desired),
    denominator = BigInt(standard);
  return { numerator, denominator };
}
export function scaledQuantity(
  quantityMilli: number,
  standard: number,
  desired: number,
) {
  const { numerator, denominator } = scalingFraction(
    quantityMilli,
    standard,
    desired,
  );
  return {
    text: decimalString((numerator + denominator / 2n) / denominator),
    approximate: numerator % denominator !== 0n,
  };
}

export function preparationTarget(
  expectedDiners: number | null,
  buffer: number | null,
  type: string,
) {
  return expectedDiners == null
    ? null
    : expectedDiners + (type === "RETREAT" ? (buffer ?? 0) : 0);
}
