import type { AppSettings, Position } from '../types';

/** FOV is measured on the short axis, so portrait never becomes a narrow tunnel. */
export const cameraFov = (settings: AppSettings) => Math.max(30, Math.min(100, settings.cameraFov ?? 72));
export const perspectiveStrength = (settings: AppSettings) => settings.enablePerspective
  ? Math.max(.01, Math.min(1, settings.cameraPerspective ?? 1)) : 0;
export const cameraFocalPixels = (width: number, height: number, fov = 72) =>
  Math.min(width, height) / (2 * Math.tan(Math.max(30, Math.min(100, fov)) * Math.PI / 360));
export function cameraBasis(tiltDegrees: number, yawDegrees: number, rollDegrees = 0) {
  const tilt = tiltDegrees * Math.PI / 180, yaw = yawDegrees * Math.PI / 180, roll = rollDegrees * Math.PI / 180;
  const st = Math.sin(tilt), ct = Math.cos(tilt), sy = Math.sin(yaw), cy = Math.cos(yaw), cr=Math.cos(roll), sr=Math.sin(roll);
  const right = { x: cy, y: -sy, z: 0 }, down = { x: -sy*st, y: -cy*st, z: -ct };
  return { right: {x:right.x*cr+down.x*sr,y:right.y*cr+down.y*sr,z:down.z*sr},
    down: {x:down.x*cr-right.x*sr,y:down.y*cr-right.y*sr,z:down.z*cr},
    back: { x: -sy*ct, y: -cy*ct, z: st } };
}
export function moveObserver(eye: Position, tilt: number, yaw: number, right: number, down: number, back: number, roll=0): Position {
  const b = cameraBasis(tilt,yaw,roll);
  return { x: eye.x+b.right.x*right+b.down.x*down+b.back.x*back,
    y: eye.y+b.right.y*right+b.down.y*down+b.back.y*back,
    z: eye.z+b.right.z*right+b.down.z*down+b.back.z*back };
}
const dot=(a:Position,b:Position)=>a.x*b.x+a.y*b.y+a.z*b.z;
const turn=(v:Position,axis:Position,degrees:number):Position=>{
  const a=degrees*Math.PI/180,c=Math.cos(a),s=Math.sin(a),d=dot(axis,v)*(1-c);
  return {x:v.x*c+(axis.y*v.z-axis.z*v.y)*s+axis.x*d,
    y:v.y*c+(axis.z*v.x-axis.x*v.z)*s+axis.y*d,
    z:v.z*c+(axis.x*v.y-axis.y*v.x)*s+axis.z*d};
};
/** Rotate about the observer's local axes, including through either pole. */
export function rotateCameraLocal(tilt:number,yaw:number,roll:number,deltaYaw:number,deltaPitch:number,deltaRoll=0) {
  let b=cameraBasis(tilt,yaw,roll);
  const rotate=(axis:Position,angle:number)=>{b={right:turn(b.right,axis,angle),down:turn(b.down,axis,angle),back:turn(b.back,axis,angle)};};
  rotate(b.down,deltaYaw);rotate(b.right,-deltaPitch);rotate(b.back,-deltaRoll);
  const viewTilt=Math.asin(Math.max(-1,Math.min(1,b.back.z)))*180/Math.PI;
  const viewYaw=Math.hypot(b.back.x,b.back.y)>1e-8 ? (Math.atan2(-b.back.x,-b.back.y)*180/Math.PI+360)%360 : yaw;
  const base=cameraBasis(viewTilt,viewYaw);
  const viewRoll=Math.atan2(dot(b.right,base.down),dot(b.right,base.right))*180/Math.PI;
  return {viewTilt,viewYaw,viewRoll};
}

/** One reset sequence in either navigation mode: look at the Sun, then overhead.
 * Looking at the Sun preserves the observer; overhead preserves Sun distance. */
export function solarResetPose(eye:Position, tilt:number, yaw:number, roll=0, fallbackDistance=1) {
  const distance=Math.hypot(eye.x,eye.y,eye.z);
  const d=distance>1e-12?distance:Math.max(1e-6,fallbackDistance);
  const b=cameraBasis(tilt,yaw,roll).back;
  const centered=distance<1e-12 || dot(eye,b)/d>Math.cos(.05*Math.PI/180);
  const viewTilt=centered?90:Math.asin(Math.max(-1,Math.min(1,eye.z/d)))*180/Math.PI;
  const viewYaw=centered||Math.hypot(eye.x,eye.y)<d*1e-8?yaw:(Math.atan2(-eye.x,-eye.y)*180/Math.PI+360)%360;
  return {viewTilt,viewYaw,viewRoll:0,distance:d,overhead:centered,
    eye:centered?{x:0,y:0,z:d}:{...eye}};
}
