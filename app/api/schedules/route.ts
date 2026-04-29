import { NextResponse } from "next/server";
import { createPublishJobs, listPublishJobs } from "@/lib/scheduling/store";
import type { SocialPlatform } from "@/lib/social/types";

type ScheduleRequest = {
  userId?: string;
  postId?: string;
  platforms?: SocialPlatform[];
  scheduledForUtc?: string;
  timezone?: string;
};

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const jobs = await listPublishJobs(userId);
    return NextResponse.json({ jobs });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load schedules.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ScheduleRequest;
    const userId = body.userId?.trim();
    const postId = body.postId?.trim();
    const timezone = body.timezone?.trim() || "UTC";
    const scheduledForUtc = body.scheduledForUtc?.trim();

    if (!userId || !postId || !scheduledForUtc || !Array.isArray(body.platforms) || body.platforms.length === 0) {
      return NextResponse.json(
        { error: "Missing required fields: userId, postId, platforms, scheduledForUtc" },
        { status: 400 },
      );
    }

    const jobs = await createPublishJobs({
      userId,
      postId,
      platforms: body.platforms,
      scheduledForUtc,
      timezone,
    });

    return NextResponse.json({ jobs }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to schedule post.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
