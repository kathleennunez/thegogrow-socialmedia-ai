import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureSchemaOnce, hasDatabase, query } from "@/lib/db";
import type { SocialPlatform } from "@/lib/social/types";

export type AnalyticsSnapshot = {
  id: string;
  userId: string;
  postId: string;
  platform: SocialPlatform;
  snapshotDate: string;
  impressions: number;
  engagement: number;
  clicks: number;
  likes: number;
  comments: number;
  shares: number;
  raw?: Record<string, unknown>;
  createdAt: string;
};

type AnalyticsStore = {
  snapshots: AnalyticsSnapshot[];
};

const ANALYTICS_STORE_FILE_PATH = path.join(process.cwd(), "data", "analytics-events.json");
const workspaceIdForUser = (userId: string) => `ws_${userId}`;

const readStore = async (): Promise<AnalyticsStore> => {
  const content = await readFile(ANALYTICS_STORE_FILE_PATH, "utf-8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "{\n  \"snapshots\": []\n}";
    throw error;
  });
  const parsed = JSON.parse(content) as Partial<AnalyticsStore>;
  return { snapshots: Array.isArray(parsed.snapshots) ? parsed.snapshots : [] };
};

const writeStore = async (store: AnalyticsStore) => {
  await writeFile(ANALYTICS_STORE_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
};

export async function ingestSnapshot(
  input: Omit<AnalyticsSnapshot, "id" | "createdAt">,
): Promise<AnalyticsSnapshot> {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const workspaceId = workspaceIdForUser(input.userId);
    const existing = await query<{ id: string }>(
      `
      select id
      from analytics_snapshots
      where workspace_id = $1 and post_id = $2 and platform = $3 and snapshot_date = $4::date
      limit 1
    `,
      [workspaceId, input.postId, input.platform, input.snapshotDate],
    );

    const id = existing.rows[0]?.id ?? randomUUID();
    if (existing.rows[0]) {
      await query(
        `
        update analytics_snapshots
        set impressions = $2, engagement = $3, clicks = $4, likes = $5, comments = $6, shares = $7, raw_payload = $8::jsonb
        where id = $1
      `,
        [id, input.impressions, input.engagement, input.clicks, input.likes, input.comments, input.shares, JSON.stringify(input.raw ?? {})],
      );
    } else {
      await query(
        `
        insert into analytics_snapshots (
          id, workspace_id, post_id, platform, snapshot_date, impressions, engagement, clicks, likes, comments, shares, raw_payload, created_at
        )
        values ($1,$2,$3,$4,$5::date,$6,$7,$8,$9,$10,$11,$12::jsonb,now())
      `,
        [
          id,
          workspaceId,
          input.postId,
          input.platform,
          input.snapshotDate,
          input.impressions,
          input.engagement,
          input.clicks,
          input.likes,
          input.comments,
          input.shares,
          JSON.stringify(input.raw ?? {}),
        ],
      );
    }

    return {
      id,
      ...input,
      createdAt: new Date().toISOString(),
    };
  }

  const store = await readStore();
  const existingIndex = store.snapshots.findIndex(
    (snapshot) =>
      snapshot.userId === input.userId &&
      snapshot.postId === input.postId &&
      snapshot.platform === input.platform &&
      snapshot.snapshotDate === input.snapshotDate,
  );

  const snapshot: AnalyticsSnapshot = {
    ...input,
    id: existingIndex >= 0 ? store.snapshots[existingIndex].id : `metric_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) store.snapshots[existingIndex] = snapshot;
  else store.snapshots.push(snapshot);
  await writeStore(store);
  return snapshot;
}

export async function listSnapshots(userId: string): Promise<AnalyticsSnapshot[]> {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query<{
      id: string;
      post_id: string;
      platform: SocialPlatform;
      snapshot_date: string;
      impressions: number;
      engagement: number;
      clicks: number;
      likes: number;
      comments: number;
      shares: number;
      raw_payload: Record<string, unknown> | null;
      created_at: string;
    }>(
      `
      select id, post_id, platform, snapshot_date, impressions, engagement, clicks, likes, comments, shares, raw_payload, created_at
      from analytics_snapshots
      where workspace_id = $1
      order by snapshot_date desc, created_at desc
    `,
      [workspaceIdForUser(userId)],
    );
    return result.rows.map((row) => ({
      id: row.id,
      userId,
      postId: row.post_id,
      platform: row.platform,
      snapshotDate: row.snapshot_date,
      impressions: row.impressions,
      engagement: row.engagement,
      clicks: row.clicks,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      raw: row.raw_payload ?? undefined,
      createdAt: row.created_at,
    }));
  }

  const store = await readStore();
  return store.snapshots.filter((snapshot) => snapshot.userId === userId);
}

export async function summarizeAnalytics(userId: string) {
  const snapshots = await listSnapshots(userId);
  const totals = snapshots.reduce(
    (acc, snapshot) => {
      acc.impressions += snapshot.impressions;
      acc.engagement += snapshot.engagement;
      acc.clicks += snapshot.clicks;
      acc.likes += snapshot.likes;
      acc.comments += snapshot.comments;
      acc.shares += snapshot.shares;
      return acc;
    },
    { impressions: 0, engagement: 0, clicks: 0, likes: 0, comments: 0, shares: 0 },
  );
  return { totals, count: snapshots.length, snapshots };
}
