import type { OrbitalElements, Position } from '../types';

/** A curve is evaluated in world space. Its tessellation belongs to the camera,
 * rather than to the catalog: a 180-sided polygon is not an orbit at close range. */
export interface OrbitCurve {
  at(t: number): Position;
  closed: boolean;
  /** Bound on |d² position / dt²|, in AU, used for conservative curve/frustum tests. */
  maxSecondDerivative?: number;
}

export interface OrbitSamplingView {
  /** CSS pixel coordinates, before clipping. Behind-camera points may be signed. */
  project(point: Position): { x: number; y: number; isVisible: boolean };
  width: number;
  height: number;
  tolerancePx?: number;
  maxPoints?: number;
  initialSegments?: number; // Short parametric arcs need fewer initial intervals.
  camera?: {
    toCamera(point: Position): { x: number; y: number; z: number };
    perspective: boolean;
    worldUnitsPerPixel: number;
    focusDistanceAU: number;
  };
}

export function createKeplerOrbitCurve(elements: OrbitalElements, extentAU = 200): OrbitCurve {
  const radians = Math.PI / 180;
  const N = elements.N * radians, i = elements.i * radians, w = elements.w * radians;
  const cosN = Math.cos(N), sinN = Math.sin(N), cosI = Math.cos(i), sinI = Math.sin(i);
  const cosW = Math.cos(w), sinW = Math.sin(w), a = elements.a, e = elements.e;
  const b = Math.abs(a) * Math.sqrt(Math.abs(1 - e * e));
  const P = { x: cosN * cosW - sinN * sinW * cosI, y: sinN * cosW + cosN * sinW * cosI, z: sinW * sinI };
  const Q = { x: -cosN * sinW - sinN * cosW * cosI, y: -sinN * sinW + cosN * cosW * cosI, z: cosW * sinI };
  if (e > 1) {
    const A = -a;
    const extent = Math.max(extentAU, A * (e - 1) * 4);
    const limit = Math.acosh((extent / A + 1) / e);
    return {
      closed: false,
      maxSecondDerivative: 4 * limit * limit * Math.hypot(A * Math.cosh(limit), b * Math.sinh(limit)),
      at(t) {
        const H = (2 * t - 1) * limit;
        const x = A * (e - Math.cosh(H)), y = b * Math.sinh(H);
        return { x: P.x*x + Q.x*y, y: P.y*x + Q.y*y, z: P.z*x + Q.z*y };
      },
    };
  }
  return {
    closed: true,
    maxSecondDerivative: 4 * Math.PI * Math.PI * a,
    at(t) {
      const E = t * 2 * Math.PI;
      const x = a * (Math.cos(E) - e), y = b * Math.sin(E);
      return { x: P.x * x + Q.x * y, y: P.y * x + Q.y * y, z: P.z * x + Q.z * y };
    },
  };
}

/** Local system paths are affine ellipses sampled at equal eccentric anomaly,
 * including the fitted high-precision satellite ellipses. Recover that exact
 * curve; interpolating their existing chords cannot remove magnification error.
 * This function must not be used for chronological ephemeris samples. */
export function curveFromOrbitPoints(points: readonly Position[]): OrbitCurve {
  const count = points.length - 1;
  if (count < 4) throw new Error('An orbital ellipse needs at least four samples.');
  const center = { x: 0, y: 0, z: 0 }, cosine = { x: 0, y: 0, z: 0 }, sine = { x: 0, y: 0, z: 0 };
  for (let index = 0; index < count; index++) {
    const angle = 2 * Math.PI * index / count;
    const c = 2 * Math.cos(angle) / count, s = 2 * Math.sin(angle) / count;
    for (const axis of ['x', 'y', 'z'] as const) {
      center[axis] += points[index][axis] / count;
      cosine[axis] += points[index][axis] * c;
      sine[axis] += points[index][axis] * s;
    }
  }
  return {
    closed: true,
    maxSecondDerivative: 4 * Math.PI * Math.PI * Math.hypot(cosine.x, cosine.y, cosine.z, sine.x, sine.y, sine.z),
    at(t) {
      const c = Math.cos(t * 2 * Math.PI), s = Math.sin(t * 2 * Math.PI);
      return {
        x: center.x + cosine.x * c + sine.x * s,
        y: center.y + cosine.y * c + sine.y * s,
        z: center.z + cosine.z * c + sine.z * s,
      };
    },
  };
}

const BREAK: Position = { x: NaN, y: NaN, z: NaN };
const finite = (point: { x: number; y: number }) => Number.isFinite(point.x) && Number.isFinite(point.y);

/** Adaptive, viewport-aware tessellation. NaN points are explicit pen lifts:
 * callers must clip each finite world segment separately and never join across
 * a lift. Exhausting the work budget omits unresolved arcs instead of inventing
 * a long chord through the view. */
