

import { AppSettings } from '../types';
import { DEFAULT_SUN_ANGULAR_RADIUS_DEG } from '../utils/astronomy';

export const SYSTEM_DEFAULTS: AppSettings = {
  orbitOpacity: 1.0, 
  orbitPerspectiveIntensity: 4.0, 
  trueScale: false,
  showDwarfPlanets: false, 
  showAsteroidBelt: true, 
  showAsteroidsComets: false, 
  showRegionLabels: true, 
  useHighPrecision: false, 
  showEventHighlights: true, 
  allowCalculationSearch: false, 
  continuousIteration: false,
  background: 'default',
  starBrightness: 0.5, 
  starDensity: 1500, 
  
  // Real Stars Defaults
  useRealStars: false,
  realStarBrightnessMultiplier: 1.0,
  realStarLabels: 'none',
  showConstellations: false,
  constellationBrightnessMultiplier: 1.0,

  showEclipticGrid: false,
  showEquatorialGrid: false,
  gridOpacity: 0.7,
  convergeMeridians: false,
  renderSettings: { innerQuality: 'eco', outerQuality: 'eco', cometQuality: 'performance', allowTrueScaleAllBodies: false },
  transitTolerance: 1.0,
  alignmentTolerance: 10.0,
  strictSolarRadius: DEFAULT_SUN_ANGULAR_RADIUS_DEG,
  viewTilt: 90, 
  viewYaw: 0, 
  showCameraControl: false,
  enableSpaceView: false, 
  enablePerspective: false,
  enableProximitySim: false
};