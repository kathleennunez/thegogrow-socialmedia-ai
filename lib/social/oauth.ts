import { createHmac } from "node:crypto";
import type { ProviderRequirement, SocialPlatform } from "@/lib/social/types";

const STATE_TTL_MS = 10 * 60 * 1000;

export const PROVIDER_REQUIREMENTS: Record<SocialPlatform, ProviderRequirement> = {
  linkedin: {
    platform: "linkedin",
    oauthVersion: "oauth2",
    authUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    defaultScopes: ["openid", "profile", "w_member_social"],
    notes: [
      "Requires LinkedIn app credentials and approved scopes for publishing.",
      "Use a member URN/account mapping for publish operations.",
    ],
  },
  x: {
    platform: "x",
    oauthVersion: "oauth2",
    authUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.x.com/2/oauth2/token",
    defaultScopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    notes: [
      "API usage is credit-based; enable strict cost controls before production.",
      "Store refresh tokens when using offline access.",
    ],
  },
  meta: {
    platform: "meta",
    oauthVersion: "oauth2",
    authUrl: "https://www.facebook.com/v22.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v22.0/oauth/access_token",
    defaultScopes: ["pages_show_list", "pages_manage_posts", "instagram_basic", "instagram_content_publish"],
    notes: [
      "Publishing to Instagram requires business/professional account linkage.",
      "Some permissions require app review before production.",
    ],
  },
  pinterest: {
    platform: "pinterest",
    oauthVersion: "oauth2",
    authUrl: "https://www.pinterest.com/oauth/",
    tokenUrl: "https://api.pinterest.com/v5/oauth/token",
    defaultScopes: ["boards:read", "boards:write", "pins:read", "pins:write"],
    notes: [
      "Content publishing is board-centric; require board selection at connect or scheduling time.",
    ],
  },
  youtube: {
    platform: "youtube",
    oauthVersion: "oauth2",
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    defaultScopes: ["https://www.googleapis.com/auth/youtube.upload"],
    notes: [
      "YouTube API is quota-based; track consumption per upload endpoint.",
    ],
  },
  tiktok: {
    platform: "tiktok",
    oauthVersion: "oauth2",
    authUrl: "https://www.tiktok.com/v2/auth/authorize/",
    tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
    defaultScopes: ["user.info.basic", "video.publish"],
    notes: [
      "Publishing capabilities depend on app status and audit requirements.",
    ],
  },
};

const getStateSecret = () =>
  process.env.SOCIAL_OAUTH_STATE_SECRET?.trim() ||
  (process.env.NODE_ENV === "production" ? "" : "local-dev-social-oauth-state-secret");

const sign = (value: string) => createHmac("sha256", getStateSecret()).update(value).digest("base64url");

export function createOAuthState(payload: { userId: string; platform: SocialPlatform; nonce?: string }) {
  const stateSecret = getStateSecret();
  if (!stateSecret) {
    throw new Error("SOCIAL_OAUTH_STATE_SECRET must be configured in production.");
  }
  const encoded = Buffer.from(
    JSON.stringify({ ...payload, issuedAt: Date.now() }),
    "utf-8",
  ).toString("base64url");

  return `${encoded}.${sign(encoded)}`;
}

export function parseOAuthState(state: string): { userId: string; platform: SocialPlatform; nonce?: string } | null {
  const stateSecret = getStateSecret();
  if (!stateSecret) {
    throw new Error("SOCIAL_OAUTH_STATE_SECRET must be configured in production.");
  }
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || sign(encoded) !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as {
      userId?: string;
      platform?: SocialPlatform;
      nonce?: string;
      issuedAt?: number;
    };

    if (!parsed.userId || !parsed.platform || !parsed.issuedAt) {
      return null;
    }

    if (Date.now() - parsed.issuedAt > STATE_TTL_MS) {
      return null;
    }

    return { userId: parsed.userId, platform: parsed.platform, nonce: parsed.nonce };
  } catch {
    return null;
  }
}

export function buildConnectMetadata(platform: SocialPlatform) {
  const requirement = PROVIDER_REQUIREMENTS[platform];
  const upper = platform.toUpperCase();
  return {
    clientIdEnv: `${upper}_CLIENT_ID`,
    clientSecretEnv: `${upper}_CLIENT_SECRET`,
    requirement,
  };
}
