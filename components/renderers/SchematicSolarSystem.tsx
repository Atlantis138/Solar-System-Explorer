

import React, { useEffect, useRef, useMemo, useState } from 'react';
import { 
  KUIPER_BELT_AU,
  HELIOPAUSE_AU,
  AU_SCALE_SCHEMATIC, 
  SUN_RADIUS_SCHEMATIC, 
  J2000_DATE,
  MILLISECONDS_PER_DAY,
  SUN_DATA
} from '../../data/constants';
import { calculateBodyPosition, calculateOrbitPath } from '../../utils/astronomy';
import { project3D, smoothStep } from '../../core/projection';
import { calculateBodyOpacity, shouldRenderComet, getVisibilityThreshold } from '../../core/renderConfig';
import { PlanetData, AppSettings, PinnedPlanet, Position } from '../../types';

interface SchematicSolarSystemProps {
  currentDate: Date;
  settings: AppSettings;
  onPlanetSelect: (planet: PlanetData) => void;
  selectedPlanetId: string | null;
  highlightedAlignment: string[] | null;
  pinnedPlanets: PinnedPlanet[];
  zoomTransform: any; 
  dimensions: { w: number, h: number };
  centerOfRotation: Position;
  planets: PlanetData[];
  dwarfs: PlanetData[];
  asteroidsComets: PlanetData[];
  visibilityMap: Record<string, boolean>;
}

const ASTEROID_COUNT = 1000;
const ASTEROID_BELT_INNER_AU = 2.2;
const ASTEROID_BELT_OUTER_AU = 3.2;
const MIN_ORBIT_WIDTH = 0.4;
const MAX_ORBIT_WIDTH = 80.0;
const ECCENTRICITY_THRESHOLD = 0.2;

