

export interface OrbitalElements {
  N: number; // Longitude of ascending node (deg)
  i: number; // Inclination (deg)
  w: number; // Argument of perihelion (deg)
  a: number; // Semi-major axis (AU)
  e: number; // Eccentricity
  M: number; // Mean anomaly (deg)
}

export interface PlanetData {
  id: string;
  name: string; // Chinese name
  englishName: string;
  color: string;
  radius: number; // Relative visual radius (Schematic)
  relativeRadius: number; // Radius relative to Earth (Earth = 1) for True Scale
  massRelativeToSun?: number; // Mass ratio relative to Sun (for Satellite Kepler physics)
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

  // Data Management Props (New Phase 1)
  visible: boolean;        // Toggle visibility in rendering
  isCustom: boolean;       // Loaded from LocalStorage
  isValid: boolean;        // Parsed successfully
  parseError?: string;     // Error details if invalid
  rawContent?: string;     // Original text block for editing
  category: string;        // The [TAG] used in data file
}

export interface RealStar {
  id: string;
  name: string;
  ra: number; // Degrees
  dec: number; // Degrees
  mag: number; // Apparent Magnitude
  color: string;
}

export interface Constellation {
  name: string;
  lines: string[][]; // Array of [starId1, starId2] pairs
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
export type CometRenderMode = 'eco' | 'performance';

export type StarLabelOption = 'none' | 'cn' | 'bilingual';

export interface RenderSettings {
  innerQuality: RenderQuality;  // Inner Solar System (Mercury - Asteroid Belt)
  outerQuality: RenderQuality;  // Outer/Dwarf (Jupiter+, TNOs)
  cometQuality: CometRenderMode; // Small Bodies
  allowTrueScaleAllBodies: boolean; // Decouple True Scale from body visibility
}

export interface AppSettings {
  orbitOpacity: number; // 0.0 to 1.0
  orbitPerspectiveIntensity: number; // 0.0 to 8.0, controls thickness scaling in 3D
  trueScale: boolean;
  showDwarfPlanets: boolean; 
  showAsteroidBelt: boolean; 
  showAsteroidsComets: boolean; 
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
  useRealStars: boolean;
  realStarBrightnessMultiplier: number; // 0.5 to 3.0
  realStarLabels: StarLabelOption;
  showConstellations: boolean;
  constellationBrightnessMultiplier: number; // 0.5 to 3.0

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

  viewTilt: number; 
  viewYaw: number; // Rotation 0-360
  showCameraControl: boolean; 
  enableSpaceView: boolean; // Master switch for 3D Space Simulation
  enablePerspective: boolean; // Active 3D Perspective projection
  enableProximitySim: boolean; // Active Proximity/Immersive Camera Mode
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