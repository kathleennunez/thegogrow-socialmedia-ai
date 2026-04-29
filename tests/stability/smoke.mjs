import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(file, "utf-8");

const requiredFiles = [
  "app/api/social/connect/route.ts",
  "app/api/social/callback/route.ts",
  "app/api/schedules/route.ts",
  "app/api/analytics/route.ts",
  "lib/social/security.ts",
  "lib/social/oauth.ts",
  "lib/scheduling/time.ts",
  "docs/database-schema.sql",
  "docs/social-scheduling-analytics-plan.md",
];

for (const file of requiredFiles) {
  const content = await read(file);
  assert.ok(content.length > 0, `${file} should not be empty`);
}

const oauth = await read("lib/social/oauth.ts");
for (const platform of ["linkedin", "x", "meta", "pinterest", "youtube", "tiktok"]) {
  assert.ok(oauth.includes(`${platform}:`), `OAuth requirements missing ${platform}`);
}

const schema = await read("docs/database-schema.sql");
for (const table of [
  "social_accounts",
  "social_account_tokens",
  "publish_jobs",
  "analytics_snapshots",
]) {
  assert.ok(schema.includes(`create table if not exists ${table}`), `Missing table ${table}`);
}

const analyticsRoute = await read("app/api/analytics/route.ts");
assert.ok(analyticsRoute.includes("export async function GET"), "Analytics GET route missing");
assert.ok(analyticsRoute.includes("export async function POST"), "Analytics POST route missing");

console.log("Stability smoke checks passed.");
