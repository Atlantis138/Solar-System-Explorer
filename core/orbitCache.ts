import { OrbitalElements, PlanetData, Position } from '../types';
import { calculateBodyPosition, calculateOrbitPath } from '../utils/astronomy';
import { MILLISECONDS_PER_DAY } from '../data/constants';
import { createKeplerOrbitCurve, type OrbitCurve } from './orbitGeometry';

declare const Astronomy: unknown;

const PRECISE_BODIES = new Set(['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']);
const WINDOW_DAYS = 30;
// Weak keys release deleted bodies; each body retains only a few geometry variants.
const cache = new WeakMap<OrbitalElements, Map<string, Position[]>>();
const curveCache = new WeakMap<OrbitalElements, { engine: unknown; entries: Map<string, OrbitCurve> }>();

const customDynamics = (body: PlanetData) => {
  const editable = body as PlanetData & { hasCustomOrbit?: boolean; hasCustomDynamics?: boolean };
  return body.isCustom || editable.hasCustomOrbit || editable.hasCustomDynamics;
};

/** Cached world-space evaluator, with camera-dependent sampling kept separate.
 * Precise paths evaluate the ephemeris at every requested subdivision rather
 * than magnifying interpolated coarse chords. */
export function getOrbitCurve(body: PlanetData, date: Date, highPrecision = false): OrbitCurve {
  const e = body.elements;
  // Extend an open path when following its departing body. Quantized extents
  // retain the geometry cache through playback; no last-to-first closure.
  const position = e.e > 1 ? calculateBodyPosition(body.id, e, date) : null;
  const extent = position ? 200 * Math.pow(2, Math.max(0, Math.ceil(Math.log2(Math.hypot(position.x, position.y, position.z) * 1.25 / 200)))) : 200;
  const engine = typeof Astronomy === 'undefined' ? undefined : Astronomy;
  const precise = highPrecision && !!engine && PRECISE_BODIES.has(body.id) && !customDynamics(body);
  const bucket = precise ? Math.floor(date.getTime() / (WINDOW_DAYS * MILLISECONDS_PER_DAY)) : 0;
  const key = [body.id, e.a, e.e, e.i, e.N, e.w, e.M, e.epochJD, e.periodDays, e.perihelionTimeJD, precise, bucket, extent].join(':');
  let cached = curveCache.get(e);
  if (!cached || cached.engine !== engine) {
    cached = { engine, entries: new Map() };
    curveCache.set(e, cached);
  }
  const existing = cached.entries.get(key);
  if (existing) return existing;
  let curve: OrbitCurve;
  if (precise) {
    const center = (bucket + 0.5) * WINDOW_DAYS * MILLISECONDS_PER_DAY;
    const period = (e.periodDays ?? 365.25 * Math.pow(e.a, 1.5)) * MILLISECONDS_PER_DAY;
    const samples = new Map<number, Position>();
    curve = {
      // A perturbed ephemeris does not repeat exactly after one Kepler period.
      // Never add an artificial last-to-first closing segment.
      closed: false,
      // Bound the time-parametrized Kepler acceleration at perihelion. The
      // factor of two accommodates the major-planet perturbations in the
      // ephemeris while keeping interval culling conservative near the camera.
      maxSecondDerivative: 2 * Math.pow(0.01720209895, 2) * Math.pow(period / MILLISECONDS_PER_DAY, 2) /
        Math.pow(e.a * Math.max(1e-4, 1 - e.e), 2),
      at(t) {
        const existing = samples.get(t);
        if (existing) return existing;
        const point = calculateBodyPosition(body.id, e, new Date(center + (t - 0.5) * period), true);
        if (samples.size >= 8192) samples.delete(samples.keys().next().value!);
        samples.set(t, point);
        return point;
      },
    };
  } else curve = createKeplerOrbitCurve(e, extent);
  if (cached.entries.size >= 4) cached.entries.delete(cached.entries.keys().next().value!);
  cached.entries.set(key, curve);
  return curve;
}

/** World-space paths; camera and display scale never invalidate the cache.
 * Satellite paths stay parent-relative and use their own Kepler elements.
 */
export function getOrbitPath(body: PlanetData, date: Date, highPrecision = false, steps = 180): Position[] {
  const e = body.elements;
  let entries = cache.get(e);
  if (!entries) { entries = new Map(); cache.set(e, entries); }
  const precise = highPrecision && PRECISE_BODIES.has(body.id) && !customDynamics(body);
  const bucket = precise ? Math.floor(date.getTime() / (WINDOW_DAYS * MILLISECONDS_PER_DAY)) : 0;
  // Include element values so editing an existing custom body cannot leave a stale path.
  const key = [body.id, e.a, e.e, e.i, e.N, e.w, e.M, e.epochJD, e.periodDays, e.perihelionTimeJD, precise, bucket, steps].join(':');
  const existing = entries.get(key);
  if (existing) return existing;
  let points: Position[];
  if (precise) {
    const center = (bucket + 0.5) * WINDOW_DAYS * MILLISECONDS_PER_DAY;
    const period = 365.25 * Math.pow(e.a, 1.5) * MILLISECONDS_PER_DAY;
    points = Array.from({ length: steps + 1 }, (_, i) =>
      calculateBodyPosition(body.id, e, new Date(center + (i / steps - 0.5) * period), true));
  } else {
    points = calculateOrbitPath(e, steps);
  }
  if (entries.size >= 4) entries.delete(entries.keys().next().value!);
  entries.set(key, points);
  return points;
}
