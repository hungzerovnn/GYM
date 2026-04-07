#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@neondatabase/serverless";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname);
const devVarsPath = path.resolve(root, "../api-worker/.dev.vars");

const readEnvFile = (filePath) => {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim();
      acc[key] = value;
      return acc;
    }, {});
};

const localDevVars = readEnvFile(devVarsPath);
const dbUrl = process.env.NEON_DATABASE_URL || localDevVars.NEON_DATABASE_URL;

if (!dbUrl) {
  console.error("Thieu NEON_DATABASE_URL trong environment.");
  console.error(
    "Hay dat bien tai terminal hoac them NEON_DATABASE_URL vao publish/api-worker/.dev.vars.",
  );
  process.exit(1);
}

const migrationFiles = fs
  .readdirSync(path.join(root, "migrations"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(root, "migrations", entry.name, "migration.sql"))
  .filter((file) => fs.existsSync(file))
  .sort();

const runFile = async (client, file) => {
  if (!fs.existsSync(file)) {
    console.log(`[SKIP] Khong ton tai: ${file}`);
    return;
  }

  console.log(`[RUN] ${file}`);
  const sql = fs.readFileSync(file, "utf8");
  if (!sql.trim()) {
    console.log(`[SKIP] File rong: ${file}`);
    return;
  }

  await client.query(sql);
};

try {
  const client = new Client({ connectionString: dbUrl });
  await client.connect();

  const existingBranchTable = await client.query(
    "SELECT to_regclass('public.branches') AS table_name",
  );
  const hasSchema = Boolean(existingBranchTable.rows[0]?.table_name);

  const files = hasSchema
    ? [path.join(root, "seed.sql")]
    : [path.join(root, "schema.sql"), ...migrationFiles, path.join(root, "seed.sql")];

  if (hasSchema) {
    console.log("[INFO] DB da co schema, bo qua schema.sql va migrations, chi chay seed.sql");
  }

  for (const file of files) {
    await runFile(client, file);
  }

  await client.end();
  console.log("[OK] Import Neon hoan tat.");
} catch (error) {
  console.error("[ERROR] Loi khi import Neon:", error.message);
  process.exit(1);
}
