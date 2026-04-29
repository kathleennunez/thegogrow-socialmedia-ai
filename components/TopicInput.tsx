"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { Post } from "@/types";
import { LoadingState } from "./LoadingState";

type TopicInputProps = {
  userId?: string;
  platforms: string[];
  onLoadingChange?: (isLoading: boolean) => void;
  onResult: (posts: Post[]) => void;
};

export function TopicInput({
  userId = "local-user",
  platforms,
  onLoadingChange,
  onResult,
}: TopicInputProps) {
  const [topic, setTopic] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!topic.trim() || platforms.length === 0) {
      setError("Topic and at least one platform are required.");
      return;
    }

    setIsLoading(true);
    onLoadingChange?.(true);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          platforms,
          userId,
          aiProviderOverride: "openrouter",
          imageProviderOverride: "openrouter",
        }),
      });

      const data = (await response.json()) as { posts?: Post[]; error?: string };

      if (!response.ok || !data.posts) {
        throw new Error(data.error ?? "Failed to generate posts.");
      }

      onResult(data.posts);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Failed to generate posts.";
      setError(message);
    } finally {
      setIsLoading(false);
      onLoadingChange?.(false);
    }
  };

  const enhanceTopic = (mode: "professional" | "hook") => {
    const trimmed = topic.trim();
    if (!trimmed) {
      setError("Add a topic first, then use quick actions.");
      return;
    }

    setError(null);
    setTopic((current) => {
      const value = current.trim();
      if (mode === "professional") {
        return `Create a polished, post-ready version of this idea:\n\n${value}`;
      }

      return `Create a high-impact post with a strong opening line from this idea:\n\n${value}`;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <textarea
          id="topic"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Describe your topic, share a link, or paste a rough draft..."
          rows={4}
          className="w-full rounded-xl border-none bg-surface-container-low px-6 py-5 text-[17px] leading-8 text-on-surface placeholder:text-on-surface-variant/60 focus:ring-1 focus:ring-primary/40"
        />
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => enhanceTopic("professional")}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-primary"
          >
            <span className="material-symbols-outlined text-[16px]">bolt</span>
            Make it professional
          </button>
          <button
            type="button"
            onClick={() => enhanceTopic("hook")}
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-xs font-semibold text-[#b44600]"
          >
            <span className="material-symbols-outlined text-[16px]">lightbulb</span>
            Add a hook
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={isLoading}
            className="btn-gradient inline-flex items-center gap-2 rounded-xl px-8 py-3.5 font-headline text-base font-extrabold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading ? <LoadingState /> : null}
            {isLoading ? "Generating..." : "Generate Content"}
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </form>
  );
}
