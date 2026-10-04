import { cameraFocalPixels, cameraBasis } from './cameraOptics';
/** Directional, infinite-distance celestial geometry. Angles are J2000 degrees. */
export interface SkyPoint { x: number; y: number; z: number }
export interface ProjectedSkyPoint { x: number; y: number; depth: number }
const RAD = Math.PI / 180;
export const OBLIQUITY = 23.4392911;

export function equatorialToEcliptic(ra: number, dec: number): SkyPoint {
  const alpha = ra * RAD, delta = dec * RAD, eps = OBLIQUITY * RAD;
  const y = Math.cos(delta) * Math.sin(alpha), z = Math.sin(delta);
  return { x: Math.cos(delta) * Math.cos(alpha),
    y: y * Math.cos(eps) + z * Math.sin(eps),
    z: -y * Math.sin(eps) + z * Math.cos(eps) };
}

/** Fixed 72° field of view on the shorter axis. Camera translation and dolly do
 * not belong here: stars represent directions at effectively infinite distance.
 * The orientation uses exactly the same basis as the foreground projection. */
export function createSkyProjection(width: number, height: number, tilt: number, yaw: number, focalOverride?: number, roll=0) {
  const basis=cameraBasis(tilt,yaw,roll);
  const focal = focalOverride ?? cameraFocalPixels(width, height);
  const camera = (p:SkyPoint):SkyPoint => ({
    x:p.x*basis.right.x+p.y*basis.right.y+p.z*basis.right.z,
    y:-(p.x*basis.down.x+p.y*basis.down.y+p.z*basis.down.z),
    z:-(p.x*basis.back.x+p.y*basis.back.y+p.z*basis.back.z),
  });
  const screen = (p: SkyPoint): ProjectedSkyPoint => ({
    x: width / 2 + focal * p.x / p.z,
    y: height / 2 - focal * p.y / p.z,
    depth: -p.z,
  });
  const project = (point: SkyPoint): ProjectedSkyPoint => {
    const p = camera(point);
    return p.z > 1e-8 ? screen(p) : { x: 0, y: 0, depth: Math.max(0, -p.z) };
  };
  // Clip BEFORE perspective division. This avoids huge coordinates, horizon
  // streaks, and missing lines whose endpoints both lie outside the viewport.
  const segment = (start: SkyPoint, end: SkyPoint): [ProjectedSkyPoint, ProjectedSkyPoint] | null => {
    const a = camera(start), b = camera(end);
    const horizontal = width / (2 * focal), vertical = height / (2 * focal);
    const planes = (p: SkyPoint) => [p.z - 1e-8,
      horizontal * p.z + p.x, horizontal * p.z - p.x,
      vertical * p.z + p.y, vertical * p.z - p.y];
    const aa = planes(a), bb = planes(b);
    let enter = 0, leave = 1;
    for (let i = 0; i < aa.length; i++) {
      if (aa[i] < 0 && bb[i] < 0) return null;
      if (aa[i] < 0) enter = Math.max(enter, aa[i] / (aa[i] - bb[i]));
      if (bb[i] < 0) leave = Math.min(leave, aa[i] / (aa[i] - bb[i]));
    }
    if (enter > leave) return null;
    const at = (t: number) => screen({ x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });
    return [at(enter), at(leave)];
  };
  return Object.assign(project, { segment });
}

/** Sample a short great-circle arc once, outside the draw loop. */
export function sampleSkyArc(a: SkyPoint, b: SkyPoint): SkyPoint[] {
  const angle = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z)));
  const steps = Math.max(1, Math.ceil(angle / (2 * RAD)));
  const sin = Math.sin(angle);
  if (angle < 1e-8) return [a, b];
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    const u = Math.sin((1 - t) * angle) / sin, v = Math.sin(t * angle) / sin;
    return { x: u * a.x + v * b.x, y: u * a.y + v * b.y, z: u * a.z + v * b.z };
  });
}
