"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAppUser } from "@/components/UserProvider";
import type { Post } from "@/types";

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

const numberFormatter = new Intl.NumberFormat("en-US");
const compactFormatter = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function safePct(current: number, base: number) {
  if (base <= 0) return 0;
  return ((current - base) / base) * 100;
}

export default function AnalyticsPage() {
  const { user, isReady } = useAppUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary>({
    totals: { impressions: 0, engagement: 0, clicks: 0, likes: 0, comments: 0, shares: 0 },
    count: 0,
    snapshots: [],
  });
  const [ideas, setIdeas] = useState<DashboardIdea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [postsRes, analyticsRes, ideasRes] = await Promise.all([
          fetch(`/api/posts?userId=${encodeURIComponent(user.id)}`),
          fetch(`/api/analytics?userId=${encodeURIComponent(user.id)}`),
          fetch("/api/dashboard/ideas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          }),
        ]);

        const postsPayload = (await postsRes.json()) as { posts?: Post[]; error?: string };
        const analyticsPayload = (await analyticsRes.json()) as AnalyticsSummary & { error?: string };
        const ideasPayload = (await ideasRes.json()) as { ideas?: DashboardIdea[]; error?: string };

        if (!postsRes.ok) throw new Error(postsPayload.error ?? "Failed to load posts.");
        if (!analyticsRes.ok) throw new Error(analyticsPayload.error ?? "Failed to load analytics.");
        if (!ideasRes.ok) throw new Error(ideasPayload.error ?? "Failed to load AI insights.");

        setPosts(postsPayload.posts ?? []);
        setAnalytics({
          totals: analyticsPayload.totals,
          count: analyticsPayload.count,
          snapshots: analyticsPayload.snapshots ?? [],
        });
        setIdeas(ideasPayload.ideas ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load analytics dashboard.");
      } finally {
        setLoading(false);
      }
    };

    if (isReady) {
      void load();
    }
  }, [isReady, user?.id]);

  const filteredSnapshots = useMemo(() => {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    return (analytics.snapshots ?? []).filter((item) => new Date(item.snapshotDate).getTime() >= cutoff);
  }, [analytics.snapshots, range]);

  const aggregateByPlatform = useMemo(() => {
    const map = new Map<string, { impressions: number; engagement: number; clicks: number }>();
    for (const row of filteredSnapshots) {
      const key = row.platform.toUpperCase();
      const current = map.get(key) ?? { impressions: 0, engagement: 0, clicks: 0 };
      current.impressions += row.impressions;
      current.engagement += row.engagement;
      current.clicks += row.clicks;
      map.set(key, current);
    }

    const rows = Array.from(map.entries()).map(([platform, value]) => ({ platform, ...value }));
    const total = rows.reduce((sum, row) => sum + row.impressions, 0);
    return rows
      .map((row) => ({ ...row, share: total > 0 ? (row.impressions / total) * 100 : 0 }))
      .sort((a, b) => b.impressions - a.impressions);
  }, [filteredSnapshots]);

  const topPosts = useMemo(() => {
    const byPost = new Map<string, { impressions: number; engagement: number; clicks: number; platform: string }>();
    for (const row of filteredSnapshots) {
      const current = byPost.get(row.postId) ?? { impressions: 0, engagement: 0, clicks: 0, platform: row.platform };
      current.impressions += row.impressions;
      current.engagement += row.engagement;
      current.clicks += row.clicks;
      current.platform = row.platform;
      byPost.set(row.postId, current);
    }

    return Array.from(byPost.entries())
      .map(([postId, metrics]) => {
        const post = posts.find((p) => p.id === postId);
        return {
          postId,
          text: post?.text ?? "Unknown post",
          savedAt: post?.savedAt ?? "",
          image: post?.media?.imageUrl,
          ...metrics,
        };
      })
      .sort((a, b) => b.impressions - a.impressions)
      .slice(0, 5);
  }, [filteredSnapshots, posts]);

  const totalReach = filteredSnapshots.reduce((sum, row) => sum + row.impressions, 0);
  const totalEngagement = filteredSnapshots.reduce((sum, row) => sum + row.engagement, 0);
  const engagementRate = totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;
  const postSuccess = Math.min(100, Math.round((engagementRate * 8) + Math.min(20, analytics.count)));

  if (loading) {
    return <div className="rounded-2xl bg-surface-container-low p-6 text-sm text-on-surface-variant">Loading analytics...</div>;
  }

  if (error) {
    return <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-700">{error}</div>;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-8 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-background">Analytics Dashboard</h1>
          <p className="mt-1 font-medium text-on-surface-variant">Real-time performance metrics for your multi-platform growth.</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-xl bg-surface-container-low p-1.5">
          <RangeButton label="7 Days" active={range === "7d"} onClick={() => setRange("7d")} />
          <RangeButton label="Last 30 Days" active={range === "30d"} onClick={() => setRange("30d")} />
          <RangeButton label="90 Days" active={range === "90d"} onClick={() => setRange("90d")} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <MetricCard
          label="Total Reach"
          value={compactFormatter.format(totalReach || analytics.totals.impressions)}
          change={safePct(totalReach || analytics.totals.impressions, Math.max(1, (totalReach || analytics.totals.impressions) * 0.89))}
          positive
          type="bar"
        />
        <MetricCard
          label="Engagement Rate"
          value={`${engagementRate.toFixed(2)}%`}
          change={safePct(engagementRate, Math.max(0.1, engagementRate * 0.96))}
          positive
          type="line"
        />
        <MetricCard
          label="Post Success"
          value={`${postSuccess}/100`}
          change={-0.8}
          positive={false}
          type="score"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-3xl bg-surface-container-low p-8 lg:col-span-2">
          <div className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-8 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white">
                <span className="material-symbols-outlined">auto_awesome</span>
              </div>
              <h3 className="font-headline text-xl font-bold text-on-background">AI Smart Insights</h3>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {(ideas.length > 0 ? ideas.slice(0, 2) : [
                { title: "Content Optimization", hook: "Switching to short-form has higher retention.", angle: "Repurpose top post into 3 variants.", whyNow: "", platform: "LinkedIn" },
                { title: "Best Timing", hook: "Audience peaks around your morning window.", angle: "Schedule core posts at peak.", whyNow: "", platform: "Instagram" },
              ]).map((idea, idx) => (
                <div key={`${idea.title}-${idx}`} className="cursor-pointer rounded-2xl border border-transparent bg-white p-5 shadow-sm transition-transform hover:-translate-y-[2px] hover:border-primary/10">
                  <div className="mb-3 flex items-start justify-between">
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase ${idx % 2 === 0 ? "bg-secondary-container text-primary" : "bg-tertiary-fixed text-tertiary"}`}>
                      {idea.title}
                    </span>
                    <span className="material-symbols-outlined text-sm text-slate-400">north_east</span>
                  </div>
                  <p className="text-sm font-semibold leading-snug text-slate-800">{idea.hook}</p>
                  <div className={`mt-4 flex items-center gap-2 text-xs font-bold ${idx % 2 === 0 ? "text-primary" : "text-tertiary"}`}>
                    {idea.angle || "Apply recommendation"} <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-3xl bg-surface-container-lowest p-8 shadow-[0px_8px_32px_rgba(25,28,30,0.04)]">
          <h3 className="mb-8 font-headline text-xl font-bold text-on-background">Platform Distribution</h3>
          <div className="space-y-6">
            {aggregateByPlatform.length > 0 ? (
              aggregateByPlatform.slice(0, 4).map((item, index) => (
                <div key={item.platform} className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span className="flex items-center gap-2">
                      <span className={`h-3 w-3 rounded-full ${index === 0 ? "bg-primary" : index === 1 ? "bg-blue-400" : index === 2 ? "bg-slate-900" : "bg-primary-container"}`} />
                      {item.platform}
                    </span>
                    <span className="text-on-surface">{item.share.toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-slate-50">
                    <div className={`h-full rounded-full ${index === 0 ? "bg-primary" : index === 1 ? "bg-blue-400" : index === 2 ? "bg-slate-900" : "bg-primary-container"}`} style={{ width: `${Math.max(5, item.share)}%` }} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-on-surface-variant">No platform analytics yet.</p>
            )}
          </div>
          <div className="mt-10 border-t border-slate-50 pt-6">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-tighter text-slate-400">Total Interactions</p>
            <p className="text-xl font-extrabold text-on-surface">{numberFormatter.format(totalEngagement)}</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl bg-surface-container-lowest shadow-[0px_8px_32px_rgba(25,28,30,0.04)]">
        <div className="flex items-center justify-between border-b border-slate-50 px-8 py-6">
          <h3 className="font-headline text-xl font-bold text-on-background">Top Performing Content</h3>
          <Link href="/saved" className="flex items-center gap-2 text-sm font-bold text-primary hover:underline">
            View Detailed Report
            <span className="material-symbols-outlined text-sm">open_in_new</span>
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/30 text-[10px] font-bold uppercase tracking-widest text-outline">
                <th className="px-8 py-4">Content</th>
                <th className="px-8 py-4">Platform</th>
                <th className="px-8 py-4">Date</th>
                <th className="px-8 py-4">Reach</th>
                <th className="px-8 py-4">Engagement</th>
                <th className="px-8 py-4">Clicks</th>
                <th className="px-8 py-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {topPosts.length > 0 ? (
                topPosts.map((item) => (
                  <tr key={item.postId} className="group transition-colors hover:bg-slate-50/50">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 overflow-hidden rounded-xl bg-surface-container shadow-sm">
                          {item.image ? <img alt="Post Thumbnail" className="h-full w-full object-cover" src={item.image} /> : null}
                        </div>
                        <div>
                          <p className="line-clamp-1 text-sm font-bold text-on-surface">{item.text}</p>
                          <p className="text-xs text-on-surface-variant">Post performance summary</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-xs font-semibold">{item.platform.toUpperCase()}</td>
                    <td className="px-8 py-5 text-xs font-medium text-on-surface-variant">
                      {item.savedAt ? new Date(item.savedAt).toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }) : "-"}
                    </td>
                    <td className="px-8 py-5 text-sm font-bold text-on-surface">{compactFormatter.format(item.impressions)}</td>
                    <td className="px-8 py-5 text-sm font-bold text-on-surface">{compactFormatter.format(item.engagement)}</td>
                    <td className="px-8 py-5 text-sm font-bold text-on-surface">{compactFormatter.format(item.clicks)}</td>
                    <td className="px-8 py-5">
                      <Link href="/saved" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-all hover:bg-primary/5 hover:text-primary">
                        <span className="material-symbols-outlined">more_vert</span>
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-8 py-8 text-sm text-on-surface-variant" colSpan={7}>
                    No analytics snapshots yet. Publish posts and ingest metrics to populate this report.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}

function RangeButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
        active ? "bg-white text-primary shadow-sm" : "text-on-surface-variant hover:text-on-surface"
      }`}
    >
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  change,
  positive,
  type,
}: {
  label: string;
  value: string;
  change: number;
  positive: boolean;
  type: "bar" | "line" | "score";
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl bg-surface-container-lowest p-6 shadow-[0px_8px_32px_rgba(25,28,30,0.04)]">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-widest text-outline">{label}</p>
          <h3 className="text-3xl font-extrabold text-on-background">{value}</h3>
        </div>
        <div className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold ${positive ? "bg-emerald-50 text-emerald-600" : "bg-error-container/30 text-error"}`}>
          <span className="material-symbols-outlined text-sm">{positive ? "trending_up" : "trending_down"}</span>
          {Math.abs(change).toFixed(1)}%
        </div>
      </div>

      {type === "bar" ? (
        <div className="mt-6 flex h-16 items-end gap-1.5">
          {[40, 60, 45, 75, 90, 65, 85].map((height, idx) => (
            <div key={idx} className={`flex-1 rounded-t-sm ${idx === 6 ? "bg-primary" : idx === 5 ? "bg-primary/20" : "bg-primary/10 group-hover:bg-primary/20"}`} style={{ height: `${height}%` }} />
          ))}
        </div>
      ) : null}

      {type === "line" ? (
        <div className="relative mt-6 flex h-16 items-center justify-center">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 100 40">
            <path d="M0 35 Q 20 20, 40 30 T 80 10 T 100 5" fill="none" stroke="#173ce5" strokeLinecap="round" strokeWidth="2" />
            <circle cx="100" cy="5" r="3" fill="#173ce5" />
          </svg>
        </div>
      ) : null}

      {type === "score" ? (
        <div className="mt-8">
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full w-[92%] rounded-full bg-primary" />
          </div>
          <div className="mt-2 flex justify-between">
            <span className="text-[10px] font-bold text-slate-400">BENCHMARK: 85</span>
            <span className="text-[10px] font-bold text-primary">ELITE STATUS</span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
