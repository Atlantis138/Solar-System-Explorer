import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const { parseRawTextToObjects, linkAndCategorize } = await importTs(new URL('../utils/DataLoader.ts', import.meta.url));
const { calculatePlanetarySystem, calculateWorldPosition, calculateSystemLocalOrbits, calculateBodyPosition } = await importTs(new URL('../utils/astronomy.ts', import.meta.url));
const parsed = parseRawTextToObjects(readFileSync(new URL('../public/data/solar_system.txt', import.meta.url), 'utf8'), false);
const catalog = linkAndCategorize(parsed.objects, parsed.errors);
const roots = [...catalog.planets, ...catalog.dwarfs, ...catalog.asteroidsComets];
const pluto = roots.find(b => b.id === 'pluto');
const norm = p => Math.hypot(p.x,p.y,p.z);
const sub = (p,q) => ({x:p.x-q.x,y:p.y-q.y,z:p.z-q.z});
const J2000 = new Date('2000-01-01T12:00:00Z');
const DAY=86400000, AU=149597870.7;

function checkCenter(system) {
  const root = system.parent;
  const total = root.massRelativeToSun + (root.satellites ?? []).filter(m=>!m.isRing).reduce((a,m)=>a+(m.massRelativeToSun??0),0);
  const sum = {x:0,y:0,z:0};
  for (const [body,pos] of [[root,system.parentPosition],...(root.satellites??[]).filter(m=>!m.isRing).map(m=>[m,system.satellitePositions.get(m.id)])])
    for (const axis of ['x','y','z']) sum[axis] += pos[axis]*(body.massRelativeToSun??0)/total;
  assert.ok(norm(sub(sum,system.barycenter))<1e-12);
}

test('catalog links Charon and masses; rings have no contribution to system mass', () => {
  assert.deepEqual(catalog.errors,[]);
  assert.equal(pluto.satellites[0].id,'charon');
  assert.ok(roots.filter(b=>b.satellites).every(b=>b.massRelativeToSun>0));
  assert.ok(catalog.allObjects.filter(b=>b.type==='satellite').every(b=>b.massRelativeToSun>0 && b.orbitReference==='parent'));
  const saturn=roots.find(b=>b.id==='saturn');const s=calculatePlanetarySystem(saturn,J2000);
  assert.equal(s.satellitePositions.has('saturn_ring'),false);
  checkCenter(s);
});

test('Pluto and Charon revolve about a conserved external barycenter for a complete orbit', () => {
  const moon=pluto.satellites[0], q=moon.massRelativeToSun/(pluto.massRelativeToSun+moon.massRelativeToSun);
  let first;
  for (let i=0;i<=32;i++) {
    const t=new Date(+J2000+moon.elements.periodDays*DAY*i/32);
    const s=calculatePlanetarySystem(pluto,t);
    checkCenter(s);
    const rel=sub(s.satellitePositions.get('charon'),s.parentPosition);
    assert.ok(Math.abs(norm(rel)*AU-19596)<.01);
    assert.ok(Math.abs(norm(s.parentOffset)/norm(rel)-q)<1e-8);
    assert.ok(norm(s.parentOffset)*AU>1188.3);
    if(i===0)first=s.parentOffset;
    if(i===16)assert.ok(norm({x:first.x+s.parentOffset.x,y:first.y+s.parentOffset.y,z:first.z+s.parentOffset.z})<1e-12);
    if(i===32)assert.ok(norm(sub(first,s.parentOffset))<1e-12);
    assert.deepEqual(calculateWorldPosition('barycenter:pluto',roots,t),s.barycenter);
    assert.deepEqual(calculateWorldPosition('charon',roots,t),s.satellitePositions.get('charon'));
  }
});

test('local binary orbit geometry uses each mass-scaled radius and passes through the bodies', () => {
  const s=calculatePlanetarySystem(pluto,J2000),paths=calculateSystemLocalOrbits(s,720);
  for(const id of ['pluto','charon']) {
    const expected=id==='pluto'?s.parentOffset:sub(s.satellitePositions.get(id),s.barycenter);
    assert.ok(Math.min(...paths.get(id).map(p=>norm(sub(p,expected))))<norm(expected)*.01);
  }
  for(let i=0;i<=720;i++) {
    const p=paths.get('pluto')[i],m=paths.get('charon')[i];
    assert.ok(norm({x:p.x*pluto.massRelativeToSun+m.x*pluto.satellites[0].massRelativeToSun,y:p.y*pluto.massRelativeToSun+m.y*pluto.satellites[0].massRelativeToSun,z:p.z*pluto.massRelativeToSun+m.z*pluto.satellites[0].massRelativeToSun})<1e-20);
  }
});

