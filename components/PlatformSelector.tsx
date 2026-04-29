"use client";

import { PLATFORM_VARIANTS } from "@/lib/platform-variants";

type PlatformSelectorProps = {
  selected: string[];
  onChange: (platforms: string[]) => void;
};

const platformMeta: Record<
  (typeof PLATFORM_VARIANTS)[number]["platform"],
  { label: string; icon: string }
> = {
  linkedin: { label: "LinkedIn", icon: "business_center" },
  instagram: { label: "Instagram", icon: "photo_camera" },
  x: { label: "X", icon: "alternate_email" },
  facebook: { label: "Facebook", icon: "thumb_up" },
  tiktok: { label: "TikTok", icon: "music_note" },
};

export function PlatformSelector({ selected, onChange }: PlatformSelectorProps) {
  const togglePlatform = (platform: string) => {
    if (selected.includes(platform)) {
      onChange(selected.filter((item) => item !== platform));
      return;
    }

    onChange([...selected, platform]);
  };

  const groupedVariants = PLATFORM_VARIANTS.reduce<
    Partial<Record<(typeof PLATFORM_VARIANTS)[number]["platform"], typeof PLATFORM_VARIANTS>>
  >((acc, variant) => {
    const current = acc[variant.platform] ?? [];
    current.push(variant);
    acc[variant.platform] = current;
    return acc;
  }, {});

  return (
    <fieldset className="space-y-4 rounded-2xl border border-outline-variant/20 bg-surface-container-lowest p-4">
      <legend className="w-full">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-label text-[11px] font-bold uppercase tracking-[0.15em] text-on-surface-variant">
            Select Platform + Size
          </span>
          <span className="rounded-full bg-[#e7f2ff] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#144a8a]">
            Recommended Sizes
          </span>
        </div>
        <p className="mt-2 text-sm text-on-surface-variant">
          Pick one or more platform formats. Each option uses a recommended post dimension.
        </p>
      </legend>
      <div className="space-y-4">
        {Object.entries(groupedVariants).map(([platformKey, variants]) => {
          const platform = platformKey as (typeof PLATFORM_VARIANTS)[number]["platform"];
          const meta = platformMeta[platform];
          return (
            <section key={platform} className="rounded-xl border border-outline-variant/25 bg-white/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[18px] text-[#2a3f6f]">{meta.icon}</span>
                  <h3 className="font-label text-sm font-bold tracking-wide text-[#2a3f6f]">{meta.label}</h3>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-on-surface-variant/80">
                  {variants?.length ?? 0} sizes
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                {(variants ?? []).map((variant) => (
                  <button
                    type="button"
                    key={variant.id}
                    onClick={() => togglePlatform(variant.id)}
                    className={`group rounded-xl border px-3 py-3 text-left transition ${
                      selected.includes(variant.id)
                        ? "border-primary/70 bg-[#edf4ff] shadow-[0_6px_14px_rgba(12,74,168,0.14)]"
                        : "border-outline-variant/25 bg-surface-container-lowest hover:border-primary/35 hover:bg-white"
                    }`}
                  >
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-[#1f2d49]">{variant.shortLabel}</p>
                      {selected.includes(variant.id) ? (
                        <span
                          className="material-symbols-outlined text-[17px] text-primary"
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          check_circle
                        </span>
                      ) : (
                        <span className="material-symbols-outlined text-[17px] text-[#99a4c3] group-hover:text-primary">
                          radio_button_unchecked
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[#e8f1ff] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1e3f7a]">
                        {variant.size}
                      </span>
                      <span className="rounded-full bg-[#f2f4f8] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#4a5878]">
                        {variant.aspectRatio}
                      </span>
                      {variant.recommended ? (
                        <span className="rounded-full bg-[#e9f8ef] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#1f7a45]">
                          Rec
                        </span>
                      ) : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </fieldset>
  );
}
