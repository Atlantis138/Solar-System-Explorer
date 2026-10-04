import { observeViewportRecovery } from '../core/viewportRecovery';

import React, { useEffect, useRef, useState, useMemo, useImperativeHandle, forwardRef } from 'react';
import * as d3 from 'd3'; 
import { AppSettings, PlanetData, PinnedPlanet, Position, RealStar, Constellation, NearbyStar } from '../types';
import StarField from './StarField';
import SchematicSolarSystem from './renderers/SchematicSolarSystem';
import TrueScaleSolarSystem from './renderers/TrueScaleSolarSystem';
import { calculateWorldPosition } from '../utils/astronomy';
import { AU_SCALE_SCHEMATIC, AU_SCALE_TRUE, SUN_DATA } from '../data/constants';
import NearbyStars from './NearbyStars';
import { VirtualJoystick, NavigationInput } from './VirtualJoystick';
import { createSceneView } from '../core/sceneView';
import { cameraFocalPixels, cameraFov, perspectiveStrength, moveObserver, rotateCameraLocal, solarResetPose, cameraBasis } from '../core/cameraOptics';
import { nearbyOpacity, nearbyRadius, nearbyFitZoom, nearbyPositionAU, solarZoomExtent, LIGHT_YEAR_AU } from '../core/nearbyStars';

const ORIGIN: Position = { x: 0, y: 0, z: 0 };

interface SolarSystemProps {
  onNearbyActiveChange: (active: boolean) => void;
  onOpenCameraSettings: () => void;
  currentDate: Date;
  onPlanetSelect: (planet: PlanetData | null) => void;
  onSettingsChange: (settings: AppSettings) => void;
  onCameraFocusChange: (id: string | null) => void;
  selectedPlanetId: string | null;
  settings: AppSettings;
  highlightedAlignment: string[] | null;
  pinnedPlanets: PinnedPlanet[];
  cameraFocusId: string | null;
  planets: PlanetData[];
  dwarfs: PlanetData[];
  asteroidsComets: PlanetData[];
  resetCameraFlag: number; // Signal to animate camera reset
  visibilityMap: Record<string, boolean>;
  realStars: RealStar[];
  constellations: Constellation[];
}

