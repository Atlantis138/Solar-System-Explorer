
import React, { useState, useEffect } from 'react';
import { PinnedPlanet, PlanetData, AppSettings } from '../types';

interface PinnedPlanetsSidebarProps {
  pinnedPlanets: PinnedPlanet[];
  onTogglePin: (id: string) => void;
  onColorChange: (id: string, color: string) => void;
  onCameraFocus: (id: string) => void;
  cameraFocusId: string | null;
  settings: AppSettings;
  allBodies: PlanetData[];
  isSplitView?: boolean;
}

const COLORS = ['#ffffff', '#ff5252', '#4caf50', '#2196f3', '#ffeb3b', '#e040fb'];

const PinnedPlanetsSidebar: React.FC<PinnedPlanetsSidebarProps> = ({
  pinnedPlanets, onTogglePin, onColorChange, onCameraFocus, cameraFocusId, settings, allBodies, isSplitView = false
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const findParentId = (childId: string): string | null => {
      for (const p of allBodies) {
          if (p.satellites && p.satellites.some(s => s.id === childId)) return p.id;
      }
      return null;
  };

  useEffect(() => {
      if (!settings.trueScale) setExpandedIds(new Set());
  }, [settings.trueScale]);

  useEffect(() => {
      if (settings.trueScale) {
          pinnedPlanets.forEach(pin => {
              const parentId = findParentId(pin.id);
              if (parentId) setExpandedIds(prev => new Set(prev).add(parentId!));
          });
      }
  }, [pinnedPlanets, settings.trueScale]);

  if (pinnedPlanets.length === 0) return null;

  const getPlanetData = (id: string) => allBodies.find(x => x.id === id);
  const toggleExpand = (id: string) => {
      setExpandedIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
      });
  };

  const displayList = pinnedPlanets.filter(pin => {
      const parentId = findParentId(pin.id);
      if (!parentId) return true; 
      const isParentPinned = pinnedPlanets.some(p => p.id === parentId);
      return !isParentPinned; 
  });

  // Calculate heights to avoid joystick intersection
  const containerStyle = {
      top: isSplitView ? 'calc(45vh + 16px)' : '16px',
      // Reserve more space at bottom for the joystick (approx 320px)
      maxHeight: isSplitView ? 'calc(45vh - 16px)' : 'calc(100vh - 320px)'
  };

  return (
    <div className="fixed right-8 z-30 flex flex-col animate-fade-in pointer-events-auto transition-all duration-300" style={containerStyle}>
      <div className="bg-gray-900/80 border border-gray-700/50 rounded-xl p-4 w-80 shadow-xl backdrop-blur-sm flex flex-col h-full overflow-hidden">
        <h2 className="text-sm font-bold text-gray-300 mb-3 flex items-center gap-2 uppercase tracking-wider shrink-0"><svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M16 12V4H17V2H7V4H8V12L6 14V16H11.2V22H12.8V16H18V14L16 12Z" /></svg>订选天体 (Pinned)</h2>
        <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar flex-1 min-h-0">
          {displayList.map(pin => {
            const data = getPlanetData(pin.id);
            if (!data && !findParentId(pin.id)) return null; 
            const name = data ? data.name : pin.id; 
            const hasSatellites = data?.satellites && data.satellites.length > 0;
            const canExpand = settings.trueScale && hasSatellites;
            const isExpanded = expandedIds.has(pin.id);

            return (
              <div key={pin.id} className={`bg-gray-800/50 rounded-lg p-2 border transition-all ${cameraFocusId === pin.id ? 'border-yellow-500/50 bg-yellow-900/10' : 'border-gray-700/50'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1">
                      {canExpand && (
                          <button onClick={() => toggleExpand(pin.id)} className="text-gray-400 hover:text-white transition-colors p-0.5"><svg className={`w-3 h-3 transform transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg></button>
                      )}
                      <span className={`text-sm font-medium ${cameraFocusId === pin.id ? 'text-yellow-200' : 'text-gray-200'}`}>{name}</span>
                  </div>
                  <div className="flex gap-1">
                     <button onClick={() => onCameraFocus(pin.id)} className={`p-1 rounded hover:bg-gray-700 transition-colors ${cameraFocusId === pin.id ? 'text-yellow-400' : 'text-gray-400'}`} title="Camera Follow"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg></button>
                     <button onClick={() => onTogglePin(pin.id)} className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors" title="Unpin"><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
                  </div>
                </div>
                <div className="flex gap-1.5 mb-1">{COLORS.map(c => (<button key={c} onClick={() => onColorChange(pin.id, c)} className={`w-3 h-3 rounded-full border transition-transform hover:scale-110 ${pin.color === c ? 'border-white scale-110 ring-1 ring-white/30' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: c }} />))}</div>
                {isExpanded && data?.satellites && (
                    <div className="mt-3 pt-2 border-t border-gray-700/50 space-y-2 pl-2">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Satellites</div>
                        {data.satellites.map(sat => {
                            const satPinned = pinnedPlanets.find(p => p.id === sat.id);
                            const isSatPinned = !!satPinned;
                            return (
                                <div key={sat.id} className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <span className={`text-xs ${isSatPinned ? 'text-white' : 'text-gray-400'}`}>{sat.name}</span>
                                        <button onClick={() => onTogglePin(sat.id)} className={`text-[10px] px-1.5 py-0.5 rounded border transition-colors ${isSatPinned ? 'bg-blue-900/40 border-blue-500 text-blue-200' : 'border-gray-600 text-gray-500 hover:border-gray-400 hover:text-gray-300'}`}>{isSatPinned ? 'Pinned' : 'Pin'}</button>
                                    </div>
                                    {isSatPinned && (
                                        <div className="flex gap-1.5 pl-1">{COLORS.map(c => (<button key={c} onClick={() => onColorChange(sat.id, c)} className={`w-2 h-2 rounded-full border transition-transform hover:scale-110 ${satPinned?.color === c ? 'border-white scale-110 ring-1 ring-white/30' : 'border-transparent opacity-70 hover:opacity-100'}`} style={{ backgroundColor: c }} />))}</div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default PinnedPlanetsSidebar;
