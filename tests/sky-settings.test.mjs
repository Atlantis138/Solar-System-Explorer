import test from 'node:test';
import assert from 'node:assert/strict';
import { importTs } from './helpers/import-ts.mjs';
const { SKY_DEFAULTS, SKY_BRIGHTNESS_BASE, applySkyPreset, selectedSkyPreset, migrateSkySettings } = await importTs(new URL('../core/skySettings.ts', import.meta.url));
const { SYSTEM_DEFAULTS } = await importTs(new URL('../data/default_settings.ts', import.meta.url));
const { setCameraMovement, migrateCameraSettings } = await importTs(new URL('../core/cameraSettings.ts', import.meta.url));

test('reference screenshot becomes the 100% default without changing its brightness', () => {
  for (const key of Object.keys(SKY_BRIGHTNESS_BASE)) assert.equal(SYSTEM_DEFAULTS[key], 1);
  assert.equal(SKY_DEFAULTS.realStarMagnitudeLimit, 6);
  assert.equal(SKY_DEFAULTS.showConstellations, true);
  assert.equal(SKY_DEFAULTS.realStarLabels, 'cn');
  assert.equal(SKY_DEFAULTS.showEclipticGrid, false);
  assert.equal(SKY_DEFAULTS.showEquatorialGrid, false);
  const reference = { realStarBrightnessMultiplier: 2, constellationBrightnessMultiplier: 1.2, starLabelBrightness: 0.45 };
  for (const [key, value] of Object.entries(reference)) assert.equal(SYSTEM_DEFAULTS[key] * SKY_BRIGHTNESS_BASE[key], value);
  assert.equal(selectedSkyPreset(SYSTEM_DEFAULTS), 'rich');
});

test('saved custom brightness converts exactly once and preserves its rendered appearance', () => {
  const old = { skySettingsVersion: 2, realStarBrightnessMultiplier: 2, realStarMagnitudeLimit: 6,
    constellationBrightnessMultiplier: 1.2, starLabelBrightness: 0.45, gridOpacity: 0.4,
    starBrightness: 0.8, realStarLabels: 'bilingual', showConstellations: true, viewTilt: 23, trueScale: true };
  const upgraded = migrateSkySettings(old);
  for (const key of Object.keys(SKY_BRIGHTNESS_BASE))
    assert.ok(Math.abs(upgraded[key] * SKY_BRIGHTNESS_BASE[key] - old[key]) < 1e-10);
  for (const key of ['realStarLabels', 'realStarMagnitudeLimit', 'showConstellations', 'viewTilt', 'trueScale']) assert.equal(upgraded[key], old[key]);
  assert.deepEqual(migrateSkySettings(upgraded), upgraded);
  assert.equal(old.realStarBrightnessMultiplier, 2);
});

test('previous untouched defaults upgrade, while presets change only the sky', () => {
  const previous = { realStarBrightnessMultiplier: 0.55, realStarMagnitudeLimit: 5.5,
    showConstellations: false, realStarLabels: 'none', viewYaw: 42, trueScale: true, skySettingsVersion: 2 };
  const upgraded = migrateSkySettings(previous);
  assert.equal(upgraded.realStarMagnitudeLimit, 6);
  assert.equal(upgraded.realStarBrightnessMultiplier, 1);
  assert.equal(upgraded.viewYaw, 42);
  const rich = applySkyPreset({ ...SYSTEM_DEFAULTS, trueScale: true }, 'rich');
  assert.equal(rich.realStarMagnitudeLimit, 6);
  assert.equal(rich.trueScale, true);
  assert.equal(selectedSkyPreset(rich), 'rich');
  assert.equal(selectedSkyPreset({ ...rich, starLabelBrightness: 0.9 }), undefined);
});

test('movement enables real perspective immediately, and old contrast units migrate once', () => {
  const enabled = setCameraMovement(SYSTEM_DEFAULTS, true);
  assert.ok(enabled.showCameraControl && enabled.enableSpaceView && enabled.enablePerspective);
  assert.equal(enabled.enableProximitySim, true);
  const disabled = setCameraMovement(enabled, false);
  assert.ok(!disabled.showCameraControl && disabled.enablePerspective && disabled.enableSpaceView, 'disabling input preserves the lens and projection');
  assert.ok(setCameraMovement(disabled, true).enablePerspective);
  const old = { showCameraControl: true, enableSpaceView: false, enablePerspective: false, orbitPerspectiveIntensity: 4 };
  const migrated = migrateCameraSettings(old);
  assert.equal(migrated.orbitPerspectiveIntensity, 1);
  assert.ok(migrated.enablePerspective && migrated.enableProximitySim);
  assert.equal(migrateCameraSettings({ cameraSettingsVersion: 1, orbitPerspectiveIntensity: 1 }).orbitPerspectiveIntensity, 1);
  assert.equal(migrateCameraSettings({ cameraSettingsVersion: 2, enableProximitySim: false }).enableProximitySim, true);
  assert.deepEqual(migrateCameraSettings(migrated), migrated);
});


test('sky presets are none, simple, and the existing rich default; disabling does not affect planets', () => {
  const none = applySkyPreset({ ...SYSTEM_DEFAULTS, trueScale: true, orbitOpacity: .7 }, 'none');
  assert.equal(none.skyEnabled, false);
  assert.equal(selectedSkyPreset(none), 'none');
  assert.equal(none.trueScale, true);
  assert.equal(none.orbitOpacity, .7);
  const quiet = applySkyPreset(none, 'quiet');
  assert.equal(quiet.skyEnabled, true);
  assert.equal(quiet.showConstellations, false);
  assert.equal(quiet.realStarLabels, 'none');
  assert.equal(selectedSkyPreset(quiet), 'quiet');
  assert.equal(selectedSkyPreset(applySkyPreset(quiet, 'rich')), 'rich');
  const savedV3 = { skySettingsVersion: 3, realStarBrightnessMultiplier: .8 };
  assert.equal(migrateSkySettings(savedV3).realStarBrightnessMultiplier, .8);
});

test('constellation names and boundaries default off for fresh settings and all presets', () => {
  assert.equal(SYSTEM_DEFAULTS.showConstellationNames, false);
  assert.equal(SYSTEM_DEFAULTS.showConstellationBoundaries, false);
  for (const id of ['none', 'quiet', 'rich']) {
    const next = applySkyPreset({ ...SYSTEM_DEFAULTS, showConstellationNames: true, showConstellationBoundaries: true }, id);
    assert.equal(next.showConstellationNames, false);
    assert.equal(next.showConstellationBoundaries, false);
  }
  assert.equal(selectedSkyPreset({ ...SYSTEM_DEFAULTS, showConstellationNames: true }), undefined);
});


test('old manual cruise multipliers are retired so they cannot bias automatic flight',()=>{
 const migrated=migrateCameraSettings({cameraSettingsVersion:3,cameraTravelSpeed:1e6,cameraFov:50,viewYaw:72});
 assert.equal(migrated.cameraSettingsVersion,4);assert.equal(migrated.cameraTravelSpeed,undefined);
 assert.equal(migrated.viewYaw,72);assert.equal(migrated.cameraFov,50);
 assert.equal(migrateCameraSettings({...migrated,cameraTravelSpeed:.05}).cameraTravelSpeed,undefined);
});
