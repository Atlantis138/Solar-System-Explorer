import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const { ORBIT_CATEGORIES,bodyOrbitOpacity,categoryOrbitOpacity,orbitCategoryForBody }=await importTs(new URL('../core/orbitCategories.ts',import.meta.url));
const { drawOrbitPaths }=await importTs(new URL('../core/orbitDrawing.ts',import.meta.url));
const { SYSTEM_DEFAULTS }=await importTs(new URL('../data/default_settings.ts',import.meta.url));
const { mergeCatalogSources }=await importTs(new URL('../utils/DataLoader.ts',import.meta.url));
const body=type=>({id:type,type,category:type.toUpperCase()});

test('orbit defaults separate major planets, dwarfs, comets and asteroids without depending on size mode',()=>{
 for(const trueScale of [false,true])for(const perspective of [false,true]){
  const s={...SYSTEM_DEFAULTS,trueScale};const calls=[];
  const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(x){this.x=x;},lineTo(){},stroke(){calls.push({x:this.x,width:this.lineWidth,alpha:this.globalAlpha});}};
  const classes=['planet','dwarf','comet','asteroid'];
  const point=(x,y)=>({x,y,depth:0,opacity:1,scaleFactor:1,isVisible:true});
  drawOrbitPaths(ctx,classes.map((category,i)=>({points:[point(i,0),point(i,10)],color:'#aaa',opacity:bodyOrbitOpacity(body(category),s),category,emphasized:false})),{zoom:1,perspective,tilt:90,intensity:1,trueScale});
  assert.equal(calls.length,4);
  for(let i=1;i<calls.length;i++){assert.ok(calls[i].width<calls[i-1].width);assert.ok(calls[i].alpha<calls[i-1].alpha);}
 }
});
test('category opacity composes with the global setting, handles old preferences and respects zero when highlighted',()=>{
 const legacy={...SYSTEM_DEFAULTS};delete legacy.orbitCategoryOpacity;
 assert.equal(categoryOrbitOpacity(legacy,'asteroid'),.3);
 const partial={...legacy,orbitCategoryOpacity:{asteroid:.2},orbitOpacity:.5};
 assert.equal(bodyOrbitOpacity(body('asteroid'),partial),.1);
 assert.equal(bodyOrbitOpacity(body('planet'),partial),.5);
 assert.equal(bodyOrbitOpacity(body('dwarf'),partial),.3);
 for(const category of Object.keys(ORBIT_CATEGORIES)) {
  const s={...SYSTEM_DEFAULTS,orbitCategoryOpacity:{[category]:0}};
  let strokes=0;const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++}};
  drawOrbitPaths(ctx,[{points:[{x:0,y:0,depth:0,isVisible:true},{x:1,y:1,depth:0,isVisible:true}],category,opacity:bodyOrbitOpacity(body(category),s),emphasized:true}],{zoom:1,perspective:false,tilt:90,intensity:1});
  assert.equal(strokes,0);
  assert.equal(bodyOrbitOpacity(body(category),{...SYSTEM_DEFAULTS,orbitOpacity:0}),0);
 }
 assert.equal(orbitCategoryForBody({...body('asteroid'),parentId:'mars'}),'satellite');
 assert.equal(categoryOrbitOpacity({...legacy,orbitCategoryOpacity:{dwarf:NaN}},'dwarf'),.6);
});
test('Arrokoth name migration preserves local orbital edits and separately chosen user names',()=>{
 const official=readFileSync(new URL('../public/data/solar_system.txt',import.meta.url),'utf8');
 const original=mergeCatalogSources(official).allObjects.find(b=>b.id==='arrokoth');assert.equal(original.name,'天涯海角');
 for(const name of ['阿罗科斯','阿罗斯科','我的天体']){
  const edit=original.rawContent.replace('name: 天涯海角',`name: ${name}`).replace('elements: 44.5512463422597','elements: 45');
  const cat=mergeCatalogSources(official,'',edit);assert.deepEqual(cat.errors,[]);
  const b=cat.allObjects.find(b=>b.id==='arrokoth');assert.equal(b.name,name==='我的天体'?name:'天涯海角');
  assert.equal(b.elements.a,45);assert.ok(b.rawContent.includes(`name: ${b.name}`));
 }
});
