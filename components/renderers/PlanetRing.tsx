import React, { useMemo } from 'react';
import { ringHalves } from '../../core/rings';
import { PlanetData } from '../../types';

interface Props {
  ring: PlanetData;
  radiusScale: number;
  viewTilt: number;
  viewYaw: number;
  viewRoll?:number;
  side: 'front' | 'back';
}

/** A ring shares its planet's depth group and is painted on either side of the disc. */
export default React.memo(function PlanetRing({ ring, radiusScale, viewTilt, viewYaw, viewRoll=0, side }: Props) {
  const path = useMemo(() => {
    const outer = (ring.outerRadius ?? 0) * radiusScale;
    const inner = (ring.innerRadius ?? (ring.outerRadius ?? 0) * 0.8) * radiusScale;
    if (!(outer > inner && inner > 0)) return '';
    const points = ringHalves(inner, outer, ring.tilt ?? 0, viewTilt, viewYaw, viewRoll)[side];
    return points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join('') + 'Z';
  }, [ring, radiusScale, viewTilt, viewYaw, viewRoll, side]);
  return path ? <path data-ring={ring.id} data-side={side} d={path} fill={ring.color}
    opacity={ring.opacity ?? 0.6} pointerEvents="none" /> : null;
});
