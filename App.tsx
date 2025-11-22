
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import SolarSystem from './components/SolarSystem';
import Controls from './components/Controls';
import PlanetInfoPanel from './components/PlanetInfoPanel';
import SettingsPanel from './components/SettingsPanel';
import EventsPanel from './components/EventsPanel';
import { RightSidebar } from './components/RightSidebar';
import { VirtualJoystick } from './components/VirtualJoystick';
import PinnedPlanetsSidebar from './components/PinnedPlanetsSidebar';
import { PlanetData, AppSettings, PinnedPlanet, RealStar, Constellation } from './types';
import { MILLISECONDS_PER_DAY } from './data/constants';
import { DEFAULT_SUN_ANGULAR_RADIUS_DEG, calculateBodyPosition } from './utils/astronomy';
import { useSimulation } from './hooks/useSimulation';
import { loadSolarSystemData } from './utils/DataLoader';
import { SYSTEM_DEFAULTS } from './data/default_settings';

const App: React.FC = () => {
  // --- Data State ---
  const [celestialData, setCelestialData] = useState<{ 
      planets: PlanetData[], 
      dwarfs: PlanetData[], 
      asteroidsComets: PlanetData[], 
      allObjects: PlanetData[] 
  } | null>(null);

  const [realStars, setRealStars] = useState<RealStar[]>([]);
  const [constellations, setConstellations] = useState<Constellation[]>([]);

  // Store Parse Errors
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  // Store Visibility Map (User toggles)
  const [visibilityMap, setVisibilityMap] = useState<Record<string, boolean>>({});
  
  const [loading, setLoading] = useState(true);

  // --- Load Data ---
  // Added isRefresh parameter to support silent reloading without unmounting UI
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    const result = await loadSolarSystemData();
    
    // 1. Set Data Categories
    setCelestialData({
        planets: result.planets,
        dwarfs: result.dwarfs,
        asteroidsComets: result.asteroidsComets,
        allObjects: result.allObjects
    });

    setRealStars(result.realStars);
    setConstellations(result.constellations);
    
    // 2. Set Errors
    setParseErrors(result.errors);

    // 3. Initialize or Merge Visibility Map
    setVisibilityMap(prev => {
        const next = { ...prev };
        result.allObjects.forEach(obj => {
            if (obj.isValid && next[obj.id] === undefined) {
                next[obj.id] = obj.visible;
            }
        });
        return next;
    });

    if (!isRefresh) setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Flattened list of VALID, RENDERABLE bodies used for searching/info
  const allBodies = useMemo(() => {
    if (!celestialData) return [];
    return [...celestialData.planets, ...celestialData.dwarfs, ...celestialData.asteroidsComets];
  }, [celestialData]);

  // --- Helper: Calculate Initial Yaw for Earth-at-Bottom (Standard Orientation) ---
  const calculateSmartYaw = useCallback((date: Date, earthData?: PlanetData) => {
      if (!earthData) return 0;
      const earthPos = calculateBodyPosition('earth', earthData.elements, date, false);
      const angleRad = Math.atan2(earthPos.y, earthPos.x);
      const angleDeg = angleRad * (180 / Math.PI);
      
      // 270 - angle to put Earth at 6 o'clock
      let targetYaw = 270 - angleDeg;
      return (targetYaw + 360) % 360;
  }, []);

  // --- UI State ---
  const [showSettings, setShowSettings] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [isEventsPanelPinned, setIsEventsPanelPinned] = useState(false);
  const [showHistorySidebar, setShowHistorySidebar] = useState(false);
  const [selectedPlanet, setSelectedPlanet] = useState<PlanetData | null>(null);
  
  const [pinnedPlanets, setPinnedPlanets] = useState<PinnedPlanet[]>([]);
  const [cameraFocusId, setCameraFocusId] = useState<string | null>(null);
  const [resetCameraFlag, setResetCameraFlag] = useState(0);
  const initialOrientationSet = useRef(false);
  
  // --- Settings Initialization with Persistence ---
  const getInitialSettings = (): AppSettings => {
    try {
      const saved = localStorage.getItem('user_settings');
      if (saved) {
        const parsed = JSON.parse(saved);
        // Deep merge to ensure renderSettings structure is preserved if new keys are added to defaults later
        return {
          ...SYSTEM_DEFAULTS,
          ...parsed,
          renderSettings: { ...SYSTEM_DEFAULTS.renderSettings, ...(parsed.renderSettings || {}) }
        };
      }
    } catch (e) {
      console.error("Failed to load settings from local storage", e);
    }
    return SYSTEM_DEFAULTS;
  };

  const [settings, setSettings] = useState<AppSettings>(getInitialSettings);

  // --- Simulation Hook ---
  const sim = useSimulation(settings, allBodies);

  // --- Initial Setup (Smart Orientation) ---
  useEffect(() => {
      if (!celestialData) return;
      if (initialOrientationSet.current) return; // Strict single execution guard

      // Only apply smart auto-orientation if NO user settings are saved.
      // If user has saved settings, we respect their saved Yaw/Tilt.
      const hasSavedSettings = !!localStorage.getItem('user_settings');
      
      if (!hasSavedSettings) {
          // Initialize with Standard Orientation (Earth at Bottom)
          const earth = celestialData.planets.find(p => p.id === 'earth');
          const smartYaw = calculateSmartYaw(sim.currentDate, earth);
          setSettings(prev => ({ ...prev, viewYaw: smartYaw }));
      }
      
      initialOrientationSet.current = true;
  }, [celestialData, calculateSmartYaw]); 

  // --- Settings Handlers ---
  const handleSaveDefaults = () => {
      try {
          localStorage.setItem('user_settings', JSON.stringify(settings));
      } catch (e) {
          console.error("Save failed", e);
      }
  };

  const handleClearDefaults = () => {
      localStorage.removeItem('user_settings');
  };

  const handleRestoreDefaults = () => {
      // Restore to System Defaults immediately
      setSettings(SYSTEM_DEFAULTS);
      
      // Also trigger re-orientation logic for better UX (restore to "Factory" state which includes smart yaw)
      if (celestialData) {
          const earth = celestialData.planets.find(p => p.id === 'earth');
          const smartYaw = calculateSmartYaw(sim.currentDate, earth);
          setSettings(prev => ({ ...prev, viewYaw: smartYaw }));
          
          // Trigger camera zoom reset too
          setResetCameraFlag(prev => prev + 1);
      }
  };

  const handleToggleVisibility = useCallback((id: string) => {
      setVisibilityMap(prev => ({
          ...prev,
          [id]: !prev[id]
      }));
  }, []);

  useEffect(() => {
      if (sim.searchState.active || sim.searchState.isCalculating || sim.searchState.foundEvents.length > 0) {
          setShowHistorySidebar(true);
      }
  }, [sim.searchState.active, sim.searchState.isCalculating, sim.searchState.foundEvents.length]);

  const handleTogglePin = (id: string) => {
      setPinnedPlanets(prev => {
          const exists = prev.find(p => p.id === id);
          if (exists) return prev.filter(p => p.id !== id);
          
          const newPins = [...prev, { id, color: '#ffffff' }];
          // Pin parent if satellite
          let parentId: string | undefined;
          for (const p of allBodies) {
              if (p.satellites?.some(s => s.id === id)) {
                  parentId = p.id; break;
              }
          }
          if (parentId) {
              const parentPinned = newPins.find(p => p.id === parentId);
              if (!parentPinned) newPins.push({ id: parentId, color: '#ffffff' });
          }
          return newPins;
      });
  };

  const handlePinColorChange = (id: string, color: string) => {
      setPinnedPlanets(prev => prev.map(p => p.id === id ? { ...p, color } : p));
  };

  const handleToggleFollow = (id: string) => {
      setCameraFocusId(prev => prev === id ? null : id);
  };

  const handleCloseInfoPanel = () => {
      if (cameraFocusId === selectedPlanet?.id) setCameraFocusId(null);
      setSelectedPlanet(null);
  };

  const updateViewAfterJump = (time: number) => {
      sim.setCurrentDate(new Date(time));
      let foundIds: string[] = sim.searchState.type === 'TRANSIT' ? ['earth', ...(sim.searchState.targetIds || []), 'sun'] : ['earth', ...(sim.searchState.targetIds || [])];
      sim.setHighlightedAlignment(foundIds);
      if (!settings.continuousIteration && !isEventsPanelPinned) setShowEvents(false);
  };

  const handleSearchNext = () => {
     if (!sim.searchState.type || !sim.searchState.targetIds) return;
     const PADDING = MILLISECONDS_PER_DAY; 
     let nextStartTime = sim.timeDirection === 1 ? (sim.searchState.resultEndDate || sim.currentDate.getTime()) + PADDING : (sim.searchState.resultStartDate || sim.currentDate.getTime()) - PADDING;
     sim.setCurrentDate(new Date(nextStartTime));
     const config = { tolerance: sim.searchState.activeTolerance, solarRadius: sim.searchState.activeSolarRadius || DEFAULT_SUN_ANGULAR_RADIUS_DEG };
     if (settings.allowCalculationSearch) sim.startCalculation(sim.searchState.type, sim.searchState.targetIds, sim.searchState.strictMode || false, config, true);
     else sim.startSearch(sim.searchState.type, sim.searchState.targetIds, sim.searchState.speed, sim.searchState.strictMode || false, config, true);
  };

  const handleRestartSearch = () => {
      if (!sim.searchState.type || !sim.searchState.targetIds) return;
      sim.startSearch(
          sim.searchState.type, sim.searchState.targetIds, sim.searchState.speed, sim.searchState.strictMode || false,
          { tolerance: sim.searchState.activeTolerance, solarRadius: sim.searchState.activeSolarRadius || DEFAULT_SUN_ANGULAR_RADIUS_DEG }, false
      );
  };

  const handleCameraUpdate = useCallback((dYaw: number, dTilt: number) => {
    setSettings(prev => {
       let newYaw = (prev.viewYaw + dYaw) % 360;
       if (newYaw < 0) newYaw += 360;
       let newTilt = Math.max(-90, Math.min(90, prev.viewTilt - dTilt));
       return { ...prev, viewYaw: newYaw, viewTilt: newTilt };
    });
  }, []);

  // --- Smooth Camera Reset Animation ---
  const animateCameraToStandard = useCallback(() => {
      if (!celestialData) return;

      // 1. Stop following any planet (this snaps pivot to Sun, which is what we want for standard view)
      setCameraFocusId(null);

      // 2. Calculate Target Yaw (Earth at Bottom)
      const earth = celestialData.planets.find(p => p.id === 'earth');
      const targetYaw = calculateSmartYaw(sim.currentDate, earth);

      // 3. Animation Setup
      const startYaw = settings.viewYaw;
      const startTilt = settings.viewTilt;
      const targetTilt = 90;
      const duration = 1000; // ms
      const startTime = performance.now();

      // Calculate shortest path for Yaw rotation
      let diffYaw = targetYaw - startYaw;
      while (diffYaw > 180) diffYaw -= 360;
      while (diffYaw < -180) diffYaw += 360;

      const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

      const step = (now: number) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const ease = easeOutCubic(progress);

          const currentYaw = startYaw + diffYaw * ease;
          const currentTilt = startTilt + (targetTilt - startTilt) * ease;

          setSettings(prev => ({
             ...prev,
             viewYaw: (currentYaw + 360) % 360,
             viewTilt: currentTilt
          }));

          if (progress < 1) {
              requestAnimationFrame(step);
          } else {
              // Ensure final exact values
              setSettings(prev => ({
                 ...prev,
                 viewYaw: (targetYaw + 360) % 360,
                 viewTilt: targetTilt
              }));
          }
      };

      requestAnimationFrame(step);

      // 4. Trigger Zoom Reset (handled by SolarSystem via D3 transition)
      setResetCameraFlag(prev => prev + 1);

  }, [celestialData, sim.currentDate, calculateSmartYaw, settings.viewYaw, settings.viewTilt]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (settings.continuousIteration && (sim.searchState.active || sim.searchState.isCalculating)) {
            if (sim.searchState.continuousPaused) {
                sim.setSearchState(s => ({...s, continuousPaused: false}));
                sim.calculationTimeoutRef.current = setTimeout(sim.runCalculationBatch, 0);
            } else {
                sim.setSearchState(s => ({...s, continuousPaused: true}));
                if (sim.calculationTimeoutRef.current) clearTimeout(sim.calculationTimeoutRef.current);
            }
            return;
        } 
        if (sim.searchState.active) { sim.setSearchState(s => ({ ...s, active: false, status: 'Cancelled' })); return; } 
        if (sim.searchState.isCalculating) { sim.stopCalculation(); return; }
        sim.setIsPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sim.searchState, settings.continuousIteration]);

  if (loading || !celestialData) {
      return <div className="w-screen h-screen bg-black flex items-center justify-center text-white">Loading Solar System Data...</div>;
  }

  // Sidebar Split View Logic
  const isHistorySidebarVisible = !!(showHistorySidebar && (sim.searchState.foundEvents.length > 0 || sim.searchState.active || sim.searchState.isCalculating || sim.searchState.completed));
  const isPinnedSidebarVisible = pinnedPlanets.length > 0;
  const isSplitView = isHistorySidebarVisible && isPinnedSidebarVisible;

  // Filter Visible Objects for Renderers (Top Level)
  const renderPlanets = celestialData.planets.filter(p => visibilityMap[p.id] !== false);
  const renderDwarfs = celestialData.dwarfs.filter(p => visibilityMap[p.id] !== false);
  const renderAsteroids = celestialData.asteroidsComets.filter(p => visibilityMap[p.id] !== false);

  return (
    <div className="w-screen h-screen bg-black text-white overflow-hidden flex relative select-none">
      
      {/* Error Banner */}
      {parseErrors.length > 0 && (
          <div className="absolute top-0 left-0 right-0 bg-red-900/90 text-white px-4 py-2 z-[60] text-xs flex justify-between items-center">
              <span>Warning: {parseErrors.length} objects failed to parse. (Check console for details)</span>
              <button onClick={() => setParseErrors([])} className="text-red-200 hover:text-white font-bold">Dismiss</button>
          </div>
      )}

      <SolarSystem 
        currentDate={sim.currentDate} 
        onPlanetSelect={setSelectedPlanet}
        selectedPlanetId={selectedPlanet?.id || null}
        settings={settings}
        highlightedAlignment={sim.highlightedAlignment}
        pinnedPlanets={pinnedPlanets}
        cameraFocusId={cameraFocusId}
        planets={renderPlanets}
        dwarfs={renderDwarfs}
        asteroidsComets={renderAsteroids}
        resetCameraFlag={resetCameraFlag}
        visibilityMap={visibilityMap}
        realStars={realStars}
        constellations={constellations}
      />

      <div className="absolute top-6 left-8 pointer-events-none z-10">
        <h1 className="text-4xl font-bold tracking-tighter bg-gradient-to-br from-white to-gray-500 bg-clip-text text-transparent">
          SOLAR SYSTEM
        </h1>
        <p className="text-sm text-gray-400 tracking-widest uppercase mt-1">Interactive Explorer // 交互式探索</p>
      </div>

      {settings.showCameraControl && (
          <VirtualJoystick 
            onUpdate={handleCameraUpdate} 
            onReset={animateCameraToStandard}
            show3DToggle={settings.enableSpaceView}
            is3DEnabled={settings.enablePerspective}
            onToggle3D={() => setSettings(prev => ({ ...prev, enablePerspective: !prev.enablePerspective }))}
            isProximityEnabled={settings.enableProximitySim}
            onToggleProximity={() => setSettings(prev => ({ ...prev, enableProximitySim: !prev.enableProximitySim }))}
          />
      )}

      {sim.notification.visible && (
        <div className="absolute top-32 right-8 max-w-xs z-50 animate-fade-in-out">
          <div className="bg-yellow-600/90 backdrop-blur px-4 py-3 rounded-lg shadow-lg border border-yellow-500">
             <p className="text-white text-sm font-medium leading-tight">{sim.notification.message}</p>
          </div>
        </div>
      )}
      
      <Controls 
        isPlaying={sim.isPlaying}
        onTogglePlay={() => sim.setIsPlaying(!sim.isPlaying)}
        onPause={() => sim.setIsPlaying(false)}
        speedMultiplier={sim.speedMultiplier}
        onSpeedChange={(factor) => sim.setSpeedMultiplier(prev => {
            if (factor === 0.5) return Math.abs(prev) <= 0.125 ? prev : prev * 0.5;
            return Math.abs(prev) >= 64 ? prev : prev * 2;
        })}
        timeDirection={sim.timeDirection}
        onToggleTimeDirection={() => sim.setTimeDirection(prev => prev === 1 ? -1 : 1)}
        currentDate={sim.currentDate}
        onDateChange={(date) => { sim.setCurrentDate(date); sim.setHighlightedAlignment(null); }}
        onResetTime={() => {
          sim.setCurrentDate(new Date());
          sim.setSpeedMultiplier(1);
          sim.setTimeDirection(1); 
          sim.setIsPlaying(false); 
          sim.resetSearchForm();
        }}
        onOpenSettings={() => setShowSettings(true)}
        onOpenEvents={() => {
          setShowEvents(true);
          setIsEventsPanelPinned(true); // Automatically pin on open
        }}
        searchActive={sim.searchState.active || sim.searchState.isCalculating}
      />

      {showSettings && (
        <SettingsPanel 
          settings={settings} 
          onSettingsChange={setSettings} 
          onClose={() => setShowSettings(false)} 
          searchActive={sim.searchState.active || sim.searchState.isCalculating}
          onSaveDefaults={handleSaveDefaults}
          onClearDefaults={handleClearDefaults}
          onRestoreDefaults={handleRestoreDefaults}
          allBodies={celestialData.allObjects}
          visibilityMap={visibilityMap}
          onToggleVisibility={handleToggleVisibility}
          onDataReload={() => loadData(true)} 
        />
      )}

      {showEvents && (
        <EventsPanel 
          searchState={sim.searchState}
          onSearch={(t, ids, s, strict, c) => sim.startSearch(t, ids, s, strict || false, c, false)} 
          onCancel={sim.stopCalculation}
          onClose={() => setShowEvents(false)}
          onSpeedChange={(s) => sim.setSearchState(prev => ({ ...prev, speed: s }))}
          isPinned={isEventsPanelPinned}
          onTogglePin={() => setIsEventsPanelPinned(prev => !prev)}
          allowCalculationSearch={settings.allowCalculationSearch}
          continuousIteration={settings.continuousIteration}
          onStartCalculation={(t, ids, strict, c) => sim.startCalculation(t, ids, strict || false, c, false)}
          onJumpToStart={() => sim.searchState.resultStartDate && updateViewAfterJump(sim.searchState.resultStartDate)}
          onJumpToOptimal={() => sim.searchState.resultOptimalDate && updateViewAfterJump(sim.searchState.resultOptimalDate)}
          onComplete={sim.resetSearchForm}
          onRestart={handleRestartSearch}
          onPauseContinuous={() => sim.setSearchState(s => ({...s, continuousPaused: true}))}
          onContinueContinuous={() => {
              sim.setSearchState(s => ({...s, continuousPaused: false}));
              sim.calculationTimeoutRef.current = setTimeout(sim.runCalculationBatch, 0);
          }}
          onEndContinuous={() => {
              if (sim.calculationTimeoutRef.current) clearTimeout(sim.calculationTimeoutRef.current);
              sim.setSearchState(prev => ({ ...prev, isCalculating: false, active: false, completed: true }));
          }}
          settings={settings}
          onSettingsChange={setSettings}
          onSearchNext={handleSearchNext}
          allPlanets={celestialData.planets}
        />
      )}

      {isHistorySidebarVisible && (
            <RightSidebar 
               events={sim.searchState.foundEvents}
               onJumpToStart={updateViewAfterJump}
               onJumpToOptimal={updateViewAfterJump}
               completed={sim.searchState.completed}
               totalYearsSearched={Math.abs((sim.searchState.active ? sim.currentDate.getTime() : sim.searchState.currentScanDate) - sim.searchState.searchStartTime) / (MILLISECONDS_PER_DAY * 365)}
               elapsedTime={sim.searchState.elapsedTime}
               onClose={() => setShowHistorySidebar(false)}
               isSplitView={isSplitView}
            />
      )}

      <PinnedPlanetsSidebar
        pinnedPlanets={pinnedPlanets}
        onTogglePin={handleTogglePin}
        onColorChange={handlePinColorChange}
        onCameraFocus={(id) => setCameraFocusId(prev => prev === id ? null : id)}
        cameraFocusId={cameraFocusId}
        settings={settings}
        allBodies={allBodies}
        isSplitView={isSplitView}
      />

      {selectedPlanet && (
        <PlanetInfoPanel 
          selectedPlanet={selectedPlanet} 
          onClose={handleCloseInfoPanel}
          onTogglePin={handleTogglePin}
          isPinned={pinnedPlanets.some(p => p.id === selectedPlanet.id)}
          onToggleFollow={handleToggleFollow}
          isFollowing={cameraFocusId === selectedPlanet.id}
          allBodies={allBodies}
        />
      )}
    </div>
  );
};

export default App;
