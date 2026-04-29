import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { ensureSchemaOnce, hasDatabase, query } from "@/lib/db";
import { getConnectedAccountForPlatform } from "@/lib/social/store";
import type { SocialPlatform } from "@/lib/social/types";

type PublishJobStatus = "queued" | "processing" | "published" | "failed" | "cancelled";

export type PublishJob = {
  id: string;
  userId: string;
  postId: string;
  platform: SocialPlatform;
  socialAccountId: string;
  scheduledForUtc: string;
  timezone: string;
  status: PublishJobStatus;
  retryCount: number;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
};

type SchedulesStore = {
  jobs: PublishJob[];
};

const SCHEDULES_FILE_PATH = path.join(process.cwd(), "data", "schedules.json");
const workspaceIdForUser = (userId: string) => `ws_${userId}`;

const readStore = async (): Promise<SchedulesStore> => {
  const content = await readFile(SCHEDULES_FILE_PATH, "utf-8").catch((error: unknown) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "{\n  \"jobs\": []\n}";
    throw error;
  });
  const parsed = JSON.parse(content) as Partial<SchedulesStore>;
  return { jobs: Array.isArray(parsed.jobs) ? parsed.jobs : [] };
};

const writeStore = async (store: SchedulesStore) => {
  await writeFile(SCHEDULES_FILE_PATH, JSON.stringify(store, null, 2), "utf-8");
};

