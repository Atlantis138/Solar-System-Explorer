import test from 'node:test';
import assert from 'node:assert/strict';
import {importTs} from './helpers/import-ts.mjs';
const {solarResetPose,cameraBasis}=await importTs(new URL('../core/cameraOptics.ts',import.meta.url));
const {StableStarLabels,starLabelBox}=await importTs(new URL('../core/starLabels.ts',import.meta.url));
const {createSceneView}=await importTs(new URL('../core/sceneView.ts',import.meta.url));
const {projectNearbyStars,LIGHT_YEAR_AU}=await importTs(new URL('../core/nearbyStars.ts',import.meta.url));
const {SYSTEM_DEFAULTS}=await importTs(new URL('../data/default_settings.ts',import.meta.url));

test('reset first looks at the Sun without translating, then becomes overhead at the same distance',()=>{
 for(const eye of [{x:4,y:-5,z:2},{x:-1,y:3,z:-4}]){
  const first=solarResetPose(eye,17,23,40);
  assert.equal(first.overhead,false);assert.deepEqual(first.eye,eye);
  const back=cameraBasis(first.viewTilt,first.viewYaw,first.viewRoll).back;
  assert.ok(Math.hypot(back.x-eye.x/first.distance,back.y-eye.y/first.distance,back.z-eye.z/first.distance)<1e-10);
  const second=solarResetPose(first.eye,first.viewTilt,first.viewYaw,first.viewRoll);
  assert.equal(second.overhead,true);assert.equal(second.viewTilt,90);assert.equal(second.viewRoll,0);
  assert.deepEqual(second.eye,{x:0,y:0,z:first.distance});
  assert.deepEqual(solarResetPose(second.eye,90,second.viewYaw,0).eye,second.eye);
 }
 const b=cameraBasis(35,60).back,eye={x:b.x*7,y:b.y*7,z:b.z*7};
 assert.equal(solarResetPose(eye,35,60,12).overhead,true,'a Sun-centered view skips the first step');
});

test('neighbor density is invariant under subpixel pans across screen-cell boundaries',()=>{
 const stars=Array.from({length:30},(_,i)=>({id:`star_${i}`,position:{x:i*.15,y:i%4*.12,z:0},absoluteMagnitude:6+i/20,magnitude:6+i/20}));
 const settings={...SYSTEM_DEFAULTS,viewTilt:90,viewYaw:0,enablePerspective:false};
 const scene=x=>createSceneView({scale:1/LIGHT_YEAR_AU,width:800,height:600,zoom:{x,y:300,k:20},settings,center:{x:0,y:0,z:0}});
 const base=projectNearbyStars(stars,scene(400),{density:'balanced'});
 const full=projectNearbyStars(stars,scene(400),{density:'all'});
 for(const offset of [.01,.3,7.4,15.01]){
  const points=projectNearbyStars(stars,scene(400+offset),{density:'balanced'});
  assert.equal(points.length,base.length);
  const unattenuated=projectNearbyStars(stars,scene(400+offset),{density:'all'});
  for(const p of points){const old=base.find(o=>o.star.id===p.star.id),oldFull=full.find(o=>o.star.id===p.star.id),newFull=unattenuated.find(o=>o.star.id===p.star.id);assert.ok(Math.abs(old.opacity/oldFull.opacity-p.opacity/newFull.opacity)<1e-10);}
 }
 const all=projectNearbyStars(stars,scene(400),{density:'all'});
 assert.ok(base.reduce((v,p)=>v+p.opacity,0)<all.reduce((v,p)=>v+p.opacity,0));
});

test('admitted labels persist through ranking changes and remain fully inside all viewport edges',()=>{
 const layout=new StableStarLabels();let t=0;
 const stars=[{id:'left',text:'Left edge star',x:1,y:150,radius:1,priority:1},{id:'right',text:'Right edge star',x:799,y:450,radius:1,priority:2}];
 let frame;
 for(let i=0;i<20;i++)frame=layout.layout(stars,800,600,2,s=>s.length*7,[],t+=16);
 assert.equal(frame.animating,false);assert.equal(frame.labels.length,2);
 for(const p of frame.labels){assert.equal(p.alpha,1);assert.ok(p.box.x>=0&&p.box.x+p.box.w<=800);}
 const challenger={id:'challenger',text:'New bright star',x:400,y:300,radius:1,priority:-20};
 const moved=layout.layout([challenger,...stars.map(s=>({...s,x:s.x<400?2:798,priority:s.priority+30}))],800,600,2,s=>s.length*7,[],t+=16);
 assert.deepEqual(moved.labels.map(l=>l.id).sort(),['left','right']);
 for(const [x,y] of [[0,0],[800,0],[0,600],[800,600]]){
  const box=starLabelBox({x,y,radius:1},140,800,600);assert.ok(box.x>=0&&box.y>=0&&box.x+box.w<=800&&box.y+box.h<=600);
 }
 for(let i=0;i<20;i++)frame=layout.layout(stars,800,600,0,s=>s.length*7,[],t+=16);
 assert.equal(frame.labels.length,0);assert.equal(frame.animating,false,'fades stop scheduling work when finished');
});

test('colliding labels fade once and do not alternate at rest',()=>{
 const layout=new StableStarLabels();let t=0,frame;
 const stars=[{id:'a',text:'Star A',x:100,y:200,radius:1,priority:1},{id:'b',text:'Star B',x:220,y:200,radius:1,priority:2}];
 for(let i=0;i<20;i++)layout.layout(stars,800,600,2,s=>s.length*7,[],t+=16);
 const crowded=stars.map(s=>({...s,x:100}));
 for(let i=0;i<30;i++)frame=layout.layout(crowded,800,600,2,s=>s.length*7,[],t+=16);
 assert.deepEqual(frame.labels.map(p=>p.id),['a']);assert.equal(frame.animating,false);
});

const {nearestBrighterDistances}=await importTs(new URL('../core/starCrowding.ts',import.meta.url));
test('crowding search matches brute force even for coincident and linearly ordered stars',()=>{
 for(const points of [Array.from({length:100},(_,i)=>({x:i/2,y:0})),Array.from({length:100},()=>({x:0,y:0})),Array.from({length:200},(_,i)=>({x:Math.sin(i*8.41)*100,y:Math.cos(i*1.43)*80}))]){
  const actual=nearestBrighterDistances(points,30);
  points.forEach((p,i)=>{let nearest=30;for(let j=0;j<i;j++)nearest=Math.min(nearest,Math.hypot(p.x-points[j].x,p.y-points[j].y));assert.ok(Math.abs(actual[i]-nearest)<1e-10);});
 }
});
