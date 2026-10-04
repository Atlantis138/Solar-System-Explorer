import type { RenderSettings } from '../types';

/** Visual work budgets only; never change ephemeris accuracy, orbital elements
 * or elapsed simulation time. Interaction stays synchronized at display rate. */
export const RENDER_BUDGETS = {
  eco: { maxDpr:1.5, orbitTolerance:1, styleStep:40, beltParticles:320, tailSegments:8, simulationFps:30 },
  standard: { maxDpr:2, orbitTolerance:.65, styleStep:30, beltParticles:850, tailSegments:16, simulationFps:60 },
  performance: { maxDpr:Infinity, orbitTolerance:.45, styleStep:24, beltParticles:2000, tailSegments:24, simulationFps:60 },
} as const;
export function renderBudget(settings: RenderSettings) {
  return RENDER_BUDGETS[settings.sceneQuality ?? 'standard'];
}
