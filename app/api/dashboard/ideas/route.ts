import { NextResponse } from "next/server";
import { generateDashboardIdeas, type DashboardIdea } from "@/lib/claude";
import { getUserSettings } from "@/lib/settings";
import { getPosts } from "@/lib/store";

type IdeasRequestBody = {
  userId?: string;
};

type TrendSignal = {
  title: string;
  url: string;
  source?: string;
};

const decodeXmlEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const extractTag = (block: string, tag: string) => {
  const cdata = new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i");
  const plain = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const cdataMatch = block.match(cdata);
  if (cdataMatch?.[1]) {
    return decodeXmlEntities(cdataMatch[1].trim());
  }
  const plainMatch = block.match(plain);
  return plainMatch?.[1] ? decodeXmlEntities(plainMatch[1].trim()) : "";
};

const fetchTrendSignals = async (brandName: string): Promise<TrendSignal[]> => {
  const baseTerms = [brandName, "social media marketing", "content strategy", "digital marketing trends"]
    .filter(Boolean)
    .join(" OR ");
  const query = encodeURIComponent(baseTerms);
  const url = `https://news.google.com/rss/search?q=${query}&hl=en-US&gl=US&ceid=US:en`;

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    return [];
  }

  const xml = await response.text();
  const items = Array.from(xml.matchAll(/<item>([\s\S]*?)<\/item>/gi))
    .map((match) => match[1])
    .slice(0, 8);

  return items
    .map((item) => {
      const title = extractTag(item, "title");
      const source = extractTag(item, "source");
      const link = extractTag(item, "link");
      if (!title) {
        return null;
      }
      return {
        title,
        url: link || "https://news.google.com",
        source: source || undefined,
      };
    })
    .filter(Boolean) as TrendSignal[];
};

const fallbackIdeas = (brandName: string): DashboardIdea[] => [
  {
    title: `${brandName} weekly market pulse`,
    hook: "What changed in your market this week and why should buyers care now?",
    angle: "Recap key trend movements and connect them to customer decisions.",
    whyNow: "Weekly cycles help audiences expect and engage with recurring value.",
    platform: "LINKEDIN",
  },
  {
    title: "Myth vs reality in your niche",
    hook: "Most teams still believe this outdated tactic. Here is what works today.",
    angle: "Contrast old assumptions with current best practice.",
    whyNow: "Shifts in AI and platform algorithms are changing baseline strategy fast.",
    platform: "INSTAGRAM",
  },
  {
    title: "Rapid response to breaking industry headline",
    hook: "Here is the one action to take today based on this headline.",
    angle: "Translate news into practical execution steps.",
    whyNow: "Speed-to-insight content performs well while topics are fresh.",
    platform: "TWITTER",
  },
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as IdeasRequestBody;
    const userId = body.userId?.trim();

    if (!userId) {
      return NextResponse.json({ error: "Missing required field: userId" }, { status: 400 });
    }

    const [settings, posts] = await Promise.all([getUserSettings(userId), getPosts(userId)]);
    const trendSignals = await fetchTrendSignals(settings.brandName).catch(() => []);
    const trendSignalPhrases = trendSignals.map((signal) =>
      signal.source ? `${signal.title} (${signal.source})` : signal.title,
    );

    const ideas = await generateDashboardIdeas(
      settings,
      posts
        .slice()
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
        .slice(0, 12)
        .map((post) => ({
          platform: (post.platforms[0] ?? "UNKNOWN").toUpperCase(),
          text: post.text,
          savedAt: post.savedAt,
        })),
      trendSignalPhrases,
    ).catch(() => []);

    return NextResponse.json({
      ideas: ideas.length > 0 ? ideas : fallbackIdeas(settings.brandName || "Your brand"),
      trendSignals: trendSignalPhrases,
      trendSignalLinks: trendSignals,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to generate dashboard ideas.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
