type LinkedInTokenResponse = {
  access_token: string;
  expires_in?: number;
  refresh_token?: string;
  refresh_token_expires_in?: number;
  scope?: string;
};

type LinkedInMeResponse = {
  id?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
};

type LinkedInUserInfoResponse = {
  sub?: string;
  name?: string;
  given_name?: string;
  family_name?: string;
};

export function getLinkedInEnv() {
  const clientId = process.env.LINKEDIN_CLIENT_ID?.trim();
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn OAuth env is not configured (LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET).");
  }
  return { clientId, clientSecret };
}

export async function exchangeLinkedInCode(input: { code: string; redirectUri: string }) {
  const { clientId, clientSecret } = getLinkedInEnv();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as LinkedInTokenResponse & { error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "LinkedIn token exchange failed.");
  }

  const accessExpiresAt = payload.expires_in
    ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
    : undefined;

  const refreshExpiresAt = payload.refresh_token_expires_in
    ? new Date(Date.now() + payload.refresh_token_expires_in * 1000).toISOString()
    : undefined;

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    scope: payload.scope,
    accessExpiresAt,
    refreshExpiresAt,
  };
}

export async function refreshLinkedInToken(input: { refreshToken: string }) {
  const { clientId, clientSecret } = getLinkedInEnv();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: input.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as LinkedInTokenResponse & { error_description?: string };
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || "LinkedIn token refresh failed.");
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || input.refreshToken,
    scope: payload.scope,
    accessExpiresAt: payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : undefined,
  };
}

export async function fetchLinkedInProfile(accessToken: string) {
  const userInfoResponse = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const userInfoPayload = (await userInfoResponse.json().catch(() => ({}))) as LinkedInUserInfoResponse;
  if (userInfoResponse.ok && userInfoPayload.sub) {
    const displayName =
      userInfoPayload.name ||
      [userInfoPayload.given_name, userInfoPayload.family_name].filter(Boolean).join(" ").trim();
    return {
      providerAccountId: userInfoPayload.sub,
      handle: `li_${userInfoPayload.sub}`,
      displayName: displayName || "LinkedIn User",
    };
  }

  const meResponse = await fetch("https://api.linkedin.com/v2/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const mePayload = (await meResponse.json().catch(() => ({}))) as LinkedInMeResponse;
  if (!meResponse.ok || !mePayload.id) {
    throw new Error("Unable to fetch LinkedIn profile.");
  }

  const displayName = [mePayload.localizedFirstName, mePayload.localizedLastName].filter(Boolean).join(" ").trim();
  return {
    providerAccountId: mePayload.id,
    handle: `li_${mePayload.id}`,
    displayName: displayName || "LinkedIn User",
  };
}
