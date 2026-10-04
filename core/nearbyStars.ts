import { nearestBrighterDistances } from './starCrowding';
import type { AppSettings, NearbyStar, NearbyStarCatalog, Position } from '../types';
import type { SceneView } from './sceneView';
import { AU_SCALE_SCHEMATIC } from '../data/constants';
import { cameraFocalPixels } from './cameraOptics';
import { smoothStep } from './math';

export const LIGHT_YEAR_AU = 63241.07708426628;
export const NEARBY_RADII = [25, 50, 100] as const;
export const nearbyRadius = (settings: AppSettings): 25 | 50 | 100 =>
  NEARBY_RADII.includes(settings.nearbyStarRadiusLy as 25 | 50 | 100) ? settings.nearbyStarRadiusLy! : 50;
export const nearbyStarName = (star: NearbyStar) => star.name || star.englishName || star.designation;
export const nearbyPositionAU = (star: NearbyStar): Position => ({
  x: star.position.x * LIGHT_YEAR_AU, y: star.position.y * LIGHT_YEAR_AU, z: star.position.z * LIGHT_YEAR_AU,
});

/** Transition uses the physical span of the short axis, independent of viewport size. */
export function nearbyOpacity(settings: AppSettings, k: number, width: number, height: number, observerDistanceAU = 0) {
  if (settings.trueScale || settings.showNearbyStars === false || !(k > 0) || Math.min(width, height) <= 0) return 0;
  const radiusLy = Math.min(width, height) / (2 * AU_SCALE_SCHEMATIC * k * LIGHT_YEAR_AU);
  return smoothStep(Math.log(.03), Math.log(.5), Math.log(Math.max(radiusLy, observerDistanceAU / LIGHT_YEAR_AU)));
}

export function nearbyFitZoom(radiusLy: number, width: number, height: number, perspective: boolean, fov = 72) {
  const pixels = Math.min(width, height) * .33;
  const focal = cameraFocalPixels(width, height, fov);
  // Fit the silhouette of a SPHERE, including stars closer than its central plane.
  const correction = perspective ? Math.sqrt(1 + (pixels / focal) ** 2) : 1;
  return pixels / (radiusLy * LIGHT_YEAR_AU * AU_SCALE_SCHEMATIC * correction);
}

export const solarZoomExtent = (trueScale: boolean, showNearbyStars = true): [number, number] =>
  trueScale ? [1e-6, 1e5] : [showNearbyStars ? 1e-7 : 1e-4, 100];

export interface NearbyPoint {
  star: NearbyStar; x: number; y: number; radius: number;
  distanceLy: number; apparentMagnitude: number; opacity: number;
}
export const SPECTRAL_GROUPS = ['O/B','A','F','G','K','M','白矮星','其他'] as const;
export function spectralGroup(type: string): string {
  let value = type.trim();
  if (/^D[ABCOQXZ0-9]/.test(value)) return '白矮星';
  value = value.replace(/^(?:esd|usd|sd|d|g)(?=[OBAFGKM])/,'');
  const letter = value.charAt(0).toUpperCase();
  return letter === 'O' || letter === 'B' ? 'O/B' : ['A','F','G','K','M'].includes(letter) ? letter : '其他';
}
export const apparentStarMagnitude = (absoluteMagnitude: number, distanceLy: number) =>
  absoluteMagnitude + 5 * Math.log10(Math.max(1e-7, distanceLy / 3.261563777)) - 5;

/** Compress display contrast without altering measured/catalog photometry. */
export const displayStarMagnitude=(magnitude:number,contrast=1)=>Math.min(magnitude,2)+Math.max(0,magnitude-2)*Math.max(0,Math.min(1,contrast));

