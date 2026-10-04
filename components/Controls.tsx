import { createPortal } from 'react-dom';
import './controls.css';

import React, { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react';

interface ControlsProps {
  onOpenHelp: () => void;
  onOpenNearby: () => void;
  nearbyEnabled: boolean;
  nearbyActive: boolean;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onPause: () => void; 
  speedMultiplier: number;
  onSpeedChange: (delta: number) => void;
  timeDirection: 1 | -1;
  onToggleTimeDirection: () => void;
  currentDate: Date;
  onDateChange: (date: Date) => void;
  onResetTime: () => void;
  onOpenSettings: () => void;
  onOpenEvents: () => void;
  searchActive: boolean;
  searchEnabled: boolean;
}

interface DatePickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: Date;
  onConfirm: (date: Date) => void;
  timeDirection: 1 | -1;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({ isOpen, onClose, currentDate, onConfirm, timeDirection }) => {
  const [era, setEra] = useState<'AD' | 'BC'>('AD');
  const [yearStr, setYearStr] = useState('1');
  const [monthStr, setMonthStr] = useState('1');
  const [dayStr, setDayStr] = useState('1');

  // Initialize state when modal opens
  useEffect(() => {
    if (isOpen) {
      const fullYear = currentDate.getFullYear();
      if (fullYear > 0) {
        setEra('AD');
        setYearStr(fullYear.toString());
      } else {
        setEra('BC');
        setYearStr((1 - fullYear).toString()); // 0 -> 1 BC, -1 -> 2 BC
      }
      setMonthStr((currentDate.getMonth() + 1).toString());
      setDayStr(currentDate.getDate().toString());
    }
  }, [isOpen, currentDate]);

  // --- Core Logic Helpers ---

  const getInternalYear = useCallback((yStr: string, eraVal: 'AD' | 'BC') => {
    const y = parseInt(yStr);
    if (isNaN(y)) return 1;
    return eraVal === 'AD' ? y : (1 - y);
  }, []);

  const getMaxDaysInMonth = useCallback((yStr: string, mStr: string, eraVal: 'AD' | 'BC') => {
    const year = getInternalYear(yStr, eraVal);
    const month = parseInt(mStr);
    if (isNaN(month)) return 31; // Fallback for typing

    const d = new Date();
    d.setFullYear(year, month, 0); 
    return d.getDate();
  }, [getInternalYear]);

  // --- validation / Correction ---

  const validateAndCorrectDay = (y: string, m: string, d: string, e: 'AD'|'BC') => {
    const maxDays = getMaxDaysInMonth(y, m, e);
    const currentDay = parseInt(d);
    if (!isNaN(currentDay) && currentDay > maxDays) {
      return maxDays.toString();
    }
    return d;
  };

  // --- Handlers ---

  const handleInputChange = (
    val: string, 
    setter: React.Dispatch<React.SetStateAction<string>>, 
    limitCalc?: () => number
  ) => {
    // Allow only digits
    if (val !== '' && !/^\d+$/.test(val)) return;
    
    // If a limit calculator is provided (e.g. max days), check strictly while typing
    if (limitCalc && val !== '') {
       const max = limitCalc();
       if (parseInt(val) > max) return; // Block input if it exceeds max immediately
    }
    
    setter(val);
  };

  const handleBlur = (
    val: string,
    setter: React.Dispatch<React.SetStateAction<string>>,
    min: number,
    maxCalc?: () => number
  ) => {
    let num = parseInt(val);
    if (isNaN(num) || num < min) {
      setter(min.toString());
    } else if (maxCalc) {
      const max = maxCalc();
      if (num > max) setter(max.toString());
    }
  };

  // Special Blur handlers for dependency updates
  const onYearOrMonthBlur = () => {
    // 1. Validate Year/Month itself
    let y = parseInt(yearStr);
    if (isNaN(y) || y < 1) { y = 1; setYearStr('1'); }
    else if (y > 100000) { y = 100000; setYearStr('100000'); }

    let m = parseInt(monthStr);
    if (isNaN(m) || m < 1) { m = 1; setMonthStr('1'); }
    else if (m > 12) { m = 12; setMonthStr('12'); }

    // 2. Auto-correct Day if it becomes invalid for new Year/Month
    const correctedDay = validateAndCorrectDay(y.toString(), m.toString(), dayStr, era);
    if (correctedDay !== dayStr) {
      setDayStr(correctedDay);
    }
  };

  const toggleEra = () => {
    const newEra = era === 'AD' ? 'BC' : 'AD';
    setEra(newEra);
    // Re-validate day because leap years change between AD/BC (e.g. 1 AD not leap, 1 BC is leap)
    const correctedDay = validateAndCorrectDay(yearStr, monthStr, dayStr, newEra);
    if (correctedDay !== dayStr) setDayStr(correctedDay);
  };

  const handleConfirm = () => {
    const y = parseInt(yearStr) || 1;
    const m = parseInt(monthStr) || 1;
    const d = parseInt(dayStr) || 1;

    const internalYear = getInternalYear(yearStr, era);
    const date = new Date();
    date.setFullYear(internalYear, m - 1, d);
    date.setHours(12, 0, 0, 0);
    
    onConfirm(date);
    onClose();
  };

  useEffect(() => {
    if(!isOpen)return;
    const key=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();onClose();}};
    window.addEventListener('keydown',key);
    return()=>window.removeEventListener('keydown',key);
  },[isOpen,onClose]);
  if (!isOpen) return null;

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="调整模拟日期" className="date-modal fixed inset-0 z-[10000] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-80 shadow-2xl transform transition-all" 
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          跳转日期 (Jump to Date)
        </h3>

        <div className="space-y-4">
          {/* Year Row */}
          <div className="flex items-end gap-2">
             <div className="flex-1">
                <label className="block text-xs text-gray-400 mb-1">年份 (Year)</label>
                <input 
                  type="text" 
                  inputMode="numeric"
                  value={yearStr}
                  onChange={e => handleInputChange(e.target.value, setYearStr)}
                  onBlur={onYearOrMonthBlur}
                  placeholder="YYYY"
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-lg"
                />
             </div>
             
             {/* Era Toggle: Only show if global time is reversing */}
             {timeDirection === -1 && (
               <div className="w-24 pb-1">
                  <div 
                    onClick={toggleEra}
                    className={`relative h-9 rounded cursor-pointer transition-colors flex items-center px-1 border ${era === 'BC' ? 'bg-orange-900/40 border-orange-600' : 'bg-blue-900/40 border-blue-600'}`}
                  >
                    <span className={`absolute left-2 text-xs font-bold transition-opacity ${era === 'BC' ? 'opacity-100 text-orange-200' : 'opacity-40 text-gray-500'}`}>BC</span>
                    <span className={`absolute right-2 text-xs font-bold transition-opacity ${era === 'AD' ? 'opacity-100 text-blue-200' : 'opacity-40 text-gray-500'}`}>AD</span>
                    
                    <div className={`absolute top-1 bottom-1 w-[45%] bg-white/10 rounded shadow-sm transform transition-transform duration-200 ${era === 'AD' ? 'translate-x-[110%]' : 'translate-x-0'}`}></div>
                  </div>
               </div>
             )}
          </div>

          {/* Month / Day Row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">月份 (Month)</label>
              <input 
                type="text"
                inputMode="numeric"
                value={monthStr}
                onChange={e => handleInputChange(e.target.value, setMonthStr, () => 12)}
                onBlur={onYearOrMonthBlur}
                placeholder="MM"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-lg text-center"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">日期 (Day)</label>
              <input 
                type="text"
                inputMode="numeric"
                value={dayStr}
                onChange={e => handleInputChange(e.target.value, setDayStr, () => getMaxDaysInMonth(yearStr, monthStr, era))}
                onBlur={() => handleBlur(dayStr, setDayStr, 1, () => getMaxDaysInMonth(yearStr, monthStr, era))}
                placeholder="DD"
                className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white focus:border-blue-500 outline-none font-mono text-lg text-center"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button 
            onClick={onClose} 
            className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            取消 (Cancel)
          </button>
          <button 
            onClick={handleConfirm} 
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors"
          >
            确定 (Confirm)
          </button>
        </div>
      </div>
    </div>, document.body
  );
};

const Controls: React.FC<ControlsProps> = ({
  onOpenHelp, onOpenNearby, nearbyEnabled, nearbyActive,
  isPlaying,
  onTogglePlay,
  onPause,
  speedMultiplier,
  onSpeedChange,
  timeDirection,
  onToggleTimeDirection,
  currentDate,
  onDateChange,
  onResetTime,
  onOpenSettings,
  onOpenEvents,
  searchActive, searchEnabled
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const node=toolbarRef.current; if(!node)return;
      const space=node.getBoundingClientRect().height+parseFloat(getComputedStyle(node).bottom)+14;
      document.documentElement.style.setProperty('--scene-bottom-space', `${Math.ceil(space)}px`);
    };
    const observer=new ResizeObserver(measure);if(toolbarRef.current)observer.observe(toolbarRef.current);measure();
    return()=>observer.disconnect();
  },[]);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    
    if (timeDirection === 1) {
        if (y <= 0) {
            const bcYear = 1 - y;
            return `前${bcYear}年${m}月${d}日`;
        }
        return `${y}年${m}月${d}日`;
    } else {
        let yearStr = `${y}`;
        let eraSuffix = '';
        if (y <= 0) {
            yearStr = `${1 - y}`; 
            eraSuffix = ' BC';
        } else {
            eraSuffix = ' AD';
        }
        return `${yearStr}${eraSuffix} ${m}/${d}`;
    }
  };

  const handleOpenDatePicker = () => {
    if (!searchActive) {
        window.dispatchEvent(new Event('navigation-stop'));
        onPause(); 
        setShowDatePicker(true);
    }
  };

  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(e.code!=='KeyT'||e.repeat||e.defaultPrevented||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||document.querySelector('[aria-modal=true]')||
        (e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable=true]')))return;
      e.preventDefault();handleOpenDatePicker();
    };
    window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
  },[searchActive,onPause]);

  return (
    <>
      <div ref={toolbarRef} className="simulation-toolbar-shell">
        <div className="simulation-toolbar">
          <div className="transport-group">
            <button aria-label="时间反向" title="时间反向 · B" aria-pressed={timeDirection===-1} onClick={onToggleTimeDirection} disabled={searchActive}><svg viewBox="0 0 24 24"><path d="m11 6-8 6 8 6V6Zm10 0-8 6 8 6V6Z"/></svg></button>
            <button className="play-control" aria-label={isPlaying?'暂停':'播放'} title="播放 / 暂停 · Space" onClick={onTogglePlay} disabled={searchActive}><svg viewBox="0 0 24 24" className="filled">{isPlaying?<path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>:<path d="M8 5v14l11-7z"/>}</svg></button>
            <div className="speed-group">
              <button aria-label="时间减速" title="减速 · −" onClick={()=>onSpeedChange(.5)} disabled={searchActive}><svg viewBox="0 0 24 24"><path d="M11 19l-7-7 7-7m8 14-7-7 7-7"/></svg></button>
              <output title="模拟时间速率">{Math.abs(speedMultiplier)}<small>×</small></output>
              <button aria-label="时间加速" title="加速 · +" onClick={()=>onSpeedChange(2)} disabled={searchActive}><svg viewBox="0 0 24 24"><path d="M13 5l7 7-7 7M5 5l7 7-7 7"/></svg></button>
            </div>
          </div>
          <div className="time-group">
            <button className="date-control" aria-label="调整模拟日期" title="调整日期 · T" onClick={handleOpenDatePicker} disabled={searchActive}>
              <span>模拟日期</span><strong>{formatDate(currentDate)}</strong>
            </button>
            <button aria-label="回到现在" onClick={onResetTime} title="回到现在 · 0"><svg viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"/></svg></button>
          </div>
          <div className="tool-group">
            <button aria-label="邻近恒星" title={nearbyActive?"缩放回太阳系 · N":"缩放至邻近恒星 · N"} disabled={!nearbyEnabled} aria-pressed={nearbyActive} className="toolbar-star-button" onClick={onOpenNearby}><svg viewBox="0 0 24 24"><path d="m7 5 5 7 7-5M12 12l-6 7m6-7 7 6"/><circle cx="7" cy="5" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="6" cy="19" r="2"/><circle cx="19" cy="18" r="2"/></svg></button>
            {searchEnabled&&<button aria-label="天象搜索" title="天象搜索 · J" onClick={onOpenEvents}><svg viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></svg></button>}
            <button aria-label="打开设置" title="系统设置 · M" onClick={onOpenSettings}><svg viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg></button>
            <button aria-label="操作指南" title="操作指南 · H / ?" onClick={onOpenHelp}><svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3v.2"/></svg></button>
          </div>
        </div>
      </div>

      <DatePickerModal 
        isOpen={showDatePicker} 
        onClose={() => setShowDatePicker(false)} 
        currentDate={currentDate} 
        onConfirm={onDateChange} 
        timeDirection={timeDirection}
      />
    </>
  );
};

export default Controls;
