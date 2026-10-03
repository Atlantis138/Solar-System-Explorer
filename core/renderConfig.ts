import type { RenderSettings, PlanetData, RenderQuality } from '../types';
import type { ProjectedPoint } from './projection';
import { smoothStep } from './projection';
import type { SceneView } from './sceneView';

export const VISIBILITY_THRESHOLD = .01;

/** Quality groups describe catalog populations only, never a Sun-centred
 * visibility radius. Every population uses the same camera-space policy. */
function bodyQuality(body: PlanetData, settings: RenderSettings): RenderQuality {
  if (body.type === 'comet' || body.type === 'asteroid') return settings.cometQuality;
  if (body.type === 'dwarf') return settings.outerQuality;
  return settings.innerQuality;
}

// A schematic disc is intentionally enlarged; a physical disc can be far
// smaller than one pixel. Keep the two mode calibrations explicit at each tier.
const DETAIL_PROFILES = {
  schematic: { eco:{main:1.05,small:1.05}, standard:{main:.35,small:.35}, performance:{main:0,small:0} },
  physical: { eco:{main:.0018,small:.024}, standard:{main:.0006,small:.008}, performance:{main:0,small:0} },
};

export function evaluateBodyVisibility(body: PlanetData, point: ProjectedPoint, view: SceneView,
  settings: RenderSettings, options: { prioritized?: boolean; radiusAU?: number; radiusPixels?: number } = {}) {
  const radiusPixels = options.radiusPixels ?? view.projectedRadius(options.radiusAU ?? 0, point);
  const priority = options.prioritized === true;
  const quality = bodyQuality(body, settings);
  // Clip an entire projected disc, so a planet whose centre is just offscreen
  // does not disappear while zooming. A selected body still obeys the frustum.
  if (!view.sphereVisible(point, Math.max(12, radiusPixels))) return { opacity:0,labelOpacity:0,radiusPixels };
  const smallBody = body.type === 'comet' || body.type === 'asteroid' || body.type === 'dwarf';
  const profile = DETAIL_PROFILES[view.trueScale ? 'physical' : 'schematic'][quality];
  const threshold = smallBody ? profile.small : profile.main;
  const opacity = priority || quality === 'performance' || body.id === 'sun'
    ? 1 : smoothStep(threshold * .25, threshold * 1.5, radiusPixels);
  // Names identify even unresolved point markers. Do not use physical disc
  // size as a second gate, and do not apply body opacity twice (SVG parent fades).
  const labelOpacity = opacity > VISIBILITY_THRESHOLD ? 1 : 0;
  return { opacity, labelOpacity, radiusPixels };
}
