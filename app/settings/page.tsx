"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAppUser } from "@/components/UserProvider";
import type { UserSettings } from "@/types";

const DEFAULT_USER_ID = "demo-user";

const DEFAULT_SETTINGS: UserSettings = {
  userId: DEFAULT_USER_ID,
  brandName: "",
  logoUrl: "",
  aiProvider: "openrouter",
  aiModel: "",
  imageProvider: "openrouter",
  colors: { primary: "#173ce5", secondary: "#03166e" },
  fonts: { heading: "Manrope", body: "Inter" },
  voice: "Professional & Authoritative",
  style: { paragraphLength: "medium", emojiUsage: "low", hashtags: 5 },
  templates: {
    educational: "Hook + value + CTA",
    promotional: "Problem + offer + CTA",
    custom_voice_instructions: "",
  },
};

type SaveStatus = {
  kind: "success" | "error";
  message: string;
} | null;

const clampHashtags = (value: number) => Math.min(15, Math.max(0, value));

export default function SettingsPage() {
  const { user, isReady } = useAppUser();
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [initialSettings, setInitialSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>(null);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user?.id) return;
      const response = await fetch(`/api/settings?userId=${encodeURIComponent(user.id)}`);
      const data = (await response.json()) as { settings?: UserSettings };
      if (data.settings) {
        const next = {
          ...data.settings,
          logoUrl: data.settings.logoUrl ?? "",
          aiProvider: "openrouter",
          aiModel: data.settings.aiModel ?? "",
          imageProvider: data.settings.imageProvider ?? "openrouter",
          templates: {
            ...DEFAULT_SETTINGS.templates,
            ...data.settings.templates,
          },
        };
        setSettings(next);
        setInitialSettings(next);
      }
    };
    if (isReady) void loadSettings();
  }, [isReady, user?.id]);

  const autoHashtaggingOn = settings.style.hashtags > 0;

  const isDirty = useMemo(
    () => JSON.stringify(settings) !== JSON.stringify(initialSettings),
    [initialSettings, settings],
  );

  const handleDiscard = () => {
    setSettings(initialSettings);
    setSaveStatus({ kind: "success", message: "Unsaved changes discarded." });
  };

  const handleSave = async () => {
    if (!user?.id) {
      setSaveStatus({ kind: "error", message: "User session is not ready." });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);

    const payload: UserSettings = {
      ...settings,
      userId: user.id,
      brandName: settings.brandName.trim() || "TheGoGrow",
      logoUrl: settings.logoUrl?.trim() || "",
      aiProvider: "openrouter",
      aiModel: settings.aiModel?.trim() || "",
      colors: {
        primary: settings.colors.primary.trim() || DEFAULT_SETTINGS.colors.primary,
        secondary: settings.colors.secondary.trim() || DEFAULT_SETTINGS.colors.secondary,
      },
      fonts: {
        heading: settings.fonts.heading.trim() || DEFAULT_SETTINGS.fonts.heading,
        body: settings.fonts.body.trim() || DEFAULT_SETTINGS.fonts.body,
      },
      voice: settings.voice.trim() || DEFAULT_SETTINGS.voice,
      imageProvider: settings.imageProvider === "nanobanana" ? "nanobanana" : "openrouter",
      style: {
        ...settings.style,
        hashtags: clampHashtags(settings.style.hashtags),
      },
      templates: {
        ...settings.templates,
        custom_voice_instructions: settings.templates.custom_voice_instructions?.trim() || "",
      },
    };

    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as { settings?: UserSettings; error?: string };
      if (!response.ok || !data.settings) {
        throw new Error(data.error ?? "Failed to save settings.");
      }

      setSettings(data.settings);
      setInitialSettings(data.settings);
      setSaveStatus({ kind: "success", message: "Brand profile saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save settings.";
      setSaveStatus({ kind: "error", message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogoUpload = async (file: File) => {
    setIsUploadingLogo(true);
    setSaveStatus(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads/logo", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) {
        throw new Error(data.error ?? "Failed to upload logo.");
      }

      setSettings((current) => ({ ...current, logoUrl: data.url as string }));
      setSaveStatus({ kind: "success", message: "Logo uploaded. Save to apply permanently." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to upload logo.";
      setSaveStatus({ kind: "error", message });
    } finally {
      setIsUploadingLogo(false);
      if (logoFileInputRef.current) {
        logoFileInputRef.current.value = "";
      }
    }
  };

  return (
    <div className="studio-page max-w-[1120px] pb-20">
      <header className="mb-8">
        <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface md:text-5xl">Settings</h1>
        <p className="mt-2 max-w-3xl text-lg leading-9 text-on-surface-variant">
          Configure your digital fingerprint. These settings are used directly in AI post generation.
        </p>
      </header>

      <div className="space-y-8">
        <section className="studio-card p-8">
          <SectionHead
            icon="record_voice_over"
            title="Tone & Voice"
            description="Define how your brand sounds in generated posts."
          />

          <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            Brand Name
          </label>
          <input
            value={settings.brandName}
            onChange={(e) => setSettings({ ...settings, brandName: e.target.value })}
            placeholder="e.g. TheGoGrow"
            className="mt-2 h-12 w-full rounded-xl border-none bg-surface-container px-4 text-sm"
          />

          <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            Primary Personality
          </label>
          <select
            value={settings.voice}
            onChange={(e) => setSettings({ ...settings, voice: e.target.value })}
            className="mt-2 h-12 w-full rounded-xl border-none bg-surface-container px-4 text-sm"
          >
            <option>Professional &amp; Authoritative</option>
            <option>Casual &amp; Playful</option>
            <option>Inspirational &amp; Bold</option>
            <option>Analytical &amp; Educational</option>
            <option>Friendly &amp; Conversational</option>
          </select>

          <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            Custom Voice Instructions
          </label>
          <textarea
            rows={4}
            value={settings.templates.custom_voice_instructions ?? ""}
            onChange={(e) =>
              setSettings({
                ...settings,
                templates: { ...settings.templates, custom_voice_instructions: e.target.value },
              })
            }
            className="mt-2 w-full rounded-xl border-none bg-surface-container px-4 py-3 text-sm"
            placeholder="e.g. Avoid jargon, prefer short sentences, end with a practical CTA."
          />

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                Educational Template
              </label>
              <input
                value={settings.templates.educational ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    templates: { ...settings.templates, educational: e.target.value },
                  })
                }
                className="mt-2 h-12 w-full rounded-xl border-none bg-surface-container px-4 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                Promotional Template
              </label>
              <input
                value={settings.templates.promotional ?? ""}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    templates: { ...settings.templates, promotional: e.target.value },
                  })
                }
                className="mt-2 h-12 w-full rounded-xl border-none bg-surface-container px-4 text-sm"
              />
            </div>
          </div>
        </section>

        <section className="studio-card p-8">
          <SectionHead
            icon="format_paint"
            title="Formatting Preferences"
            description="Control structure and post style for generated content."
          />

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-surface-container p-4">
              <div>
                <p className="font-semibold text-on-surface">Auto-Hashtagging</p>
                <p className="text-sm text-on-surface-variant">Append hashtags at the end of generated posts.</p>
              </div>
              <Toggle
                on={autoHashtaggingOn}
                onClick={() =>
                  setSettings({
                    ...settings,
                    style: {
                      ...settings.style,
                      hashtags: autoHashtaggingOn ? 0 : Math.max(settings.style.hashtags, 5),
                    },
                  })
                }
              />
            </div>

            <div className="rounded-xl bg-surface-container p-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="font-semibold text-on-surface">Hashtag Count</p>
                <span className="text-sm text-on-surface-variant">{settings.style.hashtags}</span>
              </div>
              <input
                type="range"
                min={0}
                max={15}
                value={settings.style.hashtags}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    style: { ...settings.style, hashtags: clampHashtags(Number(e.target.value)) },
                  })
                }
                className="w-full"
              />
            </div>

            <div className="rounded-xl bg-surface-container p-4">
              <p className="font-semibold text-on-surface">Emoji Usage</p>
              <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-container-low p-1">
                {(["none", "low", "high"] as const).map((value) => {
                  const isActive = settings.style.emojiUsage === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          style: { ...settings.style, emojiUsage: value },
                        })
                      }
                      className={`rounded-lg py-2 text-sm capitalize ${
                        isActive ? "bg-white font-semibold text-primary" : "text-on-surface"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            Preferred Post Length
          </label>
          <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-surface-container p-1">
            {([
              { value: "short", label: "Short (Byte)" },
              { value: "medium", label: "Medium (Standard)" },
              { value: "long", label: "Long (Epic)" },
            ] as const).map((option) => {
              const isActive = settings.style.paragraphLength === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setSettings({
                      ...settings,
                      style: { ...settings.style, paragraphLength: option.value },
                    })
                  }
                  className={`rounded-lg py-2 text-sm ${
                    isActive ? "bg-white font-semibold text-primary" : "text-on-surface"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="studio-card p-8">
          <SectionHead
            icon="palette"
            title="Brand Kit"
            description="Visual attributes used in image ideas for media generation prompts and styling."
          />

          <label className="mt-6 block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            Color Palette
          </label>
          <div className="mt-3 grid gap-4 md:grid-cols-2">
            <ColorField
              label="Primary"
              value={settings.colors.primary}
              onChange={(value) => setSettings({ ...settings, colors: { ...settings.colors, primary: value } })}
            />
            <ColorField
              label="Secondary"
              value={settings.colors.secondary}
              onChange={(value) => setSettings({ ...settings, colors: { ...settings.colors, secondary: value } })}
            />
          </div>

          <button
            type="button"
            onClick={() =>
              setSettings({
                ...settings,
                colors: { primary: settings.colors.secondary, secondary: settings.colors.primary },
              })
            }
            className="mt-4 rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface"
          >
            Swap Colors
          </button>

          <div className="mt-8 grid gap-5 md:grid-cols-2">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                Primary Typeface
              </label>
              <input
                value={settings.fonts.heading}
                onChange={(e) =>
                  setSettings({ ...settings, fonts: { ...settings.fonts, heading: e.target.value } })
                }
                className="mt-2 h-12 w-full rounded-xl border-none bg-surface-container px-4 text-sm"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
                Secondary Typeface
              </label>
              <input
                value={settings.fonts.body}
                onChange={(e) =>
                  setSettings({ ...settings, fonts: { ...settings.fonts, body: e.target.value } })
                }
                className="mt-2 h-12 w-full rounded-xl border-none bg-surface-container px-4 text-sm"
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <input
              ref={logoFileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  void handleLogoUpload(file);
                }
              }}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => logoFileInputRef.current?.click()}
              disabled={isUploadingLogo}
              className="rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface disabled:opacity-70"
            >
              {isUploadingLogo ? "Uploading..." : "Upload Logo"}
            </button>
            <p className="text-xs text-on-surface-variant">PNG, JPG, WEBP, SVG up to 2MB</p>
          </div>

          {settings.logoUrl ? (
            <div className="mt-4 rounded-xl bg-surface-container p-3">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">Logo Preview</p>
              <img src={settings.logoUrl} alt="Brand logo preview" className="mt-2 h-16 w-16 rounded-lg object-contain" />
            </div>
          ) : null}

          <div className="mt-6 rounded-2xl border border-outline-variant/30 bg-surface-container p-5">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">Live Preview</p>
            <p
              className="mt-2 text-xl"
              style={{
                color: settings.colors.primary,
                fontFamily: settings.fonts.heading,
              }}
            >
              {settings.brandName || "Your Brand"}
            </p>
            <p className="mt-2 text-sm text-on-surface-variant" style={{ fontFamily: settings.fonts.body }}>
              {settings.voice}
            </p>
          </div>
        </section>
      </div>

      <div className="mt-8 flex items-center justify-between gap-3">
        {saveStatus ? (
          <p className={`text-sm ${saveStatus.kind === "success" ? "text-green-700" : "text-red-600"}`}>
            {saveStatus.message}
          </p>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleDiscard}
            disabled={!isDirty || isSaving}
            className="rounded-xl px-5 py-3 text-sm font-semibold text-on-surface-variant disabled:cursor-not-allowed disabled:opacity-60"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="btn-gradient rounded-xl px-8 py-3 text-sm font-bold text-white disabled:opacity-70"
          >
            {isSaving ? "Saving..." : "Save Brand Profile"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionHead({ icon, title, description }: { icon: string; title: string; description: string }) {
  return (
    <div className="flex items-start gap-4">
      <div className="rounded-xl bg-primary-fixed p-3 text-primary">
        <span className="material-symbols-outlined text-[18px]">{icon}</span>
      </div>
      <div>
        <h2 className="font-headline text-[2rem] font-bold text-on-surface">{title}</h2>
        <p className="text-base text-on-surface-variant">{description}</p>
      </div>
    </div>
  );
}

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative h-7 w-12 rounded-full transition ${on ? "bg-primary" : "bg-surface-container-highest"}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${on ? "right-1" : "left-1"}`} />
    </button>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="rounded-xl bg-surface-container p-3">
      <p className="text-xs font-bold uppercase tracking-[0.15em] text-on-surface-variant">{label}</p>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-md border-none bg-transparent"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 flex-1 rounded-lg border-none bg-surface-container-low px-3 text-sm"
          placeholder="#173ce5"
        />
      </div>
    </div>
  );
}
