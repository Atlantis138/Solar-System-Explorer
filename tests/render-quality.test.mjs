import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { evaluateBodyVisibility } = await importTs(new URL('../core/renderConfig.ts', import.meta.url));
const { createSceneView } = await importTs(new URL('../core/sceneView.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const quality={innerQuality:'standard',outerQuality:'standard',cometQuality:'standard'};
const options={scale:23500,width:800,height:600,zoom:{x:400,y:300,k:10},center:{x:30,y:0,z:0},settings:{...SYSTEM_DEFAULTS,trueScale:true,enablePerspective:true,enableProximitySim:true,viewTilt:90,viewYaw:0}};
const body=(a,type='planet')=>({id:'test',type,elements:{a}});

test('visibility depends on apparent size and camera frustum, never distance from Sun',()=>{
 const view=createSceneView(options),p=view.project({x:30,y:0,z:0});
 const a=evaluateBodyVisibility(body(1),p,view,quality,{radiusPixels:2});
 assert.deepEqual(a,evaluateBodyVisibility(body(50),p,view,quality,{radiusPixels:2}));
 assert.equal(a.opacity,1);
 const outside=view.project({x:40,y:0,z:0});
 assert.equal(evaluateBodyVisibility(body(1),outside,view,quality,{prioritized:true,radiusPixels:2}).opacity,0);
 const edge=view.project({x:30+420*view.worldUnitsPerPixel,y:0,z:0});
 assert.equal(evaluateBodyVisibility(body(1),edge,view,quality,{radiusPixels:40}).opacity,1,'disc crossing viewport remains');
});

test('quality categories independently fade small details and preserve selected targets',()=>{
 const view=createSceneView(options),p=view.project({x:30,y:0,z:0});
 const normal=evaluateBodyVisibility(body(1),p,view,quality,{radiusPixels:.001});
 const eco=evaluateBodyVisibility(body(1),p,view,{...quality,innerQuality:'eco'},{radiusPixels:.001});
 assert.ok(normal.opacity>eco.opacity);
 assert.equal(evaluateBodyVisibility(body(1),p,view,quality,{prioritized:true,radiusPixels:.000001}).opacity,1);
 const comet=body(1,'comet');
 assert.deepEqual(evaluateBodyVisibility(comet,p,view,quality,{radiusPixels:.01}),evaluateBodyVisibility(comet,p,view,{...quality,innerQuality:'eco'},{radiusPixels:.01}));
 assert.equal(evaluateBodyVisibility(comet,p,view,{...quality,cometQuality:'performance'},{radiusPixels:.000001}).opacity,1);
 assert.equal(evaluateBodyVisibility(body(1),p,view,quality,{radiusPixels:.02}).labelOpacity,1);
});


test('all quality tiers retain names of displayed subpixel physical bodies',()=>{
 for(const tier of ['eco','standard','performance']) {
  const view=createSceneView(options),p=view.project(options.center);
  const settings={innerQuality:tier,outerQuality:tier,cometQuality:tier};
  for(const type of ['planet','satellite','dwarf','comet']) {
   const result=evaluateBodyVisibility(body(1,type),p,view,settings,{radiusPixels:.04});
   assert.equal(result.opacity,1);
   assert.equal(result.labelOpacity,1,`${type} in ${tier} must keep its name`);
  }
  const size=tier==='eco'?.0018:.0006;
  const transition=evaluateBodyVisibility(body(1),p,view,settings,{radiusPixels:size});
  assert.equal(transition.labelOpacity,1,'parent fade must not be multiplied into label twice');
 }
});

test('mode-specific quality thresholds preserve physical markers and cull small schematic details',()=>{
 const physical=createSceneView(options);
 const schematic=createSceneView({...options,settings:{...options.settings,trueScale:false}});
 for(const tier of ['eco','standard']) {
  const settings={innerQuality:tier,outerQuality:tier,cometQuality:tier};
  const point=physical.project(options.center);
  assert.equal(evaluateBodyVisibility(body(1),point,physical,settings,{radiusPixels:.01}).opacity,1);
  assert.equal(evaluateBodyVisibility(body(1),point,schematic,settings,{radiusPixels:.01}).opacity,0);
 }
 for(const view of [physical,schematic]) {
  const all={innerQuality:'performance',outerQuality:'performance',cometQuality:'performance'};
  const result=evaluateBodyVisibility(body(1),view.project(options.center),view,all,{radiusPixels:1e-9});
  assert.equal(result.opacity,1);assert.equal(result.labelOpacity,1);
 }
});
