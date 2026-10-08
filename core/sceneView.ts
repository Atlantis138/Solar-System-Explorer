import type { AppSettings, Position } from '../types';
import type { ProjectedPoint } from './projection';
import { smoothStep } from './math';
import { cameraFocalPixels, cameraFov, perspectiveStrength, cameraBasis } from './cameraOptics';

export interface CameraPoint { x: number; y: number; z: number }
export interface SceneView {
  width: number; height: number; zoom: number; scale: number;
  focusDistanceAU: number; worldUnitsPerPixel: number; cameraPosition: Position;
  referenceDistanceAU: number; // Physical distance to the navigation target, shared by orbit and flight.
  perspective: boolean; trueScale: boolean;
  project: (position: Position) => ProjectedPoint;
  toCamera: (position: Position) => CameraPoint;
  clipSegment: (a: CameraPoint, b: CameraPoint) => [ProjectedPoint, ProjectedPoint] | null;
  projectedRadius: (radiusAU: number, point: ProjectedPoint) => number;
  sphereVisible: (point: ProjectedPoint, radiusPixels: number) => boolean;
  projectedSystemOpacity: (center: Position, radiusAU: number) => number;
  rangeOpacity: (distanceAU: number) => number;
}

/** One world-space observer for projection, clipping, LOD and annotations.
 * D3's translation is interpreted as movement of the observer in its image
 * plane, not a post-projection offset of a fixed heliocentric camera.
 * Returned x/y retain the renderer's existing canvas/SVG coordinate contract.
 */
