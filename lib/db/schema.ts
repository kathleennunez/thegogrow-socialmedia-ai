import { readFile } from "node:fs/promises";
import path from "node:path";
import { query } from "@/lib/db";

export async function ensureDatabaseSchema() {
  const schemaPath = path.join(process.cwd(), "docs", "database-schema.sql");
  const sql = await readFile(schemaPath, "utf-8");
  await query(sql);

  await query(`
    alter table if exists social_account_tokens
    add column if not exists scopes text;
  `);

  await query(`
    create table if not exists oauth_state_nonces (
      nonce text primary key,
      expires_at timestamptz not null,
      used_at timestamptz
    );
    create index if not exists idx_oauth_state_nonces_expires on oauth_state_nonces (expires_at);
  `);
}