const SchematicSolarSystem: React.FC<SchematicSolarSystemProps> = ({
  currentDate,
  settings,
  onPlanetSelect,
  selectedPlanetId,
  highlightedAlignment,
  pinnedPlanets,
  zoomTransform,
  dimensions,
  centerOfRotation,
  planets, dwarfs, asteroidsComets,
  visibilityMap
}) => {
  const orbitCanvasRef = useRef<HTMLCanvasElement>(null);
  const [planetPositions, setPlanetPositions] = useState<Record<string, any>>({});
  const k = zoomTransform.k;

  const visiblePlanets = useMemo(() => {
    let list = [...planets];
    if (settings.showDwarfPlanets) {
      list = [...list, ...dwarfs];
    }
    if (settings.showAsteroidsComets) {
      list = [...list, ...asteroidsComets];
    }
    return list;
  }, [settings.showDwarfPlanets, settings.showAsteroidsComets, planets, dwarfs, asteroidsComets]);

  const asteroids = useMemo(() => {
    const arr = [];
    for(let i = 0; i < ASTEROID_COUNT; i++) {
      const r = ASTEROID_BELT_INNER_AU + Math.random() * (ASTEROID_BELT_OUTER_AU - ASTEROID_BELT_INNER_AU);
      const theta = Math.random() * 2 * Math.PI; 
      const sizeVar = 0.5 + Math.random() * 1.0; 
      const speedVar = 0.9 + Math.random() * 0.2; 
      const z = (Math.random() - 0.5) * 0.4; 
      arr.push({ r, theta, z, sizeVar, speedVar });
    }
    return arr;
  }, []);

  const dayDiff = (currentDate.getTime() - J2000_DATE.getTime()) / MILLISECONDS_PER_DAY;
  const baseBeltAngle = dayDiff * (0.214 * Math.PI / 180); 

  useEffect(() => {
    const newPos: Record<string, any> = {};
    visiblePlanets.forEach(planet => {
      // Already filtered by App.tsx, but ensure safety
      if (visibilityMap[planet.id] === false) return;

      const rawPos = calculateBodyPosition(planet.id, planet.elements, currentDate, settings.useHighPrecision);
      
      if ((planet.type === 'comet' || planet.type === 'asteroid')) {
           const dist = Math.sqrt(rawPos.x**2 + rawPos.y**2 + rawPos.z**2);
           if (!shouldRenderComet(dist, settings.renderSettings)) return;
      }

      const proj = project3D(rawPos, AU_SCALE_SCHEMATIC, settings, k, planet.id, centerOfRotation);
      const renderOpacity = calculateBodyOpacity(planet, k, settings.renderSettings, false);
      const finalOpacity = proj.opacity * renderOpacity;
      newPos[planet.id] = { ...proj, z: proj.depth, raw: rawPos, opacity: finalOpacity, isVisible: proj.isVisible && finalOpacity > getVisibilityThreshold(settings.renderSettings.innerQuality === 'eco') }; 
    });
    
    const sunProj = project3D({ x: 0, y: 0, z: 0 }, AU_SCALE_SCHEMATIC, settings, k, 'sun', centerOfRotation);
    newPos['sun'] = { ...sunProj, z: sunProj.depth, raw: {x:0, y:0, z:0}, opacity: 1.0, isVisible: true };
    setPlanetPositions(newPos);
  }, [currentDate, visiblePlanets, settings, k, centerOfRotation, visibilityMap]);

  const asteroidOpacity = useMemo(() => {
      if (!settings.showAsteroidBelt) return 0;
      if (settings.renderSettings.innerQuality === 'eco') return k > 0.20 ? 0.6 : 0.0;
      if (!settings.showDwarfPlanets && !settings.showAsteroidsComets) return 0.6; 
      return smoothStep(0.2, 0.5, k) * 0.6; 
  }, [k, settings]);

  const beltOpacity = useMemo(() => {
     if (!settings.showRegionLabels) return 0; 
     if (settings.renderSettings.outerQuality === 'eco') return k < 0.15 ? 0.5 : 0.0;
     return 0.5 * (1 - smoothStep(0.4, 0.9, k));
  }, [k, settings]);

  useEffect(() => {
    const canvas = orbitCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h } = dimensions;
    canvas.width = w;
    canvas.height = h;
    ctx.clearRect(0, 0, w, h);
    ctx.save();
    ctx.translate(zoomTransform.x, zoomTransform.y);
    ctx.scale(zoomTransform.k, zoomTransform.k);

    const drawCosmicRing = (radiusAU: number, label: string, color: string, dashArray: number[], lineWidth: number) => {
        const segments = 180;
        const points: any[] = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * 2 * Math.PI;
            const pos = { x: radiusAU * Math.cos(theta), y: radiusAU * Math.sin(theta), z: 0 };
            points.push(project3D(pos, AU_SCALE_SCHEMATIC, settings, k, 'sun', centerOfRotation));
        }
        ctx.beginPath();
        ctx.setLineDash(dashArray);
        ctx.lineWidth = lineWidth;
        ctx.strokeStyle = color;
        let started = false;
        points.forEach(p => {
            if (p.isVisible) {
                if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                else { ctx.lineTo(p.x, p.y); }
            } else {
                started = false; 
            }
        });
        if (started && points[0].isVisible) ctx.closePath();
        ctx.globalAlpha = beltOpacity;
        ctx.stroke();
        ctx.setLineDash([]); 

        if (settings.showRegionLabels) {
            const chars = label.split('');
            const labelCenterAngle = Math.PI / 4; 
            const charSpread = 0.20;
            const startAngle = labelCenterAngle - ((chars.length - 1) * charSpread) / 2;
            const textRadius = radiusAU * 1.08;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;
            chars.forEach((char, i) => {
                const theta = startAngle + i * charSpread;
                const pos = { x: textRadius * Math.cos(theta), y: textRadius * Math.sin(theta), z: 0 };
                const proj = project3D(pos, AU_SCALE_SCHEMATIC, settings, k, 'sun', centerOfRotation);
                if (proj.isVisible && proj.opacity > 0.1) {
                    const screenRadius = radiusAU * AU_SCALE_SCHEMATIC * k;
                    const targetScreenFontSize = Math.min(20, screenRadius * 0.15);
                    const ctxFontSize = (targetScreenFontSize * proj.scaleFactor) / k;
                    if (targetScreenFontSize > 6) {
                        ctx.font = `bold ${ctxFontSize}px "Segoe UI", sans-serif`;
                        ctx.globalAlpha = beltOpacity * 0.8 * proj.opacity; 
                        ctx.fillText(char, proj.x, proj.y);
                    }
                }
            });
        }
    };

    const drawSchematicRing = (planet: PlanetData, planetPos: any) => {
        const ringData = planet.satellites?.find(s => s.isRing);
        if (!ringData || !ringData.outerRadius) return;
        
        // CHECK RING VISIBILITY (Usually rings are hidden if user hides satellite/ring category)
        if (visibilityMap[ringData.id] === false) return;

        const ratio = (ringData.outerRadius * 23500) / planet.relativeRadius;
        const innerRatio = ringData.innerRadius ? ((ringData.innerRadius * 23500) / planet.relativeRadius) : ratio * 0.8;
        const segments = 60;
        const innerPts: {x: number, y: number}[] = [];
        const outerPts: {x: number, y: number}[] = [];
        const tiltRad = (ringData.tilt || 0) * Math.PI / 180;
        const cosTilt = Math.cos(tiltRad);
        const sinTilt = Math.sin(tiltRad);
        const viewTiltRad = (settings.viewTilt * Math.PI) / 180;
        const viewYawRad = (settings.viewYaw * Math.PI) / 180;
        const sinViewT = Math.sin(viewTiltRad);
        const cosViewT = Math.cos(viewTiltRad);
        const sinViewY = Math.sin(viewYawRad);
        const cosViewY = Math.cos(viewYawRad);
        const basePixelRadius = planet.radius * planetPos.scaleFactor; 
        const outerPixelR = basePixelRadius * ratio;
        const innerPixelR = basePixelRadius * innerRatio;

        const transformPoint = (r: number, theta: number) => {
             const x0 = r * Math.cos(theta);
             const y0 = r * Math.sin(theta);
             const x_tilt = x0;
             const y_tilt = y0 * cosTilt;
             const z_tilt = y0 * sinTilt;
             const x_yaw = x_tilt * cosViewY - y_tilt * sinViewY;
             const y_yaw = x_tilt * sinViewY + y_tilt * cosViewY;
             const z_yaw = z_tilt;
             const x_screen = x_yaw;
             const y_screen = -(y_yaw * sinViewT + z_yaw * cosViewT);
             return { x: x_screen, y: y_screen };
        };

        for (let i = 0; i <= segments; i++) {
             const theta = (i / segments) * Math.PI * 2;
             outerPts.push(transformPoint(outerPixelR, theta));
             innerPts.push(transformPoint(innerPixelR, theta));
        }

        ctx.beginPath();
        outerPts.forEach((pt, i) => {
            const sx = planetPos.x + pt.x;
            const sy = planetPos.y + pt.y;
            if (i === 0) ctx.moveTo(sx, sy);
            else ctx.lineTo(sx, sy);
        });
        ctx.closePath();
        for (let i = segments; i >= 0; i--) {
            const pt = innerPts[i];
            const sx = planetPos.x + pt.x;
            const sy = planetPos.y + pt.y;
            ctx.lineTo(sx, sy);
        }
        ctx.closePath();
        ctx.fillStyle = ringData.color;
        ctx.globalAlpha = (ringData.opacity || 0.6) * planetPos.opacity * 0.8;
        ctx.fill("evenodd");
        ctx.setLineDash([]);
    };

    if (settings.showRegionLabels && beltOpacity > 0.01) {
         drawCosmicRing(KUIPER_BELT_AU, '柯伊伯带', '#aaa', [5/k, 5/k], 1.5 / k);
         drawCosmicRing(HELIOPAUSE_AU, '日球层顶', '#666', [15/k, 10/k], 2 / k);
    }

    if (settings.orbitOpacity > 0) {
        visiblePlanets.forEach(planet => {
          const posInfo = planetPositions[planet.id];
          if (!posInfo || !posInfo.isVisible) return;
          if (planet.satellites?.some(s => s.isRing)) drawSchematicRing(planet, posInfo);

          const steps = 90;
          let points: any[] = [];

          if (planet.elements.e > ECCENTRICITY_THRESHOLD) {
            const rawPoints = calculateOrbitPath(planet.elements, steps);
            points = rawPoints.map(pos3d => {
               const proj = project3D(pos3d, AU_SCALE_SCHEMATIC, settings, k, planet.id, centerOfRotation);
               return { x: proj.x, y: proj.y, isVisible: proj.isVisible, scaleFactor: proj.scaleFactor, opacity: proj.opacity };
            });
          } else {
            const periodDays = 365.25 * Math.pow(planet.elements.a, 1.5);
            const stepDays = periodDays / steps;
            const baseTime = settings.useHighPrecision ? currentDate.getTime() : new Date('2000-01-01').getTime();
            for (let i = 0; i <= steps; i++) {
              const t = new Date(baseTime + i * stepDays * 24 * 3600 * 1000);
              const pos3d = calculateBodyPosition(planet.id, planet.elements, t, settings.useHighPrecision);
              const proj = project3D(pos3d, AU_SCALE_SCHEMATIC, settings, k, planet.id, centerOfRotation);
              points.push({ x: proj.x, y: proj.y, isVisible: proj.isVisible, scaleFactor: proj.scaleFactor, opacity: proj.opacity });
            }
          }
          
          const isSelected = selectedPlanetId === planet.id;
          const pinnedState = pinnedPlanets.find(p => p.id === planet.id);
          const isPinned = !!pinnedState;
          const pinColor = pinnedState ? pinnedState.color : '#ffffff';
          const baseColor = isSelected ? '#ffffff' : (isPinned ? pinColor : '#333333');
          const opacityMultiplier = (isSelected || isPinned) ? Math.max(0.8, settings.orbitOpacity) : settings.orbitOpacity;
          const renderQualityOpacity = calculateBodyOpacity(planet, k, settings.renderSettings, false);

          if (!settings.enablePerspective) {
             ctx.beginPath();
             let hasStarted = false;
             const globalOpacity = posInfo ? posInfo.opacity : 1.0;
             if (globalOpacity > 0.05 || (settings.renderSettings.innerQuality === 'eco' && globalOpacity > 0)) {
                 for (let i = 0; i < points.length; i++) {
                     if (!points[i].isVisible) continue;
                     if (!hasStarted) { ctx.moveTo(points[i].x, points[i].y); hasStarted = true; } 
                     else { ctx.lineTo(points[i].x, points[i].y); }
                 }
                 if (hasStarted && planet.elements.e > ECCENTRICITY_THRESHOLD && points.length > 0 && points[0].isVisible) ctx.lineTo(points[0].x, points[0].y);
                 ctx.strokeStyle = baseColor;
                 ctx.lineWidth = 2.2 / k; 
                 ctx.lineCap = 'round';
                 ctx.globalAlpha = opacityMultiplier * globalOpacity;
                 ctx.setLineDash([]);
                 ctx.stroke();
             }
          } else {
             const isComet = planet.type === 'comet';
             let baseWidth;
             if (isComet) baseWidth = (isSelected || isPinned) ? 2.0 : 1.0; 
             else {
                 const initial = (isSelected || isPinned) ? 4.0 : (settings.orbitOpacity > 0.8 ? 3.0 : 2.0);
                 const intensity = settings.orbitPerspectiveIntensity;
                 const distMultiplier = (isSelected || isPinned) ? 1.0 : (0.4 * intensity); 
                 baseWidth = initial + planet.elements.a * distMultiplier;
             }
             for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i+1];
                const p1Op = p1.opacity * renderQualityOpacity;
                const p2Op = p2.opacity * renderQualityOpacity;
                if (!p1.isVisible || !p2.isVisible || p1Op < 0.05 || p2Op < 0.05) continue;
                const avgScale = (p1.scaleFactor + p2.scaleFactor) / 2;
                const avgOpacity = (p1Op + p2Op) / 2;
                const effectiveScale = Math.pow(avgScale, 1.5);
                let thickness = baseWidth * effectiveScale;
                thickness = Math.max(MIN_ORBIT_WIDTH, Math.min(MAX_ORBIT_WIDTH, thickness));
                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.strokeStyle = baseColor;
                ctx.lineWidth = thickness;
                ctx.lineCap = 'round';
                ctx.globalAlpha = opacityMultiplier * avgOpacity;
                ctx.setLineDash([]);
                ctx.stroke();
             }
          }
        });
    }
    ctx.restore();
  }, [planetPositions, visiblePlanets, zoomTransform, settings, selectedPlanetId, pinnedPlanets, dimensions, beltOpacity, centerOfRotation, k, currentDate, visibilityMap]);

  return (
    <>
      <canvas ref={orbitCanvasRef} className="absolute inset-0 z-0 w-full h-full" />
      <svg className="absolute inset-0 z-10 w-full h-full overflow-visible pointer-events-none">
          <g transform={zoomTransform.toString()}>
              {settings.showAsteroidBelt && asteroidOpacity > 0.01 && (
                  <g className="transition-opacity duration-300 pointer-events-none" style={{ opacity: asteroidOpacity, display: asteroidOpacity === 0 ? 'none' : 'block' }}>
                    {asteroids.map((asteroid, idx) => {
                      const currentAngle = asteroid.theta + (baseBeltAngle * asteroid.speedVar);
                      const r_au = asteroid.r;
                      const x_au = r_au * Math.cos(currentAngle);
                      const y_au = r_au * Math.sin(currentAngle);
                      const z_au = asteroid.z;
                      const proj = project3D({ x: x_au, y: y_au, z: z_au }, AU_SCALE_SCHEMATIC, settings, k, undefined, centerOfRotation); 
                      if (!proj.isVisible) return null;
                      return <circle key={idx} cx={proj.x} cy={proj.y} r={Math.max((1.0 * asteroid.sizeVar) / k * proj.scaleFactor, 0.5 / k)} fill="#888" />;
                    })}
                  </g>
              )}

              {visiblePlanets.map(planet => ({...planet, pos: planetPositions[planet.id]}))
                .concat([{id: 'sun', pos: planetPositions['sun']} as any])
                .filter(p => p.pos && p.pos.isVisible)
                .sort((a, b) => a.pos.depth - b.pos.depth)
                .map(item => {
                   if (item.id === 'sun') {
                     const sunPos = item.pos;
                     return (
                        <g key="sun" transform={`translate(${sunPos.x}, ${sunPos.y})`} style={{ opacity: sunPos.opacity }} className="pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); onPlanetSelect(SUN_DATA); }}>
                             <circle r={SUN_RADIUS_SCHEMATIC * sunPos.scaleFactor} fill="#FDB813" style={{ filter: 'drop-shadow(0 0 30px #FDB813)' }} />
                             <text y={SUN_RADIUS_SCHEMATIC * sunPos.scaleFactor + (15 / k)} textAnchor="middle" fill="#FDB813" fontSize={Math.max(12 / k, 4)} opacity="0.8">Sun</text>
                        </g>
                     );
                   }
                   const planet = item;
                   const pos = item.pos;
                   const isSelected = selectedPlanetId === planet.id;
                   const isHighlighted = highlightedAlignment?.includes(planet.id);
                   const pinnedState = pinnedPlanets.find(p => p.id === planet.id);
                   const isPinned = !!pinnedState;
                   const pinColor = pinnedState ? pinnedState.color : '#ffffff';
                   const finalOpacity = (isSelected || isHighlighted || isPinned ? 1 : 0.9) * pos.opacity;
                   return (
                      <g key={planet.id} transform={`translate(${pos.x}, ${pos.y})`} onClick={(e) => { e.stopPropagation(); onPlanetSelect(planet); }} className="cursor-pointer hover:opacity-100 transition-opacity duration-300 pointer-events-auto" style={{ opacity: finalOpacity }}>
                          {isSelected && <circle r={Math.max(planet.radius * pos.scaleFactor * 1.5, 10 / k)} fill="none" stroke="white" strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="animate-ping opacity-50" />}
                          {isHighlighted && settings.showEventHighlights && <circle r={Math.max(planet.radius * pos.scaleFactor * 1.8, 12 / k)} fill="none" stroke="#00ffcc" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
                          {isPinned && <circle r={Math.max(planet.radius * pos.scaleFactor * 1.8, 12 / k)} fill="none" stroke={pinColor} strokeWidth={2} vectorEffect="non-scaling-stroke" className="animate-pulse" />}
                          <circle r={10 / k} fill="transparent" />
                          <circle r={planet.radius * pos.scaleFactor} fill={planet.color} stroke={isSelected || (isHighlighted && settings.showEventHighlights) ? 'white' : (isPinned ? pinColor : 'none')} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
                          <text y={Math.max(planet.radius * pos.scaleFactor, 5 / k) + (12 / k)} textAnchor="middle" fill={isSelected || (isHighlighted && settings.showEventHighlights) ? 'white' : (isPinned ? pinColor : '#aaa')} fontSize={12 / k} fontWeight={isSelected || (isHighlighted && settings.showEventHighlights) || isPinned ? 'bold' : 'normal'} style={{ pointerEvents: 'none', textShadow: '0 2px 4px black' }}>{planet.name}</text>
                      </g>
                   );
              })}
          </g>
      </svg>
    </>
  );
};

export default SchematicSolarSystem;