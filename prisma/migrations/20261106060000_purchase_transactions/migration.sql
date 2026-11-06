-- CreateTable
CREATE TABLE "Purchase" (
    "organicConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestHash" TEXT NOT NULL,
    "purchaseDate" DATETIME NOT NULL,
    "supplier" TEXT NOT NULL,
    "funding" TEXT NOT NULL,
    "paymentSource" TEXT NOT NULL,
    "operationId" TEXT,
    "shoppingListId" TEXT,
    "totalCentavos" INTEGER NOT NULL,
    "notes" TEXT,
    "receiptReference" TEXT,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Purchase_operationId_fkey" FOREIGN KEY ("operationId") REFERENCES "Operation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Purchase_shoppingListId_fkey" FOREIGN KEY ("shoppingListId") REFERENCES "ShoppingList" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "ingredientName" TEXT NOT NULL,
    "shoppingItemId" TEXT,
    "quantityMilli" BIGINT NOT NULL,
    "unit" TEXT NOT NULL,
    "priceCentavos" INTEGER NOT NULL,
    "priceUnit" TEXT NOT NULL,
    "lineTotalCentavos" INTEGER NOT NULL,
    CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseItem_shoppingItemId_fkey" FOREIGN KEY ("shoppingItemId") REFERENCES "ShoppingItem" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Reimbursement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "requestHash" TEXT NOT NULL,
    "paymentDate" DATETIME NOT NULL,
    "totalCentavos" INTEGER NOT NULL,
    "notes" TEXT,
    "finalized" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ReimbursementAllocation" (
    "reimbursementId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "amountCentavos" INTEGER NOT NULL,

    PRIMARY KEY ("reimbursementId", "purchaseId"),
    CONSTRAINT "ReimbursementAllocation_reimbursementId_fkey" FOREIGN KEY ("reimbursementId") REFERENCES "Reimbursement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ReimbursementAllocation_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Purchase_operationId_purchaseDate_idx" ON "Purchase"("operationId", "purchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_funding_purchaseDate_idx" ON "Purchase"("funding", "purchaseDate");

-- CreateIndex
CREATE INDEX "Purchase_shoppingListId_idx" ON "Purchase"("shoppingListId");

-- CreateIndex
CREATE INDEX "PurchaseItem_ingredientId_idx" ON "PurchaseItem"("ingredientId");

-- CreateIndex
CREATE INDEX "PurchaseItem_shoppingItemId_idx" ON "PurchaseItem"("shoppingItemId");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseItem_purchaseId_ingredientId_key" ON "PurchaseItem"("purchaseId", "ingredientId");

-- CreateIndex
CREATE INDEX "ReimbursementAllocation_purchaseId_idx" ON "ReimbursementAllocation"("purchaseId");


-- Financial rows are assembled in transactions and sealed only after exact totals match.
CREATE TRIGGER purchase_validate_insert BEFORE INSERT ON Purchase BEGIN
 SELECT CASE WHEN NEW.finalized != 0 OR typeof(NEW.totalCentavos) != 'integer' OR NEW.totalCentavos < 0 OR NEW.totalCentavos > 2147483647
 OR NEW.funding NOT IN ('SCHOOL','BUSINESS') OR NEW.paymentSource NOT IN ('OWNER','SCHOOL','BUSINESS')
 OR (NEW.funding='SCHOOL' AND (NEW.organicConfirmed != 1 OR NEW.operationId IS NULL OR NOT EXISTS(SELECT 1 FROM Operation WHERE id=NEW.operationId AND type='RETREAT') OR NEW.paymentSource='BUSINESS'))
 OR (NEW.funding='BUSINESS' AND (NEW.paymentSource='SCHOOL' OR EXISTS(SELECT 1 FROM Operation WHERE id=NEW.operationId AND type='RETREAT')))
 OR (NEW.shoppingListId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ShoppingList WHERE id=NEW.shoppingListId AND operationId=NEW.operationId AND ownership=NEW.funding))
 THEN RAISE(ABORT,'Invalid purchase ownership, source or context') END;
END;
CREATE TRIGGER purchase_protect_update BEFORE UPDATE ON Purchase BEGIN
 SELECT CASE WHEN NEW.organicConfirmed IS NOT OLD.organicConfirmed OR NEW.id IS NOT OLD.id OR NEW.requestHash IS NOT OLD.requestHash OR NEW.purchaseDate IS NOT OLD.purchaseDate
 OR NEW.operationId IS NOT OLD.operationId OR NEW.funding IS NOT OLD.funding OR NEW.paymentSource IS NOT OLD.paymentSource
 OR NEW.shoppingListId IS NOT OLD.shoppingListId OR NEW.totalCentavos IS NOT OLD.totalCentavos OR NEW.createdAt IS NOT OLD.createdAt
 OR NEW.finalized != 1
 OR (OLD.finalized=0 AND (NOT EXISTS(SELECT 1 FROM PurchaseItem WHERE purchaseId=OLD.id) OR NEW.totalCentavos != (SELECT COALESCE(SUM(lineTotalCentavos),0) FROM PurchaseItem WHERE purchaseId=OLD.id)))
 THEN RAISE(ABORT,'Recorded purchase amounts and context are immutable') END;
END;
CREATE TRIGGER purchase_no_delete BEFORE DELETE ON Purchase BEGIN SELECT RAISE(ABORT,'Purchase history cannot be deleted'); END;
CREATE TRIGGER purchase_item_validate BEFORE INSERT ON PurchaseItem BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM Purchase WHERE id=NEW.purchaseId AND finalized=0)
 OR typeof(NEW.quantityMilli) != 'integer' OR typeof(NEW.priceCentavos) != 'integer' OR typeof(NEW.lineTotalCentavos) != 'integer' OR NEW.quantityMilli <= 0 OR NEW.quantityMilli > 9000000000000000 OR NEW.priceCentavos < 0 OR NEW.priceCentavos > 2147483647 OR NEW.lineTotalCentavos < 0 OR NEW.lineTotalCentavos > 2147483647
 OR NOT EXISTS(SELECT 1 FROM Ingredient WHERE id=NEW.ingredientId AND baseUnit=NEW.unit)
 OR NOT ((NEW.unit='GRAM' AND NEW.priceUnit IN ('GRAM','KILOGRAM')) OR (NEW.unit='MILLILITER' AND NEW.priceUnit IN ('MILLILITER','LITER')) OR (NEW.unit='EACH' AND NEW.priceUnit='EACH'))
 OR (NEW.shoppingItemId IS NOT NULL AND NOT EXISTS(SELECT 1 FROM ShoppingItem si JOIN Purchase p ON p.id=NEW.purchaseId WHERE si.id=NEW.shoppingItemId AND si.listId=p.shoppingListId AND si.ingredientId=NEW.ingredientId))
 THEN RAISE(ABORT,'Invalid actual purchase item') END;
