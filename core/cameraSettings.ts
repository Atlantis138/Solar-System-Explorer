import type { AppSettings } from '../types';

/** Enabling movement always starts with perspective; orthographic remains optional. */
export function setCameraMovement(settings: AppSettings, enabled: boolean): AppSettings {
  return { ...settings, showCameraControl: enabled, enableSpaceView: enabled,
    enablePerspective: enabled, enableProximitySim: true,
    cameraPerspective: enabled ? (settings.cameraPerspective || 1) : settings.cameraPerspective };
}

export function migrateCameraSettings(saved: Partial<AppSettings>): Partial<AppSettings> {
  const version = saved.cameraSettingsVersion ?? 0;
  if (version >= 3) return saved;
  return { ...saved, cameraSettingsVersion: 3, enableProximitySim: true, cameraFov: 72, cameraPerspective: 1, cameraTravelSpeed: 1,
    ...(version < 1 && saved.orbitPerspectiveIntensity !== undefined
      ? { orbitPerspectiveIntensity: saved.orbitPerspectiveIntensity / 4 } : {}),
    ...(saved.showCameraControl && !saved.enableSpaceView ? { enableSpaceView: true, enablePerspective: true } : {}),
  };
}
