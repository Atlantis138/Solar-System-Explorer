

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AppSettings, RealStar, Constellation } from '../types';

interface StarFieldProps {
  settings: AppSettings;
  realStars: RealStar[];
  constellations: Constellation[];
}

interface Star {
  x: number;
  y: number;
  z: number;
  size: number;
  opacity: number;
  color: string;
  id?: string;
}

const StarField: React.FC<StarFieldProps> = ({ settings, realStars, constellations }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [proceduralStars, setProceduralStars] = useState<Star[]>([]);

  // --- Procedural Star Generation ---
  useEffect(() => {
    // Removed the "return if useRealStars" check to allow layering
    
    const generateStars = () => {
      const newStars: Star[] = [];
      const count = settings.starDensity; 
      const isMilkyWay = settings.background === 'milkyway';

      for (let i = 0; i < count; i++) {
        let x, y, z;
        let size, opacity, color;

        if (isMilkyWay) {
            // Milky Way Generation
            let lat = 0;
            if (Math.random() < 0.8) {
                const u1 = Math.random();
                const u2 = Math.random();
                const stdNormal = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
                lat = stdNormal * 0.2; 
            } else {
                lat = (Math.random() - 0.5) * Math.PI; 
            }
            const lon = Math.random() * Math.PI * 2;
            const x0 = Math.cos(lat) * Math.cos(lon);
            const y0 = Math.cos(lat) * Math.sin(lon);
            const z0 = Math.sin(lat);
            const inc = 60 * (Math.PI / 180);
            const cosInc = Math.cos(inc);
            const sinInc = Math.sin(inc);

            x = x0;
            y = y0 * cosInc - z0 * sinInc;
            z = y0 * sinInc + z0 * cosInc;
            
            const distFromCenter = Math.abs(lat);
            size = Math.random() * 1.5 + (distFromCenter < 0.1 ? 0.5 : 0);
            opacity = Math.random() * 0.5 + 0.3 + (distFromCenter < 0.2 ? 0.2 : 0);
            const r = 200 + Math.random() * 55;
            const g = 200 + Math.random() * 55;
            const b = 255;
            color = `rgba(${r},${g},${b},`;

        } else {
            const z_rand = 2 * Math.random() - 1;
            const theta = Math.random() * 2 * Math.PI;
            const r_xy = Math.sqrt(1 - z_rand * z_rand);
            x = r_xy * Math.cos(theta);
            y = r_xy * Math.sin(theta);
            z = z_rand;
            size = Math.random() * 1.5 + 0.5;
            opacity = Math.random() * 0.8 + 0.1;
            color = 'rgba(255, 255, 255,';
        }
        newStars.push({ x, y, z, size, opacity, color });
      }
      setProceduralStars(newStars);
    };
    generateStars();
  }, [settings.background, settings.starDensity]); // Removed settings.useRealStars dep to keep procedural consistent

  // --- Process Real Stars ---
  const processedRealStars = useMemo(() => {
    if (!settings.useRealStars || realStars.length === 0) return [];
    
    const obliquity = 23.439 * (Math.PI / 180);
    const cosEps = Math.cos(obliquity);
    const sinEps = Math.sin(obliquity);

    return realStars.map(star => {
        // Convert RA/Dec (Deg) to Radians
        const alpha = star.ra * (Math.PI / 180);
        const delta = star.dec * (Math.PI / 180);

        // Equatorial Cartesian (X points to Vernal Equinox)
        const x_eq = Math.cos(delta) * Math.cos(alpha);
        const y_eq = Math.cos(delta) * Math.sin(alpha);
        const z_eq = Math.sin(delta);

        // Rotate to Ecliptic Coordinates
        const x = x_eq;
        const y = y_eq * cosEps + z_eq * sinEps;
        const z = -y_eq * sinEps + z_eq * cosEps;

        // Magnitude to Opacity/Size
        // Mag -1.5 (Sirius) -> Brightest
        // Mag 6 -> Dim
        const normalizedMag = Math.max(0, 2.5 - star.mag) / 3.5; 
        const opacity = Math.min(1, Math.max(0.3, normalizedMag + 0.2));
        const size = Math.max(1, normalizedMag * 2.5);

        return {
            x, y, z,
            size,
            opacity,
            color: star.color || '#ffffff',
            id: star.id,
            name: star.name // Carry name for labels
        } as Star & { name: string };
    });
  }, [settings.useRealStars, realStars]);

  // Fast Map for Constellations
  const starMap = useMemo(() => {
      if (!settings.showConstellations || !settings.useRealStars) return new Map();
      const map = new Map<string, Star>();
      processedRealStars.forEach(s => {
          if (s.id) map.set(s.id, s);
      });
      return map;
  }, [settings.showConstellations, settings.useRealStars, processedRealStars]);

  // --- Render Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const draw = () => {
      const w = canvas.width = canvas.offsetWidth;
      const h = canvas.height = canvas.offsetHeight;
      const centerX = w / 2;
      const centerY = h / 2;
      
      const SKY_SCALE = Math.max(w, h) * 0.8;

      ctx.clearRect(0, 0, w, h);

      const tiltRad = (settings.viewTilt * Math.PI) / 180;
      const yawRad = (settings.viewYaw * Math.PI) / 180;
      const sinT = Math.sin(tiltRad);
      const cosT = Math.cos(tiltRad);
      const sinY = Math.sin(yawRad);
      const cosY = Math.cos(yawRad);

      const project = (x: number, y: number, z: number) => {
          const x_yaw = x * cosY - y * sinY;
          const y_yaw = x * sinY + y * cosY;
          const z_yaw = z;

          // Depth calculation consistent with StarField's original logic
          // depth < 0 means "visible/front" in this specific projection setup (likely due to Z-axis conventions)
          const depth = z_yaw * sinT - y_yaw * cosT;
          
          if (depth >= 0) return null; 

          const x_proj = x_yaw * SKY_SCALE;
          const y_proj = -(y_yaw * sinT + z_yaw * cosT) * SKY_SCALE;

          return { x: centerX + x_proj, y: centerY + y_proj };
      };

      // --- Layer 0: Procedural Background Stars ---
      // These are drawn with the global `starBrightness` setting.
      // They provide context/atmosphere.
      proceduralStars.forEach(star => {
          const p = project(star.x, star.y, star.z);
          if (!p) return;

          let alpha = star.opacity * settings.starBrightness;
          // Slight Milky Way boost
          if (settings.background === 'milkyway') alpha *= 1;
          else alpha *= 0.8;

          ctx.fillStyle = `${star.color}${alpha})`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, star.size, 0, Math.PI * 2);
          ctx.fill();
      });
      
      // --- Layer 1: Constellation Lines ---
      if (settings.useRealStars && settings.showConstellations) {
          ctx.lineWidth = 0.8;
          // Use dedicated Constellation brightness multiplier
          const lineAlpha = 0.15 * settings.constellationBrightnessMultiplier;
          ctx.strokeStyle = `rgba(255, 255, 255, ${Math.min(1, lineAlpha)})`;
          ctx.beginPath();
          
          constellations.forEach(constellation => {
              constellation.lines.forEach(pair => {
                  const s1 = starMap.get(pair[0]);
                  const s2 = starMap.get(pair[1]);
                  
                  if (s1 && s2) {
                      const p1 = project(s1.x, s1.y, s1.z);
                      const p2 = project(s2.x, s2.y, s2.z);
                      
                      if (p1 && p2) {
                          ctx.moveTo(p1.x, p1.y);
                          ctx.lineTo(p2.x, p2.y);
                      }
                  }
              });
          });
          ctx.stroke();
      }

      // --- Layer 2: Real Stars ---
      if (settings.useRealStars) {
          processedRealStars.forEach(star => {
              const p = project(star.x, star.y, star.z);
              if (!p) return;

              // Apply Real Star Brightness Multiplier
              // Base opacity comes from Magnitude. Multiplier boosts it.
              // Allow going > 1.0 for glow effect simulation logic (though canvas alpha caps at 1)
              const brightnessMult = settings.realStarBrightnessMultiplier;
              let effectiveOpacity = star.opacity * brightnessMult;
              
              // Scale size slightly with brightness to simulate bloom
              let effectiveSize = star.size * Math.sqrt(brightnessMult);

              ctx.globalAlpha = Math.min(1, effectiveOpacity);
              ctx.fillStyle = star.color;
              
              ctx.beginPath();
              ctx.arc(p.x, p.y, effectiveSize, 0, Math.PI * 2);
              ctx.fill();

              // --- Layer 3: Star Labels ---
              if (settings.realStarLabels !== 'none') {
                  // Only label reasonably bright stars unless brightness is pumped up
                  if (effectiveOpacity > 0.3) {
                      const label = (star as any).name;
                      const id = star.id; // We can use ID for english if needed, or add englishName to json
                      
                      // Determine text to show
                      let textToShow = '';
                      if (settings.realStarLabels === 'cn') {
                          textToShow = label;
                      } else if (settings.realStarLabels === 'bilingual') {
                          // Simple capitalization for ID as "English" fallback since we don't have separate EN name yet
                          const enName = id.charAt(0).toUpperCase() + id.slice(1);
                          textToShow = `${label} ${enName}`;
                      }

                      ctx.fillStyle = `rgba(255, 255, 255, ${Math.min(0.8, effectiveOpacity)})`;
                      ctx.font = '10px "Segoe UI", sans-serif';
                      ctx.textAlign = 'left';
                      // Use Math.round for crisp text
                      ctx.fillText(textToShow, Math.round(p.x + effectiveSize + 4), Math.round(p.y + 3));
                  }
              }
          });
          ctx.globalAlpha = 1.0; // Reset
      }

      // --- Layer 4: Grids ---
      const projectPoint = (x: number, y: number, z: number) => {
          const x_yaw = x * cosY - y * sinY;
          const y_yaw = x * sinY + y * cosY;
          const z_yaw = z;
          const depth = z_yaw * sinT - y_yaw * cosT;
          const x_p = x_yaw * SKY_SCALE;
          const y_p = -(y_yaw * sinT + z_yaw * cosT) * SKY_SCALE;
          return { x: centerX + x_p, y: centerY + y_p, depth };
      };

      const drawGrid = (tiltAngleDeg: number, color: string, labelSuffix: string) => {
          const gridRad = tiltAngleDeg * (Math.PI / 180);
          const cosGrid = Math.cos(gridRad);
          const sinGrid = Math.sin(gridRad);
          
          const transform = (x: number, y: number, z: number) => {
              const y_t = y * cosGrid - z * sinGrid;
              const z_t = y * sinGrid + z * cosGrid;
              return { x: x, y: y_t, z: z_t };
          };

          ctx.lineWidth = 1.2;
          ctx.strokeStyle = color;
          ctx.globalAlpha = settings.gridOpacity;

          // Latitudes
          const lats = [-60, -30, 0, 30, 60];
          if (!settings.convergeMeridians) { lats.push(-80); lats.push(80); }
          
          lats.forEach(lat => {
              ctx.beginPath();
              const latRad = lat * (Math.PI / 180);
              const r = Math.cos(latRad);
              const z = Math.sin(latRad);
              let firstMove = true;
              for (let lon = 0; lon <= 360; lon += 5) {
                  const lonRad = lon * (Math.PI / 180);
                  const x0 = r * Math.cos(lonRad);
                  const y0 = r * Math.sin(lonRad);
                  const pt3 = transform(x0, y0, z);
                  const proj = projectPoint(pt3.x, pt3.y, pt3.z);
                  if (proj.depth < 0) {
                      if (firstMove) { ctx.moveTo(proj.x, proj.y); firstMove = false; }
                      else { ctx.lineTo(proj.x, proj.y); }
                  } else { firstMove = true; }
              }
              ctx.stroke();
          });

          // Longitudes
          for (let lon = 0; lon < 360; lon += 30) {
              ctx.beginPath();
              const lonRad = lon * (Math.PI / 180);
              const cosL = Math.cos(lonRad);
              const sinL = Math.sin(lonRad);
              const latMax = settings.convergeMeridians ? 90 : 80;
              let firstMove = true;
              for (let lat = -latMax; lat <= latMax; lat += 5) {
                  const latRad = lat * (Math.PI / 180);
                  const r = Math.cos(latRad);
                  const z = Math.sin(latRad);
                  const x0 = r * cosL;
                  const y0 = r * sinL;
                  const pt3 = transform(x0, y0, z);
                  const proj = projectPoint(pt3.x, pt3.y, pt3.z);
                  if (proj.depth < 0) {
                      if (firstMove) { ctx.moveTo(proj.x, proj.y); firstMove = false; }
                      else { ctx.lineTo(proj.x, proj.y); }
                  } else { firstMove = true; }
              }
              ctx.stroke();
          }

          // --- TEXT LABELS (Optimized) ---
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = color;

          // 1. Grid Coordinate Numbers (Latitudes)
          // Use explicit font for sharpness
          ctx.font = '10px "Segoe UI", sans-serif'; 
          
          const labelLats = [-60, -30, 30, 60];
          // Draw labels at cardinal longitudes
          const labelLons = [0, 90, 180, 270];

          labelLats.forEach(lat => {
              const latRad = lat * (Math.PI / 180);
              const r = Math.cos(latRad);
              const z = Math.sin(latRad);
              
              labelLons.forEach(lon => {
                  const lonRad = lon * (Math.PI / 180);
                  const x0 = r * Math.cos(lonRad);
                  const y0 = r * Math.sin(lonRad);
                  const pt3 = transform(x0, y0, z);
                  const proj = projectPoint(pt3.x, pt3.y, pt3.z);

                  if (proj.depth < 0) {
                       // Fix 1: Reset Opacity to be readable
                       ctx.globalAlpha = 0.8; 
                       // Fix 2: Integer Coordinate Snapping (avoids subpixel blurring)
                       ctx.fillText(`${Math.abs(lat)}°`, Math.round(proj.x), Math.round(proj.y));
                  }
              });
          });

          // 2. Pole Labels
          ctx.font = 'bold 12px "Segoe UI", sans-serif'; 
          
          // North
          const np3 = transform(0, 0, 1);
          const npProj = projectPoint(np3.x, np3.y, np3.z);
          if (npProj.depth < 0) {
               ctx.globalAlpha = 0.9;
               ctx.fillText("N", Math.round(npProj.x), Math.round(npProj.y));
          }
          
          // South
          const sp3 = transform(0, 0, -1);
          const spProj = projectPoint(sp3.x, sp3.y, sp3.z);
          if (spProj.depth < 0) {
               ctx.globalAlpha = 0.9;
               ctx.fillText("S", Math.round(spProj.x), Math.round(spProj.y));
          }
      };

      if (settings.showEclipticGrid) drawGrid(0, '#FACC15', 'ecl');
      if (settings.showEquatorialGrid) drawGrid(23.44, '#22D3EE', 'eq');
    };

    draw();
    const handleResize = () => draw();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);

  }, [proceduralStars, processedRealStars, constellations, settings, starMap]);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default StarField;