export interface SolarSystemHandle { openNearby: () => void; toggleNearby: () => void; resetView: () => void }
const SolarSystem = forwardRef<SolarSystemHandle, SolarSystemProps>(({
  onNearbyActiveChange, onOpenCameraSettings,
  currentDate, 
  onPlanetSelect, 
  onSettingsChange,
  onCameraFocusChange,
  selectedPlanetId, 
  settings,
  highlightedAlignment,
  pinnedPlanets,
  cameraFocusId,
  planets,
  dwarfs,
  asteroidsComets,
  resetCameraFlag,
  visibilityMap,
  realStars,
  constellations
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<HTMLDivElement, unknown> | null>(null);
  
  // State tracking
  const prevTrueScale = useRef(settings.trueScale);
  const prevDimensions = useRef({ w: window.innerWidth, h: window.innerHeight });

  const [zoomTransform, setZoomTransform] = useState<d3.ZoomTransform>(() => 
    d3.zoomIdentity.translate(window.innerWidth / 2, window.innerHeight / 2).scale(settings.trueScale ? 0.8 * AU_SCALE_SCHEMATIC / AU_SCALE_TRUE : 0.8)
  );
  const [dimensions, setDimensions] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [stellarLocked, setStellarLocked] = useState(false);
  const [nearbyPanelSignal,setNearbyPanelSignal] = useState(0);
  const [freeOrbitCenter,setFreeOrbitCenter] = useState<Position|null>(null);
  const [starTarget, setStarTarget] = useState<Position>(ORIGIN);
  const [cameraEye, setCameraEye] = useState<Position | null>(null);
  const transitionScene=createSceneView({scale:settings.trueScale?AU_SCALE_TRUE:AU_SCALE_SCHEMATIC,
    settings,zoom:zoomTransform,width:dimensions.w,height:dimensions.h,center:freeOrbitCenter??starTarget,observer:cameraEye});
  const observerDistance=Math.hypot(transitionScene.cameraPosition.x,transitionScene.cameraPosition.y,transitionScene.cameraPosition.z);
  const neighborAlpha = settings.trueScale || settings.showNearbyStars === false ? 0
    : nearbyOpacity(settings, zoomTransform.k, dimensions.w, dimensions.h,observerDistance);
  const navigationRef = useRef({settings, dimensions, cameraEye, zoom: zoomTransform});
  navigationRef.current = {settings, dimensions, cameraEye, zoom: zoomTransform};
  useEffect(() => onNearbyActiveChange(neighborAlpha > .5), [neighborAlpha > .5]);
  useEffect(() => { setCameraEye(null); setStellarLocked(false); setStarTarget(ORIGIN);   setFreeOrbitCenter(null); }, [settings.trueScale, settings.showNearbyStars, resetCameraFlag]);
  useEffect(() => { if(cameraFocusId){setCameraEye(null);setStellarLocked(false);setStarTarget(ORIGIN);setFreeOrbitCenter(null);} },[cameraFocusId]);
  useEffect(() => { if (!settings.showCameraControl) setCameraEye(null); }, [settings.showCameraControl]);

  // Measure the actual scene, including iPad Split View and restored pages.
  useEffect(() => {
    let frame=0;
    const measure=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{
      const rect=containerRef.current?.getBoundingClientRect();
      if(rect&&rect.width>0&&rect.height>0) setDimensions(old=>old.w===rect.width&&old.h===rect.height?old:{w:rect.width,h:rect.height});
    });};
    const observer=new ResizeObserver(measure);
    if(containerRef.current)observer.observe(containerRef.current);
    const unwatch=observeViewportRecovery(measure);measure();
    return()=>{observer.disconnect();unwatch();cancelAnimationFrame(frame);};
  },[]);

  // 2. Initialize D3 Zoom Behavior (Runs Once)
  useEffect(() => {
    if (!containerRef.current) return;
    const container = d3.select(containerRef.current);
    
    const zoom = d3.zoom<HTMLDivElement, unknown>()
      .filter(event => !event.target?.closest?.('[data-scene-ui],button,input,select,textarea,a')
        && !event.altKey && (!event.ctrlKey || event.type === 'wheel') && !event.button)
      .clickDistance(4)
      .on('start', event => {if(event.sourceEvent)container.interrupt();})
      .on('zoom', (event) => {
        const current = navigationRef.current;
        if (event.sourceEvent && current.cameraEye) {
          const scale = current.settings.trueScale ? AU_SCALE_TRUE : AU_SCALE_SCHEMATIC;
          const units = 1 / (scale * event.transform.k);
          const oldUnits = 1 / (scale * current.zoom.k);
          const distanceChange = cameraFocalPixels(current.dimensions.w, current.dimensions.h, cameraFov(current.settings))
            / (perspectiveStrength(current.settings) || 1) * (units-oldUnits);
          const next = moveObserver(current.cameraEye, current.settings.viewTilt, current.settings.viewYaw,
            (current.zoom.x-event.transform.x)*units, (current.zoom.y-event.transform.y)*units, distanceChange, current.settings.viewRoll ?? 0);
          navigationRef.current.cameraEye = next;
          setCameraEye(next);
        }
        navigationRef.current.zoom = event.transform;
        setZoomTransform(event.transform);
      });
    
    zoomBehaviorRef.current = zoom;
    container.call(zoom);
    
    // Synchronize initial state
    container.call(zoom.transform, zoomTransform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 3. Update Scale Extents based on Mode
  useEffect(() => {
      if (!zoomBehaviorRef.current || !containerRef.current) return;
      const extent = solarZoomExtent(settings.trueScale, settings.showNearbyStars !== false);
      zoomBehaviorRef.current.scaleExtent(extent);
      if (!settings.trueScale && settings.showNearbyStars === false && (zoomTransform.k < extent[0] || stellarLocked)) {
        d3.select(containerRef.current).interrupt().call(zoomBehaviorRef.current.transform,
          d3.zoomIdentity.translate(dimensions.w / 2, dimensions.h / 2).scale(.8));
      }
  }, [settings.trueScale, settings.showNearbyStars]);

  // 4. Handle Smart Scaling (Switching Modes) & Resize Center Preservation
  useEffect(() => {
      if (!containerRef.current || !zoomBehaviorRef.current) return;
      const container = d3.select(containerRef.current);
      
      let newTransform = zoomTransform;
      let shouldUpdate = false;

      // A. Handle Resize (Keep view centered relative to screen)
      if (prevDimensions.current.w !== dimensions.w || prevDimensions.current.h !== dimensions.h) {
          const dx = (dimensions.w - prevDimensions.current.w) / 2;
          const dy = (dimensions.h - prevDimensions.current.h) / 2;
          
          // Shift translation to keep the center point stationary relative to screen center
          newTransform = d3.zoomIdentity
            .translate(newTransform.x + dx, newTransform.y + dy)
            .scale(newTransform.k);
          
          shouldUpdate = true;
          prevDimensions.current = dimensions;
      }

      // B. Handle True Scale Toggle (Smart Zoom)
      if (prevTrueScale.current !== settings.trueScale) {
          const ratio = AU_SCALE_TRUE / AU_SCALE_SCHEMATIC; // ~361

          // Math Logic:
          // ScreenPos = WorldPos_AU * BaseScale * ZoomK + Translate
          // We want ScreenPos to be invariant (no jump).
          // We assume WorldPos_AU (the celestial coordinates) are invariant.
          // Therefore: BaseScale_Old * ZoomK_Old + Translate_Old = BaseScale_New * ZoomK_New + Translate_New
          // If we set Translate_New = Translate_Old, we just need to satisfy:
          // BaseScale_Old * ZoomK_Old = BaseScale_New * ZoomK_New
          // So: ZoomK_New = ZoomK_Old * (BaseScale_Old / BaseScale_New)
          
          let newK = newTransform.k;
          if (settings.trueScale) {
               // Schematic -> True Scale (Base Scale increases 65 -> 23500)
               // ZoomK must decrease by same ratio to keep visual size constant
               newK = newTransform.k / ratio;
          } else {
               // True Scale -> Schematic (Base Scale decreases 23500 -> 65)
               // ZoomK must increase
               newK = newTransform.k * ratio;
          }

          const [min, max] = solarZoomExtent(settings.trueScale, settings.showNearbyStars !== false);
          // Stellar overview is ordinary-mode only. A switch beyond the other
          // mode's range returns to its solar overview instead of an empty frame.
          newTransform = newK < min || newK > max
            ? d3.zoomIdentity.translate(dimensions.w / 2, dimensions.h / 2)
                .scale(settings.trueScale ? .8 * AU_SCALE_SCHEMATIC / AU_SCALE_TRUE : .8)
            : d3.zoomIdentity.translate(newTransform.x, newTransform.y).scale(newK);
          shouldUpdate = true;
          prevTrueScale.current = settings.trueScale;
      }

      if (shouldUpdate) {
          setZoomTransform(newTransform);
          // Important: Update D3's internal state immediately to prevent jumps on next interaction
          container.call(zoomBehaviorRef.current.transform, newTransform);
      }

  }, [dimensions, settings.trueScale, zoomTransform]);


  // Handle Camera Reset Animation (Triggered by Parent)
  useEffect(() => {
    if (!containerRef.current || !zoomBehaviorRef.current || resetCameraFlag === 0) return;
    
    const container = d3.select(containerRef.current);
    const { w, h } = dimensions;
    
    // Default zooms
    const targetScale = settings.trueScale ? 0.8 * AU_SCALE_SCHEMATIC / AU_SCALE_TRUE : 0.8;
    
    // Reset to center (Sun) and default scale with smooth easing
    const newTransform = d3.zoomIdentity.translate(w / 2, h / 2).scale(targetScale);

    container.transition()
      .duration(1200)
      .ease(d3.easeCubicOut)
      .call(zoomBehaviorRef.current.transform, newTransform);
      
  }, [resetCameraFlag, settings.trueScale, dimensions]); 

  // Explicit system view fits the local orbits once, then follows their barycenter.
  useEffect(() => {
    if (!cameraFocusId?.startsWith('barycenter:') || !settings.trueScale || !containerRef.current || !zoomBehaviorRef.current) return;
    const roots = [...planets, ...dwarfs, ...asteroidsComets];
    const parent = [SUN_DATA, ...roots, ...roots.flatMap(p => p.satellites ?? [])].find(p => p.id === cameraFocusId.slice(11));
    if (!parent) return;
    const radii = parent?.satellites?.filter(m => !m.isRing && m.elements).map(m => m.elements.a * (1+m.elements.e)) ?? [];
    // With no satellites, the system centre is the body centre. Fit the disc
    // rather than leaving the observer at the solar-system overview distance.
    const radiusAU = radii.length ? Math.max(...radii) : Math.max(.00000001, (parent.relativeRadius ?? .1) / AU_SCALE_TRUE * 3);
    const scale = Math.min(100000, Math.min(dimensions.w, dimensions.h) * .28 / (radiusAU * AU_SCALE_TRUE));
    d3.select(containerRef.current).interrupt().call(zoomBehaviorRef.current.transform,
      d3.zoomIdentity.translate(dimensions.w / 2, dimensions.h / 2).scale(scale));
  }, [cameraFocusId, settings.trueScale]);

  // Handle Camera Focus Target Tracking (Center of Rotation)
  const centerOfRotation = useMemo<Position>(() => {
    if (freeOrbitCenter && !cameraFocusId) return freeOrbitCenter;
    if (!cameraFocusId) return starTarget;
    const focusPos = calculateWorldPosition(cameraFocusId ?? 'sun', [...planets, ...dwarfs, ...asteroidsComets], currentDate, settings.useHighPrecision);

    return focusPos.x === 0 && focusPos.y === 0 && focusPos.z === 0 ? ORIGIN : focusPos;
  }, [neighborAlpha > 0, starTarget, freeOrbitCenter, cameraFocusId, currentDate, settings.trueScale, settings.useHighPrecision, planets, dwarfs, asteroidsComets]);

  useEffect(() => {

    if (cameraFocusId && containerRef.current && zoomBehaviorRef.current) {
        const { w, h } = dimensions;
        const currentK = d3.zoomTransform(containerRef.current).k;
        const newTransform = d3.zoomIdentity.translate(w / 2, h / 2).scale(currentK);
        d3.select(containerRef.current).call(zoomBehaviorRef.current.transform, newTransform);
    }
  }, [cameraFocusId, dimensions]);

  const moveTo = (k: number, x = dimensions.w / 2, y = dimensions.h / 2) => {
    if (!containerRef.current || !zoomBehaviorRef.current) return;
    d3.select(containerRef.current).interrupt().transition().duration(900).ease(d3.easeCubicInOut)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(x, y).scale(k));
  };
  const overviewDestination=useRef<boolean|null>(null);
  const goOverview = (stellar:boolean) => {
    if(!containerRef.current||!zoomBehaviorRef.current||stellar&&(settings.trueScale||settings.showNearbyStars===false))return;
    window.dispatchEvent(new Event('navigation-stop'));
    const selection=d3.select(containerRef.current);selection.interrupt();overviewDestination.current=stellar;
    const current=navigationRef.current;
    const scale=current.settings.trueScale?AU_SCALE_TRUE:AU_SCALE_SCHEMATIC;
    const start=createSceneView({scale,settings:current.settings,zoom:current.zoom,width:dimensions.w,height:dimensions.h,center:centerOfRotation,observer:current.cameraEye});
    const focal=cameraFocalPixels(dimensions.w,dimensions.h,cameraFov(current.settings))/(perspectiveStrength(current.settings)||1);
    const targetK=stellar?focal/(scale*15*LIGHT_YEAR_AU):.8*(current.settings.trueScale?AU_SCALE_SCHEMATIC/AU_SCALE_TRUE:1);
    const targetDistance=focal/(scale*targetK);
    onPlanetSelect(null);onCameraFocusChange(null);setStellarLocked(false);
    const update=(t:number)=>{
      const nextSettings={...navigationRef.current.settings,showCameraControl:true,enableSpaceView:true,
        viewTilt:current.settings.viewTilt+(90-current.settings.viewTilt)*t,
        viewYaw:current.settings.viewYaw+((0-current.settings.viewYaw+540)%360-180)*t,
        viewRoll:(current.settings.viewRoll??0)*(1-t)};
      const k=Math.exp(Math.log(current.zoom.k)+(Math.log(targetK)-Math.log(current.zoom.k))*t);
      const distance=focal/(scale*k),basis=cameraBasis(nextSettings.viewTilt,nextSettings.viewYaw,nextSettings.viewRoll);
      const startRadius=Math.max(1e-9,Math.hypot(start.cameraPosition.x,start.cameraPosition.y,start.cameraPosition.z));
      const radius=Math.exp(Math.log(startRadius)+(Math.log(targetDistance)-Math.log(startRadius))*t);
      const tilt=Math.asin(Math.max(-1,Math.min(1,start.cameraPosition.z/startRadius)));
      const yaw=Math.atan2(start.cameraPosition.y,start.cameraPosition.x);
      const latitude=tilt+(Math.PI/2-tilt)*t;
      const eye={x:radius*Math.cos(latitude)*Math.cos(yaw),y:radius*Math.cos(latitude)*Math.sin(yaw),z:radius*Math.sin(latitude)};
      const center=t===1?ORIGIN:{x:eye.x-basis.back.x*distance,y:eye.y-basis.back.y*distance,z:eye.z-basis.back.z*distance};
      const transform=d3.zoomIdentity.translate(dimensions.w/2,dimensions.h/2).scale(k);
      setCameraEye(null);setFreeOrbitCenter(center);setStarTarget(center);
      navigationRef.current={...navigationRef.current,settings:nextSettings,cameraEye:null,zoom:transform};
      onSettingsChange(nextSettings);selection.property('__zoom',transform);setZoomTransform(transform);
    };
    update(0);
    selection.transition().duration(matchMedia('(prefers-reduced-motion: reduce)').matches?0:1100).ease(d3.easeCubicInOut)
      .tween('overview',()=>update).on('end interrupt',()=>{overviewDestination.current=null;});
  };
  const showNeighbors=()=>goOverview(true);
  const returnToSolarSystem=()=>goOverview(false);
  const locateStar = (star: NearbyStar, visit = false) => {
    onCameraFocusChange(null); setStellarLocked(true);
    const p = nearbyPositionAU(star); setStarTarget(p);setFreeOrbitCenter(p);
    const distance = (visit ? .7 : 3) * LIGHT_YEAR_AU;
    const focal = cameraFocalPixels(dimensions.w, dimensions.h, cameraFov(settings));
    const k = focal / (AU_SCALE_SCHEMATIC * distance);
    if (visit) {
      setCameraEye(moveObserver(p, settings.viewTilt, settings.viewYaw, 0, 0, distance, settings.viewRoll ?? 0));
      onSettingsChange({...settings,showCameraControl:true,enableSpaceView:true,enablePerspective:true,cameraPerspective:1});
    } else setCameraEye(null);
    moveTo(k);
  };
  const cameraScene = useMemo(() => createSceneView({scale: settings.trueScale ? AU_SCALE_TRUE : AU_SCALE_SCHEMATIC,
    settings, zoom:zoomTransform, width:dimensions.w, height:dimensions.h, center:centerOfRotation, observer:cameraEye}),
    [settings.viewTilt,settings.viewYaw,settings.viewRoll,settings.enablePerspective,settings.cameraPerspective,settings.cameraFov,settings.trueScale,zoomTransform,dimensions,centerOfRotation,cameraEye]);
  const travelStep = cameraScene.worldUnitsPerPixel * Math.min(dimensions.w,dimensions.h) * .45 * (settings.cameraTravelSpeed ?? 1);
  const applyNavigation = (input:NavigationInput) => {
    const current=navigationRef.current;
    if(containerRef.current)d3.select(containerRef.current).interrupt();
    const baseSettings=current.settings.showCameraControl?current.settings:{...current.settings,showCameraControl:true,enableSpaceView:true,enablePerspective:true,cameraPerspective:1};
    const moving=!!(input.right||input.down||input.forward);
    const baseScene=createSceneView({scale:baseSettings.trueScale?AU_SCALE_TRUE:AU_SCALE_SCHEMATIC,settings:baseSettings,
      zoom:current.zoom,width:current.dimensions.w,height:current.dimensions.h,center:centerOfRotation,observer:current.cameraEye});
    const nextSettings={...baseSettings,...rotateCameraLocal(baseSettings.viewTilt,baseSettings.viewYaw,baseSettings.viewRoll??0,input.yaw,input.pitch,input.roll)};
    if(moving){
      const step=baseScene.worldUnitsPerPixel*Math.min(current.dimensions.w,current.dimensions.h)*.45*(baseSettings.cameraTravelSpeed??1);
      const eye=current.cameraEye??baseScene.cameraPosition;
      const next=moveObserver(eye,nextSettings.viewTilt,nextSettings.viewYaw,input.right*step,input.down*step,-input.forward*step,nextSettings.viewRoll);
      navigationRef.current.cameraEye=next;setCameraEye(next);
      if(!current.cameraEye){onCameraFocusChange(null);if(neighborAlpha>0)setStellarLocked(true);}
    }
    navigationRef.current.settings=nextSettings;onSettingsChange(nextSettings);
  };
  const lookDrag=useRef<{id:number;x:number;y:number;distance:number}|null>(null);
  const suppressSceneClick=useRef(false);
  const touchAngle=useRef<number|null>(null);
  useEffect(()=>{const stop=()=>{lookDrag.current=null;touchAngle.current=null;};window.addEventListener('blur',stop);document.addEventListener('visibilitychange',stop);return()=>{window.removeEventListener('blur',stop);document.removeEventListener('visibilitychange',stop);};},[]);
  const toggleRoaming = () => {
    if (neighborAlpha > 0) setStellarLocked(true);
    if (cameraEye) {
      // Keep the same camera position when returning to orbit around a local point.
      const focus=moveObserver(cameraEye,settings.viewTilt,settings.viewYaw,0,0,-cameraScene.focusDistanceAU,settings.viewRoll??0);
      if (neighborAlpha > 0) {setStarTarget(focus);setFreeOrbitCenter(focus);}
      else {setFreeOrbitCenter(focus);onCameraFocusChange(null);}
      setCameraEye(null);
    } else {
      setCameraEye(cameraScene.cameraPosition);
      onSettingsChange({...settings,showCameraControl:true,enableSpaceView:true,enablePerspective:true,cameraPerspective:1});
    }
    if(containerRef.current&&zoomBehaviorRef.current) d3.select(containerRef.current).interrupt().call(zoomBehaviorRef.current.transform,
      d3.zoomIdentity.translate(dimensions.w/2,dimensions.h/2).scale(zoomTransform.k));
  };
  const resetView = () => {
    window.dispatchEvent(new Event('navigation-stop'));
    if(!containerRef.current||!zoomBehaviorRef.current)return;
    const current=navigationRef.current;
    const scene=createSceneView({scale:current.settings.trueScale?AU_SCALE_TRUE:AU_SCALE_SCHEMATIC,
      settings:current.settings,zoom:current.zoom,width:dimensions.w,height:dimensions.h,center:centerOfRotation,observer:current.cameraEye});
    const pose=solarResetPose(scene.cameraPosition,current.settings.viewTilt,current.settings.viewYaw,current.settings.viewRoll??0,scene.focusDistanceAU);
    const selection=d3.select(containerRef.current);selection.interrupt();
    const startEye=scene.cameraPosition,roaming=!!current.cameraEye;
    const scale=current.settings.trueScale?AU_SCALE_TRUE:AU_SCALE_SCHEMATIC;
    const focal=cameraFocalPixels(dimensions.w,dimensions.h,cameraFov(current.settings))/(perspectiveStrength(current.settings)||1);
    const targetK=focal/(scale*pose.distance);
    const angle=(a:number,b:number,t:number)=>a+((b-a+540)%360-180)*t;
    const update=(t:number)=>{
      const nextSettings={...navigationRef.current.settings,
        viewTilt:current.settings.viewTilt+(pose.viewTilt-current.settings.viewTilt)*t,
        viewYaw:angle(current.settings.viewYaw,pose.viewYaw,t),viewRoll:angle(current.settings.viewRoll??0,0,t)};
      const basis=cameraBasis(nextSettings.viewTilt,nextSettings.viewYaw,nextSettings.viewRoll);
      // Looking home rotates in place; the overhead step follows a constant-radius arc.
      const eye=pose.overhead?{x:basis.back.x*pose.distance,y:basis.back.y*pose.distance,z:basis.back.z*pose.distance}:startEye;
      const k=Math.exp(Math.log(current.zoom.k)+(Math.log(targetK)-Math.log(current.zoom.k))*t);
      const distance=focal/(scale*k);
      const center=t===1?ORIGIN:{x:eye.x-basis.back.x*distance,y:eye.y-basis.back.y*distance,z:eye.z-basis.back.z*distance};
      const nextEye=roaming?eye:null;
      navigationRef.current.settings=nextSettings;navigationRef.current.cameraEye=nextEye;
      setCameraEye(nextEye);setFreeOrbitCenter(center);setStarTarget(center);onSettingsChange(nextSettings);
      const transform=d3.zoomIdentity.translate(dimensions.w/2,dimensions.h/2).scale(k);
      // Keep D3 and React in sync without zoom.transform interrupting this transition.
      selection.property('__zoom',transform);navigationRef.current.zoom=transform;setZoomTransform(transform);
    };
    onCameraFocusChange(null);if(neighborAlpha>0)setStellarLocked(true);
    update(0);
    selection.transition().duration(matchMedia('(prefers-reduced-motion: reduce)').matches?0:700).ease(d3.easeCubicInOut)
      .tween('solar-reset',()=>update);
  };

  useImperativeHandle(ref,()=>({openNearby:()=>{setNearbyPanelSignal(v=>v+1);if(neighborAlpha===0)showNeighbors();},
    toggleNearby:()=>{if(overviewDestination.current??(neighborAlpha>.5))returnToSolarSystem();else {setNearbyPanelSignal(v=>v+1);showNeighbors();}},resetView}));
  const travelLabel = neighborAlpha > 0 ? `${(travelStep/LIGHT_YEAR_AU).toPrecision(2)} 光年/秒`
    : travelStep < .01 ? `${(travelStep*149597870.7).toPrecision(2)} 千米/秒` : `${travelStep.toPrecision(2)} AU/秒`;

  return (
    <div ref={containerRef} data-scene className="w-full h-full min-w-0 min-h-0 flex-1 bg-black cursor-move relative overflow-hidden"
      onTouchStartCapture={e=>{if(e.touches.length===2&&!(e.target as Element).closest('[data-scene-ui]'))touchAngle.current=Math.atan2(e.touches[1].clientY-e.touches[0].clientY,e.touches[1].clientX-e.touches[0].clientX);}}
      onTouchMoveCapture={e=>{if(touchAngle.current===null||e.touches.length!==2)return;
        const angle=Math.atan2(e.touches[1].clientY-e.touches[0].clientY,e.touches[1].clientX-e.touches[0].clientX);
        const delta=Math.atan2(Math.sin(angle-touchAngle.current),Math.cos(angle-touchAngle.current))*180/Math.PI;
        if(Math.abs(delta)>1.2){touchAngle.current=angle;applyNavigation({yaw:0,pitch:0,roll:-delta,right:0,down:0,forward:0});}
      }}
      onTouchEndCapture={()=>{touchAngle.current=null;}} onTouchCancelCapture={()=>{touchAngle.current=null;}}
      onContextMenu={e=>{if(!(e.target as Element).closest('[data-scene-ui]'))e.preventDefault();}}
      onPointerDownCapture={e=>{
        if((e.button!==2&&!(e.button===0&&e.altKey))||e.pointerType==='touch'||(e.target as Element).closest('[data-scene-ui]'))return;
        e.preventDefault();lookDrag.current={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};suppressSceneClick.current=false;e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={e=>{const d=lookDrag.current;if(!d||d.id!==e.pointerId)return;
        const dx=e.clientX-d.x,dy=e.clientY-d.y;d.x=e.clientX;d.y=e.clientY;d.distance+=Math.hypot(dx,dy);
        if(d.distance>4)suppressSceneClick.current=true;
        const sensitivity=cameraFov(navigationRef.current.settings)/Math.min(dimensions.w,dimensions.h);
        applyNavigation({yaw:dx*sensitivity,pitch:dy*sensitivity,roll:0,right:0,down:0,forward:0});
      }}
      onPointerUp={e=>{if(lookDrag.current?.id===e.pointerId){lookDrag.current=null;setTimeout(()=>{suppressSceneClick.current=false;},0);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);}}}
      onPointerCancel={()=>{lookDrag.current=null;}}
      onLostPointerCapture={()=>{lookDrag.current=null;}}
      onClickCapture={e=>{if(suppressSceneClick.current){e.stopPropagation();suppressSceneClick.current=false;}}}>
      <div className="absolute inset-0 pointer-events-none bg-black" style={{ opacity: 1 - neighborAlpha }}>
         <div className="absolute inset-0 bg-[#020306]" />
         {settings.skyEnabled !== false && neighborAlpha < 1 && <StarField
            settings={settings}
            focalPixels={cameraFocalPixels(dimensions.w,dimensions.h,cameraFov(settings))/(perspectiveStrength(settings)||1)}
            realStars={realStars} 
            constellations={constellations}
         />}
      </div>
      
      {settings.trueScale ? (
        <TrueScaleSolarSystem 
            currentDate={currentDate} settings={settings} onPlanetSelect={onPlanetSelect} selectedPlanetId={selectedPlanetId}
            highlightedAlignment={highlightedAlignment} pinnedPlanets={pinnedPlanets} zoomTransform={zoomTransform}
            dimensions={dimensions} centerOfRotation={centerOfRotation} cameraEye={cameraEye} cameraFocusId={cameraFocusId}
            planets={planets} dwarfs={dwarfs} asteroidsComets={asteroidsComets}
            visibilityMap={visibilityMap}
        />
      ) : neighborAlpha < 1 ? (
        <div className="absolute inset-0" style={{ opacity: 1 - neighborAlpha, pointerEvents: neighborAlpha > .5 ? 'none' : undefined }}>
        <SchematicSolarSystem 
            currentDate={currentDate} settings={settings} onPlanetSelect={onPlanetSelect} selectedPlanetId={selectedPlanetId}
            highlightedAlignment={highlightedAlignment} pinnedPlanets={pinnedPlanets} zoomTransform={zoomTransform}
            dimensions={dimensions} centerOfRotation={centerOfRotation} cameraEye={cameraEye} cameraFocusId={cameraFocusId}
            planets={planets} dwarfs={dwarfs} asteroidsComets={asteroidsComets}
            visibilityMap={visibilityMap}
        />
        </div>
      ) : null}

      {!settings.trueScale && settings.showNearbyStars !== false && <NearbyStars settings={settings}
        onSettingsChange={onSettingsChange} dimensions={dimensions} alpha={neighborAlpha}
        onReturn={returnToSolarSystem} onSelect={() => onPlanetSelect(null)} onLocate={locateStar}
        scene={cameraScene} roaming={!!cameraEye} panelSignal={nearbyPanelSignal} />}
      <VirtualJoystick enabled={settings.showCameraControl} onInput={applyNavigation} onReset={resetView}
        onModeChange={toggleRoaming} roaming={!!cameraEye} stellar={neighborAlpha > 0} travelLabel={travelLabel}
        />

      {/* Minimalist Compact Watermark Camera Info - Bottom Left */}
      <div data-camera-info className="absolute top-3 left-4 pointer-events-none z-20 flex flex-col gap-px select-none text-gray-600 text-[10px] font-mono font-bold tracking-widest uppercase">
         <span className="flex items-center gap-2"><span>TGT</span> <span>{neighborAlpha > 0 ? 'SOLAR NEIGHBOURHOOD' : getTargetName()}</span></span>
         <span className="flex items-center gap-2"><span>ZM</span> <span>{zoomTransform.k.toExponential(1)}x</span></span>
         <span className="flex items-center gap-2"><span>TILT</span> <span>{settings.viewTilt.toFixed(0)}°</span></span>
         <span className="flex items-center gap-2"><span>YAW</span> <span>{settings.viewYaw.toFixed(0)}°</span></span>
         <span className="flex items-center gap-2"><span>ROLL</span> <span>{(settings.viewRoll??0).toFixed(0)}°</span></span>
      </div>
    </div>
  );

  function getTargetName() {
      if (!cameraFocusId) return "SUN (FREE)";
      if (cameraFocusId === 'sun') return "SUN";
      const allBodies = [...planets, ...dwarfs, ...asteroidsComets];
      const p = allBodies.find(x => x.id === cameraFocusId);
      if (p) return p.englishName.toUpperCase();
      for (const pl of planets) {
          const m = pl.satellites?.find(s => s.id === cameraFocusId);
          if (m) return `${m.englishName.toUpperCase()}`;
      }
      return cameraFocusId.toUpperCase();
  }
});

export default SolarSystem;
