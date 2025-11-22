import React, { useState } from 'react';
import { EventType, SearchSpeed, SearchState, AppSettings, PlanetData } from '../types';

interface EventsPanelProps {
  searchState: SearchState;
  onSearch: (type: EventType, targetIds: string[], speed: SearchSpeed, strictMode?: boolean, config?: { tolerance: number, solarRadius: number }) => void;
  onCancel: () => void;
  onClose: () => void;
  onSpeedChange: (speed: SearchSpeed) => void;
  isPinned: boolean;
  onTogglePin: () => void;
  allowCalculationSearch: boolean;
  continuousIteration: boolean;
  onStartCalculation: (type: EventType, targetIds: string[], strictMode?: boolean, config?: { tolerance: number, solarRadius: number }) => void;
  onJumpToStart: () => void;
  onJumpToOptimal: () => void;
  onComplete: () => void;
  onRestart: () => void;
  onPauseContinuous: () => void;
  onContinueContinuous: () => void;
  onEndContinuous: () => void;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onSearchNext: () => void;
  allPlanets: PlanetData[];
}

const EventsPanel: React.FC<EventsPanelProps> = ({ 
  searchState, onSearch, onCancel, onClose, onSpeedChange, isPinned, onTogglePin,
  allowCalculationSearch, continuousIteration, onStartCalculation,
  onJumpToStart, onJumpToOptimal, onComplete, onRestart,
  onPauseContinuous, onContinueContinuous, onEndContinuous,
  settings, onSettingsChange, onSearchNext, allPlanets
}) => {
  const [expandedAlignment, setExpandedAlignment] = useState(false);
  const [expandedTransit, setExpandedTransit] = useState(true);
  const [strictTransitMode, setStrictTransitMode] = useState(false);
  
  const [selectedAlignPlanets, setSelectedAlignPlanets] = useState<string[]>(['mars', 'jupiter']); 
  const [selectedTransitPlanets, setSelectedTransitPlanets] = useState<string[]>(['mercury']);
  const [searchSpeed, setSearchSpeed] = useState<SearchSpeed>('medium');

  const availablePlanets = allPlanets.filter(p => p.id !== 'earth');
  const transitCandidates = allPlanets.filter(p => p.id === 'mercury' || p.id === 'venus');

  const handleAlignToggle = (id: string) => {
    setSelectedAlignPlanets(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleTransitToggle = (id: string) => {
    setSelectedTransitPlanets(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const handleTransitToleranceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (searchState.active) return;
    onSettingsChange({ ...settings, transitTolerance: parseFloat(e.target.value) });
  };

  const handleSolarRadiusChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (searchState.active) return;
    onSettingsChange({ ...settings, strictSolarRadius: parseFloat(e.target.value) });
  };

  const handleAlignmentToleranceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (searchState.active) return;
    onSettingsChange({ ...settings, alignmentTolerance: parseFloat(e.target.value) });
  };

  const handleStartAlignment = () => {
    if (selectedAlignPlanets.length < 2) return;
    const config = { tolerance: settings.alignmentTolerance, solarRadius: 0 }; 
    if (allowCalculationSearch) onStartCalculation('PLANETARY_ALIGNMENT', selectedAlignPlanets, false, config);
    else onSearch('PLANETARY_ALIGNMENT', selectedAlignPlanets, searchSpeed, false, config);
  };

  const handleStartTransit = () => {
    if (selectedTransitPlanets.length < 1) return;
    const config = { tolerance: settings.transitTolerance, solarRadius: settings.strictSolarRadius };
    if (allowCalculationSearch) onStartCalculation('TRANSIT', selectedTransitPlanets, strictTransitMode, config);
    else onSearch('TRANSIT', selectedTransitPlanets, searchSpeed, strictTransitMode, config);
  };

  const handleSpeedSelect = (s: SearchSpeed) => {
    setSearchSpeed(s);
    if (searchState.active) onSpeedChange(s);
  };

  const speedOptions: SearchSpeed[] = ['low', 'medium', 'high'];
  const formatResultDate = (timestamp: number | undefined) => timestamp ? `${new Date(timestamp).getFullYear()}/${new Date(timestamp).getMonth()+1}/${new Date(timestamp).getDate()}` : 'N/A';
  const formatDuration = (start?: number, end?: number) => {
    if (!start || !end) return 'N/A';
    const ms = end - start;
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    if (days < 1) return `${(ms / (1000 * 60 * 60)).toFixed(1)} Hours`;
    return `${days + 1} Days`;
  };

  return (
    <div className="fixed top-24 left-8 z-40 flex flex-col shadow-2xl" style={{ maxHeight: 'calc(100vh - 150px)' }}>
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-5 w-80 shadow-2xl backdrop-blur-md overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2"><svg className="w-5 h-5 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>天象搜寻 (Events)</h2>
          <div className="flex items-center gap-1">
            <button onClick={onTogglePin} className={`p-1.5 rounded-full transition-colors ${isPinned ? 'text-blue-400 bg-blue-900/30' : 'text-gray-500 hover:text-gray-300'}`}>{isPinned ? <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" /></svg> : <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12M8.8 14L10 12.8V4H14V12.8L15.2 14H8.8Z" /></svg>}</button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white transition-colors"><svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
          </div>
        </div>
        
        {searchState.active ? (
          <div className="text-center py-4">
             {continuousIteration ? (
                <>
                   <div className="w-12 h-12 bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500 relative"><svg className="w-6 h-6 text-blue-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></div>
                   <p className="text-md font-bold text-white mb-1">持续遍历中 (Searching...)</p>
                   <p className="text-xs text-gray-400 mb-3">Found: {searchState.foundEvents.length}</p>
                   {searchState.continuousPaused ? (
                      <div className="grid grid-cols-2 gap-2 mt-3">
                        <button onClick={onContinueContinuous} className="py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium">继续 (Continue)</button>
                        <button onClick={onEndContinuous} className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium">结束 (End)</button>
                      </div>
                   ) : (
                      <button onClick={onPauseContinuous} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium">暂停 (Pause)</button>
                   )}
                </>
             ) : (
                <>
                  <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <p className="text-md font-bold text-white mb-1">正在搜寻 (Searching)...</p>
                  <p className="text-xs text-gray-400 mb-4 font-mono">{searchState.status}</p>
                  <div className="mb-4 bg-gray-800 rounded-lg p-2 flex justify-between gap-1">
                      {speedOptions.map((s) => (
                        <button key={s} onClick={() => handleSpeedSelect(s)} className={`px-2 py-1 text-[10px] rounded capitalize transition-colors flex-1 ${searchSpeed === s ? 'bg-purple-600 text-white font-bold' : 'text-gray-400 hover:text-white'}`}>{s}</button>
                      ))}
                  </div>
                  <button onClick={onCancel} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">停止 (Stop)</button>
                </>
             )}
          </div>
        ) : searchState.isCalculating ? (
          <div className="text-center py-4">
            {searchState.continuousPaused ? (
               <>
                  <div className="w-12 h-12 bg-yellow-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-yellow-500"><svg className="w-6 h-6 text-yellow-400" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg></div>
                  <p className="text-md font-bold text-white mb-1">已暂停 (Paused)</p>
                  <div className="grid grid-cols-2 gap-2">
                      <button onClick={onContinueContinuous} className="py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">继续 (Continue)</button>
                      <button onClick={onEndContinuous} className="py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">结束 (End)</button>
                  </div>
               </>
            ) : (
               <>
                  <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 border border-purple-500/50 relative"><svg className="w-6 h-6 text-purple-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg></div>
                  <p className="text-md font-bold text-white mb-1">{continuousIteration ? '持续遍历中 (Iterating)...' : '正在计算 (Calculating)...'}</p>
                  <div className="mb-3 text-xs text-gray-400 bg-gray-800 p-2 rounded border border-gray-700">Scanning Year: <span className="text-blue-300 font-mono">{new Date(searchState.currentScanDate).getFullYear()}</span></div>
                  {continuousIteration ? (
                      <div className="space-y-2">
                         <div className="text-xs text-gray-500">Found: {searchState.foundEvents.length} | Limit: 50</div>
                         <button onClick={onPauseContinuous} className="w-full py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm font-medium transition-colors">暂停 (Pause)</button>
                      </div>
                  ) : <button onClick={onCancel} className="w-full py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors">停止 (Stop)</button>}
               </>
            )}
          </div>
        ) : (searchState.calculationResult && !continuousIteration) ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-green-500"><svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div>
            <p className="text-md font-bold text-white mb-3">搜索完成 (Found)</p>
            <div className="bg-gray-800/60 rounded p-2 mb-4 border border-gray-700 text-left">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider">Event Window</p>
              <p className="text-xs text-gray-200 font-mono mt-1">{formatResultDate(searchState.resultStartDate)} - {formatResultDate(searchState.resultEndDate)}</p>
              <p className="text-xs text-gray-500 font-mono text-right mt-1">Duration: {formatDuration(searchState.resultStartDate, searchState.resultEndDate)}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-4">
                <button onClick={onJumpToStart} className="py-2 bg-blue-900/60 hover:bg-blue-800 border border-blue-700/50 text-white rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5"><span className="text-xs font-medium">跳转到开始</span></button>
                <button onClick={onJumpToOptimal} className="py-2 bg-green-900/60 hover:bg-green-800 border border-green-700/50 text-white rounded-lg transition-colors flex flex-col items-center justify-center gap-0.5"><span className="text-xs font-medium">跳转到最优</span></button>
            </div>
            <button onClick={onSearchNext} className="w-full mb-2 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">寻找下一个 (Search Next)</button>
            <button onClick={onComplete} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">完成 (Complete)</button>
          </div>
        ) : (continuousIteration && (searchState.foundEvents.length > 0 || searchState.completed) && !searchState.isCalculating && !searchState.active) ? (
           <div className="text-center py-4">
              <div className="w-12 h-12 bg-blue-900/50 rounded-full flex items-center justify-center mx-auto mb-3 border border-blue-500"><svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg></div>
              <p className="text-md font-bold text-white mb-1">遍历结束 (Completed)</p>
              <div className="space-y-2">
                 <button onClick={onRestart} className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors">再一轮遍历 (Again)</button>
                 <button onClick={onComplete} className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors">返回菜单 (Back)</button>
              </div>
           </div>
        ) : (
          <div className="space-y-3">
            {!allowCalculationSearch && !continuousIteration && (
                <div className="mb-4">
                    <label className="text-xs text-gray-400 block mb-2">Search Speed (速度):</label>
                    <div className="bg-gray-800 rounded-lg p-1 flex justify-between gap-1">{speedOptions.map((s) => <button key={s} onClick={() => handleSpeedSelect(s)} className={`flex-1 py-1 text-[10px] rounded capitalize transition-colors ${searchSpeed === s ? 'bg-gray-600 text-white font-bold shadow' : 'text-gray-500 hover:text-gray-300'}`}>{s}</button>)}</div>
                </div>
            )}
            {continuousIteration && <div className="mb-2 px-3 py-2 bg-green-900/30 border border-green-500/30 rounded text-xs text-green-200"><span className="font-bold">持续遍历模式 (Continuous):</span> 自动寻找后续天象，结果将显示在右侧列表。</div>}
            {!continuousIteration && allowCalculationSearch && <div className="mb-2 px-3 py-2 bg-purple-900/30 border border-purple-500/30 rounded text-xs text-purple-200"><span className="font-bold">计算模式 (Calc Mode):</span> 快速计算下一个天象。</div>}

            <div className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
              <button onClick={() => setExpandedTransit(!expandedTransit)} className="w-full text-left p-3 flex justify-between items-center hover:bg-gray-700 transition-colors">
                <div><div className="font-medium text-gray-200 text-sm">行星凌日 (Transit)</div><span className="text-[10px] text-gray-500 block">Pass between Earth & Sun</span></div>
                <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedTransit ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {expandedTransit && (
                <div className="p-3 border-t border-gray-700 bg-gray-900/50">
                   <div className="mb-3 bg-gray-800 p-2 rounded border border-gray-700/50">
                        <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-400">容差 (Tolerance)</span><span className="text-purple-400 text-xs font-mono">{settings.transitTolerance.toFixed(1)}°</span></div>
                        <input type="range" min="0" max="10" step="0.1" value={settings.transitTolerance} onChange={handleTransitToleranceChange} disabled={strictTransitMode} className={`w-full h-1.5 rounded-lg appearance-none cursor-pointer focus:outline-none ${strictTransitMode ? 'bg-gray-600 cursor-not-allowed' : 'bg-gray-600'}`} />
                   </div>
                   <div className="flex items-center justify-between mb-3 bg-gray-800 p-2 rounded border border-gray-700/50">
                        <div className="flex flex-col"><span className="text-gray-200 text-xs font-medium">严格模式 (Strict)</span><span className="text-gray-500 text-[9px]">Use Solar Angular Size</span></div>
                        <div onClick={() => setStrictTransitMode(!strictTransitMode)} className={`w-9 h-5 flex items-center rounded-full p-0.5 cursor-pointer duration-300 ease-in-out ${strictTransitMode ? 'bg-purple-600' : 'bg-gray-700'}`}><div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${strictTransitMode ? 'translate-x-4' : ''}`} /></div>
                   </div>
                   {strictTransitMode && (
                      <div className="mb-3 bg-gray-800 p-2 rounded border border-purple-500/30 animate-fade-in">
                            <div className="flex justify-between items-center mb-1"><span className="text-xs text-purple-300">太阳角半径</span><span className="text-purple-400 text-xs font-mono">{settings.strictSolarRadius.toFixed(3)}°</span></div>
                            <input type="range" min="0.1" max="0.5" step="0.005" value={settings.strictSolarRadius} onChange={handleSolarRadiusChange} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none" />
                      </div>
                   )}
                  <div className="flex gap-4 mb-3">{transitCandidates.map(p => <label key={p.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white"><input type="checkbox" checked={selectedTransitPlanets.includes(p.id)} onChange={() => handleTransitToggle(p.id)} className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500" />{p.name}</label>)}</div>
                  <button onClick={handleStartTransit} disabled={selectedTransitPlanets.length === 0} className={`w-full py-2 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors ${allowCalculationSearch || continuousIteration ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}>{continuousIteration ? '开始持续遍历 (Start Loop)' : allowCalculationSearch ? '开始计算 (Calculate)' : '开始搜寻 (Start)'}</button>
                </div>
              )}
            </div>

            <div className="rounded-lg bg-gray-800 border border-gray-700 overflow-hidden">
              <button onClick={() => setExpandedAlignment(!expandedAlignment)} className="w-full text-left p-3 flex justify-between items-center hover:bg-gray-700 transition-colors">
                <div><div className="font-medium text-gray-200 text-sm">多星连珠 (Alignment)</div><span className="text-[10px] text-gray-500 block">Earth + Selected Planets</span></div>
                <svg className={`w-4 h-4 text-gray-400 transform transition-transform ${expandedAlignment ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
              {expandedAlignment && (
                <div className="p-3 border-t border-gray-700 bg-gray-900/50">
                   <div className="mb-3 bg-gray-800 p-2 rounded border border-gray-700/50">
                        <div className="flex justify-between items-center mb-1"><span className="text-xs text-gray-400">容差 (Tolerance)</span><span className="text-purple-400 text-xs font-mono">{settings.alignmentTolerance.toFixed(1)}°</span></div>
                        <input type="range" min="0" max="45" step="0.5" value={settings.alignmentTolerance} onChange={handleAlignmentToleranceChange} className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none" />
                   </div>
                  <p className="text-[10px] text-gray-400 mb-2">Select planets to align (Min 2):</p>
                  <div className="grid grid-cols-2 gap-2 mb-3">{availablePlanets.map(p => <label key={p.id} className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer hover:text-white"><input type="checkbox" checked={selectedAlignPlanets.includes(p.id)} onChange={() => handleAlignToggle(p.id)} className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500" />{p.name}</label>)}</div>
                  <button onClick={handleStartAlignment} disabled={selectedAlignPlanets.length < 2} className={`w-full py-2 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors ${allowCalculationSearch || continuousIteration ? 'bg-blue-600 hover:bg-blue-500' : 'bg-purple-600 hover:bg-purple-500'}`}>{continuousIteration ? '开始持续遍历 (Start Loop)' : allowCalculationSearch ? '开始计算 (Calculate)' : '开始搜寻 (Start)'}</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventsPanel;
