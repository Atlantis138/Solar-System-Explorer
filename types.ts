

export interface OrbitalElements {
  N: number; // Longitude of ascending node (deg)
  i: number; // Inclination (deg)
  w: number; // Argument of perihelion (deg)
  a: number; // Signed semi-major axis (AU): positive for ellipse, negative for hyperbola
  e: number; // Eccentricity
  M: number; // Mean anomaly (deg)
  epochJD?: number; // Defaults to J2000
  periodDays?: number; // Optional measured sidereal period (ellipses only)
  perihelionTimeJD?: number; // Optional perihelion epoch; M must be 0 when supplied
}

export interface PlanetData {
  id: string;
  name: string; // Chinese name
  englishName: string;
  color: string;
  radius: number; // Relative visual radius (Schematic)
  relativeRadius: number; // Radius relative to Earth (Earth = 1) for True Scale
  massRelativeToSun?: number; // Individual body mass, never combined system mass
  orbitReference?: 'body' | 'system-barycenter' | 'parent';
  ephemerisReference?: 'body' | 'system-barycenter';
  parentId?: string;
  elements: OrbitalElements; // J2000 elements
  satellites?: PlanetData[]; // Recursive structure for Moons
  
  // Ring System Properties
  isRing?: boolean;
  innerRadius?: number; // AU
  outerRadius?: number; // AU
  tilt?: number; // Degrees (Axial Tilt / Ring Inclination)
  opacity?: number;

  // Celestial Type
  type?: 'planet' | 'dwarf' | 'satellite' | 'comet' | 'asteroid';

  interstellar?: boolean; // Origin flag; retains asteroid/comet category

  // Data Management Props (New Phase 1)
  visible: boolean;        // Toggle visibility in rendering
  isCustom: boolean;       // Loaded from LocalStorage
  isOverridden?: boolean; // Local edit of a built-in entry; the original remains recoverable
  originalRawContent?: string;
  hasCustomOrbit?: boolean; // Catalog orbital parameters supersede a built-in ephemeris
  hasCustomDynamics?: boolean; // A changed mass/member requires recalculating this system
  dataWarnings?: string[];
  isValid: boolean;        // Parsed successfully
  parseError?: string;     // Error details if invalid
  rawContent?: string;     // Original text block for editing
  category: string;        // The [TAG] used in data file
  description?: string;
  dataSource?: string;
}

/** Statistical populations are catalog objects, not point masses or planets. */
export interface SmallBodyPopulation {
  id: string; kind: 'population'; name: string; englishName: string;
  distribution: 'belt' | 'trojan'; color: string; defaultVisible: boolean;
  semiMajorAxisAU: [number,number]; eccentricity: [number,number]; maxInclinationDeg: number;
  weight: number; description: string; sourceUrl: string;
  referenceBodyId?: string;
}

export interface RealStar {
  id: string;
  name: string;
  englishName?: string;
  ra: number; // J2000 degrees
  dec: number; // Degrees
  mag: number; // Apparent Magnitude
  color: string;
}

/** Fixed-epoch neighbours. Positions are heliocentric J2000 ecliptic light-years. */
export interface NearbyStar {
  id: string;
  name: string;
  englishName: string;
  designation: string;
  hipId?: string;
  position: Position;
  distanceLy: number;
  magnitude: number;
  absoluteMagnitude: number;
  spectralType: string;
  color: string;
}

export interface NearbyStarCatalog {
  version: 1;
  epoch: 'J2000.0';
  frame: 'heliocentric-ecliptic-J2000';
  positionUnit: 'ly';
  radiusLy: 100;
  stars: NearbyStar[];
}

export interface Constellation {
  id?: string;
  name: string;
  lines: string[][]; // Array of [starId1, starId2] pairs
  labelPositions?: [number, number][]; // J2000 RA/Dec degrees; Serpens has two regions
  boundaries?: [number, number][][]; // Closed, sampled J2000 boundary rings
}

export interface Position {
  x: number;
  y: number;
  z: number; // Added Z-axis for 3D/2.5D calculations
}

export interface GroundingChunk {
  web?: {
    uri: string;
    title: string;
  };
}

export interface SearchResponse {
  text: string;
  groundingChunks: GroundingChunk[];
}

export type TimeSpeed = 'paused' | 'realtime' | 'fast' | 'superfast' | 'hyperfast';

export type BackgroundStyle = 'default' | 'milkyway';

export type RenderQuality = 'eco' | 'standard' | 'performance';

export type StarLabelOption = 'none' | 'cn' | 'bilingual';

export interface RenderSettings {
  sceneQuality?: RenderQuality; // Shared geometry, particle and playback budget
  innerQuality: RenderQuality;  // Planets and satellites
  outerQuality: RenderQuality;  // Dwarf planets
  cometQuality: RenderQuality;  // Small Bodies (Comets & Asteroids)
}

