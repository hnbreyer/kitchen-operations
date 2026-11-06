-- CreateTable
CREATE TABLE "Location" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "address" TEXT
);

-- CreateTable
CREATE TABLE "Operation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL CHECK ("type" IN ('RETREAT', 'CITY_SERVICE', 'PRIVATE_EVENT')),
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME NOT NULL CHECK ("endDate" >= "startDate"),
    "locationId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT' CHECK ("status" IN ('DRAFT', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
    "expectedDiners" INTEGER CHECK ("expectedDiners" IS NULL OR "expectedDiners" >= 0),
    "billableParticipants" INTEGER CHECK ("billableParticipants" IS NULL OR ("billableParticipants" >= 0 AND "type" = 'RETREAT')),
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Operation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "baseUnit" TEXT NOT NULL CHECK ("baseUnit" IN ('GRAM', 'MILLILITER', 'EACH')),
    "referencePriceCentavos" INTEGER CHECK ("referencePriceCentavos" IS NULL OR "referencePriceCentavos" >= 0),
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "standardPortionYield" INTEGER NOT NULL CHECK ("standardPortionYield" > 0),
    "instructions" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RecipeIngredient" (
    "recipeId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL CHECK ("quantity" > 0),
    "unit" TEXT NOT NULL CHECK ("unit" IN ('GRAM', 'MILLILITER', 'EACH')),

    PRIMARY KEY ("recipeId", "ingredientId"),
    CONSTRAINT "RecipeIngredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecipeIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Location_name_key" ON "Location"("name");

-- CreateIndex
CREATE INDEX "Operation_startDate_idx" ON "Operation"("startDate");

-- CreateIndex
CREATE INDEX "Operation_type_startDate_idx" ON "Operation"("type", "startDate");

-- CreateIndex
CREATE INDEX "Operation_status_endDate_idx" ON "Operation"("status", "endDate");

-- CreateIndex
CREATE INDEX "Operation_locationId_idx" ON "Operation"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_name_key" ON "Ingredient"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Recipe_name_key" ON "Recipe"("name");

-- CreateIndex
CREATE INDEX "RecipeIngredient_ingredientId_idx" ON "RecipeIngredient"("ingredientId");