export function createSceneView({ scale, settings, zoom, width, height, center, observer }: {
  scale: number; settings: AppSettings; zoom: { x: number; y: number; k: number };
  width: number; height: number; center: Position; observer?: Position | null;
}): SceneView {
  const k = Math.max(1e-12, zoom.k), units = 1 / (scale * k);
  const { right, down, back } = cameraBasis(settings.viewTilt, settings.viewYaw, settings.viewRoll ?? 0);
  const strength = perspectiveStrength(settings);
  // Increase focal length AND dolly distance toward orthographic, preserving
  // the focus-plane framing and the standard homogeneous clipping contract.
  const focalPixels = cameraFocalPixels(width, height, cameraFov(settings)) / (strength || 1);
  const distance = focalPixels * units;
  const focal = distance / units;
  const px = (width / 2 - zoom.x) * units, py = (height / 2 - zoom.y) * units;
  const focus = observer ? { x: observer.x-back.x*distance, y: observer.y-back.y*distance, z: observer.z-back.z*distance } : { x: center.x + px * right.x + py * down.x,
    y: center.y + px * right.y + py * down.y, z: center.z + px * right.z + py * down.z };
  const cameraPosition = { x: focus.x + back.x * distance,
    y: focus.y + back.y * distance, z: focus.z + back.z * distance };
  // The projection plane still follows the renderer's zoom contract. Rendering
  // context follows the physical observer instead of a zoom frozen before flight.
  const referenceDistance = settings.enablePerspective
    ? Math.max(1e-10,Math.hypot(cameraPosition.x-center.x,cameraPosition.y-center.y,cameraPosition.z-center.z)) : distance;
  const near = Math.max(1e-14, referenceDistance * (settings.trueScale ? 1e-6 : 1e-4));
  const toCamera = (p: Position): CameraPoint => {
    const x = p.x - focus.x, y = p.y - focus.y, z = p.z - focus.z;
    return { x: x * right.x + y * right.y + z * right.z,
      y: x * down.x + y * down.y + z * down.z,
      z: distance - (x * back.x + y * back.y + z * back.z) };
  };
  const projectCamera = (p: CameraPoint): ProjectedPoint => {
    // Signed projections are retained behind the near plane for adaptive curve
    // subdivision; only clipped geometry may be drawn.
    const factor = settings.enablePerspective ? distance / (Math.abs(p.z) < 1e-15 ? 1e-15 : p.z) : 1;
    const screenX = width / 2 + p.x / units * factor;
    const screenY = height / 2 + p.y / units * factor;
    const finite = [p.x, p.y, p.z, screenX, screenY].every(Number.isFinite);
    const isVisible = finite && (!settings.enablePerspective || p.z >= near);
    return { x: (screenX - zoom.x) / k, y: (screenY - zoom.y) / k,
      screenX, screenY, camera: p, depth: (distance - p.z) * scale,
      scaleFactor: factor, isVisible, opacity: isVisible ? 1 : 0,
      distanceAU: Math.hypot(p.x, p.y, p.z),
      contextDistanceAU: settings.enablePerspective
        ? Math.hypot(p.x, p.y, p.z) : Math.hypot(p.x, p.y, p.z - distance) };
  };
  const project = (p: Position) => projectCamera(toCamera(p));
  const clipSegment = (a: CameraPoint, b: CameraPoint): [ProjectedPoint, ProjectedPoint] | null => {
    if (![a?.x,a?.y,a?.z,b?.x,b?.y,b?.z].every(Number.isFinite)) return null;
    // Homogeneous frustum clipping BEFORE perspective division. Handles paths
    // crossing the camera plane without joining opposite sides of the image.
    const margin = 4;
    const hw = (width / 2 + margin) / (settings.enablePerspective ? focal : 1 / units);
    const hh = (height / 2 + margin) / (settings.enablePerspective ? focal : 1 / units);
    const planes = settings.enablePerspective
      ? [(p:CameraPoint)=>p.z-near,(p:CameraPoint)=>hw*p.z+p.x,(p:CameraPoint)=>hw*p.z-p.x,
        (p:CameraPoint)=>hh*p.z+p.y,(p:CameraPoint)=>hh*p.z-p.y]
      : [(p:CameraPoint)=>hw+p.x,(p:CameraPoint)=>hw-p.x,(p:CameraPoint)=>hh+p.y,(p:CameraPoint)=>hh-p.y];
    let start = 0, end = 1;
    for (const plane of planes) {
      const da = plane(a), db = plane(b);
      if (da < 0 && db < 0) return null;
      if (da < 0) start = Math.max(start, da / (da - db));
      else if (db < 0) end = Math.min(end, da / (da - db));
      if (start > end) return null;
    }
    const at = (t:number) => ({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t, z:a.z+(b.z-a.z)*t });
    return [projectCamera(at(start)), projectCamera(at(end))];
  };
  const projectedRadius = (radiusAU:number, p:ProjectedPoint) => Math.abs(radiusAU / units * p.scaleFactor);
  const sphereVisible = (p:ProjectedPoint, radius:number) => p.isVisible && Number.isFinite(radius) &&
    p.screenX! + radius >= -24 && p.screenY! + radius >= -24 && p.screenX! - radius <= width+24 && p.screenY! - radius <= height+24;
  // Range is relative to the visible neighbourhood, including lens-only mode.
  // Remote guide lines have no minimum alpha; physical bodies remain independent.
  const range = Math.max(width,height) * (settings.enablePerspective ? referenceDistance / focalPixels : units);
  const rangeOpacity = (d:number) => 1 / (1 + Math.pow(d / Math.max(range * 1.8, 1e-14), 4));
  return { width,height,zoom:k,scale,focusDistanceAU:distance,referenceDistanceAU:referenceDistance,worldUnitsPerPixel:units,cameraPosition,
    perspective:settings.enablePerspective,trueScale:settings.trueScale,project,toCamera,clipSegment,projectedRadius,sphereVisible,rangeOpacity,
    projectedSystemOpacity: (p,r) => {
      if (!(r > 0)) return 0;
      const c = toCamera(p), d = Math.hypot(c.x,c.y,c.z);
      // A system is a volume, not its barycentre point. While visiting a moon,
      // its primary/barycentre can be behind the observer while nearby parts of
      // the satellite orbit remain visible. Never cull that enclosing volume.
      if (d <= r) return 1;
      if (!settings.enablePerspective) return smoothStep(12,60,r/units);
      if (c.z + r <= near) return 0;
      const angularRadiusPixels = focal * r / Math.sqrt(Math.max(near*near,d*d-r*r));
      return smoothStep(12,60,angularRadiusPixels);
    } };
}
