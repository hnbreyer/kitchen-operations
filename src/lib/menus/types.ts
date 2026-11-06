import type { BaseUnit } from "./quantities";
export const mealTypes = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  DINNER: "Dinner",
  SNACK: "Snack",
} as const;
export type MealType = keyof typeof mealTypes;
export type TemplateMeal = {
  key: string;
  day: number;
  type: MealType;
  notes: string;
  dishes: { recipeId: string }[];
};
export type RecipeSnapshot = {
  recipeId: string;
  name: string;
  description: string | null;
  standardPortionYield: number;
  instructions: string;
  preparationMinutes: number | null;
  category: string | null;
  notes: string | null;
  ingredients: {
    ingredientId: string;
    name: string;
    quantityMilli: number;
    unit: BaseUnit;
    notes: string | null;
  }[];
};
export type PlannedMeal = {
  key: string;
  date: string;
  type: MealType;
  notes: string;
  dishes: {
    key: string;
    recipeId: string;
    portions: number | null;
    snapshot: RecipeSnapshot;
  }[];
};
export type EditorMeal = {
  key: string;
  day: string;
  date: string;
  type: MealType;
  notes: string;
  dishes: {
    key: string;
    recipeId: string;
    portions: string;
    snapshotName?: string;
  }[];
};
export type MutationState = { message?: string; savedId?: string };
