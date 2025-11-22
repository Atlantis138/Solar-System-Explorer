

import { RenderSettings, PlanetData, RenderQuality } from '../types';
import { smoothStep } from './projection';

// --- Constants ---
const INNER_SYSTEM_LIMIT_AU = 4.0;
const OUTER_SYSTEM_LIMIT_AU = 35.0;

const TRUE_SCALE_RATIO = 23500 / 65; // ~361.5

// Schematic Thresholds (Zoom K)
const SCHEMATIC_THRESHOLDS = {
    INNER: 0.34,
    OUTER: 0.28,
    COMET: 0.33
};

/**
 * Helper to get threshold based on mode
 */
const getThreshold = (type: 'INNER' | 'OUTER' | 'COMET', isTrueScale: boolean) => {
    const base = SCHEMATIC_THRESHOLDS[type];
    return isTrueScale ? base / TRUE_SCALE_RATIO : base;
};

/**
 * Calculates opacity based on Quality Setting and Threshold.
 * @param quality RenderQuality
 * @param k current zoom
 * @param threshold transition threshold
 * @param mode 'IN' (Visible when k > threshold) or 'OUT' (Visible when k < threshold)
 */
const getOpacityFromQuality = (quality: RenderQuality, k: number, threshold: number, mode: 'IN' | 'OUT'): number => {
    if (quality === 'performance') return 1.0;
    
    // Fade window width (approx +/- 10-20%)
    const range = threshold * 0.2; 
    const min = threshold - range / 2;
    const max = threshold + range / 2;

    if (mode === 'IN') {
        // Visible when Zoomed IN (k > threshold)
        if (quality === 'eco') return k > threshold ? 1.0 : 0.0;
        // Standard: Smooth fade
        return smoothStep(min, max, k);
    } else {
        // Visible when Zoomed OUT (k < threshold)
        if (quality === 'eco') return k < threshold ? 1.0 : 0.0;
        // Standard: Smooth fade (inverse)
        return 1.0 - smoothStep(min, max, k);
    }
};

/**
 * Calculates the opacity of a celestial body based on Zoom Level (k) and Render Settings.
 */
export const calculateBodyOpacity = (
    body: PlanetData,
    k: number, 
    settings: RenderSettings, 
    isTrueScale: boolean = false
): number => {
    const { id, elements, category, type } = body;
    const a = elements.a;

    if (id === 'sun') return 1.0;

    // Check Categories
    const isComet = category === 'COMET' || type === 'comet' || type === 'asteroid';
    const isPlanetOrDwarf = category === 'PLANET' || category === 'DWARF' || type === 'planet' || type === 'dwarf';

    // 1. Comet & Asteroid Rendering
    // Logic: Visible when screen scale > 3.3E-1x (Schematic) for bodies within 4AU
    if (isComet) {
        if (a <= INNER_SYSTEM_LIMIT_AU) {
            const threshold = getThreshold('COMET', isTrueScale);
            return getOpacityFromQuality(settings.cometQuality, k, threshold, 'IN');
        }
        // Comets > 4AU: Default to visible (or use outer logic? User spec only mentioned within 4AU)
        return 1.0;
    }

    if (isPlanetOrDwarf) {
        // 2. Inner Solar System Rendering
        // Logic: Visible when screen scale > 3.4E-1x for bodies within 4AU
        if (a <= INNER_SYSTEM_LIMIT_AU) {
            const threshold = getThreshold('INNER', isTrueScale);
            return getOpacityFromQuality(settings.innerQuality, k, threshold, 'IN');
        }

        // 3. Outer Solar System Rendering (TNOs)
        // Logic: Visible when screen scale < 2.8E-1x for bodies outside 35AU
        if (a >= OUTER_SYSTEM_LIMIT_AU) {
            const threshold = getThreshold('OUTER', isTrueScale);
            return getOpacityFromQuality(settings.outerQuality, k, threshold, 'OUT');
        }
    }

    // 4. Intermediate Bodies (Gas Giants etc between 4AU and 35AU)
    // Always visible
    return 1.0;
};

/**
 * Deprecated distance-based culling, replaced by opacity logic.
 * Keeping for compatibility if needed, but returning true to delegate to opacity.
 */
export const shouldRenderComet = (distanceAU: number, settings: RenderSettings): boolean => {
    return true; 
};

/**
 * Global Visibility Threshold
 */
export const getVisibilityThreshold = (isEco: boolean): number => {
    return isEco ? 0.9 : 0.01;
};