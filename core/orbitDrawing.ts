import type { OrbitCategory } from '../types';
import { categoryOrbitWidth } from './orbitCategories';
import type { ProjectedPoint } from './projection';
import type { SceneView } from './sceneView';

export interface OrbitPath {
  points: ProjectedPoint[];
  color: string;
  opacity: number;
  emphasized: boolean;
  category?: OrbitCategory;
  local?: boolean; // Satellite orbits use a planetary-system distance reference.
}
interface OrbitView {
  zoom: number; perspective: boolean; tilt: number; intensity: number;
  trueScale?: boolean; scale?: number; scene?: SceneView; styleStep?: number;
}

const smooth = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };

const TRACK_PROFILES = {
  schematic: { base: 1.8, min: 0.95, max: 3.3, referenceAU: 40 },
  trueScale: { base: 1.7, min: 0.95, max: 3.1, referenceAU: 40 },
  satellite: { base: 1.55, min: 0.9, max: 2.8, referenceAU: 0.015 },
};

/** Thickness follows observer distance, not orbital radius. A mild front/back
 * cue complements that distance signal; screen-pixel limits preserve legibility. */
export function orbitSegmentStyle(depth: number, view: OrbitView, emphasized = false,
  distanceAU?: number, local = false, contextDistanceAU?: number) {
  const profile = local ? TRACK_PROFILES.satellite : view.trueScale ? TRACK_PROFILES.trueScale : TRACK_PROFILES.schematic;
  const strength = view.perspective
    ? Math.min(1.5, Math.max(0, view.intensity)) * Math.abs(Math.cos(view.tilt * Math.PI / 180)) : 0;
  const cue = Math.max(-1, Math.min(1, depth * strength));
  // Equivalent zoom makes smart mode-switching independent of the 65/23500 unit scales.
  const equivalentZoom = view.zoom * (view.scale ?? 65) / 65;
  const rawGain = view.perspective && distanceAU !== undefined
    ? Math.pow(profile.referenceAU / Math.max(1e-12, distanceAU), 0.18)
    : Math.pow(Math.max(1e-6, equivalentZoom) / 0.8, 0.14);
  // Distance remains perceptible without turning nearby or outer orbits into bands.
  const distanceGain = Math.max(0.85, Math.min(1.45, rawGain));
  const front = smooth((cue + 1) / 2);
  const width = profile.base * distanceGain * (0.65 + 0.55 * front) + (emphasized ? 0.4 : 0);
  const rangeAlpha = view.scene && distanceAU !== undefined ? view.scene.rangeOpacity(contextDistanceAU ?? distanceAU) : 1;
  return {
    width: Math.max(profile.min, Math.min(profile.max + (emphasized ? 0.4 : 0), width)),
    // Rear tracks retain ~1 CSS pixel of coverage, while their light fades to
    // roughly one third of the near side. The whole path remains continuous.
    alpha: Math.max(0.19, Math.min(0.9, 0.23 + 0.38 * front + (emphasized ? 0.2 : 0) +
      Math.max(-0.04, Math.min(0.04, Math.log2(distanceGain) * 0.06)))) * rangeAlpha,
  };
}

/** Sort all orbital segments far-to-near. Tracks stay thin even when flying
 * close; brightness and geometric foreshortening carry most of the depth cue. */
