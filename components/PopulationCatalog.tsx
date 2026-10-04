import React from 'react';
import type { AppSettings, SmallBodyPopulation } from '../types';
import { SMALL_BODY_POPULATIONS, populationVisible, setPopulationVisible, TROJAN_DISTRIBUTION } from '../data/populations';

export default function PopulationCatalog({settings,onSettingsChange,onInspect,showIds=false}:{
  settings:AppSettings;onSettingsChange:(settings:AppSettings)=>void;
  onInspect:(population:SmallBodyPopulation)=>void;showIds?:boolean;
}) {
  return <>{SMALL_BODY_POPULATIONS.map(population=><div key={population.id} data-population={population.id}
    className="flex items-center justify-between gap-2 p-2 rounded border border-gray-700/50 bg-gray-800/30 hover:bg-gray-700/50">
    <div className="flex items-center gap-2 min-w-0">
      {population.id === 'main-asteroid-belt' && <input id={`population-${population.id}`} type="checkbox" aria-label={`显示${population.name}`} checked={populationVisible(population,settings)}
        onChange={e=>onSettingsChange(setPopulationVisible(settings,population.id,e.target.checked))}
        className="w-3.5 h-3.5 shrink-0 rounded accent-blue-500" />}
      <label htmlFor={population.id === 'main-asteroid-belt' ? `population-${population.id}` : undefined} className="text-xs font-medium text-gray-200 truncate" title={population.englishName}>{showIds?population.id:population.name}</label>
    </div>
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] text-gray-500">族群</span>
      <button type="button" onClick={()=>onInspect(population)} aria-label={`查看${population.name}参数`} title="分布参数"
        className="p-1 rounded text-gray-400 hover:text-blue-300 hover:bg-blue-900/20">
        <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/></svg>
      </button>
    </div>
  </div>)}</>;
}

export function PopulationParameters({population,onClose}:{population:SmallBodyPopulation;onClose:()=>void}) {
  const rows=[
    ['类型','小天体族群'],['模型','统计分布示意'],
    ['分布',population.distribution==='trojan'?'L4 / L5 共轨双簇':'环带'],
    ...(population.distribution==='trojan' ? [
      ['典型距离',`${population.semiMajorAxisAU.join('–')} AU`],
      ['聚集位置','木星前后约 60°'],
      ['径向散布',`${TROJAN_DISTRIBUTION.radialFraction.join('–')} × 木星距离`],
      ['摆动幅度',`${TROJAN_DISTRIBUTION.librationAmplitudeDeg.join('–')}°`],
      ['摆动周期',`${TROJAN_DISTRIBUTION.librationPeriodYears} 年`],
    ] : [
      ['半长轴范围',`${population.semiMajorAxisAU.join('–')} AU`],
      ['离心率范围',population.eccentricity.join('–')],
    ]),
    ['最大倾角',`${population.maxInclinationDeg}°`],
    ['参考天体',population.referenceBodyId==='jupiter'?'木星':'太阳'],
  ];
  return <div data-population-parameters={population.id} className="flex-1 md:flex-none md:w-[40%] flex flex-col bg-gray-900 border-l border-gray-700/50 min-h-0 absolute md:relative inset-0 z-20">
    <div className="p-4 border-b border-gray-700/50 flex items-center justify-between gap-2">
      <h3 className="text-sm font-semibold text-gray-200">{population.name}</h3>
      <button type="button" onClick={onClose} aria-label="关闭族群参数" className="p-2 text-gray-400 hover:text-white">×</button>
    </div>
    <div className="p-4 overflow-y-auto">
      <dl className="space-y-3 text-xs">{rows.map(([name,value])=><div key={name} className="flex justify-between gap-4">
        <dt className="text-gray-500">{name}</dt><dd className="text-gray-200 tabular-nums text-right">{value}</dd>
      </div>)}</dl>
      <a href={population.sourceUrl} target="_blank" rel="noreferrer" className="inline-block mt-6 text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">资料来源</a>
    </div>
  </div>;
}
