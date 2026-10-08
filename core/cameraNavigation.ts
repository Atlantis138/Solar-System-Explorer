import type { AppSettings, Position } from '../types';
import { cameraBasis, cameraFocalPixels, cameraFov, perspectiveStrength } from './cameraOptics';

import { LIGHT_YEAR_AU, solarDistanceBlend } from './nearbyStars';

/** Automatic cruise rate in AU/s. Local proximity keeps planetary and moon
 * approaches usable; the same solar-distance blend as the star field raises
 * the rate for interstellar travel. Lens, zoom and device size never enter it. */
export function travelContextDistance(eye:Position, anchors:readonly Position[]=[]) {
  let nearest=Math.hypot(eye.x,eye.y,eye.z);
  for(const p of anchors) {
    const d=Math.hypot(eye.x-p.x,eye.y-p.y,eye.z-p.z);
    if(Number.isFinite(d))nearest=Math.min(nearest,d);
  }
  return nearest;
}
export function automaticTravelSpeed(eye:Position, anchors:readonly Position[]=[]) {
  const solarDistance=Math.hypot(eye.x,eye.y,eye.z);
  const nearest=travelContextDistance(eye,anchors);
  const blend=solarDistanceBlend(solarDistance);
  const solarRate=Math.max(1e-7,nearest*.4);
  const stellarRate=Math.max(1e-7,nearest*.8);
  return Math.max(1e-7,Math.min(20*LIGHT_YEAR_AU,Math.exp(Math.log(solarRate)*(1-blend)+Math.log(stellarRate)*blend)));
}
export const sceneDragPans=(button:number,pointerType:string)=>pointerType==='touch'||button!==2;

/** Normalize mouse wheels and trackpads; cap unusually large individual events. */
export function wheelPixels(delta: number, mode: number, shortAxis: number) {
  return Math.max(-240, Math.min(240, delta * (mode === 1 ? 16 : mode === 2 ? shortAxis : 1)));
}

export const travelMultiplier=(value=1)=>Math.max(.05,Math.min(100,Number.isFinite(value)?value:1));
export const multiplierSliderValue=(value:number)=>Math.log(travelMultiplier(value)/.05)/Math.log(2000);
export const multiplierFromSlider=(value:number)=>.05*Math.pow(2000,Math.max(0,Math.min(1,value)));

/** A baseline gesture advances along the view direction without changing speed
 * or lens. Spreading fingers matches orbit approach; closing them retreats. */
export function pinchTravelDelta(distance:number,ratio:number) {
  if(!(ratio>0)||!Number.isFinite(ratio))return 0;
  return Math.max(1e-7,distance)*(1-1/Math.max(.1,Math.min(10,ratio)));
}

/** Restore the real orbit target. Radius is measured from the observer, never
 * inherited from the zoom saved before flight. Looking home preserves position. */
export function targetOrbitPose(eye:Position, center:Position, settings:AppSettings,
  scale:number, width:number, height:number) {
  const delta={x:eye.x-center.x,y:eye.y-center.y,z:eye.z-center.z};
  const measured=Math.hypot(delta.x,delta.y,delta.z);
  const distance=Math.max(1e-10,measured);
  const back=measured>1e-10 ? {x:delta.x/distance,y:delta.y/distance,z:delta.z/distance}
    : cameraBasis(settings.viewTilt,settings.viewYaw,settings.viewRoll??0).back;
  const viewTilt=Math.asin(Math.max(-1,Math.min(1,back.z)))*180/Math.PI;
  const viewYaw=Math.hypot(back.x,back.y)>1e-8
    ? (Math.atan2(-back.x,-back.y)*180/Math.PI+360)%360 : settings.viewYaw;
  const focal=cameraFocalPixels(width,height,cameraFov(settings))/(perspectiveStrength(settings)||1);
  return {viewTilt,viewYaw,viewRoll:0,distance,zoom:focal/(scale*distance)};
}

/** Keep an offset composition when the original target is in front. Orbiting
 * rotates the whole observer-to-target vector; the real target stays the pivot.
 * Look home only when the target is behind or too close to the camera plane. */
export function framedOrbitPose(eye:Position, center:Position, settings:AppSettings,
  scale:number, width:number, height:number) {
  const delta={x:eye.x-center.x,y:eye.y-center.y,z:eye.z-center.z};
  const basis=cameraBasis(settings.viewTilt,settings.viewYaw,settings.viewRoll??0);
  const dot=(a:Position,b:Position)=>a.x*b.x+a.y*b.y+a.z*b.z;
  const distance=dot(delta,basis.back),radius=Math.hypot(delta.x,delta.y,delta.z);
  if(distance<=Math.max(1e-10,radius*.05)) {
    return {...targetOrbitPose(eye,center,settings,scale,width,height),x:width/2,y:height/2};
  }
  const focal=cameraFocalPixels(width,height,cameraFov(settings))/(perspectiveStrength(settings)||1);
  const zoom=focal/(scale*distance);
  return {viewTilt:settings.viewTilt,viewYaw:settings.viewYaw,viewRoll:settings.viewRoll??0,
    distance,zoom,x:width/2-dot(delta,basis.right)*scale*zoom,y:height/2-dot(delta,basis.down)*scale*zoom};
}
export const dragDegreesPerPixel = (settings: AppSettings, shortAxis: number) => cameraFov(settings) / Math.max(1, shortAxis);

/** Evaluate a whole two-finger gesture from its baseline, not sequential deltas. */
export function orbitGestureTransform(zoom:{x:number;y:number;k:number}, width:number, height:number,
  ratio:number, dx:number, dy:number, extent:[number,number]) {
  const k=Math.max(Math.min(extent[0],zoom.k),Math.min(Math.max(extent[1],zoom.k),zoom.k*ratio));
  return {k,x:zoom.x+dx,y:zoom.y+dy};
}
