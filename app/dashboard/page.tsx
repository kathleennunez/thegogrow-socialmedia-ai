"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppUser } from "@/components/UserProvider";
import type { Post } from "@/types";

type DashboardData = {
  posts: Post[];
  unreadCount: number;
};

type AnalyticsSummary = {
  totals: {
    impressions: number;
    engagement: number;
    clicks: number;
    likes: number;
    comments: number;
    shares: number;
  };
  count: number;
  snapshots?: Array<{
    id: string;
    postId: string;
    platform: string;
    snapshotDate: string;
    impressions: number;
    engagement: number;
    clicks: number;
    likes: number;
    comments: number;
    shares: number;
  }>;
};

type DashboardIdea = {
  title: string;
  hook: string;
  angle: string;
  whyNow: string;
  platform: string;
};

type UserSettingsLite = {
  brandName?: string;
  voice?: string;
};

const numberFormatter = new Intl.NumberFormat("en-US");
const percentFormatter = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });

export default function DashboardPage() {
  const { user, isReady } = useAppUser();
  const [data, setData] = useState<DashboardData>({ posts: [], unreadCount: 0 });
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    totals: { impressions: 0, engagement: 0, clicks: 0, likes: 0, comments: 0, shares: 0 },
    count: 0,
  });
  const [ideas, setIdeas] = useState<DashboardIdea[]>([]);
  const [settings, setSettings] = useState<UserSettingsLite>({});
  const [isIdeasLoading, setIsIdeasLoading] = useState(false);
  const [quickSummary, setQuickSummary] = useState<string>("");
  const [quickSummaryUpdatedAt, setQuickSummaryUpdatedAt] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshIdeas = useCallback(async () => {
    if (!user?.id) return;
    setIsIdeasLoading(true);
    try {
      const ideasResponse = await fetch("/api/dashboard/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const ideasPayload = (await ideasResponse.json()) as {
        ideas?: DashboardIdea[];
        error?: string;
      };
      if (!ideasResponse.ok) {
        throw new Error(ideasPayload.error ?? "Failed to load AI ideas.");
      }
      setIdeas(ideasPayload.ideas ?? []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load AI ideas.";
      setError(message);
    } finally {
      setIsIdeasLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const [postsResponse, notificationsResponse, analyticsResponse, settingsResponse] = await Promise.all([
          fetch(`/api/posts?userId=${encodeURIComponent(user.id)}`),
          fetch(`/api/notifications?userId=${encodeURIComponent(user.id)}`),
          fetch(`/api/analytics?userId=${encodeURIComponent(user.id)}`),
          fetch(`/api/settings?userId=${encodeURIComponent(user.id)}`),
        ]);

        const postsPayload = (await postsResponse.json()) as { posts?: Post[]; error?: string };
        const notificationsPayload = (await notificationsResponse.json()) as {
          unreadCount?: number;
          error?: string;
        };
        const analyticsPayload = (await analyticsResponse.json()) as
          | (AnalyticsSummary & { error?: string })
          | { error?: string };
        const settingsPayload = (await settingsResponse.json()) as { settings?: UserSettingsLite; error?: string };

        if (!postsResponse.ok) {
          throw new Error(postsPayload.error ?? "Failed to load posts.");
        }
        if (!notificationsResponse.ok) {
          throw new Error(notificationsPayload.error ?? "Failed to load notifications.");
        }
        if (!analyticsResponse.ok) {
          throw new Error(analyticsPayload.error ?? "Failed to load analytics.");
        }
        if (!settingsResponse.ok) {
          throw new Error(settingsPayload.error ?? "Failed to load settings.");
        }

        setData({
          posts: postsPayload.posts ?? [],
          unreadCount: notificationsPayload.unreadCount ?? 0,
        });

        setAnalytics({
          totals:
            "totals" in analyticsPayload
              ? analyticsPayload.totals
              : { impressions: 0, engagement: 0, clicks: 0, likes: 0, comments: 0, shares: 0 },
          count: "count" in analyticsPayload ? analyticsPayload.count : 0,
          snapshots: "snapshots" in analyticsPayload ? analyticsPayload.snapshots ?? [] : [],
        });
        setSettings(settingsPayload.settings ?? {});

        await refreshIdeas();
      } catch (loadError) {
        const message = loadError instanceof Error ? loadError.message : "Failed to load dashboard.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    if (isReady) {
      void loadDashboard();
    }
  }, [isReady, user?.id, refreshIdeas]);

  const totals = useMemo(() => {
    const now = Date.now();
    const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalWords = data.posts.reduce((sum, post) => sum + post.text.trim().split(/\s+/).filter(Boolean).length, 0);
    const uniquePlatforms = new Set(
      data.posts.flatMap((post) => (post.platforms.length ? post.platforms.map((p) => p.toUpperCase()) : ["UNKNOWN"])),
    );
    const postsThisWeek = data.posts.filter((post) => new Date(post.savedAt).getTime() >= weekAgo).length;
    const postsToday = data.posts.filter((post) => new Date(post.savedAt).getTime() >= todayStart.getTime()).length;

    return {
      totalPosts: data.posts.length,
      avgWordsPerPost: data.posts.length > 0 ? totalWords / data.posts.length : 0,
      uniquePlatforms: uniquePlatforms.size,
      postsThisWeek,
      postsToday,
      unreadCount: data.unreadCount,
    };
  }, [data.posts, data.unreadCount]);

  const platformPerformance = useMemo(() => {
    const analyticsSnapshots = analytics.snapshots ?? [];
    if (analyticsSnapshots.length > 0) {
      const byPlatform = new Map<string, { impressions: number; engagement: number; clicks: number }>();
      for (const row of analyticsSnapshots) {
        const key = (row.platform || "unknown").toUpperCase();
        const current = byPlatform.get(key) ?? { impressions: 0, engagement: 0, clicks: 0 };
        current.impressions += row.impressions;
        current.engagement += row.engagement;
        current.clicks += row.clicks;
        byPlatform.set(key, current);
      }
      const totalImpressions = Array.from(byPlatform.values()).reduce((sum, item) => sum + item.impressions, 0);
      return Array.from(byPlatform.entries())
        .map(([platform, metrics]) => ({
          platform,
          posts: metrics.impressions,
          share: totalImpressions > 0 ? (metrics.impressions / totalImpressions) * 100 : 0,
          avgWords: metrics.engagement,
          lastSavedAt: 0,
          source: "analytics" as const,
        }))
        .sort((a, b) => b.posts - a.posts);
    }

    const postMap = new Map<string, { posts: number; totalWords: number; lastSavedAt: number }>();
    for (const post of data.posts) {
      const key = (post.platforms[0] || "unknown").toUpperCase();
      const current = postMap.get(key) ?? { posts: 0, totalWords: 0, lastSavedAt: 0 };
      const words = post.text.trim().split(/\s+/).filter(Boolean).length;
      current.posts += 1;
      current.totalWords += words;
      current.lastSavedAt = Math.max(current.lastSavedAt, new Date(post.savedAt).getTime());
      postMap.set(key, current);
    }
    return Array.from(postMap.entries())
      .map(([platform, metrics]) => ({
        platform,
        posts: metrics.posts,
        share: data.posts.length > 0 ? (metrics.posts / data.posts.length) * 100 : 0,
        avgWords: metrics.posts > 0 ? metrics.totalWords / metrics.posts : 0,
        lastSavedAt: metrics.lastSavedAt,
        source: "posts" as const,
      }))
      .sort((a, b) => b.posts - a.posts);
  }, [analytics, data.posts]);

  const buildQuickSummary = useCallback(() => {
    const top = platformPerformance[0];
    if (!top) {
      return `No performance data yet for ${settings.brandName ?? "your brand"}. Keep content in a ${(
        settings.voice ?? "professional"
      ).toLowerCase()} tone, publish initial drafts, then review first-week metrics.`;
    }
    if (top.source === "analytics") {
      return `${settings.brandName ?? "Your brand"} · ${top.platform}: ${numberFormatter.format(top.posts)} impressions so far, ${numberFormatter.format(Math.round(top.avgWords))} engagements. Keep the next summary in a ${(
        settings.voice ?? "professional"
      ).toLowerCase()} voice and test one stronger CTA variation this week.`;
    }
    return `${settings.brandName ?? "Your brand"} · ${top.platform}: ${numberFormatter.format(top.posts)} saved drafts, ${Math.round(top.avgWords)} avg words. Publish 2–3 strongest drafts this week in a ${(
      settings.voice ?? "professional"
    ).toLowerCase()} style to start collecting measurable reach and engagement data.`;
  }, [platformPerformance, settings.brandName, settings.voice]);

  useEffect(() => {
    setQuickSummary(buildQuickSummary());
  }, [buildQuickSummary]);

  const runCuratorAi = async () => {
    setQuickSummary("Analyzing current metrics and regenerating weekly summary...");
    await refreshIdeas();
    const nextSummary = buildQuickSummary();
    setQuickSummary(nextSummary);
    setQuickSummaryUpdatedAt(
      new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    );
  };

  const recentPosts = useMemo(
    () => [...data.posts].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime()).slice(0, 3),
    [data.posts],
  );

  if (isLoading) {
    return <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-10 pb-10">
      <section>
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface">Dashboard</h1>
        <p className="mt-2 max-w-2xl font-medium text-on-surface-variant">
          Snapshot of your content performance and workflow activity.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatPillCard label="Saved Posts" value={numberFormatter.format(totals.totalPosts)} icon="bookmark_added" />
        <StatPillCard label="Posts This Week" value={numberFormatter.format(totals.postsThisWeek)} icon="calendar_today" />
        <StatPillCard label="Posts Today" value={numberFormatter.format(totals.postsToday)} icon="today" />
        <StatPillCard label="Avg Words/Post" value={numberFormatter.format(Math.round(totals.avgWordsPerPost))} icon="notes" />
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <article className="relative overflow-hidden rounded-3xl bg-surface-container-lowest p-8 xl:col-span-8">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          <div className="relative">
            <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-headline text-2xl font-bold">Metric Snapshots</h2>
              <div className="flex gap-2">
                <span className="rounded-full bg-surface-container px-3 py-1 text-[10px] font-bold uppercase tracking-tight text-on-surface-variant">Real-time</span>
                <span className="rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-tight text-white">Live Feed</span>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <MetricRail label="Impressions" value={numberFormatter.format(analytics.totals.impressions)} tint="primary" width="w-3/4" />
              <MetricRail label="Engagement" value={numberFormatter.format(analytics.totals.engagement)} tint="tertiary" width="w-1/2" />
              <MetricRail label="Clicks" value={numberFormatter.format(analytics.totals.clicks)} tint="secondary" width="w-2/3" />
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-medium text-on-surface-variant">Platforms active: {totals.uniquePlatforms}</p>
              <span className="rounded-full bg-primary-fixed px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-on-primary-fixed">
                {numberFormatter.format(analytics.count)} snapshots
              </span>
            </div>
          </div>
        </article>

        <article className="flex flex-col justify-between rounded-3xl bg-primary p-8 text-white xl:col-span-4">
          <div>
            <div className="mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined">bolt</span>
              <span className="text-xs font-bold uppercase tracking-widest opacity-80">Quick AI Action</span>
            </div>
            <h3 className="mb-4 font-headline text-2xl font-bold leading-tight">Regenerate weekly summary from current metrics</h3>
            <div className="rounded-2xl bg-white/80 p-4 text-on-surface backdrop-blur">
              <p className="text-xs font-medium leading-relaxed">
                {ideas.length > 0 ? `${ideas[0].platform}: ${ideas[0].hook}` : quickSummary}
              </p>
              {quickSummaryUpdatedAt ? (
                <p className="mt-3 text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">
                  Updated {quickSummaryUpdatedAt}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={() => void runCuratorAi()}
            disabled={isIdeasLoading}
            className="mt-6 rounded-xl bg-white px-6 py-3 text-sm font-bold text-primary transition hover:bg-white/90"
          >
            {isIdeasLoading ? "Refreshing..." : "Start Curator AI"}
          </button>
        </article>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-12">
        <article className="space-y-5 xl:col-span-5">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-headline text-2xl font-extrabold tracking-tight">Platform Performance</h2>
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-on-surface-variant">Based on saved posts</span>
          </div>
          <div className="space-y-3 rounded-3xl bg-surface-container-low p-6">
            {platformPerformance.length === 0 ? (
              <p className="rounded-2xl bg-surface-container-lowest p-4 text-sm text-on-surface-variant">No platform data yet.</p>
            ) : (
              platformPerformance.slice(0, 4).map((item) => (
                <div key={item.platform} className="flex items-center justify-between rounded-2xl bg-surface-container-lowest p-5 transition hover:translate-x-1">
                  <div>
                    <p className="font-bold text-on-surface">{item.platform}</p>
                    <p className="text-[10px] font-black uppercase text-on-surface-variant">Share {percentFormatter.format(item.share)}%</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">
                      {numberFormatter.format(item.posts)} {item.source === "analytics" ? "impr." : "posts"}
                    </p>
                    <p className="text-[10px] font-bold text-emerald-600">
                      {item.source === "analytics" ? `${numberFormatter.format(Math.round(item.avgWords))} eng.` : `Avg ${Math.round(item.avgWords)} words`}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="space-y-5 xl:col-span-7">
          <div className="flex items-center justify-between px-1">
            <h2 className="font-headline text-2xl font-extrabold tracking-tight">Recent Drafts</h2>
            <Link href="/saved" className="text-sm font-bold text-primary hover:underline">View All</Link>
          </div>
          <div className="space-y-3">
            {recentPosts.length === 0 ? (
              <p className="rounded-3xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant">No drafts yet.</p>
            ) : (
              recentPosts.map((post) => (
                <div key={post.id} className="flex items-center gap-5 rounded-3xl bg-surface-container-lowest p-6 transition hover:shadow-xl hover:shadow-on-surface/5">
                  <div className="h-14 w-14 flex-shrink-0 rounded-2xl bg-surface-container" />
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-secondary-fixed text-on-secondary-fixed-variant">
                        {(post.platforms[0] ?? "social").toUpperCase()}
                      </span>
                      <span className="text-[10px] font-medium text-on-surface-variant">
                        {new Date(post.savedAt).toLocaleString("en-US", { month: "short", day: "2-digit" })}
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm font-bold leading-snug text-on-surface">{post.text}</p>
                  </div>
                  <Link href="/saved" className="rounded-full p-2 text-on-surface-variant transition hover:bg-surface-container hover:text-primary">
                    <span className="material-symbols-outlined text-xl">edit</span>
                  </Link>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

    </div>
  );
}

function StatPillCard({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <article className="group rounded-3xl bg-surface-container-lowest p-7 transition-all duration-300 hover:bg-primary/5">
      <div className="mb-5 flex items-start justify-between">
        <div className="rounded-2xl bg-secondary-fixed p-3 text-primary">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
      </div>
      <p className="mb-1 text-sm font-semibold text-on-surface-variant">{label}</p>
      <p className="font-headline text-3xl font-black text-on-surface">{value}</p>
    </article>
  );
}

function MetricRail({
  label,
  value,
  tint,
  width,
}: {
  label: string;
  value: string;
  tint: "primary" | "tertiary" | "secondary";
  width: string;
}) {
  const barColor = tint === "primary" ? "bg-primary" : tint === "tertiary" ? "bg-tertiary" : "bg-secondary";
  const valueColor = tint === "primary" ? "text-primary" : "text-on-surface";

  return (
    <div>
      <p className="mb-1 text-sm font-medium text-on-surface-variant">{label}</p>
      <p className={`font-headline text-4xl font-black ${valueColor}`}>{value}</p>
      <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-surface-container">
        <div className={`${width} h-full ${barColor}`} />
      </div>
    </div>
  );
}
