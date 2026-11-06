-- Additive migration: preserve existing operations and their diner counts.
-- Staff diners are a subset of expectedDiners; buffer meals are additional.
ALTER TABLE "Operation" ADD COLUMN "expectedStaffDiners" INTEGER
  CHECK ("expectedStaffDiners" IS NULL OR ("type" = 'RETREAT' AND "expectedStaffDiners" >= 0 AND ("expectedDiners" IS NULL OR "expectedStaffDiners" <= "expectedDiners")));
ALTER TABLE "Operation" ADD COLUMN "additionalMealBuffer" INTEGER
  CHECK ("additionalMealBuffer" IS NULL OR ("type" = 'RETREAT' AND "additionalMealBuffer" >= 0));
ALTER TABLE "Operation" ADD COLUMN "staffDiscountPercent" INTEGER
  CHECK (("type" = 'RETREAT' AND "staffDiscountPercent" = 60) OR ("type" != 'RETREAT' AND "staffDiscountPercent" IS NULL));
UPDATE "Operation" SET "staffDiscountPercent" = 60 WHERE "type" = 'RETREAT';
-- SQLite CHECK treats NULL as success. Triggers require an explicit retreat discount
-- on future writes while permitting the additive backfill above.
CREATE TRIGGER "Operation_staff_discount_insert" BEFORE INSERT ON "Operation"
WHEN (NEW."type" = 'RETREAT' AND (NEW."staffDiscountPercent" IS NULL OR NEW."staffDiscountPercent" != 60))
  OR (NEW."type" != 'RETREAT' AND NEW."staffDiscountPercent" IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Retreat staff discount must be 60 percent; other operations have no staff discount.'); END;
CREATE TRIGGER "Operation_staff_discount_update" BEFORE UPDATE ON "Operation"
WHEN (NEW."type" = 'RETREAT' AND (NEW."staffDiscountPercent" IS NULL OR NEW."staffDiscountPercent" != 60))
  OR (NEW."type" != 'RETREAT' AND NEW."staffDiscountPercent" IS NOT NULL)
BEGIN SELECT RAISE(ABORT, 'Retreat staff discount must be 60 percent; other operations have no staff discount.'); END;
