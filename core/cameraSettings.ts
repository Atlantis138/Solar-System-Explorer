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
  if (version >= 4) return current;
  if (version >= 3) return {...current,cameraSettingsVersion:4};
  return { ...current, cameraSettingsVersion: 4, enableProximitySim: true, cameraFov: 72, cameraPerspective: 1,
    ...(version < 1 && saved.orbitPerspectiveIntensity !== undefined
      ? { orbitPerspectiveIntensity: saved.orbitPerspectiveIntensity / 4 } : {}),
    ...(saved.showCameraControl && !saved.enableSpaceView ? { enableSpaceView: true, enablePerspective: true } : {}),
  };
}
