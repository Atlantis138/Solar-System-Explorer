import type { PlanetData, Position, AppSettings } from '../types';
import type { SceneView } from './sceneView';
import { calculateBodyPosition } from '../utils/astronomy';
import { renderBudget } from './renderBudget';

/** Illustrative solar-driven activity, not a photometric or gas-dynamics model. */
export function cometActivity(distanceAU: number): number {
  return 1 / (1 + Math.pow(distanceAU / 2.5, 4));
}

export function cometTailGeometry(body: PlanetData, date: Date, segments: number) {
  if (body.type !== 'comet') return null;
  const head = calculateBodyPosition(body.id, body.elements, date, false);
  const r = Math.hypot(head.x, head.y, head.z), activity = cometActivity(r);
  if (!(r > 0) || activity < .004) return null;
  const away = {x:head.x/r,y:head.y/r,z:head.z/r};
  const before = calculateBodyPosition(body.id, body.elements, new Date(+date - 3600000), false);
  const delta = {x:head.x-before.x,y:head.y-before.y,z:head.z-before.z};
  const radial = delta.x*away.x + delta.y*away.y + delta.z*away.z;
  const tangent = {x:delta.x-radial*away.x,y:delta.y-radial*away.y,z:delta.z-radial*away.z};
  const norm = Math.hypot(tangent.x,tangent.y,tangent.z) || 1;
  const length = .95 * Math.pow(activity,.65);
  const point = (t:number,dust:boolean):Position => {
    const bend = dust ? length * .32 * t*t/norm : 0;
    const d = length*t*(dust ? .8 : 1);
    return {x:head.x+away.x*d-tangent.x*bend,y:head.y+away.y*d-tangent.y*bend,z:head.z+away.z*d-tangent.z*bend};
  };
  return {head,activity,length,
    ion:Array.from({length:segments+1},(_,i)=>point(i/segments,false)),
    dust:Array.from({length:segments+1},(_,i)=>point(i/segments,true))};
}

/** Constant work per visible comet, no particle systems, blur filters or
 * independent animation loop. Clip in camera space before perspective divide. */
export function drawCometTails(ctx:CanvasRenderingContext2D,bodies:PlanetData[],date:Date,scene:SceneView,settings:AppSettings) {
  if (settings.showCometTails === false || !settings.showAsteroidsComets) return;
  const budget=renderBudget(settings.renderSettings),count=budget.tailSegments;
  ctx.save();ctx.lineCap='round';
  for (const body of bodies) {
    const geometry=cometTailGeometry(body,date,count);
    if (!geometry) continue;
    const head=scene.project(geometry.head);
    // A tiny on-screen tail cannot contribute useful geometry.
    if (head.isVisible && scene.projectedRadius(geometry.length,head)<1) continue;
    const layers=[{points:geometry.dust,dust:true},{points:geometry.ion,dust:false}];
    for (const {points,dust} of layers) {
      for(let i=1;i<points.length;i++) {
        const t=(i-.5)/count;
        const segment=scene.clipSegment(scene.toCamera(points[i-1]),scene.toCamera(points[i]));
        if(!segment) continue;
        const [a,b]=segment;
        const p=scene.project(points[i]);
        const widthAU=(dust ? .055 : .008)*(0.12+t)*Math.pow(geometry.activity,.4);
        // Schematic nucleus is enlarged independently; physical tails retain
        // an AU width. Bounds protect mobile devices during extreme closeups.
        const nucleus=scene.trueScale ? 0 : body.radius*scene.zoom*Math.abs(p.scaleFactor)*2;
        const width=Math.min(scene.width*.3,Math.max(.5,scene.projectedRadius(widthAU,p),nucleus*(1-t)));
        const alpha=geometry.activity*(dust ? .22 : .3)*Math.pow(1-t,1.5);
        ctx.strokeStyle=dust?'#cfceb4':'#8ebcdd';ctx.globalAlpha=alpha;ctx.lineWidth=width;
        ctx.beginPath();ctx.moveTo(a.screenX!,a.screenY!);ctx.lineTo(b.screenX!,b.screenY!);ctx.stroke();
      }
    }
    if(scene.sphereVisible(head,20)) {
      const radius=Math.min(90,Math.max(scene.trueScale?1:body.radius*scene.zoom*Math.abs(head.scaleFactor),scene.projectedRadius(.012*Math.sqrt(geometry.activity),head))*2.2);
      const gradient=ctx.createRadialGradient(head.screenX!,head.screenY!,0,head.screenX!,head.screenY!,radius);
      gradient.addColorStop(0,'rgba(179,225,217,0.38)');gradient.addColorStop(1,'rgba(179,225,217,0)');
      ctx.globalAlpha=geometry.activity;ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(head.screenX!,head.screenY!,radius,0,Math.PI*2);ctx.fill();
    }
  }
  ctx.restore();
}