export function projectNearbyStars(stars: NearbyStar[], scene: SceneView, options: {
  density?: 'sparse' | 'balanced' | 'all'; magnitudeLimit?: number; selectedId?: string; contrast?: number;
} = {}): NearbyPoint[] {
  const points: NearbyPoint[] = [];
  for (const star of stars) {
    const p = scene.project(nearbyPositionAU(star));
    if (!scene.sphereVisible(p, 5)) continue;
    const distanceLy = p.distanceAU! / LIGHT_YEAR_AU;
    const apparentMagnitude = apparentStarMagnitude(star.absoluteMagnitude, distanceLy);
    const displayMagnitude=displayStarMagnitude(apparentMagnitude,options.contrast);
    // Keep zero-light neighbors in crowding calculations: crossing the magnitude
    // limit must not abruptly change the brightness of surrounding stars.
    // Compressed photometry keeps the star map legible. Symbols are not discs.
    const symbolScale = Math.min(1, Math.max(.65, Math.min(scene.width, scene.height) / 650));
    const radius = Math.max(.7, Math.min(4.8, 3.6 * Math.pow(10, -.052 * (displayMagnitude + 1)))) * symbolScale;
    const limitFade=star.id===options.selectedId?1:Math.max(0,Math.min(1,(options.magnitudeLimit??Infinity)-displayMagnitude));
    const opacity = Math.max(.2, Math.min(1, 1.2 - Math.max(0, displayMagnitude) * .055))*limitFade;
    points.push({ star, x: p.screenX!, y: p.screenY!, radius, distanceLy, apparentMagnitude, opacity });
  }
  const spacing=options.density==='sparse'?30:options.density==='balanced'?15:0;
  if(spacing){
    const ordered=[...points].sort((a,b)=>Number(b.star.id===options.selectedId)-Number(a.star.id===options.selectedId)
      ||a.star.magnitude-b.star.magnitude||a.star.id.localeCompare(b.star.id));
    const distances=nearestBrighterDistances(ordered,spacing);
    ordered.forEach((p,i)=>{
      const t=Math.min(1,distances[i]/spacing),floor=options.density==='sparse'?.08:.25;
      if(p.star.id!==options.selectedId)p.opacity*=floor+(1-floor)*t*t*(3-2*t);
    });

  }
  return points.filter(p=>p.opacity>0||p.star.id===options.selectedId).sort((a,b)=>b.distanceLy-a.distanceLy);

}
export function pickNearbyStar(points: NearbyPoint[], x: number, y: number, tolerance = 9) {
  let best: NearbyPoint | undefined, distance = tolerance * tolerance;
  for (const point of points) {
    const d = (point.x - x) ** 2 + (point.y - y) ** 2;
    if (d < distance || (d === distance && best && point.star.magnitude < best.star.magnitude)) {
      best = point; distance = d;
    }
  }
  return best?.star ?? null;
}

/** Fail visibly on incompatible units/frames instead of putting stars at false distances. */
export function parseNearbyCatalog(value: unknown): NearbyStarCatalog {
  const c = value as NearbyStarCatalog;
  if (!c || c.version !== 1 || c.epoch !== 'J2000.0' || c.frame !== 'heliocentric-ecliptic-J2000'
      || c.positionUnit !== 'ly' || c.radiusLy !== 100 || !Array.isArray(c.stars) || !c.stars.length) {
    throw new Error('邻近恒星星表格式不兼容');
  }
  const ids = new Set<string>();
  for (const s of c.stars) {
    if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id)
        || ![s.name, s.englishName, s.designation, s.spectralType].every(v => typeof v === 'string')
        || typeof s.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(s.color)
        || ![s.position?.x, s.position?.y, s.position?.z, s.distanceLy, s.magnitude, s.absoluteMagnitude].every(Number.isFinite)
        || s.distanceLy <= 0 || s.distanceLy > c.radiusLy
        || Math.abs(Math.hypot(s.position.x, s.position.y, s.position.z) - s.distanceLy) > 1e-5) {
      throw new Error('邻近恒星星表包含无效位置或重复标识');
    }
    ids.add(s.id);
  }
  return c;
}

let catalogPromise: Promise<NearbyStarCatalog> | undefined;
export function loadNearbyCatalog() {
  catalogPromise ??= fetch('/data/nearby_stars.json').then(response => {
    if (!response.ok) throw new Error(`星表加载失败 (${response.status})`);
    return response.json();
  }).then(parseNearbyCatalog).catch(error => { catalogPromise = undefined; throw error; });
  return catalogPromise;
}
