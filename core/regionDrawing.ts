import { KUIPER_BELT_AU, HELIOPAUSE_AU } from '../data/constants';
import { sceneLabelStyle, SCENE_FONT_FAMILY } from './sceneLabels';
import { smoothStep } from './math';
import { sampleOrbitCurve } from './orbitGeometry';
import type { SceneView } from './sceneView';

const REGIONS = [
  { radius: KUIPER_BELT_AU, label: '柯伊伯带', color: '#aaa', count: 50, duty: .5, width: 1.5 },
  { radius: HELIOPAUSE_AU, label: '日球层顶', color: '#666', count: 68, duty: .6, width: 2 },
];
const clamp = (x:number,min:number,max:number) => Math.max(min,Math.min(max,x));

/** Stable world-space dashes: projection changes their apparent length and gap,
 * rather than stamping uniform screen-space dashes after the circle is projected. */
export function regionPerspectiveStyle(scaleFactor:number, perspective:boolean, width:number) {
  const factor = perspective ? Math.max(.001,scaleFactor) : 1;
  return { width:width*clamp(factor**.65,.55,2.5),
    alpha:1+.35*(factor-1)/(factor+1), textScale:clamp(Math.sqrt(factor),.7,1.6) };
}

/** Region annotations share geometry with orbits, but keep their own legibility
 * and brighter baseline. CSS units make the result independent of screen DPR. */
export function drawRegionBoundaries(ctx: CanvasRenderingContext2D, scene: SceneView) {
  const k=scene.zoom;
  ctx.save(); ctx.setLineDash([]); ctx.lineCap='butt';
  for (const region of REGIONS) {
    const apparentRadius=scene.projectedRadius(region.radius,scene.project({x:0,y:0,z:0}));
    const viewport=Math.max(scene.width,scene.height);
    const opacity=.5*smoothStep(8,30,apparentRadius)*(1-smoothStep(viewport,viewport*2,apparentRadius));
    if(opacity<.01) continue;
    ctx.strokeStyle=region.color;
    for(let dash=0;dash<region.count;dash++) {
      const span=region.duty/region.count, start=dash/region.count;
      const points=sampleOrbitCurve({closed:false,
        maxSecondDerivative:region.radius*4*Math.PI**2*span**2,
        at:t=>{const angle=(start+t*span)*Math.PI*2;return{x:region.radius*Math.cos(angle),y:region.radius*Math.sin(angle),z:0};},
      },{width:scene.width,height:scene.height,camera:scene,initialSegments:2,
        project:p=>{const q=scene.project(p);return{x:q.screenX!,y:q.screenY!,isVisible:q.isVisible};},
      }).map(scene.toCamera);
      ctx.beginPath();
      let previous:{x:number;y:number}|undefined, sum=0, count=0;
      for(let i=1;i<points.length;i++) {
        const pair=scene.clipSegment(points[i-1],points[i]);
        if(!pair){previous=undefined;continue;}
        const [a,b]=pair;
        if(!previous||Math.hypot(previous.x-a.x,previous.y-a.y)*k>.01) ctx.moveTo(a.x,a.y);
        ctx.lineTo(b.x,b.y);previous=b;
        sum+=(a.scaleFactor+b.scaleFactor)/2;count++;
      }
      if(!count) continue;
      const style=regionPerspectiveStyle(sum/count,scene.perspective,scene.trueScale?2:region.width);
      ctx.lineWidth=style.width/k;ctx.globalAlpha=opacity*style.alpha;ctx.stroke();
    }
    ctx.fillStyle=region.color;ctx.textAlign='center';ctx.textBaseline='middle';
    const baseLabel=sceneLabelStyle('region',apparentRadius);
    const baseFont=baseLabel.fontSize;
    if(baseLabel.opacity<.01) continue;
    // Arc spacing and typography depend on screen extent in either display mode.
    const spread=Math.max(.2,Math.min(.6,baseFont*1.15/Math.max(1,apparentRadius*1.08)));
    const chars=[...region.label];
    const textOpacity=opacity*.8;
    if(textOpacity<.01) continue;
    const letterAt=(angle:number)=>{
      const radius=region.radius*1.08;
      const point=scene.project({x:radius*Math.cos(angle),y:radius*Math.sin(angle),z:0});
      const style=regionPerspectiveStyle(point.scaleFactor,scene.perspective,1);
      const labelStyle=sceneLabelStyle('region',apparentRadius*(scene.perspective?Math.max(0,point.scaleFactor):1));
      return {point,style,font:labelStyle.fontSize,labelOpacity:labelStyle.opacity};
    };
    const separated=(letters:ReturnType<typeof letterAt>[])=>letters.every((a,i)=>letters.slice(i+1).every(b=>{
      const gap=(a.font+b.font)*.48;
      return Math.abs(a.point.screenX!-b.point.screenX!)>=gap || Math.abs(a.point.screenY!-b.point.screenY!)>=gap;
    }));
    let letters=chars.map((_,i)=>letterAt(Math.PI/4+(i-(chars.length-1)/2)*spread));
    // Foreshortened arcs need more space for upright glyphs. Try a wider arc,
    // then the near side; an edge-on ring may require a single readable caption.
    if(!separated(letters)) {
      let nearAngle=0,depth=Infinity;
      for(let i=0;i<48;i++) {
        const angle=i/48*Math.PI*2;
        const p=scene.toCamera({x:region.radius*Math.cos(angle),y:region.radius*Math.sin(angle),z:0});
        if(p.z<depth){nearAngle=angle;depth=p.z;}
      }
      search: for(const center of [Math.PI/4,nearAngle]) for(let spacing=spread;spacing<=1;spacing+=.08) {
        const candidate=chars.map((_,i)=>letterAt(center+(i-(chars.length-1)/2)*spacing));
        if(candidate.every(l=>l.point.isVisible)&&separated(candidate)){letters=candidate;break search;}
      }
    }
    // Draw text in screen-sized units: fontSize/k can exceed browser font
    // limits at solar-system distances in physical mode and shrink the glyphs.
    ctx.save();ctx.scale(1/k,1/k);
    if(separated(letters)) {
      letters.forEach(({point,style,font,labelOpacity},i)=>{
        if(!scene.sphereVisible(point,font)) return;
        ctx.font=`500 ${font}px ${SCENE_FONT_FAMILY}`;
        ctx.globalAlpha=textOpacity*style.alpha*labelOpacity;
        ctx.fillText(chars[i],point.x*k,point.y*k);
      });
    } else {
      const {point,style,font,labelOpacity}=letterAt(Math.PI/4);
      if(scene.sphereVisible(point,font*chars.length)) {
        const origin=scene.project({x:0,y:0,z:0});
        const right=point.screenX!>=origin.screenX!,below=point.screenY!>=origin.screenY!;
        ctx.textAlign=right?'left':'right';ctx.font=`500 ${font}px ${SCENE_FONT_FAMILY}`;
        ctx.globalAlpha=textOpacity*style.alpha*labelOpacity;
        ctx.fillText(region.label,point.x*k+(right?font:-font)*.6,point.y*k+(below?font:-font)*.7);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
