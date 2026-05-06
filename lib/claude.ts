import type { UserSettings } from "@/types";

type GeneratedPost = {
  platform: string;
  id: string;
  text: string;
  imageIdea: string;
};

type GeneratePostsResult = {
  posts: GeneratedPost[];
};

type SummaryInputItem = {
  platform: string;
  text: string;
  savedAt?: string;
};

type DashboardIdeaInputItem = {
  platform: string;
  text: string;
  savedAt?: string;
};

export type DashboardIdea = {
  title: string;
  hook: string;
  angle: string;
  whyNow: string;
  platform: string;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

const OPENROUTER_DEFAULT_MODEL = "openai/gpt-4.1-mini";
const OPENROUTER_API_URL =
  process.env.OPENROUTER_API_URL?.trim() || "https://openrouter.ai/api/v1/chat/completions";
const GPT_FALLBACK_MODELS = [
  "openai/gpt-4.1-mini",
  "openai/gpt-4.1",
  "openai/gpt-4.1-nano",
];

const unique = (values: Array<string | undefined | null>) =>
  Array.from(new Set(values.map((value) => value?.trim()).filter(Boolean) as string[]));

const isGptModel = (model: string) => {
  const normalized = model.trim().toLowerCase();
  return normalized.startsWith("openai/gpt-") || normalized.startsWith("gpt-");
};

const getOpenRouterCandidates = (userSettings: UserSettings) =>
  unique([
    userSettings.aiModel,
    process.env.OPENAI_MODEL,
    process.env.OPENROUTER_MODEL,
    OPENROUTER_DEFAULT_MODEL,
    ...GPT_FALLBACK_MODELS,
  ]).filter(isGptModel);

const isRetryableOpenRouterError = (status: number, message: string) => {
  if ([408, 409, 425, 429, 500, 502, 503, 504].includes(status)) {
    return true;
  }

  return /provider returned error|temporar|timeout|overloaded|rate limit|upstream|no endpoints found/i.test(
    message,
  );
};

const extractLabel = (text: string, label: string) => {
  const pattern = new RegExp(
    `(?:\\*\\*)?${label}(?:\\*\\*)?\\s*:\\s*([\\s\\S]*?)(?=\\n\\s*(?:(?:\\*\\*)?(?:POST_[ABC]|IMAGE_[ABC])(?:\\*\\*)?\\s*:)|$)`,
    "i",
  );

  return pattern.exec(text)?.[1]?.trim() ?? "";
};

const parsePostVariants = (text: string) => {
  const variants: Array<{ text: string; imageIdea: string }> = [];

  for (const suffix of ["A", "B", "C"] as const) {
    const post = extractLabel(text, `POST_${suffix}`);
    const image = extractLabel(text, `IMAGE_${suffix}`);

    if (post && image) {
      variants.push({ text: post, imageIdea: image });
    }
  }

  return variants;
};

const stripLeadingLabel = (value: string) =>
  value.replace(
    /^\s*(hook|caption|post|body|copy|headline|opening|intro|cta)\s*[:\-]\s*/i,
    "",
  );

const normalizePostText = (value: string) =>
  stripLeadingLabel(value)
    .replace(/^["']|["']$/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const extractJsonPayload = (value: string) => {
  const start = value.indexOf("{");
  const end = value.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return "";
  }
  return value.slice(start, end + 1);
};

const buildSystemPrompt = (userSettings: UserSettings) => {
  const templates = Object.entries(userSettings.templates)
    .filter(([key]) => key !== "custom_voice_instructions")
    .map(([postType, template]) => `- ${postType}: ${template}`)
    .join("\n");
  const customVoiceInstructions = userSettings.templates.custom_voice_instructions?.trim();
  const hashtagInstruction =
    userSettings.style.hashtags > 0
      ? `Include around ${userSettings.style.hashtags} relevant hashtags at the end of each post.`
      : "Do not include hashtags.";
  const emojiInstruction =
    userSettings.style.emojiUsage === "none"
      ? "Do not use emojis."
      : userSettings.style.emojiUsage === "low"
        ? "Use emojis sparingly (0-2 max)."
        : "Use emojis naturally for emphasis.";

  return [
    "You are a social media copywriter.",
    `Brand: ${userSettings.brandName}`,
    `Voice: ${userSettings.voice}`,
    `Paragraph length: ${userSettings.style.paragraphLength}`,
    `Emoji usage: ${userSettings.style.emojiUsage}`,
    `Target hashtag count: ${userSettings.style.hashtags}`,
    hashtagInstruction,
    emojiInstruction,
    `Primary color: ${userSettings.colors.primary}`,
    `Secondary color: ${userSettings.colors.secondary}`,
    `Heading font: ${userSettings.fonts.heading}`,
    `Body font: ${userSettings.fonts.body}`,
    userSettings.logoUrl ? `Logo URL: ${userSettings.logoUrl}` : "Logo URL: none",
    customVoiceInstructions
      ? `Custom voice instructions: ${customVoiceInstructions}`
      : "Custom voice instructions: none",
    "Use these templates when relevant:",
    templates || "- none",
    "Write final publish-ready captions only.",
    "Do not add meta labels like Hook:, Caption:, Headline:, Body:, CTA: in output.",
    "Always respond using this exact label format:",
    "POST_A: ...",
    "IMAGE_A: ...",
    "POST_B: ...",
    "IMAGE_B: ...",
    "Optional:",
    "POST_C: ...",
    "IMAGE_C: ...",
  ].join("\n");
};

const extractOpenRouterText = (payload: OpenRouterResponse) => {
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part && typeof part === "object" ? (part.text ?? "") : ""))
      .join("\n")
      .trim();
  }

  return "";
};

