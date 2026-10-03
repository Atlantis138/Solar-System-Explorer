import type { AppSettings } from '../types';

/** Enabling movement always starts with perspective; orthographic remains optional. */
export function setCameraMovement(settings: AppSettings, enabled: boolean): AppSettings {
  return { ...settings, showCameraControl: enabled, enableSpaceView: enabled,
    enablePerspective: enabled, enableProximitySim: enabled };
}

export function migrateCameraSettings(saved: Partial<AppSettings>): Partial<AppSettings> {
  const version = saved.cameraSettingsVersion ?? 0;
  if (version >= 2) return saved;
  return { ...saved, cameraSettingsVersion: 2, enableProximitySim: true,
    ...(version < 1 && saved.orbitPerspectiveIntensity !== undefined
      ? { orbitPerspectiveIntensity: saved.orbitPerspectiveIntensity / 4 } : {}),
    ...(saved.showCameraControl && !saved.enableSpaceView ? { enableSpaceView: true, enablePerspective: true } : {}),
  };
}
