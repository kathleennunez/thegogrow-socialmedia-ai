"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppUser } from "@/components/UserProvider";
import { useToast } from "@/components/ToastProvider";
import type { Post } from "@/types";

type Stage = "idea" | "brief" | "drafts" | "schedule";

type Brief = {
  goal: "educate" | "promote" | "announce" | "engage";
  audience: string;
  platforms: string[];
  postCount: number;
  style: {
    tone: string;
    length: "short" | "medium" | "long";
    ctaStrength: "soft" | "balanced" | "strong";
    emoji: "none" | "low" | "high";
    hashtags: number;
  };
};

type CampaignCard = {
  id: string;
  platform: string;
  purpose: string;
  angle: string;
  text: string;
  imageIdea: string;
  mediaUrl?: string;
  sourcePost: Post;
};

type ConnectedAccount = {
  id: string;
  platform: string;
  status: "connected" | "disconnected" | "error";
  handle: string;
};

type CardScheduleInput = {
  date: string;
  time: string;
};

type DashboardIdea = {
  title: string;
  hook: string;
  angle: string;
  whyNow: string;
  platform: string;
};

type TrendSignalLink = {
  title: string;
  url: string;
  source?: string;
};

const STAGES: Array<{ key: Stage; label: string }> = [
  { key: "idea", label: "Idea" },
  { key: "brief", label: "Brief" },
  { key: "drafts", label: "Drafts" },
  { key: "schedule", label: "Schedule" },
];

const PLATFORM_OPTIONS = [
  { key: "linkedin", label: "LinkedIn", generateValue: "LinkedIn" },
  { key: "instagram", label: "Instagram", generateValue: "Instagram" },
  { key: "x", label: "X", generateValue: "Twitter" },
  { key: "facebook", label: "Facebook", generateValue: "Facebook" },
  { key: "tiktok", label: "TikTok", generateValue: "TikTok" },
  { key: "youtube", label: "YouTube", generateValue: "YouTube" },
] as const;

const DEFAULT_BRIEF: Brief = {
  goal: "engage",
  audience: "Founders and marketing teams",
  platforms: ["linkedin", "instagram"],
  postCount: 3,
  style: {
    tone: "Professional",
    length: "medium",
    ctaStrength: "balanced",
    emoji: "low",
    hashtags: 5,
  },
};

const PURPOSE_FALLBACK = ["Awareness", "Authority", "Conversion", "Engagement"];

