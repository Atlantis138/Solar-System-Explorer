import React, { useMemo } from 'react';
import {
  AU_SCALE_SCHEMATIC, AU_SCALE_TRUE,
  SUN_RADIUS_SCHEMATIC, SUN_DATA,
} from '../../data/constants';
import { calculatePlanetarySystem } from '../../utils/astronomy';
import { createSceneView } from '../../core/sceneView';
import { evaluateBodyVisibility, VISIBILITY_THRESHOLD } from '../../core/renderConfig';
import { PlanetData, AppSettings, PinnedPlanet, Position } from '../../types';
import { smallBodyVisible, cometTailVisible } from '../../core/smallBodySettings';
import { CometTailLayer } from './SceneLayers';
import { getOrbitCurve } from '../../core/orbitCache';
import { bodyOrbitOpacity, orbitCategoryForBody } from '../../core/orbitCategories';
import { OrbitPath } from '../../core/orbitDrawing';
import { createOrbitProjector } from '../../core/projectedOrbitCache';
import { renderBudget } from '../../core/renderBudget';
import { OrbitLayer, BeltLayer } from './SceneLayers';
import { hasVisiblePopulations } from '../../core/asteroidBelt';
import BodyLabels from './BodyLabels';
import PlanetRing from './PlanetRing';

interface SchematicSolarSystemProps {
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
  cameraEye?: Position | null;
  planets: PlanetData[];
  dwarfs: PlanetData[];
  asteroidsComets: PlanetData[];
  visibilityMap: Record<string, boolean>;
}

const ORIGIN = { x: 0, y: 0, z: 0 };

