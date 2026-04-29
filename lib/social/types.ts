export type SocialPlatform = "linkedin" | "x" | "meta" | "pinterest" | "youtube" | "tiktok";

export type SocialAccountStatus = "connected" | "disconnected" | "error";

export type SocialAccount = {
  id: string;
  userId: string;
  platform: SocialPlatform;
  providerAccountId: string;
  handle: string;
  displayName: string;
  scopes: string[];
  status: SocialAccountStatus;
  connectedAt: string;
  updatedAt: string;
};

export type SocialTokenRecord = {
  accountId: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  expiresAt?: string;
  updatedAt: string;
};

export type ProviderRequirement = {
  platform: SocialPlatform;
  oauthVersion: "oauth2";
  authUrl: string;
  tokenUrl: string;
  defaultScopes: string[];
  notes: string[];
};
