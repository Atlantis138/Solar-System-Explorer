import { smoothStep } from './math';

export const SCENE_FONT_FAMILY = '"Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif';
export type LabelRole = 'body' | 'region' | 'star' | 'grid' | 'constellation';
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** Screen pixels only. Never divide font sizes by world zoom: browsers cap large
 * internal fonts before SVG/Canvas transforms, breaking physical-scale views. */
export function sceneLabelStyle(role: LabelRole, extentPx = 0, priority = false) {
  switch (role) {
    case 'body': return { fontSize: priority ? 13 : 12, opacity: 1 };
    case 'region': return { fontSize: clamp(Math.sqrt(Math.max(0, extentPx)) * 1.6, 10, 22),
      opacity: smoothStep(30, 85, extentPx) };
    case 'constellation': return { fontSize: clamp(extentPx * .032, 22, 30), opacity: .16 };
    case 'grid': return { fontSize: 11, opacity: 1 };
    default: return { fontSize: 12, opacity: 1 };
  }
}

export interface BodyLabel {
  id: string; text: string; x: number; y: number; radius: number;
  opacity: number; color: string; priority: number; emphasized: boolean;
}
export interface LabelBox { x: number; y: number; w: number; h: number }
/** Always anchor names below their own body. Neighbours and viewport edges
 * never move a name or suppress it: the viewport itself clips overflow. */
export function layoutBodyLabels(labels: BodyLabel[], _width: number, _height: number) {
  return labels.filter(l=>l.opacity>=.03&&[l.x,l.y,l.radius].every(Number.isFinite)).map(label=>{
    const {fontSize}=sceneLabelStyle('body',0,label.emphasized);
    const w=[...label.text].reduce((n,c)=>n+(c.charCodeAt(0)>255?1:.65),0)*fontSize+6;
    const h=fontSize+6, y=label.y+Math.max(2,label.radius)+5;
    return {...label,x:label.x,y:y+h/2,fontSize,box:{x:label.x-w/2,y,w,h}};
  });
}
