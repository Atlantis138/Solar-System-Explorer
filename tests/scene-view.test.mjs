import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { createSceneView } = await importTs(new URL('../core/sceneView.ts', import.meta.url));
const { createSkyProjection } = await importTs(new URL('../core/celestial.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const { orbitSegmentStyle } = await importTs(new URL('../core/orbitDrawing.ts', import.meta.url));
const options = {scale:23500,settings:{...SYSTEM_DEFAULTS,trueScale:true,enablePerspective:true,enableProximitySim:true,viewTilt:90,viewYaw:0},zoom:{x:640,y:400,k:.08},width:1280,height:800,center:{x:0,y:0,z:0}};

test('pan translates the observer; distance, perspective and the screen share the same origin', () => {
  const view=createSceneView(options), pan=createSceneView({...options,zoom:{...options.zoom,x:-1240}});
  assert.ok(Math.abs(pan.cameraPosition.x-view.cameraPosition.x-1)<1e-12);
  const point={x:1,y:0,z:.1};
  const p=pan.project(point);
  assert.ok(Math.abs(p.screenX-640)<1e-10);
  assert.ok(Math.abs(p.distanceAU-Math.hypot(point.x-pan.cameraPosition.x,point.y-pan.cameraPosition.y,point.z-pan.cameraPosition.z))<1e-12);
  assert.ok(view.project(point).screenX>1280);
});

test('world units and camera pose match through true/schematic mode switches', () => {
  const a=createSceneView(options),b=createSceneView({...options,scale:65,zoom:{...options.zoom,k:options.zoom.k*23500/65}});
  const p={x:.1,y:.2,z:.02};
  assert.deepEqual(a.cameraPosition,b.cameraPosition);
  assert.ok(Math.abs(a.project(p).screenX-b.project(p).screenX)<1e-10);
  assert.ok(Math.abs(a.project(p).distanceAU-b.project(p).distanceAU)<1e-12);
});

test('finite scene converges to sky projection at infinity in all camera orientations', () => {
  for(const tilt of [-70,7,90]) for(const yaw of [0,45,284]) {
    const settings={...options.settings,viewTilt:tilt,viewYaw:yaw};
    const view=createSceneView({...options,settings}), sky=createSkyProjection(1280,800,tilt,yaw);
    const t=tilt*Math.PI/180,y=yaw*Math.PI/180;
    const direction={x:Math.sin(y)*Math.cos(t)+.1*Math.cos(y),y:Math.cos(y)*Math.cos(t)-.1*Math.sin(y),z:-Math.sin(t)};
    const p=view.project({x:direction.x*1e9,y:direction.y*1e9,z:direction.z*1e9}),s=sky(direction);
    assert.ok(Math.abs(p.screenX-s.x)<1e-5 && Math.abs(p.screenY-s.y)<1e-5);
  }
});

test('segments are clipped before division, including offscreen endpoints and camera-plane crossings', () => {
  const view=createSceneView(options);
  const across=view.clipSegment({x:-10,y:0,z:1},{x:10,y:0,z:1});
  assert.ok(across);assert.ok(across[0].screenX>=-4.001 && across[1].screenX<=1284.001);
  const near=view.clipSegment({x:0,y:0,z:-1},{x:.2,y:0,z:1});
  assert.ok(near);assert.ok(near.every(p=>p.isVisible && Number.isFinite(p.screenX) && p.screenX>=-4.001 && p.screenX<=1284.001));
  assert.equal(view.clipSegment({x:1,y:1,z:-2},{x:2,y:2,z:-1}),null);
  assert.equal(view.clipSegment({x:NaN,y:0,z:0},{x:0,y:0,z:1}),null);
});

test('local orbital guides remain readable while distant planetary tracks fade without an alpha floor', () => {
  const scene=createSceneView({...options,zoom:{...options.zoom,k:8.7},center:{x:1,y:0,z:0}});
  const view={zoom:8.7,perspective:true,tilt:7,intensity:1,trueScale:true,scale:23500,scene};
  const local=orbitSegmentStyle(0,view,false,.004,true),remote=orbitSegmentStyle(0,view,false,.5);
  assert.ok(local.alpha>.1);
  assert.ok(remote.alpha<.00001);
  assert.ok(local.width<3);
});

test('orthographic and perspective retain local guides and always dolly at close magnification', () => {
  for (const perspective of [false,true]) {
    const scene=createSceneView({...options,settings:{...options.settings,enablePerspective:perspective,enableProximitySim:false},zoom:{...options.zoom,k:8.7},center:{x:1,y:0,z:0}});
    const p=scene.project({x:1.001,y:0,z:0});
    assert.ok(p.distanceAU>0 && p.distanceAU<.01);
    assert.ok(p.contextDistanceAU<.01);
    const style=orbitSegmentStyle(0,{zoom:8.7,perspective,tilt:7,intensity:1,trueScale:true,scale:23500,scene},false,p.distanceAU,true,p.contextDistanceAU);
    assert.ok(style.alpha>.1);
  }
});

test('a nearby satellite system remains resolved with its barycentre behind the observer', () => {
 const scene=createSceneView({...options,settings:{...options.settings,viewTilt:0},zoom:{...options.zoom,k:1000}});
 const center={x:0,y:-.002,z:0};
 assert.equal(scene.project(center).isVisible,false);
 assert.equal(scene.projectedSystemOpacity(center,.003),1);
 assert.equal(scene.projectedSystemOpacity({x:0,y:-10,z:0},.001),0);
});

// Compare rendered screen-space strokes, not merely the stored orbit zoom.
const {targetOrbitPose}=await importTs(new URL('../core/cameraNavigation.ts',import.meta.url));
const {drawOrbitPaths}=await importTs(new URL('../core/orbitDrawing.ts',import.meta.url));
function trackStrokes(scene,settings,center) {
  const strokes=[];
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(x,y){this.start=[x*scene.zoom,y*scene.zoom];},lineTo(x,y){this.end=[x*scene.zoom,y*scene.zoom];},stroke(){strokes.push({start:this.start,end:this.end,width:this.lineWidth*scene.zoom,alpha:this.globalAlpha});}};
  const points=Array.from({length:181},(_,i)=>{const a=i/180*Math.PI*2;return scene.project({x:center.x+Math.cos(a),y:center.y+Math.sin(a),z:center.z});});
  drawOrbitPaths(ctx,[{points,color:'#fff',opacity:1,emphasized:false}],{zoom:scene.zoom,perspective:true,tilt:settings.viewTilt,intensity:1,scale:scene.scale,trueScale:scene.trueScale,scene});
  return strokes;
}

test('same physical observer has identical orbit visibility and stroke style in flight and orbit', () => {
  for(const scale of [65,23500]) for(const [width,height] of [[1280,800],[390,844]]) for(const strength of [.2,1]) for(const fov of [30,72,100]) for(const radius of [10,30,60,120]) {
    const center={x:2,y:3,z:1},eye={x:2+radius*.3,y:3-radius*.4,z:1+radius*Math.sqrt(.75)};
    const initial={...SYSTEM_DEFAULTS,enablePerspective:true,trueScale:scale===23500,cameraPerspective:strength,cameraFov:fov};
    const pose=targetOrbitPose(eye,center,initial,scale,width,height),settings={...initial,...pose,viewRoll:24};
    const base={scale,width,height,settings,center};
    const flight=createSceneView({...base,observer:eye,zoom:{x:width/2,y:height/2,k:.8}});
    const orbit=createSceneView({...base,zoom:{x:width/2,y:height/2,k:pose.zoom}});
    assert.ok(Math.abs(flight.rangeOpacity(radius)-orbit.rangeOpacity(radius))<1e-10);
    if(strength===1&&fov===72)assert.ok(flight.rangeOpacity(radius)>.9);
    const a=trackStrokes(flight,settings,center),b=trackStrokes(orbit,settings,center);
    if(strength===1&&fov===72)assert.ok(a.length>0);
    assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++) {
      assert.ok(Math.abs(a[i].alpha-b[i].alpha)<1e-9);
      assert.ok(Math.abs(a[i].width-b[i].width)<1e-9);
      // Projected x/y are relative to zoom translation; compare segment lengths.
      assert.ok(Math.abs(Math.hypot(a[i].end[0]-a[i].start[0],a[i].end[1]-a[i].start[1])-Math.hypot(b[i].end[0]-b[i].start[0],b[i].end[1]-b[i].start[1]))<1e-7);
    }
  }
});

