import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.SQLITE_DB_PATH ?? "./data/ludo.db";

// Ensure directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const client = createClient({ url: `file:${DB_PATH}` });

export const db = drizzle(client, { schema });

// Auto-migrate: add new columns if they don't exist yet
async function runMigrations() {
  try {
    // Add team_mode column if missing
    await client.execute(
      `ALTER TABLE rooms ADD COLUMN team_mode INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    // Column already exists — ignore
  }
  try {
    // Add bet_amount column if missing
    await client.execute(
      `ALTER TABLE rooms ADD COLUMN bet_amount INTEGER NOT NULL DEFAULT 0`
    );
  } catch {
    // Column already exists — ignore
  }
}

runMigrations().catch((err) => {
  console.error("Migration error:", err);
});

export * from "./schema";
