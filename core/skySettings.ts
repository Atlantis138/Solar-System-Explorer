import type { AppSettings } from '../types';

export const SKY_SETTINGS_VERSION = 3;
// All UI brightness values are gains: 1 = the agreed reference appearance.
// Keep the rendering calibration here so a 100% label never changes the image.
export const SKY_BRIGHTNESS_BASE = {
  realStarBrightnessMultiplier: 2,
  constellationBrightnessMultiplier: 1.2,
  starLabelBrightness: 0.45,
  gridOpacity: 0.22,
  starBrightness: 0.5,
} as const;

export const SKY_PRESETS = [
  { id: 'none', label: '无', description: '纯净背景，关闭恒星、连线、名称与网格。', values: { skyEnabled: false } },
  { id: 'quiet', label: '简洁', description: '只保留较亮恒星，不显示连线与名称。', values: {
    skyEnabled: true, realStarMagnitudeLimit: 5.5, realStarBrightnessMultiplier: 0.275,
    realStarLabels: 'none', showConstellations: false,
  } },
  { id: 'rich', label: '丰富', description: '默认 · 6.0 等真实星空、星座连线与中文亮星名称。', values: {
    skyEnabled: true, realStarMagnitudeLimit: 6, realStarBrightnessMultiplier: 1,
    realStarLabels: 'cn', showConstellations: true,
  } },
] as const;

export const SKY_DEFAULTS = {
  ...SKY_PRESETS[2].values,
  showConstellationNames: false, showConstellationBoundaries: false,
  useRealStars: true, constellationBrightnessMultiplier: 1, starLabelBrightness: 1,
  showEclipticGrid: false, showEquatorialGrid: false, gridOpacity: 1,
  convergeMeridians: false, skySettingsVersion: SKY_SETTINGS_VERSION,
} satisfies Partial<AppSettings>;

export function applySkyPreset(settings: AppSettings, id: string): AppSettings {
  const preset = SKY_PRESETS.find(p => p.id === id);
  return preset ? { ...settings, ...SKY_DEFAULTS, ...preset.values } : settings;
}

export function selectedSkyPreset(settings: AppSettings): string | undefined {
  if (settings.skyEnabled === false) return 'none';
  return SKY_PRESETS.find(p => Object.entries({ ...SKY_DEFAULTS, ...p.values })
    .every(([key, value]) => settings[key as keyof AppSettings] === value))?.id;
}

/** Convert saved brightness units once, preserving custom rendered appearances. */
export function migrateSkySettings(saved: Partial<AppSettings>): Partial<AppSettings> {
  if ((saved.skySettingsVersion ?? 0) >= SKY_SETTINGS_VERSION) return saved;
  const result = { ...saved, skySettingsVersion: SKY_SETTINGS_VERSION };
  for (const key of Object.keys(SKY_BRIGHTNESS_BASE) as (keyof typeof SKY_BRIGHTNESS_BASE)[]) {
    if (typeof saved[key] === 'number') result[key] = saved[key] / SKY_BRIGHTNESS_BASE[key];
  }
  // Move the previous untouched default to the newly requested default.
  const oldQuiet = saved.realStarBrightnessMultiplier === 0.55 && saved.realStarMagnitudeLimit === 5.5;
  const oldOriginal = (saved.skySettingsVersion ?? 0) < 2 && saved.realStarBrightnessMultiplier === 1 &&
    (saved.realStarMagnitudeLimit ?? 6.5) === 6.5;
  if ((oldQuiet || oldOriginal) && saved.showConstellations === false && saved.realStarLabels === 'none' &&
      !saved.showEclipticGrid && !saved.showEquatorialGrid &&
      (saved.starLabelBrightness === undefined || saved.starLabelBrightness === 0.45) &&
      (saved.constellationBrightnessMultiplier === undefined || saved.constellationBrightnessMultiplier === (oldQuiet ? 0.6 : 1))) {
    Object.assign(result, SKY_DEFAULTS, { useRealStars: saved.useRealStars ?? true });
  }
  return result;
}
