import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { drawRegionBoundaries, regionPerspectiveStyle }=await importTs(new URL('../core/regionDrawing.ts',import.meta.url));
const { createSceneView }=await importTs(new URL('../core/sceneView.ts',import.meta.url));
const { SYSTEM_DEFAULTS }=await importTs(new URL('../data/default_settings.ts',import.meta.url));
function draw(scale,k,trueScale,width=1280,height=900,tilt=90,perspective=true) {
 const strokes=[],letters=[],lines=[];
 const ctx={save(){},restore(){},scale(){},setLineDash(){},beginPath(){this.path=[]},moveTo(x,y){lines.push([x*k,y*k]);this.path.push([x*k,y*k])},lineTo(x,y){lines.push([x*k,y*k]);this.path.push([x*k,y*k])},stroke(){strokes.push({alpha:this.globalAlpha,width:this.lineWidth*k,color:this.strokeStyle,path:this.path})},fillText(text,x,y){letters.push({text,x,y,alpha:this.globalAlpha,font:parseFloat(this.font.split(' ')[1])})}};
 const scene=createSceneView({scale,zoom:{x:width/2,y:height/2,k},width,height,center:{x:0,y:0,z:0},settings:{...SYSTEM_DEFAULTS,trueScale,enablePerspective:perspective,enableProximitySim:true,viewTilt:tilt,viewYaw:271}});
 drawRegionBoundaries(ctx,scene);return {strokes,letters,lines};
}
test('regional dashes stay anchored in world space through zoom, with arc lettering and original baseline opacity',()=>{
 for(const [scale,k,real] of [[65,.035,false],[23500,.035*65/23500,true],[65,.05,false]]) {
  const {strokes,letters}=draw(scale,k,real);
  assert.equal(strokes.filter(s=>s.color==='#aaa').length,50);
  assert.equal(strokes.filter(s=>s.color==='#666').length,68);
  assert.ok(strokes.every(s=>Math.abs(s.alpha-.5)<1e-10));
  assert.ok(strokes.every(s=>Math.abs(s.width-(real||s.color==='#666'?2:1.5))<1e-10));
  assert.equal(letters.map(l=>l.text).join(''),'柯伊伯带日球层顶');
  assert.ok(letters.every(l=>l.alpha>.35&&l.alpha<=.4));
  assert.ok(new Set(letters.map(l=>l.y)).size>4);
  assert.ok(letters.every(l=>l.font>=10&&l.font<=22),'both modes use readable screen sizes');
 }
});
test('region dashes, thickness and labels reflect perspective while orthographic view remains uniform',()=>{
 const {strokes,letters}=draw(65,.035,false,1280,900,12);
 const outer=strokes.filter(s=>s.color==='#666');
 assert.ok(Math.max(...outer.map(s=>s.width))/Math.min(...outer.map(s=>s.width))>1.5);
 assert.ok(Math.max(...outer.map(s=>s.alpha))>Math.min(...outer.map(s=>s.alpha)));
 const lengths=outer.map(s=>s.path.reduce((sum,p,i)=>i?sum+Math.hypot(p[0]-s.path[i-1][0],p[1]-s.path[i-1][1]):0,0));
 assert.ok(Math.max(...lengths)/Math.min(...lengths)>2,'projected dash lengths must not be constant screen stamps');
 assert.ok(new Set(letters.map(l=>l.font.toFixed(3))).size>2);
 assert.deepEqual(regionPerspectiveStyle(.5,false,2),regionPerspectiveStyle(2,false,2));
 const ortho=draw(65,.035,false,1280,900,12,false).strokes.filter(s=>s.color==='#666');
 assert.ok(ortho.every(s=>s.width===2&&s.alpha===.5));
});
test('regional geometry stays clipped on desktop and tablet layouts',()=>{
 for(const [w,h] of [[1920,1200],[1180,820]]) {
  const {strokes,lines}=draw(65,.05,false,w,h,7);
  assert.ok(strokes.length>20);
  assert.ok(lines.every(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x>=-w/2-4.01&&x<=w/2+4.01&&y>=-h/2-4.01&&y<=h/2+4.01));
 }
});

test('region labels shrink then fade with their screen extent identically in both modes',()=>{
 const normal=draw(65,.035,false).letters;
 const physical=draw(23500,.035*65/23500,true).letters;
 assert.deepEqual(normal.map(l=>l.font),physical.map(l=>l.font));
 const small=draw(23500,.014*65/23500,true).letters;
 assert.ok(small.length>0);
 assert.ok(Math.max(...small.map(l=>l.font))<Math.max(...physical.map(l=>l.font)));
 assert.equal(draw(23500,.001*65/23500,true).letters.length,0);
});
