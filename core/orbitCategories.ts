import type { AppSettings, OrbitCategory, PlanetData } from '../types';

export const ORBIT_CATEGORIES: Record<OrbitCategory, { label:string; width:number; opacity:number }> = {
  planet: {label:'行星',width:1,opacity:1},
  satellite: {label:'天然卫星',width:.95,opacity:.85},
  dwarf: {label:'矮行星与候选天体',width:.8,opacity:.6},
  comet: {label:'彗星',width:.67,opacity:.4},
  asteroid: {label:'小行星与其他小天体',width:.55,opacity:.3},
};
export const DEFAULT_ORBIT_CATEGORY_OPACITY: Record<OrbitCategory,number> =
  Object.fromEntries(Object.entries(ORBIT_CATEGORIES).map(([key,value])=>[key,value.opacity])) as Record<OrbitCategory,number>;
export const ORBIT_SECTION_CATEGORIES: Record<string,OrbitCategory> = {
  PLANET:'planet',SATELLITE:'satellite',DWARF:'dwarf',COMET:'comet',ASTEROID:'asteroid',
};
export function orbitCategoryForBody(body:PlanetData):OrbitCategory {
  if(body.type==='satellite'||body.parentId) return 'satellite';
  if(body.type==='dwarf'||body.type==='comet'||body.type==='asteroid') return body.type;
  return ORBIT_SECTION_CATEGORIES[body.category] ?? 'planet';
}
export function categoryOrbitOpacity(settings:AppSettings,category:OrbitCategory):number {
  const value=settings.orbitCategoryOpacity?.[category];
  return typeof value==='number'&&Number.isFinite(value)?Math.max(0,Math.min(1,value)):ORBIT_CATEGORIES[category].opacity;
}
/** The global slider and category slider multiply; zero always means off, even for a selected body. */
export function bodyOrbitOpacity(body:PlanetData,settings:AppSettings):number {
  return Math.max(0,Math.min(1,settings.orbitOpacity))*categoryOrbitOpacity(settings,orbitCategoryForBody(body));
}
export function categoryOrbitWidth(category:OrbitCategory='planet',emphasized=false):number {
  const width=ORBIT_CATEGORIES[category].width;
  return emphasized?Math.max(.9,width):width;
}
