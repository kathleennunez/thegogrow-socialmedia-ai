import type { GeneratedMedia, Post, UserSettings } from "@/types";
import { getAspectRatioForVariant, getPlatformVariantLabel } from "@/lib/platform-variants";

type OpenRouterImageResponse = {
  data?: Array<{
    id?: string;
    output_modalities?: string[];
    supported_parameters?: string[];
  }>;
  choices?: Array<{
    message?: {
      images?: Array<{
        image_url?: { url?: string };
        imageUrl?: { url?: string };
      }>;
      content?: Array<{
        type?: string;
        image_url?: { url?: string };
        imageUrl?: { url?: string };
      }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENROUTER_API_URL =
  process.env.OPENROUTER_API_URL?.trim() || "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL =
  process.env.OPENROUTER_MODELS_URL?.trim() || "https://openrouter.ai/api/v1/models";
const OPENROUTER_IMAGE_FALLBACK_MODELS = [
  "openai/gpt-image-1",
  "google/gemini-2.5-flash-image-preview",
  "google/gemini-2.5-flash-image-preview:free",
  "black-forest-labs/flux-1-schnell",
  "openrouter/free",
];
const isLikelyImageModel = (value?: string | null) => {
  const model = value?.trim().toLowerCase() || "";
  if (!model) return false;
  return (
    /(image|vision|flux|recraft|sdxl|dall|stable-diffusion|midjourney)/i.test(model) ||
    model === "openrouter/free"
  );
};

const getImageModel = (userSettings: UserSettings) => {
  const explicitImageModel = process.env.OPENROUTER_IMAGE_MODEL?.trim();
  if (explicitImageModel) {
    return explicitImageModel;
  }

  const selectedModel = userSettings.aiModel?.trim();
  if (selectedModel && isLikelyImageModel(selectedModel)) {
    return selectedModel;
  }
  return "";
};

const buildImagePrompt = (post: Post, settings: UserSettings) => {
  const selectedVariant = post.platforms[0] ?? "social";
  return [
    `Create a social media marketing graphic for ${settings.brandName || "this brand"}.`,
    `Target platform format: ${getPlatformVariantLabel(selectedVariant)}`,
    `Topic: ${post.topic}`,
    `Caption context: ${post.text}`,
    `Visual direction: ${post.imageIdea}`,
    `Primary color: ${settings.colors.primary}`,
    `Secondary color: ${settings.colors.secondary}`,
    settings.logoUrl ? `Incorporate logo if appropriate: ${settings.logoUrl}` : "No logo provided.",
    "Output a clean, modern, high-contrast visual suitable for social feed posting.",
  ].join("\n");
};

const extractImageUrl = (payload: OpenRouterImageResponse) => {
  const message = payload.choices?.[0]?.message;

  const direct =
    message?.images?.[0]?.image_url?.url ||
    message?.images?.[0]?.imageUrl?.url ||
    message?.content?.find((item) => item?.type === "image")?.image_url?.url ||
    message?.content?.find((item) => item?.type === "image")?.imageUrl?.url;

  return (direct || "").trim();
};

const fetchImageModels = async (apiKey: string) => {
  const response = await fetch(`${OPENROUTER_MODELS_URL}?output_modalities=image`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return [] as string[];
  }

  const payload = (await response.json()) as OpenRouterImageResponse;
  const models = Array.isArray(payload.data) ? payload.data : [];
  return models
    .map((item) => (typeof item.id === "string" ? item.id.trim() : ""))
    .filter((id) => Boolean(id) && isLikelyImageModel(id));
};

const resolveImageModelCandidates = async (apiKey: string, userSettings: UserSettings) => {
  const explicitModel = getImageModel(userSettings);
  const explicitIsForced = Boolean(process.env.OPENROUTER_IMAGE_MODEL?.trim() && explicitModel);
  try {
    const imageModels = await fetchImageModels(apiKey);
    const supported = new Set(imageModels);
    const preferredDiscovered =
      imageModels.find((model) => model === explicitModel) ||
      imageModels.find((model) => model === "openai/gpt-image-1") ||
      imageModels.find((model) => model === "google/gemini-2.5-flash-image-preview") ||
      imageModels.find((model) => model === "google/gemini-2.5-flash-image-preview:free") ||
      imageModels.find((model) => model === "openrouter/free") ||
      imageModels.find((model) => !/preview/i.test(model)) ||
      imageModels[0];

    const candidates: string[] = [];
    if (explicitIsForced && isLikelyImageModel(explicitModel) && supported.has(explicitModel)) {
      candidates.push(explicitModel);
    }
    if (
      !explicitIsForced &&
      explicitModel &&
      isLikelyImageModel(explicitModel) &&
      supported.has(explicitModel)
    ) {
      candidates.push(explicitModel);
    }
    if (preferredDiscovered) {
      candidates.push(preferredDiscovered);
    }
    candidates.push(...OPENROUTER_IMAGE_FALLBACK_MODELS.filter((model) => supported.has(model)));
    candidates.push(...imageModels.filter((model) => isLikelyImageModel(model)).slice(0, 6));

    const deduped = Array.from(new Set(candidates));
    if (deduped.length === 0) {
      return Array.from(new Set([explicitModel, ...OPENROUTER_IMAGE_FALLBACK_MODELS].filter(Boolean)));
    }
    return deduped;
  } catch {
    // If model discovery fails, fallback to known image-capable models/routes.
    return Array.from(new Set([explicitModel, ...OPENROUTER_IMAGE_FALLBACK_MODELS].filter(Boolean)));
  }
};

export async function generateOpenRouterImage(
  post: Post,
  userSettings: UserSettings,
): Promise<GeneratedMedia> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  const modelCandidates = await resolveImageModelCandidates(apiKey, userSettings);
  if (modelCandidates.length === 0) {
    throw new Error("No OpenRouter image models are currently available for your route. Try again later.");
  }

  let lastError: Error | null = null;
  const aspectRatio = getAspectRatioForVariant(post.platforms[0]);

  for (const model of modelCandidates) {
    for (const modalities of [["image", "text"], ["image"]] as const) {
      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(process.env.NEXT_PUBLIC_APP_URL?.trim()
            ? { "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL.trim() }
            : {}),
          "X-Title": "TheGoGrow Social AI",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "user",
              content: buildImagePrompt(post, userSettings),
            },
          ],
          modalities,
          stream: false,
          image_config: {
            aspect_ratio: aspectRatio,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as OpenRouterImageResponse;

      if (!response.ok) {
        const errorMessage = payload.error?.message || `OpenRouter image request failed (${response.status}).`;
        lastError = new Error(`${model}: ${errorMessage}`);
        if (/not a valid model id/i.test(errorMessage)) {
          break;
        }
        continue;
      }

      const imageUrl = extractImageUrl(payload);
      if (imageUrl) {
        return {
          provider: "openrouter",
          status: "ready",
          imageUrl,
        };
      }

      lastError = new Error(`${model}: OpenRouter image response missing image URL.`);
    }
  }

  if (lastError && /no endpoints found/i.test(lastError.message)) {
    throw new Error("No OpenRouter image endpoint is currently available for the selected route. Try again later.");
  }

  throw (
    lastError ??
    new Error(
      "OpenRouter image generation failed. No image endpoint responded successfully.",
    )
  );
}
