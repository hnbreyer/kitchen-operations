import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { seedTransactions } from "./seed-transactions";
if (
  process.env.NODE_ENV === "production" ||
  !process.argv.includes("--development-examples")
)
  throw new Error(
    "Financial examples require an explicit development invocation and are disabled in production.",
  );
const db = new PrismaClient();
try {
  await seedTransactions(db);
  console.log(
    "Financial examples inserted where missing. Existing purchases and reimbursements were preserved.",
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await db.$disconnect();
}
