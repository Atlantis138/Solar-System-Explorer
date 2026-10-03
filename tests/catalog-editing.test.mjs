import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importTs } from './helpers/import-ts.mjs';
const { mergeCatalogSources, replaceCatalogBlock, validateCatalogEdit } = await importTs(new URL('../utils/DataLoader.ts', import.meta.url));
const { calculatePlanetarySystem } = await importTs(new URL('../utils/astronomy.ts', import.meta.url));
const official = readFileSync(new URL('../public/data/solar_system.txt', import.meta.url), 'utf8');
const original = mergeCatalogSources(official);
const J2000 = new Date('2000-01-01T12:00:00Z');
const get = (catalog, id) => catalog.allObjects.find(body => body.id === id);
const norm = p => Math.hypot(p.x, p.y, p.z);
// Deliberately hypothetical parameters, not a claim about the observed Makemake moon.
const hypotheticalMoon = `[SATELLITE]
id: makemake_test_moon
parent: makemake
name: 假设卫星（测试）
massRelativeToSun: 1e-10
orbitReference: parent
elements: .00015 0 0 0 0 0
epochJD: 2451545
periodDays: 20`;
const editedMakemake = get(original, 'makemake').rawContent + '\nmassRelativeToSun: 2e-9\n# Assumed mass for testing only\n';

test('a locally edited Makemake and hypothetical moon produce mass-weighted motion and a complete orbit', () => {
  const catalog = mergeCatalogSources(official, hypotheticalMoon, editedMakemake);
  assert.deepEqual(catalog.errors, []);
  const root = get(catalog, 'makemake');
  assert.equal(root.isOverridden, true);
  assert.equal(root.isCustom, false);
  assert.equal(root.originalRawContent, get(original, 'makemake').rawContent);
  assert.equal(root.orbitReference, 'system-barycenter');
  assert.equal(root.hasCustomDynamics, true);
  const first = calculatePlanetarySystem(root, J2000, true);
  const half = calculatePlanetarySystem(root, new Date(+J2000 + 10 * 86400000), true);
  const last = calculatePlanetarySystem(root, new Date(+J2000 + 20 * 86400000), true);
  assert.ok(norm(first.parentOffset) > 0);
  assert.ok(Math.abs(first.parentOffset.x + half.parentOffset.x) < 1e-14);
  assert.ok(Math.abs(first.parentOffset.x - last.parentOffset.x) < 1e-14);
  const moon = first.satellitePositions.get('makemake_test_moon');
  for (const axis of ['x', 'y', 'z']) {
    const center = (first.parentPosition[axis] * 2e-9 + moon[axis] * 1e-10) / 2.1e-9;
    assert.ok(Math.abs(center - first.barycenter[axis]) < 1e-12);
  }
});

test('missing masses are explicit; absent period and parent mass cannot silently freeze a satellite', () => {
  const unsupported = mergeCatalogSources(official, hypotheticalMoon.replace('periodDays: 20', ''));
  assert.equal(get(unsupported, 'makemake_test_moon').isValid, false);
  assert.match(unsupported.errors.join('\n'), /massRelativeToSun.*periodDays/);
  const tracer = mergeCatalogSources(official, hypotheticalMoon);
  assert.equal(get(tracer, 'makemake_test_moon').isValid, true);
  assert.match(get(tracer, 'makemake_test_moon').dataWarnings.join('\n'), /缺少质量/);
  assert.equal(calculatePlanetarySystem(get(tracer, 'makemake'), J2000).usesBarycenter, false);
  const massless = mergeCatalogSources(official, hypotheticalMoon.replace('massRelativeToSun: 1e-10', ''), editedMakemake);
  assert.match(get(massless, 'makemake_test_moon').dataWarnings.join('\n'), /示踪卫星/);
});

