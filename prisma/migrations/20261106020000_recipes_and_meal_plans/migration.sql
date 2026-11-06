ALTER TABLE "Ingredient" ADD COLUMN "normalizedName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Ingredient" ADD COLUMN "displayUnit" TEXT NOT NULL DEFAULT 'GRAM' CHECK ("displayUnit" IN ('GRAM','KILOGRAM','MILLILITER','LITER','EACH'));
ALTER TABLE "Ingredient" ADD COLUMN "notes" TEXT;
UPDATE "Ingredient" SET "normalizedName" = lower(trim("name")), "displayUnit" = "baseUnit";
CREATE UNIQUE INDEX "Ingredient_normalizedName_key" ON "Ingredient"("normalizedName");
ALTER TABLE "Recipe" ADD COLUMN "category" TEXT CHECK ("category" IS NULL OR "category" IN ('BREAKFAST','MAIN','SIDE','DESSERT','BEVERAGE'));
ALTER TABLE "Recipe" ADD COLUMN "preparationMinutes" INTEGER CHECK ("preparationMinutes" IS NULL OR "preparationMinutes" BETWEEN 1 AND 10080);
ALTER TABLE "Recipe" ADD COLUMN "notes" TEXT;
ALTER TABLE "Recipe" ADD COLUMN "archivedAt" DATETIME;
CREATE TABLE "new_RecipeIngredient" (
  "recipeId" TEXT NOT NULL,
  "ingredientId" TEXT NOT NULL,
  "quantityMilli" INTEGER NOT NULL CHECK ("quantityMilli" BETWEEN 1 AND 2147483647),
  "unit" TEXT NOT NULL CHECK ("unit" IN ('GRAM','MILLILITER','EACH')),
  PRIMARY KEY ("recipeId", "ingredientId"),
  FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- Preserve existing recipe amounts: 600 grams becomes 600000 thousandths of a gram.
INSERT INTO "new_RecipeIngredient" ("recipeId","ingredientId","quantityMilli","unit") SELECT "recipeId","ingredientId","quantity" * 1000,"unit" FROM "RecipeIngredient";
DROP TABLE "RecipeIngredient";
ALTER TABLE "new_RecipeIngredient" RENAME TO "RecipeIngredient";
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");
CREATE TABLE "MenuTemplate" (
 "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT NOT NULL, "description" TEXT, "notes" TEXT,
 "scheduleJson" TEXT NOT NULL CHECK (json_valid("scheduleJson")),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "MenuTemplate_name_key" ON "MenuTemplate"("name");
CREATE TABLE "OperationMealPlan" (
 "id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL,
 "sourceTemplateName" TEXT, "notes" TEXT,
 "scheduleJson" TEXT NOT NULL CHECK (json_valid("scheduleJson")),
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "OperationMealPlan_operationId_key" ON "OperationMealPlan"("operationId");
