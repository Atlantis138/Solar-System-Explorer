import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const { equatorialToEcliptic, createSkyProjection, sampleSkyArc } = await importTs(new URL('../core/celestial.ts', import.meta.url));
const stars = JSON.parse(readFileSync(new URL('../public/data/real_stars.json', import.meta.url)));
const figures = JSON.parse(readFileSync(new URL('../public/data/constellations.json', import.meta.url)));

test('catalog contains valid unique HIP stars and all 88 complete figures', () => {
  const ids = new Set(stars.map(s => s.id));
  assert.equal(ids.size, stars.length);
  assert.equal(stars.length, 8876);
  assert.equal(new Set(figures.map(c => c.id)).size, 88);
  assert.equal(figures.reduce((sum, c) => sum + c.lines.length, 0), 743);
  for (const s of stars) {
    assert.ok(s.ra >= 0 && s.ra < 360 && s.dec >= -90 && s.dec <= 90);
    assert.ok(Number.isFinite(s.mag));
    assert.match(s.color, /^#[0-9a-f]{6}$/i);
  }
  const anchors = new Set();
  for (const c of figures) {
    assert.ok(c.lines.length > 0);
    for (const line of c.lines) {
      assert.equal(line.length, 2);
      for (const id of line) { assert.ok(ids.has(id), `${c.id}: missing ${id}`); anchors.add(id); }
    }
  }
  for (const s of stars.filter(s => s.mag > 6.5)) assert.ok(anchors.has(s.id));
  assert.ok(figures.some(c => c.id === 'Ser'));
});

test('J2000 reference stars and coordinate handedness remain correct', () => {
  const sirius = stars.find(s => s.id === 'hip_32349');
  assert.equal(sirius.englishName, 'Sirius');
  assert.ok(Math.abs(sirius.ra - 101.287) < 0.01);
  assert.ok(Math.abs(sirius.dec + 16.716) < 0.01);
  const equinox = equatorialToEcliptic(0, 0);
  assert.deepEqual(equinox, { x: 1, y: 0, z: 0 });
  const solstice = equatorialToEcliptic(90, 23.4392911);
  assert.ok(Math.abs(solstice.z) < 1e-10);
  assert.ok(Math.abs(solstice.y - 1) < 1e-10);
  const north = equatorialToEcliptic(0, 90);
  assert.ok(north.y > 0 && north.z > 0);
  const project = createSkyProjection(1000, 800, 90, 0);
  assert.ok(project({ x: 0, y: 0, z: -1 }).depth < 0);
  assert.equal(project({ x: 0, y: 0, z: -1 }).x, 500);
});

test('arcs take the short route across RA wrap', () => {
  const arc = sampleSkyArc(equatorialToEcliptic(359, 0), equatorialToEcliptic(1, 0));
  for (const p of arc) {
    assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - 1) < 1e-9);
    assert.ok(p.x > 0.99);
  }
});

test('infinite sky depends on direction, uses pinhole angles, and rejects the rear hemisphere', () => {
  const project = createSkyProjection(1000, 800, 90, 0);
  const a = project({ x: 0.3, y: 0.2, z: -1 });
  const b = project({ x: 3000000, y: 2000000, z: -10000000 });
  assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9);
  const focal = 400 / Math.tan(36 * Math.PI / 180);
  for (const degrees of [0, 10, 30, 45]) {
    const angle = degrees * Math.PI / 180;
    const p = project({ x: Math.sin(angle), y: 0, z: -Math.cos(angle) });
    assert.ok(Math.abs(p.x - (500 + focal * Math.tan(angle))) < 1e-9);
  }
  assert.ok(project({ x: 0, y: 0, z: 1 }).depth >= 0);
  assert.ok(project({ x: 0, y: 1, z: 0 }).depth >= 0);
});

test('camera-space line clipping is finite at the horizon and spans the viewport', () => {
  const project = createSkyProjection(1000, 800, 90, 0);
  const a = { x: -3, y: 0, z: -1 }, b = { x: 3, y: 0, z: -1 };
  const crossing = project.segment(a, b);
  assert.ok(crossing);
  assert.ok(Math.abs(crossing[0].x) < 1e-8);
  assert.ok(Math.abs(crossing[1].x - 1000) < 1e-8);
  assert.equal(project.segment({ x: 0, y: 0, z: 1 }, { x: 1, y: 1, z: 1 }), null);
  const horizon = project.segment({ x: 0, y: 0, z: -1 }, { x: 1, y: 0, z: 1 });
  assert.ok(horizon);
  for (const p of horizon) {
    assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    assert.ok(p.x >= -1e-8 && p.x <= 1000 + 1e-8 && p.y >= 0 && p.y <= 800);
  }
  const reversed = project.segment(b, a);
  for (let i = 0; i < 2; i++) for (const key of ['x', 'y', 'depth'])
    assert.ok(Math.abs(reversed[i][key] - crossing[1 - i][key]) < 1e-8);
});

test('direction and grids stay finite across yaw wrap and pole views', () => {
  for (const tilt of [-90, -45, 0, 45, 90]) for (const yaw of [0, 120, 359, 360]) {
    const project = createSkyProjection(390, 844, tilt, yaw);
    for (const star of stars) {
      const p = project(equatorialToEcliptic(star.ra, star.dec));
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  }
  const a = createSkyProjection(1000, 800, 40, 0);
  const b = createSkyProjection(1000, 800, 40, 360);
  const direction = { x: 0.1, y: 0.7, z: -0.4 };
  assert.ok(Math.abs(a(direction).x - b(direction).x) < 1e-8);
  assert.ok(Math.abs(a(direction).y - b(direction).y) < 1e-8);
});

test('all 88 constellations have closed J2000 regions, including both Serpens regions', () => {
  assert.equal(figures.reduce((n, c) => n + c.boundaries.length, 0), 89);
  assert.equal(figures.find(c => c.id === 'Ser').boundaries.length, 2);
  for (const c of figures) {
    assert.ok(c.labelPositions.length > 0);
    for (const ring of c.boundaries) {
      assert.deepEqual(ring[0], ring.at(-1));
      assert.ok(ring.length > 3);
      for (let i = 0; i < ring.length; i++) {
        const [ra, dec] = ring[i];
        assert.ok(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90);
        if (i) {
          const a = equatorialToEcliptic(...ring[i - 1]), b = equatorialToEcliptic(ra, dec);
          assert.ok(Math.hypot(a.x-b.x, a.y-b.y, a.z-b.z) < .027, `${c.id}: boundary sampling gap`);
        }
      }
    }
  }
});

test('region edges clip cleanly at the horizon, RA seam, and polar views', () => {
  for (const [tilt, yaw] of [[7, 0], [7, 359.9], [90, 180], [-90, 90]]) {
    const projection = createSkyProjection(1200, 800, tilt, yaw);
    let visible = 0;
    for (const c of figures) for (const ring of c.boundaries) for (let i = 1; i < ring.length; i++) {
      const segment = projection.segment(equatorialToEcliptic(...ring[i - 1]), equatorialToEcliptic(...ring[i]));
      if (!segment) continue;
      visible++;
      for (const p of segment) {
        assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
        assert.ok(p.x >= -1e-6 && p.x <= 1200+1e-6 && p.y >= -1e-6 && p.y <= 800+1e-6);
      }
    }
    assert.ok(visible > 100);
  }
});
