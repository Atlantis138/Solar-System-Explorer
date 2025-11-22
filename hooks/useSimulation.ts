import { useState, useRef, useEffect, useCallback } from 'react';
import { AppSettings, SearchState, EventType, SimNotification, FoundEvent, PlanetData } from '../types';
import { MILLISECONDS_PER_DAY } from '../data/constants';
import { isTransit, checkSpecificAlignment, calculateEventDuration, findOptimalEventTime, DEFAULT_SUN_ANGULAR_RADIUS_DEG } from '../utils/astronomy';

const BASE_SPEED_DAYS_PER_SEC = 7;

export const useSimulation = (settings: AppSettings, celestialBodies: PlanetData[]) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMultiplier, setSpeedMultiplier] = useState(1);
  const [timeDirection, setTimeDirection] = useState<1 | -1>(1); 
  const [highlightedAlignment, setHighlightedAlignment] = useState<string[] | null>(null);
  const [notification, setNotification] = useState<SimNotification>({ message: '', visible: false });

  const [searchState, setSearchState] = useState<SearchState>({
    active: false, type: null, status: '', speed: 'medium', activeTolerance: 1.0, activeSolarRadius: DEFAULT_SUN_ANGULAR_RADIUS_DEG,
    isCalculating: false, calculationResult: null, calculationDuration: 0, elapsedTime: 0, currentScanDate: Date.now(),
    continuousPaused: false, foundEvents: [], searchStartTime: 0, completed: false, strictMode: false
  });

  const requestRef = useRef<number>(0);
  const lastFrameTime = useRef<number>(0);
  const lastRealTimeRef = useRef<number>(0);
  const lastEventGuardRef = useRef<{ key: string, start: number, end: number } | null>(null);
  
  const calcDateRef = useRef<number>(0);
  const calcStartRef = useRef<number>(0); 
  const calcTargetRef = useRef<{ type: EventType, ids: string[], strictMode?: boolean, tolerance: number, solarRadius: number } | null>(null);
  const calculationTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const notificationTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const animate = useCallback((time: number) => {
    if (lastFrameTime.current === 0) {
      lastFrameTime.current = time;
      lastRealTimeRef.current = Date.now();
      requestRef.current = requestAnimationFrame(animate);
      return;
    }

    const deltaTime = (time - lastFrameTime.current) / 1000; 
    lastFrameTime.current = time;
    
    if (!searchState.isCalculating) {
        const now = Date.now();
        const realDelta = now - lastRealTimeRef.current;
        lastRealTimeRef.current = now;
        if (searchState.active && !searchState.continuousPaused) {
          setSearchState(prev => ({ ...prev, elapsedTime: prev.elapsedTime + realDelta }));
        }
    }

    if (searchState.isCalculating) {
        requestRef.current = requestAnimationFrame(animate);
        return;
    }

    if (searchState.active && searchState.type) {
      if (settings.continuousIteration && searchState.continuousPaused) {
         requestRef.current = requestAnimationFrame(animate);
         return;
      }

      let iterations = 15;
      switch(searchState.speed) {
        case 'low': iterations = 4; break;
        case 'medium': iterations = 15; break;
        case 'high': iterations = 30; break;
      }
      
      let found = false;
      let tempDate = new Date(currentDate.getTime());
      let foundIds: string[] = [];
      
      const currentTargets = searchState.targetIds || [];
      const currentKey = `${searchState.type}-${currentTargets.sort().join(',')}`;
      const step = timeDirection * MILLISECONDS_PER_DAY;
      const tolerance = searchState.activeTolerance;
      const strictRadius = searchState.activeSolarRadius || DEFAULT_SUN_ANGULAR_RADIUS_DEG;

      for (let i = 0; i < iterations; i++) {
        tempDate = new Date(tempDate.getTime() + step);
        const t = tempDate.getTime();

        if (lastEventGuardRef.current && lastEventGuardRef.current.key === currentKey) {
           const { start, end } = lastEventGuardRef.current;
           if (t >= start && t <= end) continue;
        }

        if (searchState.type === 'TRANSIT') {
          if (currentTargets.length > 0) {
             const allTransiting = currentTargets.every(id => isTransit(id, tempDate, tolerance, settings.useHighPrecision, searchState.strictMode, strictRadius, celestialBodies));
             if (allTransiting) {
               found = true; foundIds = ['earth', ...currentTargets, 'sun']; break;
             }
          }
        } else if (searchState.type === 'PLANETARY_ALIGNMENT') {
          if (currentTargets.length >= 2) {
            if (checkSpecificAlignment(tempDate, currentTargets, tolerance, settings.useHighPrecision, celestialBodies)) {
              found = true; foundIds = ['earth', ...currentTargets]; break;
            }
          }
        }
      }

      setCurrentDate(tempDate);
      const y = tempDate.getFullYear();
      setSearchState(prev => ({ ...prev, status: `Searching... ${y <= 0 ? `${1 - y} BC` : y}` }));

      if (found) {
        const duration = calculateEventDuration(tempDate, searchState.type, currentTargets, tolerance, settings.useHighPrecision, searchState.strictMode, strictRadius, celestialBodies);
        const optimal = findOptimalEventTime(duration.start, duration.end, searchState.type, currentTargets, settings.useHighPrecision, searchState.strictMode, strictRadius, celestialBodies);
        lastEventGuardRef.current = { key: currentKey, start: duration.start, end: duration.end };

        const newEvent: FoundEvent = {
          id: `${Date.now()}-${Math.random()}`, type: searchState.type, targetIds: currentTargets,
          startDate: duration.start, endDate: duration.end, optimalDate: optimal.time, minAngle: optimal.angle, strictMode: searchState.strictMode
       };

        if (settings.continuousIteration) {
           setSearchState(prev => {
             const updatedEvents = [...prev.foundEvents, newEvent];
             const yearsSearched = Math.abs(duration.end - prev.searchStartTime) / (MILLISECONDS_PER_DAY * 365);
             if (updatedEvents.length >= 50 || yearsSearched >= 2000) {
               return { ...prev, active: false, foundEvents: updatedEvents, completed: true, status: 'Completed', currentScanDate: timeDirection === 1 ? duration.end : duration.start };
             }
             return { ...prev, foundEvents: updatedEvents, status: `Found event. Continuing...`, currentScanDate: timeDirection === 1 ? duration.end : duration.start };
           });
           setCurrentDate(new Date(timeDirection === 1 ? duration.end + MILLISECONDS_PER_DAY : duration.start - MILLISECONDS_PER_DAY));
        } else {
           setIsPlaying(false); setSpeedMultiplier(1);
           setSearchState(prev => ({ 
             ...prev, active: false, status: '', speed: 'medium', resultStartDate: duration.start, resultEndDate: duration.end,
             resultOptimalDate: optimal.time, resultMinAngle: optimal.angle, calculationResult: tempDate.getTime(), foundEvents: [...prev.foundEvents, newEvent] 
           }));
           if (foundIds.length > 0) setHighlightedAlignment(foundIds);
           if (!settings.showEventHighlights) {
              if (notificationTimerRef.current) clearTimeout(notificationTimerRef.current);
              notificationTimerRef.current = setTimeout(() => setHighlightedAlignment(null), 5000);
           }
        }
      }
    } else if (isPlaying) {
      const daysToAdd = deltaTime * BASE_SPEED_DAYS_PER_SEC * speedMultiplier * timeDirection;
      setCurrentDate(prevDate => new Date(prevDate.getTime() + daysToAdd * MILLISECONDS_PER_DAY));
      if (highlightedAlignment && !settings.showEventHighlights) setHighlightedAlignment(null);
    }
    requestRef.current = requestAnimationFrame(animate);
  }, [isPlaying, speedMultiplier, searchState, currentDate, settings, highlightedAlignment, timeDirection, celestialBodies]);

  const runCalculationBatch = useCallback(() => {
      if (!calcTargetRef.current) return;
      const now = Date.now();
      const timeStep = now - lastRealTimeRef.current;
      lastRealTimeRef.current = now;
      setSearchState(prev => prev.continuousPaused ? prev : { ...prev, elapsedTime: prev.elapsedTime + timeStep });

      const BATCH_SIZE = 200; 
      const { type, ids, strictMode, tolerance, solarRadius } = calcTargetRef.current;
      const currentKey = `${type}-${(ids || []).sort().join(',')}`;
      const step = timeDirection * MILLISECONDS_PER_DAY;
      let currentTs = calcDateRef.current;
      let found = false;

      for(let i=0; i<BATCH_SIZE; i++) {
        currentTs += step;
        if (lastEventGuardRef.current && lastEventGuardRef.current.key === currentKey) {
          const { start, end } = lastEventGuardRef.current;
          if (currentTs >= start && currentTs <= end) continue;
        }
        const d = new Date(currentTs);
        if (type === 'TRANSIT') {
            if (ids.length > 0 && ids.every(id => isTransit(id, d, tolerance, settings.useHighPrecision, strictMode, solarRadius, celestialBodies))) {
                found = true; break;
            }
        } else if (type === 'PLANETARY_ALIGNMENT') {
            if (ids.length >= 2 && checkSpecificAlignment(d, ids, tolerance, settings.useHighPrecision, celestialBodies)) {
                found = true; break;
            }
        }
      }
      calcDateRef.current = currentTs;
      setSearchState(prev => prev.continuousPaused ? prev : { ...prev, calculationDuration: Date.now() - calcStartRef.current, currentScanDate: currentTs });

      if (found) {
          const duration = calculateEventDuration(new Date(currentTs), type, ids, tolerance, settings.useHighPrecision, strictMode, solarRadius, celestialBodies);
          const optimal = findOptimalEventTime(duration.start, duration.end, type, ids, settings.useHighPrecision, strictMode, solarRadius, celestialBodies);
          lastEventGuardRef.current = { key: currentKey, start: duration.start, end: duration.end };

          const newEvent: FoundEvent = {
            id: `${Date.now()}-${Math.random()}`, type, targetIds: ids, startDate: duration.start, endDate: duration.end,
            optimalDate: optimal.time, minAngle: optimal.angle, strictMode
          };

          if (settings.continuousIteration) {
              setSearchState(prev => {
                  const updatedEvents = [...prev.foundEvents, newEvent];
                  const yearsSearched = Math.abs(duration.end - prev.searchStartTime) / (MILLISECONDS_PER_DAY * 365);
                  if (updatedEvents.length >= 50 || yearsSearched >= 2000) {
                      calcTargetRef.current = null; 
                      return { ...prev, foundEvents: updatedEvents, isCalculating: false, completed: true };
                  }
                  return { ...prev, foundEvents: updatedEvents, currentScanDate: timeDirection === 1 ? duration.end : duration.start };
              });
              if (calcTargetRef.current) { 
                  calcDateRef.current = timeDirection === 1 ? duration.end + MILLISECONDS_PER_DAY : duration.start - MILLISECONDS_PER_DAY;
                  calculationTimeoutRef.current = setTimeout(runCalculationBatch, 0);
              }
          } else {
              setSearchState(prev => ({ 
                  ...prev, isCalculating: false, calculationResult: currentTs, targetIds: ids,
                  resultStartDate: duration.start, resultEndDate: duration.end, resultOptimalDate: optimal.time, resultMinAngle: optimal.angle, foundEvents: [...prev.foundEvents, newEvent]
              }));
              calcTargetRef.current = null;
          }
      } else {
          setSearchState(prev => {
             if (prev.continuousPaused || !prev.isCalculating) return prev; 
             calculationTimeoutRef.current = setTimeout(runCalculationBatch, 0);
             return prev;
          });
      }
  }, [settings.useHighPrecision, settings.continuousIteration, timeDirection, celestialBodies]);

  const startSearch = (type: EventType, ids: string[], speed: any, strict: boolean, config: any, keepHistory: boolean) => {
      if (settings.allowCalculationSearch) { startCalculation(type, ids, strict, config, keepHistory); return; }
      setHighlightedAlignment(null); lastEventGuardRef.current = null; const startTs = currentDate.getTime(); lastRealTimeRef.current = Date.now();
      setSearchState(prev => ({
        active: true, type, targetIds: ids, status: 'Starting search...', speed, activeTolerance: config?.tolerance ?? 1.0, activeSolarRadius: config?.solarRadius ?? DEFAULT_SUN_ANGULAR_RADIUS_DEG,
        isCalculating: false, calculationResult: null, calculationDuration: 0, elapsedTime: keepHistory ? prev.elapsedTime : 0, currentScanDate: startTs,
        continuousPaused: false, foundEvents: keepHistory ? prev.foundEvents : [], searchStartTime: keepHistory ? prev.searchStartTime : startTs, completed: false, strictMode: strict
      }));
      setIsPlaying(false);
  };

  const startCalculation = (type: EventType, ids: string[], strict: boolean, config: any, keepHistory: boolean) => {
      setIsPlaying(false); setHighlightedAlignment(null); lastEventGuardRef.current = null; const startTs = currentDate.getTime();
      calcDateRef.current = startTs; calcStartRef.current = Date.now();
      calcTargetRef.current = { type, ids, strictMode: strict, tolerance: config?.tolerance, solarRadius: config?.solarRadius };
      lastRealTimeRef.current = Date.now(); 
      setSearchState(prev => ({
          active: false, type, targetIds: ids, status: 'Calculating...', speed: 'medium', activeTolerance: config?.tolerance, activeSolarRadius: config?.solarRadius,
          isCalculating: true, calculationResult: null, calculationDuration: 0, elapsedTime: keepHistory ? prev.elapsedTime : 0, currentScanDate: startTs,
          continuousPaused: false, foundEvents: keepHistory ? prev.foundEvents : [], searchStartTime: keepHistory ? prev.searchStartTime : startTs, completed: false, strictMode: strict
      }));
      calculationTimeoutRef.current = setTimeout(runCalculationBatch, 0);
  };

  const stopCalculation = () => {
      if (calculationTimeoutRef.current) clearTimeout(calculationTimeoutRef.current);
      calcTargetRef.current = null;
      setSearchState(prev => ({ ...prev, isCalculating: false, active: false }));
  };

  const resetSearchForm = () => {
      setSearchState(prev => ({ ...prev, active: false, type: null, status: '', isCalculating: false, calculationResult: null, continuousPaused: false, completed: false, elapsedTime: 0, foundEvents: [], searchStartTime: 0, currentScanDate: 0, strictMode: false }));
      setHighlightedAlignment(null); lastEventGuardRef.current = null;
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [animate]);

  return {
    currentDate, setCurrentDate, isPlaying, setIsPlaying, speedMultiplier, setSpeedMultiplier, timeDirection, setTimeDirection,
    highlightedAlignment, setHighlightedAlignment, searchState, setSearchState, notification, setNotification,
    startSearch, startCalculation, stopCalculation, resetSearchForm, runCalculationBatch, calculationTimeoutRef
  };
};