export function drawOrbitPaths(ctx: CanvasRenderingContext2D, paths: OrbitPath[], view: OrbitView) {
  // Orthographic tracks have uniform style: keep the inexpensive single-path draw.
  if (!view.perspective && !view.scene) {
    ctx.save();
    ctx.setLineDash([]);
    ctx.lineCap = 'round';
    for (const path of paths) {
      if (path.opacity <= 0) continue;
      const style = orbitSegmentStyle(0, view, path.emphasized, undefined, path.local);
      ctx.strokeStyle = path.color;
      ctx.lineWidth = style.width * categoryOrbitWidth(path.category,path.emphasized) / view.zoom;
      ctx.globalAlpha = Math.min(1,style.alpha * path.opacity);
      ctx.beginPath();
      let started = false;
      for (const p of path.points) {
        if (!p.isVisible || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { started = false; continue; }
        if (started) ctx.lineTo(p.x, p.y);
        else { ctx.moveTo(p.x, p.y); started = true; }
      }
      ctx.stroke();
    }
    ctx.restore();
    return;
  }
  const segments: { a: ProjectedPoint; b: ProjectedPoint; depth: number; color: string; width: number; alpha: number }[] = [];
  const hasEmphasis = paths.some(path => path.emphasized);
  for (const path of paths) {
    if (path.opacity <= 0) continue;
    const finite = path.points.filter(p => Number.isFinite(p.depth));
    if (!finite.length) continue;
    const min = Math.min(...finite.map(p => p.depth)), max = Math.max(...finite.map(p => p.depth));
    const center = (min + max) / 2, span = Math.max(1e-8, (max - min) / 2);
    for (let i = 1; i < path.points.length; i++) {
      let a = path.points[i - 1], b = path.points[i];
      if (view.scene) {
        if (!a.camera || !b.camera) continue;
        const clipped = view.scene.clipSegment(a.camera, b.camera);
        if (!clipped) continue;
        [a,b] = clipped;
      }
      if (!a.isVisible || !b.isVisible || ![a.x, a.y, b.x, b.y].every(Number.isFinite)) continue;
      const addSegment = (a: ProjectedPoint, b: ProjectedPoint) => {
      const depth = (a.depth + b.depth) / 2;
      const distance = a.distanceAU !== undefined && b.distanceAU !== undefined
        ? (a.distanceAU + b.distanceAU) / 2 : undefined;
      const relativeDepth = view.scene && a.camera && b.camera
        ? 1 - (a.camera.z+b.camera.z) / (2*view.scene.referenceDistanceAU) : (depth - center) / span;
      const contextDistance = a.contextDistanceAU !== undefined && b.contextDistanceAU !== undefined
        ? (a.contextDistanceAU + b.contextDistanceAU) / 2 : undefined;
      const style = orbitSegmentStyle(relativeDepth, view, path.emphasized, distance, path.local, contextDistance);
      const alpha = style.alpha * path.opacity * Math.min(a.opacity, b.opacity) *
        (hasEmphasis && !path.emphasized ? 0.38 : 1);
      if (alpha <= 0.005) return;
      segments.push({ a, b, depth, color: path.color, width: style.width * categoryOrbitWidth(path.category,path.emphasized), alpha });
      };
      // Geometry can be a long, accurate straight chord while its distance and
      // opacity vary strongly. Sample style separately in uniform screen steps.
      const length = Math.hypot(b.x-a.x,b.y-a.y) * view.zoom;
      const count = view.scene ? Math.max(1, Math.ceil(length / (view.styleStep ?? 24))) : 1;
      if (count === 1 || !a.camera || !b.camera || !view.scene) addSegment(a,b);
      else {
        const ca=a.camera, cb=b.camera;
        const at = (u:number) => {
          const t = view.perspective ? u*ca.z / (cb.z*(1-u)+u*ca.z) : u;
          return {x:ca.x+(cb.x-ca.x)*t,y:ca.y+(cb.y-ca.y)*t,z:ca.z+(cb.z-ca.z)*t};
        };
        let previous=ca;
        for(let j=1;j<=count;j++) {
          const next=at(j/count), pair=view.scene.clipSegment(previous,next);
          if(pair) addSegment(pair[0],pair[1]);
          previous=next;
        }
      }
    }
  }
  segments.sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.setLineDash([]);
  ctx.lineCap = 'butt';
  for (const segment of segments) {
    ctx.beginPath();
    ctx.moveTo(segment.a.x, segment.a.y);
    ctx.lineTo(segment.b.x, segment.b.y);
    ctx.strokeStyle = segment.color;
    ctx.lineWidth = segment.width / view.zoom;
    ctx.globalAlpha = Math.min(1,segment.alpha);
    ctx.stroke();
  }
  ctx.restore();
}
