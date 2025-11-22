import React, { useEffect, useRef, useMemo, useState } from 'react';
import { 
  AU_SCALE_TRUE, 
  EARTH_RADIUS_TRUE_SCALE_BASE, 
  SUN_RELATIVE_RADIUS,
  SUN_DATA,
  KUIPER_BELT_AU,
  HELIOPAUSE_AU
} from '../../data/constants';
import { calculateBodyPosition, calculateSatellitePosition, calculateOrbitPath } from '../../utils/astronomy';
import { project3D, smoothStep } from '../../core/projection';
import { calculateBodyOpacity, shouldRenderComet } from '../../core/renderConfig';
import { PlanetData, Position, AppSettings, PinnedPlanet } from '../../types';

interface TrueScaleSolarSystemProps {
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

const ASTEROID_COUNT = 2000;
const ASTEROID_BELT_INNER_AU = 2.2;
const ASTEROID_BELT_OUTER_AU = 3.2;

const TrueScaleSolarSystem: React.FC<TrueScaleSolarSystemProps> = ({
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
  const [sceneData, setSceneData] = useState<Array<{
    id: string, 
    data: PlanetData | 'sun',
    pos: any, 
    rawPos: Position,
    type: 'star' | 'planet' | 'moon',
    parentId?: string
  }>>([]);
  
  const sceneDataRef = useRef(sceneData);
  const k = zoomTransform.k;

  const visibleBodies = useMemo(() => {
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
    if (!settings.showAsteroidBelt) return [];
    for(let i = 0; i < ASTEROID_COUNT; i++) {
      const r = ASTEROID_BELT_INNER_AU + Math.random() * (ASTEROID_BELT_OUTER_AU - ASTEROID_BELT_INNER_AU);
      const theta = Math.random() * 2 * Math.PI; 
      const z = (Math.random() - 0.5) * 0.1; 
      arr.push({ r, theta, z });
    }
    return arr;
  }, [settings.showAsteroidBelt]);

  const beltOpacity = useMemo(() => {
     if (!settings.showRegionLabels) return 0; 
     // In True Scale, k is much smaller. 
     // k=1 in Schematic is like k=0.0027 in TrueScale.
     // Schematic belt fades out at k < 0.15.
     // Equivalent TrueScale k: 0.15 * 0.0027 = 0.0004
     if (k < 0.0002) return 0.5; 
     if (k > 0.001) return 0; 
     return 0.5 * (1 - smoothStep(0.0002, 0.001, k));
  }, [k, settings]);

  useEffect(() => {
    const flatList: any[] = [];
    const sunProj = project3D({ x: 0, y: 0, z: 0 }, AU_SCALE_TRUE, settings, k, 'sun', centerOfRotation);
    flatList.push({ id: 'sun', data: 'sun', pos: { ...sunProj, z: sunProj.depth }, rawPos: { x: 0, y: 0, z: 0 }, type: 'star' });

    visibleBodies.forEach(planet => {
      // Already filtered by App.tsx for visibilityMap, but double check just in case
      if (visibilityMap[planet.id] === false) return;

      const rawPos = calculateBodyPosition(planet.id, planet.elements, currentDate, settings.useHighPrecision);
      if ((planet.type === 'comet' || planet.type === 'asteroid')) {
          const dist = Math.sqrt(rawPos.x**2 + rawPos.y**2 + rawPos.z**2);
          if (!shouldRenderComet(dist, settings.renderSettings)) return;
      }
      const proj = project3D(rawPos, AU_SCALE_TRUE, settings, k, planet.id, centerOfRotation);
      const renderOpacity = calculateBodyOpacity(planet.id, planet.elements.a, k, settings.renderSettings, true);
      const finalOpacity = proj.opacity * renderOpacity;

      flatList.push({ id: planet.id, data: planet, pos: { ...proj, z: proj.depth, opacity: finalOpacity, isVisible: proj.isVisible && finalOpacity > 0.05 }, rawPos: rawPos, type: 'planet' });

      if (planet.satellites && planet.satellites.length > 0) {
          const massMult = planet.massRelativeToSun ? Math.sqrt(planet.massRelativeToSun) : 0;
          planet.satellites.forEach(moon => {
              // CHECK VISIBILITY FOR MOONS HERE
              if (visibilityMap[moon.id] === false) return;

              if (moon.isRing || !moon.elements) return;

              const moonAbsPos = calculateSatellitePosition(moon.elements, rawPos, currentDate, massMult, moon.id, settings.useHighPrecision);
              const moonProj = project3D(moonAbsPos, AU_SCALE_TRUE, settings, k, moon.id, centerOfRotation);
              flatList.push({ id: moon.id, data: moon, pos: { ...moonProj, z: moonProj.depth }, rawPos: moonAbsPos, type: 'moon', parentId: planet.id });
          });
      }
    });

    setSceneData(flatList);
    sceneDataRef.current = flatList;
  }, [currentDate, visibleBodies, settings, k, centerOfRotation, visibilityMap]);

  const getSystemVisibilityThreshold = (planet: PlanetData): number => {
      if (!planet.satellites || planet.satellites.length === 0) return 10000; 
      const validSats = planet.satellites.filter(s => !s.isRing && s.elements);
      if (validSats.length === 0) return 10000;
      const maxA = Math.max(...validSats.map(s => s.elements.a));
      const pixelTarget = 60; 
      const effectiveMaxA = maxA > 0 ? maxA : 0.001; 
      return pixelTarget / (effectiveMaxA * AU_SCALE_TRUE);
  };

  const calculateOpacities = (currentK: number, thresholdK: number) => {
      const moonStart = thresholdK;
      const moonEnd = thresholdK * 1.2; 
      let moonOpacity = 0;
      if (currentK >= moonEnd) moonOpacity = 1;
      else if (currentK > moonStart) moonOpacity = (currentK - moonStart) / (moonEnd - moonStart);
      const orbitStart = thresholdK * 1.1;
      const orbitEnd = thresholdK * 1.4;
      let orbitOpacity = 1;
      if (currentK >= orbitEnd) orbitOpacity = 0;
      else if (currentK > orbitStart) orbitOpacity = 1 - ((currentK - orbitStart) / (orbitEnd - orbitStart));
      return { moonOpacity, orbitOpacity };
  };

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

    // --- Draw Frontiers (Kuiper Belt / Heliopause) ---
    const drawCosmicRing = (radiusAU: number, label: string, color: string, dashArray: number[]) => {
        const segments = 180;
        const points: any[] = [];
        for (let i = 0; i <= segments; i++) {
            const theta = (i / segments) * 2 * Math.PI;
            const pos = { x: radiusAU * Math.cos(theta), y: radiusAU * Math.sin(theta), z: 0 };
            points.push(project3D(pos, AU_SCALE_TRUE, settings, k, 'sun', centerOfRotation));
        }
        ctx.beginPath();
        
        // True Scale Logic: Divide dimension by k to get constant screen thickness
        const scaledDash = dashArray.map(d => d / k); 
        ctx.setLineDash(scaledDash);
        ctx.lineWidth = 2 / k; // Constant 2px width on screen
        
        ctx.strokeStyle = color;
        let started = false;
        points.forEach(p => {
            if (p.isVisible) {
                if (!started) { ctx.moveTo(p.x, p.y); started = true; }
                else { ctx.lineTo(p.x, p.y); }
            } else { started = false; }
        });
        if (started && points[0].isVisible) ctx.closePath();
        ctx.globalAlpha = beltOpacity;
        ctx.stroke();
        ctx.setLineDash([]); 

        // Text rendering
        if (settings.showRegionLabels) {
            const chars = label.split('');
            const labelCenterAngle = Math.PI / 4; 
            // Adjust spread based on k to prevent overlapping at huge distances, 
            // though constant screen spacing is ideal. 
            // In True Scale, world space angle needs to remain constant to not distort.
            const charSpread = 0.20; 
            const startAngle = labelCenterAngle - ((chars.length - 1) * charSpread) / 2;
            const textRadius = radiusAU * 1.08;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = color;
            
            // Calculate appropriate font size
            // We want ~20px on screen.
            // Font size in World Space = 20 / k.
            const targetPx = 24;
            const worldFontSize = targetPx / k;

            ctx.font = `bold ${worldFontSize}px "Segoe UI", sans-serif`;
            
            chars.forEach((char, i) => {
                const theta = startAngle + i * charSpread;
                const pos = { x: textRadius * Math.cos(theta), y: textRadius * Math.sin(theta), z: 0 };
                const proj = project3D(pos, AU_SCALE_TRUE, settings, k, 'sun', centerOfRotation);
                
                if (proj.isVisible && proj.opacity > 0.1) {
                     ctx.globalAlpha = beltOpacity * 0.8 * proj.opacity; 
                     ctx.fillText(char, proj.x, proj.y);
                }
            });
        }
    };

    if (settings.showRegionLabels && beltOpacity > 0.01) {
         // Same dashes as Schematic but adjusted for True Scale logic inside function
         drawCosmicRing(KUIPER_BELT_AU, '柯伊伯带', '#aaa', [5, 5]);
         drawCosmicRing(HELIOPAUSE_AU, '日球层顶', '#666', [15, 10]);
    }

    if (settings.orbitOpacity > 0) {
        visibleBodies.forEach(planet => {
            // Already checked visibilityMap above
            if ((planet.type === 'comet' || planet.type === 'asteroid')) {
                 const item = sceneDataRef.current.find(i => i.id === planet.id);
                 if (!item || !item.pos.isVisible) return;
            }
            const renderOpacity = calculateBodyOpacity(planet.id, planet.elements.a, k, settings.renderSettings, true);
            if (renderOpacity < 0.05) return;
            const hasSatellites = planet.satellites && planet.satellites.length > 0;
            if (!hasSatellites) {
                drawOrbit(ctx, planet, { x: 0, y: 0, z: 0 }, planet.id === selectedPlanetId, pinnedPlanets, 1.0 * renderOpacity);
            } else {
                const thresholdK = getSystemVisibilityThreshold(planet);
                const { moonOpacity, orbitOpacity } = calculateOpacities(k, thresholdK);
                if (orbitOpacity > 0.01) drawOrbit(ctx, planet, { x: 0, y: 0, z: 0 }, planet.id === selectedPlanetId, pinnedPlanets, orbitOpacity * renderOpacity);
                if (moonOpacity > 0.01) {
                    const parentItem = sceneDataRef.current.find(i => i.id === planet.id);
                    const parentRawPos = parentItem ? parentItem.rawPos : null;
                    if (parentRawPos) {
                        planet.satellites.forEach(moon => {
                            // CHECK VISIBILITY FOR MOONS HERE
                            if (visibilityMap[moon.id] === false) return;

                            if (moon.isRing) {
                                drawRing(ctx, moon, parentRawPos, moonOpacity);
                            } else {
                                if (moon.elements) {
                                    drawOrbit(ctx, moon, parentRawPos, moon.id === selectedPlanetId, pinnedPlanets, moonOpacity);
                                }
                            }
                        });
                    }
                }
            }
        });
    }
    ctx.restore();
  }, [visibleBodies, zoomTransform, dimensions, settings, selectedPlanetId, pinnedPlanets, k, centerOfRotation, beltOpacity, visibilityMap]);

