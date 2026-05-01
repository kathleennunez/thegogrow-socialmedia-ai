export function parseScopeString(scope?: string | null): string[] {
  if (!scope) return [];
  return scope
    .split(/[\s,]+/)
    .map((value) => value.trim())
    .filter(Boolean);
}

export function normalizeScopes(scopes: string[] | undefined): string[] {
  if (!Array.isArray(scopes)) return [];
  return scopes
    .flatMap((scope) => parseScopeString(scope))
    .filter((scope, index, all) => all.indexOf(scope) === index);
}
