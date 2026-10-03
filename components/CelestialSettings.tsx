import React from 'react';
import type { AppSettings, StarLabelOption } from '../types';
import { applySkyPreset, selectedSkyPreset, SKY_PRESETS, SKY_DEFAULTS } from '../core/skySettings';

import { Section, Slider, Toggle, Segments, Select } from './settings/SettingsControls';

export default function CelestialSettings({ settings, onSettingsChange }: {
  settings: AppSettings; onSettingsChange: (settings: AppSettings) => void;
}) {
  const set = (patch: Partial<AppSettings>) => onSettingsChange({ ...settings, ...patch });
  const preset = selectedSkyPreset(settings);
  return <Section title="背景星空" theme="indigo">
    <Segments label="星空预设" value={preset} options={SKY_PRESETS.map(p => ({ value: p.id, label: p.label }))}
      onChange={value => onSettingsChange(applySkyPreset(settings, value))} />
    <p className="settings-note">{SKY_PRESETS.find(p => p.id === preset)?.description ?? '自定义 · 选择预设可恢复整套星空效果。'}</p>
    {settings.skyEnabled !== false && <>
    <Slider label="星光亮度" value={settings.useRealStars ? settings.realStarBrightnessMultiplier : settings.starBrightness}
      max={3}
      onChange={value => set(settings.useRealStars ? { realStarBrightnessMultiplier: value } : { starBrightness: value })} />
    <p className="settings-note">亮度均以默认效果为 100%。</p>
    <details className="settings-details">
      <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-200">高级设置 · 星表、标注与网格</summary>
      <div className="settings-details-content">
        <Select label="星空来源" value={settings.useRealStars ? 'catalog' : settings.background}
          onChange={value => set(value === 'catalog' ? { ...SKY_DEFAULTS } : { useRealStars: false, background: value as AppSettings['background'] })}>
          <option value="catalog">真实星表</option><option value="default">装饰星空</option><option value="milkyway">虚拟银河</option>
        </Select>
        {settings.useRealStars ? <>
          <p className="settings-note">XHIP · 8,876 颗恒星 · 全天 88 星座</p>
          <Slider label="极限星等" min={3} max={6.5} step={0.5} value={settings.realStarMagnitudeLimit}
            display={settings.realStarMagnitudeLimit.toFixed(1)} onChange={value => set({ realStarMagnitudeLimit: value })} />
          <p className="settings-note">数值越大，暗星越多。开启连线时保留星座构图所需的恒星。</p>
          <Toggle label="星座连线" checked={settings.showConstellations} onChange={value => set({ showConstellations: value })} />
          {settings.showConstellations && <Slider label="连线亮度" max={3} value={settings.constellationBrightnessMultiplier}
            onChange={value => set({ constellationBrightnessMultiplier: value })} />}
          <Toggle label="星座名称" checked={settings.showConstellationNames} onChange={value => set({ showConstellationNames: value })} />
          <Toggle label="星区范围" description="显示全天 88 星座的区域边界" checked={settings.showConstellationBoundaries} onChange={value => set({ showConstellationBoundaries: value })} />
          <Select label="亮星名称" value={settings.realStarLabels} onChange={value => set({ realStarLabels: value as StarLabelOption })}>
            <option value="none">关闭</option><option value="cn">中文</option><option value="bilingual">中英双语</option>
          </Select>
          {settings.realStarLabels !== 'none' && <Slider label="名称亮度" value={settings.starLabelBrightness}
            onChange={value => set({ starLabelBrightness: value })} />}
        </> : <Slider label="装饰恒星数量" min={500} max={5000} step={100} value={settings.starDensity}
          display={String(settings.starDensity)} onChange={value => set({ starDensity: value })} />}
        <div className="border-t border-gray-700/50 pt-3 space-y-3">
          <Toggle label="黄道网格" checked={settings.showEclipticGrid} onChange={value => set({ showEclipticGrid: value })} />
          <Toggle label="赤道网格" checked={settings.showEquatorialGrid} onChange={value => set({ showEquatorialGrid: value })} />
          {(settings.showEclipticGrid || settings.showEquatorialGrid) && <>
            <Slider label="网格亮度" step={0.01} value={settings.gridOpacity} onChange={value => set({ gridOpacity: value })} />
            <Toggle label="经线延伸至极点" checked={settings.convergeMeridians} onChange={value => set({ convergeMeridians: value })} />
          </>}
        </div>
      </div>
    </details>
    </>}
  </Section>;
}
