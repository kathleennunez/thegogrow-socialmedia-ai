import { Pool, type QueryResultRow } from "pg";

let pool: Pool | null = null;
let schemaEnsured = false;

export function hasDatabase() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) return false;
  return value.startsWith("postgres://") || value.startsWith("postgresql://");
}

export function getPool() {
  if (!hasDatabase()) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false },
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, values: unknown[] = []) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not configured.");
  }

  return db.query<T>(text, values);
}

export async function ensureSchemaOnce() {
  if (!hasDatabase() || schemaEnsured) return;
  const { ensureDatabaseSchema } = await import("@/lib/db/schema");
  await ensureDatabaseSchema();
  schemaEnsured = true;
}
