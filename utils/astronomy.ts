import { OrbitalElements, Position, PlanetData, EventType } from '../types';
import { J2000_DATE, MILLISECONDS_PER_DAY } from '../data/constants';

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
  const dayDiff = (date.getTime() - J2000_DATE.getTime()) / MILLISECONDS_PER_DAY;
  const n = (0.9856076686 * centralMassMultiplier) / Math.pow(elements.a, 1.5);
  const M_curr = normalizeAngle(elements.M + n * dayDiff);
  
  const E = solveKepler(M_curr, elements.e);
  
  const xv = elements.a * (Math.cos(E) - elements.e);
  const yv = elements.a * (Math.sqrt(1 - elements.e * elements.e) * Math.sin(E));
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
  const positions: Position[] = [];
  const i_rad = deg2rad(elements.i);
  const N_rad = deg2rad(elements.N);
  const w_rad = deg2rad(elements.w);

  const a = elements.a;
  const e = elements.e;
  const b = a * Math.sqrt(1 - e * e); // Semi-minor axis

  const cosN = Math.cos(N_rad);
  const sinN = Math.sin(N_rad);
  const cosI = Math.cos(i_rad);
  const sinI = Math.sin(i_rad);
  const cosW = Math.cos(w_rad);
  const sinW = Math.sin(w_rad);
  
  const Px = cosN * cosW - sinN * sinW * cosI;
  const Py = sinN * cosW + cosN * sinW * cosI;
  const Pz = sinW * sinI;

  const Qx = -cosN * sinW - sinN * cosW * cosI;
  const Qy = -sinN * sinW + cosN * cosW * cosI;
  const Qz = cosW * sinI;

  for (let k = 0; k <= steps; k++) {
    const E = (k / steps) * 2 * Math.PI;
    const x_orb = a * (Math.cos(E) - e);
    const y_orb = b * Math.sin(E);

    const x = x_orb * Px + y_orb * Qx;
    const y = x_orb * Py + y_orb * Qy;
    const z = x_orb * Pz + y_orb * Qz;

    positions.push({ x, y, z });
  }

  return positions;
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

// --- 3D Vector Math Helpers ---

const getPositionHelper = (id: string, date: Date, useHighPrecision: boolean, allBodies: PlanetData[]): Position => {
  if (id === 'sun') return { x: 0, y: 0, z: 0 };
  const p = allBodies.find(x => x.id === id);
  if (!p) return { x: 0, y: 0, z: 0 }; 
  return calculateBodyPosition(id, p.elements, date, useHighPrecision);
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
