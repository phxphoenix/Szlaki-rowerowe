import { execFileSync } from "node:child_process";
import { count } from "drizzle-orm";
import { getDb, isDatabaseConfigured } from "@/db";
import { trails } from "@/db/schema";
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

  const db = getDb();
  const [row] = await db.select({ total: count() }).from(trails);
  const existingCount = Number(row?.total ?? 0);

  if (existingCount === 0) {
    console.info(
      "[bootstrap-db] Trails table is empty — running initial seed...",
    );
    await seedDatabase();
  } else {
    console.info(
      `[bootstrap-db] Trails table already contains ${existingCount} record(s) — skipping initial seed.`,
    );
  }
}

bootstrapDatabase().catch((error) => {
  console.error("[bootstrap-db] Failed:", error);
  process.exit(1);
});
