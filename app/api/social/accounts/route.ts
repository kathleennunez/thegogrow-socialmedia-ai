import { NextResponse } from "next/server";
import { disconnectSocialAccount, listSocialAccounts } from "@/lib/social/store";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId")?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const accounts = await listSocialAccounts(userId);
    return NextResponse.json({ accounts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load social accounts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { userId?: string; accountId?: string };
    const userId = body.userId?.trim();
    const accountId = body.accountId?.trim();

    if (!userId || !accountId) {
      return NextResponse.json({ error: "Missing required fields: userId, accountId" }, { status: 400 });
    }

    const removed = await disconnectSocialAccount(userId, accountId);
    if (!removed) {
      return NextResponse.json({ error: "Connected account not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to disconnect account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
