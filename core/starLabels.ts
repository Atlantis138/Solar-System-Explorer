import type { RealStar, RenderQuality } from '../types';
export function starLabelBudget(width:number,height:number,quality:RenderQuality='standard',density=1) {
  const base=Math.max(3,Math.min(quality==='eco'?10:quality==='performance'?30:20,Math.floor(width*height/65000)));
  return Math.max(0,Math.min(90,Math.round(base*Math.max(0,Math.min(3,density)))));
}
// The viewport edge must not lower a star's priority or its text brightness.
export const labelPriority=(_x:number,_y:number,_width:number,_height:number,magnitude:number)=>magnitude;
export function skyStarName(star:Pick<RealStar,'id'|'name'|'englishName'>,bilingual=false) {
  const proper=bilingual?[...new Set([star.name,star.englishName].filter(Boolean))].join(' '):star.name||star.englishName;
  return proper||(/^hip[_ -]?(\d+)$/i.test(star.id)?`HIP ${star.id.match(/\d+/)![0]}`:star.id);
}
export interface LabelBox { x:number;y:number;w:number;h:number }
export interface StarLabel { id:string;x:number;y:number;radius:number;text:string;priority:number }
export interface PlacedStarLabel extends StarLabel { box:LabelBox;alpha:number }
/** Clamp text, not its anchor. A visible star keeps a complete, readable label at every edge. */
export function starLabelBox(star:Pick<StarLabel,'x'|'y'|'radius'>,textWidth:number,width:number,height:number):LabelBox {
  const w=Math.min(Math.max(1,width-8),textWidth+6),h=18;
  return {x:Math.max(4,Math.min(width-w-4,star.x+star.radius+5)),
    y:Math.max(4,Math.min(height-h-4,star.y-h/2)),w,h};
}
const overlaps=(a:LabelBox,b:LabelBox,gap=0)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
/** Retain labels while they remain usable. New labels fill vacancies; they never
 * evict a visible label merely because brightness rankings or screen bins changed. */
export class StableStarLabels {
  private entries=new Map<string,{alpha:number;shown:boolean}>();
  private lastTime:number|undefined;
  layout(candidates:StarLabel[],width:number,height:number,budget:number,measure:(text:string)=>number,
    reserved:LabelBox[]=[],now=performance.now()) {
    const dt=this.lastTime===undefined?16:Math.max(0,Math.min(40,now-this.lastTime));this.lastTime=now;
    const available=new Map(candidates.filter(p=>p.x>=0&&p.x<=width&&p.y>=0&&p.y<=height).map(p=>[p.id,p]));
    const boxes=new Map<string,LabelBox>();
    const box=(p:StarLabel)=>{let b=boxes.get(p.id);if(!b){b=starLabelBox(p,measure(p.text),width,height);boxes.set(p.id,b);}return b;};
    const occupied=[...reserved],sectors=new Map<number,number>();
    const sector=(p:StarLabel)=>Math.min(2,Math.floor(p.x/Math.max(1,width/3)))+3*Math.min(1,Math.floor(p.y/Math.max(1,height/2)));
    const occupy=(p:StarLabel)=>{occupied.push(box(p));const n=sector(p);sectors.set(n,(sectors.get(n)??0)+1);};
    let count=0;
    for(const [id,entry] of this.entries){
      const p=available.get(id);if(!p){this.entries.delete(id);continue;}
      entry.shown=entry.shown&&count<budget&&!occupied.some(b=>overlaps(box(p),b,-2));
      if(entry.shown){count++;occupy(p);}else if(entry.alpha>0)occupied.push(box(p));
    }
    const queues:StarLabel[][]=Array.from({length:6},()=>[]);
    for(const p of candidates)if(available.has(p.id)&&!this.entries.has(p.id))queues[sector(p)].push(p);
    for(const q of queues)q.sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
    const offsets=Array(6).fill(0);
    while(count<budget){
      let best=-1,score=Infinity;
      for(let i=0;i<6;i++){const p=queues[i][offsets[i]];if(!p)continue;const s=p.priority+(sectors.get(i)??0)*5;if(s<score){best=i;score=s;}}
      if(best<0)break;
      const p=queues[best][offsets[best]++];if(occupied.some(b=>overlaps(box(p),b,9)))continue;
      this.entries.set(p.id,{alpha:0,shown:true});count++;occupy(p);
    }
    const labels:PlacedStarLabel[]=[];let animating=false;
    for(const [id,entry] of this.entries){
      entry.alpha=Math.max(0,Math.min(1,entry.alpha+(entry.shown?1:-1)*dt/160));
      if(entry.alpha===0&&!entry.shown){this.entries.delete(id);animating=true;continue;}
      if(entry.alpha>0&&entry.alpha<1)animating=true;
      const p=available.get(id)!;labels.push({...p,box:box(p),alpha:entry.alpha});
    }
    return {labels,animating};
  }
}
