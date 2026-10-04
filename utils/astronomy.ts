import { OrbitalElements, Position, PlanetData, EventType } from '../types';
import { J2000_DATE, MILLISECONDS_PER_DAY } from '../data/constants';
import { createKeplerOrbitCurve } from '../core/orbitGeometry';
import { solveHyperbolicAnomaly } from '../core/conicOrbit';

declare const Astronomy: any;

const deg2rad = (deg: number) => (deg * Math.PI) / 180;

export const DEFAULT_SUN_ANGULAR_RADIUS_DEG = 0.266; 

const normalizeAngle = (deg: number) => {
  let res = deg % 360;
  if (res < 0) res += 360;
  return res;
};

// Solve Kepler's Equation: M = E - e*sin(E) for E (Eccentric Anomaly)
const solveKepler = (M: number, e: number): number => {
  let E = deg2rad(M); 
  const M_rad = deg2rad(M);
  const tolerance = 1e-6;
  
  for (let i = 0; i < 100; i++) {
    const deltaM = E - e * Math.sin(E) - M_rad;
    const deltaE = deltaM / (1 - e * Math.cos(E));
    E -= deltaE;
    if (Math.abs(deltaE) < tolerance) break;
  }
  return E;
};

// --- Method A: J2000 Kepler Calculation (Fast, Approximate) ---
const calculateKeplerPosition = (elements: OrbitalElements, date: Date, centralMassMultiplier: number = 1.0): Position => {
  const epochMs = (elements.perihelionTimeJD ?? elements.epochJD) === undefined ? J2000_DATE.getTime() : ((elements.perihelionTimeJD ?? elements.epochJD)! - 2440587.5) * MILLISECONDS_PER_DAY;
  const dayDiff = (date.getTime() - epochMs) / MILLISECONDS_PER_DAY;
  const n = elements.periodDays ? 360 / elements.periodDays : (0.9856076686 * centralMassMultiplier) / Math.pow(Math.abs(elements.a), 1.5);
  const mean = (elements.perihelionTimeJD === undefined ? elements.M : 0) + n * dayDiff;
  const M_curr = elements.e > 1 ? mean : normalizeAngle(mean);
  
  const hyperbolic = elements.e > 1;
  const E = hyperbolic ? solveHyperbolicAnomaly(deg2rad(M_curr), elements.e) : solveKepler(M_curr, elements.e);
  
  const xv = hyperbolic ? -elements.a * (elements.e - Math.cosh(E)) : elements.a * (Math.cos(E) - elements.e);
  const yv = hyperbolic ? -elements.a * Math.sqrt(elements.e * elements.e - 1) * Math.sinh(E)
    : elements.a * Math.sqrt(1 - elements.e * elements.e) * Math.sin(E);
  const v = Math.atan2(yv, xv);
  const r = Math.sqrt(xv*xv + yv*yv);

  const i = deg2rad(elements.i);      
  const N = deg2rad(elements.N);      
  const w = deg2rad(elements.w);      
  
  const u = v + w;
  
  const x = r * (Math.cos(N) * Math.cos(u) - Math.sin(N) * Math.sin(u) * Math.cos(i));
  const y = r * (Math.sin(N) * Math.cos(u) + Math.cos(N) * Math.sin(u) * Math.cos(i));
  const z = r * (Math.sin(u) * Math.sin(i));

  return { x, y, z };
};

// --- Method C: Geometric Orbit Path (Eccentric Anomaly Iteration) ---
export const calculateOrbitPath = (elements: OrbitalElements, steps: number = 90): Position[] => {
  const curve = createKeplerOrbitCurve(elements);
  return Array.from({ length: steps + 1 }, (_, k) => curve.at(k / steps));
};

