import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UserSettings } from "@/types";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

export const getDefaultUserSettings = (userId: string): UserSettings => ({
  userId,
  brandName: "Rocket Engineers",
  aiProvider: "openrouter",
  aiModel: "",
  imageProvider: "openrouter",
  colors: {
    primary: "#DC2626",
    secondary: "#000000",
  },
  fonts: {
    heading: "Manrope",
    body: "Inter",
  },
  voice: "Consultative & Insight-led",
  style: {
    paragraphLength: "medium",
    emojiUsage: "none",
    hashtags: 4,
  },
  templates: {
    educational:
      "Bridge business challenge + implementation insight + market context (EMEA/deep tech experience) + measurable outcome CTA",
    promotional:
      "Specific challenge + right engineering partner match + why implementation matters more than tools alone + clear next-step CTA",
    custom_voice_instructions:
      "Write for CTOs, technology leaders, and business decision makers. Emphasize that technology alone does not solve problems; skilled implementation does. Position Rocket Engineers as the bridge between technology and business success, with deep EMEA market experience and a strong network matching solution providers with end-users facing specific challenges. Keep the tone confident, practical, and engineering-first.",
  },
});

const readSettingsMap = async (): Promise<Record<string, UserSettings>> => {
  try {
    const fileContent = await readFile(SETTINGS_FILE_PATH, "utf-8").catch((error: unknown) => {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return "{}";
      }
      throw error;
    });

    return JSON.parse(fileContent) as Record<string, UserSettings>;
  } catch (error) {
    console.error("Failed to read user settings:", error);
    throw new Error("Unable to read user settings.");
  }
};

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const settingsMap = await readSettingsMap();
  const settings = settingsMap[userId] ?? getDefaultUserSettings(userId);

  return {
    ...settings,
    aiProvider: settings.aiProvider === "claude" ? "claude" : "openrouter",
    imageProvider: settings.imageProvider === "nanobanana" ? "nanobanana" : "openrouter",
  };
}

export async function saveUserSettings(settings: UserSettings): Promise<UserSettings> {
  try {
    const settingsMap = await readSettingsMap();
    const normalized: UserSettings = {
      ...settings,
      aiProvider: settings.aiProvider === "claude" ? "claude" : "openrouter",
      imageProvider: settings.imageProvider === "nanobanana" ? "nanobanana" : "openrouter",
    };
    settingsMap[settings.userId] = normalized;
    await writeFile(SETTINGS_FILE_PATH, JSON.stringify(settingsMap, null, 2), "utf-8");
    return normalized;
  } catch (error) {
    console.error("Failed to save user settings:", error);
    throw new Error("Unable to save user settings.");
  }
}