const {drawRegionBoundaries}=await importTs(new URL('../core/regionDrawing.ts',import.meta.url));
const {drawAsteroidBelt}=await importTs(new URL('../core/asteroidBelt.ts',import.meta.url));
test('regional guides and asteroid point styles share the physical scale after a backed-away return', () => {
  const center={x:0,y:0,z:0},eye={x:0,y:0,z:70},settings={...SYSTEM_DEFAULTS,enablePerspective:true,viewTilt:90,viewYaw:0};
  const pose=targetOrbitPose(eye,center,settings,65,1280,800);
  const base={scale:65,width:1280,height:800,settings,center};
  const views=[createSceneView({...base,observer:eye,zoom:{x:640,y:400,k:.8}}),createSceneView({...base,zoom:{x:640,y:400,k:pose.zoom}})];
  const record=(scene,regions)=>{
    const strokes=[],letters=[],particles=[];
    const ctx={save(){},restore(){},scale(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes.push({width:this.lineWidth*scene.zoom,alpha:this.globalAlpha})},fillText(text,x,y){letters.push({text,font:this.font,alpha:this.globalAlpha,x,y})},arc(x,y,r){particles.push({x,y,r})},fill(){}};
    if(regions)drawRegionBoundaries(ctx,scene);
    else drawAsteroidBelt(ctx,1280,800,65,settings,{x:640,y:400,k:scene.zoom},center,new Date('2026-10-08T00:00:00Z'),.6,scene);
    return [...strokes,...letters,...particles];
  };
  for(const regions of [true,false]) {
    const a=record(views[0],regions),b=record(views[1],regions);
    assert.ok(a.length>0);assert.equal(a.length,b.length);
    for(let i=0;i<a.length;i++)for(const key of Object.keys(a[i])) {
      if(typeof a[i][key]==='number')assert.ok(Math.abs(a[i][key]-b[i][key])<1e-8);
      else assert.equal(a[i][key],b[i][key]);
    }
  }
});
