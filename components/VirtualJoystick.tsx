import React, { useEffect, useRef, useState } from 'react';
import './camera-controls.css';

export interface NavigationInput { yaw:number; pitch:number; roll:number; right:number; down:number; forward:number }
interface Props {
  enabled:boolean;
  onInput:(input:NavigationInput)=>void;
  onReset:()=>void;
  onModeChange:()=>void;
  roaming:boolean;
}
const zero=():NavigationInput=>({yaw:0,pitch:0,roll:0,right:0,down:0,forward:0});
const motionCodes=['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyR','KeyF','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
/** Two independent touch pointers and one motion loop. Never runs while idle. */
export const VirtualJoystick:React.FC<Props>=props=>{
  const callbacks=useRef(props);callbacks.current=props;
  const keys=useRef(new Set<string>()),frame=useRef(0),smooth=useRef(zero());
  const pads=useRef({move:{x:0,y:0},look:{x:0,y:0}});
  const pointers=useRef(new Map<number,{kind:'move'|'look';x:number;y:number;element:HTMLElement}>());
  const [knobs,setKnobs]=useState({move:{x:0,y:0},look:{x:0,y:0}});
  const stop=()=>{keys.current.clear();pads.current={move:{x:0,y:0},look:{x:0,y:0}};
    for(const [id,p] of pointers.current)if(p.element.hasPointerCapture(id))p.element.releasePointerCapture(id);
    pointers.current.clear();smooth.current=zero();cancelAnimationFrame(frame.current);frame.current=0;setKnobs({move:{x:0,y:0},look:{x:0,y:0}});};
  const start=()=>{
    if(frame.current)return;
    let last=performance.now();
    const tick=(now:number)=>{
      const dt=Math.min(.04,(now-last)/1000);last=now;
      const k=keys.current,p=pads.current,axis=(a:string,b:string)=>(k.has(a)?1:0)-(k.has(b)?1:0);
      const target:NavigationInput={right:axis('KeyD','KeyA')+p.move.x,down:axis('KeyF','KeyR'),
        forward:axis('KeyW','KeyS')-p.move.y,yaw:axis('ArrowRight','ArrowLeft')+p.look.x,
        pitch:axis('ArrowDown','ArrowUp')+p.look.y,roll:axis('KeyE','KeyQ')};
      const len=Math.hypot(target.right,target.down,target.forward);if(len>1){target.right/=len;target.down/=len;target.forward/=len;}
      const result=zero();let active=false;
      for(const name of Object.keys(target) as (keyof NavigationInput)[]){
        const t=Math.max(-1,Math.min(1,target[name]));
        const value=t===0?0:smooth.current[name]+(t-smooth.current[name])*(1-Math.exp(-dt/.055));
        smooth.current[name]=value;result[name]=value*dt;active ||= value!==0 || t!==0;
      }
      result.yaw*=55;result.pitch*=55;result.roll*=55;
      if(active)callbacks.current.onInput(result);
      frame.current=active?requestAnimationFrame(tick):0;
    };
    frame.current=requestAnimationFrame(tick);
  };
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.defaultPrevented||e.isComposing||e.altKey||e.ctrlKey||e.metaKey||document.querySelector('[aria-modal=true]')||
        (e.target instanceof Element&&e.target.closest('input,textarea,select,[contenteditable=true],[data-panel-id]')))return;
      if(motionCodes.includes(e.code)){if(!callbacks.current.enabled&&['KeyW','KeyA','KeyS','KeyD','KeyR','KeyF'].includes(e.code))return;e.preventDefault();keys.current.add(e.code);start();}
      else if(!e.repeat&&e.code==='Home'){e.preventDefault();stop();callbacks.current.onReset();}
      else if(!e.repeat&&e.code==='KeyV'){e.preventDefault();stop();callbacks.current.onModeChange();}
    };
    const up=(e:KeyboardEvent)=>{keys.current.delete(e.code);};
    const visibility=()=>{if(document.hidden)stop();};
    const focus=(e:FocusEvent)=>{if(e.target instanceof Element&&e.target.closest('[data-panel-id],input,textarea,select,[aria-modal=true]'))stop();};
    window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',stop);
    document.addEventListener('visibilitychange',visibility);document.addEventListener('focusin',focus);window.addEventListener('navigation-stop',stop);
    return()=>{stop();window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',visibility);document.removeEventListener('focusin',focus);window.removeEventListener('navigation-stop',stop);};
  },[]);
  useEffect(()=>{if(!props.enabled)stop();},[props.enabled]);
  const end=(e:React.PointerEvent)=>{
    const p=pointers.current.get(e.pointerId);if(!p)return;pointers.current.delete(e.pointerId);
    pads.current[p.kind]={x:0,y:0};setKnobs(v=>({...v,[p.kind]:{x:0,y:0}}));
    if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const pad=(kind:'move'|'look')=><div className="camera-pad" role="group" aria-label={kind==='move'?'移动摇杆':'转向摇杆'}
    onPointerDown={e=>{if(e.button!==0||[...pointers.current.values()].some(p=>p.kind===kind))return;e.preventDefault();const r=e.currentTarget.getBoundingClientRect();pointers.current.set(e.pointerId,{kind,x:r.left+r.width/2,y:r.top+r.height/2,element:e.currentTarget});e.currentTarget.setPointerCapture(e.pointerId);}}
    onPointerMove={e=>{const p=pointers.current.get(e.pointerId);if(!p||p.kind!==kind)return;const dx=e.clientX-p.x,dy=e.clientY-p.y,len=Math.hypot(dx,dy),reach=26;
      const raw=Math.min(1,len/reach),m=raw<.08?0:Math.pow((raw-.08)/.92,1.3);
      pads.current[kind]={x:len?dx/len*m:0,y:len?dy/len*m:0};setKnobs(v=>({...v,[kind]:{x:len?dx/len*raw*reach:0,y:len?dy/len*raw*reach:0}}));start();}}
    onPointerUp={end} onPointerCancel={end} onLostPointerCapture={end}>
    <i style={{transform:`translate(calc(-50% + ${knobs[kind].x}px),calc(-50% + ${knobs[kind].y}px))`}}/>
  </div>;
  return <div data-scene-ui className="camera-navigation" aria-label="视角导航">
    {props.enabled&&props.roaming && <div className="camera-float camera-left">{pad('move')}</div>}
    <div className="camera-float camera-right">
      <div className="camera-actions">
        <button onClick={props.onModeChange} aria-label={props.roaming?'切换到环绕':'切换到漫游'} aria-pressed={props.roaming} title={`${props.roaming?'漫游：自由移动':'环绕：围绕目标'} · V`}><svg viewBox="0 0 24 24">{props.roaming?<><path d="m12 3 8 18-8-5-8 5 8-18Z"/><path d="M12 3v13"/></>:<><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="7" r="1.5" fill="currentColor" stroke="none"/></>}</svg></button>
        <button onClick={props.onReset} aria-label="视角归正" title="看向太阳，再次俯视 · Home"><svg viewBox="0 0 24 24"><path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5s8.268 2.943 9.542 7C20.268 16.057 16.477 19 12 19S3.732 16.057 2.458 12Z"/></svg></button>
      </div>
      {props.enabled&&pad('look')}
    </div>
  </div>;
};
