import type { Position, AppSettings } from '../types';
import { createSceneView } from './sceneView';
export { smoothStep } from './math';

export interface ProjectedPoint {
  x: number;
  y: number;
  screenX?: number;
  screenY?: number;
  camera?: { x: number; y: number; z: number };
  depth: number;
  scaleFactor: number;
  isVisible: boolean;
  opacity: number;
  contextDistanceAU?: number; // Local guide range; focus plane in orthographic/lens modes
  distanceAU?: number; // Actual observer-to-point distance, independent of renderer units
}

/** Legacy point helper; renderers use a SceneView with actual viewport and pan.
 * Keep one projection implementation so model/unit tests and external callers
 * cannot drift from the finite-scene camera. */
export const project3D = (pos: Position, scale: number, settings: AppSettings, zoomK: number,
  _id?: string, centerOfRotation: Position = {x:0,y:0,z:0}): ProjectedPoint => {
  const size = 4000 * Math.tan(36 * Math.PI / 180);
  return createSceneView({scale,settings,zoom:{x:size/2,y:size/2,k:zoomK},
    width:size,height:size,center:centerOfRotation}).project(pos);
};
