import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';

const { createKeplerOrbitCurve, curveFromOrbitPoints, sampleOrbitCurve } = await importTs(new URL('../core/orbitGeometry.ts', import.meta.url));
const { getOrbitCurve } = await importTs(new URL('../core/orbitCache.ts', import.meta.url));
const { createSceneView } = await importTs(new URL('../core/sceneView.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const elements = { a: 1, e: 0, i: 0, N: 0, w: 0, M: 0 };
const finite = p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z);
const segments = points => points.slice(1).flatMap((b, i) => finite(points[i]) && finite(b) ? [[points[i], b]] : []);

test('camera-adaptive orbit curves retain subpixel geometry while flying beside an orbit', () => {
  const ellipse = createKeplerOrbitCurve(elements), zoom = 1e6, focus = ellipse.at(.113);
  let evaluations = 0;
  const curve = { ...ellipse, at(t) { evaluations++; return ellipse.at(t); } };
  const project = p => ({ x: (p.x - focus.x) * zoom + 400, y: (p.y - focus.y) * zoom + 300, isVisible: true });
  const points = sampleOrbitCurve(curve, { project, width: 800, height: 600 });
  const drawn = segments(points);
  assert.ok(drawn.length > 1, 'the nearby curved arc must not vanish between coarse samples');
  for (const [a, b] of drawn) {
    const chordRadius = Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2);
    assert.ok((1 - chordRadius) * zoom < .46, 'visible chords must stay within the screen error tolerance');
  }
  assert.ok(evaluations < 500, 'offscreen parts should not consume a full high-detail orbit');
  const oldError = (1 - Math.cos(Math.PI / 180)) * zoom;
  assert.ok(oldError > 150, 'the previous fixed 180-point approximation misses this view by hundreds of pixels');
});

test('near-plane crossings and exhausted sampling budgets create pen lifts, never false connecting tracks', () => {
  const curve = createKeplerOrbitCurve(elements);
  const points = sampleOrbitCurve(curve, {
    width: 800, height: 600,
    project(p) {
      const depth = .2 + p.y;
      return { x: 400 + 200 * p.x / depth, y: 300 + 50 / depth, isVisible: depth > 1e-5 };
    },
  });
  assert.ok(segments(points).length > 0);
  assert.ok(points.some(p => !finite(p)), 'behind-camera intervals must separate the path');
  for (const [a, b] of segments(points)) assert.ok(a.y + .2 > 0 && b.y + .2 > 0);
  const magnification = 1e8;
  const limited = sampleOrbitCurve(curve, {
    width: 1e9, height: 1e9, maxPoints: 128,
    project: p => ({ x: 5e8 + p.x * magnification, y: 5e8 + p.y * magnification, isVisible: true }),
  });
  assert.ok(limited.some(p => !finite(p)), 'budget exhaustion must lift the pen');
  for (const [a, b] of segments(limited)) {
    assert.ok((1 - Math.hypot((a.x + b.x) / 2, (a.y + b.y) / 2)) * magnification < .46);
  }
});

test('satellite barycentric ellipses are reconstructed as curves rather than subdivided chords', () => {
  const source = createKeplerOrbitCurve({ ...elements, a: .003, e: .3, i: 27, N: 52, w: 14 });
  const translate = p => ({ x: p.x * -.1 + .002, y: p.y * -.1 - .004, z: p.z * -.1 + .001 });
  const points = Array.from({ length: 181 }, (_, i) => translate(source.at(i / 180)));
  const recovered = curveFromOrbitPoints(points);
  for (const t of [.012345, .27891, .918273]) {
    const expected = translate(source.at(t)), actual = recovered.at(t);
    assert.ok(Math.hypot(actual.x - expected.x, actual.y - expected.y, actual.z - expected.z) < 1e-16);
  }
});

test('precise adaptive curves cache ephemeris evaluations and honor edited orbit or dynamics', () => {
  let calls = 0;
  globalThis.Astronomy = {
    Body: { Earth: 'earth' }, MakeTime: d => d,
    HelioVector: (_, date) => { calls++; return { x: date.getTime() / 86400000, y: 2, z: 0 }; },
  };
  try {
    const body = { id: 'earth', elements: { ...elements } }, date = new Date(10 * 86400000);
    const curve = getOrbitCurve(body, date, true);
    assert.equal(curve.closed, false, 'a perturbed year must not be closed with an artificial seam');
    const a = curve.at(.12345);
    assert.equal(curve.at(.12345), a);
    assert.equal(calls, 1);
    assert.equal(getOrbitCurve(body, new Date(20 * 86400000), true), curve);
    assert.notEqual(getOrbitCurve(body, new Date(31 * 86400000), true), curve);
    for (const field of ['isCustom', 'hasCustomOrbit', 'hasCustomDynamics']) {
      body[field] = true;
      const edited = getOrbitCurve(body, date, true);
      assert.equal(edited.closed, true);
      assert.equal(edited.at(0).x, 1);
      assert.equal(calls, 1, 'edited dynamics must not silently use built-in ephemerides');
      delete body[field];
    }
    body.elements.a = 2;
    assert.notEqual(getOrbitCurve(body, date, false).at(0).x, 1);
  } finally { delete globalThis.Astronomy; }
});

