import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { UserSettings } from "@/types";

const SETTINGS_FILE_PATH = path.join(process.cwd(), "data", "settings.json");

export const getDefaultUserSettings = (userId: string): UserSettings => ({
  userId,
  brandName: "TheGoGrow",
  aiProvider: "openrouter",
  aiModel: "",
  imageProvider: "openrouter",
  colors: {
    primary: "#0A5BFF",
    secondary: "#111827",
  },
  fonts: {
    heading: "Poppins",
    body: "Inter",
  },
  voice: "Helpful, confident, and concise.",
  style: {
    paragraphLength: "short",
    emojiUsage: "low",
    hashtags: 5,
  },
  templates: {
    educational: "Hook + insight + CTA",
    promotional: "Problem + offer + urgency",
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
