import type { Post, GeneratedMedia, UserSettings } from "@/types";

const DEFAULT_API_BASE = "https://api.nanobanana.ai/v1";
const DEFAULT_MODEL = "nanobanana-image-1";
const DEFAULT_SIZE = "1024x1024";

const sleep = async (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getString = (value: unknown) => (typeof value === "string" ? value : "");
const getRecord = (value: unknown) =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

const getNanobananaApiKey = () =>
  (
    process.env.NANOBANANA_API_KEY ??
    process.env.NANOBANANA_KEY ??
    process.env.NANOBANANA_TOKEN ??
    ""
  ).trim();

const getGenerateUrl = () => {
  const fromEnv = process.env.NANOBANANA_GENERATE_URL?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  const base = (process.env.NANOBANANA_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "");
  return `${base}/images/generations`;
};

const getStatusUrl = (jobOrAssetId: string) => {
  const template = process.env.NANOBANANA_STATUS_URL?.trim();
  if (template) {
    return template.replace("{id}", encodeURIComponent(jobOrAssetId));
  }

  const base = (process.env.NANOBANANA_API_BASE ?? DEFAULT_API_BASE).replace(/\/$/, "");
  return `${base}/images/generations/${encodeURIComponent(jobOrAssetId)}`;
};

const getImageUrlFromPayload = (payload: unknown): string => {
  const record = getRecord(payload);
  if (!record) {
    return "";
  }

  const direct =
    getString(record.image_url) ||
    getString(record.imageUrl) ||
    getString(record.url) ||
    getString(getRecord(record.image)?.url) ||
    getString(getRecord(record.result)?.image_url) ||
    getString(getRecord(record.result)?.imageUrl) ||
    getString(getRecord(record.output)?.image_url) ||
    getString(getRecord(record.output)?.url);
  if (direct) {
    return direct;
  }

  const dataItems = Array.isArray(record.data) ? record.data : [];
  const first = getRecord(dataItems[0]);
  if (first) {
    const url = getString(first.url) || getString(first.image_url) || getString(first.imageUrl);
    if (url) {
      return url;
    }

    const b64 = getString(first.b64_json) || getString(first.b64);
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
  }

  return "";
};

const getAssetIdFromPayload = (payload: unknown): string => {
  const record = getRecord(payload);
  if (!record) {
    return "";
  }

  return (
    getString(record.id) ||
    getString(record.asset_id) ||
    getString(record.assetId) ||
    getString(getRecord(record.job)?.id)
  );
};

const getStatusFromPayload = (payload: unknown): string => {
  const record = getRecord(payload);
  if (!record) {
    return "";
  }

  return (
    getString(record.status) ||
    getString(record.state) ||
    getString(getRecord(record.job)?.status) ||
    getString(getRecord(record.result)?.status)
  ).toLowerCase();
};

const buildPrompt = (post: Post, userSettings: UserSettings) => {
  const brand = userSettings.brandName || "Brand";
  const voice = userSettings.voice || "Professional";

  return [
    `Create a social media graphic for ${brand}.`,
    `Topic: ${post.topic}`,
    `Post copy: ${post.text}`,
    `Image idea: ${post.imageIdea}`,
    `Visual style: ${voice}`,
    `Primary color: ${userSettings.colors.primary}`,
    `Secondary color: ${userSettings.colors.secondary}`,
    userSettings.logoUrl ? `Use this logo if possible: ${userSettings.logoUrl}` : "No logo provided.",
    "Design should be clean, modern, and readable on mobile.",
  ].join("\n");
};

export async function generateNanobananaImage(
  post: Post,
  userSettings: UserSettings,
): Promise<GeneratedMedia> {
  const apiKey = getNanobananaApiKey();
  if (!apiKey) {
    throw new Error("Missing NANOBANANA_API_KEY.");
  }

  const response = await fetch(getGenerateUrl(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      model: process.env.NANOBANANA_MODEL?.trim() || DEFAULT_MODEL,
      prompt: buildPrompt(post, userSettings),
      size: process.env.NANOBANANA_IMAGE_SIZE?.trim() || DEFAULT_SIZE,
      response_format: "url",
      metadata: {
        topic: post.topic,
        brand_name: userSettings.brandName,
        platform: post.platforms[0] ?? "social",
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Nanobanana generation request failed (${response.status}).`);
  }

  let data = (await response.json()) as unknown;
  let imageUrl = getImageUrlFromPayload(data);
  let assetId = getAssetIdFromPayload(data);

  if (!imageUrl && assetId) {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await sleep(1000);
      const statusResponse = await fetch(getStatusUrl(assetId), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "x-api-key": apiKey,
        },
      });

      if (!statusResponse.ok) {
        throw new Error(`Nanobanana status check failed (${statusResponse.status}).`);
      }

      data = (await statusResponse.json()) as unknown;
      imageUrl = getImageUrlFromPayload(data);
      assetId = getAssetIdFromPayload(data) || assetId;
      const status = getStatusFromPayload(data);

      if (imageUrl || status === "completed" || status === "success" || status === "done") {
        break;
      }

      if (status === "failed" || status === "error" || status === "cancelled") {
        throw new Error("Nanobanana generation failed.");
      }
    }
  }

  if (!imageUrl) {
    throw new Error("Nanobanana response missing image output URL.");
  }

  return {
    provider: "nanobanana",
    status: "ready",
    assetId: assetId || undefined,
    imageUrl,
  };
}
