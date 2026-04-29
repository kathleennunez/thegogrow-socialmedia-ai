export async function fetchLinkedInPostMetrics(input: {
  accessToken: string;
  providerPostId: string;
}) {
  const encodedUrn = encodeURIComponent(input.providerPostId);
  const response = await fetch(`https://api.linkedin.com/rest/socialActions/${encodedUrn}`, {
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "LinkedIn-Version": "202405",
      "X-Restli-Protocol-Version": "2.0.0",
    },
  });

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new Error((raw.message as string) || "LinkedIn metrics fetch failed.");
  }

  const num = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
  const likesSummary = raw.likesSummary as { totalLikes?: number } | undefined;
  const commentsSummary = raw.commentsSummary as { totalFirstLevelComments?: number } | undefined;

  const likes = num(likesSummary?.totalLikes);
  const comments = num(commentsSummary?.totalFirstLevelComments);
  const shares = num((raw as { totalShareStatistics?: { shareCount?: number } }).totalShareStatistics?.shareCount);
  const impressions = num((raw as { totalShareStatistics?: { impressionCount?: number } }).totalShareStatistics?.impressionCount);

  return {
    impressions,
    likes,
    comments,
    shares,
    clicks: 0,
    engagement: likes + comments + shares,
    raw,
  };
}
