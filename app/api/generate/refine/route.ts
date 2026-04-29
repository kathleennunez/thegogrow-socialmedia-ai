import { NextResponse } from "next/server";
import { refineGeneratedPost } from "@/lib/claude";
import { getUserSettings } from "@/lib/settings";

type RefineRequest = {
  userId?: string;
  platform?: string;
  text?: string;
  imageIdea?: string;
  instruction?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RefineRequest;
    const userId = body.userId?.trim();
    const platform = body.platform?.trim();
    const text = body.text?.trim();
    const imageIdea = body.imageIdea?.trim();
    const instruction = body.instruction?.trim();

    if (!userId || !platform || !text || !imageIdea || !instruction) {
      return NextResponse.json(
        { error: "Missing required fields: userId, platform, text, imageIdea, instruction" },
        { status: 400 },
      );
    }

    const userSettings = await getUserSettings(userId);
    const refined = await refineGeneratedPost({
      userSettings,
      platform,
      originalText: text,
      originalImageIdea: imageIdea,
      instruction,
    });

    return NextResponse.json({ refined });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to refine post.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
