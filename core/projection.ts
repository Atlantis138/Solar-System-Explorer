
import { Position, AppSettings } from '../types';

// --- Constants ---
const BASE_PROXIMITY_CONST = 2000;
const INFINITE_CAMERA_DIST = 100000;
const TIER_2_IDS = ['jupiter', 'saturn', 'uranus', 'neptune'];

// --- Helper Math ---
export const smoothStep = (edge0: number, edge1: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

export interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
  scaleFactor: number;
  isVisible: boolean;
  opacity: number; // Proximity opacity only
}

// --- Core 3D Projection Logic ---
export const project3D = (
  pos: Position, 
  scale: number, 
  settings: AppSettings, 
  zoomK: number, 
  id?: string,
  centerOfRotation: Position = { x: 0, y: 0, z: 0 }
): ProjectedPoint => {
  // Phase 2: Full Vertical Rotation (-90° to +90°)
  // 90° = North Pole (Top Down)
  // 0° = Equator (Side View)
  // -90° = South Pole (Bottom Up)
  
  const tiltRad = (settings.viewTilt * Math.PI) / 180;
  const yawRad = (settings.viewYaw * Math.PI) / 180;

  const sinTilt = Math.sin(tiltRad);
  const cosTilt = Math.cos(tiltRad);
  const cosYaw = Math.cos(yawRad);
  const sinYaw = Math.sin(yawRad);

  // Step 1: Translate relative to rotation center (Pivot)
  const x_rel = pos.x - centerOfRotation.x;
  const y_rel = pos.y - centerOfRotation.y;
  const z_rel = pos.z - centerOfRotation.z;

  // Step 2: Rotate around Z-axis (Yaw)
  // Standard rotation in XY plane
  const x_yaw = x_rel * cosYaw - y_rel * sinYaw;
  const y_yaw = x_rel * sinYaw + y_rel * cosYaw;
  const z_yaw = z_rel;

  // Step 3: Apply Tilt (Rotate around X-axis) and Projection
  // We project 3D coordinates to 2D screen coordinates (Orthographic)
  //
  // Logic:
  // At Tilt = 90° (North):  Y_screen = -Y_world (Inverted for Canvas)
  // At Tilt = -90° (South): Y_screen = Y_world (Inverted -(-Y) = Y) -> Visual Flip
  // At Tilt = 0° (Side):    Y_screen = -Z_world (Z is Up)
  
  // Formula:
  // Y_screen = -(Y_yaw * sin(tilt) + Z_yaw * cos(tilt))
  // Depth    = Z_yaw * sin(tilt) - Y_yaw * cos(tilt)

  const x_screen_ortho = x_yaw * scale;
  const y_screen_ortho = -(y_yaw * sinTilt + z_yaw * cosTilt) * scale;
  
  // Depth for Z-sorting (Low Depth = Drawn First/Behind)
  const depth_pixels = (z_yaw * sinTilt - y_yaw * cosTilt) * scale; 

  let scaleFactor = 1;
  let isVisible = true;
  let proximityOpacity = 1.0;

  // --- 3D Perspective & Proximity Logic ---
  if (settings.enablePerspective) {
      const effectiveCameraDist = settings.enableProximitySim 
           ? BASE_PROXIMITY_CONST / zoomK 
           : INFINITE_CAMERA_DIST;

      const dist = effectiveCameraDist - depth_pixels;
      
      // Hard Culling: Behind Camera
      if (dist <= 0) {
          return { x: 0, y: 0, depth: depth_pixels, scaleFactor: 0, isVisible: false, opacity: 0 };
      }

      scaleFactor = effectiveCameraDist / dist;

      // Proximity Fading
      if (id === 'sun') {
          proximityOpacity = 1.0;
      } else if (TIER_2_IDS.includes(id || '')) {
          let nearPlane = 100;
          let fadeRange = 300;
          let val = 1.0;
          if (dist <= nearPlane) val = 0;
          else if (dist < nearPlane + fadeRange) val = (dist - nearPlane) / fadeRange;
          proximityOpacity = Math.max(val, 0.3);
      } else {
          let nearPlane = 100; 
          let fadeRange = 300; 
          if (id === 'mercury' || id === 'venus') {
               nearPlane = 50;
               fadeRange = 150; 
          }
          if (dist <= nearPlane) {
              proximityOpacity = 0;
          } else if (dist < nearPlane + fadeRange) {
              proximityOpacity = (dist - nearPlane) / fadeRange;
          }
      }
  }

  if (proximityOpacity < 0.01) isVisible = false;

  return {
      x: x_screen_ortho * scaleFactor,
      y: y_screen_ortho * scaleFactor,
      depth: depth_pixels,
      scaleFactor,
      isVisible,
      opacity: proximityOpacity
  };
};
