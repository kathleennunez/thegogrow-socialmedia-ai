import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureSchemaOnce, hasDatabase, query } from "@/lib/db";
import { decryptSecret, encryptSecret } from "@/lib/social/security";
import type { SocialAccount, SocialPlatform, SocialTokenRecord } from "@/lib/social/types";

type SocialStore = {
  accounts: SocialAccount[];
  tokens: SocialTokenRecord[];
};

const SOCIAL_STORE_FILE_PATH = path.join(process.cwd(), "data", "social-accounts.json");

const emptyStore: SocialStore = {
  accounts: [],
  tokens: [],
};

const readStore = async (): Promise<SocialStore> => {
  const content = await readFile(SOCIAL_STORE_FILE_PATH, "utf-8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return JSON.stringify(emptyStore);
    throw error;
  });

  const parsed = JSON.parse(content) as Partial<SocialStore>;
  return {
    accounts: Array.isArray(parsed.accounts) ? parsed.accounts : [],
    tokens: Array.isArray(parsed.tokens) ? parsed.tokens : [],
  };
};

const writeStore = async (store: SocialStore) => {
  await writeFile(SOCIAL_STORE_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
};

const workspaceIdForUser = (userId: string) => `ws_${userId}`;

async function ensureWorkspaceForUser(userId: string) {
  if (!hasDatabase()) return;
  await ensureSchemaOnce();
  const workspaceId = workspaceIdForUser(userId);
  await query(
    `
    insert into workspaces (id, name)
    values ($1, $2)
    on conflict (id) do nothing
  `,
    [workspaceId, `Workspace ${userId}`],
  );
  await query(
    `
    insert into workspace_members (workspace_id, user_id, role)
    values ($1, $2, 'owner')
    on conflict (workspace_id, user_id) do nothing
  `,
    [workspaceId, userId],
  );
}

export async function listSocialAccounts(userId: string): Promise<SocialAccount[]> {
  if (hasDatabase()) {
    await ensureWorkspaceForUser(userId);
    const workspaceId = workspaceIdForUser(userId);
    const result = await query<{
      id: string;
      user_id: string;
      platform: SocialPlatform;
      provider_account_id: string;
      handle: string;
      display_name: string;
      scopes: string[];
      status: SocialAccount["status"];
      connected_at: string;
      updated_at: string;
    }>(
      `
      select id, user_id, platform, provider_account_id, handle, display_name, scopes, status, connected_at, updated_at
      from social_accounts
      where workspace_id = $1 and user_id = $2
      order by connected_at desc
    `,
      [workspaceId, userId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      providerAccountId: row.provider_account_id,
      handle: row.handle,
      displayName: row.display_name,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      status: row.status,
      connectedAt: row.connected_at,
      updatedAt: row.updated_at,
    }));
  }

  const store = await readStore();
  return store.accounts.filter((account) => account.userId === userId);
}

export async function connectSocialAccount(input: {
  userId: string;
  platform: SocialPlatform;
  providerAccountId: string;
  handle: string;
  displayName: string;
  scopes: string[];
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
}) {
  const now = new Date().toISOString();

  if (hasDatabase()) {
    await ensureWorkspaceForUser(input.userId);
    const workspaceId = workspaceIdForUser(input.userId);
    const existing = await query<{ id: string; connected_at: string }>(
      `
      select id, connected_at
      from social_accounts
      where workspace_id = $1 and user_id = $2 and platform = $3 and provider_account_id = $4
      limit 1
    `,
      [workspaceId, input.userId, input.platform, input.providerAccountId],
    );

    const accountId = existing.rows[0]?.id ?? randomUUID();
    const connectedAt = existing.rows[0]?.connected_at ?? now;

    await query(
      `
      insert into social_accounts (
        id, workspace_id, user_id, platform, provider_account_id, handle, display_name, scopes, status, connected_at, updated_at
      )
      values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,'connected',$9::timestamptz,$10::timestamptz)
      on conflict (id) do update set
        handle = excluded.handle,
        display_name = excluded.display_name,
        scopes = excluded.scopes,
        status = 'connected',
        updated_at = excluded.updated_at
    `,
      [accountId, workspaceId, input.userId, input.platform, input.providerAccountId, input.handle, input.displayName, JSON.stringify(input.scopes), connectedAt, now],
    );

    await query(
      `
      insert into social_account_tokens (
        account_id, encrypted_access_token, encrypted_refresh_token, expires_at, updated_at, scopes
      )
      values ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6)
      on conflict (account_id) do update set
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at,
        scopes = excluded.scopes
    `,
      [
        accountId,
        encryptSecret(input.accessToken),
        input.refreshToken ? encryptSecret(input.refreshToken) : null,
        input.expiresAt ?? null,
        now,
        input.scopes.join(" "),
      ],
    );

    return {
      id: accountId,
      userId: input.userId,
      platform: input.platform,
      providerAccountId: input.providerAccountId,
      handle: input.handle,
      displayName: input.displayName,
      scopes: input.scopes,
      status: "connected" as const,
      connectedAt,
      updatedAt: now,
    };
  }

  const store = await readStore();
  const existing = store.accounts.find(
    (account) =>
      account.userId === input.userId &&
      account.platform === input.platform &&
      account.providerAccountId === input.providerAccountId,
  );
  const accountId = existing?.id ?? randomUUID();

  const account: SocialAccount = {
    id: accountId,
    userId: input.userId,
    platform: input.platform,
    providerAccountId: input.providerAccountId,
    handle: input.handle,
    displayName: input.displayName,
    scopes: input.scopes,
    status: "connected",
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
  };

  const tokenRecord: SocialTokenRecord = {
    accountId,
    encryptedAccessToken: encryptSecret(input.accessToken),
    encryptedRefreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : undefined,
    expiresAt: input.expiresAt,
    updatedAt: now,
  };

  store.accounts = [...store.accounts.filter((item) => item.id !== accountId), account];
  store.tokens = [...store.tokens.filter((item) => item.accountId !== accountId), tokenRecord];
  await writeStore(store);
  return account;
}

