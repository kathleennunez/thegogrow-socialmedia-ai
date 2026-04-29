import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as Record<string, unknown>;

    // This endpoint is intentionally thin so provider webhooks can fan out to
    // provider-specific validators in future iterations.
    return NextResponse.json({ accepted: true, payloadPreview: payload }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to accept analytics payload.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
