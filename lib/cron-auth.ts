export function isCronAuthorized(request: Request) {
  const configured = process.env.CRON_SECRET?.trim();
  if (!configured) {
    return true;
  }

  const authHeader = request.headers.get("authorization")?.trim();
  if (!authHeader) {
    return false;
  }

  return authHeader === `Bearer ${configured}`;
}