test('camera frustum sampling preserves narrow nearby arcs through pan, zoom and near-plane crossings', () => {
  const curve = createKeplerOrbitCurve(elements);
  const distanceToSegment = (point, a, b) => {
    const dx = b.screenX - a.screenX, dy = b.screenY - a.screenY;
    const length = dx * dx + dy * dy;
    const t = length ? Math.max(0, Math.min(1, ((point.screenX - a.screenX) * dx + (point.screenY - a.screenY) * dy) / length)) : 0;
    return Math.hypot(point.screenX - a.screenX - t * dx, point.screenY - a.screenY - t * dy);
  };
  let visibleSamples = 0;
  for (let i = 0; i < 200; i++) {
    const tilt = [0, .001, .1, 7, 45, 90][i % 6];
    const k = [.04, .1, 1, 10, 1000, 1e5][Math.floor(i / 6) % 6];
    const pan = [0, 100, -200][Math.floor(i / 36) % 3], phase = (i * .7319) % 1;
    const frame = createSceneView({ scale: 23500, width: 800, height: 600, center: curve.at(phase),
      settings: { ...SYSTEM_DEFAULTS, trueScale: true, enablePerspective: true, enableProximitySim: true, viewTilt: tilt, viewYaw: i * 31 },
      zoom: { x: 400 + pan, y: 300, k } });
    let calls = 0;
    const points = sampleOrbitCurve({ ...curve, at(t) { calls++; return curve.at(t); } }, {
      width: 800, height: 600, camera: frame,
      project(p) { const q = frame.project(p); return { x: q.screenX, y: q.screenY, isVisible: q.isVisible }; },
    });
    const drawn = segments(points).map(([a, b]) => frame.clipSegment(frame.toCamera(a), frame.toCamera(b))).filter(Boolean);
    const span = Math.min(.5, 5 * frame.worldUnitsPerPixel * 800 / (2 * Math.PI));
    for (let j = 0; j < 300; j++) {
      const point = frame.project(curve.at(phase - span + 2 * span * j / 300));
      if (!point.isVisible || point.screenX < 0 || point.screenX > 800 || point.screenY < 0 || point.screenY > 600) continue;
      visibleSamples++;
      const error = Math.min(...drawn.map(([a, b]) => distanceToSegment(point, a, b)));
      assert.ok(error <= .46, `case ${i}: visible curve disappeared or deviated by ${error}px at k=${k}, tilt=${tilt}`);
    }
    assert.ok(calls < 500, `case ${i}: local view should not refine the entire remote ellipse`);
  }
  assert.ok(visibleSamples > 5000, 'exercise continuous on-screen curves, including very narrow front-facing intervals');
});

test('a repeated precise camera frame reuses ephemeris work and distant curves stay cheap', () => {
  const names = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto'];
  const radii = [.387, .723, 1, 1.524, 5.203, 9.537, 19.191, 30.069, 39.482];
  const epsilon = 23.4392911 * Math.PI / 180;
  let evaluations = 0;
  globalThis.Astronomy = {
    Body: Object.fromEntries(names.map(name => [name, name])), MakeTime: date => date,
    HelioVector(name, date) {
      evaluations++;
      const a = radii[names.indexOf(name)], angle = date.getTime() / 86400000 / (365.25 * a ** 1.5) * 2 * Math.PI;
      return { x: a * Math.cos(angle), y: a * Math.sin(angle) * Math.cos(epsilon), z: a * Math.sin(angle) * Math.sin(epsilon) };
    },
  };
  try {
    const date = new Date(10 * 86400000);
    const frame = createSceneView({ scale: 23500, width: 800, height: 600, center: { x: 1, y: 0, z: 0 },
      settings: { ...SYSTEM_DEFAULTS, trueScale: true, enablePerspective: true, enableProximitySim: true, viewTilt: 7, viewYaw: 0 },
      zoom: { x: 400, y: 300, k: 20 } });
    const curves = names.map((name, i) => getOrbitCurve({ id: name.toLowerCase(), elements: { ...elements, a: radii[i] } }, date, true));
    const sampleAll = () => curves.forEach(curve => sampleOrbitCurve(curve, { width: 800, height: 600, camera: frame,
      project(p) { const q = frame.project(p); return { x: q.screenX, y: q.screenY, isVisible: q.isVisible }; } }));
    sampleAll();
    const initial = evaluations;
    assert.ok(initial < 1500, 'a local view must not request thousands of ephemeris points for every planet');
    sampleAll();
    assert.equal(evaluations, initial, 'unchanged camera geometry must reuse all precise evaluations');
  } finally { delete globalThis.Astronomy; }
});