// --- Method B: High Precision Astronomy Engine ---
const calculateHighPrecisionPosition = (id: string, date: Date): Position | null => {
  if (typeof Astronomy === 'undefined') return null;

  let body;
  switch (id) {
    case 'mercury': body = Astronomy.Body.Mercury; break;
    case 'venus': body = Astronomy.Body.Venus; break;
    case 'earth': body = Astronomy.Body.Earth; break;
    case 'mars': body = Astronomy.Body.Mars; break;
    case 'jupiter': body = Astronomy.Body.Jupiter; break;
    case 'saturn': body = Astronomy.Body.Saturn; break;
    case 'uranus': body = Astronomy.Body.Uranus; break;
    case 'neptune': body = Astronomy.Body.Neptune; break;
    case 'pluto': body = Astronomy.Body.Pluto; break;
    case 'moon': body = Astronomy.Body.Moon; break; 
    default: return null; 
  }

  try {
    const astroTime = Astronomy.MakeTime(date);
    const vec = Astronomy.HelioVector(body, astroTime);
    const eps = 23.4392911 * (Math.PI / 180); 
    const cosEps = Math.cos(eps);
    const sinEps = Math.sin(eps);

    const x_ecl = vec.x;
    const y_ecl = vec.y * cosEps + vec.z * sinEps;
    const z_ecl = -vec.y * sinEps + vec.z * cosEps;

    return { x: x_ecl, y: y_ecl, z: z_ecl };
  } catch (e) {
    return null;
  }
};

export const calculateBodyPosition = (
  id: string, 
  elements: OrbitalElements, 
  date: Date, 
  useHighPrecision: boolean = false
): Position => {
  if (id === 'sun') return { x: 0, y: 0, z: 0 };

  if (useHighPrecision) {
    const hpPos = calculateHighPrecisionPosition(id, date);
    if (hpPos) return hpPos;
  }
  return calculateKeplerPosition(elements, date);
};

export const calculateSatellitePosition = (
  satelliteElements: OrbitalElements,
  parentPos: Position,
  date: Date,
  parentMassMultiplier: number = 1.0,
  id?: string,
  useHighPrecision: boolean = false
): Position => {
    if (id && useHighPrecision) {
        const hp = calculateHighPrecisionPosition(id, date);
        if (hp) return hp;
    }
    const relativePos = calculateKeplerPosition(satelliteElements, date, parentMassMultiplier);
    return {
        x: parentPos.x + relativePos.x,
        y: parentPos.y + relativePos.y,
        z: parentPos.z + relativePos.z
    };
};

// --- Planet/satellite systems ---
// Local vectors always mean satellite minus parent. Visibility never affects mass.
interface RelativeState { position: Position; velocity?: Position; precise: boolean }
export interface PlanetarySystem {
  parent: PlanetData;
  parentPosition: Position;
  barycenter: Position;
  parentOffset: Position;
  satellitePositions: Map<string, Position>;
  relativeStates: Map<string, RelativeState>;
  massFractions: Map<string, number>;
  usesBarycenter: boolean;
  preciseParent: boolean;
}
const plus = (a: Position, b: Position): Position => ({ x: a.x+b.x, y: a.y+b.y, z: a.z+b.z });
const times = (a: Position, k: number): Position => ({ x: a.x*k, y: a.y*k, z: a.z*k });
const minus = (a: Position, b: Position) => plus(a, times(b, -1));
const zero = (): Position => ({ x: 0, y: 0, z: 0 });
const norm = (a: Position) => Math.hypot(a.x, a.y, a.z);
const cross = (a: Position, b: Position): Position => ({ x:a.y*b.z-a.z*b.y, y:a.z*b.x-a.x*b.z, z:a.x*b.y-a.y*b.x });
const positiveMass = (body: PlanetData) => Number.isFinite(body.massRelativeToSun) && body.massRelativeToSun! > 0 ? body.massRelativeToSun! : 0;
const fromEquatorial = (v: Position): Position => {
  const eps = deg2rad(23.4392911);
  return { x:v.x, y:v.y*Math.cos(eps)+v.z*Math.sin(eps), z:-v.y*Math.sin(eps)+v.z*Math.cos(eps) };
};
const fromState = (v: any): RelativeState => ({ position: fromEquatorial(v),
  velocity: fromEquatorial({ x:v.vx, y:v.vy, z:v.vz }), precise:true });
const systemCache = new WeakMap<PlanetData, { key: string; engine: unknown; value: PlanetarySystem }>();

