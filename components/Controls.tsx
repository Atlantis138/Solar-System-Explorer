
import React, { useState, useEffect, useCallback } from 'react';

interface ControlsProps {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
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
    </div>
  );
};

const Controls: React.FC<ControlsProps> = ({
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
  searchActive
}) => {
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
        onPause(); 
        setShowDatePicker(true);
    }
  };

  return (
    <>
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-auto max-w-[90vw] md:max-w-3xl lg:max-w-4xl flex justify-center z-40 pointer-events-none">
        <div className="bg-gray-900/80 backdrop-blur-md rounded-full px-4 py-2 md:px-6 md:py-3 border border-gray-700 flex items-center gap-2 md:gap-4 shadow-2xl pointer-events-auto transition-all duration-300 overflow-x-auto custom-scrollbar shrink-0 max-w-full">
          
          {/* Reverse Toggle Button */}
          <button
            onClick={onToggleTimeDirection}
            disabled={searchActive}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all duration-300 focus:outline-none shadow-lg shrink-0 ${
              timeDirection === -1 
              ? 'bg-red-600 hover:bg-red-500 text-white ring-2 ring-red-400' 
              : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={timeDirection === -1 ? "Time Flow: Backward (Active)" : "Enable Time Reversal"}
          >
            <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
            </svg>
          </button>

          {/* Play/Pause Button */}
          <button
            onClick={onTogglePlay}
            disabled={searchActive}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-colors focus:outline-none shadow-lg shrink-0 ${searchActive ? 'bg-gray-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500'}`}
            title={isPlaying ? "Pause (Space)" : "Play (Space)"}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" /></svg>
            ) : (
              <svg className="w-4 h-4 md:w-5 md:h-5 text-white ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
            )}
          </button>

          {/* Speed Controls */}
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            <button onClick={() => onSpeedChange(0.5)} disabled={searchActive} className={`p-1.5 md:p-2 transition-colors ${searchActive ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}>
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" /></svg>
            </button>
            <div className="flex flex-col justify-center items-center w-14 md:w-20 shrink-0">
              <span className="text-[8px] md:text-[10px] text-gray-500 uppercase tracking-wider text-center w-full">速率 (Rate)</span>
              <span className="font-mono font-bold text-blue-400 text-xs md:text-sm text-center w-full">
                {Math.abs(speedMultiplier)}x
              </span>
            </div>
            <button onClick={() => onSpeedChange(2)} disabled={searchActive} className={`p-1.5 md:p-2 transition-colors ${searchActive ? 'text-gray-600' : 'text-gray-400 hover:text-white'}`}>
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
            </button>
          </div>

          <div className="w-px h-6 md:h-8 bg-gray-700 mx-1 md:mx-2 shrink-0"></div>

          {/* Date Display & Trigger */}
          <div className={`flex flex-col items-center justify-center relative group min-w-[140px] md:w-48 shrink-0 ${searchActive ? 'opacity-50 pointer-events-none' : ''}`}>
            <span className="text-[8px] md:text-[10px] text-gray-500 uppercase tracking-wider text-center w-full">当前日期 (Date)</span>
            <div 
              onClick={handleOpenDatePicker}
              className="font-mono text-sm md:text-base font-semibold text-white cursor-pointer hover:text-blue-300 transition-colors whitespace-nowrap w-full text-left pl-6 md:pl-8 relative"
            >
              {formatDate(currentDate)}
              <svg className="w-3 h-3 md:w-4 md:h-4 absolute left-1 md:left-2 top-1/2 transform -translate-y-1/2 text-gray-500 group-hover:text-blue-300 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div className="w-px h-6 md:h-8 bg-gray-700 mx-1 md:mx-2 shrink-0"></div>

          {/* Right Group (Tools) */}
          <div className="flex items-center gap-0.5 md:gap-1 shrink-0">
            <button onClick={onOpenEvents} className="p-1.5 md:p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-full transition-all">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </button>
            
            <button onClick={onResetTime} className="p-1.5 md:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all" title="Reset to Now">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
            
            <button onClick={onOpenSettings} className="p-1.5 md:p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-full transition-all">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
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
