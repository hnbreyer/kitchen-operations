-- Preserve existing measurement units and manually entered price amounts.
ALTER TABLE "Ingredient" ADD COLUMN "referencePriceUnit" TEXT
  CHECK ("referencePriceUnit" IS NULL OR "referencePriceUnit" IN ('GRAM','KILOGRAM','MILLILITER','LITER','EACH'));
-- Legacy prices were quoted per displayUnit. Only the quote metadata is backfilled.
UPDATE "Ingredient" SET "referencePriceUnit" = "displayUnit" WHERE "referencePriceCentavos" IS NOT NULL;
