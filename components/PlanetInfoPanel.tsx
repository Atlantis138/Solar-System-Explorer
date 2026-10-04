import {InspectorHeader,InspectorAction} from './InspectorControls';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlanetData, SearchResponse } from '../types';
import { describeBodyMotion } from '../utils/astronomy';
import { askGeminiAboutSpace } from '../services/geminiService';

interface PlanetInfoPanelProps {
  selectedPlanet: PlanetData | null;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  isPinned: boolean;
  onToggleFollow: (id: string) => void;
  isFollowing: boolean;
  isFollowingSystem: boolean;
  trueScale: boolean;
  currentDate: Date;
  useHighPrecision: boolean;
  allBodies: PlanetData[];
}

const PlanetInfoPanel: React.FC<PlanetInfoPanelProps> = ({ 
  selectedPlanet, onClose, onTogglePin, isPinned, onToggleFollow, isFollowing, isFollowingSystem, trueScale, currentDate, useHighPrecision, allBodies
}) => {
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState<SearchResponse | null>(null);
  const [customQuery, setCustomQuery] = useState('');
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedPlanet) {
      setInfo(null);
      setCustomQuery('');
      fetchInitialInfo(selectedPlanet.name);
    }
  }, [selectedPlanet]);

  const isSatellite = useMemo(() => {
    if (!selectedPlanet) return false;
    for (const p of allBodies) {
      if (p.satellites?.some(s => s.id === selectedPlanet.id)) return true;
    }
    return false;
  }, [selectedPlanet, allBodies]);

  const motion = useMemo(() => selectedPlanet
    ? describeBodyMotion(selectedPlanet,allBodies,currentDate,useHighPrecision) : null,
    [selectedPlanet,allBodies,currentDate,useHighPrecision]);

  const isSun = selectedPlanet?.id === 'sun';

  const fetchInitialInfo = async (planetName: string) => {
    setLoading(true);
    const query = `关于${planetName}的最新科学发现或有趣事实 (Latest scientific facts about ${planetName})`;
    const result = await askGeminiAboutSpace(query);
    setInfo(result);
    setLoading(false);
  };

  const handleCustomSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuery.trim()) return;
    setLoading(true);
    const result = await askGeminiAboutSpace(customQuery);
    setInfo(result);
    setLoading(false);
  };

  if (!selectedPlanet) return null;

  const a = selectedPlanet.elements.a;
  const e = selectedPlanet.elements.e;
  const perihelion = a * (1 - e);
  const aphelion = a * (1 + e);
  const followLabel = isFollowing ? `停止跟随${selectedPlanet.name}` : `跟随${selectedPlanet.name}`;
  const systemLabel = !trueScale ? '质心绕转仅在真实比例大小模式下可用' : isFollowingSystem ? '返回太阳系总览' : `查看${selectedPlanet.name}的质心绕转`;

  return (
    <div className="inspector-content planet-info-content">
      <InspectorHeader name={selectedPlanet.name} subtitle={selectedPlanet.englishName} color={selectedPlanet.color}/>
      <div className="inspector-actions" role="group" aria-label="视角与标记">
        <InspectorAction kind="look" label={followLabel} active={isFollowing} onClick={()=>onToggleFollow(selectedPlanet.id)}>{isFollowing?'停止跟随':'跟随'}</InspectorAction>
        <InspectorAction kind="orbit" label={systemLabel} active={isFollowingSystem} disabled={!trueScale} onClick={()=>onToggleFollow(`barycenter:${selectedPlanet.id}`)}>质心环绕</InspectorAction>
        {!isSun&&<InspectorAction kind="pin" label={isPinned?'取消订选':'订选天体'} active={isPinned} onClick={()=>onTogglePin(selectedPlanet.id)}>{isPinned?'已订选':'订选'}</InspectorAction>}
      </div>
      {selectedPlanet.description && <p className="text-xs leading-relaxed text-gray-300 mb-3">{selectedPlanet.description}</p>}
      {selectedPlanet.dataSource?.startsWith('https://') && <a href={selectedPlanet.dataSource} target="_blank" rel="noreferrer" className="inline-block text-xs text-blue-300 mb-4 underline underline-offset-2">内置轨道与尺寸数据说明 ↗</a>}

      {motion && <div data-motion-model className="mb-3 text-xs leading-relaxed">
        <p className="text-gray-400">运动依据：<span className="text-blue-200">{motion.label}</span></p>
        <p className="text-gray-500 mt-1">{motion.note}</p>
        {selectedPlanet.dataWarnings?.map(message=><p key={message} className="text-amber-300 mt-1">{message}</p>)}
      </div>}

      {!isSun && (
        <div className="bg-gray-800/50 rounded-lg p-2 mb-3 border border-gray-700">
          <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3">轨道参数</h4>
          {(isSatellite || selectedPlanet.orbitReference === 'system-barycenter') && <p className="text-xs text-gray-500 mb-3">{isSatellite ? '以下参数描述相对母体的轨道。' : '以下参数描述该天体系统质心的绕日轨道。'}</p>}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="text-gray-400">半长轴 (AU):</div><div className="text-right font-mono text-blue-300">{isSatellite ? a.toPrecision(5) : a.toFixed(3)}</div>
            <div className="text-gray-400">离心率 (e):</div><div className="text-right font-mono text-blue-300">{e.toFixed(4)}</div>
            <div className="text-gray-400">倾角 (i):</div><div className="text-right font-mono text-blue-300">{selectedPlanet.elements.i.toFixed(2)}°</div>
            <div className="col-span-2 h-px bg-gray-700 my-1"></div>
            <div className="text-gray-400">{isSatellite ? '近拱点 (Peri):' : '近日点 (Peri):'}</div><div className="text-right font-mono text-green-300">{isSatellite ? perihelion.toPrecision(5) : perihelion.toFixed(3)} AU</div>
            <div className="text-gray-400">{isSatellite ? '远拱点 (Aphe):' : '远日点 (Aphe):'}</div><div className="text-right font-mono text-green-300">{e > 1 ? '无（开放轨道）' : `${isSatellite ? aphelion.toPrecision(5) : aphelion.toFixed(3)} AU`}</div>
          </div>
          {selectedPlanet.elements.perihelionTimeJD !== undefined && <p className="mt-3 text-xs text-gray-400">
            近日点：{new Date((selectedPlanet.elements.perihelionTimeJD-2440587.5)*86400000).toISOString().slice(0,10)} · {selectedPlanet.interstellar ? '星际来访' : '目录日期'}
          </p>}
          {selectedPlanet.id === 'pluto'  && <p className="mt-3 text-xs leading-relaxed text-gray-500">卡戎采用近圆开普勒模型；高精度模式下，系统位置使用引擎星历，内部绕转仍为近似。</p>}
        </div>
      )}

      <div className="mb-3">
        <h4 className="text-xs font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>AI 知识库</h4>
        <div ref={resultRef} className="bg-gray-800 rounded-lg p-2 border border-gray-600 min-h-[70px] relative">
          {loading ? (
            <div className="flex items-center justify-center h-16 space-x-2"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div></div>
          ) : info ? (
            <>
              <div className="prose prose-invert text-xs leading-relaxed whitespace-pre-wrap">{info.text}</div>
              {info.groundingChunks.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-500 mb-2">来源 (Sources):</p>
                  <ul className="space-y-1">
                    {info.groundingChunks.map((chunk, idx) => (
                      <li key={idx}><a href={chunk.web?.uri} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:underline truncate block">{chunk.web?.title || chunk.web?.uri}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : <div className="text-gray-500 text-center text-xs py-8">准备搜索...</div>}
        </div>
      </div>

      <form onSubmit={handleCustomSearch} className="mt-4">
        <label className="text-xs text-gray-400 block mb-2">了解更多</label>
        <div className="flex gap-2">
          <input type="text" value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder={`例如：${selectedPlanet.name}有几个卫星？`} className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-white placeholder-gray-600" />
          <button type="submit" disabled={loading || !customQuery.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-xs font-medium transition-colors">查询</button>
        </div>
      </form>
    </div>
  );
};

export default PlanetInfoPanel;
