import { rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
// Both integration and browser tests use a dedicated database, never the development file.
const env = {
  ...process.env,
  DATABASE_URL: `file:${fileURLToPath(new URL("../prisma/test.db", import.meta.url))}`,
  BUSINESS_TIMEZONE: "America/Sao_Paulo",
};
for (const suffix of ["", "-journal", "-wal", "-shm"])
  rmSync(
    fileURLToPath(new URL("../prisma/test.db", import.meta.url)) + suffix,
    { force: true },
  );
const commands = process.argv.includes("--prepare-only")
  ? [
      ["tsx", "scripts/migrate.mjs"],
      ["tsx", "prisma/seed.ts"],
    ]
  : [
      ["tsx", "scripts/migrate.mjs"],
      ["tsx", "prisma/seed.ts"],
      ["vitest", "run"],
    ];
for (const args of commands) {
  const result = spawnSync("npx", args, { env, stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