const generateWithOpenRouter = async (
  system: string,
  prompt: string,
  maxTokens: number,
  userSettings: UserSettings,
) => {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("Missing OPENROUTER_API_KEY.");
  }

  let lastError: unknown = null;
  const candidates = getOpenRouterCandidates(userSettings);
  if (!candidates.length) {
    throw new Error("No GPT model is configured. Set OPENAI_MODEL or OPENROUTER_MODEL to a GPT model.");
  }

  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
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
          max_tokens: maxTokens,
          temperature: 0.7,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as OpenRouterResponse;

      if (!response.ok) {
        const errorMessage = payload.error?.message || `OpenRouter request failed (${response.status}).`;
        lastError = new Error(`${model}: ${errorMessage}`);
        const modelMissing =
          response.status === 404 || /model/i.test(errorMessage) || /no endpoints found/i.test(errorMessage);
        if (modelMissing) {
          break;
        }

        if (isRetryableOpenRouterError(response.status, errorMessage)) {
          if (attempt === 0) {
            continue;
          }
          break;
        }
        throw lastError;
      }

      const text = extractOpenRouterText(payload);
      if (text) {
        return text;
      }

      lastError = new Error(`${model}: OpenRouter returned an empty response.`);
      if (attempt === 0) {
        continue;
      }
      break;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("No available OpenRouter model could be used for this request.");
};

const generateText = async (
  system: string,
  prompt: string,
  maxTokens: number,
  userSettings: UserSettings,
) => {
  return generateWithOpenRouter(system, prompt, maxTokens, userSettings);
};

export async function generatePosts(
  topic: string,
  userSettings: UserSettings,
  platforms: string[],
): Promise<GeneratePostsResult> {
  const posts: GeneratedPost[] = [];
  const system = buildSystemPrompt(userSettings);

  for (const platform of platforms) {
    const rawText = await generateText(
      system,
      [
        `Topic: ${topic}`,
        `Platform: ${platform}`,
        `Apply paragraph length preference: ${userSettings.style.paragraphLength}.`,
        userSettings.style.hashtags > 0
          ? `End each post with approximately ${userSettings.style.hashtags} hashtags.`
          : "Do not include hashtags in posts.",
        userSettings.style.emojiUsage === "none"
          ? "Use no emojis."
          : userSettings.style.emojiUsage === "low"
            ? "Use minimal emojis."
            : "Use expressive emojis where appropriate.",
        "Generate 2 to 3 post variants for this platform.",
        "Each variant must have one matching one-sentence image idea.",
        "Posts must be final and ready to publish directly.",
        "Do not include internal labels like Hook:, Caption:, Headline:, CTA: in the post text.",
        "Follow the required labels exactly.",
      ].join("\n"),
      1200,
      userSettings,
    );

    const variants = parsePostVariants(rawText);

    for (const variant of variants) {
      posts.push({
        platform,
        id: crypto.randomUUID(),
        text: normalizePostText(variant.text),
        imageIdea: variant.imageIdea,
      });
    }
  }

  return { posts };
}

