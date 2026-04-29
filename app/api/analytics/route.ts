import { NextResponse } from "next/server";
import { ingestSnapshot, summarizeAnalytics } from "@/lib/analytics/store";
import type { SocialPlatform } from "@/lib/social/types";

type IngestBody = {
  userId?: string;
  postId?: string;
  platform?: SocialPlatform;
  snapshotDate?: string;
  impressions?: number;
  engagement?: number;
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  raw?: Record<string, unknown>;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const summary = await summarizeAnalytics(userId);
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load analytics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IngestBody;
    const userId = body.userId?.trim();
    const postId = body.postId?.trim();
    const platform = body.platform;

    if (!userId || !postId || !platform) {
      return NextResponse.json({ error: "Missing required fields: userId, postId, platform" }, { status: 400 });
    }

    const snapshot = await ingestSnapshot({
      userId,
      postId,
      platform,
      snapshotDate: body.snapshotDate?.trim() || new Date().toISOString().slice(0, 10),
      impressions: Math.max(0, body.impressions ?? 0),
      engagement: Math.max(0, body.engagement ?? 0),
      clicks: Math.max(0, body.clicks ?? 0),
      likes: Math.max(0, body.likes ?? 0),
      comments: Math.max(0, body.comments ?? 0),
      shares: Math.max(0, body.shares ?? 0),
      raw: body.raw,
    });

    return NextResponse.json({ snapshot }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to ingest analytics.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
