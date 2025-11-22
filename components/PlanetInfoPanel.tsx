
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PlanetData, SearchResponse } from '../types';
import { askGeminiAboutSpace } from '../services/geminiService';

interface PlanetInfoPanelProps {
  selectedPlanet: PlanetData | null;
  onClose: () => void;
  onTogglePin: (id: string) => void;
  isPinned: boolean;
  onToggleFollow: (id: string) => void;
  isFollowing: boolean;
  allBodies: PlanetData[];
}

const PlanetInfoPanel: React.FC<PlanetInfoPanelProps> = ({ 
  selectedPlanet, onClose, onTogglePin, isPinned, onToggleFollow, isFollowing, allBodies
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

  return (
    <div className="fixed top-0 right-0 h-full w-80 md:w-96 max-w-[85vw] bg-gray-900/95 backdrop-blur-md border-l border-gray-700 shadow-2xl text-white p-6 transform transition-transform duration-300 overflow-y-auto z-50">
      <div className="absolute top-4 right-4 flex items-center gap-2">
        {!isSatellite && (
            <button onClick={() => onToggleFollow(selectedPlanet.id)} className={`p-2 rounded-full transition-colors ${isFollowing ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`} title={isFollowing ? "Stop Following" : "Follow Camera"}><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
        )}
        {!isSun && (
            <button onClick={() => onTogglePin(selectedPlanet.id)} className={`p-2 rounded-full transition-colors ${isPinned ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'}`} title={isPinned ? "Unpin Planet" : "Pin Planet"}>{isPinned ? <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" /></svg> : <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12M8.8 14L10 12.8V4H14V12.8L15.2 14H8.8Z" /></svg>}</button>
        )}
        <div className="w-px h-6 bg-gray-700 mx-1"></div>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
      </div>

      <h2 className="text-3xl font-bold mb-2 text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mt-2">{selectedPlanet.name}</h2>
      <h3 className="text-lg text-gray-400 mb-6 font-mono">{selectedPlanet.englishName}</h3>

      {!isSun && (
        <div className="bg-gray-800/50 rounded-lg p-4 mb-6 border border-gray-700">
          <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">轨道参数 (Orbital Stats)</h4>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="text-gray-400">半长轴 (AU):</div><div className="text-right font-mono text-blue-300">{a.toFixed(3)}</div>
            <div className="text-gray-400">离心率 (e):</div><div className="text-right font-mono text-blue-300">{e.toFixed(4)}</div>
            <div className="text-gray-400">倾角 (i):</div><div className="text-right font-mono text-blue-300">{selectedPlanet.elements.i.toFixed(2)}°</div>
            <div className="col-span-2 h-px bg-gray-700 my-1"></div>
            <div className="text-gray-400">近日点 (Peri):</div><div className="text-right font-mono text-green-300">{perihelion.toFixed(3)} AU</div>
            <div className="text-gray-400">远日点 (Aphe):</div><div className="text-right font-mono text-green-300">{aphelion.toFixed(3)} AU</div>
          </div>
        </div>
      )}

      <div className="mb-6">
        <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>AI 知识库 (Gemini Knowledge)</h4>
        <div ref={resultRef} className="bg-gray-800 rounded-lg p-4 border border-gray-600 min-h-[150px] relative">
          {loading ? (
            <div className="flex items-center justify-center h-32 space-x-2"><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div><div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div></div>
          ) : info ? (
            <>
              <div className="prose prose-invert text-sm leading-relaxed whitespace-pre-wrap">{info.text}</div>
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
          ) : <div className="text-gray-500 text-center text-sm py-8">准备搜索...</div>}
        </div>
      </div>

      <form onSubmit={handleCustomSearch} className="mt-4">
        <label className="text-xs text-gray-400 block mb-2">想了解更多？(Ask specific details)</label>
        <div className="flex gap-2">
          <input type="text" value={customQuery} onChange={(e) => setCustomQuery(e.target.value)} placeholder={`例如：${selectedPlanet.name}有几个卫星？`} className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 text-white placeholder-gray-600" />
          <button type="submit" disabled={loading || !customQuery.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors">Go</button>
        </div>
      </form>
    </div>
  );
};

export default PlanetInfoPanel;