export function calculatePlanetarySystem(parent: PlanetData, date: Date, highPrecision = false): PlanetarySystem {
  const moons = (parent.satellites ?? []).filter(m => !m.isRing && m.isValid !== false && m.elements);
  const engine = highPrecision && typeof Astronomy !== 'undefined' ? Astronomy : null;
  const fingerprint = (b: PlanetData) => [b.id, b.isCustom, b.hasCustomOrbit, b.hasCustomDynamics, b.massRelativeToSun, b.orbitReference, b.ephemerisReference, ...Object.values(b.elements ?? {})].join(',');
  const key = [date.getTime(), highPrecision, fingerprint(parent), ...moons.map(fingerprint)].join('|');
  const cached = systemCache.get(parent);
  if (cached?.key === key && cached.engine === engine) return cached.value;
  const preciseAnchor = engine && !parent.isCustom && !parent.hasCustomOrbit && !parent.hasCustomDynamics ? calculateHighPrecisionPosition(parent.id, date) : null;
  const anchor = preciseAnchor ?? calculateBodyPosition(parent.id, parent.elements, date, false);
  const parentMass = positiveMass(parent);
  const totalMass = parentMass + moons.reduce((sum, m) => sum + positiveMass(m), 0);
  const relativeStates = new Map<string, RelativeState>();
  let jovian: any = null;
  if (preciseAnchor && parent.id === 'jupiter' && engine?.JupiterMoons) {
    try { jovian = engine.JupiterMoons(date); } catch { /* Fall back to catalog orbits. */ }
  }
  for (const moon of moons) {
    let state: RelativeState | undefined;
    if (preciseAnchor && !moon.isCustom && !moon.hasCustomOrbit && !moon.hasCustomDynamics) {
      try {
        if (parent.id === 'earth' && moon.id === 'moon' && engine?.GeoMoonState)
          state = fromState(engine.GeoMoonState(date));
        else if (jovian?.[moon.id]) state = fromState(jovian[moon.id]);
      } catch { /* Missing/out-of-range ephemeris: use the catalog. */ }
    }
    if (!state) state = { position: calculateKeplerPosition(moon.elements, date,
      Math.sqrt(parentMass + positiveMass(moon))), precise:false };
    relativeStates.set(moon.id, state);
  }
  let shift = zero();
  const massFractions = new Map<string, number>();
  for (const moon of moons) {
    // Missing parent mass means legacy parent-centered motion, not an invented mass.
    const fraction = parentMass > 0 ? positiveMass(moon) / totalMass : 0;
    massFractions.set(moon.id, fraction);
    shift = plus(shift, times(relativeStates.get(moon.id)!.position, fraction));
  }
  const reference = preciseAnchor ? parent.ephemerisReference ?? 'body' : parent.orbitReference ?? 'body';
  const barycenter = reference === 'system-barycenter' ? anchor : plus(anchor, shift);
  const parentPosition = reference === 'system-barycenter' ? minus(anchor, shift) : anchor;
  const value: PlanetarySystem = { parent, parentPosition, barycenter, parentOffset:times(shift, -1),
    satellitePositions:new Map(moons.map(m => [m.id, plus(parentPosition, relativeStates.get(m.id)!.position)])),
    relativeStates, massFractions, usesBarycenter:[...massFractions.values()].some(q => q > 0), preciseParent:!!preciseAnchor };
  systemCache.set(parent, { key, engine, value });
  return value;
}

/** Report the same resolved model used by the scene, never infer it from the
 * engine toggle alone (unsupported or edited systems may use catalog orbits). */