export async function disconnectSocialAccount(userId: string, accountId: string): Promise<boolean> {
  const now = new Date().toISOString();
  if (hasDatabase()) {
    await ensureWorkspaceForUser(userId);
    const workspaceId = workspaceIdForUser(userId);
    const result = await query(
      `
      update social_accounts
      set status = 'disconnected', updated_at = $1::timestamptz
      where id = $2 and user_id = $3 and workspace_id = $4
    `,
      [now, accountId, userId, workspaceId],
    );
    return result.rowCount > 0;
  }

  const store = await readStore();
  const existing = store.accounts.find((account) => account.id === accountId && account.userId === userId);
  if (!existing) return false;
  store.accounts = store.accounts.map((account) =>
    account.id === accountId ? { ...account, status: "disconnected", updatedAt: now } : account,
  );
  await writeStore(store);
  return true;
}

export async function getConnectedAccountForPlatform(userId: string, platform: SocialPlatform) {
  const accounts = await listSocialAccounts(userId);
  return accounts.find((account) => account.platform === platform && account.status === "connected") ?? null;
}

export async function getSocialAccountById(accountId: string) {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query<{
      id: string;
      user_id: string;
      platform: SocialPlatform;
      provider_account_id: string;
      handle: string;
      display_name: string;
      scopes: string[];
      status: SocialAccount["status"];
      connected_at: string;
      updated_at: string;
    }>(
      `
      select id, user_id, platform, provider_account_id, handle, display_name, scopes, status, connected_at, updated_at
      from social_accounts
      where id = $1
      limit 1
    `,
      [accountId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      platform: row.platform,
      providerAccountId: row.provider_account_id,
      handle: row.handle,
      displayName: row.display_name,
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      status: row.status,
      connectedAt: row.connected_at,
      updatedAt: row.updated_at,
    };
  }

  const store = await readStore();
  return store.accounts.find((item) => item.id === accountId) ?? null;
}

export async function getSocialTokenByAccountId(accountId: string) {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query<{
      account_id: string;
      encrypted_access_token: string;
      encrypted_refresh_token: string | null;
      expires_at: string | null;
      scopes: string | null;
    }>(
      `
      select account_id, encrypted_access_token, encrypted_refresh_token, expires_at, scopes
      from social_account_tokens
      where account_id = $1
      limit 1
    `,
      [accountId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      accountId: row.account_id,
      accessToken: decryptSecret(row.encrypted_access_token),
      refreshToken: row.encrypted_refresh_token ? decryptSecret(row.encrypted_refresh_token) : undefined,
      expiresAt: row.expires_at ?? undefined,
      scopes: row.scopes?.split(/\s+/).filter(Boolean) ?? [],
    };
  }

  const store = await readStore();
  const row = store.tokens.find((item) => item.accountId === accountId);
  if (!row) return null;
  return {
    accountId: row.accountId,
    accessToken: decryptSecret(row.encryptedAccessToken),
    refreshToken: row.encryptedRefreshToken ? decryptSecret(row.encryptedRefreshToken) : undefined,
    expiresAt: row.expiresAt,
    scopes: [],
  };
}

export async function updateSocialToken(input: {
  accountId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: string;
  scopes?: string[];
}) {
  const now = new Date().toISOString();
  if (hasDatabase()) {
    await ensureSchemaOnce();
    await query(
      `
      insert into social_account_tokens (
        account_id, encrypted_access_token, encrypted_refresh_token, expires_at, updated_at, scopes
      )
      values ($1,$2,$3,$4::timestamptz,$5::timestamptz,$6)
      on conflict (account_id) do update set
        encrypted_access_token = excluded.encrypted_access_token,
        encrypted_refresh_token = excluded.encrypted_refresh_token,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at,
        scopes = excluded.scopes
    `,
      [
        input.accountId,
        encryptSecret(input.accessToken),
        input.refreshToken ? encryptSecret(input.refreshToken) : null,
        input.expiresAt ?? null,
        now,
        input.scopes?.join(" ") ?? null,
      ],
    );
    return;
  }

  const store = await readStore();
  const record: SocialTokenRecord = {
    accountId: input.accountId,
    encryptedAccessToken: encryptSecret(input.accessToken),
    encryptedRefreshToken: input.refreshToken ? encryptSecret(input.refreshToken) : undefined,
    expiresAt: input.expiresAt,
    updatedAt: now,
  };
  store.tokens = [...store.tokens.filter((item) => item.accountId !== input.accountId), record];
  await writeStore(store);
}

export async function listExpiringTokens(platform: SocialPlatform, leadSeconds = 300) {
  if (!hasDatabase()) return [];
  await ensureSchemaOnce();
  const result = await query<{
    account_id: string;
    user_id: string;
    refresh_token: string | null;
    expires_at: string | null;
  }>(
    `
    select t.account_id, a.user_id, t.encrypted_refresh_token as refresh_token, t.expires_at
    from social_account_tokens t
    join social_accounts a on a.id = t.account_id
    where a.platform = $1
      and a.status = 'connected'
      and t.expires_at is not null
      and t.expires_at <= now() + ($2 || ' seconds')::interval
  `,
    [platform, String(leadSeconds)],
  );
  return result.rows
    .filter((row) => row.refresh_token)
    .map((row) => ({
      accountId: row.account_id,
      userId: row.user_id,
      refreshToken: decryptSecret(row.refresh_token as string),
      expiresAt: row.expires_at ?? undefined,
    }));
}
