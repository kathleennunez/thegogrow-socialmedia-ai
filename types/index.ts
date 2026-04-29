export type GeneratedMedia = {
  provider: "nanobanana" | "openrouter";
  status: "ready" | "failed" | "pending";
  assetId?: string;
  editUrl?: string;
  imageUrl?: string;
  error?: string;
};

export type Post = {
  id: string;
  userId: string;
  topic: string;
  text: string;
  imageIdea: string;
  platforms: string[];
  savedAt: string;
  edited?: boolean;
  media?: GeneratedMedia;
};

export type UserSettings = {
  userId: string;
  brandName: string;
  logoUrl?: string;
  aiProvider?: "claude" | "openrouter";
  aiModel?: string;
  imageProvider?: "nanobanana" | "openrouter";
  colors: {
    primary: string;
    secondary: string;
  };
  fonts: {
    heading: string;
    body: string;
  };
  voice: string;
  style: {
    paragraphLength: "short" | "medium" | "long";
    emojiUsage: "none" | "low" | "high";
    hashtags: number;
  };
  templates: {
    [postType: string]: string;
  };
};

export type Analytics = {
  postId: string;
  platform: string;
  impressions: number;
  engagement: number;
  likes: number;
  comments: number;
  shares: number;
};