const SchematicSolarSystem: React.FC<SchematicSolarSystemProps> = ({
  currentDate, settings, onPlanetSelect, selectedPlanetId, cameraFocusId,
  highlightedAlignment, pinnedPlanets, zoomTransform, dimensions, centerOfRotation, cameraEye,
  planets, dwarfs, asteroidsComets, visibilityMap,
}) => {
  const projectOrbit = useMemo(createOrbitProjector, []);
  const k = zoomTransform.k;
  const scene = useMemo(() => createSceneView({ scale: AU_SCALE_SCHEMATIC, settings,
    zoom: zoomTransform, width: dimensions.w, height: dimensions.h, center: centerOfRotation, observer: cameraEye }),
  [settings, zoomTransform, dimensions, centerOfRotation, cameraEye]);

  const visiblePlanets = useMemo(() => [
    ...planets,
    ...(settings.showDwarfPlanets ? dwarfs : []),
    ...asteroidsComets.filter(body => smallBodyVisible(body,settings)),
  ], [settings.showDwarfPlanets, settings.showAsteroidsComets, settings.showComets, settings.showAsteroids, settings.showInterstellar, planets, dwarfs, asteroidsComets]);

  const planetPositions = useMemo(() => {
    const positions: Record<string, ReturnType<typeof scene.project> & {
      labelOpacity: number; radiusPixels: number;
    }> = {};
    for (const body of [SUN_DATA, ...visiblePlanets]) {
      if (visibilityMap[body.id] === false) continue;
      const raw = body.id === 'sun' ? ORIGIN
        : calculatePlanetarySystem(body, currentDate, settings.useHighPrecision).parentPosition;
      const projected = scene.project(raw);
      const prioritized = body.id === selectedPlanetId || body.id === cameraFocusId
        || cameraFocusId === `barycenter:${body.id}` || pinnedPlanets.some(pin => pin.id === body.id);
      const radius = body.id === 'sun' ? SUN_RADIUS_SCHEMATIC : body.radius;
      const lod = evaluateBodyVisibility(body, projected, scene, settings.renderSettings,
        { prioritized, radiusPixels: radius * k * projected.scaleFactor });
      const opacity = projected.opacity * lod.opacity;
      positions[body.id] = { ...projected, ...lod, opacity,
        isVisible: projected.isVisible && opacity > VISIBILITY_THRESHOLD };
    }
    return positions;
  }, [currentDate, visiblePlanets, settings, scene, visibilityMap, selectedPlanetId,
    cameraFocusId, pinnedPlanets, k]);

  const paths: OrbitPath[] = [];
  if (settings.orbitOpacity > 0) {
    for (const body of visiblePlanets) {
      if (visibilityMap[body.id] === false) continue;
      const opacity = bodyOrbitOpacity(body,settings);
      if (opacity <= 0) continue;
      const selected = selectedPlanetId === body.id;
      const pin = pinnedPlanets.find(item => item.id === body.id);
      const emphasized = selected || !!pin;
      paths.push({ points: projectOrbit(getOrbitCurve(body, currentDate, settings.useHighPrecision), scene, renderBudget(settings.renderSettings).orbitTolerance),
        emphasized, color: selected ? '#ffffff' : pin?.color ?? '#8995a7',
        opacity, category:orbitCategoryForBody(body) });
    }
  }

  return <>
    <OrbitLayer paths={paths} scene={scene} settings={settings} zoom={zoomTransform} />
    {hasVisiblePopulations(settings) && <BeltLayer scene={scene} settings={settings} zoom={zoomTransform} center={centerOfRotation} date={currentDate} referenceBody={planets.find(p=>p.id==='jupiter')} />}
    {visiblePlanets.some(body => cometTailVisible(body,settings) && visibilityMap[body.id] !== false) && <CometTailLayer bodies={visiblePlanets} visibilityMap={visibilityMap} scene={scene} settings={settings} date={currentDate} />}
    <svg className="absolute inset-0 z-10 w-full h-full overflow-visible pointer-events-none">
      <g transform={zoomTransform.toString()}>
        {[SUN_DATA, ...visiblePlanets].map(body => ({ body, pos: planetPositions[body.id] }))
          .filter(item => item.pos?.isVisible).sort((a, b) => a.pos.depth - b.pos.depth).map(({ body, pos }) => {
            const isSun = body.id === 'sun';
            const selected = selectedPlanetId === body.id;
            const highlighted = highlightedAlignment?.includes(body.id) && settings.showEventHighlights;
            const pin = pinnedPlanets.find(item => item.id === body.id);
            const color = isSun ? '#FDB813' : body.color;
            const radius = pos.radiusPixels / k;
            const rings = body.satellites?.filter(ring => ring.isRing && visibilityMap[ring.id] !== false) ?? [];
            const ringScale = body.radius * pos.scaleFactor * AU_SCALE_TRUE / Math.max(body.relativeRadius, .001);
            const ringLayer = (side: 'front' | 'back') => rings.map(ring =>
              <PlanetRing key={ring.id} ring={ring} radiusScale={ringScale}
                viewTilt={settings.viewTilt} viewYaw={settings.viewYaw} viewRoll={settings.viewRoll} side={side} />);
            return <g key={body.id} data-body={body.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              onClick={e => { e.stopPropagation(); onPlanetSelect(body); }}
              className="cursor-pointer hover:opacity-100 pointer-events-auto"
              style={{ opacity: (selected || highlighted || pin ? 1 : .9) * pos.opacity }}>
              {selected && <circle r={Math.max(radius * 1.5, 10/k)} fill="none" stroke="white"
                strokeWidth={1.5} vectorEffect="non-scaling-stroke" className="animate-ping opacity-50" />}
              {highlighted && <circle r={Math.max(radius * 1.8, 12/k)} fill="none" stroke="#00ffcc"
                strokeWidth={2} vectorEffect="non-scaling-stroke" />}
              {pin && <circle r={Math.max(radius * 1.8, 12/k)} fill="none" stroke={pin.color}
                strokeWidth={2} vectorEffect="non-scaling-stroke" className="animate-pulse" />}
              <circle r={Math.max(radius, 10/k)} fill="transparent" />
              {ringLayer('back')}
              <circle data-disc={body.id} r={radius} fill={color}
                stroke={selected || highlighted ? 'white' : pin?.color ?? 'none'}
                strokeWidth={1.5} vectorEffect="non-scaling-stroke"
                style={isSun ? { filter: 'drop-shadow(0 0 30px #FDB813)' } : undefined} />
              {ringLayer('front')}

            </g>;
          })}
      </g>
      <BodyLabels width={dimensions.w} height={dimensions.h} onSelect={id=>{const body=[SUN_DATA,...visiblePlanets].find(b=>b.id===id);if(body) onPlanetSelect(body);}}
        labels={[SUN_DATA,...visiblePlanets].flatMap(body=>{
          const pos=planetPositions[body.id];if(!pos?.isVisible) return [];
          const pin=pinnedPlanets.find(p=>p.id===body.id);
          const emphasized=body.id===selectedPlanetId||body.id===cameraFocusId||!!pin||(settings.showEventHighlights&&!!highlightedAlignment?.includes(body.id));
          return [{id:body.id,text:body.id==='sun'?'Sun':body.name,x:pos.screenX!,y:pos.screenY!,radius:pos.radiusPixels,
            opacity:pos.opacity*pos.labelOpacity,color:emphasized?'white':body.id==='sun'?'#FDB813':'#aaa',emphasized,
            priority:emphasized?100:body.id==='sun'?90:body.type==='planet'?80:40}];
        })}/>
    </svg>
  </>;
};

export default SchematicSolarSystem;
