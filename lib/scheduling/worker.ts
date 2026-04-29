import { getPostById } from "@/lib/store";
import { claimDueJobs, markPublishJobFailed, markPublishJobPublished } from "@/lib/scheduling/store";
import { getSocialAccountById, getSocialTokenByAccountId } from "@/lib/social/store";

const LINKEDIN_POSTS_URL = "https://api.linkedin.com/rest/posts";

async function publishToLinkedIn(input: {
  accessToken: string;
  providerAccountId: string;
  text: string;
}) {
  const authorUrn = `urn:li:person:${input.providerAccountId}`;
  const body = {
    author: authorUrn,
    commentary: input.text,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  const response = await fetch(LINKEDIN_POSTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
      "LinkedIn-Version": "202405",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify(body),
  });

  const payload = (await response.json().catch(() => ({}))) as { id?: string; error?: string; message?: string };
  if (!response.ok || !payload.id) {
    throw new Error(payload.message || payload.error || "LinkedIn publish failed.");
  }

  return {
    providerPostId: payload.id,
    permalink: `https://www.linkedin.com/feed/update/${payload.id}`,
  };
}

export async function runPublishWorker(limit = 20) {
  const dueJobs = await claimDueJobs(limit);
  const results: Array<{ jobId: string; status: "published" | "failed"; error?: string }> = [];

  for (const job of dueJobs) {
    try {
      const account = await getSocialAccountById(job.social_account_id);
      const token = await getSocialTokenByAccountId(job.social_account_id);
      const post = account ? await getPostById(account.userId, job.post_id) : null;

      if (!account || !token || !post) {
        throw new Error("Missing account, token, or post payload.");
      }
      if (job.platform !== "linkedin") {
        throw new Error(`Unsupported publish platform for worker: ${job.platform}`);
      }

      const published = await publishToLinkedIn({
        accessToken: token.accessToken,
        providerAccountId: account.providerAccountId,
        text: post.text,
      });

      await markPublishJobPublished({
        jobId: job.id,
        providerPostId: published.providerPostId,
        permalink: published.permalink,
      });
      results.push({ jobId: job.id, status: "published" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Publish failed.";
      await markPublishJobFailed({
        jobId: job.id,
        error: message,
        retryCount: job.retry_count,
        maxRetries: 5,
      });
      results.push({ jobId: job.id, status: "failed", error: message });
    }
  }

  return {
    processed: dueJobs.length,
    published: results.filter((r) => r.status === "published").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  };
}
