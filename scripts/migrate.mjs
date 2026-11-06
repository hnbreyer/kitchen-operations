import "dotenv/config";
import { openSync, closeSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
const url = process.env.DATABASE_URL;
if (!url?.startsWith("file:"))
  throw new Error("DATABASE_URL must be a local SQLite file URL.");
// Ensure a new local database file exists before invoking the Prisma 6 engine.
closeSync(openSync(resolve("prisma", url.slice(5)), "a"));
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});
process.exit(result.status ?? 1);
