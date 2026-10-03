import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { renderBudget }=await importTs(new URL('../core/renderBudget.ts',import.meta.url));
const { createOrbitProjector }=await importTs(new URL('../core/projectedOrbitCache.ts',import.meta.url));
const { createKeplerOrbitCurve }=await importTs(new URL('../core/orbitGeometry.ts',import.meta.url));
const { createSceneView }=await importTs(new URL('../core/sceneView.ts',import.meta.url));
const { drawAsteroidBelt }=await importTs(new URL('../core/asteroidBelt.ts',import.meta.url));
const { SYSTEM_DEFAULTS }=await importTs(new URL('../data/default_settings.ts',import.meta.url));
const settings={...SYSTEM_DEFAULTS,enablePerspective:true,enableProximitySim:true,viewTilt:90,viewYaw:0};
const opts={scale:65,width:1180,height:820,zoom:{x:590,y:410,k:2},center:{x:0,y:0,z:0},settings};

test('tiers reduce real particle work and backing pixels in both modes without changing coordinates',()=>{
 for(const trueScale of [false,true]) {
  const counts=[];
  for(const sceneQuality of ['eco','standard','performance']) {
   let arcs=0;const centers=[];
   const ctx={save(){},restore(){},beginPath(){},moveTo(){},arc(x,y){arcs++;centers.push([x,y])},fill(){}};
   const scale=trueScale?23500:65,zoom={...opts.zoom,k:opts.zoom.k*65/scale};
   const s={...settings,trueScale,renderSettings:{...settings.renderSettings,sceneQuality}};
   drawAsteroidBelt(ctx,1180,820,scale,s,zoom,opts.center,new Date(0),.6);
   counts.push({arcs,centers});
  }
  assert.ok(counts[0].arcs<counts[1].arcs&&counts[1].arcs<counts[2].arcs);
  assert.deepEqual(counts[0].centers,counts[2].centers.slice(0,counts[0].arcs));
 }
 assert.ok(renderBudget({sceneQuality:'eco'}).maxDpr<renderBudget({sceneQuality:'standard'}).maxDpr);
 assert.equal(renderBudget({}).simulationFps,60,'existing preferences default to balance');
 assert.ok(renderBudget({sceneQuality:'eco'}).orbitTolerance>renderBudget({sceneQuality:'performance'}).orbitTolerance);
});

test('projected orbit caching avoids reevaluation and invalidates camera, local origin, geometry and quality changes',()=>{
 const project=createOrbitProjector(),scene=createSceneView(opts);
 const curve=createKeplerOrbitCurve({a:2,e:.2,i:3,N:40,w:20,M:0});
 let calls=0;const at=curve.at;curve.at=t=>{calls++;return at(t)};
 const first=project(curve,scene),count=calls;
 assert.ok(count>0);assert.equal(first,project(curve,scene));assert.equal(calls,count);
 assert.notEqual(first,project(curve,scene,1));
 assert.notEqual(first,project(curve,scene,.45,{x:1,y:0,z:0}));
 assert.notEqual(first,project(curve,createSceneView({...opts,zoom:{...opts.zoom,k:3}})));
 assert.notEqual(first,project({...curve},scene));
});
