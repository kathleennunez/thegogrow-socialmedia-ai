import { NextResponse } from "next/server";
import { getUserSettings, saveUserSettings } from "@/lib/settings";
import type { UserSettings } from "@/types";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "Missing query param: userId" }, { status: 400 });
    }

    const settings = await getUserSettings(userId);
    return NextResponse.json({ settings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as UserSettings;

    if (!body?.userId) {
      return NextResponse.json({ error: "Invalid settings payload." }, { status: 400 });
    }

    const savedSettings = await saveUserSettings(body);
    return NextResponse.json({ settings: savedSettings });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save settings.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
