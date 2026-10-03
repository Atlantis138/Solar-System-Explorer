import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const {mergeCatalogSources}=await importTs(new URL('../utils/DataLoader.ts',import.meta.url));
const {calculatePlanetarySystem,calculateWorldPosition,describeBodyMotion}=await importTs(new URL('../utils/astronomy.ts',import.meta.url));
const official=readFileSync(new URL('../public/data/solar_system.txt',import.meta.url),'utf8');
const date=new Date('2000-01-01T12:00:00Z');

test('model explanations report the selected source and distinguish parent and local satellite orbits',()=>{
 const catalog=mergeCatalogSources(official),earth=catalog.planets.find(p=>p.id==='earth'),saturn=catalog.planets.find(p=>p.id==='saturn');
 globalThis.Astronomy={Body:{Earth:'Earth',Saturn:'Saturn'},MakeTime:d=>d,HelioVector:()=>({x:1,y:0,z:0}),GeoMoonState:()=>({x:.0025,y:0,z:0,vx:0,vy:.0005,vz:0})};
 try {
  assert.equal(describeBodyMotion(earth,catalog.planets,date,true).label,'高精度星历');
  assert.equal(describeBodyMotion(earth,catalog.planets,date,false).label,'目录轨道（开普勒）');
  assert.equal(describeBodyMotion(earth.satellites[0],catalog.planets,date,true).label,'高精度星历 + 高精度星历');
  assert.equal(describeBodyMotion(saturn.satellites.find(m=>!m.isRing),catalog.planets,date,true).label,'高精度星历 + 开普勒轨道');
  earth.hasCustomDynamics=true;
  assert.equal(describeBodyMotion(earth,catalog.planets,date,true).label,'目录轨道（开普勒）');
  assert.equal(describeBodyMotion(earth.satellites[0],catalog.planets,date,true).label,'目录轨道 + 开普勒轨道');
  const system=calculatePlanetarySystem(earth,date,true);
  assert.deepEqual(calculateWorldPosition(earth.id,catalog.planets,date,true),system.parentPosition);
  assert.deepEqual(calculateWorldPosition('moon',catalog.planets,date,true),system.satellitePositions.get('moon'));
 }finally{delete globalThis.Astronomy;}
});

test('explicit satellite period takes priority; inconsistent mass/period inputs produce a non-destructive warning',()=>{
 const base=mergeCatalogSources(official),moon=base.allObjects.find(b=>b.id==='moon');
 const override=moon.rawContent+'\nperiodDays: 5\n';
 const catalog=mergeCatalogSources(official,'',override),earth=catalog.planets.find(p=>p.id==='earth');
 assert.deepEqual(catalog.errors,[]);
 assert.match(earth.satellites[0].dataWarnings.join(' '),/不一致.*periodDays/);
 const start=calculatePlanetarySystem(earth,date,true);
 earth.massRelativeToSun*=4;
 const after=calculatePlanetarySystem(earth,new Date(+date+5*86400000),true);
 const a=start.relativeStates.get('moon').position,b=after.relativeStates.get('moon').position;
 assert.ok(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)<1e-12,'explicit period must not be multiplied by the mass-derived mean motion');
 assert.notEqual(start.massFractions.get('moon'),after.massFractions.get('moon'),'mass still determines barycenter fractions');
});

test('without an explicit period the relative orbit speeds up by sqrt of total mass',()=>{
 const earth=mergeCatalogSources(official).planets.find(p=>p.id==='earth');
 const at=t=>calculatePlanetarySystem(earth,new Date(+date+t*86400000),false).relativeStates.get('moon').position;
 const before=at(5);
 earth.massRelativeToSun*=4;earth.satellites[0].massRelativeToSun*=4;
 const after=at(2.5);
 assert.ok(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1e-12);
});
