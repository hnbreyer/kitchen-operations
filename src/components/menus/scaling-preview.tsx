"use client";
import { useId, useState } from "react";
import {
  estimatedRecipeIngredientCost,
  summarizeCosts,
} from "@/lib/menus/pricing";
import { formatMoney } from "@/lib/config";
import { portions, scaledQuantity, units } from "@/lib/menus/quantities";
import type { RecipeSnapshot } from "@/lib/menus/types";
export function ScalingPreview({
  recipe,
  initialPortions,
  prices,
}: {
  recipe: RecipeSnapshot;
  initialPortions?: number;
  prices?: { ingredientId: string; price: number; unit: string }[];
}) {
  const previewId = useId();
  const [desired, setDesired] = useState(
    String(initialPortions ?? recipe.standardPortionYield),
  );
  let count: number | null = null,
    error = "";
  try {
    count = portions(desired);
  } catch (e) {
    error = (e as Error).message;
  }
  const costs = recipe.ingredients.map((ingredient) => {
    const quote = prices?.find(
      (p) => p.ingredientId === ingredient.ingredientId,
    );
    return count
      ? estimatedRecipeIngredientCost(
          ingredient.quantityMilli,
          recipe.standardPortionYield,
          count,
          ingredient.unit,
          quote ?? null,
        )
      : null;
  });
  const summary = summarizeCosts(costs);
  return (
    <div className="scaling-preview">
      <div className="field scale-field">
        <label htmlFor={`scale-${previewId}`}>Preview portions</label>
        <input
          id={`scale-${previewId}`}
          type="number"
          min="1"
          max="100000"
          step="1"
          value={desired}
          onChange={(e) => setDesired(e.target.value)}
          aria-invalid={!!error}
        />
      </div>
      {error && (
        <p role="status" className="field-error">
          {error}
        </p>
      )}
      <p className="field-hint">
        Preview only. Original quantities stay unchanged. ≈ indicates rounding
        to the nearest 0.001 base unit.
      </p>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Ingredient</th>
              <th>Required quantity</th>
              {prices && <th>Estimated ingredient cost</th>}
            </tr>
          </thead>
          <tbody>
            {recipe.ingredients.map((i, index) => {
              const scaled = count
                ? scaledQuantity(
                    i.quantityMilli,
                    recipe.standardPortionYield,
                    count,
                  )
                : null;
              return (
                <tr key={i.ingredientId}>
                  <td>{i.name}</td>
                  <td>
                    {scaled
                      ? `${scaled.approximate ? "≈ " : ""}${scaled.text} ${units[i.unit].label}`
                      : "—"}
                  </td>
                  {prices && (
                    <td>
                      {costs[index] == null
                        ? "Not available"
                        : formatMoney(costs[index]!)}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {prices && (
        <p className="footnote">
          {!count
            ? "Enter valid portions to preview costs."
            : summary.totalCentavos != null
              ? `Estimated ingredient total: ${formatMoney(summary.totalCentavos)}`
              : summary.pricedCount && summary.subtotalCentavos != null
                ? `Priced ingredients subtotal: ${formatMoney(summary.subtotalCentavos)} · ${summary.unknownCount} ingredients without available prices. Estimate incomplete.`
                : "Ingredient estimate unavailable. Reference prices are missing."}{" "}
          Ingredient references only; labor and other expenses are excluded.
        </p>
      )}
    </div>
  );
}
