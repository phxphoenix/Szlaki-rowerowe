import { execFileSync } from "node:child_process";
import { isDatabaseConfigured } from "@/db";
import { seedDatabase } from "./seed";

async function bootstrapDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.info(
      "[bootstrap-db] DATABASE_URL not configured — skipping schema push and initial seed.",
    );
    return;
  }

  console.info("[bootstrap-db] Pushing Drizzle schema to Neon Postgres...");
  const npxBin = process.platform === "win32" ? "npx.cmd" : "npx";
  execFileSync(npxBin, ["drizzle-kit", "push", "--force"], {
    stdio: "inherit",
    env: process.env,
  });

  console.info(
    "[bootstrap-db] Upserting reference seed trails with authentic road/GPX geometries...",
  );
  await seedDatabase();
}

bootstrapDatabase().catch((error) => {
  console.error("[bootstrap-db] Failed:", error);
  process.exit(1);
});
