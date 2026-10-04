import { createPortal } from 'react-dom';


import React, { useState, useEffect, useRef } from 'react';
import { AppSettings, RenderQuality } from '../types';
import ObjectManager from './ObjectManager';
import CelestialSettings from './CelestialSettings';
import { Section, Toggle, Slider, Segments, CompactChoice } from './settings/SettingsControls';
import { setCameraMovement } from '../core/cameraSettings';
import { cameraFov, perspectiveStrength } from '../core/cameraOptics';
import { nearbyRadius } from '../core/nearbyStars';

interface SettingsPanelProps {
  focusCamera?: boolean;
  revealKey?: number;
  settings: AppSettings;
  onSettingsChange: (newSettings: AppSettings) => void;
  onClose: () => void;
  searchActive?: boolean;
  onSaveDefaults?: () => void;
  onClearDefaults?: () => void;
  onRestoreDefaults?: () => void;
  
  // Object Management Props
  allBodies: PlanetData[];
  visibilityMap: Record<string, boolean>;
  onToggleVisibility: (id: string) => void;
  onDataReload: () => void;
  onJumpToEncounter: (body: PlanetData) => void;
}

import { PlanetData } from '../types';

const SettingsPanel: React.FC<SettingsPanelProps> = ({ 
  settings, focusCamera, revealKey,
  onSettingsChange, 
  onClose, 
  searchActive = false,
  onSaveDefaults,
  onClearDefaults,
  onRestoreDefaults,
  allBodies,
  visibilityMap,
  onToggleVisibility,
  onDataReload,
  onJumpToEncounter
}) => {
  
  const [feedback, setFeedback] = useState<string | null>(null);
  const dialogRef=useRef<HTMLDialogElement>(null);
  const [showObjectManager, setShowObjectManager] = useState(false);

  const handleAction = (action: () => void, msg: string) => {
    action();
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const toggleCameraControl = () => onSettingsChange(setCameraMovement(settings, !settings.showCameraControl));
  useEffect(()=>{
    const dialog=dialogRef.current;if(!dialog)return;
    if(!dialog.open)dialog.showModal();
    if(focusCamera)dialog.querySelector('[aria-label="空间视角"]')?.scrollIntoView({block:'start'});
    return()=>dialog.close();
  },[showObjectManager,revealKey]);


  const set = (patch: Partial<AppSettings>) => onSettingsChange({ ...settings, ...patch });
  const updateRenderSetting = <K extends keyof AppSettings['renderSettings'],>(key: K, value: AppSettings['renderSettings'][K]) =>
    set({ renderSettings: { ...settings.renderSettings, [key]: value } });
  const qualityOptions: { value: RenderQuality; label: string }[] = [
    { value: 'eco', label: '节能' }, { value: 'standard', label: '默认' }, { value: 'performance', label: '完整' },
  ];
  return <>
    {!showObjectManager && createPortal(<dialog ref={dialogRef} data-scene-ui className="settings-dialog" aria-label="系统设置" aria-modal="true"
      onCancel={e=>{e.preventDefault();onClose();}}
      onKeyDown={e=>{if(e.code==='KeyM'&&!e.repeat&&!e.nativeEvent.isComposing&&!e.ctrlKey&&!e.metaKey&&!e.altKey&&!(e.target as Element).closest('input,textarea,select,[contenteditable=true]')){e.preventDefault();onClose();}}}
      onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
        <header className="settings-header"><div><h2>系统设置</h2><p>天体 · 视角 · 星空</p></div><button className="settings-close" aria-label="关闭系统设置" onClick={onClose}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
        <div className="settings-content">
          <div className="settings-column">
            <Section title="天体对象" theme="orange" action={<button className="settings-button" onClick={() => setShowObjectManager(true)}>管理天体</button>}>
              <Toggle label="高精度天文引擎" description="启用精确位置计算与天象搜索" checked={settings.useHighPrecision} onChange={value => set({ useHighPrecision: value })} />
              <Toggle label="真实比例大小" checked={settings.trueScale} onChange={value => set({ trueScale: value })} />
              <Toggle label="显示海王星外天体与矮行星" checked={settings.showDwarfPlanets} onChange={value => set({ showDwarfPlanets: value })} />
              <Toggle label="显示彗星与小行星" checked={settings.showAsteroidsComets} onChange={value => set({ showAsteroidsComets: value })} />
              {settings.showAsteroidsComets && <div className="settings-small-bodies" role="group" aria-label="彗星与小行星详细设置">
                <div className="settings-compact-row" role="group" aria-label="小行星设置">
                  <span>小行星</span>
                  <div className="settings-compact-options">
                    <CompactChoice label="天体" ariaLabel="显示小行星" checked={settings.showAsteroids !== false} onChange={value => set({showAsteroids:value})} />
                    {settings.showAsteroids !== false && <CompactChoice label="轨道" ariaLabel="显示小行星轨道" checked={settings.showAsteroidOrbits !== false} onChange={value => set({showAsteroidOrbits:value})} />}
                    <CompactChoice label="非主带族群" ariaLabel="显示非主带族群" checked={settings.showNonMainBeltPopulations === true} onChange={value => set({showNonMainBeltPopulations:value})} />
                  </div>
                </div>
                <div className="settings-compact-row" role="group" aria-label="彗星设置">
                  <span>彗星</span>
                  <div className="settings-compact-options">
                    <CompactChoice label="天体" ariaLabel="显示彗星" checked={settings.showComets !== false} onChange={value => set({showComets:value})} />
                    {settings.showComets !== false && <>
                      <CompactChoice label="轨道" ariaLabel="显示彗星轨道" checked={settings.showCometOrbits !== false} onChange={value => set({showCometOrbits:value})} />
                      <CompactChoice label="彗尾" ariaLabel="显示彗星彗尾" checked={settings.showCometTails !== false} onChange={value => set({showCometTails:value})} />
                    </>}
                  </div>
                </div>
                <div className="settings-compact-row" role="group" aria-label="星际天体设置">
                  <span>星际天体</span>
                  <div className="settings-compact-options">
                    <CompactChoice label="天体" ariaLabel="显示星际天体" checked={settings.showInterstellar !== false} onChange={value => set({showInterstellar:value})} />
                    {settings.showInterstellar !== false && <>
                      <CompactChoice label="轨道" ariaLabel="显示星际天体轨道" checked={settings.showInterstellarOrbits !== false} onChange={value => set({showInterstellarOrbits:value})} />
                      <CompactChoice label="彗尾" ariaLabel="显示星际彗尾（若有）" checked={settings.showInterstellarTails === true} onChange={value => set({showInterstellarTails:value})} />
                    </>}
                  </div>
                </div>
              </div>}
              <Toggle label="显示太阳系边界" description="柯伊伯带与日球层顶" checked={settings.showRegionLabels} onChange={value => set({ showRegionLabels: value })} />
              <div className="settings-divider"><Slider label="轨道可见度" max={1} value={settings.orbitOpacity} onChange={value => set({ orbitOpacity: value })} /></div>
            </Section>
            <Section title="邻近恒星" theme="stellar">
              <Toggle label="显示邻近恒星"
                checked={settings.showNearbyStars !== false} onChange={value => set({ showNearbyStars: value })} />
              {settings.showNearbyStars !== false && <>
                <Segments label="收录范围半径" value={String(nearbyRadius(settings))}
                  options={[{ value: '25', label: '25 光年' }, { value: '50', label: '50 光年' }, { value: '100', label: '100 光年' }]}
                  onChange={value => set({ nearbyStarRadiusLy: Number(value) as 25 | 50 | 100 })} />
                <Slider label="恒星明暗对比" max={1} step={.02} value={settings.nearbyStarContrast ?? 1}
                  display={`${Math.round((settings.nearbyStarContrast ?? 1)*100)}%`}
                  onChange={value=>set({nearbyStarContrast:value})}/>
                <div className="settings-row settings-note"><span>暗星增强</span><span>自然对比</span></div>
                <p className="settings-note">向左增强暗星。</p>
                <Toggle label="显示邻近恒星名称" checked={settings.showNearbyStarLabels !== false}
                  onChange={value => set({ showNearbyStarLabels: value })} />
                <Slider label="邻近恒星名称密度" max={3} step={.1} value={settings.nearbyStarLabelDensity??1}
                  display={`${Math.round((settings.nearbyStarLabelDensity??1)*100)}%`} onChange={value=>set({nearbyStarLabelDensity:value})}/>

                <p className="settings-note">HYG v4.1 · J2000 · 非完整普查</p>
              </>}
            </Section>
            {settings.useHighPrecision && <Section title="天象搜索" theme="purple">
              {searchActive && <p className="settings-note">搜索进行中，停止搜索后可修改下列选项。</p>}
              <Toggle label="持续遍历" description="发现结果后继续寻找后续天象" disabled={searchActive} checked={settings.continuousIteration} onChange={value => set({ continuousIteration: value })} />
              <Toggle label="目标天体高亮" disabled={searchActive} checked={settings.showEventHighlights} onChange={value => set({ showEventHighlights: value })} />
              <Toggle label="计算式搜索" description="直接计算结果，不逐帧播放搜索过程" disabled={searchActive} checked={settings.allowCalculationSearch} onChange={value => set({ allowCalculationSearch: value })} />
            </Section>}

          </div>
          <div className="settings-column">
            <Section title="空间视角" theme="camera">
              <Toggle label="允许视角移动" checked={settings.showCameraControl} onChange={toggleCameraControl} />
              {settings.showCameraControl && <div className="settings-subgroup">
                <Slider label="投影方式" max={1} step={.05} value={perspectiveStrength(settings)} display={settings.enablePerspective ? `透视 ${Math.round(perspectiveStrength(settings)*100)}%` : '正交'}
                  onChange={value => set({ cameraPerspective: value, enablePerspective: value > 0 })} />
                <div className="settings-row settings-note"><span>正交</span><span>透视</span></div>
                <Slider label="视场角" min={30} max={100} step={1} value={cameraFov(settings)} display={`${cameraFov(settings)}°`}
                  onChange={value => set({ cameraFov: value })} />
                <Slider label="漫游速度" min={.1} max={3} step={.1} value={settings.cameraTravelSpeed ?? 1} display={`${(settings.cameraTravelSpeed ?? 1).toFixed(1)}×`}
                  onChange={value => set({ cameraTravelSpeed: value })} />
                {settings.enablePerspective && <Slider label="轨道远近对比" max={2} value={settings.orbitPerspectiveIntensity} onChange={value => set({ orbitPerspectiveIntensity: value })} />}
                <p className="settings-note">按 H 查看操作说明。</p>
              </div>}
            </Section>

            <CelestialSettings settings={settings} onSettingsChange={onSettingsChange} />
            <Section title="渲染压力" theme="green">
              <Segments label="整体画质" options={qualityOptions} value={settings.renderSettings.sceneQuality ?? 'standard'} onChange={value => updateRenderSetting('sceneQuality', value)} />
              <p className="settings-note">节能 30 帧，其余 60 帧；不影响天体计算精度。</p>
              <details className="settings-subgroup"><summary className="settings-note cursor-pointer">按类别保留微小天体</summary>
                <Segments label="行星与卫星" options={qualityOptions} value={settings.renderSettings.innerQuality} onChange={value => updateRenderSetting('innerQuality', value)} />
                <Segments label="矮行星" options={qualityOptions} value={settings.renderSettings.outerQuality} onChange={value => updateRenderSetting('outerQuality', value)} />
                <Segments label="彗星与小行星" options={qualityOptions} value={settings.renderSettings.cometQuality} onChange={value => updateRenderSetting('cometQuality', value)} />

              </details>
            </Section>
          </div>
        </div>
        <footer className="settings-footer"><div className="settings-footer-actions">
          {onRestoreDefaults && <button className="settings-button" onClick={() => handleAction(onRestoreDefaults, '已重置默认')}>重置默认</button>}
          {onSaveDefaults && <button className="settings-button primary" onClick={() => handleAction(onSaveDefaults, '已保存偏好')}>存为偏好</button>}
          {onClearDefaults && <button className="settings-button" onClick={() => handleAction(onClearDefaults, '已清除偏好')}>清除偏好</button>}
        </div><div role="status" className="settings-feedback">{feedback}</div></footer>
    </dialog>,document.body)}
    {showObjectManager && <ObjectManager settings={settings} onSettingsChange={onSettingsChange} bodies={allBodies} visibilityMap={visibilityMap} onToggleVisibility={onToggleVisibility} onClose={() => setShowObjectManager(false)} onDataReload={onDataReload} onJumpToEncounter={onJumpToEncounter} />}
  </>;
};
export default SettingsPanel;
