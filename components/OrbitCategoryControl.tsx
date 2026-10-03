import React from 'react';
import type { AppSettings, OrbitCategory } from '../types';
import { categoryOrbitOpacity, ORBIT_CATEGORIES } from '../core/orbitCategories';

export default function OrbitCategoryControl({category,settings,onSettingsChange}:{
  category:OrbitCategory;settings:AppSettings;onSettingsChange:(settings:AppSettings)=>void;
}) {
  const percent=Math.round(categoryOrbitOpacity(settings,category)*100);
  return <label className="flex items-center gap-1.5 shrink-0 text-[10px] font-normal text-gray-500" title={`${ORBIT_CATEGORIES[category].label}轨道可见度`}>
    <span>轨道</span>
    <input type="range" min="0" max="100" step="1" value={percent}
      aria-label={`${ORBIT_CATEGORIES[category].label}轨道可见度`} aria-valuetext={`${percent}%`}
      onChange={e=>onSettingsChange({...settings,orbitCategoryOpacity:{...settings.orbitCategoryOpacity,[category]:Number(e.target.value)/100}})}
      className="w-16 sm:w-20 h-5 cursor-pointer accent-slate-400" />
    <output className="w-7 text-right tabular-nums">{percent}%</output>
  </label>;
}
