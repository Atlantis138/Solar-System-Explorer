

import { AppSettings } from '../types';
import { DEFAULT_ORBIT_CATEGORY_OPACITY } from '../core/orbitCategories';
import { SKY_DEFAULTS } from '../core/skySettings';
import { DEFAULT_SUN_ANGULAR_RADIUS_DEG } from '../utils/astronomy';

export const SYSTEM_DEFAULTS: AppSettings = {
  orbitOpacity: 1.0,
  orbitCategoryOpacity: {...DEFAULT_ORBIT_CATEGORY_OPACITY},
  orbitPerspectiveIntensity: 1.0,
  trueScale: false,
  showDwarfPlanets: false, 
  showAsteroidBelt: true, 
  smallBodySettingsVersion: 2,
  showAsteroidsComets: false,
  showComets: false,
  showAsteroids: false,
  showInterstellar: false,
  showCometTails: true,
  showInterstellarTails: true,
  showNonMainBeltPopulations: false,
  showRegionLabels: true, 
  useHighPrecision: false, 
  showEventHighlights: true, 
  allowCalculationSearch: false, 
  continuousIteration: false,
  background: 'default',
  starBrightness: 1,
  starDensity: 1500, 
  
  ...SKY_DEFAULTS,
  renderSettings: { sceneQuality: 'standard', innerQuality: 'eco', outerQuality: 'eco', cometQuality: 'performance' },
  transitTolerance: 1.0,
  alignmentTolerance: 10.0,
  strictSolarRadius: DEFAULT_SUN_ANGULAR_RADIUS_DEG,
  viewTilt: 90, 
  viewYaw: 0, 
  showCameraControl: false,
  cameraSettingsVersion: 2,
  enableSpaceView: false, 
  enablePerspective: false,
  enableProximitySim: true
};
