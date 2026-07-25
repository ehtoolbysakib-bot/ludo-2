import { defineConfig } from "drizzle-kit";
import path from "path";
import fs from "fs";

const DB_PATH =
  process.env.SQLITE_DB_PATH ?? "./data/ludo.db";

const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "sqlite",
  dbCredentials: {
    url: `file:${DB_PATH}`,
  },
});