END;
CREATE TRIGGER purchase_item_no_update BEFORE UPDATE ON PurchaseItem BEGIN SELECT RAISE(ABORT,'Actual purchase items are immutable'); END;
CREATE TRIGGER purchase_item_no_delete BEFORE DELETE ON PurchaseItem BEGIN SELECT RAISE(ABORT,'Actual purchase items cannot be deleted'); END;
CREATE TRIGGER reimbursement_validate BEFORE INSERT ON Reimbursement BEGIN
 SELECT CASE WHEN NEW.finalized != 0 OR typeof(NEW.totalCentavos) != 'integer' OR NEW.totalCentavos <= 0 OR NEW.totalCentavos > 2147483647 THEN RAISE(ABORT,'Invalid reimbursement amount') END;
END;
CREATE TRIGGER allocation_validate BEFORE INSERT ON ReimbursementAllocation BEGIN
 SELECT CASE WHEN typeof(NEW.amountCentavos) != 'integer' OR NEW.amountCentavos <= 0 OR NEW.amountCentavos > 2147483647
 OR NOT EXISTS(SELECT 1 FROM Reimbursement WHERE id=NEW.reimbursementId AND finalized=0)
 OR NOT EXISTS(SELECT 1 FROM Purchase WHERE id=NEW.purchaseId AND finalized=1 AND funding='SCHOOL' AND paymentSource='OWNER')
 OR (SELECT paymentDate FROM Reimbursement WHERE id=NEW.reimbursementId) < (SELECT purchaseDate FROM Purchase WHERE id=NEW.purchaseId)
 OR NEW.amountCentavos > (SELECT totalCentavos-COALESCE((SELECT SUM(amountCentavos) FROM ReimbursementAllocation WHERE purchaseId=NEW.purchaseId),0) FROM Purchase WHERE id=NEW.purchaseId)
 OR NEW.amountCentavos + COALESCE((SELECT SUM(amountCentavos) FROM ReimbursementAllocation WHERE reimbursementId=NEW.reimbursementId),0) > (SELECT totalCentavos FROM Reimbursement WHERE id=NEW.reimbursementId)
 THEN RAISE(ABORT,'Reimbursement exceeds eligible outstanding balance') END;
END;
CREATE TRIGGER reimbursement_seal BEFORE UPDATE ON Reimbursement BEGIN
 SELECT CASE WHEN OLD.finalized=1 OR NEW.finalized!=1 OR NEW.id IS NOT OLD.id OR NEW.requestHash IS NOT OLD.requestHash OR NEW.paymentDate IS NOT OLD.paymentDate OR NEW.totalCentavos IS NOT OLD.totalCentavos OR NEW.notes IS NOT OLD.notes OR NEW.createdAt IS NOT OLD.createdAt
 OR NEW.totalCentavos != (SELECT COALESCE(SUM(amountCentavos),0) FROM ReimbursementAllocation WHERE reimbursementId=OLD.id)
 THEN RAISE(ABORT,'Reimbursement must match its allocations and cannot be edited') END;
END;
CREATE TRIGGER reimbursement_no_delete BEFORE DELETE ON Reimbursement BEGIN SELECT RAISE(ABORT,'Reimbursement history cannot be deleted'); END;
CREATE TRIGGER allocation_no_update BEFORE UPDATE ON ReimbursementAllocation BEGIN SELECT RAISE(ABORT,'Reimbursement allocations are immutable'); END;
CREATE TRIGGER allocation_no_delete BEFORE DELETE ON ReimbursementAllocation BEGIN SELECT RAISE(ABORT,'Reimbursement allocations cannot be deleted'); END;
CREATE TRIGGER purchase_operation_type BEFORE UPDATE OF type ON Operation WHEN NEW.type != OLD.type AND EXISTS(SELECT 1 FROM Purchase WHERE operationId=OLD.id) BEGIN SELECT RAISE(ABORT,'Purchase history prevents changing operation type'); END;
CREATE TRIGGER purchase_ingredient_unit BEFORE UPDATE OF baseUnit ON Ingredient WHEN NEW.baseUnit != OLD.baseUnit AND EXISTS(SELECT 1 FROM PurchaseItem WHERE ingredientId=OLD.id) BEGIN SELECT RAISE(ABORT,'Purchase history prevents changing ingredient measurement type'); END;
