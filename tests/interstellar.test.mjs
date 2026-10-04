import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {importTs} from './helpers/import-ts.mjs';
const {calculateBodyPosition,calculateOrbitPath}=await importTs(new URL('../utils/astronomy.ts',import.meta.url));
const {solveHyperbolicAnomaly}=await importTs(new URL('../core/conicOrbit.ts',import.meta.url));
const {createKeplerOrbitCurve}=await importTs(new URL('../core/orbitGeometry.ts',import.meta.url));
const {getOrbitCurve}=await importTs(new URL('../core/orbitCache.ts',import.meta.url));
const {parseRawTextToObjects,mergeCatalogSources,validateCatalogEdit}=await importTs(new URL('../utils/DataLoader.ts',import.meta.url));
const {cometTailGeometry,cometActivity,drawCometTails}=await importTs(new URL('../core/cometTails.ts',import.meta.url));
const {migrateSmallBodySettings,smallBodyVisible,revealSmallBody,cometTailVisible}=await importTs(new URL('../core/smallBodySettings.ts',import.meta.url));
const {SYSTEM_DEFAULTS}=await importTs(new URL('../data/default_settings.ts',import.meta.url));
const {createSceneView}=await importTs(new URL('../core/sceneView.ts',import.meta.url));
const {renderBudget}=await importTs(new URL('../core/renderBudget.ts',import.meta.url));
const text=readFileSync(new URL('../public/data/solar_system.txt',import.meta.url),'utf8');
const catalog=mergeCatalogSources(text),visitors=catalog.allObjects.filter(b=>b.interstellar);
const norm=p=>Math.hypot(p.x,p.y,p.z),diff=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const date=jd=>new Date((jd-2440587.5)*86400000);

