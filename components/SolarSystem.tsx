
import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3'; 
import { AppSettings, PlanetData, PinnedPlanet, Position, RealStar, Constellation } from '../types';
import StarField from './StarField';
import SchematicSolarSystem from './renderers/SchematicSolarSystem';
import TrueScaleSolarSystem from './renderers/TrueScaleSolarSystem';
import { calculateBodyPosition, calculateSatellitePosition } from '../utils/astronomy';
import { AU_SCALE_SCHEMATIC, AU_SCALE_TRUE } from '../data/constants';

interface SolarSystemProps {
  currentDate: Date;
  onPlanetSelect: (planet: PlanetData) => void;
  selectedPlanetId: string | null;
  settings: AppSettings;
  highlightedAlignment: string[] | null;
  pinnedPlanets: PinnedPlanet[];
  cameraFocusId: string | null;
  planets: PlanetData[];
  dwarfs: PlanetData[];
  asteroidsComets: PlanetData[];
  resetCameraFlag: number; // Signal to animate camera reset
  visibilityMap: Record<string, boolean>;
  realStars: RealStar[];
  constellations: Constellation[];
}

const SolarSystem: React.FC<SolarSystemProps> = ({ 
  currentDate, 
  onPlanetSelect, 
  selectedPlanetId, 
  settings,
  highlightedAlignment,
  pinnedPlanets,
  cameraFocusId,
  planets,
  dwarfs,
  asteroidsComets,
  resetCameraFlag,
  visibilityMap,
  realStars,
  constellations
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  
  // State tracking
  const prevTrueScale = useRef(settings.trueScale);
  const prevDimensions = useRef({ w: window.innerWidth, h: window.innerHeight });

  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(() => 
    d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(0.8)
  );
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [centerOfRotation, setCenterOfRotation] = useState<Position>({ x: 0, y: 0, z: 0 });

  // 1. Handle Window Resize State Update
  useEffect(() => {
    const handleResize = () => {
      setDimensions({ w: window.innerWidth, h: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 2. Initialize D3 Zoom Behavior (Runs Once)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);
    
    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .on('zoom', (event) => {
        setZoomTransform(event.transform);
      });
    
    zoomBehaviorRef.current = zoom;
    container.call(zoom);
    
    // Synchronize initial state
    container.call(zoom.transform, zoomTransform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Update Scale Extents based on Mode
  useEffect(() => {
      if (!zoomBehaviorRef.current || !containerRef.current) return;
      const extent: [number, number] = settings.trueScale ? [0.000001, 100000] : [0.0001, 100];
      zoomBehaviorRef.current.scaleExtent(extent);
  }, [settings.trueScale]);

  // 4. Handle Smart Scaling (Switching Modes) & Resize Center Preservation
  useEffect(() => {
      if (!containerRef.current || !zoomBehaviorRef.current) return;
      const container = d3.select(containerRef.current);
      
      let newTransform = zoomTransform;
      let shouldUpdate = false;

      // A. Handle Resize (Keep view centered relative to screen)
      if (prevDimensions.current.w !== dimensions.w || prevDimensions.current.h !== dimensions.h) {
          const dx = (dimensions.w - prevDimensions.current.w) / 2;
          const dy = (dimensions.h - prevDimensions.current.h) / 2;
          
          // Shift translation to keep the center point stationary relative to screen center
          newTransform = d3.zoomIdentity
            .translate(newTransform.x + dx, newTransform.y + dy)
            .scale(newTransform.k);
          
          shouldUpdate = true;
          prevDimensions.current = dimensions;
      }

      // B. Handle True Scale Toggle (Smart Zoom)
      if (prevTrueScale.current !== settings.trueScale) {
          const ratio = AU_SCALE_TRUE / AU_SCALE_SCHEMATIC; // ~361

          // Math Logic:
          // ScreenPos = WorldPos_AU * BaseScale * ZoomK + Translate
          // We want ScreenPos to be invariant (no jump).
          // We assume WorldPos_AU (the celestial coordinates) are invariant.
          // Therefore: BaseScale_Old * ZoomK_Old + Translate_Old = BaseScale_New * ZoomK_New + Translate_New
          // If we set Translate_New = Translate_Old, we just need to satisfy:
          // BaseScale_Old * ZoomK_Old = BaseScale_New * ZoomK_New
          // So: ZoomK_New = ZoomK_Old * (BaseScale_Old / BaseScale_New)
          
          let newK = newTransform.k;
          if (settings.trueScale) {
               // Schematic -> True Scale (Base Scale increases 65 -> 23500)
               // ZoomK must decrease by same ratio to keep visual size constant
               newK = newTransform.k / ratio;
          } else {
               // True Scale -> Schematic (Base Scale decreases 23500 -> 65)
               // ZoomK must increase
               newK = newTransform.k * ratio;
          }

          // We preserve x and y exactly to maintain the center alignment
          newTransform = d3.zoomIdentity.translate(newTransform.x, newTransform.y).scale(newK);
          shouldUpdate = true;
          prevTrueScale.current = settings.trueScale;
      }

      if (shouldUpdate) {
          setZoomTransform(newTransform);
          // Important: Update D3's internal state immediately to prevent jumps on next interaction
          container.call(zoomBehaviorRef.current.transform, newTransform);
      }

  }, [dimensions, settings.trueScale, zoomTransform]);


  // Handle Camera Reset Animation (Triggered by Parent)
  useEffect(() => {
    if (!containerRef.current || !zoomBehaviorRef.current || resetCameraFlag === 0) return;
    
    const container = d3.select(containerRef.current);
    const { w, h } = dimensions;
    
    // Default zooms
    const targetScale = settings.trueScale ? 0.0025 : 0.8;
    
    // Reset to center (Sun) and default scale with smooth easing
    const newTransform = d3.zoomIdentity.translate(w / 2, h / 2).scale(targetScale);

    container.transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, newTransform);
      
  }, [resetCameraFlag, settings.trueScale, dimensions]); 

  // Handle Camera Focus Target Tracking (Center of Rotation)
  useEffect(() => {
    let focusPos: Position = { x: 0, y: 0, z: 0 };

    if (cameraFocusId) {
        if (cameraFocusId === 'sun') {
            focusPos = { x: 0, y: 0, z: 0 };
        } else {
            const allBodies = [...planets, ...dwarfs, ...asteroidsComets];
            const planet = allBodies.find(p => p.id === cameraFocusId);
            
            if (planet) {
                focusPos = calculateBodyPosition(planet.id, planet.elements, currentDate, settings.useHighPrecision);
            } else if (settings.trueScale) {
                for (const p of planets) {
                    if (p.satellites) {
                        const moon = p.satellites.find(m => m.id === cameraFocusId);
                        if (moon) {
                            const parentRaw = calculateBodyPosition(p.id, p.elements, currentDate, settings.useHighPrecision);
                            const massMult = p.massRelativeToSun ? Math.sqrt(p.massRelativeToSun) : 0;
                            focusPos = calculateSatellitePosition(moon.elements, parentRaw, currentDate, massMult, moon.id, settings.useHighPrecision);
                            break;
                        }
                    }
                }
            }
        }
    } else {
        focusPos = { x: 0, y: 0, z: 0 };
    }

    setCenterOfRotation(focusPos);

    if (cameraFocusId && containerRef.current && zoomBehaviorRef.current) {
        const { w, h } = dimensions;
        const currentK = zoomTransform.k;
        const newTransform = d3.zoomIdentity.translate(w / 2, h / 2).scale(currentK);
        d3.select(containerRef.current).call(zoomBehaviorRef.current.transform, newTransform);
    }
  }, [cameraFocusId, currentDate, dimensions, settings.trueScale, settings.useHighPrecision, planets, dwarfs, asteroidsComets]); 


  return (
    <div ref={containerRef} className="w-full h-full bg-black cursor-move relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none bg-black" style={{ filter: `brightness(${settings.starBrightness})` }}>
         {settings.background === 'milkyway' ? (
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#080808_0%,_#000000_100%)]"></div>
         ) : (
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_#111_0%,_#000_100%)]"></div>
         )}
         <StarField 
            settings={settings} 
            realStars={realStars} 
            constellations={constellations}
         />
      </div>
      
      {settings.trueScale ? (
        <TrueScaleSolarSystem 
            currentDate={currentDate} settings={settings} onPlanetSelect={onPlanetSelect} selectedPlanetId={selectedPlanetId}
            highlightedAlignment={highlightedAlignment} pinnedPlanets={pinnedPlanets} zoomTransform={zoomTransform}
            dimensions={dimensions} centerOfRotation={centerOfRotation}
            planets={planets} dwarfs={dwarfs} asteroidsComets={asteroidsComets}
            visibilityMap={visibilityMap}
        />
      ) : (
        <SchematicSolarSystem 
            currentDate={currentDate} settings={settings} onPlanetSelect={onPlanetSelect} selectedPlanetId={selectedPlanetId}
            highlightedAlignment={highlightedAlignment} pinnedPlanets={pinnedPlanets} zoomTransform={zoomTransform}
            dimensions={dimensions} centerOfRotation={centerOfRotation}
            planets={planets} dwarfs={dwarfs} asteroidsComets={asteroidsComets}
            visibilityMap={visibilityMap}
        />
      )}

      {/* Minimalist Compact Watermark Camera Info - Bottom Left */}
      <div className="absolute bottom-4 left-4 pointer-events-none z-20 bg-gray-900/80 border border-white/10 rounded p-2 flex flex-col gap-0.5 select-none text-white/50 text-[9px] font-mono font-bold tracking-widest uppercase backdrop-blur-sm">
         <span className="flex items-center justify-between gap-4"><span>TGT</span> <span className="text-white/80">{getTargetName()}</span></span>
         <span className="flex items-center justify-between gap-4"><span>ZM</span> <span className="text-white/80">{zoomTransform.k.toExponential(1)}x</span></span>
         <span className="flex items-center justify-between gap-4"><span>TILT</span> <span className="text-white/80">{settings.viewTilt.toFixed(0)}°</span></span>
         <span className="flex items-center justify-between gap-4"><span>YAW</span> <span className="text-white/80">{settings.viewYaw.toFixed(0)}°</span></span>
      </div>
    </div>
  );

  function getTargetName() {
      if (!cameraFocusId) return "SUN (FREE)";
      if (cameraFocusId === 'sun') return "SUN";
      const allBodies = [...planets, ...dwarfs, ...asteroidsComets];
      const p = allBodies.find(x => x.id === cameraFocusId);
      if (p) return p.englishName.toUpperCase();
      for (const pl of planets) {
          const m = pl.satellites?.find(s => s.id === cameraFocusId);
          if (m) return `${m.englishName.toUpperCase()}`;
      }
      return cameraFocusId.toUpperCase();
  }
};

export default SolarSystem;
