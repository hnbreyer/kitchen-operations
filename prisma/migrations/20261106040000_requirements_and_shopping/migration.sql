-- Additive planning records only. Existing operations, recipes, and snapshots are unchanged.
CREATE TABLE "IngredientSubstitution" (
 "id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL, "originalIngredientId" TEXT NOT NULL,
 "replacementIngredientId" TEXT NOT NULL, "quantityMilli" BIGINT NOT NULL CHECK (typeof("quantityMilli") = 'integer' AND "quantityMilli" BETWEEN 1 AND 9000000000000000),
 "unit" TEXT NOT NULL CHECK ("unit" IN ('GRAM','MILLILITER','EACH')), "notes" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CHECK ("originalIngredientId" != "replacementIngredientId"),
 FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("originalIngredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("replacementIngredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "IngredientSubstitution_operationId_originalIngredientId_key" ON "IngredientSubstitution"("operationId","originalIngredientId");
CREATE INDEX "IngredientSubstitution_replacementIngredientId_idx" ON "IngredientSubstitution"("replacementIngredientId");
CREATE TABLE "AvailableStock" (
 "id" TEXT NOT NULL PRIMARY KEY, "ingredientId" TEXT NOT NULL, "ownership" TEXT NOT NULL CHECK ("ownership" IN ('SCHOOL','BUSINESS')),
 "scopeKey" TEXT NOT NULL, "operationId" TEXT, "quantityMilli" BIGINT NOT NULL CHECK (typeof("quantityMilli") = 'integer' AND "quantityMilli" BETWEEN 0 AND 9000000000000000),
 "unit" TEXT NOT NULL CHECK ("unit" IN ('GRAM','MILLILITER','EACH')), "notes" TEXT,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 CHECK (("ownership" = 'BUSINESS' AND "operationId" IS NULL AND "scopeKey" = 'BUSINESS') OR
        ("ownership" = 'SCHOOL' AND "operationId" IS NOT NULL AND "scopeKey" = "operationId")),
 FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AvailableStock_scopeKey_ingredientId_key" ON "AvailableStock"("scopeKey","ingredientId");
CREATE INDEX "AvailableStock_operationId_idx" ON "AvailableStock"("operationId");
CREATE TABLE "ShoppingList" (
 "id" TEXT NOT NULL PRIMARY KEY, "operationId" TEXT NOT NULL, "ownership" TEXT NOT NULL CHECK ("ownership" IN ('SCHOOL','BUSINESS')),
 "organicRequired" BOOLEAN NOT NULL CHECK (("ownership" = 'SCHOOL' AND "organicRequired" = 1) OR ("ownership" = 'BUSINESS' AND "organicRequired" = 0)),
 "sourceFingerprint" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("operationId") REFERENCES "Operation"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShoppingList_operationId_key" ON "ShoppingList"("operationId");
CREATE TABLE "ShoppingItem" (
 "id" TEXT NOT NULL PRIMARY KEY, "listId" TEXT NOT NULL, "ingredientId" TEXT NOT NULL, "ingredientName" TEXT NOT NULL,
 "unit" TEXT NOT NULL CHECK ("unit" IN ('GRAM','MILLILITER','EACH')),
 "requiredMilli" BIGINT NOT NULL CHECK (typeof("requiredMilli") = 'integer' AND "requiredMilli" BETWEEN 0 AND 9000000000000000),
 "availableMilli" BIGINT CHECK ("availableMilli" IS NULL OR (typeof("availableMilli") = 'integer' AND "availableMilli" BETWEEN 0 AND 9000000000000000)),
 "plannedMilli" BIGINT NOT NULL CHECK (typeof("plannedMilli") = 'integer' AND "plannedMilli" BETWEEN 0 AND 9000000000000000),
 "estimatedPriceCentavos" INTEGER CHECK ("estimatedPriceCentavos" IS NULL OR "estimatedPriceCentavos" >= 0),
 "priceUnit" TEXT CHECK ("priceUnit" IS NULL OR "priceUnit" IN ('GRAM','KILOGRAM','MILLILITER','LITER','EACH')),
 "notes" TEXT, "purchased" BOOLEAN NOT NULL DEFAULT false, "manual" BOOLEAN NOT NULL DEFAULT false, "excluded" BOOLEAN NOT NULL DEFAULT false,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
 FOREIGN KEY ("listId") REFERENCES "ShoppingList"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 FOREIGN KEY ("ingredientId") REFERENCES "Ingredient"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ShoppingItem_listId_ingredientId_key" ON "ShoppingItem"("listId","ingredientId");
CREATE INDEX "ShoppingItem_ingredientId_idx" ON "ShoppingItem"("ingredientId");
CREATE TRIGGER "ShoppingList_ownership_insert" BEFORE INSERT ON "ShoppingList"
WHEN NOT EXISTS (SELECT 1 FROM "Operation" WHERE id = NEW."operationId" AND
 ((type = 'RETREAT' AND NEW.ownership = 'SCHOOL') OR (type != 'RETREAT' AND NEW.ownership = 'BUSINESS')))
BEGIN SELECT RAISE(ABORT, 'Shopping ownership must match the operation.'); END;
CREATE TRIGGER "ShoppingList_ownership_update" BEFORE UPDATE ON "ShoppingList"
WHEN NOT EXISTS (SELECT 1 FROM "Operation" WHERE id = NEW."operationId" AND
 ((type = 'RETREAT' AND NEW.ownership = 'SCHOOL') OR (type != 'RETREAT' AND NEW.ownership = 'BUSINESS')))
BEGIN SELECT RAISE(ABORT, 'Shopping ownership must match the operation.'); END;
CREATE TRIGGER "AvailableStock_school_insert" BEFORE INSERT ON "AvailableStock"
WHEN NEW.ownership = 'SCHOOL' AND NOT EXISTS (SELECT 1 FROM "Operation" WHERE id = NEW."operationId" AND type = 'RETREAT')
BEGIN SELECT RAISE(ABORT, 'School availability must belong to a retreat.'); END;
CREATE TRIGGER "AvailableStock_school_update" BEFORE UPDATE ON "AvailableStock"
WHEN NEW.ownership = 'SCHOOL' AND NOT EXISTS (SELECT 1 FROM "Operation" WHERE id = NEW."operationId" AND type = 'RETREAT')
BEGIN SELECT RAISE(ABORT, 'School availability must belong to a retreat.'); END;
CREATE TRIGGER "Operation_preserve_shopping_ownership" BEFORE UPDATE OF type ON "Operation"
WHEN (NEW.type = 'RETREAT') != (OLD.type = 'RETREAT') AND
 (EXISTS (SELECT 1 FROM "ShoppingList" WHERE "operationId" = OLD.id) OR EXISTS (SELECT 1 FROM "AvailableStock" WHERE "operationId" = OLD.id))
BEGIN SELECT RAISE(ABORT, 'Existing shopping or school availability records prevent ownership changes.'); END;