export function describeBodyMotion(body: PlanetData, roots: PlanetData[], date: Date, highPrecision: boolean) {
  if(body.id === 'sun') return {label:'固定的日心坐标原点',note:'当前没有进行全太阳系 N 体引力积分。'};
  const parent=roots.find(p=>p.satellites?.some(m=>m.id===body.id));
  const root=parent ?? roots.find(p=>p.id===body.id) ?? body;
  const system=calculatePlanetarySystem(root,date,highPrecision);
  const resolved=parent ? root.satellites!.find(m=>m.id===body.id)! : root;
  const edited=root.isCustom||root.hasCustomOrbit||root.hasCustomDynamics;
  if(!parent) return {
    label:system.preciseParent?'高精度星历':root.elements.e>1?'双曲线轨道（开普勒）':'目录轨道（开普勒）',
    note:system.preciseParent
      ? '位置由天文引擎给出；按其天体中心或系统质心定义处理，不重复叠加偏移。'
      : (edited?'此系统的质量、轨道或成员已修改，使用目录中的当前参数。':'按目录轨道参数和当前日期计算。')+(root.elements.e>1?'双曲线只经过太阳一次，不循环；远离历元后的结果是两体外推，未计入行星摄动与喷气加速。':'这不是逐帧引力积分。'),
  };
  const relativePrecise=system.relativeStates.get(body.id)?.precise===true;
  const anchor=system.preciseParent?'高精度星历':'目录轨道';
  const relative=relativePrecise?'高精度星历':'开普勒轨道';
  return {label:`${anchor} + ${relative}`,
    note:`前者决定母体系统位置，后者决定卫星相对母体的位置。${relativePrecise?'':resolved.elements.periodDays?'相对公转以填写的周期为准。':'相对公转周期由轨道半长轴与母体、卫星质量推算。'}质量用于分配质心位置。`};
}

/** Shared by the camera, scene and event searches, including dwarf-planet moons. */
export function calculateWorldPosition(id: string, bodies: PlanetData[], date: Date, highPrecision = false): Position {
  if (id === 'sun') return zero();
  const barycentric = id.startsWith('barycenter:');
  const target = barycentric ? id.slice('barycenter:'.length) : id;
  for (const parent of bodies) {
    if (parent.id === target) {
      const system = calculatePlanetarySystem(parent, date, highPrecision);
      return barycentric ? system.barycenter : system.parentPosition;
    }
    if (parent.satellites?.some(m => m.id === target))
      return calculatePlanetarySystem(parent, date, highPrecision).satellitePositions.get(target) ?? zero();
  }
  return zero();
}

/** Osculating local paths. Binary paths are exact for catalog Kepler motion;
 * in multi-moon systems other moons are held at their current offsets. */
const localOrbitCache = new WeakMap<OrbitalElements, { key: string; points: Position[] }>();
function catalogLocalOrbit(elements: OrbitalElements, steps: number): Position[] {
  const key = [elements.a, elements.e, elements.i, elements.N, elements.w, steps].join(':');
  const cached = localOrbitCache.get(elements);
  if (cached?.key === key) return cached.points;
  const points = calculateOrbitPath(elements, steps);
  localOrbitCache.set(elements, { key, points });
  return points;
}
export function calculateSystemLocalOrbits(system: PlanetarySystem, steps = 180): Map<string, Position[]> {
  const result = new Map<string, Position[]>();
  let dominant: { moon: PlanetData; fraction: number; path: Position[] } | undefined;
  for (const moon of system.parent.satellites ?? []) {
    const state = system.relativeStates.get(moon.id);
    if (!state) continue;
    let path = catalogLocalOrbit(moon.elements, steps);
    if (state.velocity) {
      // Fit an osculating ellipse through the precise instantaneous state, so the
      // high-precision Moon/Galilean moons sit on their displayed local paths.
      const r = state.position, v = state.velocity, radius = norm(r);
      const mu = Math.pow(deg2rad(0.9856076686), 2) * (positiveMass(system.parent)+positiveMass(moon));
      const angular = cross(r, v), normal = times(angular, 1/norm(angular));
      const ev = minus(times(cross(v, angular), 1/mu), times(r, 1/radius));
      const e = norm(ev), a = 1/(2/radius - norm(v)**2/mu);
      if (Number.isFinite(a) && a > 0 && e < 1 && norm(angular) > 0) {
        const P = e > 1e-8 ? times(ev, 1/e) : times(r, 1/radius);
        const Q = cross(normal, P), b = a*Math.sqrt(1-e*e);
        path = Array.from({length:steps+1}, (_, i) => {
          const E = 2*Math.PI*i/steps;
          return plus(times(P, a*(Math.cos(E)-e)), times(Q, b*Math.sin(E)));
        });
      }
    }
    const fraction = system.massFractions.get(moon.id) ?? 0;
    const otherOffset = plus(system.parentOffset, times(state.position, fraction));
    result.set(moon.id, path.map(p => plus(otherOffset, times(p, 1-fraction))));
    if (fraction > (dominant?.fraction ?? 0)) dominant = {moon, fraction, path};
  }
  if (dominant) {
    const otherOffset = plus(system.parentOffset, times(system.relativeStates.get(dominant.moon.id)!.position, dominant.fraction));
    result.set(system.parent.id, dominant.path.map(p => plus(otherOffset, times(p, -dominant.fraction))));
  }
  return result;
}

