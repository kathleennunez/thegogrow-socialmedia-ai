"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastProvider";
import type { Post } from "@/types";

export function PostCard({ post }: { post: Post }) {
  const toast = useToast();
  const [text, setText] = useState(post.text);
  const [isSaving, setIsSaving] = useState(false);
  const media = post.media;
  const providerLabel =
    media?.provider === "nanobanana" ? "Nanobanana" : "OpenRouter";

  const handleSave = async () => {
    setIsSaving(true);

    try {
      const payload: Post = {
        ...post,
        text,
        edited: text !== post.text ? true : post.edited,
      };

      const response = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(errorData?.error ?? "Failed to save post.");
      }

      toast.success("Post saved.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save post.";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <article className="group overflow-hidden rounded-2xl border border-outline-variant/30 bg-surface-container-lowest transition hover:border-primary/20">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="h-40 w-full bg-surface-container-low p-5">
          <div className="mb-4 inline-flex items-center gap-2 rounded-lg bg-white/85 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-on-surface">
            <span className="material-symbols-outlined text-[14px] text-primary">share</span>
            {post.platforms.join(", ")}
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">{post.topic}</h3>
        </div>
      </div>
      <div className="space-y-4 p-5">
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={5}
          className="w-full rounded-xl border-none bg-surface-container px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary/40"
        />

        <p className="rounded-xl bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
          <span className="font-semibold text-on-surface">Image idea:</span> {post.imageIdea}
        </p>

        {media?.imageUrl ? (
          <img
            src={media.imageUrl}
            alt={`Generated ${media.provider} preview`}
            className="w-full rounded-xl border border-outline-variant/30"
          />
        ) : null}

        {media?.editUrl ? (
          <a
            href={media.editUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg bg-primary-fixed px-3 py-2 text-sm font-semibold text-on-primary-fixed"
          >
            {"Open Media"}
          </a>
        ) : null}

        {media?.status === "failed" ? (
          <p className="text-sm text-amber-700">
            {providerLabel} generation failed: {media.error ?? "Unknown error"}
          </p>
        ) : null}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="btn-gradient rounded-lg px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSaving ? "Saving..." : "Save"}
        </button>
      </div>
    </article>
  );
}
