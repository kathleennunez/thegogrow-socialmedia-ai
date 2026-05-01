import { NextResponse } from "next/server";
import { getUserSettings } from "@/lib/settings";

type BriefRequest = {
  idea?: string;
  userId?: string;
};

const inferGoal = (idea: string) => {
  const lower = idea.toLowerCase();
  if (/(sale|offer|discount|buy|launch)/.test(lower)) return "promote";
  if (/(webinar|event|announce|release|new feature)/.test(lower)) return "announce";
  if (/(guide|tips|how to|learn|educat)/.test(lower)) return "educate";
  return "engage";
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as BriefRequest;
    const idea = body.idea?.trim();
    const userId = body.userId?.trim();

    if (!idea || !userId) {
      return NextResponse.json({ error: "Missing required fields: idea, userId" }, { status: 400 });
    }

    const settings = await getUserSettings(userId);
    const goal = inferGoal(idea);
    const audienceFallback =
      settings.templates.custom_voice_instructions?.match(/(CTOs?|technology leaders|business decision makers)/i)?.[0] ??
      "Decision makers and target customers";

    return NextResponse.json({
      brief: {
        goal,
        audience: audienceFallback,
        platforms: ["linkedin"],
        postCount: 3,
        style: {
          tone: settings.voice || "Professional",
          length: settings.style.paragraphLength ?? "medium",
          ctaStrength: "balanced",
          emoji: settings.style.emojiUsage ?? "low",
          hashtags: settings.style.hashtags ?? 5,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
