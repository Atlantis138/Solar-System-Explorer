import React, { useMemo } from 'react';
import {
  AU_SCALE_TRUE, EARTH_RADIUS_TRUE_SCALE_BASE, SUN_RELATIVE_RADIUS,
  SUN_DATA
} from '../../data/constants';
import { calculatePlanetarySystem, calculateSystemLocalOrbits } from '../../utils/astronomy';
import { createSceneView } from '../../core/sceneView';
import { evaluateBodyVisibility, VISIBILITY_THRESHOLD } from '../../core/renderConfig';
import { PlanetData, Position, AppSettings, PinnedPlanet } from '../../types';
import { getOrbitCurve } from '../../core/orbitCache';
import { curveFromOrbitPoints } from '../../core/orbitGeometry';
import { bodyOrbitOpacity, orbitCategoryForBody } from '../../core/orbitCategories';
import { OrbitPath } from '../../core/orbitDrawing';
import { createOrbitProjector } from '../../core/projectedOrbitCache';
import { renderBudget } from '../../core/renderBudget';
import { OrbitLayer, BeltLayer } from './SceneLayers';
import { hasVisiblePopulations } from '../../core/asteroidBelt';
import BodyLabels from './BodyLabels';
import PlanetRing from './PlanetRing';

interface TrueScaleSolarSystemProps {
  currentDate: Date;
  settings: AppSettings;
  onPlanetSelect: (planet: PlanetData) => void;
  selectedPlanetId: string | null;
  cameraFocusId: string | null;
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

const ORIGIN = { x: 0, y: 0, z: 0 };
const TrueScaleSolarSystem: React.FC<TrueScaleSolarSystemProps> = ({
  currentDate, settings, onPlanetSelect, selectedPlanetId, cameraFocusId,
  highlightedAlignment, pinnedPlanets, zoomTransform, dimensions, centerOfRotation,
  planets, dwarfs, asteroidsComets, visibilityMap,
}) => {
  const projectOrbit = useMemo(createOrbitProjector, []);
  const k = zoomTransform.k;
  const scene = useMemo(() => createSceneView({ scale: AU_SCALE_TRUE, settings,
    zoom: zoomTransform, width: dimensions.w, height: dimensions.h, center: centerOfRotation }),
  [settings, zoomTransform, dimensions, centerOfRotation]);

  const visibleBodies = useMemo(() => [
    ...planets,
    ...(settings.showDwarfPlanets ? dwarfs : []),
    ...(settings.showAsteroidsComets ? asteroidsComets : []),
  ], [settings.showDwarfPlanets, settings.showAsteroidsComets, planets, dwarfs, asteroidsComets]);

  const systems = useMemo(() => new Map(visibleBodies.map(parent =>
    [parent.id, calculatePlanetarySystem(parent, currentDate, settings.useHighPrecision)])),
  [visibleBodies, currentDate, settings.useHighPrecision]);

  const prioritizedIds = useMemo(() => new Set([
    selectedPlanetId, cameraFocusId?.replace(/^barycenter:/, ''), ...pinnedPlanets.map(pin => pin.id),
  ].filter(Boolean)), [selectedPlanetId, cameraFocusId, pinnedPlanets]);

  // Project every member independently. An offscreen primary does not hide a
  // moon that is close to the observer or inside the current viewing volume.
  const sceneData = useMemo(() => {
    const projectBody = (body: PlanetData, rawPos: Position, type: 'star' | 'planet' | 'moon') => {
      const proj = scene.project(rawPos);
      const radiusAU = (body.id === 'sun' ? SUN_RELATIVE_RADIUS : body.relativeRadius || .1)
        * EARTH_RADIUS_TRUE_SCALE_BASE / AU_SCALE_TRUE;
      const priority = prioritizedIds.has(body.id);
      const lod = evaluateBodyVisibility(body, proj, scene, settings.renderSettings,
        { prioritized: priority, radiusAU });
      const separationOpacity = type === 'moon' && !priority
        ? scene.projectedSystemOpacity(rawPos, body.elements.a) : 1;
      const opacity = proj.opacity * lod.opacity * separationOpacity;
      return { id: body.id, data: body, type, rawPos, radiusAU,
        pos: { ...proj, opacity, labelOpacity: lod.labelOpacity,
          radiusPixels: lod.radiusPixels, isVisible: proj.isVisible && opacity > VISIBILITY_THRESHOLD } };
    };
    const items = [projectBody(SUN_DATA, ORIGIN, 'star')];
    for (const planet of visibleBodies) {
      if (visibilityMap[planet.id] === false) continue;
      const system = systems.get(planet.id)!;
      items.push(projectBody(planet, system.parentPosition, 'planet'));
      for (const moon of planet.satellites ?? []) {
        if (visibilityMap[moon.id] === false || moon.isRing || !moon.elements) continue;
        const position = system.satellitePositions.get(moon.id);
        if (position) items.push(projectBody(moon, position, 'moon'));
      }
    }
    return items;
  }, [scene, visibleBodies, systems, visibilityMap, prioritizedIds, settings.renderSettings]);

  const systemOpacity = (id: string) => {
    const system = systems.get(id)!;
    const radius = Math.max(0, ...(system.parent.satellites ?? [])
      .filter(moon => !moon.isRing && moon.elements)
      .map(moon => moon.elements.a * (1 + moon.elements.e)));
    return radius > 0 ? scene.projectedSystemOpacity(system.barycenter, radius) : 0;
  };

  const collectOrbit = (paths: OrbitPath[], body: PlanetData, center: Position,
    opacity: number, localPoints?: Position[]) => {
    opacity *= bodyOrbitOpacity(body,settings);
    if (!body.elements || opacity < .005) return;
    const pin = pinnedPlanets.find(item => item.id === body.id);
    const selected = selectedPlanetId === body.id;
    const emphasized = selected || !!pin;
    const points = projectOrbit(localPoints ? curveFromOrbitPoints(localPoints)
      : getOrbitCurve(body, currentDate, settings.useHighPrecision), scene,
      renderBudget(settings.renderSettings).orbitTolerance, center);
    paths.push({ points, color: pin?.color ?? (selected ? '#ffffff' : '#8995a7'),
      opacity, category:orbitCategoryForBody(body),
      emphasized, local: !!localPoints });
  };

  const paths: OrbitPath[] = [];
  if (settings.orbitOpacity > 0) {
    for (const planet of visibleBodies) {
      if (visibilityMap[planet.id] === false) continue;
      const localOpacity = systemOpacity(planet.id);
      // Track visibility belongs to its geometry, not to the current body's
      // screen position: nearby arcs remain possible with an offscreen body.
      collectOrbit(paths, planet, ORIGIN, 1 - localOpacity);
      if (localOpacity <= .005) continue;
      const system = systems.get(planet.id)!;
      const localPaths = calculateSystemLocalOrbits(system);
      for (const body of [planet, ...(planet.satellites ?? [])]) {
        if (visibilityMap[body.id] === false) continue;
        const points = localPaths.get(body.id);
        if (points) collectOrbit(paths, body, system.barycenter, localOpacity, points);
      }
    }
  }

  return <>
    <OrbitLayer paths={paths} scene={scene} settings={settings} zoom={zoomTransform} />
    {hasVisiblePopulations(settings) && <BeltLayer scene={scene} settings={settings} zoom={zoomTransform} center={centerOfRotation} date={currentDate} referenceBody={planets.find(p=>p.id==='jupiter')} />}
    <svg className="absolute inset-0 z-10 w-full h-full overflow-visible pointer-events-none">
      <g transform={zoomTransform.toString()}>
        {[...systems.values()].filter(system => system.usesBarycenter && visibilityMap[system.parent.id] !== false).map(system => {
          const opacity = systemOpacity(system.parent.id);
          if (opacity < .1) return null;
          const point = scene.project(system.barycenter);
          if (!scene.sphereVisible(point, 4)) return null;
          const offsetPx = scene.projectedRadius(Math.hypot(system.parentOffset.x,
            system.parentOffset.y, system.parentOffset.z), point);
          if (offsetPx < 3 && cameraFocusId !== `barycenter:${system.parent.id}`) return null;
          return <g key={`center:${system.parent.id}`} data-barycenter={system.parent.id}
            transform={`translate(${point.x}, ${point.y})`} opacity={opacity * .45}>
            <path d={`M ${-4/k} 0 H ${4/k} M 0 ${-4/k} V ${4/k}`}
              fill="none" stroke="#bac8dc" strokeWidth={1/k} />
          </g>;
        })}
        {sceneData.filter(item => item.pos.isVisible && !item.data.isRing)
          .sort((a, b) => a.pos.depth - b.pos.depth).map(item => {
            const isSun = item.type === 'star';
            const selected = selectedPlanetId === item.id;
            const highlighted = highlightedAlignment?.includes(item.id) && settings.showEventHighlights;
            const pin = pinnedPlanets.find(p => p.id === item.id);
            const visualRadius = Math.max(item.pos.radiusPixels, 1.5) / k;
            const rings = item.data.satellites?.filter(ring => ring.isRing && visibilityMap[ring.id] !== false) ?? [];
            const ringLayer = (side: 'front' | 'back') => rings.map(ring =>
              <PlanetRing key={ring.id} ring={ring} radiusScale={AU_SCALE_TRUE * item.pos.scaleFactor}
                viewTilt={settings.viewTilt} viewYaw={settings.viewYaw} side={side} />);
            return <g key={item.id} data-body={item.id}
              transform={`translate(${item.pos.x}, ${item.pos.y})`}
              onClick={e => { e.stopPropagation(); onPlanetSelect(item.data); }}
              className="cursor-pointer hover:opacity-100 pointer-events-auto" style={{ opacity: item.pos.opacity }}>
              {(selected || pin) && <circle r={visualRadius * 4} fill="none"
                stroke={pin?.color || 'white'} strokeWidth={1/k} className="animate-pulse" />}
              {highlighted && <circle r={visualRadius * 3} fill="none" stroke="#00ffcc" strokeWidth={2/k} />}
              <circle r={Math.max(visualRadius, 10/k)} fill="transparent" />
              {ringLayer('back')}
              <circle data-disc={item.id} r={visualRadius} fill={isSun ? '#FDB813' : item.data.color} />
              {ringLayer('front')}

            </g>;
          })}
      </g>
      <BodyLabels width={dimensions.w} height={dimensions.h} onSelect={id=>{const item=sceneData.find(i=>i.id===id);if(item) onPlanetSelect(item.data);}}
        labels={sceneData.filter(item=>item.pos.isVisible&&!item.data.isRing).map(item=>{
          const emphasized=prioritizedIds.has(item.id)||(settings.showEventHighlights&&!!highlightedAlignment?.includes(item.id));
          return {id:item.id,text:item.id==='sun'?'Sun':item.data.name,x:item.pos.screenX!,y:item.pos.screenY!,radius:Math.max(1.5,item.pos.radiusPixels),
            opacity:item.pos.opacity*item.pos.labelOpacity,color:emphasized?'white':item.id==='sun'?'#FDB813':'#aaa',emphasized,
            priority:emphasized?100:item.id==='sun'?90:item.type==='moon'?60:item.data.type==='planet'?80:40};
        })}/>
    </svg>
  </>;
};

export default TrueScaleSolarSystem;
