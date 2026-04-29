import { NextResponse } from "next/server";

type BriefRequest = {
  idea?: string;
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

    if (!idea) {
      return NextResponse.json({ error: "Missing required field: idea" }, { status: 400 });
    }

    const goal = inferGoal(idea);
    return NextResponse.json({
      brief: {
        goal,
        audience: "Founders and marketing teams",
        platforms: ["linkedin", "instagram"],
        postCount: 3,
        style: {
          tone: "Professional",
          length: "medium",
          ctaStrength: "balanced",
          emoji: "low",
          hashtags: 5,
        },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to build brief.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
