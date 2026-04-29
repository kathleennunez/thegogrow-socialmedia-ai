import { NextResponse } from "next/server";
import { buildConnectMetadata, createOAuthState } from "@/lib/social/oauth";
import { createStateNonce, storeStateNonce } from "@/lib/social/state-nonce";
import type { SocialPlatform } from "@/lib/social/types";

const supportedPlatforms: SocialPlatform[] = ["linkedin", "x", "meta", "pinterest", "youtube", "tiktok"];

export async function GET(request: Request) {
  try {
    const { searchParams, origin } = new URL(request.url);
    const platform = searchParams.get("platform") as SocialPlatform | null;
    const userId = searchParams.get("userId")?.trim();

    if (!platform || !supportedPlatforms.includes(platform)) {
      return NextResponse.json({ error: "Invalid platform." }, { status: 400 });
    }

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const { clientIdEnv, requirement } = buildConnectMetadata(platform);
    const clientId = process.env[clientIdEnv]?.trim();
    const redirectUri = `${origin}/api/social/callback`;
    const nonce = createStateNonce();
    await storeStateNonce(nonce);
    const state = createOAuthState({ userId, platform, nonce });

    const authorizeUrl = new URL(requirement.authUrl);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("client_id", clientId ?? "MISSING_CLIENT_ID");
    authorizeUrl.searchParams.set("redirect_uri", redirectUri);
    authorizeUrl.searchParams.set("scope", requirement.defaultScopes.join(" "));
    authorizeUrl.searchParams.set("state", state);

    return NextResponse.json({
      platform,
      configured: Boolean(clientId),
      requirements: requirement,
      oauth: {
        authorizeUrl: authorizeUrl.toString(),
        redirectUri,
        clientIdEnv,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to prepare OAuth connect flow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
