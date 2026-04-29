import { NextResponse } from "next/server";
import { isCronAuthorized } from "@/lib/cron-auth";
import { refreshLinkedInToken } from "@/lib/social/linkedin";
import { listExpiringTokens, updateSocialToken } from "@/lib/social/store";

type RefreshRequest = {
  accountId?: string;
  refreshToken?: string;
};

export async function POST(request: Request) {
  try {
    if (!isCronAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }
    const body = (await request.json().catch(() => ({}))) as RefreshRequest;
    const accountId = body.accountId?.trim();
    const directRefreshToken = body.refreshToken?.trim();

    if (accountId && directRefreshToken) {
      const refreshed = await refreshLinkedInToken({ refreshToken: directRefreshToken });
      await updateSocialToken({
        accountId,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.accessExpiresAt,
        scopes: refreshed.scope?.split(/\s+/).filter(Boolean),
      });
      return NextResponse.json({ refreshed: 1 });
    }

    const expiring = await listExpiringTokens("linkedin", 15 * 60);
    let refreshedCount = 0;
    for (const token of expiring) {
      const refreshed = await refreshLinkedInToken({ refreshToken: token.refreshToken });
      await updateSocialToken({
        accountId: token.accountId,
        accessToken: refreshed.accessToken,
        refreshToken: refreshed.refreshToken,
        expiresAt: refreshed.accessExpiresAt,
        scopes: refreshed.scope?.split(/\s+/).filter(Boolean),
      });
      refreshedCount += 1;
    }

    return NextResponse.json({ refreshed: refreshedCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refresh social token(s).";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
