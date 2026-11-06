import { referenceQuote, estimatedCost } from "../menus/pricing";
export { estimatedCost } from "../menus/pricing";
import {
  isUnit,
  scalingFraction,
  decimalString,
  units,
  type BaseUnit,
} from "../menus/quantities";
import { mealTypes, type PlannedMeal } from "../menus/types";
export const MAX_QUANTITY = 9000000000000000;
export type CatalogEntry = {
  id: string;
  name: string;
  baseUnit: BaseUnit;
  displayUnit: string;
  referencePriceCentavos: number | null;
  referencePriceUnit?: string | null;
};
export type SubstitutionInput = {
  originalIngredientId: string;
  replacementIngredientId: string;
  quantityMilli: bigint | number;
  unit: BaseUnit;
  notes?: string | null;
};
export type Contribution = {
  dishKey: string;
  label: string;
  quantity: string;
  substitutedFrom?: string;
};
export type Requirement = {
  ingredientId: string;
  name: string;
  unit: BaseUnit;
  requiredMilli: number;
  approximate: boolean;
  contributions: Contribution[];
  priceCentavos: number | null;
  priceUnit: string | null;
  estimatedCostCentavos: number | null;
};
function gcd(a: bigint, b: bigint): bigint {
  while (b) {
    const next = a % b;
    a = b;
    b = next;
  }
  return a;
}
function add(a: { n: bigint; d: bigint }, b: { n: bigint; d: bigint }) {
  const common = gcd(a.d, b.d),
    n = a.n * (b.d / common) + b.n * (a.d / common),
    d = a.d * (b.d / common),
    divisor = gcd(n, d);
  return { n: n / divisor, d: d / divisor };
}
export function calculateRequirements(
  meals: PlannedMeal[],
  catalog: CatalogEntry[],
  substitutions: SubstitutionInput[] = [],
) {
  const issues: string[] = [],
    warnings: string[] = [];
  const totals = new Map<
    string,
    {
      name: string;
      unit: BaseUnit;
      n: bigint;
      d: bigint;
      contributions: Contribution[];
    }
  >();
  const dimensions = new Map<string, BaseUnit>();
  let entries = 0;
  for (const meal of meals)
    for (const dish of meal.dishes) {
      const label = `${meal.date} · ${mealTypes[meal.type] ?? meal.type} · ${dish.snapshot.name}`;
      if (
        !Array.isArray(dish.snapshot.ingredients) ||
        !dish.snapshot.ingredients.length
      ) {
        issues.push(`${label}: ingredient quantities are missing.`);
        continue;
      }
      for (const ingredient of dish.snapshot.ingredients) {
        if (++entries > 20000) {
          issues.push(
            "This plan exceeds the supported calculation size. Split it into smaller operations.",
          );
          break;
        }
        try {
          if (!ingredient.ingredientId || !isUnit(ingredient.unit))
            throw new Error("Missing ingredient identity or invalid unit.");
          const base = units[ingredient.unit].base;
          if (
            dimensions.has(ingredient.ingredientId) &&
            dimensions.get(ingredient.ingredientId) !== base
          )
            throw new Error(
              "Incompatible measurement types for the same ingredient.",
            );
          dimensions.set(ingredient.ingredientId, base);
          const item = catalog.find((i) => i.id === ingredient.ingredientId);
          if (!item || item.baseUnit !== base)
            throw new Error(
              "Ingredient is missing from the catalog or its measurement type changed.",
            );
          // Snapshot quantities are thousandths of their stated unit; current snapshots use base units.
          const fraction = scalingFraction(
            ingredient.quantityMilli,
            dish.snapshot.standardPortionYield,
            dish.portions ?? 0,
          );
          const n =
              fraction.numerator * BigInt(units[ingredient.unit].factor / 1000),
            d = fraction.denominator;
          const old = totals.get(ingredient.ingredientId),
            sum = old ? add(old, { n, d }) : { n, d };
          const contribution: Contribution = {
            dishKey: dish.key,
            label,
            quantity: `${n % d !== 0n ? "≈ " : ""}${decimalString((n + d / 2n) / d)} ${units[base].label}`,
          };
          totals.set(ingredient.ingredientId, {
            name: ingredient.name,
            unit: base,
            ...sum,
            contributions: [...(old?.contributions ?? []), contribution],
          });
        } catch (error) {
          issues.push(
            `${label} / ${ingredient.name}: ${(error as Error).message}`,
          );
        }
      }
    }
  const original = new Map(totals);
  for (const substitution of substitutions)
    totals.delete(substitution.originalIngredientId);
  for (const substitution of substitutions) {
    const source = original.get(substitution.originalIngredientId);
    if (!source) {
      warnings.push(
        "A saved substitution no longer matches an ingredient in this plan. Remove it or review it before reuse.",
      );
      continue;
    }
    const replacement = catalog.find(
      (i) => i.id === substitution.replacementIngredientId,
    );
    const amount = BigInt(substitution.quantityMilli);
    if (
      !replacement ||
      replacement.baseUnit !== substitution.unit ||
      amount < 1n ||
      amount > BigInt(MAX_QUANTITY)
    ) {
      issues.push(`Invalid replacement quantity or unit for ${source.name}.`);
      continue;
    }
    const old = totals.get(replacement.id),
      sum = old ? add(old, { n: amount, d: 1n }) : { n: amount, d: 1n };
    totals.set(replacement.id, {
      name: replacement.name,
      unit: replacement.baseUnit,
      ...sum,
      contributions: [
        ...(old?.contributions ?? []),
        ...source.contributions.map((c) => ({
          ...c,
          substitutedFrom: source.name,
          quantity: "Part of the explicit operation replacement total",
        })),
      ],
    });
  }
  const requirements: Requirement[] = [];
  for (const [ingredientId, total] of totals) {
    const rounded = (total.n + total.d - 1n) / total.d;
    if (rounded > BigInt(MAX_QUANTITY)) {
      issues.push(`${total.name}: total exceeds the supported quantity range.`);
      continue;
    }
    const item = catalog.find((i) => i.id === ingredientId)!;
    const quote = referenceQuote(item);
    const priceUnit = quote?.unit ?? null;
    requirements.push({
      ingredientId,
      name: total.name,
      unit: total.unit,
      requiredMilli: Number(rounded),
      approximate: total.n % total.d !== 0n,
      contributions: total.contributions,
      priceCentavos: item.referencePriceCentavos,
      priceUnit,
      estimatedCostCentavos: estimatedCost(
        Number(rounded),
        total.unit,
        item.referencePriceCentavos,
        priceUnit,
      ),
    });
  }
  return {
    requirements: requirements.sort((a, b) => a.name.localeCompare(b.name)),
    issues: [...new Set(issues)],
    warnings: [...new Set(warnings)],
  };
}
