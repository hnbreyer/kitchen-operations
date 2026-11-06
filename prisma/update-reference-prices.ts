import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { fillUnsetReferencePrices } from "./reference-prices";
const db = new PrismaClient();
try {
  const updated = await db.$transaction((tx) => fillUnsetReferencePrices(tx));
  const missing = await db.ingredient.findMany({
    where: { referencePriceCentavos: null },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  console.log(
    `Updated ${updated} unset reference prices. Existing prices and shopping lists were preserved.`,
  );
  console.log(
    `Ingredients without reference prices: ${missing.map((i) => i.name).join(", ") || "none"}.`,
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
