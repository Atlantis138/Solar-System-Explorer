
import { RenderSettings } from '../types';
import { smoothStep } from './projection';

// --- Constants ---
// Distance Threshold between Inner and Outer System in AU
// Jupiter is 5.2 AU. Asteroid Belt is ~2.0-3.2 AU.
// We cut off at 4.8 AU to include Asteroid Belt in 'Inner' and start 'Outer' at Jupiter.
const INNER_SYSTEM_THRESHOLD_AU = 4.8;

const TIER_2_IDS = ['jupiter', 'saturn', 'uranus', 'neptune'];

// --- Helper: Determine if a body belongs to Inner or Outer group based on Semi-Major Axis ---
export const getBodyGroup = (id: string, semiMajorAxis: number): 'inner' | 'outer' | 'sun' => {
    if (id === 'sun') return 'sun';
    if (semiMajorAxis < INNER_SYSTEM_THRESHOLD_AU) return 'inner';
    return 'outer';
};

/**
 * Calculates the opacity of a celestial body based on Zoom Level (k) and Render Settings.
 * 
 * @param id Body ID
 * @param semiMajorAxis Semi-Major Axis in AU
 * @param k Current Zoom Level
 * @param settings RenderSettings object
 * @param isTrueScale Boolean flag indicating if the app is in True Scale mode
 * @returns opacity (0.0 - 1.0)
 */
export const calculateBodyOpacity = (
    id: string, 
    semiMajorAxis: number,
    k: number, 
    settings: RenderSettings, 
    isTrueScale: boolean = false
): number => {
    const group = getBodyGroup(id, semiMajorAxis);
    
    // Sun is always visible
    if (group === 'sun') return 1.0;

    // Gas Giants (Tier 2) are always visible in this simulation unless specific culling needed
    if (TIER_2_IDS.includes(id)) return 1.0;

    // --- Inner Solar System Logic ---
    if (group === 'inner') {
        const quality = settings.innerQuality;
        
        // Performance: Always visible
        if (quality === 'performance') return 1.0;

        // Thresholds for fading out inner planets when zooming out to outer system
        // Schematic: ~0.35 is where Saturn becomes dominant
        // True Scale: ~0.005 is where Inner System is visible, < 0.002 is Outer System view
        
        const fadeStart = isTrueScale ? 0.002 : 0.3;
        const fadeEnd   = isTrueScale ? 0.006 : 0.6;
        const cutoff    = isTrueScale ? 0.003 : 0.35;

        if (quality === 'eco') {
            // Eco: Hard Cutoff
            // If k > cutoff (Zoomed In) -> Visible
            // If k < cutoff (Zoomed Out) -> Hidden
            return k > cutoff ? 1.0 : 0.0;
        } else {
            // Standard: Smooth Fade
            // Specific adjustments per planet for better aesthetic in Schematic
            // (Optional fine-tuning can be added here if needed, but general fade is usually sufficient)
            if (!isTrueScale) {
                // Stagger fade for inner planets slightly?
                // Mercury (0.4 AU) fades last? No, Mercury fades first when zooming out.
                // Actually, when zooming OUT, k decreases.
                // We want inner planets to disappear when k is small (zoomed out).
            }
            return smoothStep(fadeStart, fadeEnd, k);
        }
    }

    // --- Outer Solar System (TNOs/Dwarfs) Logic ---
    if (group === 'outer') {
        const quality = settings.outerQuality;

        // Performance: Always visible
        if (quality === 'performance') return 1.0;

        // TNOs should fade out when zooming IN (becoming too sparse/cluttering)
        // Schematic: ~0.15 is around Neptune orbit view
        // True Scale: ~0.01 is entering Inner System view
        
        const fadeStart = isTrueScale ? 0.005 : 0.4;
        const fadeEnd   = isTrueScale ? 0.02 : 0.9;
        const cutoff    = isTrueScale ? 0.01 : 0.15;

        if (quality === 'eco') {
            // Eco: Hard Cutoff (Hide when zoomed in close)
            return k < cutoff ? 1.0 : 0.0;
        } else {
            // Standard: Smooth Fade (Inverse)
            return 1.0 - smoothStep(fadeStart, fadeEnd, k);
        }
    }

    return 1.0;
};

/**
 * Determines if a Comet or Asteroid should be rendered based on distance and settings.
 * 
 * @param distanceAU Distance from Sun in AU
 * @param settings RenderSettings object
 * @returns boolean
 */
export const shouldRenderComet = (distanceAU: number, settings: RenderSettings): boolean => {
    if (settings.cometQuality === 'performance') return true;
    // Eco Mode: Only show objects within 50 AU (Pluto-ish range)
    return distanceAU <= 50;
};

/**
 * Global Visibility Threshold to skip rendering entirely if opacity is too low.
 */
export const getVisibilityThreshold = (isMobileOrEco: boolean): number => {
    return isMobileOrEco ? 0.9 : 0.01;
};