export default function HomePage() {
  const { user } = useAppUser();
  const toast = useToast();
  const [stage, setStage] = useState<Stage>("idea");
  const [idea, setIdea] = useState("");
  const [brief, setBrief] = useState<Brief>(DEFAULT_BRIEF);
  const [cards, setCards] = useState<CampaignCard[]>([]);
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [cardSchedules, setCardSchedules] = useState<Record<string, CardScheduleInput>>({});
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [customRefine, setCustomRefine] = useState("");
  const [selectedStylizer, setSelectedStylizer] = useState<string | null>(null);
  const [ideaBoard, setIdeaBoard] = useState<DashboardIdea[]>([]);
  const [trendSignalLinks, setTrendSignalLinks] = useState<TrendSignalLink[]>([]);
  const [isIdeaBoardLoading, setIsIdeaBoardLoading] = useState(false);
  const [ideaBoardError, setIdeaBoardError] = useState<string | null>(null);
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);
  const [activeDraftText, setActiveDraftText] = useState("");

  const selectedCards = useMemo(
    () => cards.filter((card) => selectedCardIds.includes(card.id)),
    [cards, selectedCardIds],
  );

  const currentStageIndex = STAGES.findIndex((item) => item.key === stage);

  const setNotice = (value: string, kind: "success" | "error" | "info" = "info") => {
    if (kind === "success") {
      toast.success(value);
      return;
    }
    if (kind === "error") {
      toast.error(value);
      return;
    }
    toast.info(value);
  };

  const previousStage = () => {
    if (currentStageIndex > 0) {
      setStage(STAGES[currentStageIndex - 1].key);
    }
  };

  const buildBrief = async (seedIdea?: unknown) => {
    const candidate = typeof seedIdea === "string" ? seedIdea : idea;
    const baseIdea = candidate.trim();
    if (!baseIdea) {
      setNotice("Add an idea first.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/generate/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea: baseIdea }),
      });
      const data = (await response.json()) as { brief?: Brief; error?: string };
      if (!response.ok || !data.brief) throw new Error(data.error ?? "Failed to build brief.");
      setBrief(data.brief);
      setStage("brief");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to build brief.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const generatePack = async () => {
    if (!user?.id) {
      setNotice("User session is not ready.", "error");
      return;
    }

    const selectedPlatforms = brief.platforms
      .map((key) => PLATFORM_OPTIONS.find((option) => option.key === key)?.generateValue)
      .filter(Boolean) as string[];

    if (!selectedPlatforms.length) {
      setNotice("Choose at least one platform.", "error");
      return;
    }

    setIsLoading(true);
    try {
      const enrichedTopic = [
        `Campaign Idea: ${idea.trim()}`,
        `Goal: ${brief.goal}`,
        `Audience: ${brief.audience}`,
        `Target platforms: ${brief.platforms.join(", ")}`,
        `Requested post count: ${brief.postCount}`,
        `Tone: ${brief.style.tone}`,
        `Length: ${brief.style.length}`,
        `CTA strength: ${brief.style.ctaStrength}`,
        `Emoji usage: ${brief.style.emoji}`,
        `Hashtags target: ${brief.style.hashtags}`,
      ].join("\n");

      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: enrichedTopic,
          platforms: selectedPlatforms,
          userId: user.id,
          aiProviderOverride: "openrouter",
          skipMediaGeneration: false,
        }),
      });

      const data = (await response.json()) as { posts?: Post[]; error?: string };
      if (!response.ok || !data.posts?.length) throw new Error(data.error ?? "Failed to generate posts.");

      const trimmed = data.posts.slice(0, brief.postCount);
      const nextCards = trimmed.map((post, index): CampaignCard => {
        const planItem = {
          purpose: PURPOSE_FALLBACK[index % PURPOSE_FALLBACK.length],
          platform: brief.platforms[index % brief.platforms.length] ?? "linkedin",
          angle: "Audience-first value with a clear takeaway",
        };

        return {
          id: post.id,
          platform: post.platforms[0] ?? planItem.platform,
          purpose: planItem.purpose,
          angle: planItem.angle,
          text: post.text,
          imageIdea: post.imageIdea,
          mediaUrl: post.media?.imageUrl,
          sourcePost: post,
        };
      });

      setCards(nextCards);
      setSelectedCardIds(nextCards.map((card) => card.id));
      setStage("drafts");
      setNotice("Campaign pack generated.", "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to generate pack.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const refineCard = async (cardId: string, instruction: string) => {
    if (!user?.id) return;
    const card = cards.find((item) => item.id === cardId);
    if (!card) return;

    setIsLoading(true);
    try {
      const response = await fetch("/api/generate/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          platform: card.platform,
          text: card.text,
          imageIdea: card.imageIdea,
          instruction,
        }),
      });
      const data = (await response.json()) as { refined?: { text: string; imageIdea: string }; error?: string };
      if (!response.ok || !data.refined) throw new Error(data.error ?? "Failed to refine draft.");

      setCards((current) =>
        current.map((item) =>
          item.id === cardId
            ? {
                ...item,
                text: data.refined?.text ?? item.text,
                imageIdea: data.refined?.imageIdea ?? item.imageIdea,
              }
            : item,
        ),
      );
      setNotice("Draft refined.", "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to refine draft.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getRefineTargets = () => (selectedCards.length > 0 ? selectedCards : cards);

  const refineMultipleDrafts = async (instruction: string) => {
    if (!user?.id) return;
    const trimmedInstruction = instruction.trim();
    if (!trimmedInstruction) return;
    const targets = getRefineTargets();
    if (targets.length === 0) return;

    setIsLoading(true);
    try {
      const results = await Promise.all(
        targets.map(async (card) => {
          const response = await fetch("/api/generate/refine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userId: user.id,
              platform: card.platform,
              text: card.text,
              imageIdea: card.imageIdea,
              instruction: trimmedInstruction,
            }),
          });
          const data = (await response.json()) as { refined?: { text: string; imageIdea: string }; error?: string };
          if (!response.ok || !data.refined) {
            throw new Error(data.error ?? "Failed to refine drafts.");
          }
          return { id: card.id, refined: data.refined };
        }),
      );

      const updates = new Map(results.map((result) => [result.id, result.refined]));
      setCards((current) =>
        current.map((item) => {
          const refined = updates.get(item.id);
          if (!refined) return item;
          return {
            ...item,
            text: refined.text ?? item.text,
            imageIdea: refined.imageIdea ?? item.imageIdea,
          };
        }),
      );

      setNotice(`Refined ${results.length} draft${results.length === 1 ? "" : "s"}.`, "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to refine drafts.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAccountsAndGoSchedule = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const response = await fetch(`/api/social/accounts?userId=${encodeURIComponent(user.id)}`);
      const data = (await response.json()) as { accounts?: ConnectedAccount[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load accounts.");
      const accounts = data.accounts ?? [];
      setConnectedAccounts(accounts);
      setSelectedChannelIds(accounts.filter((item) => item.status === "connected").map((item) => item.id));
      const now = new Date();
      const oneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const defaultDate = oneHour.toISOString().slice(0, 10);
      const defaultTime = oneHour.toTimeString().slice(0, 5);
      setCardSchedules((current) => {
        const next = { ...current };
        for (const card of selectedCards) {
          if (!next[card.id]) {
            next[card.id] = { date: defaultDate, time: defaultTime };
          }
        }
        return next;
      });
      setStage("schedule");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to load accounts.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const loadConnectedAccounts = async () => {
    if (!user?.id) return;
    try {
      const response = await fetch(`/api/social/accounts?userId=${encodeURIComponent(user.id)}`);
      const data = (await response.json()) as { accounts?: ConnectedAccount[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Failed to load accounts.");
      const accounts = data.accounts ?? [];
      setConnectedAccounts(accounts);
      setSelectedChannelIds(accounts.filter((item) => item.status === "connected").map((item) => item.id));
    } catch {
      setConnectedAccounts([]);
    }
  };

  const connectLinkedIn = async () => {
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/social/connect?platform=linkedin&userId=${encodeURIComponent(user.id)}`,
      );
      const data = (await response.json()) as { oauth?: { authorizeUrl?: string }; error?: string };
      if (!response.ok || !data.oauth?.authorizeUrl) {
        throw new Error(data.error ?? "Failed to prepare LinkedIn connect.");
      }
      window.location.href = data.oauth.authorizeUrl;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to connect LinkedIn.", "error");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stageParam = params.get("stage");
    const connected = params.get("social_connected");
    const socialError = params.get("social_error");

    if (stageParam === "schedule") {
      setStage("schedule");
      void loadConnectedAccounts();
    }
    if (connected === "1") {
      setNotice("LinkedIn connected.", "success");
    }
    if (socialError) {
      setNotice(`LinkedIn connect failed: ${socialError}`, "error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const refreshIdeaBoard = async () => {
    if (!user?.id || stage !== "idea") return;
    setIsIdeaBoardLoading(true);
    setIdeaBoardError(null);
    try {
      const response = await fetch("/api/dashboard/ideas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      });
      const payload = (await response.json()) as {
        ideas?: DashboardIdea[];
        trendSignals?: string[];
        trendSignalLinks?: TrendSignalLink[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load AI post ideas.");
      }
      setIdeaBoard(payload.ideas ?? []);
      setTrendSignalLinks(payload.trendSignalLinks ?? []);
    } catch (error) {
      setIdeaBoardError(error instanceof Error ? error.message : "Failed to load AI post ideas.");
    } finally {
      setIsIdeaBoardLoading(false);
    }
  };

  useEffect(() => {
    void refreshIdeaBoard();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, user?.id]);

  const scheduleSelected = async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const selectedPlatforms = connectedAccounts
        .filter((account) => selectedChannelIds.includes(account.id) && account.status === "connected")
        .map((account) => account.platform.toLowerCase());
      if (selectedPlatforms.length === 0) {
        throw new Error("Select at least one connected channel.");
      }

      for (const card of selectedCards) {
        const entry = cardSchedules[card.id];
        const date = entry?.date;
        const time = entry?.time;
        if (!date || !time) {
          throw new Error("Each selected post must have its own date and time.");
        }
        const scheduledForUtc = new Date(`${date}T${time}:00`).toISOString();

        await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card.sourcePost),
        });

        const publishPlatforms = Array.from(
          new Set(
            selectedPlatforms
              .map((platform) => {
                const platformKey = PLATFORM_OPTIONS.find(
                  (option) =>
                    option.key.toLowerCase() === platform || option.generateValue.toLowerCase() === platform,
                )?.key;
                if (!platformKey) return null;
                if (platformKey === "facebook" || platformKey === "instagram") return "meta";
                if (["linkedin", "x", "meta", "pinterest", "youtube", "tiktok"].includes(platformKey)) {
                  return platformKey;
                }
                return null;
              })
              .filter(Boolean) as string[],
          ),
        );
        if (publishPlatforms.length === 0) {
          throw new Error("Selected channels are not supported for scheduling yet.");
        }

        const scheduleResponse = await fetch("/api/schedules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: user.id,
            postId: card.sourcePost.id,
            platforms: publishPlatforms,
            scheduledForUtc,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        });

        if (!scheduleResponse.ok) {
          const payload = (await scheduleResponse.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "One or more posts failed to schedule.");
        }
      }

      setNotice("Selected posts scheduled.", "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to schedule selected posts.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const saveSelectedDrafts = async () => {
    if (!user?.id) {
      setNotice("User session is not ready.", "error");
      return;
    }
    const targets = selectedCards.length > 0 ? selectedCards : cards;
    if (targets.length === 0) {
      setNotice("No drafts to save.", "error");
      return;
    }

    setIsLoading(true);
    try {
      for (const card of targets) {
        const response = await fetch("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(card.sourcePost),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as { error?: string } | null;
          throw new Error(payload?.error ?? "Failed to save one of the drafts.");
        }
      }
      setNotice(`Saved ${targets.length} draft${targets.length === 1 ? "" : "s"} to Saved Drafts.`, "success");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Failed to save drafts.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setBrief((current) => ({
      ...current,
      platforms: current.platforms.includes(platform)
        ? current.platforms.filter((item) => item !== platform)
        : [...current.platforms, platform],
    }));
  };

  const toggleConnectedChannel = (accountId: string) => {
    setSelectedChannelIds((current) =>
      current.includes(accountId) ? current.filter((id) => id !== accountId) : [...current, accountId],
    );
  };

  const toggleSelectCard = (cardId: string) => {
    setSelectedCardIds((current) =>
      current.includes(cardId) ? current.filter((id) => id !== cardId) : [...current, cardId],
    );
  };

  const activeDraftCard = useMemo(
    () => cards.find((card) => card.id === activeDraftId) ?? null,
    [activeDraftId, cards],
  );

  const openDraftPreview = (card: CampaignCard) => {
    setActiveDraftId(card.id);
    setActiveDraftText(card.text);
  };

  const saveDraftPreview = () => {
    if (!activeDraftCard) return;
    const trimmed = activeDraftText.trim();
    if (!trimmed) {
      setNotice("Draft text cannot be empty.", "error");
      return;
    }
    setCards((current) =>
      current.map((card) => (card.id === activeDraftCard.id ? { ...card, text: trimmed } : card)),
    );
    setNotice("Draft updated.", "success");
  };

  const copyDraftPreview = async () => {
    const trimmed = activeDraftText.trim();
    if (!trimmed) {
      setNotice("Nothing to copy.", "error");
      return;
    }
    try {
      await navigator.clipboard.writeText(trimmed);
      setNotice("Draft copied.", "success");
    } catch {
      setNotice("Unable to copy draft.", "error");
    }
  };

  const downloadDraftImage = async () => {
    const imageUrl = activeDraftCard?.mediaUrl?.trim();
    if (!imageUrl) {
      setNotice("No image available to download.", "error");
      return;
    }
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Image request failed (${response.status})`);
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const ext = blob.type.includes("png") ? "png" : blob.type.includes("webp") ? "webp" : "jpg";
      anchor.href = objectUrl;
      anchor.download = `draft-${activeDraftCard?.id || "image"}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setNotice("Image download started.", "success");
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      setNotice("Opened image in a new tab.", "info");
    }
  };

  const applyIdeaToComposer = (ideaItem: DashboardIdea) => {
    const composed = [ideaItem.title, ideaItem.hook, `Angle: ${ideaItem.angle}`, `Why now: ${ideaItem.whyNow}`]
      .filter(Boolean)
      .join("\n");
    setIdea(composed);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setNotice("Idea applied to composer.", "success");
  };

  const buildBriefFromIdea = async (ideaItem: DashboardIdea) => {
    const composed = [ideaItem.title, ideaItem.hook, `Angle: ${ideaItem.angle}`, `Why now: ${ideaItem.whyNow}`]
      .filter(Boolean)
      .join("\n");
    setIdea(composed);
    await buildBrief(composed);
  };

  return (
    <div className="mx-auto w-full max-w-7xl pb-28">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
          AI Studio
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">Campaign Pack Studio</p>
      </header>

      <section className="mb-8 px-2">
        <div className="flex items-center justify-between gap-2">
          {STAGES.map((item, index) => {
            const isActive = item.key === stage;
            const isPassed = index < currentStageIndex;
            return (
              <div key={item.key} className="flex flex-1 items-center">
                <button
                  type="button"
                  onClick={() => setStage(item.key)}
                  className="group flex flex-col items-center gap-2"
                >
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold transition ${
                      isActive || isPassed
                        ? "bg-primary text-white shadow-[0_8px_18px_rgba(23,60,229,0.28)]"
                        : "bg-surface-container text-on-surface-variant"
                    }`}
                  >
                    {index + 1}
                  </div>
                  <span
                    className={`text-xs font-semibold ${
                      isActive ? "text-primary" : "text-on-surface-variant"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
                {index < STAGES.length - 1 ? (
                  <div
                    className={`mx-3 h-[2px] flex-1 ${
                      index < currentStageIndex ? "bg-primary/30" : "bg-surface-container"
                    }`}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-10">
        <section className="xl:col-span-7">
          {stage === "idea" ? (
            <div className="space-y-8">
              <div className="rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-8">
                <div className="max-w-3xl">
                  <h2 className="font-headline text-3xl font-extrabold tracking-tight">Start with one idea</h2>
                  <p className="mt-2 text-on-surface-variant">
                    Our AI will transform your concept into a structured campaign ready for distribution.
                  </p>
                  <label className="mt-6 block text-xs font-bold uppercase tracking-[0.16em] text-primary">
                    Campaign Catalyst
                  </label>
                  <textarea
                    value={idea}
                    onChange={(event) => setIdea(event.target.value)}
                    placeholder="What are you promoting or talking about this week?"
                    rows={6}
                    className="mt-3 w-full rounded-xl border-none bg-surface-container-low p-5 text-base leading-7 text-on-surface placeholder:text-on-surface-variant/50"
                  />
                  <div className="mt-5 flex items-center justify-end gap-4">
                    <button
                      type="button"
                      onClick={() => void buildBrief()}
                      disabled={isLoading}
                      className="rounded-lg bg-gradient-to-r from-primary to-primary-container px-7 py-3 text-sm font-bold text-white shadow-[0_12px_24px_rgba(23,60,229,0.24)]"
                    >
                      {isLoading ? "Building..." : "Build Brief"}
                    </button>
                  </div>
                </div>
              </div>

            </div>
          ) : null}

          {stage === "brief" ? (
            <div className="space-y-8">
              <section>
                <h2 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">
                  Define Your Creative North Star
                </h2>
                <p className="mt-2 max-w-2xl leading-relaxed text-on-surface-variant">
                  Translate abstract ideas into a structured strategic brief. AI will use these parameters
                  to curate your campaign intelligence.
                </p>
              </section>

              <div className="space-y-8 studio-card p-8">
                <div>
                  <label className="mb-3 ml-1 block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                    Primary Campaign Goal
                  </label>
                  <div className="relative">
                    <select
                      value={brief.goal}
                      onChange={(event) => setBrief({ ...brief, goal: event.target.value as Brief["goal"] })}
                      className="h-14 w-full appearance-none rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-5 text-[15px] font-semibold text-on-surface"
                    >
                      <option value="engage">Increase Community Engagement</option>
                      <option value="promote">Drive Direct Sales/Conversions</option>
                      <option value="announce">Brand Awareness & Reach</option>
                      <option value="educate">Lead Generation</option>
                    </select>
                    <span className="material-symbols-outlined pointer-events-none absolute right-4 top-4 text-on-surface-variant">
                      expand_more
                    </span>
                  </div>
                </div>

                <div>
                  <label className="mb-3 ml-1 block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                    Target Audience Profile
                  </label>
                  <input
                    value={brief.audience}
                    onChange={(event) => setBrief({ ...brief, audience: event.target.value })}
                    className="h-14 w-full rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-5 text-[15px] font-medium text-on-surface"
                    placeholder="Tech-savvy urban millennials interested in sustainable living"
                  />
                </div>

                <div>
                  <label className="mb-3 ml-1 block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                    Target Platforms
                  </label>
                  <div className="flex flex-wrap gap-3">
                    {PLATFORM_OPTIONS.map((platform) => {
                      const active = brief.platforms.includes(platform.key);
                      return (
                        <button
                          key={platform.key}
                          type="button"
                          onClick={() => togglePlatform(platform.key)}
                          className={`rounded-full border px-5 py-2.5 text-sm font-semibold transition ${
                            active
                              ? "border-primary bg-primary text-white shadow-[0_6px_16px_rgba(23,60,229,0.18)]"
                              : "border-outline-variant/30 bg-surface-container-lowest text-on-surface-variant hover:border-primary/50"
                          }`}
                        >
                          {active ? (
                            <span className="mr-2 align-middle material-symbols-outlined text-[16px]">check_circle</span>
                          ) : null}
                          {platform.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid gap-8 md:grid-cols-2">
                  <div>
                    <label className="mb-3 ml-1 block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                      Post Frequency
                    </label>
                    <div className="inline-flex items-center gap-4 rounded-xl bg-surface-container-lowest p-2">
                      <button
                        type="button"
                        onClick={() =>
                          setBrief((current) => ({ ...current, postCount: Math.max(1, current.postCount - 1) }))
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined">remove</span>
                      </button>
                      <span className="px-4 font-headline text-xl font-bold">{brief.postCount}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setBrief((current) => ({ ...current, postCount: Math.min(12, current.postCount + 1) }))
                        }
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-primary hover:bg-surface-container"
                      >
                        <span className="material-symbols-outlined">add</span>
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-on-surface-variant/70">Posts per campaign cycle</p>
                  </div>
                  <div>
                    <label className="mb-3 ml-1 block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                      Content Length
                    </label>
                    <div className="inline-flex rounded-xl bg-surface-container-high p-1">
                      {(["short", "medium", "long"] as const).map((lengthKey) => {
                        const active = brief.style.length === lengthKey;
                        const label = lengthKey === "short" ? "S" : lengthKey === "medium" ? "M" : "L";
                        return (
                          <button
                            key={lengthKey}
                            type="button"
                            onClick={() =>
                              setBrief((current) => ({
                                ...current,
                                style: { ...current.style, length: lengthKey },
                              }))
                            }
                            className={`rounded-lg px-6 py-2.5 text-sm font-bold transition ${
                              active ? "bg-white text-primary shadow-sm" : "text-on-surface-variant"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="rounded-3xl border border-outline-variant/10 bg-surface-container-low p-7">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <label className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                      Hashtag Density
                    </label>
                    <span className="rounded-full bg-primary-container px-3 py-1 text-xs font-bold text-on-primary-container">
                      Recommended: {Math.min(100, Math.max(0, brief.style.hashtags * 10))}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={Math.min(100, Math.max(0, brief.style.hashtags * 10))}
                    onChange={(event) => {
                      const percent = Number(event.target.value);
                      setBrief((current) => ({
                        ...current,
                        style: { ...current.style, hashtags: Math.round(percent / 10) },
                      }));
                    }}
                    className="w-full accent-primary"
                  />
                  <div className="mt-3 flex justify-between text-[10px] font-bold uppercase tracking-tight text-on-surface-variant/50">
                    <span>Minimalist</span>
                    <span>Balanced</span>
                    <span>Maximalist</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-outline-variant/20 pt-8">
                <button
                  type="button"
                  onClick={previousStage}
                  className="flex items-center gap-2 px-2 py-2 font-bold text-on-surface-variant transition hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">arrow_back_ios</span>
                  Back to Idea
                </button>
                <button
                  type="button"
                  onClick={generatePack}
                  disabled={isLoading}
                  className="flex items-center gap-3 rounded-xl bg-gradient-to-r from-primary to-primary-container px-9 py-4 text-lg font-bold text-white shadow-[0_12px_24px_rgba(23,60,229,0.2)]"
                >
                  {isLoading ? (
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                  ) : null}
                  <span>{isLoading ? "Generating..." : "Generate Drafts"}</span>
                  <span className="material-symbols-outlined">auto_fix_high</span>
                </button>
              </div>
            </div>
          ) : null}

          {stage === "drafts" ? (
            <div className="space-y-6">
              <div className="mb-2">
                <div>
                  <h2 className="font-headline text-3xl font-bold tracking-tight text-on-surface">Campaign Drafts</h2>
                  <p className="mt-2 text-on-surface-variant">Iterate on AI-generated variations with one-click refinement.</p>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/10 px-4 py-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-primary">
                    <span className="material-symbols-outlined text-sm">auto_awesome</span>
                    {cards.length} Variations Ready
                  </span>
                  <button
                    type="button"
                    onClick={saveSelectedDrafts}
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-bold text-on-surface transition hover:border-primary/30 hover:bg-primary/5"
                  >
                    <span className="material-symbols-outlined text-[18px]">bookmark_add</span>
                    Save to Saved Drafts
                  </button>
                  <button
                    type="button"
                    onClick={loadAccountsAndGoSchedule}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container px-5 py-2.5 text-sm font-extrabold text-white shadow-[0_12px_24px_rgba(23,60,229,0.25)] transition hover:scale-[0.99] disabled:opacity-60"
                  >
                    {isLoading ? (
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/35 border-t-white" />
                    ) : (
                      <span className="material-symbols-outlined text-[18px]">event_available</span>
                    )}
                    Approve &amp; Schedule
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
              {cards.map((card) => (
                <article key={card.id} className="group rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-sm transition-all hover:-translate-y-[2px] hover:shadow-md">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <span className="rounded-full bg-surface-container-high px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                        {card.platform}
                      </span>
                      <p className="mt-2 text-xs font-semibold uppercase tracking-widest text-on-surface-variant">{card.purpose}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => openDraftPreview(card)}
                    className="w-full text-left"
                  >
                    <div className="mb-4 h-48 overflow-hidden rounded-xl bg-surface-container-high">
                      {card.mediaUrl ? (
                        <img src={card.mediaUrl} alt="Generated media" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">No media preview</div>
                      )}
                    </div>
                    <p className="line-clamp-3 text-sm leading-6 text-on-surface">{card.text}</p>
                  </button>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        toggleSelectCard(card.id);
                        const isSelected = selectedCardIds.includes(card.id);
                        setNotice(isSelected ? "Draft unselected." : "Draft selected.", "success");
                      }}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                        selectedCardIds.includes(card.id)
                          ? "bg-primary text-white"
                          : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-container"
                      }`}
                    >
                      {selectedCardIds.includes(card.id) ? "Unselect" : "Use"}
                    </button>
                    <button
                      type="button"
                      onClick={() => openDraftPreview(card)}
                      className="rounded-lg bg-surface-container px-3 py-2 text-xs font-semibold text-on-surface"
                    >
                      Full Preview
                    </button>
                    {["Remix", "Shorten", "Bolder"].map((label) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          void refineCard(
                            card.id,
                            label === "Remix"
                              ? "Remix this while preserving core meaning."
                              : label === "Shorten"
                                ? "Make this 30% shorter."
                                : "Make this bolder with a stronger hook.",
                          )
                        }
                        className="rounded-lg border border-outline-variant/30 px-3 py-2 text-xs font-semibold text-on-surface-variant hover:bg-surface-container"
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </article>
              ))}
              </div>
            </div>
          ) : null}

          {stage === "schedule" ? (
            <div className="space-y-8">
              <header className="mb-2">
                <h2 className="font-headline text-3xl font-extrabold tracking-tight">Campaign Queue</h2>
                <p className="mt-2 text-on-surface-variant">
                  Review and organize your approved creative assets before launch.
                </p>
              </header>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {selectedCards.length === 0 ? (
                  <div className="rounded-xl bg-surface-container-lowest p-6 text-sm text-on-surface-variant lg:col-span-2">
                    No selected drafts. Go back to Drafts and select at least one card.
                  </div>
                ) : (
                  selectedCards.map((card) => (
                    <article key={card.id} className="rounded-xl bg-surface-container-lowest p-6 transition-all hover:-translate-y-[2px]">
                      <div className="relative mb-4 h-56 w-full overflow-hidden rounded-lg">
                        {card.mediaUrl ? (
                          <img src={card.mediaUrl} alt={card.purpose} className="h-full w-full object-cover transition-transform duration-500 hover:scale-105" />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-surface-container-high text-sm text-on-surface-variant">
                            No media preview
                          </div>
                        )}
                        <div className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                          Approved
                        </div>
                      </div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-headline text-lg font-bold">{card.purpose}</h3>
                          <p className="text-xs uppercase tracking-widest text-on-surface-variant">{card.platform}</p>
                        </div>
                        <span className="material-symbols-outlined text-outline hover:text-primary">more_horiz</span>
                      </div>
                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-outline">Date</p>
                          <input
                            type="date"
                            value={cardSchedules[card.id]?.date ?? ""}
                            onChange={(event) =>
                              setCardSchedules((current) => ({
                                ...current,
                                [card.id]: {
                                  date: event.target.value,
                                  time: current[card.id]?.time ?? "",
                                },
                              }))
                            }
                            className="w-full rounded-lg bg-surface-container-low p-2 text-sm"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-[10px] font-semibold text-outline">Time</p>
                          <input
                            type="time"
                            value={cardSchedules[card.id]?.time ?? ""}
                            onChange={(event) =>
                              setCardSchedules((current) => ({
                                ...current,
                                [card.id]: {
                                  date: current[card.id]?.date ?? "",
                                  time: event.target.value,
                                },
                              }))
                            }
                            className="w-full rounded-lg bg-surface-container-low p-2 text-sm"
                          />
                        </div>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : null}
        </section>

        <aside className="xl:col-span-3">
          {stage === "brief" || stage === "idea" ? (
            <div className="sticky top-20 space-y-5">
              <div className="relative overflow-hidden rounded-3xl bg-white p-8 shadow-[0_22px_40px_rgba(15,23,42,0.12)]">
                <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
                <div className="mb-8 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary">
                    <span className="material-symbols-outlined text-lg">psychology</span>
                  </div>
                  <h3 className="font-headline text-lg font-extrabold">Campaign Memory</h3>
                </div>

                <div className="space-y-7">
                  <div>
                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                      Contextual Foundation
                    </h4>
                    <div className="rounded-2xl bg-surface-container-low p-4">
                      <p className="text-sm italic leading-relaxed text-on-surface">
                        &quot;{idea.trim() || "Add idea context to strengthen AI strategic memory."}&quot;
                      </p>
                    </div>
                  </div>

                  <div>
                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                      Active Constraints
                    </h4>
                    <ul className="space-y-4">
                      <li className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary text-lg">verified</span>
                        <div>
                          <p className="text-sm font-bold text-on-surface">Primary Goal</p>
                          <p className="text-xs text-on-surface-variant">{brief.goal}</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary text-lg">group</span>
                        <div>
                          <p className="text-sm font-bold text-on-surface">Audience</p>
                          <p className="text-xs text-on-surface-variant">{brief.audience}</p>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="material-symbols-outlined text-primary text-lg">palette</span>
                        <div>
                          <p className="text-sm font-bold text-on-surface">Style Profile</p>
                          <p className="text-xs text-on-surface-variant">
                            {brief.style.length.toUpperCase()} length · {brief.style.hashtags} hashtags
                          </p>
                        </div>
                      </li>
                    </ul>
                  </div>

                </div>
              </div>

              <div className="flex items-center gap-3 rounded-2xl bg-secondary-container/30 px-5 py-4">
                <span className="material-symbols-outlined text-secondary">tips_and_updates</span>
                <p className="text-xs leading-snug text-on-secondary-container">
                  <span className="font-bold">AI Insight:</span> Balanced hashtag density is currently strongest
                  for your selected campaign profile.
                </p>
              </div>
            </div>
          ) : stage === "drafts" ? (
            <div className="sticky top-20 space-y-6">
              <div className="rounded-2xl border border-outline-variant/10 bg-white/80 p-8 shadow-sm backdrop-blur">
                <div className="mb-6 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">magic_button</span>
                  <h3 className="font-headline text-lg font-bold text-on-surface">Refine Drafts</h3>
                </div>
                <p className="mb-4 text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">Quick Stylizer</p>
                <div className="mb-8 flex flex-wrap gap-2">
                  {["Add humor", "More professional", "Urgent CTA", "Storytelling mode", "Minimalist"].map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => {
                        setSelectedStylizer(option);
                        void refineMultipleDrafts(option);
                      }}
                      className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
                        selectedStylizer === option
                          ? "bg-primary text-white shadow-[0_8px_18px_rgba(23,60,229,0.28)]"
                          : "bg-surface-container text-on-surface-variant hover:bg-surface-container-high"
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
                <div className="space-y-3">
                  <label className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                    Custom Instructions
                  </label>
                  <textarea
                    value={customRefine}
                    onChange={(event) => setCustomRefine(event.target.value)}
                    className="min-h-[120px] w-full resize-none rounded-xl border-none bg-surface-container-low p-4 text-sm focus:ring-2 focus:ring-primary/20"
                    placeholder="Make it sound like a premium editorial voice..."
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (!customRefine.trim()) return;
                    void refineMultipleDrafts(customRefine);
                  }}
                  className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary to-primary-container py-4 text-sm font-bold text-white shadow-lg shadow-primary/20"
                >
                  Apply to all Drafts
                  <span className="material-symbols-outlined text-sm">auto_fix_high</span>
                </button>
              </div>

              <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-low p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10">
                    <span className="material-symbols-outlined text-lg text-primary">inventory_2</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-on-surface">Campaign Memory</p>
                    <p className="text-[10px] text-on-surface-variant">Synchronized with Brand Guide</p>
                  </div>
                </div>
                <p className="text-[12px] leading-relaxed text-on-surface-variant">
                  AI is currently prioritizing <span className="font-semibold italic text-on-surface">Minimalist Aesthetic</span> and{" "}
                  <span className="font-semibold italic text-on-surface">Tech-Forward Tone</span> based on your approved brief.
                </p>
              </div>
            </div>
          ) : stage === "schedule" ? (
            <div className="sticky top-24 h-fit rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 shadow-xl shadow-on-surface/5">
              <header className="mb-8 border-b border-outline-variant/20 pb-6">
                <h2 className="font-headline text-2xl font-extrabold tracking-tight">Schedule Posts</h2>
                <p className="text-xs text-on-surface-variant">Finalize deployment parameters</p>
              </header>

              <div className="space-y-8">
                <section>
                  <label className="mb-4 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
                    Target Channels
                  </label>
                  <div className="space-y-3">
                    {connectedAccounts.length > 0 ? (
                      connectedAccounts.map((account) => {
                        const selected = selectedChannelIds.includes(account.id);
                        return (
                          <button
                            key={account.id}
                            type="button"
                            onClick={() => toggleConnectedChannel(account.id)}
                            className={`flex w-full items-center justify-between rounded-xl p-3 transition-all ${
                              selected
                                ? "border border-primary/25 bg-primary/5"
                                : "bg-surface-container-low hover:border-primary/20"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-xs font-bold text-primary">
                                {account.platform.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-bold">{account.handle}</p>
                                <p className="text-[10px] text-on-surface-variant">{account.platform}</p>
                              </div>
                            </div>
                            <div className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${selected ? "border-primary bg-primary" : "border-outline-variant"}`}>
                              {selected ? <span className="material-symbols-outlined text-xs text-white">check</span> : null}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="rounded-xl bg-surface-container-low p-3 text-xs text-on-surface-variant">
                        No connected channels. Connect at least one account before launch.
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={connectLinkedIn}
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary/5 py-2 text-[11px] font-bold uppercase tracking-widest text-primary transition-colors hover:bg-primary/10 disabled:opacity-60"
                    >
                      <span className="material-symbols-outlined text-sm">add</span>
                      Connect LinkedIn
                    </button>
                  </div>
                </section>

                <section>
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-sm text-primary">public</span>
                      <span className="text-xs font-semibold">Timezone</span>
                    </div>
                    <span className="rounded bg-surface-container-high px-2 py-1 text-xs font-medium text-on-surface-variant">
                      {Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </span>
                  </div>
                </section>

                <section className="rounded-xl border border-tertiary/10 bg-tertiary/5 p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-lg text-tertiary">bolt</span>
                      <h4 className="text-sm font-bold text-tertiary">AI Peak Engagement</h4>
                    </div>
                    <div className="relative h-5 w-10 rounded-full bg-tertiary">
                      <div className="absolute right-1 top-1 h-3 w-3 rounded-full bg-white" />
                    </div>
                  </div>
                  <p className="text-[11px] leading-relaxed text-tertiary/80">
                    Let AI adjust exact posting minutes based on historical audience activity.
                  </p>
                </section>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={scheduleSelected}
                    disabled={isLoading || selectedCards.length === 0}
                    className="flex w-full items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-primary to-primary-container py-4 font-headline text-lg font-bold text-white shadow-lg shadow-primary/20 disabled:opacity-60"
                  >
                    {isLoading ? "Scheduling..." : "Launch Campaign"}
                    <span className="material-symbols-outlined">rocket_launch</span>
                  </button>
                  <p className="mt-4 text-center text-[10px] uppercase tracking-tight text-outline">
                    Ready for deployment
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="sticky top-20 rounded-xl border border-outline-variant/15 bg-surface-container-lowest p-6">
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-headline text-xl font-bold">Campaign Memory</h3>
                <span className="material-symbols-outlined text-on-surface-variant/50">info</span>
              </div>

              <div className="space-y-5">
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/60">
                    Primary Goal
                  </p>
                  <div className="rounded-lg border border-secondary-container/50 bg-secondary-container/35 px-3 py-2 text-sm font-semibold text-on-secondary-container">
                    {brief.goal}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-on-surface-variant/60">
                    Audience Segment
                  </p>
                  <p className="text-sm font-medium text-on-surface">{brief.audience}</p>
                </div>

                <StatRow icon="lan" label="Platforms" value={brief.platforms.join(", ") || "none"} />
                <StatRow icon="article" label="Post count" value={`${brief.postCount} posts`} />
                <StatRow icon="format_align_left" label="Length" value={brief.style.length} />
                <StatRow icon="translate" label="Tone" value={brief.style.tone} />
              </div>

              <button
                type="button"
                onClick={() => setStage("brief")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold text-primary hover:bg-primary/5"
              >
                Edit Preferences
                <span className="material-symbols-outlined text-[16px]">edit</span>
              </button>
            </div>
          )}
        </aside>
      </div>

      {stage === "idea" ? (
        <section className="mt-10 space-y-6">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="font-headline text-3xl font-extrabold tracking-tight text-on-surface">AI Post Creation Ideas</h3>
              <p className="mt-1 text-on-surface-variant">Generated from your brand profile, saved drafts, and trend/news signals.</p>
            </div>
            <button
              type="button"
              onClick={() => void refreshIdeaBoard()}
              disabled={isIdeaBoardLoading}
              className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 text-xs font-bold uppercase tracking-[0.12em] text-on-surface-variant hover:bg-surface-container-high disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[16px]">refresh</span>
              {isIdeaBoardLoading ? "Refreshing..." : "Refresh Ideas"}
            </button>
          </div>

          {ideaBoardError ? (
            <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-700">{ideaBoardError}</div>
          ) : null}

          {isIdeaBoardLoading ? (
            <div className="rounded-xl bg-surface-container-low p-4 text-sm text-on-surface-variant">Generating ideas...</div>
          ) : null}

          {!isIdeaBoardLoading && !ideaBoardError ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {ideaBoard.slice(0, 4).map((ideaItem, index) => (
                <article
                  key={`${ideaItem.title}-${index}`}
                  onClick={() => applyIdeaToComposer(ideaItem)}
                  className={`rounded-2xl border p-8 shadow-sm ${
                    index === 1
                      ? "border-primary/10 bg-primary text-white lg:col-span-4"
                      : index === 2
                        ? "border-outline-variant/10 bg-surface-container-low lg:col-span-4"
                        : "border-outline-variant/10 bg-surface-container-lowest lg:col-span-8"
                  } cursor-pointer flex h-full flex-col`}
                >
                  <div className="mb-4 flex items-start justify-between">
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${
                        index === 1 ? "bg-white/20 text-white" : "bg-secondary-container text-on-secondary-container"
                      }`}
                    >
                      {ideaItem.platform || "SOCIAL"}
                    </span>
                    <span className={index === 1 ? "text-white/70" : "text-outline"}>Idea #{index + 1}</span>
                  </div>
                  <h4 className={`font-headline text-2xl font-bold ${index === 1 ? "text-white" : "text-on-surface"}`}>{ideaItem.title}</h4>
                  <p className={`mt-4 text-sm ${index === 1 ? "text-white" : "text-on-surface"}`}>{ideaItem.hook}</p>
                  <p className={`mt-3 text-xs ${index === 1 ? "text-white/85" : "text-on-surface-variant"}`}>{ideaItem.angle}</p>
                  <p className={`mt-2 text-xs ${index === 1 ? "text-white/85" : "text-on-surface-variant"}`}>{ideaItem.whyNow}</p>
                  <div className="mt-auto pt-6 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        applyIdeaToComposer(ideaItem);
                      }}
                      className={`rounded-lg px-4 py-2 text-xs font-bold ${
                        index === 1 ? "bg-white text-primary" : "bg-primary text-white"
                      }`}
                    >
                      Use Idea
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void buildBriefFromIdea(ideaItem);
                      }}
                      className={`rounded-lg px-4 py-2 text-xs font-bold ${
                        index === 1
                          ? "border border-white/40 text-white"
                          : "border border-outline-variant/30 text-on-surface-variant"
                      }`}
                    >
                      Build Brief
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <section className="rounded-2xl bg-surface-container-low p-6">
            <div className="mb-4 flex items-center justify-between">
              <h4 className="flex items-center gap-3 font-headline text-2xl font-bold">
                <span className="material-symbols-outlined text-primary">sensors</span>
                Trend Signals Used
              </h4>
            </div>
            {trendSignalLinks.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                {trendSignalLinks.slice(0, 4).map((signal, index) => (
                  <a
                    key={`${signal.url}-${index}`}
                    href={signal.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group rounded-xl bg-surface-container-lowest p-5 transition hover:bg-surface-container-high"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant">Signal {index + 1}</p>
                    <p className="mt-2 text-sm font-semibold text-on-surface group-hover:text-primary">{signal.title}</p>
                    <p className="mt-1 text-xs text-on-surface-variant">
                      {signal.source ?? "news.google.com"}
                    </p>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant">No live signals available yet.</p>
            )}
          </section>
        </section>
      ) : null}

      {activeDraftCard ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-4xl rounded-3xl border border-outline-variant/30 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-primary-fixed">
                {activeDraftCard.platform}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveDraftId(null);
                  setActiveDraftText("");
                }}
                className="rounded-lg bg-surface-container px-3 py-1.5 text-sm text-on-surface"
              >
                Close
              </button>
            </div>

            {activeDraftCard.mediaUrl ? (
              <div className="mb-4 h-80 w-full overflow-hidden rounded-2xl bg-surface-container-low">
                <img src={activeDraftCard.mediaUrl} alt={activeDraftCard.purpose} className="h-full w-full object-contain" />
              </div>
            ) : (
              <div className="mb-4 flex h-48 items-center justify-center rounded-2xl bg-surface-container-low text-sm text-on-surface-variant">
                No image generated
              </div>
            )}

            <label className="block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
              Draft Content
            </label>
            <textarea
              value={activeDraftText}
              onChange={(event) => setActiveDraftText(event.target.value)}
              rows={7}
              className="mt-2 w-full rounded-2xl border-none bg-surface-container px-4 py-3 text-sm leading-7 text-on-surface focus:ring-1 focus:ring-primary/40"
            />

            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={copyDraftPreview}
                className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Copy
              </button>
              {activeDraftCard.mediaUrl ? (
                <button
                  type="button"
                  onClick={downloadDraftImage}
                  className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Image
                </button>
              ) : null}
              <button
                type="button"
                onClick={saveDraftPreview}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-surface-container pb-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-on-surface-variant">{icon}</span>
        <span className="text-sm text-on-surface-variant">{label}</span>
      </div>
      <span className="text-sm font-bold text-on-surface">{value}</span>
    </div>
  );
}
