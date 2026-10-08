import type { AppSettings } from '../types';

/** Enabling movement always starts with perspective; orthographic remains optional. */
export function setCameraMovement(settings: AppSettings, enabled: boolean): AppSettings {
  if (!enabled) return { ...settings, showCameraControl: false };
  return { ...settings, showCameraControl: true, enableSpaceView: true,
    enablePerspective: true, enableProximitySim: true,
    cameraPerspective: settings.cameraPerspective || 1 };
}

export function migrateCameraSettings(saved: Partial<AppSettings>): Partial<AppSettings> {
  const {cameraTravelSpeed: _obsoleteSpeed,...current}=saved;
  const version = current.cameraSettingsVersion ?? 0;
  if (version >= 5) return current;
  const perspectiveDefault=current.enablePerspective===false || current.cameraPerspective===0
    ? {enablePerspective:true,cameraPerspective:1} : {};
  if (version >= 3) return {...current,...perspectiveDefault,cameraSettingsVersion:5};
  return { ...current, ...perspectiveDefault, cameraSettingsVersion: 5, enableProximitySim: true, cameraFov: 72, cameraPerspective: 1,
    ...(version < 1 && saved.orbitPerspectiveIntensity !== undefined
      ? { orbitPerspectiveIntensity: saved.orbitPerspectiveIntensity / 4 } : {}),
    ...(saved.showCameraControl && !saved.enableSpaceView ? { enableSpaceView: true, enablePerspective: true } : {}),
  };
}
