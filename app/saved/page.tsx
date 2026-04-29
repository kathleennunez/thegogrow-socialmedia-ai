"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppUser } from "@/components/UserProvider";
import type { Post } from "@/types";

type SavedCardItem = {
  id: string;
  platform: string;
  image?: string;
  title: string;
  date: string;
  savedAtMs: number;
};
type ConnectedAccount = {
  id: string;
  platform: string;
  status: "connected" | "disconnected" | "error";
  handle: string;
};

const platformFilters = ["All Posts", "LinkedIn", "Twitter", "Instagram", "TikTok"];
const itemsPerPage = 6;

export default function SavedPage() {
  const { user, isReady } = useAppUser();
  const [posts, setPosts] = useState<Post[]>([]);
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>({});
  const [selectedPlatform, setSelectedPlatform] = useState("All Posts");
  const [sortMode, setSortMode] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [activeCard, setActiveCard] = useState<SavedCardItem | null>(null);
  const [activeDraftText, setActiveDraftText] = useState("");
  const [isImageViewerOpen, setIsImageViewerOpen] = useState(false);
  const [imageZoom, setImageZoom] = useState(1);
  const [toastMessage, setToastMessage] = useState("");
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [scheduleDraftId, setScheduleDraftId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(""), 2200);
  };

  useEffect(() => {
    const loadPosts = async () => {
      if (!user?.id) {
        setPosts([]);
        return;
      }
      setPosts([]);
      const response = await fetch(`/api/posts?userId=${encodeURIComponent(user.id)}`);
      const data = (await response.json()) as { posts?: Post[] };
      setPosts(data.posts ?? []);
    };
    if (isReady) void loadPosts();
  }, [isReady, user?.id]);

  useEffect(() => {
    const loadAccounts = async () => {
      if (!user?.id) return;
      try {
        const response = await fetch(`/api/social/accounts?userId=${encodeURIComponent(user.id)}`);
        const payload = (await response.json()) as { accounts?: ConnectedAccount[] };
        if (response.ok) {
          setConnectedAccounts(payload.accounts ?? []);
        }
      } catch {
        setConnectedAccounts([]);
      }
    };
    if (isReady) void loadAccounts();
  }, [isReady, user?.id]);

  const baseCards = useMemo(
    () =>
      posts.map((post) => ({
        id: post.id,
        platform: (post.platforms[0] ?? "LINKEDIN").toUpperCase(),
        image: post.media?.imageUrl || "",
        title: post.text,
        date: new Date(post.savedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
        }),
        savedAtMs: new Date(post.savedAt).getTime(),
      })),
    [posts],
  );

  const cards = useMemo(
    () =>
      baseCards.map((card) => ({
        ...card,
        title: editedTitles[card.id] ?? card.title,
      })),
    [baseCards, editedTitles],
  );

  const visibleCards = useMemo(() => {
    const filtered =
      selectedPlatform === "All Posts"
        ? cards
        : cards.filter((card) => card.platform === selectedPlatform.toUpperCase());

    return [...filtered].sort((a, b) =>
      sortMode === "newest" ? b.savedAtMs - a.savedAtMs : a.savedAtMs - b.savedAtMs,
    );
  }, [cards, selectedPlatform, sortMode]);

  const totalPages = Math.max(1, Math.ceil(visibleCards.length / itemsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pagedCards = visibleCards.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const pageButtons = useMemo(() => {
    const candidates = [1, 2, 3, totalPages].filter((value) => value <= totalPages);
    return Array.from(new Set(candidates));
  }, [totalPages]);

  const openCard = (card: SavedCardItem) => {
    setActiveCard(card);
    setActiveDraftText(card.title);
    setIsImageViewerOpen(false);
    setImageZoom(1);
  };

  const handleDeleteDraft = async (cardId: string) => {
    if (!user?.id) {
      showToast("User session not ready.");
      return;
    }

    try {
      const response = await fetch("/api/posts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, postId: cardId }),
      });

      const data = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(data?.error ?? "Failed to delete draft.");
      }

      setPosts((current) => current.filter((post) => post.id !== cardId));
      setEditedTitles((current) => {
        const next = { ...current };
        delete next[cardId];
        return next;
      });

      if (activeCard?.id === cardId) {
        setActiveCard(null);
        setActiveDraftText("");
      }

      showToast("Draft deleted.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete draft.";
      showToast(message);
    }
  };

  const saveActiveDraft = () => {
    if (!activeCard) return;
    const nextText = activeDraftText.trim();
    if (!nextText) {
      showToast("Draft text cannot be empty.");
      return;
    }

    setEditedTitles((current) => ({ ...current, [activeCard.id]: nextText }));
    setActiveCard((current) => (current ? { ...current, title: nextText } : null));
    showToast("Draft updated.");
  };

  const copyActiveDraft = async () => {
    const nextText = activeDraftText.trim();
    if (!nextText) {
      showToast("Nothing to copy.");
      return;
    }

    try {
      await navigator.clipboard.writeText(nextText);
      showToast("Draft copied.");
    } catch {
      showToast("Unable to copy draft.");
    }
  };

  const downloadActiveImage = async () => {
    const imageUrl = activeCard?.image?.trim();
    if (!imageUrl) {
      showToast("No image available to download.");
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
      anchor.download = `${activeCard?.platform?.toLowerCase() || "draft"}-${activeCard?.id || "image"}.${ext}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      showToast("Image download started.");
    } catch {
      window.open(imageUrl, "_blank", "noopener,noreferrer");
      showToast("Opened image in a new tab.");
    }
  };

  const scheduleDraft = async () => {
    if (!user?.id || !scheduleDraftId) return;
    if (!scheduleDate || !scheduleTime) {
      showToast("Choose date and time.");
      return;
    }

    const post = posts.find((item) => item.id === scheduleDraftId);
    if (!post) {
      showToast("Draft not found.");
      return;
    }

    const platformRaw = (post.platforms[0] ?? "").toLowerCase();
    const platform =
      platformRaw.includes("linkedin")
        ? "linkedin"
        : platformRaw.includes("twitter") || platformRaw === "x"
          ? "x"
          : platformRaw.includes("facebook") || platformRaw.includes("instagram")
            ? "meta"
            : "linkedin";

    const hasConnected = connectedAccounts.some((account) => account.status === "connected");
    if (!hasConnected) {
      showToast("No connected channels. Connect LinkedIn first.");
      return;
    }

    const scheduledForUtc = new Date(`${scheduleDate}T${scheduleTime}:00`).toISOString();
    try {
      const response = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          postId: scheduleDraftId,
          platforms: [platform],
          scheduledForUtc,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Failed to schedule draft.");
      showToast("Draft scheduled.");
      setScheduleDraftId(null);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to schedule draft.");
    }
  };

  return (
    <div className="studio-page">
      <header className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">
            Saved Drafts
          </h1>
          <p className="mt-1 max-w-3xl text-lg leading-9 text-on-surface-variant">
            Your curated library of high-performing AI generated posts and research fragments.
          </p>
        </div>
        <span className="rounded-lg bg-surface-container px-4 py-2 text-sm font-bold text-on-surface-variant">
          {visibleCards.length} Items
        </span>
      </header>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        {platformFilters.map((item) => {
          const isActive = selectedPlatform === item;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setSelectedPlatform(item);
                setPage(1);
              }}
              className={`rounded-[16px] px-8 py-3 text-base font-semibold ${
                isActive
                  ? "bg-[#0b1a76] text-white shadow"
                  : "bg-surface-container-lowest text-[#2f3b59]"
              }`}
            >
              {item}
            </button>
          );
        })}
        <div className="mx-2 h-10 w-px bg-outline-variant/40" />
        <button
          type="button"
          onClick={() => setSortMode((current) => (current === "newest" ? "oldest" : "newest"))}
          className="inline-flex items-center gap-2 rounded-2xl bg-surface-container-lowest p-3 text-[#2f3b59]"
        >
          <span className="material-symbols-outlined">filter_list</span>
          <span className="text-xs font-semibold uppercase tracking-wide">
            {sortMode === "newest" ? "Newest" : "Oldest"}
          </span>
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
        {pagedCards.slice(0, 3).map((card) => (
          <SavedCard
            key={card.id}
            card={card}
            onOpen={() => openCard(card)}
            onDelete={() => void handleDeleteDraft(card.id)}
            onSchedule={() => setScheduleDraftId(card.id)}
          />
        ))}

        {pagedCards.slice(3).map((card) => (
          <SavedCard
            key={card.id}
            card={card}
            onOpen={() => openCard(card)}
            onDelete={() => void handleDeleteDraft(card.id)}
            onSchedule={() => setScheduleDraftId(card.id)}
          />
        ))}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <p className="text-base text-on-surface-variant">
          Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, visibleCards.length)} of {visibleCards.length} saved drafts
        </p>
        <div className="flex items-center gap-2">
          {pageButtons.map((pageNumber) => (
            <button
              key={pageNumber}
              type="button"
              onClick={() => setPage(pageNumber)}
              className={`rounded-lg p-3 ${
                pageNumber === currentPage
                  ? "bg-surface-container text-on-surface-variant"
                  : "bg-surface-container-lowest text-on-surface-variant"
              }`}
            >
              {pageNumber}
            </button>
          ))}
        </div>
      </div>

      {activeCard ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-3xl border border-outline-variant/30 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <span className="rounded-full bg-primary-fixed px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-primary-fixed">
                {activeCard.platform}
              </span>
              <button
                type="button"
                onClick={() => {
                  setActiveCard(null);
                  setActiveDraftText("");
                }}
                className="rounded-lg bg-surface-container px-3 py-1.5 text-sm text-on-surface"
              >
                Close
              </button>
            </div>
            {activeCard.image ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsImageViewerOpen(true);
                  setImageZoom(1);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setIsImageViewerOpen(true);
                    setImageZoom(1);
                  }
                }}
                className="relative flex h-80 w-full cursor-zoom-in items-center justify-center rounded-2xl bg-surface-container-low"
              >
                <img src={activeCard.image} alt={activeCard.title} className="h-full w-full rounded-2xl object-contain" />
                <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/70 px-3 py-1 text-xs font-semibold text-white">
                  <span className="material-symbols-outlined text-[14px]">zoom_in</span>
                  Click to zoom
                </span>
              </div>
            ) : (
              <div className="flex h-52 w-full items-center justify-center rounded-2xl bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high">
                <span className="text-sm font-semibold text-on-surface-variant">No image generated</span>
              </div>
            )}
            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">
              Draft Content
            </label>
            <textarea
              value={activeDraftText}
              onChange={(event) => setActiveDraftText(event.target.value)}
              rows={6}
              className="mt-2 w-full rounded-2xl border-none bg-surface-container px-4 py-3 text-sm leading-7 text-on-surface focus:ring-1 focus:ring-primary/40"
            />
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleDeleteDraft(activeCard.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete Draft
              </button>
              <button
                type="button"
                onClick={copyActiveDraft}
                className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">content_copy</span>
                Copy
              </button>
              {activeCard.image ? (
                <button
                  type="button"
                  onClick={downloadActiveImage}
                  className="inline-flex items-center gap-2 rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  Download Image
                </button>
              ) : null}
              <button
                type="button"
                onClick={saveActiveDraft}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0b1a76] px-4 py-2 text-sm font-semibold text-white"
              >
                <span className="material-symbols-outlined text-[16px]">save</span>
                Save Draft
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {scheduleDraftId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="font-headline text-xl font-bold">Schedule Draft</h3>
            <p className="mt-1 text-sm text-on-surface-variant">Choose posting time for this saved draft.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <input
                type="date"
                value={scheduleDate}
                onChange={(event) => setScheduleDate(event.target.value)}
                className="rounded-lg bg-surface-container p-2"
              />
              <input
                type="time"
                value={scheduleTime}
                onChange={(event) => setScheduleTime(event.target.value)}
                className="rounded-lg bg-surface-container p-2"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setScheduleDraftId(null)} className="rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold">
                Cancel
              </button>
              <button type="button" onClick={() => void scheduleDraft()} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
                Schedule
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className="fixed bottom-6 right-6 rounded-xl bg-on-surface px-4 py-2 text-sm text-white shadow-xl">
          {toastMessage}
        </div>
      ) : null}

      {isImageViewerOpen && activeCard?.image ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 p-4">
          <div className="w-full max-w-6xl rounded-2xl border border-white/20 bg-[#121417] p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/75">
                {activeCard.platform} Image Preview
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setImageZoom((current) => Math.max(0.5, Number((current - 0.1).toFixed(2))))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                >
                  <span className="material-symbols-outlined text-[16px]">remove</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom(1)}
                  className="rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  {Math.round(imageZoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={() => setImageZoom((current) => Math.min(3, Number((current + 0.1).toFixed(2))))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white hover:bg-white/20"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsImageViewerOpen(false)}
                  className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="flex max-h-[78vh] min-h-[420px] items-center justify-center overflow-auto rounded-xl bg-black/60 p-4">
              <img
                src={activeCard.image}
                alt={activeCard.title}
                style={{ transform: `scale(${imageZoom})`, transformOrigin: "center center" }}
                className="max-h-[70vh] w-auto max-w-full object-contain transition-transform duration-150"
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SavedCard({
  card,
  onOpen,
  onDelete,
  onSchedule,
}: {
  card: SavedCardItem;
  onOpen: () => void;
  onDelete: () => void;
  onSchedule: () => void;
}) {
  return (
    <article className="relative overflow-hidden rounded-[26px] bg-surface-container-lowest">
      {card.image ? (
        <div className="flex h-[245px] w-full items-center justify-center bg-surface-container-low">
          <img src={card.image} alt={card.title} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="flex h-[245px] w-full items-center justify-center bg-gradient-to-br from-surface-container-low via-surface-container to-surface-container-high">
          <span className="text-sm font-semibold text-on-surface-variant">No image generated</span>
        </div>
      )}
      <div className="p-5">
        <p className="mb-5 line-clamp-3 text-[1.3rem] leading-[1.35] text-on-surface">{card.title}</p>
        <div className="border-t border-outline-variant/30 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant">Saved On</p>
          <p className="mt-1 text-base text-on-surface">{card.date}</p>
          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0b1a76] px-4 py-2 text-sm font-semibold text-white"
              >
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                Open Draft
              </button>
              <button
                type="button"
                onClick={onSchedule}
                className="inline-flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary"
              >
                <span className="material-symbols-outlined text-[16px]">schedule</span>
                Schedule
              </button>
            </div>
            <button
              type="button"
              onClick={onDelete}
              aria-label="Delete draft"
              title="Delete draft"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-red-500/15 text-red-700 transition hover:bg-red-500/25"
            >
              <span className="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </div>
        </div>
      </div>
      <div className="absolute ml-4 mt-4 rounded-lg bg-white/90 px-3 py-2 text-xs font-bold">
        {card.platform}
      </div>
    </article>
  );
}
