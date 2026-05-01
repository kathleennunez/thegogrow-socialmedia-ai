import { NextResponse } from "next/server";
import { parseOAuthState } from "@/lib/social/oauth";
import { connectSocialAccount } from "@/lib/social/store";
import { consumeStateNonce } from "@/lib/social/state-nonce";
import { exchangeLinkedInCode, fetchLinkedInProfile } from "@/lib/social/linkedin";
import { parseScopeString } from "@/lib/social/scopes";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state")?.trim();
    const code = searchParams.get("code")?.trim();

    if (!state || !code) {
      return NextResponse.json({ error: "Missing required query params: state and code" }, { status: 400 });
    }

    const parsedState = parseOAuthState(state);
    if (!parsedState) {
      return NextResponse.json({ error: "Invalid or expired OAuth state." }, { status: 400 });
    }

    const nonce = parsedState.nonce?.trim() ?? "";
    if (!nonce || !(await consumeStateNonce(nonce))) {
      return NextResponse.json({ error: "OAuth nonce is invalid or already used." }, { status: 400 });
    }

    if (parsedState.platform !== "linkedin") {
      return NextResponse.json({ error: "Only LinkedIn real token exchange is implemented." }, { status: 400 });
    }

    const redirectUri = `${origin}/api/social/callback`;
    const tokenSet = await exchangeLinkedInCode({ code, redirectUri });
    const profile = await fetchLinkedInProfile(tokenSet.accessToken);

    await connectSocialAccount({
      userId: parsedState.userId,
      platform: parsedState.platform,
      providerAccountId: profile.providerAccountId,
      handle: profile.handle,
      displayName: profile.displayName,
      scopes: parseScopeString(tokenSet.scope),
      accessToken: tokenSet.accessToken,
      refreshToken: tokenSet.refreshToken,
      expiresAt: tokenSet.accessExpiresAt,
    });

    const redirectUrl = new URL("/", origin);
    redirectUrl.searchParams.set("stage", "schedule");
    redirectUrl.searchParams.set("social_connected", "1");
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to complete OAuth callback.";
    const redirectUrl = new URL("/", origin);
    redirectUrl.searchParams.set("stage", "schedule");
    redirectUrl.searchParams.set("social_error", message);
    return NextResponse.redirect(redirectUrl);
  }
}
