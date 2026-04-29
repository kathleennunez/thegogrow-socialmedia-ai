import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { ingestSnapshot } from "@/lib/analytics/store";
import { fetchLinkedInPostMetrics } from "@/lib/analytics/linkedin";
import { listPublishedPostsForPlatform } from "@/lib/scheduling/store";
import { getSocialTokenByAccountId } from "@/lib/social/store";

export async function POST(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const published = await listPublishedPostsForPlatform("linkedin");
    let ingested = 0;

    for (const item of published) {
      const token = await getSocialTokenByAccountId(item.social_account_id);
      if (!token) continue;
      const metrics = await fetchLinkedInPostMetrics({
        accessToken: token.accessToken,
        providerPostId: item.provider_post_id,
      });
      await ingestSnapshot({
        userId: item.user_id,
        postId: item.post_id,
        platform: "linkedin",
        snapshotDate: new Date().toISOString().slice(0, 10),
        impressions: metrics.impressions,
        engagement: metrics.engagement,
        clicks: metrics.clicks,
        likes: metrics.likes,
        comments: metrics.comments,
        shares: metrics.shares,
        raw: metrics.raw,
      });
      ingested += 1;
    }

    return NextResponse.json({ ingested });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to pull LinkedIn analytics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
