import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { getOrbitPath } = await importTs(new URL('../core/orbitCache.ts', import.meta.url));
const { ringHalves } = await importTs(new URL('../core/rings.ts', import.meta.url));
const { prepareCanvas } = await importTs(new URL('../core/canvas.ts', import.meta.url));
const { drawAsteroidBelt } = await importTs(new URL('../core/asteroidBelt.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const DAY = 86400000;
const makeBody = (id = 'earth') => ({ id, elements: { a: 1, e: .0167, i: 0, N: 0, w: 0, M: 0 } });

test('Kepler paths reuse geometry across dates, but invalidate edited elements', () => {
  const body = makeBody();
  const first = getOrbitPath(body, new Date(0));
  assert.equal(first, getOrbitPath(body, new Date(10000 * DAY)));
  assert.equal(first.length, 181);
  assert.ok(Math.hypot(first[0].x - first.at(-1).x, first[0].y - first.at(-1).y) < 1e-10);
  body.elements.a = 2;
  const edited = getOrbitPath(body, new Date(0));
  assert.notEqual(first, edited);
  assert.ok(Math.abs(edited[0].x / first[0].x - 2) < 1e-10);
});

test('precise paths reuse a 30-day window; jumping or reversing updates correctly', () => {
  let calls = 0;
  globalThis.Astronomy = { Body: { Earth: 'earth' }, MakeTime: date => date,
    HelioVector: (_, date) => { calls++; return { x: date.getTime() / DAY, y: 1, z: 0 }; } };
  try {
    const body = makeBody();
    const path = getOrbitPath(body, new Date(10 * DAY), true);
    assert.equal(calls, 181);
    assert.equal(path, getOrbitPath(body, new Date(20 * DAY), true));
    assert.equal(calls, 181);
    assert.notEqual(path, getOrbitPath(body, new Date(31 * DAY), true));
    assert.equal(calls, 362);
    assert.equal(path, getOrbitPath(body, new Date(10 * DAY), true));
    assert.notEqual(path, getOrbitPath(body, new Date(-DAY), true));
    const moon = makeBody('moon');
    getOrbitPath(moon, new Date(10 * DAY), true);
    assert.equal(calls, 543, 'relative satellite geometry must not use heliocentric engine calls');
    assert.notEqual(path, getOrbitPath(body, new Date(10 * DAY), false));
  } finally { delete globalThis.Astronomy; }
});

test('ring halves have correct near/far depth across both hemispheres and yaw', () => {
  for (const tilt of [-90, -45, 0, 30, 90]) for (const yaw of [0, 45, 180, 270]) {
    const halves = ringHalves(1.2, 2.3, 26.7, tilt, yaw);
    assert.equal(halves.front.length, 98);
    for (const p of halves.front) assert.ok(p.depth >= -1e-10);
    for (const p of halves.back) assert.ok(p.depth <= 1e-10);
    for (const p of [...halves.front, ...halves.back]) assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(Math.abs(halves.front[48].x - halves.back[0].x) < 1e-10);
  }
});

test('canvas backing store changes only on size or DPR changes, CSS coordinates preserved', () => {
  let width = 0, height = 0, writes = 0;
  const transforms = [];
  const ctx = { setTransform: (...args) => transforms.push(args), clearRect() {} };
  const canvas = { get width() { return width; }, set width(v) { width=v; writes++; },
    get height() { return height; }, set height(v) { height=v; writes++; },
    getBoundingClientRect: () => ({ width: 800, height: 600 }), getContext: () => ctx };
  prepareCanvas(canvas, 2); assert.equal(width, 1600); assert.equal(height, 1200);
  prepareCanvas(canvas, 2); assert.equal(writes, 2);
  prepareCanvas(canvas, 1.25); assert.equal(width, 1000); assert.equal(height, 750);
  assert.deepEqual(transforms.at(-1), [1.25, 0, 0, 1.25, 0, 0]);
});

test('asteroid batch respects visibility and viewport culling without DOM particles', () => {
  let arcs = 0, fills = 0;
  const ctx = { save() {}, restore() {}, beginPath() {}, moveTo() {}, arc() { arcs++; }, fill() { fills++; } };
  const settings = { ...SYSTEM_DEFAULTS, showAsteroidBelt: true, viewTilt: 90, viewYaw: 0 };
  const draw = (zoom, s = settings) => drawAsteroidBelt(ctx, 800, 600, 65, s, zoom,
    { x: 0, y: 0, z: 0 }, new Date(0), .6);
  draw({ x: 400, y: 300, k: 1 }); assert.ok(arcs > 250 && arcs <= 2000); assert.equal(fills, 1);
  arcs = 0; draw({ x: 1e6, y: 1e6, k: 1 }); assert.equal(arcs, 0);
  fills = 0; draw({ x: 400, y: 300, k: 1 }, { ...settings, showAsteroidBelt: false }); assert.equal(fills, 0);
});

const { project3D } = await importTs(new URL('../core/projection.ts', import.meta.url));
const { orbitSegmentStyle, drawOrbitPaths } = await importTs(new URL('../core/orbitDrawing.ts', import.meta.url));

test('overview perspective visibly separates near and far geometry at both physical scales', () => {
  const settings = { ...SYSTEM_DEFAULTS, viewTilt: 7, viewYaw: 0, enablePerspective: true, enableProximitySim: false };
  for (const scale of [65, 24000]) {
    const near = project3D({ x: 5, y: -25, z: 0 }, scale, settings, 0.8);
    const far = project3D({ x: 5, y: 25, z: 0 }, scale, settings, 0.8);
    assert.ok(near.scaleFactor / far.scaleFactor > 2, 'finite camera must have visible perspective');
    assert.ok(near.x > far.x && near.isVisible && far.isVisible);
    const behind = project3D({ x: 1, y: -100, z: 0 }, scale, settings, 0.8);
    assert.equal(behind.isVisible, false);
    const ortho = project3D({ x: 5, y: -25, z: 0 }, scale, { ...settings, enablePerspective: false }, 0.8);
    assert.equal(ortho.scaleFactor, 1);
  }
});

test('orbital tracks remain thin in screen pixels, sort by depth, and retain near/far contrast', () => {
  const view = { zoom: 1, perspective: true, tilt: 7, intensity: 1 };
  const near = orbitSegmentStyle(1, view), far = orbitSegmentStyle(-1, view);
  assert.ok(near.alpha > far.alpha && far.alpha >= 0.19);
  assert.ok(near.width > far.width);
  assert.deepEqual(orbitSegmentStyle(-1, {...view,perspective:false}), orbitSegmentStyle(1, {...view,perspective:false}));
  for (const zoom of [0.0001, 0.8, 5, 100]) {
    const calls=[];
    const ctx={save(){},restore(){},setLineDash(){},beginPath(){},moveTo(x,y){this.position=[x,y]},lineTo(){},
      stroke(){calls.push({width:this.lineWidth*zoom,alpha:this.globalAlpha,x:this.position[0]})}};
    const p = (x, depth) => ({x, y:0, depth, scaleFactor:100, opacity:1, isVisible:true});
    drawOrbitPaths(ctx,[{points:[p(1,20),p(2,20),p(3,-20),p(4,-20)],color:'#fff',opacity:1,emphasized:false}],{...view,zoom});
    assert.ok(calls.every(c=>c.width>=0.95 && c.width<=3.3));
    assert.equal(calls[0].x,3,'far side first');
    assert.equal(calls.at(-1).x,1,'near side last');
    assert.ok(calls.at(-1).alpha>calls[0].alpha);
  }
});

test('focused planets and moons remain opaque through true-scale close-up zooms', () => {
  const pivot={x:1.2,y:-0.7,z:0.03};
  for (const trueScale of [false,true]) for (const tilt of [-80,0,7,90]) for (const id of ['earth','mercury','saturn','moon']) {
    const scale=trueScale?23500:65;
    const settings={...SYSTEM_DEFAULTS,trueScale,viewTilt:tilt,viewYaw:217,enablePerspective:true,enableProximitySim:true};
    for(const k of [0.0022,0.8,5,20,100,1000,100000]) {
      const p=project3D(pivot,scale,settings,k,id,pivot);
      assert.ok(p.isVisible, `${id}: k=${k}, tilt=${tilt}`);
      assert.equal(p.opacity,1);
      assert.equal(p.scaleFactor,1);
      assert.equal(p.x,0);assert.equal(Math.abs(p.y),0);
    }
  }
});

test('observer distance and projection agree across schematic and true-scale units', () => {
  const settings={...SYSTEM_DEFAULTS,viewTilt:7,viewYaw:214,enablePerspective:true,enableProximitySim:true};
  const point={x:2,y:-3,z:.1},pivot={x:.2,y:.1,z:0};
  const a=project3D(point,65,settings,.8,'earth',pivot);
  const k=.8*65/23500;
  const b=project3D(point,23500,{...settings,trueScale:true},k,'earth',pivot);
  assert.ok(Math.abs(a.distanceAU-b.distanceAU)<1e-10);
  assert.ok(Math.abs(a.x*.8-b.x*k)<1e-9);
  assert.ok(Math.abs(a.y*.8-b.y*k)<1e-9);
  const closer=project3D(pivot,23500,{...settings,trueScale:true},k*10,'earth',pivot);
  const further=project3D(pivot,23500,{...settings,trueScale:true},k,'earth',pivot);
  assert.ok(Math.abs(closer.distanceAU*10-further.distanceAU)<1e-10);
});

test('tracks respond to actual distance and magnification with mode-specific readable limits', () => {
  const view={zoom:.8,perspective:true,tilt:7,intensity:1,scale:65};
  const far=orbitSegmentStyle(-1,view,false,150),near=orbitSegmentStyle(-1,view,false,10);
  assert.ok(near.width>far.width*1.4,'same orbit half should grow as observer approaches');
  assert.ok(far.width>=0.95 && far.alpha>=.19);
  const normal=orbitSegmentStyle(0,view,false,40);
  const real=orbitSegmentStyle(0,{...view,trueScale:true,scale:23500,zoom:.8*65/23500},false,40);
  assert.ok(Math.abs(normal.width-real.width)<.3,'switching units must not inflate tracks');
  const moon=orbitSegmentStyle(0,{...view,trueScale:true},false,.015,true);
  assert.ok(moon.width>=1.3 && moon.width<=1.6);
  const close=orbitSegmentStyle(1,view,false,1e-12);assert.ok(close.width<=3.3);
  const ortho={...view,perspective:false};
  assert.ok(orbitSegmentStyle(0,{...ortho,zoom:8}).width>orbitSegmentStyle(0,ortho).width);
});

test('side-view tracks are continuous, smoothly graded, and remain readable in both modes', () => {
  const view={zoom:1,perspective:true,tilt:7,intensity:1};
  for (const trueScale of [false,true]) {
    const v={...view,trueScale};
    const far=orbitSegmentStyle(-1,v,false,40),near=orbitSegmentStyle(1,v,false,40);
    assert.ok(near.alpha/far.alpha>2.5 && near.alpha/far.alpha<3);
    assert.ok(far.width>=.95 && far.width<1.3);
    assert.ok(near.width>1.9 && near.width<2.3);
    for(let depth=-1;depth<1;depth+=.02) {
      const a=orbitSegmentStyle(depth,v,false,40),b=orbitSegmentStyle(depth+.02,v,false,40);
      assert.ok(Math.abs(a.width-b.width)<.03 && Math.abs(a.alpha-b.alpha)<.01);
    }
  }
  const topFar=orbitSegmentStyle(-1,{...view,tilt:90}),topNear=orbitSegmentStyle(1,{...view,tilt:90});
  assert.ok(Math.abs(topFar.width-topNear.width)<1e-10 && Math.abs(topFar.alpha-topNear.alpha)<1e-10);
  const calls=[];
  const ctx={save(){},restore(){},setLineDash(d){this.dashes=d},beginPath(){},moveTo(x,y){this.x=x},lineTo(){},
    stroke(){calls.push({x:this.x,dashes:this.dashes,alpha:this.globalAlpha})}};
  const p=(x,depth)=>({x,y:0,depth,scaleFactor:1,opacity:1,isVisible:true,distanceAU:40});
  const paths=[{points:[p(0,-10),p(17,-10),p(37,-10),p(100,10)],color:'#999',opacity:1,emphasized:false}];
  drawOrbitPaths(ctx,paths,view);
  assert.equal(calls.length,3);
  assert.ok(calls.every(c=>c.dashes.length===0),'every orbital segment must remain solid');
  calls.length=0;
  drawOrbitPaths(ctx,[...paths,{...paths[0],emphasized:true}],view);
  assert.ok(calls.filter(c=>c.x===0).some(c=>c.alpha<0.2),'unselected orbits recede when a target is selected');
});