test('the three visitors retain physical categories, matching perihelia and non-repeating trajectories',()=>{
 assert.deepEqual(catalog.errors,[]);assert.equal(visitors.length,3);
 assert.equal(visitors.find(b=>b.id==='oumuamua').category,'ASTEROID');
 for(const b of visitors){
  const e=b.elements,tp=date(e.perihelionTimeJD),q=e.a*(1-e.e);
  assert.ok(Math.abs(norm(calculateBodyPosition(b.id,e,tp))-q)<1e-7);
  assert.equal(b.type==='comet',b.id!=='oumuamua');
  const past=calculateBodyPosition(b.id,e,new Date(+tp-365.25*86400000));
  const future=calculateBodyPosition(b.id,e,new Date(+tp+365.25*86400000));
  assert.ok(Math.abs(norm(past)-norm(future))<1e-7);assert.ok(norm(diff(past,future))>q*2);
  assert.ok(norm(calculateBodyPosition(b.id,e,new Date(+tp+100*365.25*86400000)))>500);
  assert.deepEqual(calculateBodyPosition(b.id,e,tp,true),calculateBodyPosition(b.id,e,tp,false));
 }
});
test('hyperbolic solver converges near the parabolic limit and for large signed times',()=>{
 for(const e of [1.000001,1.2,3.356476,6.139311])for(const m of [0,1e-10,.001,.3,10,1e5,-.3,-1e5]){
  const h=solveHyperbolicAnomaly(m,e);assert.ok(Number.isFinite(h));
  assert.ok(Math.abs(e*Math.sinh(h)-h-m)<1e-10*Math.max(Math.abs(m),1));
 }
});
test('hyperbolic propagation conserves Kepler energy and angular momentum',()=>{
 const mu=(.9856076686*Math.PI/180)**2;
 for(const b of visitors){const e=b.elements,states=[];
  for(const days of [-180,-25,0,25,180]){
   const t=+date(e.perihelionTimeJD)+days*86400000,dt=.001;
   const r=calculateBodyPosition(b.id,e,new Date(t));
   const d=diff(calculateBodyPosition(b.id,e,new Date(t+dt*86400000)),calculateBodyPosition(b.id,e,new Date(t-dt*86400000)));
   const v={x:d.x/(2*dt),y:d.y/(2*dt),z:d.z/(2*dt)};
   const energy=norm(v)**2/2-mu/norm(r);assert.ok(Math.abs(energy/(-mu/(2*e.a))-1)<2e-5);
   states.push(norm({x:r.y*v.z-r.z*v.y,y:r.z*v.x-r.x*v.z,z:r.x*v.y-r.y*v.x}));
  }
  assert.ok(Math.max(...states)/Math.min(...states)-1<2e-5);
 }
});
test('open geometry never closes a hyperbola, and follows a departing body beyond the initial drawing extent',()=>{
 for(const b of visitors){const e=b.elements,curve=createKeplerOrbitCurve(e),path=calculateOrbitPath(e,180);
  assert.equal(curve.closed,false);assert.ok(norm(diff(path[0],path.at(-1)))>100);
  assert.ok(path.every(p=>Object.values(p).every(Number.isFinite)));
  assert.ok(norm(diff(curve.at(.5),calculateBodyPosition(b.id,e,date(e.perihelionTimeJD))))<1e-7);
  const future=new Date(+date(e.perihelionTimeJD)+100*365.25*86400000);
  const distant=getOrbitCurve(b,future);assert.ok(norm(distant.at(0))>norm(calculateBodyPosition(b.id,e,future)));
 }
});
test('catalog accepts signed hyperbolic elements and rejects conflicting timing, period and satellite assumptions',()=>{
 const b=visitors[1],raw=b.rawContent;
 assert.deepEqual(validateCatalogEdit(raw,catalog.allObjects,b.id).errors,[]);
 for(const invalid of [raw+'\nperiodDays: 100',raw.replace(' 0\ndescription',' 5\ndescription'),raw.replace('interstellar: true','interstellar: maybe'),raw.replace(String(b.elements.a),String(-b.elements.a)),raw.replace('[COMET]','[SATELLITE]')+'\nparent: earth'])
  assert.ok(parseRawTextToObjects(invalid,true).objects.some(x=>!x.isValid));
 const byEpoch=raw.replace(/^perihelionTimeJD:.*\n/m,'').replace(/^epochJD:.*$/m,`epochJD: ${b.elements.perihelionTimeJD}`);
 const parsed=parseRawTextToObjects(byEpoch,true).objects[0];assert.equal(parsed.isValid,true);
 assert.deepEqual(calculateBodyPosition(b.id,parsed.elements,date(b.elements.perihelionTimeJD)),calculateBodyPosition(b.id,b.elements,date(b.elements.perihelionTimeJD)));
});
test('origin and body type filters work independently, with an effective umbrella and preserved legacy settings',()=>{
 const types=[catalog.allObjects.find(b=>b.id==='halley'),catalog.allObjects.find(b=>b.id==='vesta'),...visitors];
 for(const trueScale of [true,false]){
  const s={...SYSTEM_DEFAULTS,trueScale,showAsteroidsComets:true,showComets:true,showAsteroids:false,showInterstellar:false};
  assert.deepEqual(types.filter(b=>smallBodyVisible(b,s)).map(b=>b.id),['halley']);
  assert.deepEqual(types.filter(b=>smallBodyVisible(b,{...s,showInterstellar:true})).map(b=>b.id),['halley',...visitors.map(b=>b.id)]);
  assert.equal(types.filter(b=>smallBodyVisible(b,{...s,showAsteroidsComets:false})).length,0);
  assert.ok(smallBodyVisible(visitors[0],revealSmallBody(visitors[0],{...s,showAsteroidsComets:false})));
 }
 const beltOnly=migrateSmallBodySettings({showAsteroidsComets:false,showAsteroidBelt:true});
 assert.equal(beltOnly.showAsteroidsComets,false);assert.equal(beltOnly.showComets,false);assert.equal(beltOnly.showAsteroids,false);
 const off=migrateSmallBodySettings({showAsteroidsComets:false,showAsteroidBelt:false});assert.equal(off.showAsteroidsComets,false);
 assert.deepEqual(migrateSmallBodySettings(beltOnly),beltOnly);
});
test('comet tails point away from the Sun on both inbound and outbound legs and fade with distance',()=>{
 assert.ok(cometActivity(.5)>cometActivity(3));assert.ok(cometActivity(3)>cometActivity(8));
 assert.equal(cometTailGeometry(visitors[0],date(visitors[0].elements.perihelionTimeJD),16),null);
 for(const b of visitors.filter(b=>b.type==='comet'))for(const days of [-50,0,50]){
  const g=cometTailGeometry(b,new Date(+date(b.elements.perihelionTimeJD)+days*86400000),16);assert.ok(g);
  for(const p of [...g.dust.slice(1),...g.ion.slice(1)]){
   const d=diff(p,g.head);assert.ok(d.x*g.head.x+d.y*g.head.y+d.z*g.head.z>0);
  }
  assert.equal(cometTailGeometry(b,new Date(+date(b.elements.perihelionTimeJD)+100*365.25*86400000),16),null);
 }
});
test('tail drawing respects the switch and each mobile rendering budget in both proportion modes',()=>{
 const b=visitors.find(b=>b.id==='borisov'),tp=date(b.elements.perihelionTimeJD),p=calculateBodyPosition(b.id,b.elements,tp);
 for(const trueScale of [false,true])for(const sceneQuality of ['eco','standard','performance']){
  const settings={...SYSTEM_DEFAULTS,trueScale,showAsteroidsComets:true,showComets:false,showInterstellar:true,showCometTails:false,renderSettings:{...SYSTEM_DEFAULTS.renderSettings,sceneQuality}};
  const scene=createSceneView({scale:65,settings,zoom:{x:400,y:300,k:2},width:800,height:600,center:p});let strokes=0;
  const ctx={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){strokes++},arc(){},fill(){},createRadialGradient(){return {addColorStop(){}}}};
  drawCometTails(ctx,[b],tp,scene,settings);assert.ok(strokes>0);assert.ok(strokes<=renderBudget(settings.renderSettings).tailSegments*2);
  strokes=0;drawCometTails(ctx,[b],tp,scene,{...settings,showInterstellarTails:false});assert.equal(strokes,0);
 }
});