test('hiding a satellite does not move bodies or the barycenter; changing its mass does', () => {
  const root=structuredClone(pluto);const first=calculatePlanetarySystem(root,J2000);
  root.satellites[0].visible=false;
  assert.equal(calculatePlanetarySystem(root,J2000),first);
  root.satellites[0].massRelativeToSun*=2;
  const changed=calculatePlanetarySystem(root,J2000);
  assert.ok(norm(changed.parentOffset)>norm(first.parentOffset));checkCenter(changed);
  assert.deepEqual(changed.barycenter,first.barycenter);
});

test('multiple satellites conserve barycenter and old massless catalogs keep parent-centered positions', () => {
  const jupiter=roots.find(b=>b.id==='jupiter');checkCenter(calculatePlanetarySystem(jupiter,J2000));
  const legacy=structuredClone(pluto);delete legacy.orbitReference;delete legacy.satellites[0].massRelativeToSun;
  const s=calculatePlanetarySystem(legacy,J2000);
  assert.equal(s.usesBarycenter,false);
  assert.deepEqual(s.parentPosition,calculateBodyPosition(legacy.id,legacy.elements,J2000));
  assert.deepEqual(s.barycenter,s.parentPosition);
});

test('precision body centers are preserved, barycentric ephemerides are split exactly once, and fallback is safe', () => {
  const earth=roots.find(b=>b.id==='earth');
  globalThis.Astronomy={Body:{Earth:'Earth',Pluto:'Pluto'},MakeTime:t=>t,
    HelioVector:()=>({x:1,y:0,z:0}),GeoMoonState:()=>({x:.00257,y:0,z:0,vx:0,vy:.00059,vz:0})};
  try {
    const s=calculatePlanetarySystem(earth,J2000,true);
    assert.deepEqual(s.parentPosition,{x:1,y:0,z:0});
    assert.ok(Math.abs(s.satellitePositions.get('moon').x-1.00257)<1e-12);checkCenter(s);
    const ps=calculatePlanetarySystem(pluto,J2000,true);
    assert.deepEqual(ps.barycenter,{x:1,y:0,z:0});checkCenter(ps);
    assert.ok(norm(ps.parentOffset)>0);assert.equal(ps.relativeStates.get('charon').precise,false);
    globalThis.Astronomy={Body:{},MakeTime:()=>{throw Error('unavailable')}};
    assert.deepEqual(calculatePlanetarySystem(pluto,J2000,true).parentPosition,calculatePlanetarySystem(pluto,J2000,false).parentPosition);
  } finally {delete globalThis.Astronomy;}
});

test('custom catalog validates reference frames, masses, epochs, unique IDs and direct parents', () => {
  const parse=text=>{const p=parseRawTextToObjects(text,true);return linkAndCategorize(p.objects,p.errors)};
  const base='[PLANET]\nid: p\nelements: 1 0 0 0 0 0\nmassRelativeToSun: 1e-6\norbitReference: system-barycenter';
  const moon='[SATELLITE]\nid: m\nparent: p\nelements: .01 0 0 0 0 0\nperiodDays: 3\nepochJD: 2451544.5\nmassRelativeToSun: 1e-7\norbitReference: parent';
  const result=parse(base+'\n'+moon);assert.deepEqual(result.errors,[]);
  assert.equal(result.planets[0].satellites[0].elements.periodDays,3);
  assert.equal(result.planets[0].satellites[0].elements.epochJD,2451544.5);
  for(const invalid of [base.replace('1e-6','-1'),base.replace('system-barycenter','wrong'),base+'\n'+base,moon.replace('parent: p','parent: missing'),moon.replace('orbitReference: parent','orbitReference: system-barycenter')])
    assert.ok(parse(invalid).errors.length>0);
});
