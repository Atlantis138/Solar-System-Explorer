

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { AppSettings, RealStar, Constellation } from '../types';
import { sceneLabelStyle, SCENE_FONT_FAMILY } from '../core/sceneLabels';
import { renderBudget } from '../core/renderBudget';
import { useCanvasDraw } from '../hooks/useCanvasDraw';
import { SKY_BRIGHTNESS_BASE } from '../core/skySettings';
import { equatorialToEcliptic, createSkyProjection, sampleSkyArc, SkyPoint, OBLIQUITY } from '../core/celestial';

interface StarFieldProps {
  focalPixels?: number;
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

const StarField: React.FC<StarFieldProps> = ({ settings, realStars, constellations, focalPixels }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [proceduralStars, setProceduralStars] = useState<Star[]>([]);

  // --- Procedural Star Generation ---
  useEffect(() => {
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
                const u1 = Math.max(Number.EPSILON, Math.random());
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
  }, [settings.background, settings.starDensity]);

  // Catalog geometry and arcs are computed only when data changes.
  const processedRealStars = useMemo(() => realStars.map(star => ({
    ...star,
    ...equatorialToEcliptic(star.ra, star.dec),
    // Compress the photometric range for a readable map, preserving magnitude order.
    size: Math.max(0.55, 2.5 * Math.pow(10, -0.12 * (star.mag + 1.46))),
    opacity: Math.min(1, Math.max(0.25, 1 - (star.mag + 1.46) * 0.09)),
  })).sort((a, b) => a.mag - b.mag), [realStars]);

  const constellationGeometry = useMemo(() => {
    const stars = new Map(processedRealStars.map(star => [star.id, star]));
    const anchors = new Set<string>();
    const arcs = constellations.flatMap(constellation => constellation.lines.flatMap(([a, b]) => {
      const start = stars.get(a), end = stars.get(b);
      if (!start || !end) return [];
      anchors.add(a); anchors.add(b);
      return [sampleSkyArc(start, end)];
    }));
    return { anchors, arcs };
  }, [processedRealStars, constellations]);

  const regionGeometry = useMemo(() => ({
    boundaries: constellations.flatMap(c => (c.boundaries ?? []).map(ring =>
      ring.map(([ra, dec]) => equatorialToEcliptic(ra, dec)))),
    labels: constellations.flatMap(c => (c.labelPositions ?? []).map(([ra, dec]) => ({
      point: equatorialToEcliptic(ra, dec), text: c.name.split(' (')[0],
    }))),
  }), [constellations]);

  // Grid geometry and label measurements stay cached while rotating the view.
  const grids = useMemo(() => [0, -OBLIQUITY].map(tilt => {
    const angle = tilt * Math.PI / 180;
    const point = (lon: number, lat: number): SkyPoint => {
      const l = lon * Math.PI / 180, b = lat * Math.PI / 180;
      const y = Math.cos(b) * Math.sin(l), z = Math.sin(b);
      return { x: Math.cos(b) * Math.cos(l), y: y * Math.cos(angle) - z * Math.sin(angle),
        z: y * Math.sin(angle) + z * Math.cos(angle) };
    };
    const paths: SkyPoint[][] = [];
    const latitudes = settings.convergeMeridians ? [-60, -30, 0, 30, 60] : [-80, -60, -30, 0, 30, 60, 80];
    for (const lat of latitudes) paths.push(Array.from({ length: 181 }, (_, i) => point(i * 2, lat)));
    const max = settings.convergeMeridians ? 90 : 80;
    for (let lon = 0; lon < 360; lon += 30)
      paths.push(Array.from({ length: max + 1 }, (_, i) => point(lon, -max + i * 2)));
    const labels = [-60, -30, 30, 60].flatMap(lat => [0, 90, 180, 270].map(lon => ({
      point: point(lon, lat), text: `${Math.abs(lat)}°`,
    })));
    labels.push({ point: point(0, 90), text: 'N' }, { point: point(0, -90), text: 'S' });
    return { paths, labels };
  }), [settings.convergeMeridians]);
  const textWidths = useRef(new Map<string, number>());
  useEffect(() => {
    const clear = () => textWidths.current.clear();
    document.fonts?.addEventListener('loadingdone', clear);
    return () => document.fonts?.removeEventListener('loadingdone', clear);
  }, []);

  // Same pre-paint phase as the foreground: no trailing background frame.
  useCanvasDraw(canvasRef, (ctx, w, h) => {
    const projection = createSkyProjection(w, h, settings.viewTilt, settings.viewYaw, focalPixels);
    const inViewport = (p: { x: number; y: number }, margin = 8) =>
      p.x >= -margin && p.x <= w + margin && p.y >= -margin && p.y <= h + margin;
    const drawPaths = (paths: SkyPoint[][]) => {
      ctx.beginPath();
      for (const path of paths) for (let i = 1; i < path.length; i++) {
        const segment = projection.segment(path[i - 1], path[i]);
        if (segment) {
          ctx.moveTo(segment[0].x, segment[0].y);
          ctx.lineTo(segment[1].x, segment[1].y);
        }
      }
      ctx.stroke();
    };
    const labels: { x: number; y: number; radius: number; text: string }[] = [];
    if (!settings.useRealStars) for (const star of proceduralStars) {
      const p = projection(star);
      if (p.depth >= 0 || !inViewport(p)) continue;
      ctx.fillStyle = `${star.color}${Math.min(1, star.opacity * settings.starBrightness * SKY_BRIGHTNESS_BASE.starBrightness * 0.65)})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, star.size * 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (settings.useRealStars && settings.showConstellationBoundaries) {
      ctx.globalAlpha = 1;
      ctx.lineWidth = 0.6;
      ctx.strokeStyle = 'rgba(140, 151, 191, 0.12)';
      drawPaths(regionGeometry.boundaries);
    }
    // Large, quiet sky-region lettering sits behind stars and their foreground labels.
    if (settings.useRealStars && settings.showConstellationNames) {
      ctx.save();
      const fontSize = sceneLabelStyle('constellation',Math.min(w,h)).fontSize;
      ctx.font = `300 ${fontSize}px "Segoe UI", "Noto Sans CJK SC", "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#94a1bb';
      const regionBoxes: { x: number; y: number; w: number; h: number }[] = [];
      for (const label of regionGeometry.labels) {
        const p = projection(label.point);
        if (p.depth >= 0 || !inViewport(p, -16)) continue;
        const key = `region:${fontSize}:${label.text}`;
        let width = textWidths.current.get(key);
        if (width === undefined) {
          width = ctx.measureText(label.text).width;
          textWidths.current.set(key, width);
        }
        const box = { x: p.x - width / 2 - 8, y: p.y - fontSize / 2 - 6, w: width + 16, h: fontSize + 12 };
        const edge = Math.min(box.x, box.y, w - box.x - box.w, h - box.y - box.h);
        if (edge <= 0 || regionBoxes.some(other => box.x < other.x + other.w && box.x + box.w > other.x &&
            box.y < other.y + other.h && box.y + box.h > other.y)) continue;
        ctx.globalAlpha = 0.16 * Math.min(1, edge / 32);
        ctx.fillText(label.text, p.x - width / 2, p.y);
        regionBoxes.push(box);
      }
      ctx.restore();
    }
    if (settings.useRealStars && settings.showConstellations) {
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = `rgba(145, 163, 192, ${Math.min(0.6, 0.18 * settings.constellationBrightnessMultiplier * SKY_BRIGHTNESS_BASE.constellationBrightnessMultiplier)})`;
      drawPaths(constellationGeometry.arcs);
    }
    if (settings.useRealStars) {
      const limit = settings.realStarMagnitudeLimit;
      const multiplier = settings.realStarBrightnessMultiplier * SKY_BRIGHTNESS_BASE.realStarBrightnessMultiplier;
      for (const star of processedRealStars) {
        const anchor = settings.showConstellations && constellationGeometry.anchors.has(star.id);
        if (star.mag > limit && !anchor) continue;
        const p = projection(star);
        if (p.depth >= 0 || !inViewport(p)) continue;
        // Keep small stars sharp at every brightness; dim their light, not their radius.
        const radius = star.size * 0.85;
        ctx.globalAlpha = Math.min(1, star.opacity * multiplier * 0.8);
        ctx.fillStyle = star.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
        if (settings.realStarLabels !== 'none' && star.mag <= Math.min(2.5, limit)) {
          const text = settings.realStarLabels === 'cn' ? star.name
            : [star.name, star.englishName].filter(Boolean).join(' ');
          if (text) labels.push({ ...p, radius, text });
        }
      }
    }
    ctx.font = `${sceneLabelStyle('grid').fontSize}px ${SCENE_FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let i = 0; i < grids.length; i++) {
      if (!(i === 0 ? settings.showEclipticGrid : settings.showEquatorialGrid)) continue;
      ctx.lineWidth = 0.7;
      ctx.strokeStyle = ctx.fillStyle = i === 0 ? '#b8a862' : '#699eac';
      ctx.globalAlpha = Math.min(1, settings.gridOpacity * SKY_BRIGHTNESS_BASE.gridOpacity);
      drawPaths(grids[i].paths);
      // Coordinate labels obey the same dimmer as their grid.
      for (const label of grids[i].labels) {
        const p = projection(label.point);
        if (p.depth < 0 && inViewport(p, -12)) ctx.fillText(label.text, p.x, p.y);
      }
    }
    ctx.font = `${sceneLabelStyle('star').fontSize}px ${SCENE_FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#020306';
    ctx.fillStyle = '#b8c4d6';
    const occupied: { x: number; y: number; w: number; h: number }[] = [];
    let starLabelCount = 0;
    for (const label of labels) {
      if (starLabelCount >= 14) break;
      let width = textWidths.current.get(label.text);
      if (width === undefined) {
        width = ctx.measureText(label.text).width;
        textWidths.current.set(label.text, width);
      }
      // A stable offset avoids labels jumping sides during a rotation. Keep
      // fractional positions: the DPR backing store supplies the sharpness.
      const x = label.x + label.radius + 6, y = label.y;
      const box = { x: x - 3, y: y - 10, w: width + 6, h: 20 };
      const edge = Math.min(box.x, box.y, w - box.x - box.w, h - box.y - box.h);
      if (edge <= 0 || occupied.some(other => box.x < other.x + other.w && box.x + box.w > other.x &&
          box.y < other.y + other.h && box.y + box.h > other.y)) continue;
      ctx.globalAlpha = Math.min(1, settings.starLabelBrightness * SKY_BRIGHTNESS_BASE.starLabelBrightness) * Math.min(1, edge / 24);
      ctx.strokeText(label.text, x, y);
      ctx.fillText(label.text, x, y);
      occupied.push(box);
      starLabelCount++;
    }
  }, [focalPixels, proceduralStars, processedRealStars, constellationGeometry, regionGeometry, grids,
    settings.viewTilt, settings.viewYaw, settings.useRealStars, settings.starBrightness,
    settings.realStarMagnitudeLimit, settings.realStarBrightnessMultiplier, settings.realStarLabels,
    settings.starLabelBrightness, settings.showConstellations, settings.constellationBrightnessMultiplier,
    settings.showEclipticGrid, settings.showEquatorialGrid, settings.gridOpacity,
    settings.showConstellationNames, settings.showConstellationBoundaries], renderBudget(settings.renderSettings).maxDpr);

  return <canvas ref={canvasRef} role="img" aria-label="天球星图" className="absolute inset-0 w-full h-full pointer-events-none" />;
};

export default React.memo(StarField);
