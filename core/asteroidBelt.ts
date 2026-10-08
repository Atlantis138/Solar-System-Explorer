import type { AppSettings, PlanetData, Position, SmallBodyPopulation } from '../types';
import { SMALL_BODY_POPULATIONS, populationVisible, TROJAN_DISTRIBUTION } from '../data/populations';
import { createSceneView, SceneView } from './sceneView';
import { renderBudget } from './renderBudget';
import { J2000_DATE, MILLISECONDS_PER_DAY } from '../data/constants';

const TAU = Math.PI * 2, RAD = Math.PI / 180;
const random = (i: number, salt: number) => {
  const value = Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
};
// Fixed seeds and prefix sampling keep members in place across dates, modes and quality changes.
// These are statistical tracers, not additional catalog bodies or gravitating masses.
const samples = new Map(SMALL_BODY_POPULATIONS.map((group,g) => [group.id,
  Array.from({length:2000},(_,i)=>{
    const r = (salt:number)=>random(i,salt+g*19);
    const a=group.semiMajorAxisAU[0]+r(1)*(group.semiMajorAxisAU[1]-group.semiMajorAxisAU[0]);
    const e=group.eccentricity[0]+r(2)*(group.eccentricity[1]-group.eccentricity[0]);
    const inc=r(3)**2*group.maxInclinationDeg*RAD, node=r(4)*TAU, peri=r(5)*TAU;
    const cn=Math.cos(node),sn=Math.sin(node),cw=Math.cos(peri),sw=Math.sin(peri),ci=Math.cos(inc),si=Math.sin(inc);
    return {a,e,mean:r(6)*TAU,n:.9856076686*RAD/a**1.5,minor:Math.sqrt(1-e*e),
      u:{x:cn*cw-sn*sw*ci,y:sn*cw+cn*sw*ci,z:sw*si},
      v:{x:-cn*sw-sn*cw*ci,y:-sn*sw+cn*cw*ci,z:cw*si},
      size:.6+r(7)*.6,phase:r(8)*TAU,libration:(TROJAN_DISTRIBUTION.librationAmplitudeDeg[0]+r(9)*(TROJAN_DISTRIBUTION.librationAmplitudeDeg[1]-TROJAN_DISTRIBUTION.librationAmplitudeDeg[0]))*RAD,
      side:i%2===0?1:-1,radial:TROJAN_DISTRIBUTION.radialFraction[0]+r(10)*(TROJAN_DISTRIBUTION.radialFraction[1]-TROJAN_DISTRIBUTION.radialFraction[0]),inc};
  })]));

type Sample = ReturnType<typeof samples.get> extends (infer P)[] | undefined ? P : never;
export interface PopulationReference { body: PlanetData; position: Position }
const cross=(a:Position,b:Position):Position=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const unit=(p:Position):Position=>{const r=Math.hypot(p.x,p.y,p.z)||1;return {x:p.x/r,y:p.y/r,z:p.z/r};};
function referenceFrame(reference?:PopulationReference) {
  if(!reference) return undefined;
  const {position,body}=reference, i=body.elements.i*RAD,N=body.elements.N*RAD;
  const radial=unit(position),tangent=unit(cross({x:Math.sin(i)*Math.sin(N),y:-Math.sin(i)*Math.cos(N),z:Math.cos(i)},radial));
  return {radial,tangent,normal:cross(radial,tangent),radius:Math.hypot(position.x,position.y,position.z)};
}
function samplePosition(group:SmallBodyPopulation,p:Sample,day:number,frame:ReturnType<typeof referenceFrame>):Position|null {
  if(group.distribution==='trojan') {
    if(!frame) return null;
    const angle=p.side*TAU/6+p.libration*Math.sin(p.phase+day*TAU/(TROJAN_DISTRIBUTION.librationPeriodYears*365.25));
    const r=frame.radius*p.radial,x=r*Math.cos(angle),y=r*Math.sin(angle);
    const z=r*Math.sin(p.inc)*Math.sin(p.phase+day*p.n);
    return {x:x*frame.radial.x+y*frame.tangent.x+z*frame.normal.x,
      y:x*frame.radial.y+y*frame.tangent.y+z*frame.normal.y,z:x*frame.radial.z+y*frame.tangent.z+z*frame.normal.z};
  }
  const mean=(p.mean+day*p.n)%TAU;
  let E=mean;for(let n=0;n<4;n++) E-=(E-p.e*Math.sin(E)-mean)/(1-p.e*Math.cos(E));
  const x=p.a*(Math.cos(E)-p.e),y=p.a*p.minor*Math.sin(E);
  return {x:x*p.u.x+y*p.v.x,y:x*p.u.y+y*p.v.y,z:x*p.u.z+y*p.v.z};
}

/** Exposed for numerical checks; all modes use the very same world-space tracers. */
export function populationPosition(id:string,index:number,date:Date,reference?:PopulationReference):Position|null {
  const group=SMALL_BODY_POPULATIONS.find(p=>p.id===id),p=samples.get(id)?.[index];
  return group&&p?samplePosition(group,p,(+date-+J2000_DATE)/MILLISECONDS_PER_DAY,referenceFrame(reference)):null;
}
export const hasVisiblePopulations=(settings:AppSettings)=>SMALL_BODY_POPULATIONS.some(p=>populationVisible(p,settings));

/** All enabled groups share ONE quality budget. One canvas batch per group, no DOM particles. */
export function drawAsteroidBelt(ctx: CanvasRenderingContext2D, width: number, height: number,
  scale: number, settings: AppSettings, zoom: { x: number; y: number; k: number },
  center: Position, date: Date, opacity: number, scene?: SceneView, reference?:PopulationReference) {
  if(opacity<=.01) return;
  const groups=SMALL_BODY_POPULATIONS.filter(p=>populationVisible(p,settings)&&(p.distribution!=='trojan'||reference?.body.id===p.referenceBodyId));
  if(!groups.length) return;
  const day=(+date-+J2000_DATE)/MILLISECONDS_PER_DAY;
  const view=scene??createSceneView({scale,settings,zoom,width,height,center});
  const frame=referenceFrame(reference),origin=view.project({x:0,y:0,z:0});
  const weights=groups.reduce((s,p)=>s+p.weight,0),budget=renderBudget(settings.renderSettings).beltParticles;
  ctx.save();ctx.globalAlpha=opacity;
  for(const group of groups) {
    const screenRadius=view.projectedRadius(group.semiMajorAxisAU[1],origin);
    const count=Math.min(Math.floor(budget*group.weight/weights),Math.max(100,Math.round(screenRadius*4)));
    ctx.fillStyle=group.color;ctx.beginPath();
    const members=samples.get(group.id)!;
    for(let i=0;i<count;i++) {
      const p=members[i],world=samplePosition(group,p,day,frame);
      if(!world) continue;
      const projected=view.project(world);
      const fade=view.rangeOpacity(projected.contextDistanceAU??projected.distanceAU!);
      if(!projected.isVisible||fade<.015||(i*.61803398875)%1>fade) continue;
      const x=zoom.x+projected.x*zoom.k,y=zoom.y+projected.y*zoom.k;
      const contextFactor=view.perspective&&projected.camera ? view.referenceDistanceAU/Math.max(1e-14,projected.camera.z) : 1;
      const radius=Math.min(2,Math.max(.45,p.size*Math.sqrt(Math.max(0,contextFactor))));
      if(x< -radius||y< -radius||x>width+radius||y>height+radius) continue;
      ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,TAU);
    }
    ctx.fill();
  }
  ctx.restore();
}
