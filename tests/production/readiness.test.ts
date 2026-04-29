import test from "node:test";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createOAuthState } from "@/lib/social/oauth";
import { storeStateNonce } from "@/lib/social/state-nonce";
import { GET as socialCallback } from "@/app/api/social/callback/route";
import { POST as refreshRoute } from "@/app/api/social/refresh/route";
import { POST as publishWorkerRoute } from "@/app/api/worker/publish/route";
import { POST as analyticsPullRoute } from "@/app/api/analytics/linkedin/pull/route";
import { connectSocialAccount } from "@/lib/social/store";
import { createPublishJobs, listPublishJobs } from "@/lib/scheduling/store";
import { savePost } from "@/lib/store";
import { runPublishWorker } from "@/lib/scheduling/worker";
import { ingestSnapshot, listSnapshots } from "@/lib/analytics/store";

const socialPath = path.join(process.cwd(), "data", "social-accounts.json");
const schedulesPath = path.join(process.cwd(), "data", "schedules.json");
const postsPath = path.join(process.cwd(), "data", "posts.json");
const analyticsPath = path.join(process.cwd(), "data", "analytics-events.json");
const noncePath = path.join(process.cwd(), "data", "oauth-state-nonces.json");

const resetFiles = async () => {
  await writeFile(socialPath, JSON.stringify({ accounts: [], tokens: [] }, null, 2));
  await writeFile(schedulesPath, JSON.stringify({ jobs: [] }, null, 2));
  await writeFile(postsPath, JSON.stringify([], null, 2));
  await writeFile(analyticsPath, JSON.stringify({ snapshots: [] }, null, 2));
  await writeFile(noncePath, JSON.stringify({ records: [] }, null, 2));
};

test.beforeEach(async () => {
  delete process.env.DATABASE_URL;
  process.env.NODE_ENV = "test";
  process.env.SOCIAL_OAUTH_STATE_SECRET = "test_oauth_secret";
  process.env.SOCIAL_TOKEN_ENCRYPTION_KEY = "test_token_secret";
  process.env.LINKEDIN_CLIENT_ID = "li-client";
  process.env.LINKEDIN_CLIENT_SECRET = "li-secret";
  delete process.env.CRON_SECRET;
  await resetFiles();
});

test("OAuth callback succeeds once and rejects replay nonce", async () => {
  const nonce = "nonce_success_once";
  await storeStateNonce(nonce);
  const state = createOAuthState({ userId: "user_oauth", platform: "linkedin" });

  const originalFetch = global.fetch;
  global.fetch = (async (url: string | URL) => {
    const asString = String(url);
    if (asString.includes("/oauth/v2/accessToken")) {
      return Response.json({ access_token: "token_a", expires_in: 3600, refresh_token: "refresh_a", scope: "openid profile w_member_social" });
    }
    if (asString.includes("/v2/me")) {
      return Response.json({ id: "abc123", localizedFirstName: "Test", localizedLastName: "User" });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const first = await socialCallback(new Request(`http://localhost/api/social/callback?code=ok&state=${state}&nonce=${nonce}`));
    assert.equal(first.status, 200);

    const second = await socialCallback(new Request(`http://localhost/api/social/callback?code=ok&state=${state}&nonce=${nonce}`));
    assert.equal(second.status, 400);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Token refresh route updates access token", async () => {
  const account = await connectSocialAccount({
    userId: "user_refresh",
    platform: "linkedin",
    providerAccountId: "li_123",
    handle: "li_123",
    displayName: "LinkedIn User",
    scopes: ["openid"],
    accessToken: "old_access",
    refreshToken: "old_refresh",
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
  });

  const originalFetch = global.fetch;
  global.fetch = (async () => Response.json({ access_token: "new_access", expires_in: 3600, refresh_token: "new_refresh", scope: "openid profile" })) as typeof fetch;
  try {
    const response = await refreshRoute(
      new Request("http://localhost/api/social/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: account.id, refreshToken: "old_refresh" }),
      }),
    );
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.refreshed, 1);
  } finally {
    global.fetch = originalFetch;
  }
});

test("Job lifecycle transitions queued -> published", async () => {
  const userId = "user_jobs";
  const postId = "post_jobs_1";
  await savePost({
    id: postId,
    userId,
    topic: "Topic",
    text: "Post body for linkedin",
    imageIdea: "",
    platforms: ["LinkedIn"],
    savedAt: new Date().toISOString(),
  });

  await connectSocialAccount({
    userId,
    platform: "linkedin",
    providerAccountId: "999",
    handle: "li_999",
    displayName: "LinkedIn User",
    scopes: ["w_member_social"],
    accessToken: "access_job",
    refreshToken: "refresh_job",
  });

  await createPublishJobs({
    userId,
    postId,
    platforms: ["linkedin"],
    scheduledForUtc: new Date(Date.now() - 60_000).toISOString(),
    timezone: "UTC",
  });

  const originalFetch = global.fetch;
  global.fetch = (async (url: string | URL) => {
    if (String(url).includes("/rest/posts")) {
      return Response.json({ id: "urn:li:share:12345" });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  try {
    const result = await runPublishWorker(10);
    assert.equal(result.published, 1);
    const jobs = await listPublishJobs(userId);
    assert.equal(jobs[0]?.status, "published");
  } finally {
    global.fetch = originalFetch;
  }
});

test("Analytics ingestion is idempotent per post/platform/date", async () => {
  const userId = "user_analytics";
  const postId = "post_analytics_1";
  const snapshotDate = "2026-04-29";

  await ingestSnapshot({
    userId,
    postId,
    platform: "linkedin",
    snapshotDate,
    impressions: 10,
    engagement: 5,
    clicks: 1,
    likes: 3,
    comments: 1,
    shares: 1,
    raw: { source: "first" },
  });

  await ingestSnapshot({
    userId,
    postId,
    platform: "linkedin",
    snapshotDate,
    impressions: 20,
    engagement: 8,
    clicks: 2,
    likes: 4,
    comments: 2,
    shares: 2,
    raw: { source: "second" },
  });

  const snapshots = (await listSnapshots(userId)).filter(
    (row) => row.postId === postId && row.platform === "linkedin" && row.snapshotDate === snapshotDate,
  );
  assert.equal(snapshots.length, 1);
  assert.equal(snapshots[0]?.impressions, 20);
});

test("Cron-protected endpoints reject unauthorized requests when CRON_SECRET is set", async () => {
  process.env.CRON_SECRET = "cron_secret_123";

  const refreshResponse = await refreshRoute(
    new Request("http://localhost/api/social/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(refreshResponse.status, 401);

  const workerResponse = await publishWorkerRoute(
    new Request("http://localhost/api/worker/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 5 }),
    }),
  );
  assert.equal(workerResponse.status, 401);

  const analyticsResponse = await analyticsPullRoute(
    new Request("http://localhost/api/analytics/linkedin/pull", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assert.equal(analyticsResponse.status, 401);
});
