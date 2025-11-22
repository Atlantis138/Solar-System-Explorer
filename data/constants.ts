import { PlanetData } from '../types';

// Constants
export const MILLISECONDS_PER_DAY = 86400000;
export const J2000_DATE = new Date('2000-01-01T12:00:00Z');

// Schematic Mode Constants
export const AU_SCALE_SCHEMATIC = 65; 
export const SUN_RADIUS_SCHEMATIC = 14; 

// True Scale Mode Constants
// 1 AU = ~149.6 million km. Earth Radius = ~6371 km.
// Ratio 1 AU / Earth Radius ~= 23480.
export const AU_SCALE_TRUE = 23500; 
export const EARTH_RADIUS_TRUE_SCALE_BASE = 1; 
export const SUN_RELATIVE_RADIUS = 109; 

// Solar System Boundaries
export const KUIPER_BELT_AU = 35; 
export const HELIOPAUSE_AU = 120; 

// Static Sun Data (Origin)
export const SUN_DATA: PlanetData = {
  id: 'sun',
  name: '太阳',
  englishName: 'Sun',
  color: '#FDB813',
  radius: 14,
  relativeRadius: 109,
  massRelativeToSun: 1,
  elements: { a: 0, e: 0, i: 0, N: 0, w: 0, M: 0 },
  visible: true,
  isCustom: false,
  isValid: true,
  category: 'STAR'
};