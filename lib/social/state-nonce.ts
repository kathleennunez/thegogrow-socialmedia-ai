import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { ensureSchemaOnce, hasDatabase, query } from "@/lib/db";

const NONCE_FILE_PATH = path.join("/tmp", "oauth-state-nonces.json");

type NonceFileStore = {
  records: Array<{ nonce: string; expiresAt: string; usedAt?: string }>;
};

const nonceTtlMs = 10 * 60 * 1000;

const readNonceFile = async (): Promise<NonceFileStore> => {
  const content = await readFile(NONCE_FILE_PATH, "utf-8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return JSON.stringify({ records: [] });
    }
    throw error;
  });

  const parsed = JSON.parse(content) as Partial<NonceFileStore>;
  return { records: Array.isArray(parsed.records) ? parsed.records : [] };
};

const writeNonceFile = async (store: NonceFileStore) => {
  await writeFile(NONCE_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
};

export function createStateNonce() {
  return randomBytes(24).toString("base64url");
}

export async function storeStateNonce(nonce: string) {
  const expiresAt = new Date(Date.now() + nonceTtlMs).toISOString();
  if (hasDatabase()) {
    await ensureSchemaOnce();
    await query(
      `
      insert into oauth_state_nonces (nonce, expires_at)
      values ($1, $2::timestamptz)
      on conflict (nonce) do update
        set expires_at = excluded.expires_at,
            used_at = null
    `,
      [nonce, expiresAt],
    );
    return;
  }

  const store = await readNonceFile();
  store.records = [
    ...store.records.filter((item) => item.nonce !== nonce && !item.usedAt && new Date(item.expiresAt).getTime() > Date.now()),
    { nonce, expiresAt },
  ];
  await writeNonceFile(store);
}

export async function consumeStateNonce(nonce: string) {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query<{ nonce: string }>(
      `
      update oauth_state_nonces
      set used_at = now()
      where nonce = $1
        and used_at is null
        and expires_at > now()
      returning nonce
    `,
      [nonce],
    );
    return (result.rowCount ?? 0) > 0;
  }

  const store = await readNonceFile();
  const record = store.records.find((item) => item.nonce === nonce);
  if (!record || record.usedAt || new Date(record.expiresAt).getTime() <= Date.now()) {
    return false;
  }

  record.usedAt = new Date().toISOString();
  await writeNonceFile(store);
  return true;
}
