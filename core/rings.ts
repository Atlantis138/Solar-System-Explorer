export interface RingPoint { x: number; y: number; depth: number }

/** Annulus halves split exactly where camera-space depth crosses the planet centre.
 * Radii are unzoomed display units, shared by both 2D renderers.
 */
export function ringHalves(inner: number, outer: number, tilt: number, viewTilt: number, viewYaw: number) {
  const rad = Math.PI / 180;
  const st = Math.sin(tilt * rad), ct = Math.cos(tilt * rad);
  const sv = Math.sin(viewTilt * rad), cv = Math.cos(viewTilt * rad);
  const sy = Math.sin(viewYaw * rad), cy = Math.cos(viewYaw * rad);
  const a = -sy * cv, b = st * sv - ct * cy * cv;
  const start = -Math.atan2(a, b);
  const point = (radius: number, theta: number): RingPoint => {
    const x = radius * Math.cos(theta), y = radius * Math.sin(theta) * ct;
    const z = radius * Math.sin(theta) * st;
    const yy = x * sy + y * cy;
    return { x: x * cy - y * sy, y: -(yy * sv + z * cv), depth: z * sv - yy * cv };
  };
  const half = (from: number) => {
    const points: RingPoint[] = [];
    for (let i = 0; i <= 48; i++) points.push(point(outer, from + i / 48 * Math.PI));
    for (let i = 48; i >= 0; i--) points.push(point(inner, from + i / 48 * Math.PI));
    return points;
  };
  return { front: half(start), back: half(start + Math.PI) };
}