// --- 3D Vector Math Helpers ---

const getPositionHelper = (id: string, date: Date, useHighPrecision: boolean, allBodies: PlanetData[]): Position => {
  if (id === 'sun') return { x: 0, y: 0, z: 0 };
  return calculateWorldPosition(id, allBodies, date, useHighPrecision);
};

const subtractVectors = (a: Position, b: Position): Position => {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
};

const magnitude = (v: Position): number => {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
};

const angleBetweenVectors3D = (v1: Position, v2: Position): number => {
  const dot = v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
  const mag1 = magnitude(v1);
  const mag2 = magnitude(v2);
  if (mag1 === 0 || mag2 === 0) return 0;
  const cosTheta = Math.max(-1, Math.min(1, dot / (mag1 * mag2)));
  return Math.acos(cosTheta);
};

const getEclipticLongitude = (vec: Position): number => {
  let angle = Math.atan2(vec.y, vec.x) * (180 / Math.PI);
  if (angle < 0) angle += 360;
  return angle;
};

// --- Event Detection Utilities ---

export const isTransit = (
  planetName: string, 
  date: Date, 
  toleranceDeg: number, 
  useHighPrecision: boolean,
  strictMode: boolean,
  solarRadiusDeg: number,
  allBodies: PlanetData[]
): boolean => {
  const posEarth = getPositionHelper('earth', date, useHighPrecision, allBodies);
  const posPlanet = getPositionHelper(planetName, date, useHighPrecision, allBodies);
  const posSun = { x: 0, y: 0, z: 0 };
  
  const vecEarthSun = subtractVectors(posSun, posEarth);
  const vecEarthPlanet = subtractVectors(posPlanet, posEarth);

  const angleRad = angleBetweenVectors3D(vecEarthSun, vecEarthPlanet);
  const angleDeg = angleRad * (180 / Math.PI);

  const distToSun = magnitude(vecEarthSun);
  const distToPlanet = magnitude(vecEarthPlanet);

  const effectiveTolerance = strictMode ? solarRadiusDeg : toleranceDeg;
  return angleDeg <= effectiveTolerance && distToPlanet < distToSun;
};

export const checkSpecificAlignment = (date: Date, targetIds: string[], toleranceDeg: number, useHighPrecision: boolean, allBodies: PlanetData[]): boolean => {
  if (!targetIds || targetIds.length < 2) return false;

  const posEarth = getPositionHelper('earth', date, useHighPrecision, allBodies);
  const longitudes: number[] = [];

  for (const id of targetIds) {
    const posTarget = getPositionHelper(id, date, useHighPrecision, allBodies);
    const vecRelative = subtractVectors(posTarget, posEarth);
    longitudes.push(getEclipticLongitude(vecRelative));
  }

  longitudes.sort((a, b) => a - b);

  let maxGap = 0;
  for (let i = 0; i < longitudes.length - 1; i++) {
    const gap = longitudes[i+1] - longitudes[i];
    if (gap > maxGap) maxGap = gap;
  }

  const wrapGap = 360 - (longitudes[longitudes.length - 1] - longitudes[0]);
  if (wrapGap > maxGap) maxGap = wrapGap;

  const span = 360 - maxGap;
  return span <= toleranceDeg;
};

