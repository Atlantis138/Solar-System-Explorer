import React, { useRef } from 'react';
import type { AppSettings, Position, PlanetData } from '../../types';
import type { SceneView } from '../../core/sceneView';
import { drawCometTails } from '../../core/cometTails';
import { drawOrbitPaths, type OrbitPath } from '../../core/orbitDrawing';
import { drawRegionBoundaries } from '../../core/regionDrawing';
import { SMALL_BODY_POPULATIONS, populationVisible } from '../../data/populations';
import { calculatePlanetarySystem } from '../../utils/astronomy';
import { drawAsteroidBelt } from '../../core/asteroidBelt';
import { renderBudget } from '../../core/renderBudget';
import { useCanvasDraw } from '../../hooks/useCanvasDraw';

type OrbitProps={paths:OrbitPath[];scene:SceneView;settings:AppSettings;zoom:{x:number;y:number;k:number}};
export const OrbitLayer=React.memo(function OrbitLayer({paths,scene,settings,zoom}:OrbitProps){
  const ref=useRef<HTMLCanvasElement>(null),budget=renderBudget(settings.renderSettings);
  useCanvasDraw(ref,ctx=>{
    ctx.translate(zoom.x,zoom.y);ctx.scale(zoom.k,zoom.k);
    if(settings.showRegionLabels) drawRegionBoundaries(ctx,scene);
    drawOrbitPaths(ctx,paths,{zoom:zoom.k,perspective:scene.perspective,tilt:settings.viewTilt,
      intensity:settings.orbitPerspectiveIntensity,trueScale:scene.trueScale,scale:scene.scale,scene,styleStep:budget.styleStep});
  },[paths,scene,settings,zoom],budget.maxDpr);
  return <canvas ref={ref} data-layer="orbits" className="absolute inset-0 z-0 w-full h-full pointer-events-none"/>;
},(a,b)=>a.scene===b.scene&&a.settings===b.settings&&a.zoom===b.zoom&&a.paths.length===b.paths.length&&a.paths.every((p,i)=>{
  const q=b.paths[i];return p.points===q.points&&p.color===q.color&&p.opacity===q.opacity&&p.emphasized===q.emphasized&&p.local===q.local&&p.category===q.category;
}));

export const BeltLayer=React.memo(function BeltLayer({scene,settings,zoom,center,date,referenceBody}:{
  scene:SceneView;settings:AppSettings;zoom:{x:number;y:number;k:number};center:Position;date:Date;referenceBody?:PlanetData;
}){
  const ref=useRef<HTMLCanvasElement>(null);
  const needsReference=SMALL_BODY_POPULATIONS.some(p=>p.referenceBodyId===referenceBody?.id&&populationVisible(p,settings));
  useCanvasDraw(ref,(ctx,w,h)=>drawAsteroidBelt(ctx,w,h,scene.scale,settings,zoom,center,date,.6,scene,needsReference&&referenceBody?{body:referenceBody,position:calculatePlanetarySystem(referenceBody,date,settings.useHighPrecision).parentPosition}:undefined),
    [scene,settings,zoom,center,date,referenceBody],renderBudget(settings.renderSettings).maxDpr);
  return <canvas ref={ref} data-layer="belt" className="absolute inset-0 z-0 w-full h-full pointer-events-none"/>;
});

export const CometTailLayer=React.memo(function CometTailLayer({bodies,visibilityMap,scene,settings,date}:{
  bodies:PlanetData[];visibilityMap:Record<string,boolean>;scene:SceneView;settings:AppSettings;date:Date;
}) {
  const ref=useRef<HTMLCanvasElement>(null);
  const comets=bodies.filter(body=>body.type==='comet'&&visibilityMap[body.id]!==false);
  useCanvasDraw(ref,ctx=>drawCometTails(ctx,comets,date,scene,settings),
    [bodies,visibilityMap,scene,settings,date],renderBudget(settings.renderSettings).maxDpr);
  return <canvas ref={ref} data-layer="comet-tails" className="absolute inset-0 z-0 w-full h-full pointer-events-none"/>;
});
