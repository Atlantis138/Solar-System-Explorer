import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const { parseNearbyCatalog, nearbyRadius, nearbyOpacity, nearbyFitZoom, solarZoomExtent,
  nearbyPositionAU, projectNearbyStars, pickNearbyStar, LIGHT_YEAR_AU, loadNearbyCatalog } =
  await importTs(new URL('../core/nearbyStars.ts', import.meta.url));
const { createSceneView } = await importTs(new URL('../core/sceneView.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const catalog = JSON.parse(readFileSync(new URL('../public/data/nearby_stars.json', import.meta.url)));
const source = JSON.parse(readFileSync(new URL('../public/data/nearby-star-sources.json', import.meta.url)));
const view = (radius, width = 1280, height = 800, perspective = true, yaw = 0, tilt = 35) => createSceneView({
  scale: 65, settings: { ...SYSTEM_DEFAULTS, enablePerspective: perspective, enableProximitySim: true, viewTilt: tilt, viewYaw: yaw },
  width, height, zoom: { x: width / 2, y: height / 2, k: nearbyFitZoom(radius, width, height, perspective) }, center: { x: 0, y: 0, z: 0 },
});

test('offline volume selection retains faint neighbours, components, provenance and J2000 units', () => {
  assert.equal(parseNearbyCatalog(catalog), catalog);
  assert.equal(catalog.stars.length, 4059);
  for (const radius of [25, 50, 100]) assert.equal(catalog.stars.filter(s => s.distanceLy <= radius).length, source.counts[radius]);
  assert.equal(source.license, 'CC BY-SA 4.0');
  assert.equal(source.revision.length, 40);
  assert.equal(source.inputs['hygdata_v41.csv'], 'd9f69fd86bbf90a4e4d52b4c5c53eacfa6dfc0bfdef85bfd94f095e0bebe4ebd');
  const proxima = catalog.stars.find(s => s.id === 'hyg_70666');
  assert.equal(proxima.name, '比邻星');
  assert.ok(proxima.magnitude > 6.5 && proxima.distanceLy > 4.2 && proxima.distanceLy < 4.3);
  assert.ok(catalog.stars.some(s => s.name === '天狼星A'));
  assert.ok(catalog.stars.some(s => s.name === '天狼星B'));
  assert.ok(!catalog.stars.some(s => s.id === 'hyg_0'));
  // Independent J2000 equatorial reference: Sirius RA 101.287°, Dec -16.716°.
  // Undo ecliptic rotation to detect hour/degree errors, wrong sign or wrong handedness.
  const sirius = catalog.stars.find(s => s.name === '天狼星A');
  const p = sirius.position, eps = 23.4392911 * Math.PI / 180;
  const y = p.y * Math.cos(eps) - p.z * Math.sin(eps), z = p.y * Math.sin(eps) + p.z * Math.cos(eps);
  assert.ok(Math.abs(Math.atan2(y, p.x) * 180 / Math.PI - 101.287) < .003);
  assert.ok(Math.abs(Math.asin(z / sirius.distanceLy) * 180 / Math.PI + 16.716) < .003);
  assert.ok(Math.abs(Math.hypot(...Object.values(nearbyPositionAU(sirius))) / LIGHT_YEAR_AU - sirius.distanceLy) < 1e-7);
});

test('invalid catalog units, unknown distances, malformed coordinates and duplicates fail visibly', () => {
  for (const patch of [{ epoch: 'J2016.0' }, { positionUnit: 'pc' }, { frame: 'ICRS' }, { stars: [] }]) {
    assert.throws(() => parseNearbyCatalog({ ...catalog, ...patch }));
  }
  const first = catalog.stars[0];
  for (const patch of [{ distanceLy: 0 }, { distanceLy: 1e5 }, { position: { x: NaN, y: 1, z: 0 } }, { distanceLy: 5 }]) {
    assert.throws(() => parseNearbyCatalog({ ...catalog, stars: [{ ...first, ...patch }] }));
  }
  assert.throws(() => parseNearbyCatalog({ ...catalog, stars: [first, first] }));
});

test('transition follows physical screen span; old preferences default safely; true scale is excluded', () => {
  assert.equal(nearbyRadius({}), 50); assert.equal(nearbyRadius({ nearbyStarRadiusLy: 500 }), 50);
  assert.equal(nearbyRadius({ nearbyStarRadiusLy: 25 }), 25);
  assert.equal(nearbyOpacity(SYSTEM_DEFAULTS, .8, 1280, 800), 0);
  assert.equal(nearbyOpacity(SYSTEM_DEFAULTS, 1e-6, 1280, 800), 1);
  assert.equal(nearbyOpacity({ ...SYSTEM_DEFAULTS, trueScale: true }, 1e-6, 1280, 800), 0);
  assert.equal(nearbyOpacity({ ...SYSTEM_DEFAULTS, showNearbyStars: false }, 1e-6, 1280, 800), 0);
  const mid = nearbyOpacity(SYSTEM_DEFAULTS, 1e-4, 1280, 800);
  assert.ok(mid > 0 && mid < 1);
  assert.equal(mid, nearbyOpacity(SYSTEM_DEFAULTS, 5e-5, 640, 400));
  const limits = solarZoomExtent(false, true);
  assert.ok(limits[0] < nearbyFitZoom(100, 390, 700, true));
  assert.deepEqual(solarZoomExtent(false, false), [1e-4, 100]);
});

test('sphere fit includes nearer hemisphere in every orientation, viewport and projection', () => {
  for (const radius of [25, 50, 100]) for (const [w, h] of [[1280, 800], [390, 844], [844, 390]]) {
    const stars = catalog.stars.filter(s => s.distanceLy <= radius);
    for (const perspective of [true, false]) for (const [yaw, tilt] of [[0, 90], [47, 35], [284, -50]]) {
      const scene = view(radius, w, h, perspective, yaw, tilt);
      const points = projectNearbyStars(stars, scene);
      assert.equal(points.length, stars.length);
      assert.ok(points.every(p => Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= w && p.y >= 0 && p.y <= h));
      assert.ok(points.every(p => p.radius >= .45 && p.radius <= 4.8));
    }
  }
});

test('projection excludes offscreen and rear stars; picking uses screen pixels after pan/zoom', () => {
  const stars = catalog.stars.filter(s => s.distanceLy <= 50), scene = view(50);
  const all = projectNearbyStars(stars, scene), proxima = all.find(p => p.star.id === 'hyg_70666');
  assert.equal(pickNearbyStar(all, proxima.x + 1, proxima.y + 1)?.id, proxima.star.id);
  assert.equal(pickNearbyStar(all, -500, -500), null);
  const close = createSceneView({ scale: 65, settings: { ...SYSTEM_DEFAULTS, enablePerspective: true, enableProximitySim: true },
    width: 1280, height: 800, zoom: { x: 4000, y: 400, k: .01 }, center: { x: 0, y: 0, z: 0 } });
  assert.ok(projectNearbyStars(stars, close).length < all.length);
  assert.ok(projectNearbyStars(stars, close).every(p => p.x >= -29 && p.x <= 1309 && p.y >= -29 && p.y <= 829));
});

test('lazy loader shares in-flight and cached requests; failed fetches can be retried', async () => {
  const original = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => { requests++; return { ok: false, status: 503 }; };
  try {
    await assert.rejects(loadNearbyCatalog(), /503/);
    assert.equal(requests, 1);
    globalThis.fetch = async () => { requests++; return { ok: true, json: async () => catalog }; };
    const first = loadNearbyCatalog(), second = loadNearbyCatalog();
    assert.equal(first, second);
    assert.equal(await first, catalog);
    assert.equal(await loadNearbyCatalog(), catalog);
    assert.equal(requests, 2);
  } finally { globalThis.fetch = original; }
});
