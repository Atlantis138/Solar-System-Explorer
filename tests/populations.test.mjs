import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const { SMALL_BODY_POPULATIONS, populationVisible, setPopulationVisible }=await importTs(new URL('../data/populations.ts',import.meta.url));
const { populationPosition, drawAsteroidBelt }=await importTs(new URL('../core/asteroidBelt.ts',import.meta.url));
const { SYSTEM_DEFAULTS }=await importTs(new URL('../data/default_settings.ts',import.meta.url));
const { renderBudget }=await importTs(new URL('../core/renderBudget.ts',import.meta.url));
const { mergeCatalogSources }=await importTs(new URL('../utils/DataLoader.ts',import.meta.url));
const { calculateBodyPosition }=await importTs(new URL('../utils/astronomy.ts',import.meta.url));
const text=readFileSync(new URL('../public/data/solar_system.txt',import.meta.url),'utf8');
const catalog=mergeCatalogSources(text),jupiter=catalog.planets.find(p=>p.id==='jupiter');
const date=new Date('2000-01-01T12:00:00Z');
const reference={body:jupiter,position:{x:5.2,y:0,z:0}};

test('population switches preserve main-belt preferences, obey the umbrella and remain independent of proportion',()=>{
 assert.deepEqual(SMALL_BODY_POPULATIONS.filter(p=>populationVisible(p,SYSTEM_DEFAULTS)).map(p=>p.id),['main-asteroid-belt']);
 let settings=setPopulationVisible(SYSTEM_DEFAULTS,'main-asteroid-belt',false);
 settings=setPopulationVisible(settings,'jupiter-trojans',true);
 for(const trueScale of [false,true])for(const showAsteroidsComets of [false,true]) {
  const s={...settings,trueScale,showAsteroidsComets};
  assert.deepEqual(SMALL_BODY_POPULATIONS.filter(p=>populationVisible(p,s)).map(p=>p.id),showAsteroidsComets?['jupiter-trojans']:[]);
 }
 assert.equal(SYSTEM_DEFAULTS.showAsteroidBelt,true,'switch helpers must not mutate defaults');
 assert.deepEqual(SMALL_BODY_POPULATIONS.filter(p=>populationVisible(p,JSON.parse(JSON.stringify(settings)))).map(p=>p.id),['jupiter-trojans']);
});
test('all enabled populations together stay within each quality budget, in either scale',()=>{
 const projected=[],scene={project(world){projected.push(world);return {x:0,y:0,scaleFactor:1,isVisible:true,distanceAU:1};},projectedRadius(){return 5000;},rangeOpacity(){return 1;}};
 for(const trueScale of [false,true])for(const sceneQuality of ['eco','standard','performance']) {
  let arcs=0,fills=0;
  const ctx={save(){},restore(){},beginPath(){},moveTo(){},arc(){arcs++;},fill(){fills++;}};
  const settings={...SYSTEM_DEFAULTS,trueScale,populationVisibility:{'jupiter-trojans':true,'kuiper-population':true},renderSettings:{...SYSTEM_DEFAULTS.renderSettings,sceneQuality}};
  drawAsteroidBelt(ctx,800,600,65,settings,{x:400,y:300,k:1},{x:0,y:0,z:0},date,.6,scene,reference);
  const budget=renderBudget(settings.renderSettings).beltParticles;
  assert.ok(arcs<=budget&&arcs>budget-3);assert.equal(fills,3);
 }
 assert.ok(projected.every(p=>[p.x,p.y,p.z].every(Number.isFinite)));
});
test('belt samples evolve continuously on inclined Kepler orbits and do not reshuffle',()=>{
 for(const id of ['main-asteroid-belt','kuiper-population']) {
  const group=SMALL_BODY_POPULATIONS.find(p=>p.id===id);
  for(let i=0;i<30;i++) {
   const first=populationPosition(id,i,date),next=populationPosition(id,i,new Date(+date+86400));
   assert.deepEqual(first,populationPosition(id,i,date));
   assert.ok(Math.hypot(first.x,first.y,first.z)>=group.semiMajorAxisAU[0]*(1-group.eccentricity[1]));
   assert.ok(Math.hypot(first.x,first.y,first.z)<=group.semiMajorAxisAU[1]*(1+group.eccentricity[1]));
   assert.ok(Math.hypot(next.x-first.x,next.y-first.y,next.z-first.z)<.02);
   assert.notEqual(first.z,0);
  }
 }
});
test('both Trojan clouds follow the supplied Jupiter state, never a separately hard-coded ephemeris',()=>{
 const flat={body:{...jupiter,elements:{...jupiter.elements,i:0,N:0}},position:{x:5.2,y:0,z:0}};
 for(let i=0;i<100;i++) {
  const p=populationPosition('jupiter-trojans',i,date,flat);
  const angle=Math.atan2(p.y,p.x)*180/Math.PI;
  assert.ok(Math.abs(angle)>=30&&Math.abs(angle)<=90);
  assert.equal(Math.sign(angle),i%2===0?1:-1);
  const q=populationPosition('jupiter-trojans',i,date,{...flat,position:{x:0,y:5.2,z:0}});
  assert.ok(Math.abs(q.x+p.y)<1e-12&&Math.abs(q.y-p.x)<1e-12&&Math.abs(q.z-p.z)<1e-12);
 }
 assert.equal(populationPosition('jupiter-trojans',0,date),null,'missing reference must not invent a Jupiter position');
});
test('selected new bodies parse with epochs, appropriate classifications and contextual ring names',()=>{
 assert.deepEqual(catalog.errors,[]);
 for(const id of ['pallas','eros','chiron','arrokoth']) {
  const body=catalog.asteroidsComets.find(p=>p.id===id);assert.ok(body?.isValid);
  assert.equal(body.type,'asteroid');assert.ok(body.elements.epochJD>2400000&&body.elements.periodDays>0);
  assert.ok(body.description&&body.dataSource.startsWith('https://'));
  const instant=new Date((body.elements.epochJD-2440587.5)*86400000);
  const p=calculateBodyPosition(body.id,body.elements,instant,false),q=calculateBodyPosition(body.id,body.elements,instant,true);
  assert.deepEqual(p,q,'precision switch must preserve fallback minor-body dynamics');
  assert.ok([p.x,p.y,p.z].every(Number.isFinite));
 }
 assert.equal(catalog.dwarfs.some(p=>p.id==='vesta'),false);
 assert.ok(catalog.asteroidsComets.some(p=>p.id==='vesta'));
 for(const [id,name] of [['jupiter','木星'],['saturn','土星'],['uranus','天王星'],['neptune','海王星']]) {
  const ring=catalog.allObjects.find(b=>b.id===`${id}_ring`);assert.ok(ring.name.startsWith(name));
 }
});
test('Chiron source barycentric state was converted to a heliocentric orbit before catalog use',()=>{
 const provenance=JSON.parse(readFileSync(new URL('../public/data/catalog-additions-sources.json',import.meta.url),'utf8'));
 const data=provenance.chironFrameConversion,body=catalog.asteroidsComets.find(b=>b.id==='chiron');
 const p=calculateBodyPosition(body.id,body.elements,date,false),expected=data.heliocentricState.r;
 assert.ok(Math.hypot(p.x-expected[0],p.y-expected[1],p.z-expected[2])<1e-8);
 assert.notEqual(body.elements.a,data.input.a);
 assert.equal(body.massRelativeToSun,undefined,'do not turn a hydrostatic assumption into a measured mass');
});

test('reclassifying Vesta preserves edits saved under the former dwarf category',()=>{
 const original=catalog.allObjects.find(b=>b.id==='vesta');
 const old=original.rawContent.replace('[ASTEROID]','[DWARF]').replace('type: asteroid','type: dwarf').replace('name: 灶神星','name: 我的灶神星');
 const migrated=mergeCatalogSources(text,'',old);assert.deepEqual(migrated.errors,[]);
 const body=migrated.asteroidsComets.find(b=>b.id==='vesta');
 assert.equal(body.name,'我的灶神星');assert.equal(body.category,'ASTEROID');assert.equal(body.type,'asteroid');
 assert.match(body.rawContent,/\[ASTEROID\]/);assert.deepEqual(body.elements,original.elements);
});