test('ordinary and interstellar tails follow only their own row, including asteroid visitors',()=>{
 const comet=catalog.allObjects.find(b=>b.id==='halley'),asteroid=catalog.allObjects.find(b=>b.id==='vesta');
 for(const showComets of [false,true])for(const showInterstellar of [false,true])
 for(const showCometTails of [false,true])for(const showInterstellarTails of [false,true])for(const showAsteroidsComets of [false,true]){
  const s={...SYSTEM_DEFAULTS,showAsteroidsComets,showComets,showInterstellar,showCometTails,showInterstellarTails};
  assert.equal(cometTailVisible(comet,s),showAsteroidsComets&&showComets&&showCometTails);
  assert.equal(cometTailVisible(asteroid,s),false);
  for(const b of visitors)assert.equal(cometTailVisible(b,s),b.type==='comet'&&showAsteroidsComets&&showInterstellar&&showInterstellarTails);
 }
});
test('v1 preferences migrate to independent tails and unified non-main populations without losing main-belt choices',()=>{
 const before={smallBodySettingsVersion:1,showAsteroidsComets:true,showComets:false,showAsteroids:false,showInterstellar:false,showCometTails:false,showAsteroidBelt:false,populationVisibility:{'jupiter-trojans':true,'kuiper-population':false}};
 const after=migrateSmallBodySettings(before);
 assert.equal(after.smallBodySettingsVersion,2);assert.equal(after.showAsteroidsComets,true);assert.equal(after.showNonMainBeltPopulations,true);
 assert.equal(after.showCometTails,false);assert.equal(after.showInterstellarTails,false);assert.equal(after.showAsteroidBelt,false);
 assert.equal(migrateSmallBodySettings({...before,showAsteroidsComets:false}).showNonMainBeltPopulations,false);
 assert.equal(migrateSmallBodySettings({...before,showSmallBodyPopulations:false}).showNonMainBeltPopulations,false);
 assert.deepEqual(migrateSmallBodySettings(after),after);
});