export async function generateSavedContentSummary(
  userSettings: UserSettings,
  items: SummaryInputItem[],
): Promise<string> {
  if (!items.length) {
    return "No content available to summarize yet.";
  }

  const condensedItems = items
    .slice(0, 30)
    .map((item, index) =>
      [
        `Item ${index + 1}`,
        `Platform: ${item.platform}`,
        `Saved At: ${item.savedAt ?? "unknown"}`,
        `Text: ${item.text.slice(0, 700)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const summary = await generateText(
    [
      "You summarize social media draft libraries for content strategists.",
      `Brand voice: ${userSettings.voice}`,
      "Return 2-4 concise sentences only.",
      "Include dominant platforms and one practical next action.",
      "Do not use markdown.",
    ].join("\n"),
    `Summarize this saved content library:\n\n${condensedItems}`,
    350,
    userSettings,
  );

  return summary || "Summary is currently unavailable.";
}

export async function generateDashboardIdeas(
  userSettings: UserSettings,
  items: DashboardIdeaInputItem[],
  trendSignals: string[],
): Promise<DashboardIdea[]> {
  const sampleItems = items
    .slice(0, 10)
    .map((item, index) =>
      [
        `Draft ${index + 1}`,
        `Platform: ${item.platform}`,
        `Saved At: ${item.savedAt ?? "unknown"}`,
        `Text: ${item.text.slice(0, 320)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const trendsBlock = trendSignals.length
    ? trendSignals.map((signal, index) => `${index + 1}. ${signal}`).join("\n")
    : "No external trend signals available.";

  const prompt = [
    `Brand Name: ${userSettings.brandName}`,
    `Brand Voice: ${userSettings.voice}`,
    `Primary Platform Preferences: ${Object.keys(userSettings.templates).join(", ")}`,
    "Recent Saved Draft Context:",
    sampleItems || "No drafts yet.",
    "Trend/News Signals:",
    trendsBlock,
    "Task:",
    "Generate 6 social post creation ideas tailored to this brand.",
    "Ideas should include a trend/news angle when relevant and practical.",
    "Do not fabricate precise statistics or specific dates unless present in provided signals.",
    "Return strict JSON only with this schema:",
    '{"ideas":[{"title":"...","hook":"...","angle":"...","whyNow":"...","platform":"..."}]}',
  ].join("\n\n");

  const raw = await generateText(
    [
      "You are a senior social media strategist.",
      "You produce practical, publish-ready campaign ideas.",
      "Return valid JSON only, no markdown.",
    ].join("\n"),
    prompt,
    900,
    userSettings,
  );

  const jsonText = extractJsonPayload(raw);
  if (!jsonText) {
    return [];
  }

  const parsed = JSON.parse(jsonText) as { ideas?: Array<Record<string, unknown>> };
  const ideas = Array.isArray(parsed.ideas) ? parsed.ideas : [];

  return ideas
    .map((idea) => ({
      title: String(idea.title ?? "").trim(),
      hook: String(idea.hook ?? "").trim(),
      angle: String(idea.angle ?? "").trim(),
      whyNow: String(idea.whyNow ?? "").trim(),
      platform: String(idea.platform ?? "").trim().toUpperCase(),
    }))
    .filter((idea) => idea.title && idea.hook)
    .slice(0, 6);
}

export async function refineGeneratedPost(params: {
  userSettings: UserSettings;
  platform: string;
  originalText: string;
  originalImageIdea: string;
  instruction: string;
}) {
  const prompt = [
    `Platform: ${params.platform}`,
    `Original post: ${params.originalText}`,
    `Original image idea: ${params.originalImageIdea}`,
    `Refinement instruction: ${params.instruction}`,
    "Return exactly:",
    "POST_A: <refined post>",
    "IMAGE_A: <refined image idea>",
    "Do not include any other labels or commentary.",
  ].join("\n");

  const rawText = await generateText(buildSystemPrompt(params.userSettings), prompt, 600, params.userSettings);
  const [first] = parsePostVariants(rawText);

  if (!first) {
    return {
      text: normalizePostText(params.originalText),
      imageIdea: params.originalImageIdea,
    };
  }

  return {
    text: normalizePostText(first.text),
    imageIdea: first.imageIdea,
  };
}
