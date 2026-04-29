import { NextResponse } from "next/server";
import { generatePosts } from "@/lib/claude";
import { generateNanobananaImage } from "@/lib/nanobanana";
import { generateOpenRouterImage } from "@/lib/openrouter-image";
import { getUserSettings } from "@/lib/settings";
import type { Post } from "@/types";

type GenerateRequestBody = {
  topic?: string;
  platforms?: string[];
  userId?: string;
  aiProviderOverride?: "claude" | "openrouter";
  aiModelOverride?: string;
  imageProviderOverride?: "nanobanana" | "openrouter";
  skipMediaGeneration?: boolean;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequestBody;
    const {
      topic,
      platforms,
      userId,
      aiProviderOverride,
      aiModelOverride,
      imageProviderOverride,
      skipMediaGeneration,
    } = body;

    if (!topic || !Array.isArray(platforms) || !platforms.length || !userId) {
      return NextResponse.json(
        { error: "Missing required fields: topic, platforms, userId" },
        { status: 400 },
      );
    }

    const userSettings = await getUserSettings(userId);
    const resolvedAiProvider =
      aiProviderOverride === "openrouter" || aiProviderOverride === "claude"
        ? aiProviderOverride
        : (userSettings.aiProvider ?? "claude");

    const effectiveUserSettings = {
      ...userSettings,
      aiProvider: resolvedAiProvider,
      aiModel: aiModelOverride?.trim() || userSettings.aiModel || "",
      imageProvider:
        imageProviderOverride === "nanobanana"
          ? "nanobanana"
          : imageProviderOverride === "openrouter"
            ? "openrouter"
            : (userSettings.imageProvider ?? "openrouter"),
    };

    const shouldGenerateMedia = skipMediaGeneration !== true;
    const imageProvider =
      effectiveUserSettings.imageProvider === "nanobanana" ? "nanobanana" : "openrouter";

    const result = await generatePosts(topic, effectiveUserSettings, platforms);

    const posts = await Promise.all(
      result.posts.map(async (generatedPost) => {
        const post: Post = {
          id: generatedPost.id,
          userId,
          topic,
          text: generatedPost.text,
          imageIdea: generatedPost.imageIdea,
          platforms: [generatedPost.platform],
          savedAt: new Date().toISOString(),
        };

        try {
          if (!shouldGenerateMedia) {
            return post;
          }

          if (imageProvider === "nanobanana") {
            const media = await generateNanobananaImage(post, effectiveUserSettings);
            return { ...post, media };
          }

          const media = await generateOpenRouterImage(post, effectiveUserSettings);
          return { ...post, media };
        } catch (mediaError) {
          const message = mediaError instanceof Error ? mediaError.message : "Image generation failed.";
          return {
            ...post,
            media: {
              provider: imageProvider,
              status: "failed" as const,
              error: message,
            },
          };
        }
      }),
    );

    return NextResponse.json({ posts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate posts.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
