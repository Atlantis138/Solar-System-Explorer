import { sampleOrbitCurve, type OrbitCurve } from './orbitGeometry';
import type { SceneView } from './sceneView';
import type { Position } from '../types';
import type { ProjectedPoint } from './projection';
const ORIGIN={x:0,y:0,z:0};

/** Camera-dependent geometry is reusable while only time/body markers change.
 * Moving cameras, edited curves, ephemeris windows and local origins invalidate
 * it explicitly. Weak keys and one view per curve keep memory bounded. */
export function createOrbitProjector() {
  const cache=new WeakMap<OrbitCurve,{scene:SceneView;center:Position;tolerance:number;points:ProjectedPoint[]}>();
  return (curve:OrbitCurve,scene:SceneView,tolerance=.45,center:Position=ORIGIN) => {
    const old=cache.get(curve);
    if(old?.scene===scene&&old.tolerance===tolerance&&old.center.x===center.x&&old.center.y===center.y&&old.center.z===center.z) return old.points;
    const offset=(p:Position)=>({x:p.x+center.x,y:p.y+center.y,z:p.z+center.z});
    const points=sampleOrbitCurve(curve,{width:scene.width,height:scene.height,tolerancePx:tolerance,
      project:p=>{const q=scene.project(offset(p));return{x:q.screenX!,y:q.screenY!,isVisible:q.isVisible};},
      camera:{...scene,toCamera:p=>scene.toCamera(offset(p))},
    }).map(p=>scene.project(offset(p)));
    cache.set(curve,{scene,center:{...center},tolerance,points});return points;
  };
}
