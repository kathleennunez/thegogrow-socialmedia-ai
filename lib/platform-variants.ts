export type PlatformVariant = {
  id: string;
  platform: "linkedin" | "instagram" | "x" | "facebook" | "tiktok";
  label: string;
  shortLabel: string;
  size: string;
  aspectRatio: "1:1" | "4:5" | "16:9" | "9:16" | "1.91:1";
  recommended?: boolean;
};

export const PLATFORM_VARIANTS: PlatformVariant[] = [
  {
    id: "linkedin-feed-square",
    platform: "linkedin",
    label: "LinkedIn Feed - Square",
    shortLabel: "LinkedIn Square",
    size: "1080x1080",
    aspectRatio: "1:1",
    recommended: true,
  },
  {
    id: "linkedin-feed-landscape",
    platform: "linkedin",
    label: "LinkedIn Feed - Landscape",
    shortLabel: "LinkedIn Landscape",
    size: "1200x627",
    aspectRatio: "1.91:1",
    recommended: true,
  },
  {
    id: "instagram-feed-square",
    platform: "instagram",
    label: "Instagram Feed - Square",
    shortLabel: "IG Square",
    size: "1080x1080",
    aspectRatio: "1:1",
    recommended: true,
  },
  {
    id: "instagram-feed-portrait",
    platform: "instagram",
    label: "Instagram Feed - Portrait",
    shortLabel: "IG Portrait",
    size: "1080x1350",
    aspectRatio: "4:5",
    recommended: true,
  },
  {
    id: "instagram-story",
    platform: "instagram",
    label: "Instagram Story",
    shortLabel: "IG Story",
    size: "1080x1920",
    aspectRatio: "9:16",
    recommended: true,
  },
  {
    id: "x-post",
    platform: "x",
    label: "X Post",
    shortLabel: "X Post",
    size: "1600x900",
    aspectRatio: "16:9",
    recommended: true,
  },
  {
    id: "facebook-feed-landscape",
    platform: "facebook",
    label: "Facebook Feed - Landscape",
    shortLabel: "Facebook Landscape",
    size: "1200x630",
    aspectRatio: "1.91:1",
    recommended: true,
  },
  {
    id: "facebook-story",
    platform: "facebook",
    label: "Facebook Story",
    shortLabel: "Facebook Story",
    size: "1080x1920",
    aspectRatio: "9:16",
    recommended: true,
  },
  {
    id: "tiktok-vertical",
    platform: "tiktok",
    label: "TikTok Vertical",
    shortLabel: "TikTok Vertical",
    size: "1080x1920",
    aspectRatio: "9:16",
    recommended: true,
  },
];

const toTitleCase = (value: string) =>
  value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

export const getPlatformVariant = (id?: string | null) =>
  PLATFORM_VARIANTS.find((variant) => variant.id === (id || "").trim());

export const getPlatformVariantLabel = (id?: string | null) => {
  const variant = getPlatformVariant(id);
  return variant ? `${variant.label} (${variant.size})` : toTitleCase(id || "Social");
};

export const getPlatformVariantShortLabel = (id?: string | null) => {
  const variant = getPlatformVariant(id);
  return variant ? `${variant.shortLabel} • ${variant.size}` : toTitleCase(id || "Social");
};

export const getPlatformBaseLabel = (id?: string | null) => {
  const variant = getPlatformVariant(id);
  if (variant) {
    return variant.platform.toUpperCase();
  }

  const raw = (id || "").trim();
  if (!raw) return "SOCIAL";

  if (raw.toLowerCase().includes("linkedin")) return "LINKEDIN";
  if (raw.toLowerCase().includes("instagram")) return "INSTAGRAM";
  if (raw.toLowerCase().includes("facebook")) return "FACEBOOK";
  if (raw.toLowerCase().includes("tiktok")) return "TIKTOK";
  if (raw.toLowerCase() === "x" || raw.toLowerCase().includes("twitter")) return "X";
  return toTitleCase(raw).toUpperCase();
};

export const getAspectRatioForVariant = (id?: string | null): PlatformVariant["aspectRatio"] => {
  return getPlatformVariant(id)?.aspectRatio ?? "1:1";
};