export const calculateEventDuration = (
  centerDate: Date, 
  type: EventType, 
  targetIds: string[], 
  toleranceDeg: number, 
  useHighPrecision: boolean,
  strictMode: boolean,
  solarRadiusDeg: number,
  allBodies: PlanetData[]
): { start: number, end: number } => {
  
  const check = (t: number) => {
    const d = new Date(t);
    if (type === 'TRANSIT') {
      return targetIds.every(id => isTransit(id, d, toleranceDeg, useHighPrecision, strictMode, solarRadiusDeg, allBodies));
    } else {
      return checkSpecificAlignment(d, targetIds, toleranceDeg, useHighPrecision, allBodies);
    }
  };

  let start = centerDate.getTime();
  let end = centerDate.getTime();
  const STEP = MILLISECONDS_PER_DAY; 

  while (true) {
    const nextT = start - STEP;
    if (check(nextT)) {
      start = nextT;
      if (centerDate.getTime() - start > 3650 * STEP) break;
    } else {
      break;
    }
  }
  while (true) {
    const nextT = end + STEP;
    if (check(nextT)) {
      end = nextT;
      if (end - centerDate.getTime() > 3650 * STEP) break;
    } else {
      break;
    }
  }
  return { start, end };
};

export const findOptimalEventTime = (
    start: number, 
    end: number, 
    type: EventType, 
    targetIds: string[], 
    useHighPrecision: boolean,
    strictMode: boolean,
    solarRadiusDeg: number,
    allBodies: PlanetData[]
): { time: number, angle: number } => {
    
    let bestTime = start;
    let minMetric = 999;
    const steps = 20;
    const stepSize = (end - start) / steps;
    
    for(let i=0; i<=steps; i++) {
        const t = start + i*stepSize;
        const metric = getAlignmentMetric(new Date(t), type, targetIds, useHighPrecision, allBodies);
        if (metric < minMetric) {
            minMetric = metric;
            bestTime = t;
        }
    }
    
    let left = Math.max(start, bestTime - stepSize);
    let right = Math.min(end, bestTime + stepSize);
    
    for(let i=0; i<10; i++) {
        const m1 = left + (right - left) / 3;
        const m2 = right - (right - left) / 3;
        const v1 = getAlignmentMetric(new Date(m1), type, targetIds, useHighPrecision, allBodies);
        const v2 = getAlignmentMetric(new Date(m2), type, targetIds, useHighPrecision, allBodies);
        
        if (v1 < v2) {
            right = m2;
            if (v1 < minMetric) { minMetric = v1; bestTime = m1; }
        } else {
            left = m1;
            if (v2 < minMetric) { minMetric = v2; bestTime = m2; }
        }
    }

    return { time: bestTime, angle: minMetric };
};

const getAlignmentMetric = (date: Date, type: EventType, targetIds: string[], useHighPrecision: boolean, allBodies: PlanetData[]): number => {
  const posEarth = getPositionHelper('earth', date, useHighPrecision, allBodies);

  if (type === 'TRANSIT') {
    const posSun = { x: 0, y: 0, z: 0 };
    const vecEarthSun = subtractVectors(posSun, posEarth);
    let maxDiff = 0;

    for (const id of targetIds) {
      const posP = getPositionHelper(id, date, useHighPrecision, allBodies);
      const vecEarthP = subtractVectors(posP, posEarth);
      
      const angleRad = angleBetweenVectors3D(vecEarthSun, vecEarthP);
      const deg = angleRad * (180 / Math.PI);
      if (deg > maxDiff) maxDiff = deg;
    }
    return maxDiff;
  } else {
    if (targetIds.length < 2) return 0;

    const longitudes: number[] = [];
    for (const id of targetIds) {
        const posTarget = getPositionHelper(id, date, useHighPrecision, allBodies);
        const vecRelative = subtractVectors(posTarget, posEarth);
        longitudes.push(getEclipticLongitude(vecRelative));
    }

    longitudes.sort((a, b) => a - b);
    
    let maxGap = 0;
    for (let i = 0; i < longitudes.length - 1; i++) {
        const gap = longitudes[i+1] - longitudes[i];
        if (gap > maxGap) maxGap = gap;
    }

    const wrapGap = 360 - (longitudes[longitudes.length - 1] - longitudes[0]);
    if (wrapGap > maxGap) maxGap = wrapGap;
    
    return 360 - maxGap;
  }
};