test('restoring a built-in edit does not delete custom moons or invent a parent mass', () => {
  const overrides = replaceCatalogBlock('', 'makemake', editedMakemake);
  assert.equal(mergeCatalogSources(official, hypotheticalMoon, overrides).dwarfs.find(b => b.id === 'makemake').massRelativeToSun, 2e-9);
  const restored = mergeCatalogSources(official, hypotheticalMoon, replaceCatalogBlock(overrides, 'makemake'));
  assert.equal(get(restored, 'makemake').massRelativeToSun, undefined);
  assert.equal(get(restored, 'makemake').isOverridden, undefined);
  assert.equal(get(restored, 'makemake').satellites[0].id, 'makemake_test_moon');
});

test('editing and replacement reject duplicate identities, malformed numbers and broken parent relationships', () => {
  assert.deepEqual(validateCatalogEdit(editedMakemake, original.allObjects, 'makemake').errors, []);
  assert.ok(validateCatalogEdit(editedMakemake, original.allObjects).errors.length);
  assert.ok(validateCatalogEdit(editedMakemake.replace('id: makemake', 'id: replacement'), original.allObjects, 'makemake').errors.length);
  assert.ok(validateCatalogEdit(hypotheticalMoon.replace('1e-10', '1e-10garbage'), original.allObjects).errors.length);
  assert.ok(validateCatalogEdit(hypotheticalMoon.replace('parent: makemake', 'parent: absent'), original.allObjects).errors.length);
  assert.ok(validateCatalogEdit(hypotheticalMoon.replace('parent: makemake', ''), original.allObjects).errors.length);
  const text = hypotheticalMoon + '\n\n' + hypotheticalMoon.replaceAll('makemake_test_moon', 'second_moon');
  const replaced = replaceCatalogBlock(text, 'makemake_test_moon', hypotheticalMoon.replace('1e-10', '2e-10'));
  const catalog = mergeCatalogSources(official, replaced, editedMakemake);
  assert.equal(get(catalog, 'makemake').satellites.length, 2);
  assert.equal(get(catalog, 'makemake_test_moon').massRelativeToSun, 2e-10);
});

test('invalid local override keeps the built-in entry intact and reports the rejected override', () => {
  for (const text of [editedMakemake.replace('2e-9', '-1'), editedMakemake.replace('[DWARF]', '[PLANET]'), editedMakemake + '\nparent: earth']) {
    const result = mergeCatalogSources(official, '', text);
    assert.equal(get(result, 'makemake').isOverridden, undefined);
    assert.equal(get(result, 'makemake').isValid, true);
    assert.match(result.errors.join('\n'), /本地修改未应用/);
  }
});

test('cosmetic edits keep precision ephemerides; changed orbits, masses and new moons use editable dynamics', () => {
  const earth = get(original, 'earth');
  globalThis.Astronomy = {Body: {Earth: 'Earth'}, MakeTime: t => t, HelioVector: () => ({x: 1, y: 0, z: 0}), GeoMoonState: () => ({x: .00257, y: 0, z: 0, vx: 0, vy: .00059, vz: 0})};
  try {
    const renamed = mergeCatalogSources(official, '', earth.rawContent.replace('name: 地球', 'name: 地球（本地）'));
    assert.equal(calculatePlanetarySystem(get(renamed, 'earth'), J2000, true).preciseParent, true);
    for (const edit of [earth.rawContent.replace(/massRelativeToSun: [^\n]+/, 'massRelativeToSun: 6e-6'), earth.rawContent + '\nperiodDays: 400']) {
      const changed = mergeCatalogSources(official, '', edit);
      const system = calculatePlanetarySystem(get(changed, 'earth'), J2000, true);
      assert.equal(system.preciseParent, false);
      assert.equal(system.relativeStates.get('moon').precise, false);
    }
    const extraMoon = hypotheticalMoon.replace('parent: makemake', 'parent: earth');
    const extended = mergeCatalogSources(official, extraMoon);
    assert.equal(get(extended, 'earth').hasCustomDynamics, true);
    assert.equal(calculatePlanetarySystem(get(extended, 'earth'), J2000, true).preciseParent, false);
  } finally { delete globalThis.Astronomy; }
});
