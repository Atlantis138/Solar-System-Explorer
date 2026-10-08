import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { targetOrbitPose, orbitGestureTransform, pinchTravelDelta, travelMultiplier, multiplierSliderValue, multiplierFromSlider, framedOrbitPose, automaticTravelSpeed, sceneDragPans, wheelPixels } = await importTs(new URL('../core/cameraNavigation.ts', import.meta.url));
const { createSceneView } = await importTs(new URL('../core/sceneView.ts', import.meta.url));
const { moveObserver, rotateCameraLocal } = await importTs(new URL('../core/cameraOptics.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);

test('returning from flight restores the real target and measures radius from the current eye', () => {
  for(const perspective of [false,true]) for(const strength of [.2,1]) for(const scale of [65,23500]) {
    const settings={...SYSTEM_DEFAULTS,enablePerspective:perspective,cameraPerspective:strength,viewTilt:31,viewYaw:128,viewRoll:42};
    const center={x:4,y:8,z:2};
    for(const delta of [{x:0,y:0,z:60},{x:15,y:-40,z:6},{x:0,y:0,z:-10}]) {
      const eye={x:center.x+delta.x,y:center.y+delta.y,z:center.z+delta.z};
      const pose=targetOrbitPose(eye,center,settings,scale,390,844);
      const returned=createSceneView({scale,width:390,height:844,center,settings:{...settings,...pose},zoom:{x:195,y:422,k:pose.zoom}});
      assert.ok(distance(eye,returned.cameraPosition)<1e-9);
      assert.ok(Math.abs(pose.distance-distance(eye,center))<1e-10);
      const target=returned.project(center);
      assert.ok(Math.hypot(target.screenX-195,target.screenY-422)<1e-8);
    }
    const pose=targetOrbitPose(center,center,settings,scale,390,844);
    assert.ok([pose.zoom,pose.viewTilt,pose.viewYaw,pose.distance].every(Number.isFinite));
  }
});

test('600 flight, lens and orbit rebuilds retain the real target and never reuse a stale radius', () => {
  let settings={...SYSTEM_DEFAULTS,enablePerspective:true,viewTilt:65,viewYaw:18};
  const center={x:0,y:0,z:0},options={scale:65,width:1000,height:700,center};
  let zoom={x:500,y:350,k:.8},scene=createSceneView({...options,settings,zoom}),eye=scene.cameraPosition;
  for(let i=0;i<600;i++) {
    settings={...settings,...rotateCameraLocal(settings.viewTilt,settings.viewYaw,settings.viewRoll??0,.7,.3),cameraFov:i%2?70:72};
    eye=moveObserver(eye,settings.viewTilt,settings.viewYaw,.01,-.004,.02,settings.viewRoll);
    const pose=targetOrbitPose(eye,center,settings,65,1000,700);
    settings={...settings,viewTilt:pose.viewTilt,viewYaw:pose.viewYaw,viewRoll:pose.viewRoll};
    zoom={...zoom,k:pose.zoom};scene=createSceneView({...options,settings,zoom});
    assert.ok(distance(eye,scene.cameraPosition)<1e-9);
    assert.ok(Math.abs(scene.focusDistanceAU-distance(eye,center))<1e-9);
    assert.ok(Math.hypot(scene.project(center).screenX-500,scene.project(center).screenY-350)<1e-8);
    assert.ok(Math.abs(automaticTravelSpeed(eye)-automaticTravelSpeed(scene.cameraPosition))<1e-9);
    eye=scene.cameraPosition;
  }
});

test('backing away then orbit zooming can approach the Sun and retreat symmetrically', () => {
  const center={x:0,y:0,z:0},eye={x:0,y:0,z:60};
  const settings={...SYSTEM_DEFAULTS,enablePerspective:true,viewTilt:90,viewYaw:0};
  const pose=targetOrbitPose(eye,center,settings,65,1280,800);
  for(const factor of [.1,1,10,100]) {
    const zoom=orbitGestureTransform({x:640,y:400,k:pose.zoom},1280,800,factor,0,0,[1e-7,100]);
    const scene=createSceneView({settings:{...settings,...pose},scale:65,width:1280,height:800,center,zoom});
    assert.ok(Math.abs(distance(scene.cameraPosition,center)-60/factor)<1e-8);
  }
  // An eye beyond ordinary orbit limits must not jump on the first scroll.
  for(const k of [1e-9,1e7]) {
    const ratio=k<1?1.2:1/1.2;
    const zoom=orbitGestureTransform({x:640,y:400,k},1280,800,ratio,0,0,[1e-7,100]);
    assert.ok(Math.abs(zoom.k/k-ratio)<1e-10);
  }
});

test('pinch travel is reversible from its baseline, and wheel multipliers are bounded', () => {
  const forward=pinchTravelDelta(60,1.5);
  assert.ok(Math.abs(forward-20)<1e-10);
  assert.ok(Math.abs(pinchTravelDelta(60-forward,1/1.5)+forward)<1e-10);
  assert.equal(pinchTravelDelta(60,1),0);assert.equal(pinchTravelDelta(60,NaN),0);
  assert.equal(travelMultiplier(Infinity),1);assert.equal(travelMultiplier(1e6),100);assert.equal(travelMultiplier(0),.05);
  for(const multiplier of [.05,1,5,100])assert.ok(Math.abs(multiplierFromSlider(multiplierSliderValue(multiplier))/multiplier-1)<1e-10);
  assert.equal(wheelPixels(3,1,390),48);assert.equal(wheelPixels(48,0,390),48);assert.equal(wheelPixels(5,2,390),240);
});

test('two-finger zoom and pan use one baseline so sequential finger events cannot accumulate drift', () => {
  const base={x:195,y:422,k:.8};
  const extent=[1e-7,100];
  // First finger moves, then the second catches up: final midpoint is unchanged.
  orbitGestureTransform(base,390,844,1.25,-15,0,extent);
  const final=orbitGestureTransform(base,390,844,1.5,0,0,extent);
  assert.equal(final.x,base.x);assert.equal(final.y,base.y);
  assert.ok(Math.abs(final.k-1.2)<1e-12);
  assert.deepEqual(orbitGestureTransform(base,390,844,1,0,0,extent),base);
  const pan=orbitGestureTransform(base,390,844,1,30,-10,extent);
  assert.deepEqual(pan,{x:225,y:412,k:.8});
  assert.equal(orbitGestureTransform(base,390,844,1e20,0,0,extent).k,100);
});

const {LIGHT_YEAR_AU,solarDistanceBlend,nearbyOpacity}=await importTs(new URL('../core/nearbyStars.ts',import.meta.url));
test('automatic cruise speed varies continuously through solar and stellar space and slows locally', () => {
  let last=0;
  for(let i=0;i<1000;i++) {
    const radius=Math.exp(Math.log(.00001)+(Math.log(100*LIGHT_YEAR_AU)-Math.log(.00001))*i/999);
    const speed=automaticTravelSpeed({x:0,y:0,z:radius});
    assert.ok(Number.isFinite(speed)&&speed>=last);last=speed;
  }
  for(const boundary of [.03,.5]) {
    const a=automaticTravelSpeed({x:0,y:0,z:boundary*LIGHT_YEAR_AU*(1-1e-6)}),b=automaticTravelSpeed({x:0,y:0,z:boundary*LIGHT_YEAR_AU*(1+1e-6)});
    assert.ok(Math.abs(b/a-1)<1e-5);
  }
  const earth={x:1,y:0,z:0};
  assert.ok(automaticTravelSpeed({x:1,y:0,z:.0001},[earth])<automaticTravelSpeed({x:1,y:0,z:.01},[earth])/50);
  assert.ok(automaticTravelSpeed({x:4*LIGHT_YEAR_AU,y:0,z:1},[{x:4*LIGHT_YEAR_AU,y:0,z:0}])<1);
  assert.equal(automaticTravelSpeed({x:0,y:0,z:0}),1e-7);
  assert.equal(automaticTravelSpeed({x:1e12,y:0,z:0}),20*LIGHT_YEAR_AU);
  for(const d of [10,.1*LIGHT_YEAR_AU,LIGHT_YEAR_AU])for(const k of [1e-7,.8,100]) {
    assert.equal(nearbyOpacity({...SYSTEM_DEFAULTS,trueScale:false,showNearbyStars:true},k,1000,700,d,true),solarDistanceBlend(d));
  }
});

test('left mouse and scene touch pan; only right mouse dragging turns',()=>{
  for(const type of ['mouse','pen','touch'])assert.equal(sceneDragPans(0,type),true);
  assert.equal(sceneDragPans(1,'mouse'),true);assert.equal(sceneDragPans(2,'mouse'),false);
});

test('off-centre orbit target survives entering and returning from flight with the entire framing',()=>{
  for(const scale of [65,23500])for(const [width,height] of [[1280,800],[390,844]])for(const strength of [.2,1]) {
    const settings={...SYSTEM_DEFAULTS,enablePerspective:true,cameraPerspective:strength,viewTilt:31,viewYaw:128,viewRoll:42};
    const center={x:4,y:8,z:2},zoom={x:width*.35,y:height*.62,k:.8*65/scale};
    const original=createSceneView({scale,width,height,settings,center,zoom});
    const eye=moveObserver(original.cameraPosition,settings.viewTilt,settings.viewYaw,.02,-.03,.1,settings.viewRoll);
    const flight=createSceneView({scale,width,height,settings,center,zoom:{...zoom,x:width/2,y:height/2},observer:eye});
    const pose=framedOrbitPose(eye,center,settings,scale,width,height);
    const orbit=createSceneView({scale,width,height,settings:{...settings,...pose},center,zoom:{x:pose.x,y:pose.y,k:pose.zoom}});
    assert.ok(distance(eye,orbit.cameraPosition)<1e-9);
    assert.equal(pose.viewTilt,settings.viewTilt);assert.equal(pose.viewYaw,settings.viewYaw);assert.equal(pose.viewRoll,settings.viewRoll);
    for(const p of [center,{x:0,y:0,z:0},{x:1,y:-2,z:3}]) {
      const a=flight.project(p),b=orbit.project(p);
      assert.ok(Math.hypot(a.screenX-b.screenX,a.screenY-b.screenY)<1e-7);
    }
    const back=framedOrbitPose(eye,center,{...settings,...rotateCameraLocal(settings.viewTilt,settings.viewYaw,settings.viewRoll,180,0)},scale,width,height);
    assert.ok(Math.abs(back.x-width/2)<1e-10&&Math.abs(back.y-height/2)<1e-10);
  }
});

test('offset framing retains a real orbit sphere and bidirectional target approach',()=>{
  const settings={...SYSTEM_DEFAULTS,enablePerspective:true,viewTilt:61,viewYaw:47,viewRoll:28};
  const center={x:0,y:0,z:0},zoom={x:330,y:420,k:.1};
  const options={scale:65,width:1000,height:700,settings,center};
  const base=createSceneView({...options,zoom});
  for(const ratio of [.1,1,10,100]) {
    const transform=orbitGestureTransform(zoom,1000,700,ratio,0,0,[1e-7,100]);
    const view=createSceneView({...options,zoom:transform});
    assert.ok(Math.abs(distance(view.cameraPosition,center)*ratio-distance(base.cameraPosition,center))<1e-7);
    assert.ok(Math.abs(view.project(center).screenX-zoom.x)<1e-8&&Math.abs(view.project(center).screenY-zoom.y)<1e-8);
    const turn=createSceneView({...options,zoom:transform,settings:{...settings,...rotateCameraLocal(settings.viewTilt,settings.viewYaw,settings.viewRoll,20,10)}});
    assert.ok(distance(turn.cameraPosition,view.cameraPosition)>.01);
    assert.ok(Math.abs(distance(turn.cameraPosition,center)-distance(view.cameraPosition,center))<1e-7);
  }
});