export async function listPublishJobs(userId: string) {
  if (hasDatabase()) {
    await ensureSchemaOnce();
    const result = await query<{
      id: string;
      post_id: string;
      platform: SocialPlatform;
      social_account_id: string;
      scheduled_for_utc: string;
      timezone: string;
      status: PublishJobStatus;
      retry_count: number;
      last_error: string | null;
      created_at: string;
      updated_at: string;
    }>(
      `
      select j.id, j.post_id, j.platform, j.social_account_id, j.scheduled_for_utc, j.timezone, j.status, j.retry_count, j.last_error, j.created_at, j.updated_at
      from publish_jobs j
      where j.workspace_id = $1
      order by j.scheduled_for_utc asc
    `,
      [workspaceIdForUser(userId)],
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId,
      postId: row.post_id,
      platform: row.platform,
      socialAccountId: row.social_account_id,
      scheduledForUtc: row.scheduled_for_utc,
      timezone: row.timezone,
      status: row.status,
      retryCount: row.retry_count,
      lastError: row.last_error ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  const store = await readStore();
  return store.jobs.filter((job) => job.userId === userId);
}

export async function createPublishJobs(input: {
  userId: string;
  postId: string;
  platforms: SocialPlatform[];
  scheduledForUtc: string;
  timezone: string;
}) {
  const now = new Date().toISOString();
  const jobs: PublishJob[] = [];

  for (const platform of input.platforms) {
    const account = await getConnectedAccountForPlatform(input.userId, platform);
    if (!account) throw new Error(`No connected ${platform} account found for this user.`);
    jobs.push({
      id: randomUUID(),
      userId: input.userId,
      postId: input.postId,
      platform,
      socialAccountId: account.id,
      scheduledForUtc: input.scheduledForUtc,
      timezone: input.timezone,
      status: "queued",
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (hasDatabase()) {
    await ensureSchemaOnce();
    for (const job of jobs) {
      await query(
        `
        insert into publish_jobs (
          id, workspace_id, post_id, social_account_id, platform, scheduled_for_utc, timezone, status, retry_count, created_at, updated_at
        )
        values ($1,$2,$3,$4,$5,$6::timestamptz,$7,$8,$9,$10::timestamptz,$11::timestamptz)
      `,
        [
          job.id,
          workspaceIdForUser(job.userId),
          job.postId,
          job.socialAccountId,
          job.platform,
          job.scheduledForUtc,
          job.timezone,
          job.status,
          job.retryCount,
          job.createdAt,
          job.updatedAt,
        ],
      );
    }
    return jobs;
  }

  const store = await readStore();
  store.jobs.push(...jobs);
  await writeStore(store);
  return jobs;
}

export async function claimDueJobs(limit = 20) {
  if (!hasDatabase()) {
    const store = await readStore();
    const now = Date.now();
    const due = store.jobs
      .filter((job) => job.status === "queued" && new Date(job.scheduledForUtc).getTime() <= now)
      .slice(0, limit);
    for (const job of due) {
      job.status = "processing";
      job.updatedAt = new Date().toISOString();
    }
    await writeStore(store);
    return due.map((job) => ({
      id: job.id,
      workspace_id: workspaceIdForUser(job.userId),
      user_id: job.userId,
      post_id: job.postId,
      social_account_id: job.socialAccountId,
      platform: job.platform,
      timezone: job.timezone,
      retry_count: job.retryCount,
    }));
  }
  await ensureSchemaOnce();
  const result = await query<{
    id: string;
    workspace_id: string;
    user_id: string;
    post_id: string;
    social_account_id: string;
    platform: SocialPlatform;
    timezone: string;
    retry_count: number;
  }>(
    `
    with due as (
      select id
      from publish_jobs
      where status = 'queued'
        and scheduled_for_utc <= now()
      order by scheduled_for_utc asc
      limit $1
      for update skip locked
    )
    update publish_jobs p
    set status = 'processing', updated_at = now()
    from due
    where p.id = due.id
    returning p.id, p.workspace_id, p.post_id, p.social_account_id, p.platform, p.timezone, p.retry_count,
      (select a.user_id from social_accounts a where a.id = p.social_account_id limit 1) as user_id
  `,
    [limit],
  );
  return result.rows;
}

export async function markPublishJobPublished(input: {
  jobId: string;
  providerPostId: string;
  permalink?: string;
}) {
  if (!hasDatabase()) {
    const store = await readStore();
    const row = store.jobs.find((job) => job.id === input.jobId);
    if (row) {
      row.status = "published";
      row.updatedAt = new Date().toISOString();
      row.lastError = undefined;
    }
    await writeStore(store);
    return;
  }
  await ensureSchemaOnce();
  await query(
    `
    update publish_jobs
    set status = 'published', updated_at = now(), last_error = null
    where id = $1
  `,
    [input.jobId],
  );
  await query(
    `
    insert into published_posts (id, publish_job_id, provider_post_id, permalink, published_at)
    values ($1, $2, $3, $4, now())
    on conflict (id) do nothing
  `,
    [randomUUID(), input.jobId, input.providerPostId, input.permalink ?? null],
  );
}

export async function markPublishJobFailed(input: { jobId: string; error: string; retryCount: number; maxRetries: number }) {
  if (!hasDatabase()) {
    const store = await readStore();
    const row = store.jobs.find((job) => job.id === input.jobId);
    if (!row) return;
    const shouldRetry = input.retryCount < input.maxRetries;
    if (shouldRetry) {
      const backoffSeconds = Math.min(3600, 2 ** input.retryCount * 60);
      row.status = "queued";
      row.retryCount += 1;
      row.lastError = input.error;
      row.scheduledForUtc = new Date(Date.now() + backoffSeconds * 1000).toISOString();
      row.updatedAt = new Date().toISOString();
    } else {
      row.status = "failed";
      row.lastError = input.error;
      row.updatedAt = new Date().toISOString();
    }
    await writeStore(store);
    return;
  }
  await ensureSchemaOnce();
  const shouldRetry = input.retryCount < input.maxRetries;
  if (shouldRetry) {
    const backoffSeconds = Math.min(3600, 2 ** input.retryCount * 60);
    await query(
      `
      update publish_jobs
      set status = 'queued',
          retry_count = retry_count + 1,
          last_error = $2,
          scheduled_for_utc = now() + ($3 || ' seconds')::interval,
          updated_at = now()
      where id = $1
    `,
      [input.jobId, input.error, String(backoffSeconds)],
    );
    return;
  }

  await query(
    `
    update publish_jobs
    set status = 'failed', last_error = $2, updated_at = now()
    where id = $1
  `,
    [input.jobId, input.error],
  );
}

export async function listPublishedPostsForPlatform(platform: SocialPlatform) {
  if (!hasDatabase()) return [];
  await ensureSchemaOnce();
  const result = await query<{
    publish_job_id: string;
    provider_post_id: string;
    post_id: string;
    user_id: string;
    social_account_id: string;
  }>(
    `
    select pp.publish_job_id, pp.provider_post_id, j.post_id, a.user_id, j.social_account_id
    from published_posts pp
    join publish_jobs j on j.id = pp.publish_job_id
    join social_accounts a on a.id = j.social_account_id
    where j.platform = $1
  `,
    [platform],
  );
  return result.rows;
}
