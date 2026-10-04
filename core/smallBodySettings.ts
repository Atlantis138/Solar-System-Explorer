import type { AppSettings, PlanetData } from '../types';

/** Origins and physical categories are orthogonal. The interstellar switch
 * controls the flagged visitors; ordinary comet/asteroid switches control the rest. */
export function smallBodyVisible(body: PlanetData, settings: AppSettings): boolean {
  if (!settings.showAsteroidsComets) return false;
  if (body.interstellar) return settings.showInterstellar !== false;
  return body.type === 'comet' ? settings.showComets !== false : settings.showAsteroids !== false;
}

/** Preserve the old independently visible belt when grouping its controls.
 * This migration changes controls, not the user's existing scene. */
export function migrateSmallBodySettings(saved: Partial<AppSettings>): Partial<AppSettings> {
  if (saved.smallBodySettingsVersion === 1) return saved;
  const bodies = saved.showAsteroidsComets === true;
  const populations = saved.showAsteroidBelt !== false || Object.values(saved.populationVisibility ?? {}).some(Boolean);
  return { ...saved, smallBodySettingsVersion: 1,
    showAsteroidsComets: bodies || populations, showComets: bodies, showAsteroids: bodies,
    showInterstellar: bodies, showCometTails: true, showSmallBodyPopulations: true };
}

export function revealSmallBody(body: PlanetData, settings: AppSettings): AppSettings {
  return { ...settings, showAsteroidsComets: true,
    ...(body.interstellar ? { showInterstellar: true } : body.type === 'comet' ? { showComets: true } : { showAsteroids: true }) };
}