  const drawOrbit = (ctx: CanvasRenderingContext2D, body: PlanetData, centerPos: Position, isSelected: boolean, pinnedList: PinnedPlanet[], lodOpacity: number) => {
      if (!body.elements) return;

      const pinnedState = pinnedList.find(p => p.id === body.id);
      const isPinned = !!pinnedState;
      const color = isPinned ? pinnedState.color : (isSelected ? '#ffffff' : '#555');
      const opacityMultiplier = (isSelected || isPinned) ? Math.max(0.9, settings.orbitOpacity) : settings.orbitOpacity;
      const finalOpacity = opacityMultiplier * lodOpacity;
      if (finalOpacity < 0.05) return;
      
      const points = calculateOrbitPath(body.elements, 180);
      
      ctx.beginPath();
      let started = false;
      points.forEach((pt) => {
          const absPos = { x: centerPos.x + pt.x, y: centerPos.y + pt.y, z: centerPos.z + pt.z };
          const proj = project3D(absPos, AU_SCALE_TRUE, settings, k, body.id, centerOfRotation);
          if (proj.isVisible) {
              if (!started) { ctx.moveTo(proj.x, proj.y); started = true; } else { ctx.lineTo(proj.x, proj.y); }
          }
      });
      if (started && points.length > 0) {
           const absStart = { x: centerPos.x + points[0].x, y: centerPos.y + points[0].y, z: centerPos.z + points[0].z };
           const startProj = project3D(absStart, AU_SCALE_TRUE, settings, k, body.id, centerOfRotation);
           if (startProj.isVisible) ctx.lineTo(startProj.x, startProj.y);
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 4.0 / k; 
      ctx.globalAlpha = finalOpacity;
      ctx.stroke();
  };

  const drawRing = (ctx: CanvasRenderingContext2D, ringData: PlanetData, centerPos: Position, lodOpacity: number) => {
      if (!ringData.innerRadius || !ringData.outerRadius) return;
      const segments = 90;
      const innerPts: Position[] = [];
      const outerPts: Position[] = [];
      const tiltRad = (ringData.tilt || 0) * Math.PI / 180;
      const cosT = Math.cos(tiltRad);
      const sinT = Math.sin(tiltRad);
      for(let i=0; i<=segments; i++) {
          const theta = (i / segments) * Math.PI * 2;
          const cosTheta = Math.cos(theta);
          const sinTheta = Math.sin(theta);
          const xi = ringData.innerRadius * cosTheta;
          const yi = ringData.innerRadius * sinTheta;
          innerPts.push({ x: xi, y: yi * cosT, z: yi * sinT });
          const xo = ringData.outerRadius * cosTheta;
          const yo = ringData.outerRadius * sinTheta;
          outerPts.push({ x: xo, y: yo * cosT, z: yo * sinT });
      }
      ctx.beginPath();
      let first = true;
      outerPts.forEach((pt) => {
         const abs = { x: centerPos.x + pt.x, y: centerPos.y + pt.y, z: centerPos.z + pt.z };
         const proj = project3D(abs, AU_SCALE_TRUE, settings, k, ringData.id, centerOfRotation);
         if (first) { ctx.moveTo(proj.x, proj.y); first = false; }
         else ctx.lineTo(proj.x, proj.y);
      });
      ctx.closePath();
      for(let i=segments; i>=0; i--) {
         const pt = innerPts[i];
         const abs = { x: centerPos.x + pt.x, y: centerPos.y + pt.y, z: centerPos.z + pt.z };
         const proj = project3D(abs, AU_SCALE_TRUE, settings, k, ringData.id, centerOfRotation);
         ctx.lineTo(proj.x, proj.y);
      }
      ctx.closePath();
      ctx.fillStyle = ringData.color;
      ctx.globalAlpha = (ringData.opacity || 0.5) * lodOpacity;
      ctx.fill("evenodd");
  };

  const getRadius = (item: any) => {
      if (item.type === 'star') return SUN_RELATIVE_RADIUS * EARTH_RADIUS_TRUE_SCALE_BASE;
      const relativeR = (item.data as PlanetData).relativeRadius || 0.1;
      return Math.max(relativeR * EARTH_RADIUS_TRUE_SCALE_BASE, 0.1 / k);
  };

  return (
    <>
      <canvas ref={orbitCanvasRef} className="absolute inset-0 z-0 w-full h-full" />
      <svg className="absolute inset-0 z-10 w-full h-full overflow-visible pointer-events-none">
          <g transform={zoomTransform.toString()}>
              {settings.showAsteroidBelt && k < 10 && (
                  <g className="pointer-events-none opacity-60">
                      {asteroids.map((ast, idx) => {
                          const r_au = ast.r;
                          const angle = ast.theta; 
                          const x_au = r_au * Math.cos(angle);
                          const y_au = r_au * Math.sin(angle);
                          const z_au = ast.z;
                          const proj = project3D({ x: x_au, y: y_au, z: z_au }, AU_SCALE_TRUE, settings, k, undefined, centerOfRotation);
                          if (!proj.isVisible) return null;
                          return <circle key={idx} cx={proj.x} cy={proj.y} r={0.5 / k} fill="#555" />;
                      })}
                  </g>
              )}

              {sceneData.filter(item => item.pos.isVisible && (item.data === 'sun' || !(item.data as PlanetData).isRing))
                .sort((a, b) => a.pos.depth - b.pos.depth)
                .map(item => {
                   const isSun = item.type === 'star';
                   const isMoon = item.type === 'moon';
                   let opacity = item.pos.opacity; 
                   if (isMoon && item.parentId) {
                       const parent = visibleBodies.find(p => p.id === item.parentId);
                       if (parent) {
                           const thresholdK = getSystemVisibilityThreshold(parent);
                           const { moonOpacity } = calculateOpacities(k, thresholdK);
                           opacity *= moonOpacity;
                       }
                   }
                   if (opacity < 0.05) return null;
                   const radius = getRadius(item);
                   const isSelected = selectedPlanetId === item.id;
                   const isHighlighted = highlightedAlignment?.includes(item.id);
                   const pinnedState = pinnedPlanets.find(p => p.id === item.id);
                   const isPinned = !!pinnedState;
                   const color = isSun ? '#FDB813' : (item.data as PlanetData).color;
                   const name = isSun ? 'Sun' : (item.data as PlanetData).name;
                   const visualRadius = Math.max(radius * item.pos.scaleFactor, 1.5 / k);

                   return (
                       <g key={item.id} transform={`translate(${item.pos.x}, ${item.pos.y})`} onClick={(e) => { e.stopPropagation(); if (isSun) onPlanetSelect(SUN_DATA); else onPlanetSelect(item.data as PlanetData); }} className="cursor-pointer hover:opacity-100 pointer-events-auto" style={{ opacity }}>
                           {(isSelected || isPinned) && <circle r={visualRadius * 4} fill="none" stroke={pinnedState?.color || "white"} strokeWidth={1 / k} className="animate-pulse" />}
                           {isHighlighted && settings.showEventHighlights && <circle r={visualRadius * 3} fill="none" stroke="#00ffcc" strokeWidth={2 / k} />}
                           <circle r={visualRadius} fill={color} />
                           <text y={visualRadius + (12/k)} textAnchor="middle" fill={isSelected || (isHighlighted && settings.showEventHighlights) || isPinned ? 'white' : '#aaa'} fontSize={12 / k} fontWeight={isSelected || (isHighlighted && settings.showEventHighlights) || isPinned ? 'bold' : 'normal'} style={{ textShadow: '0 0 2px black' }}>{name}</text>
                       </g>
                   );
                })
              }
          </g>
      </svg>
    </>
  );
};

export default TrueScaleSolarSystem;