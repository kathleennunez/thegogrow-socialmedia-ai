import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { runPublishWorker } from "@/lib/scheduling/worker";

export async function POST(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as { limit?: number };
    const limit = Math.max(1, Math.min(100, Number(body.limit ?? 20)));
    const result = await runPublishWorker(limit);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to run publish worker.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
