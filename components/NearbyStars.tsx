import {InspectorHeader,InspectorAction} from './InspectorControls';
import { drawStar } from '../core/starSprites';
import { starLabelBudget, labelPriority, StableStarLabels, starLabelBox, LabelBox } from '../core/starLabels';
import FloatingPanel from './FloatingPanel';
import { Segments, Slider, Toggle } from './settings/SettingsControls';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { AppSettings, NearbyStar, NearbyStarCatalog } from '../types';
import { SceneView } from '../core/sceneView';
import { renderBudget } from '../core/renderBudget';
import { useCanvasDraw } from '../hooks/useCanvasDraw';
import { LIGHT_YEAR_AU, loadNearbyCatalog, nearbyRadius, nearbyStarName, nearbyPositionAU,
  projectNearbyStars, pickNearbyStar, NearbyPoint, NEARBY_RADII, SPECTRAL_GROUPS, spectralGroup } from '../core/nearbyStars';
import './nearby-stars.css';

interface Props {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  dimensions: { w: number; h: number };
  alpha: number;
  onReturn: () => void;
  onSelect: () => void;
  onLocate: (star: NearbyStar, visit?: boolean) => void;
  scene: SceneView;
  roaming: boolean;
  panelSignal?: number;
}

function StarCanvas({ scene, stars, alpha, settings, selected, onSelect, onReturn }: {
  scene: SceneView; stars: NearbyStar[]; alpha: number; settings: AppSettings;
  selected: NearbyStar | null; onSelect: (star: NearbyStar) => void; onReturn: () => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const points = useRef<NearbyPoint[]>([]);
  const labelLayout=useRef(new StableStarLabels());
  const labelWidths=useRef(new Map<string,number>());
  const sun = useRef<{ x: number; y: number } | null>(null);
  const radiusLy = nearbyRadius(settings);
  const quality = settings.renderSettings.sceneQuality ?? 'standard';
  useCanvasDraw(ref, ctx => {
    const projected = projectNearbyStars(stars, scene, {density:settings.nearbyStarDensity ?? 'balanced',
      contrast:settings.nearbyStarContrast ?? 1,magnitudeLimit:settings.nearbyMagnitudeLimit ?? 16,selectedId:selected?.id});
    points.current = projected;
    ref.current?.setAttribute('data-visible-stars', String(projected.length));
    ctx.globalAlpha = alpha;
    // A few clipped distance rings provide depth without a dense star-to-star mesh.
    ctx.strokeStyle = '#45617b'; ctx.lineWidth = .8;
    const circle = (radius: number, plane: 'xy' | 'xz' | 'yz') => {
      ctx.beginPath();
      let previous;
      for (let i = 0; i <= 96; i++) {
        const t = i / 96 * Math.PI * 2, a = radius * LIGHT_YEAR_AU * Math.cos(t), b = radius * LIGHT_YEAR_AU * Math.sin(t);
        const p = scene.toCamera(plane === 'xy' ? { x: a, y: b, z: 0 } : plane === 'xz' ? { x: a, y: 0, z: b } : { x: 0, y: a, z: b });
        if (previous) {
          const line = scene.clipSegment(previous, p);
          if (line) { ctx.moveTo(line[0].screenX!, line[0].screenY!); ctx.lineTo(line[1].screenX!, line[1].screenY!); }
        }
        previous = p;
      }
      ctx.stroke();
    };
    if (settings.nearbyShowGuides !== false) {
      ctx.globalAlpha = alpha * .7;
      for (const r of [10, 25, 50, 100]) if (r <= radiusLy) circle(r, 'xy');
      ctx.globalAlpha=alpha*.4;ctx.strokeStyle='#304357';ctx.lineWidth=.6;
      ctx.setLineDash([2, 6]); circle(radiusLy, 'xz'); circle(radiusLy, 'yz'); ctx.setLineDash([]);
    }

    for (const p of projected) drawStar(ctx,p.x,p.y,p.radius,p.star.color,alpha*p.opacity);
    ctx.globalAlpha = alpha;
    const origin = scene.project({ x: 0, y: 0, z: 0 });
    sun.current = scene.sphereVisible(origin, 20) ? { x: origin.screenX!, y: origin.screenY! } : null;
    ctx.font = '12px "Segoe UI", sans-serif';
    const boxes:LabelBox[]=[];
    const measure=(text:string)=>{let w=labelWidths.current.get(text);if(w===undefined){w=ctx.measureText(text).width;labelWidths.current.set(text,w);}return w;};
    const label=(text:string,x:number,y:number,_force=false)=>{
      const box=starLabelBox({x,y,radius:5},measure(text),scene.width,scene.height);boxes.push(box);
      ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#020306';ctx.fillStyle='#d1dbe8';
      ctx.strokeText(text,box.x+3,box.y+box.h/2,box.w-6);ctx.fillText(text,box.x+3,box.y+box.h/2,box.w-6);
    };
    if (sun.current) {
      ctx.fillStyle = '#ffd788'; ctx.beginPath(); ctx.arc(sun.current.x, sun.current.y, 4, 0, Math.PI * 2); ctx.fill();
      label('太阳系', sun.current.x, sun.current.y, true);
    }
    const chosen = projected.find(p => p.star.id === selected?.id);
    if (chosen) {
      ctx.strokeStyle = '#a5eaff'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(chosen.x, chosen.y, 8, 0, Math.PI * 2); ctx.stroke();
      const segment = scene.clipSegment(scene.toCamera({ x: 0, y: 0, z: 0 }), scene.toCamera(nearbyPositionAU(chosen.star)));
      if (segment) {
        ctx.globalAlpha = alpha * .35; ctx.setLineDash([3, 5]); ctx.beginPath();
        ctx.moveTo(segment[0].screenX!, segment[0].screenY!); ctx.lineTo(segment[1].screenX!, segment[1].screenY!); ctx.stroke();
        ctx.setLineDash([]); ctx.globalAlpha = alpha;
      }
      label(`${nearbyStarName(chosen.star)} · ${chosen.distanceLy.toFixed(2)} 光年`, chosen.x, chosen.y, true);
    }
    const candidates=projected.filter(p=>p.star.id!==selected?.id).map(p=>({id:p.star.id,x:p.x,y:p.y,radius:p.radius,
      text:nearbyStarName(p.star),priority:labelPriority(p.x,p.y,scene.width,scene.height,p.apparentMagnitude)+Math.log2(Math.max(.01,p.distanceLy))}));
    const budget=settings.showNearbyStarLabels===false?0:starLabelBudget(scene.width,scene.height,quality,settings.nearbyStarLabelDensity??1);
    const layout=labelLayout.current.layout(candidates,scene.width,scene.height,budget,measure,boxes);
    ctx.textAlign='left';ctx.textBaseline='middle';ctx.lineWidth=3;ctx.strokeStyle='#020306';ctx.fillStyle='#d1dbe8';
    for(const p of layout.labels){
      ctx.globalAlpha=alpha*p.alpha;
      ctx.strokeText(p.text,p.box.x+3,p.box.y+p.box.h/2,p.box.w-6);ctx.fillText(p.text,p.box.x+3,p.box.y+p.box.h/2,p.box.w-6);
    }
    return layout.animating;

  }, [scene, stars, alpha, selected?.id, settings.showNearbyStarLabels, settings.nearbyStarLabelDensity, radiusLy, quality, settings.nearbyStarDensity, settings.nearbyMagnitudeLimit, settings.nearbyStarContrast, settings.nearbyShowGuides], renderBudget(settings.renderSettings).maxDpr);

  return <canvas ref={ref} className="nearby-canvas" aria-label="邻近恒星三维空间星图"
    title="左拖平移，右拖转向，滚轮或双指缩放；点击恒星查看详情"
    onClick={event => {
      if (alpha < .2) return;
      const rect = event.currentTarget.getBoundingClientRect(), x = event.clientX - rect.left, y = event.clientY - rect.top;
      const star = pickNearbyStar(points.current, x, y, (event.nativeEvent as PointerEvent).pointerType === 'touch' ? 14 : 10);
      const sunDistance = sun.current ? Math.hypot(x - sun.current.x, y - sun.current.y) : Infinity;
      const starPoint = star && points.current.find(p => p.star.id === star.id);
      if (sunDistance < 9 && (!starPoint || sunDistance < Math.hypot(x - starPoint.x, y - starPoint.y))) onReturn();
      else if (star) onSelect(star);
    }} />;
}

const NearbyStars: React.FC<Props> = ({ settings, onSettingsChange, dimensions, alpha, onReturn, onSelect, onLocate, scene, roaming, panelSignal }) => {
  const [catalog, setCatalog] = useState<NearbyStarCatalog | null>(null);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<NearbyStar | null>(null);
  const [query, setQuery] = useState('');
  const [showTools,setShowTools] = useState(true);
  useEffect(() => setShowTools(true),[panelSignal]);
  const active = alpha > 0;
  const radius = nearbyRadius(settings);

  useEffect(() => {
    if (!active || catalog) return;
    let disposed = false;
    setError('');
    loadNearbyCatalog().then(value => { if (!disposed) setCatalog(value); })
      .catch(() => { if (!disposed) setError('邻近恒星数据加载失败'); });
    return () => { disposed = true; };
  }, [active, catalog, retry]);
  useEffect(() => {
    if (!active || (selected && selected.distanceLy > radius)) setSelected(null);
    if (!active) setQuery('');
  }, [active, radius, selected]);
  const allStars = useMemo(() => (catalog?.stars ?? []).filter(s => s.distanceLy <= radius)
    .sort((a, b) => Number(!!(b.name || b.englishName)) - Number(!!(a.name || a.englishName)) || a.distanceLy - b.distanceLy), [catalog, radius]);
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? allStars.filter(s => [s.name, s.englishName, s.designation, s.hipId && `HIP ${s.hipId}`, s.id]
      .some(value => value?.toLowerCase().includes(needle))).slice(0, 8) : [];
  }, [allStars, query]);
  const spectral = settings.nearbySpectralTypes ?? [...SPECTRAL_GROUPS];
  const stars = useMemo(() => allStars.filter(s => spectral.includes(spectralGroup(s.spectralType)) || s.id === selected?.id),
    [allStars,settings.nearbySpectralTypes,selected?.id]);
  const counts = useMemo(() => Object.fromEntries(SPECTRAL_GROUPS.map(g => [g,allStars.filter(s => spectralGroup(s.spectralType)===g).length])),[allStars]);
  const update = (patch:Partial<AppSettings>) => onSettingsChange({...settings,...patch});
  const choose = (star: NearbyStar) => {
    setSelected(star); setQuery('');

    onSelect();
  };

  const selectedDistance = selected ? Math.hypot(nearbyPositionAU(selected).x-scene.cameraPosition.x,
    nearbyPositionAU(selected).y-scene.cameraPosition.y,nearbyPositionAU(selected).z-scene.cameraPosition.z)/LIGHT_YEAR_AU : 0;
  return <>
    {active && catalog && <StarCanvas scene={scene} stars={stars} alpha={alpha} settings={settings} selected={selected}
      onSelect={choose} onReturn={onReturn} />}
    {active && showTools && <FloatingPanel revealKey={panelSignal} id="nearby" title="太阳近邻" subtitle={`${radius} 光年 · ${roaming?'漫游':'环绕'}`} top={64} className="panel-nearby" onClose={() => setShowTools(false)}>
      <div className="nearby-panel">
        <div className="nearby-panel-navigation"><button onClick={onReturn}>← 太阳系</button><span>J2000.0</span></div>
        <Segments label="以太阳为中心的收录范围" value={String(radius)} options={NEARBY_RADII.map(r=>({value:String(r),label:`${r} 光年`}))}
          onChange={v=>update({nearbyStarRadiusLy:Number(v) as 25|50|100})} />
        <p className="settings-note">{catalog ? `当前筛选 ${stars.length.toLocaleString()} / ${allStars.length.toLocaleString()} 颗` : error || '正在加载星表…'} · 非完整普查</p>
        {error && <button className="settings-button" onClick={()=>setRetry(v=>v+1)}>重试加载</button>}
        {catalog && <div className="nearby-search"><input aria-label="查找邻近恒星" placeholder="名称 / HIP / Gliese"
          value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{
            if(e.key==='Escape'){e.preventDefault();setQuery('');}
            if(e.key==='Enter'&&matches[0]){choose(matches[0]);onLocate(matches[0]);}
          }}/>
          {query.trim()&&<div className="nearby-results" aria-label="恒星搜索结果">{matches.length ? matches.map(star=><button key={star.id} onClick={()=>{choose(star);onLocate(star);}}>
            <span>{nearbyStarName(star)}</span><small>{star.distanceLy.toFixed(2)} 光年</small></button>):<p>当前范围内未收录匹配的恒星</p>}</div>}
        </div>}
        <Segments label="星点密度" value={settings.nearbyStarDensity??'balanced'} options={[{value:'sparse',label:'疏朗'},{value:'balanced',label:'标准'},{value:'all',label:'全部'}]}
          onChange={v=>update({nearbyStarDensity:v as 'sparse'|'balanced'|'all'})}/>
        <details className="nearby-filters" open={dimensions.w >= 640}>
          <summary>光谱类型 <button className="nearby-text-button" onClick={e=>{e.preventDefault();update({nearbySpectralTypes:[...SPECTRAL_GROUPS]});}}>全选</button></summary>
          <div className="nearby-spectra" role="group" aria-label="光谱筛选">{SPECTRAL_GROUPS.map(g=><button key={g} aria-pressed={spectral.includes(g)}
            onClick={()=>update({nearbySpectralTypes:spectral.includes(g)?spectral.filter(x=>x!==g):[...spectral,g]})}>
            <span>{g}</span><small>{counts[g]}</small></button>)}</div>
        </details>
        <details className="nearby-filters"><summary>显示选项</summary>
          <Slider label="最暗可见星等" min={0} max={22} step={.5} value={settings.nearbyMagnitudeLimit??16}
            display={`${(settings.nearbyMagnitudeLimit??16).toFixed(1)} 等`} onChange={v=>update({nearbyMagnitudeLimit:v})}/>
          <Toggle label="恒星名称" checked={settings.showNearbyStarLabels!==false} onChange={v=>update({showNearbyStarLabels:v})}/>
          <Toggle label="距离参考环" checked={settings.nearbyShowGuides!==false} onChange={v=>update({nearbyShowGuides:v})}/>
          <p className="settings-note">明暗随观察位置变化；搜索涵盖范围内全部恒星。</p>
        </details>
        {catalog && stars.length===0 && <p role="status" className="settings-note">没有符合光谱筛选的恒星。可全选光谱或搜索目标。</p>}
        <p className="settings-note">观察位置距太阳 {(Math.hypot(scene.cameraPosition.x,scene.cameraPosition.y,scene.cameraPosition.z)/LIGHT_YEAR_AU).toFixed(2)} 光年</p>
      </div>
    </FloatingPanel>}
    {active && selected && <FloatingPanel revealKey={selected.id} id="star-info" title="恒星信息" subtitle={nearbyStarName(selected)} side="right" top={64} className="panel-inspector" onClose={()=>setSelected(null)}>
      <div className="nearby-info-content inspector-content">
        <InspectorHeader name={nearbyStarName(selected)} subtitle={selected.englishName||selected.designation} color={selected.color}/>
        <div className="inspector-actions" role="group" aria-label="恒星观察">
          <InspectorAction kind="orbit" label="环绕观察" onClick={()=>onLocate(selected)}>环绕观察</InspectorAction>
          <InspectorAction kind="travel" label="前往附近" onClick={()=>onLocate(selected,true)}>前往附近</InspectorAction>
        </div>
        <dl><div><dt>距观察者</dt><dd>{selectedDistance.toFixed(3)} 光年</dd></div><div><dt>距太阳</dt><dd>{selected.distanceLy.toFixed(3)} 光年</dd></div>
          <div><dt>光谱类型</dt><dd>{selected.spectralType||'未收录'}</dd></div><div><dt>目录视星等（V）</dt><dd>{selected.magnitude.toFixed(2)}</dd></div>
          <div><dt>绝对星等（V）</dt><dd>{selected.absoluteMagnitude.toFixed(2)}</dd></div>{selected.hipId&&<div><dt>Hipparcos</dt><dd>HIP {selected.hipId}</dd></div>}</dl>

        <p className="settings-note">位置固定在 J2000.0，不随播放日期改变。星点与光晕为示意；目录视星等是从太阳系方向观测的数值。</p>
        <p className="nearby-source">数据：<a href="https://github.com/astronexus/HYG-Database/blob/main/hyg/README.md" target="_blank" rel="noreferrer">HYG v4.1 · David Nash</a><br/>
          <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noreferrer">CC BY-SA 4.0</a> · <a href="/data/nearby-star-sources.json" target="_blank" rel="noreferrer">来源与处理说明</a></p>
      </div>
    </FloatingPanel>}
  </>;
};
export default React.memo(NearbyStars);
