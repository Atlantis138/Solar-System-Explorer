import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const {createSceneView}=await importTs(new URL('../core/sceneView.ts',import.meta.url));
const {cameraFocalPixels,moveObserver}=await importTs(new URL('../core/cameraOptics.ts',import.meta.url));
const {SYSTEM_DEFAULTS}=await importTs(new URL('../data/default_settings.ts',import.meta.url));
const {spectralGroup,apparentStarMagnitude,projectNearbyStars,LIGHT_YEAR_AU}=await importTs(new URL('../core/nearbyStars.ts',import.meta.url));
const options={scale:65,width:1000,height:700,zoom:{x:500,y:350,k:.8},center:{x:0,y:0,z:0},settings:{...SYSTEM_DEFAULTS,enablePerspective:true,viewTilt:90,viewYaw:0}};

test('projection slider preserves focus plane and continuously approaches orthographic',()=>{
 const ortho=createSceneView({...options,settings:{...options.settings,enablePerspective:false}});
 const target={x:1,y:2,z:0},offPlane={x:1,y:2,z:2};
 const base=ortho.project(target);let last=Infinity;
 for(const blend of [1,.5,.1,.01]){
  const v=createSceneView({...options,settings:{...options.settings,cameraPerspective:blend}}),p=v.project(target);
  assert.ok(Math.abs(p.screenX-base.screenX)<1e-9&&Math.abs(p.screenY-base.screenY)<1e-9);
  const error=Math.abs(v.project(offPlane).screenX-ortho.project(offPlane).screenX);
  assert.ok(error<last);last=error;
  assert.ok(v.clipSegment(v.toCamera({x:-100,y:0,z:0}),v.toCamera({x:100,y:0,z:0})));
 }
});
test('FOV is shared on the short axis and fixed observer rotates in place',()=>{
 assert.equal(cameraFocalPixels(500,1000,60),cameraFocalPixels(1000,500,60));
 const observer={x:0,y:0,z:10};
 const narrow=createSceneView({...options,observer,settings:{...options.settings,cameraFov:30}});
 const wide=createSceneView({...options,observer,settings:{...options.settings,cameraFov:100}});
 assert.ok(narrow.project({x:1,y:0,z:0}).screenX>wide.project({x:1,y:0,z:0}).screenX);
 for(const yaw of [0,60,180])for(const tilt of [-60,0,90]){
  const scene=createSceneView({...options,observer,settings:{...options.settings,viewYaw:yaw,viewTilt:tilt}});
  assert.ok(Math.hypot(scene.cameraPosition.x-observer.x,scene.cameraPosition.y-observer.y,scene.cameraPosition.z-observer.z)<1e-10);
 }
});
test('FOV changes the whole scene without moving orbit or flight observers, including offset framing',()=>{
 for(const [width,height] of [[1000,700],[390,844]]) for(const strength of [.2,1]) {
  const base={...options,width,height,zoom:{x:width/2-90,y:height/2+40,k:.8},
    settings:{...options.settings,cameraPerspective:strength,viewTilt:37,viewYaw:61,viewRoll:23}};
  const initial=createSceneView(base),observer=initial.cameraPosition;
  const point={x:1,y:2,z:.5};
  const projections=[];
  for(const fov of [30,72,100]) {
   const orbit=createSceneView({...base,settings:{...base.settings,cameraFov:fov}});
   const flight=createSceneView({...base,settings:{...base.settings,cameraFov:fov},observer,
     zoom:{...base.zoom,x:width/2,y:height/2}});
   assert.deepEqual(orbit.cameraPosition,observer);
   const a=orbit.project(point),b=flight.project(point);
   assert.ok(Math.hypot(a.screenX-b.screenX,a.screenY-b.screenY)<1e-8);
   assert.ok(Math.abs(orbit.projectedRadius(.1,a)-flight.projectedRadius(.1,b))<1e-8);
   assert.ok(Math.abs(orbit.focusDistanceAU/orbit.worldUnitsPerPixel-cameraFocalPixels(width,height,fov)/strength)<1e-8);
   projections.push(Math.hypot(a.screenX-width/2,a.screenY-height/2));
  }
  assert.ok(projections[0]>projections[1]&&projections[1]>projections[2]);
 }
});
test('sideways travel creates more parallax for nearer stars; camera plane clips correctly',()=>{
 const observer={x:0,y:0,z:10},a=createSceneView({...options,observer}),b=createSceneView({...options,observer:moveObserver(observer,90,0,1,0,0)});
 const near={x:0,y:0,z:8},far={x:0,y:0,z:-10};
 assert.ok(Math.abs(a.project(near).screenX-b.project(near).screenX)>Math.abs(a.project(far).screenX-b.project(far).screenX)*9);
 assert.equal(a.project({x:0,y:0,z:11}).isVisible,false);
});
test('spectral classes preserve lowercase dwarf prefixes and white dwarfs',()=>{
 for(const [raw,group] of [['dM5','M'],['sdM3','M'],['G2V','G'],['DA2','白矮星'],['DC9','白矮星'],['m','M'],['','其他'],['B9V','O/B']])assert.equal(spectralGroup(raw),group);
 assert.ok(Math.abs(apparentStarMagnitude(5,32.61563777)-5)<1e-8);
 assert.ok(Math.abs(apparentStarMagnitude(5,3.261563777))<1e-8);
});
test('density decimates crowded stars but selected faint star survives and brightens nearby',()=>{
 const stars=Array.from({length:20},(_,i)=>({id:String(i),position:{x:i*.0001,y:0,z:0},absoluteMagnitude:i,magnitude:i,color:'#ffffff'}));
 const scene=createSceneView({...options,scale:1/LIGHT_YEAR_AU,zoom:{x:500,y:350,k:20},observer:{x:0,y:0,z:10*LIGHT_YEAR_AU}});
 const all=projectNearbyStars(stars,scene),sparse=projectNearbyStars(stars,scene,{density:'sparse',selectedId:'19',magnitudeLimit:0});
 assert.ok(all.length>sparse.length);assert.ok(sparse.some(p=>p.star.id==='19'));
 const close=createSceneView({...options,scale:1/LIGHT_YEAR_AU,zoom:{x:500,y:350,k:20},observer:{x:0,y:0,z:LIGHT_YEAR_AU}});
 const a=projectNearbyStars([stars[10]],scene)[0],b=projectNearbyStars([stars[10]],close)[0];
 assert.ok(b.apparentMagnitude<a.apparentMagnitude&&b.radius>a.radius&&b.opacity>a.opacity);
});

