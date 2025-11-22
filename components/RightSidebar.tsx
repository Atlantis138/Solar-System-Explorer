
import React, { useState, useMemo } from 'react';
import { FoundEvent, SortOption } from '../types';

interface RightSidebarProps {
  events: FoundEvent[];
  onJumpToStart: (time: number) => void;
  onJumpToOptimal: (time: number) => void;
  totalYearsSearched: number;
  completed: boolean;
  elapsedTime?: number; // ms
  onClose: () => void;
  isSplitView?: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ 
  events, 
  onJumpToStart, 
  onJumpToOptimal,
  totalYearsSearched,
  completed,
  elapsedTime = 0,
  onClose,
  isSplitView = false
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('time');

  const sortedEvents = useMemo(() => {
    const list = [...events];
    list.sort((a, b) => {
      if (sortOption === 'time') {
        return a.startDate - b.startDate;
      } else if (sortOption === 'duration') {
        return (b.endDate - b.startDate) - (a.endDate - a.startDate);
      } else if (sortOption === 'angle') {
        return a.minAngle - b.minAngle;
      }
      return 0;
    });
    return list;
  }, [events, sortOption]);

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const dateStr = `${d.getFullYear()}/${d.getMonth()+1}/${d.getDate()}`;
    return dateStr;
  };

  const getDurationDays = (e: FoundEvent) => {
    const ms = e.endDate - e.startDate;
    const days = Math.round(ms / (1000 * 60 * 60 * 24));
    if (days < 1) {
        const hours = (ms / (1000 * 60 * 60)).toFixed(1);
        return `${hours}h`;
    }
    return `${days + 1}d`;
  };

  const getFrequency = () => {
    if (events.length < 2) return 'N/A';
    const avg = totalYearsSearched / events.length;
    if (avg < 1) return `${(avg * 12).toFixed(1)} Months`;
    return `${avg.toFixed(1)} Years`;
  };

  const formatElapsedTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds} s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  // Height Calculation: 
  // if split, take roughly top 45%
  // else take full minus joystick padding (approx 320px from bottom)
  const style = {
      maxHeight: isSplitView ? 'calc(45vh - 16px)' : 'calc(100vh - 320px)',
      height: isSplitView ? 'calc(45vh - 16px)' : 'auto'
  };

  return (
    <div className="fixed top-4 right-8 z-40 flex flex-col shadow-2xl pointer-events-auto transition-all duration-300" style={style}>
      <div className="bg-gray-900/95 border border-gray-700 rounded-xl p-4 w-80 shadow-2xl backdrop-blur-md flex flex-col h-full overflow-hidden">
        <div className="flex justify-between items-center mb-3 shrink-0">
           <h2 className="text-lg font-bold text-white flex items-center gap-2">
             <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
             历史结果 (History)
           </h2>
           <div className="flex items-center gap-2">
               <span className="text-xs bg-gray-800 px-2 py-1 rounded text-blue-300 font-mono">{events.length}</span>
               <button 
                  onClick={onClose}
                  className="text-gray-400 hover:text-white transition-colors"
                  title="Close Sidebar"
               >
                   <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                   </svg>
               </button>
           </div>
        </div>

        {/* Sort Controls */}
        <div className="flex gap-1 mb-3 bg-gray-800 p-1 rounded-lg shrink-0">
            <button onClick={() => setSortOption('time')} className={`flex-1 text-[10px] py-1 rounded ${sortOption === 'time' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>时间 (Time)</button>
            <button onClick={() => setSortOption('duration')} className={`flex-1 text-[10px] py-1 rounded ${sortOption === 'duration' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>时长 (Len)</button>
            <button onClick={() => setSortOption('angle')} className={`flex-1 text-[10px] py-1 rounded ${sortOption === 'angle' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}>角度 (Deg)</button>
        </div>

        {/* Scrollable List */}
        <div className="flex-1 overflow-y-auto pr-1 space-y-2 min-h-0 custom-scrollbar">
           {sortedEvents.length === 0 ? (
             <div className="text-gray-500 text-center text-xs py-10">Waiting for data...</div>
           ) : (
             sortedEvents.map((e) => (
               <div key={e.id} className="bg-gray-800/50 rounded p-2 border border-gray-700/50 hover:border-blue-500/50 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                     <span className="text-sm font-mono text-white font-bold">{new Date(e.optimalDate).getFullYear()}</span>
                     <span className="text-[10px] text-gray-400">{formatDate(e.startDate)}</span>
                  </div>
                  <div className="flex justify-between items-center mb-2 text-[10px] text-gray-400">
                     <span>Dur: {getDurationDays(e)}</span>
                     <span>Min: {e.minAngle.toFixed(2)}°</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                        onClick={() => onJumpToStart(e.startDate)}
                        className="bg-blue-900/40 hover:bg-blue-800/60 text-blue-200 text-[10px] py-1 rounded border border-blue-800/30 transition-colors"
                    >
                        Start
                    </button>
                    <button 
                        onClick={() => onJumpToOptimal(e.optimalDate)}
                        className="bg-green-900/40 hover:bg-green-800/60 text-green-200 text-[10px] py-1 rounded border border-green-800/30 transition-colors"
                    >
                        Opt
                    </button>
                  </div>
               </div>
             ))
           )}
        </div>

        {/* Statistics Footer */}
        {(completed || events.length > 0) && (
           <div className="mt-3 pt-3 border-t border-gray-700 shrink-0">
              <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">统计 (Statistics)</h4>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                 <div className="text-gray-500">Total Searched:</div>
                 <div className="text-right text-gray-200 font-mono">{totalYearsSearched.toFixed(0)} Years</div>
                 <div className="text-gray-500">Frequency:</div>
                 <div className="text-right text-blue-300 font-mono">~{getFrequency()}</div>
                 <div className="text-gray-500">Total Time:</div>
                 <div className="text-right text-yellow-400 font-mono">{formatElapsedTime(elapsedTime)}</div>
              </div>
           </div>
        )}

      </div>
    </div>
  );
};