export type OrbitCategory = 'planet' | 'satellite' | 'dwarf' | 'comet' | 'asteroid';

export interface AppSettings {
  showNearbyStars?: boolean;
  nearbyStarRadiusLy?: 25 | 50 | 100;
  showNearbyStarLabels?: boolean;
  nearbyStarDensity?: 'sparse' | 'balanced' | 'all';
  nearbySpectralTypes?: string[];
  nearbyMagnitudeLimit?: number;
  nearbyShowGuides?: boolean;
  cameraFov?: number;
  cameraPerspective?: number; // 0 is orthographic, 1 is full perspective
  cameraTravelSpeed?: number;
  orbitOpacity: number; // 0.0 to 1.0
  orbitCategoryOpacity?: Partial<Record<OrbitCategory,number>>;
  orbitPerspectiveIntensity: number; // 0 to 2, depth contrast; 1 = default
  trueScale: boolean;
  showDwarfPlanets: boolean; 
  showAsteroidBelt: boolean; 
  populationVisibility?: Record<string,boolean>;
  showAsteroidsComets: boolean; 
  smallBodySettingsVersion?: number;
  showComets?: boolean;
  showAsteroids?: boolean;
  showInterstellar?: boolean;
  showAsteroidOrbits?: boolean;
  showCometOrbits?: boolean;
  showInterstellarOrbits?: boolean;
  showCometTails?: boolean;
  showInterstellarTails?: boolean;
  showNonMainBeltPopulations?: boolean;
  showSmallBodyPopulations?: boolean;
  showRegionLabels: boolean; // "Show Frontiers"
  useHighPrecision: boolean; 
  showEventHighlights: boolean; // Renamed from showAngularSpan: Controls cyan target circle
  allowCalculationSearch: boolean;
  continuousIteration: boolean; 
  background: BackgroundStyle;
  
  // Procedural Background Settings
  starBrightness: number; // Renamed from backgroundBrightness
  starDensity: number; 
  
  // Real Star & Constellation Settings
  skyEnabled: boolean;
  useRealStars: boolean;
  realStarMagnitudeLimit: number; // Apparent magnitude; larger values show fainter stars
  realStarBrightnessMultiplier: number; // Gain: 1 = calibrated default
  realStarLabels: StarLabelOption;
  showConstellations: boolean;
  showConstellationNames: boolean;
  showConstellationBoundaries: boolean;
  constellationBrightnessMultiplier: number; // Gain: 1 = calibrated default
  starLabelBrightness: number; // Gain: 1 = calibrated default
  skySettingsVersion: number;
  cameraSettingsVersion: number;

  // Grid Settings
  showEclipticGrid: boolean;
  showEquatorialGrid: boolean;
  gridOpacity: number;
  convergeMeridians: boolean;

  // New Render Architecture
  renderSettings: RenderSettings;

  // Separate Tolerances
  transitTolerance: number; 
  alignmentTolerance: number;
  strictSolarRadius: number; // For strict transit mode

  viewRoll?: number; // Camera bank angle in degrees
  nearbyStarLabelDensity?: number;
  skyStarLabelDensity?: number;
  nearbyStarContrast?: number; // 0 = reveal faint stars, 1 = natural contrast
  viewTilt: number; 
  viewYaw: number; // Rotation 0-360
  showCameraControl: boolean; 
  enableSpaceView: boolean; // Master switch for 3D Space Simulation
  enablePerspective: boolean; // Active 3D Perspective projection
  enableProximitySim: boolean; // Legacy preference; perspective always uses camera travel
}

export type EventType = 'TRANSIT' | 'PLANETARY_ALIGNMENT';

export type SearchSpeed = 'low' | 'medium' | 'high';

export interface FoundEvent {
  id: string;
  type: EventType;
  targetIds: string[]; 
  startDate: number;
  endDate: number;
  optimalDate: number;
  minAngle: number;
  strictMode?: boolean; 
}

export type SortOption = 'time' | 'duration' | 'angle';

export interface SearchState {
  active: boolean;
  type: EventType | null;
  targetIds?: string[]; 
  status: string; 
  speed: SearchSpeed;
  
  // Active Search Parameters (Snapshot at start)
  activeTolerance: number;
  activeSolarRadius?: number; 
  strictMode?: boolean; 
  
  isCalculating: boolean;
  calculationResult: number | null; 
  calculationDuration: number; 
  elapsedTime: number; 
  currentScanDate: number; 
  resultStartDate?: number; 
  resultEndDate?: number; 
  resultOptimalDate?: number; 
  resultMinAngle?: number; 

  continuousPaused: boolean;
  foundEvents: FoundEvent[];
  searchStartTime: number; 
  completed: boolean; 
}

export interface SimNotification {
  message: string;
  visible: boolean;
}

export interface PinnedPlanet {
  id: string;
  color: string;
}