const {cameraBasis,rotateCameraLocal}=await importTs(new URL('../core/cameraOptics.ts',import.meta.url));
const {createSkyProjection}=await importTs(new URL('../core/celestial.ts',import.meta.url));
const {ringHalves}=await importTs(new URL('../core/rings.ts',import.meta.url));
const {displayStarMagnitude}=await importTs(new URL('../core/nearbyStars.ts',import.meta.url));
const {skyStarName,starLabelBudget}=await importTs(new URL('../core/starLabels.ts',import.meta.url));
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
test('local camera turns cross both poles continuously and preserve an orthonormal basis',()=>{
 let pose={viewTilt:89,viewYaw:27,viewRoll:0},previous=cameraBasis(89,27);
 for(let i=0;i<800;i++){
  pose=rotateCameraLocal(pose.viewTilt,pose.viewYaw,pose.viewRoll,.3,1,.1);
  const b=cameraBasis(pose.viewTilt,pose.viewYaw,pose.viewRoll);
  assert.ok(dot(previous.back,b.back)>.999,'orientation must not flip when crossing a pole');
  for(const v of Object.values(b))assert.ok(Math.abs(dot(v,v)-1)<1e-10);
  assert.ok(Math.abs(dot(b.right,b.down))<1e-10);
  previous=b;
 }
 // Full pitch revolution returns to the initial view, including the bank.
 pose={viewTilt:35,viewYaw:68,viewRoll:23};const original=cameraBasis(35,68,23);
 for(let i=0;i<360;i++)pose=rotateCameraLocal(pose.viewTilt,pose.viewYaw,pose.viewRoll,0,1,0);
 const final=cameraBasis(pose.viewTilt,pose.viewYaw,pose.viewRoll);
 for(const key of ['right','down','back'])assert.ok(dot(original[key],final[key])>1-1e-10);
});
test('rolled celestial background, foreground and rings share one screen orientation',()=>{
 for(const roll of [-170,-90,0,40,90,175]){
  const settings={...options.settings,viewTilt:35,viewYaw:48,viewRoll:roll};
  const scene=createSceneView({...options,settings}),basis=cameraBasis(35,48,roll);
  const direction={x:-basis.back.x+basis.right.x*.2+basis.down.x*.1,y:-basis.back.y+basis.right.y*.2+basis.down.y*.1,z:-basis.back.z+basis.right.z*.2+basis.down.z*.1};
  const pos={x:scene.cameraPosition.x+direction.x*20,y:scene.cameraPosition.y+direction.y*20,z:scene.cameraPosition.z+direction.z*20};
  const a=scene.project(pos),b=createSkyProjection(1000,700,35,48,undefined,roll)(direction);
  assert.ok(Math.hypot(a.screenX-b.x,a.screenY-b.y)<1e-8);
  const moved=moveObserver(scene.cameraPosition,35,48,1,0,0,roll);
  const translated=createSceneView({...options,settings,observer:moved}).project(pos);
  assert.ok(translated.screenX<a.screenX);assert.ok(Math.abs(translated.screenY-a.screenY)<1e-8);
 }
 const base=ringHalves(1,2,20,35,48),rolled=ringHalves(1,2,20,35,48,90);
 base.front.forEach((p,i)=>{assert.ok(Math.abs(rolled.front[i].x-p.y)<1e-10);assert.ok(Math.abs(rolled.front[i].y+p.x)<1e-10);assert.equal(rolled.front[i].depth,p.depth);});
});
test('contrast enhancement restores culled faint stars without rewriting their magnitudes',()=>{
 const stars=[{id:'faint',position:{x:0,y:0,z:0},absoluteMagnitude:20,magnitude:19,color:'#ffffff'}];
 const scene=createSceneView({...options,scale:1/LIGHT_YEAR_AU,zoom:{x:500,y:350,k:20},observer:{x:0,y:0,z:10*LIGHT_YEAR_AU}});
 assert.equal(projectNearbyStars(stars,scene,{magnitudeLimit:16,contrast:1}).length,0);
 const boosted=projectNearbyStars(stars,scene,{magnitudeLimit:16,contrast:.3})[0];assert.ok(boosted);
 assert.equal(boosted.apparentMagnitude,apparentStarMagnitude(20,10));
 assert.ok(displayStarMagnitude(12,.3)<displayStarMagnitude(20,.3));assert.equal(displayStarMagnitude(-2,.3),-2);
});
test('star annotation uses identifiers when proper names are absent, with a bounded viewport budget',()=>{
 assert.equal(skyStarName({id:'hip_1234',name:''}),'HIP 1234');
 assert.equal(skyStarName({id:'hip_1234',name:'',englishName:'Example'}),'Example');
 assert.equal(skyStarName({id:'hip_1',name:'中文',englishName:'English'},true),'中文 English');
 assert.ok(starLabelBudget(390,844)<starLabelBudget(1280,800));assert.ok(starLabelBudget(4000,3000)<=24);
});
