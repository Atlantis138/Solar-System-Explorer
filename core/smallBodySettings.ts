import type { AppSettings, PlanetData } from '../types';

/** Origins and physical categories are orthogonal. The interstellar switch
 * controls the flagged visitors; ordinary comet/asteroid switches control the rest. */
export function smallBodyVisible(body: PlanetData, settings: AppSettings): boolean {
  if (!settings.showAsteroidsComets) return false;
  if (body.interstellar) return settings.showInterstellar !== false;
  return body.type === 'comet' ? settings.showComets !== false : settings.showAsteroids !== false;
}

/** Each origin has its own tail switch, independent of the ordinary comet row. */
export function cometTailVisible(body: PlanetData, settings: AppSettings): boolean {
  return body.type === 'comet' && smallBodyVisible(body,settings) &&
    (body.interstellar ? settings.showInterstellarTails !== false : settings.showCometTails !== false);
}

/** Version 2 restores the main belt's independent catalog switch and merges
 * the other populations. Preserve the prior effective non-main selection. */
export function migrateSmallBodySettings(saved: Partial<AppSettings>): Partial<AppSettings> {
  if (saved.smallBodySettingsVersion === 2) return saved;
  const grouped = saved.smallBodySettingsVersion === 1;
  const master = saved.showAsteroidsComets === true;
  const nonMain = (!grouped || (master && saved.showSmallBodyPopulations !== false)) &&
    Object.entries(saved.populationVisibility ?? {}).some(([id,on]) => id !== 'main-asteroid-belt' && on);
  const comets = grouped ? saved.showComets !== false : master;
  const asteroids = grouped ? saved.showAsteroids !== false : master;
  const interstellar = grouped ? saved.showInterstellar !== false : master;
  return { ...saved, smallBodySettingsVersion: 2,
    showAsteroidsComets: (master && (comets || asteroids || interstellar)) || nonMain,
    showComets: comets, showAsteroids: asteroids, showInterstellar: interstellar,
    showCometTails: saved.showCometTails !== false,
    showInterstellarTails: saved.showCometTails !== false,
    showNonMainBeltPopulations: nonMain };
}

export function revealSmallBody(body: PlanetData, settings: AppSettings): AppSettings {
  return { ...settings, showAsteroidsComets: true,
    ...(body.interstellar ? { showInterstellar: true } : body.type === 'comet' ? { showComets: true } : { showAsteroids: true }) };
}