export function sampleOrbitCurve(curve: OrbitCurve, view: OrbitSamplingView): Position[] {
  const tolerance = Math.max(0.1, view.tolerancePx ?? 0.45);
  const budget = Math.max(128, Math.floor(view.maxPoints ?? 4096));
  const baseSegments = Math.max(1, Math.min(256, Math.round(view.initialSegments ?? 48)));
  const result: Position[] = [];
  let evaluations = 0;
  type Sample = { world: Position; screen: ReturnType<OrbitSamplingView['project']> };
  const sample = (t: number): Sample => {
    evaluations++;
    const world = curve.at(t);
    return { world, screen: view.project(world) };
  };
  const lift = () => {
    if (result.length && Number.isFinite(result[result.length - 1].x)) result.push(BREAK);
  };
  const append = (a: Sample, b: Sample) => {
    const previous = result[result.length - 1];
    if (!previous || !Number.isFinite(previous.x) || previous !== a.world) result.push(a.world);
    result.push(b.world);
  };
  const recurse = (t0: number, a: Sample, t1: number, b: Sample, depth: number) => {
    if (evaluations >= budget) { lift(); return; }
    const middle = (t0 + t1) / 2, m = sample(middle);
    const pa = a.screen, pb = b.screen, pm = m.screen;
    let conservativeError: number | undefined;
    if (view.camera && curve.maxSecondDerivative !== undefined) {
      const camera = view.camera, ca = camera.toCamera(a.world), cb = camera.toCamera(b.world);
      // Linear-interpolation error of a twice differentiable curve is bounded
      // by max|r''| * dt² / 8. Test this capsule against the actual camera frustum,
      // including intervals whose samples are all behind the near plane. A tiny
      // visible arc between those samples must still be discovered on approach.
      const radius = curve.maxSecondDerivative * (t1 - t0) ** 2 / 8;
      const units = camera.worldUnitsPerPixel, focal = camera.focusDistanceAU / units;
      const hx = (view.width / 2 + 4) * units, hy = (view.height / 2 + 4) * units;
      const wx = hx / camera.focusDistanceAU, wy = hy / camera.focusDistanceAU;
      const planes = camera.perspective
        ? [
          { evaluate: (p: Position) => p.z, norm: 1 },
          { evaluate: (p: Position) => wx * p.z + p.x, norm: Math.hypot(wx, 1) },
          { evaluate: (p: Position) => wx * p.z - p.x, norm: Math.hypot(wx, 1) },
          { evaluate: (p: Position) => wy * p.z + p.y, norm: Math.hypot(wy, 1) },
          { evaluate: (p: Position) => wy * p.z - p.y, norm: Math.hypot(wy, 1) },
        ]
        : [
          { evaluate: (p: Position) => hx + p.x, norm: 1 },
          { evaluate: (p: Position) => hx - p.x, norm: 1 },
          { evaluate: (p: Position) => hy + p.y, norm: 1 },
          { evaluate: (p: Position) => hy - p.y, norm: 1 },
        ];
      if (planes.some(plane => Math.max(plane.evaluate(ca), plane.evaluate(cb)) + radius * plane.norm < 0)) {
        lift(); return;
      }
      if (!camera.perspective) conservativeError = radius / units;
      else {
        const minDepth = Math.min(ca.z, cb.z) - radius;
        // Bound both transverse error and the projection change caused by depth
        // error. This also catches a projected curve that doubles back along an
        // otherwise perfectly straight edge-on chord.
        conservativeError = minDepth > 0
          ? focal * radius / minDepth * (1 + Math.max(Math.hypot(ca.x, ca.y), Math.hypot(cb.x, cb.y)) / Math.min(ca.z, cb.z))
          : Infinity;
      }
    } else if (!pa.isVisible && !pb.isVisible && !pm.isVisible) { lift(); return; }
    const valid = finite(pa) && finite(pb) && finite(pm);
    const allInFront = pa.isVisible && pb.isVisible && pm.isVisible;
    let error = Infinity;
    if (valid && allInFront) {
      // Distance to the segment, not to its arithmetic midpoint: perspective
      // changes parameter speed even for an exactly straight projected line.
      const dx = pb.x - pa.x, dy = pb.y - pa.y;
      const length2 = dx * dx + dy * dy;
      const u = length2 > 0 ? Math.max(0, Math.min(1, ((pm.x - pa.x) * dx + (pm.y - pa.y) * dy) / length2)) : 0;
      error = Math.hypot(pm.x - pa.x - u * dx, pm.y - pa.y - u * dy);
      // Expanded curve bounds avoid spending work on distant offscreen arcs.
      // Twice the midpoint sagitta is conservative for these short smooth arcs.
      const margin = Math.max(4, error * 2);
      if (conservativeError === undefined && (Math.max(pa.x, pb.x, pm.x) < -margin || Math.min(pa.x, pb.x, pm.x) > view.width + margin ||
          Math.max(pa.y, pb.y, pm.y) < -margin || Math.min(pa.y, pb.y, pm.y) > view.height + margin)) {
        lift(); return;
      }
    }
    if (conservativeError !== undefined) error = Math.max(error, conservativeError);
    if (error <= tolerance) { append(a, b); return; }
    if (depth >= 22 || evaluations + 2 > budget) { lift(); return; }
    recurse(t0, a, middle, m, depth + 1);
    recurse(middle, m, t1, b, depth + 1);
  };
  let previous = sample(0);
  for (let index = 0; index < baseSegments; index++) {
    if (evaluations >= budget) { lift(); break; }
    const next = sample((index + 1) / baseSegments);
    recurse(index / baseSegments, previous, (index + 1) / baseSegments, next, 0);
    previous = next;
  }
  return result;
}
