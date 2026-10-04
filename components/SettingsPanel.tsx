

import React, { useState } from 'react';
import { AppSettings, RenderQuality } from '../types';
import ObjectManager from './ObjectManager';
import CelestialSettings from './CelestialSettings';
import { Section, Toggle, Slider, Segments } from './settings/SettingsControls';
import { SMALL_BODY_POPULATIONS, populationVisible, setPopulationVisible } from '../data/populations';
import { setCameraMovement } from '../core/cameraSettings';

interface SettingsPanelProps {
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
  settings, 
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
  const [showObjectManager, setShowObjectManager] = useState(false);

  const handleAction = (action: () => void, msg: string) => {
    action();
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const toggleCameraControl = () => onSettingsChange(setCameraMovement(settings, !settings.showCameraControl));
  const toggleSpaceView = () => onSettingsChange({ ...settings, enablePerspective: !settings.enablePerspective });

  const set = (patch: Partial<AppSettings>) => onSettingsChange({ ...settings, ...patch });
  const updateRenderSetting = <K extends keyof AppSettings['renderSettings'],>(key: K, value: AppSettings['renderSettings'][K]) =>
    set({ renderSettings: { ...settings.renderSettings, [key]: value } });
  const qualityOptions: { value: RenderQuality; label: string }[] = [
    { value: 'eco', label: '节能' }, { value: 'standard', label: '平衡' }, { value: 'performance', label: '完整' },
  ];
  return <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="settings-dialog" role="dialog" aria-modal="true" aria-label="系统设置" onClick={e => e.stopPropagation()}>
        <header className="settings-header"><div><h2>系统设置</h2><p>调整天体、视角与星空的呈现</p></div>
          <button type="button" className="settings-close" aria-label="关闭设置" onClick={onClose}>×</button>
        </header>
        <div className="settings-content">
          <div className="settings-column">
            <Section title="天体对象" theme="orange" action={<button className="settings-button" onClick={() => setShowObjectManager(true)}>管理天体</button>}>
              <Toggle label="高精度天文引擎" description="启用精确位置计算与天象搜索" checked={settings.useHighPrecision} onChange={value => set({ useHighPrecision: value })} />
              <Toggle label="真实比例大小" checked={settings.trueScale} onChange={value => set({ trueScale: value })} />
              <Toggle label="显示海王星外天体与矮行星" checked={settings.showDwarfPlanets} onChange={value => set({ showDwarfPlanets: value })} />
              <Toggle label="显示彗星与小行星" checked={settings.showAsteroidsComets} onChange={value => set({ showAsteroidsComets: value })} />
              {settings.showAsteroidsComets && <div className="settings-subgroup" role="group" aria-label="彗星与小行星详细设置">
                <Toggle label="太阳系彗星" checked={settings.showComets !== false} onChange={value => set({showComets:value})} />
                <Toggle label="太阳系小行星" checked={settings.showAsteroids !== false} onChange={value => set({showAsteroids:value})} />
                <Toggle label="星际天体" checked={settings.showInterstellar !== false} onChange={value => set({showInterstellar:value})} />
                <Toggle label="显示彗尾" checked={settings.showCometTails !== false} onChange={value => set({showCometTails:value})} />
                <Toggle label="小行星带与小天体族群" checked={settings.showSmallBodyPopulations !== false} onChange={value => set({showSmallBodyPopulations:value})} />
                {settings.showSmallBodyPopulations !== false && <details className="settings-subgroup">
                  <summary className="settings-note cursor-pointer">选择族群</summary>
                  {SMALL_BODY_POPULATIONS.map(population => <Toggle key={population.id} label={population.name}
                    checked={populationVisible(population,settings)}
                    onChange={value => onSettingsChange(setPopulationVisible(settings,population.id,value))} />)}
                </details>}
              </div>}
              <Toggle label="显示太阳系边界" description="柯伊伯带与日球层顶" checked={settings.showRegionLabels} onChange={value => set({ showRegionLabels: value })} />
              <div className="settings-divider"><Slider label="轨道可见度" max={1} value={settings.orbitOpacity} onChange={value => set({ orbitOpacity: value })} /></div>
            </Section>
            {settings.useHighPrecision && <Section title="天象搜索" theme="purple">
              {searchActive && <p className="settings-note">搜索进行中，停止搜索后可修改下列选项。</p>}
              <Toggle label="持续遍历" description="发现结果后继续寻找后续天象" disabled={searchActive} checked={settings.continuousIteration} onChange={value => set({ continuousIteration: value })} />
              <Toggle label="目标天体高亮" disabled={searchActive} checked={settings.showEventHighlights} onChange={value => set({ showEventHighlights: value })} />
              <Toggle label="计算式搜索" description="直接计算结果，不逐帧播放搜索过程" disabled={searchActive} checked={settings.allowCalculationSearch} onChange={value => set({ allowCalculationSearch: value })} />
            </Section>}
            <Section title="渲染压力" theme="green">
              <Segments label="整体画质" options={qualityOptions} value={settings.renderSettings.sceneQuality ?? 'standard'} onChange={value => updateRenderSetting('sceneQuality', value)} />
              <p className="settings-note">节能降低画面分辨率与粒子数量，播放最高 30 帧；平衡、完整最高 60 帧。拖动视角始终同步响应，天体运行精度不受影响。</p>
              <details className="settings-subgroup"><summary className="settings-note cursor-pointer">按类别保留微小天体</summary>
                <Segments label="行星与卫星" options={qualityOptions} value={settings.renderSettings.innerQuality} onChange={value => updateRenderSetting('innerQuality', value)} />
                <Segments label="矮行星" options={qualityOptions} value={settings.renderSettings.outerQuality} onChange={value => updateRenderSetting('outerQuality', value)} />
                <Segments label="彗星与小行星" options={qualityOptions} value={settings.renderSettings.cometQuality} onChange={value => updateRenderSetting('cometQuality', value)} />
                <p className="settings-note">节能较早隐藏微小天体；完整保留视野内的微小天体。两种比例分别校准，选中、固定或跟随的目标优先显示名称；名称固定跟随天体，不进行避让。</p>
              </details>
            </Section>
          </div>
          <div className="settings-column">
            <Section title="空间视角" theme="blue">
              <Toggle label="允许视角移动" checked={settings.showCameraControl} onChange={toggleCameraControl} />
              {settings.showCameraControl && <div className="settings-subgroup">
                <Toggle label="透视投影" description="关闭可切换为正交视图" checked={settings.enablePerspective} onChange={toggleSpaceView} />
                {settings.enablePerspective && <Slider label="轨道远近对比" max={2} value={settings.orbitPerspectiveIntensity} onChange={value => set({ orbitPerspectiveIntensity: value })} />}
              </div>}
            </Section>
            <CelestialSettings settings={settings} onSettingsChange={onSettingsChange} />
          </div>
        </div>
        <footer className="settings-footer"><div className="settings-footer-actions">
          {onRestoreDefaults && <button className="settings-button" onClick={() => handleAction(onRestoreDefaults, '已重置默认')}>重置默认</button>}
          {onSaveDefaults && <button className="settings-button primary" onClick={() => handleAction(onSaveDefaults, '已保存偏好')}>存为偏好</button>}
          {onClearDefaults && <button className="settings-button" onClick={() => handleAction(onClearDefaults, '已清除偏好')}>清除偏好</button>}
        </div><div role="status" className="settings-feedback">{feedback}</div></footer>
      </div>
    </div>
    {showObjectManager && <ObjectManager settings={settings} onSettingsChange={onSettingsChange} bodies={allBodies} visibilityMap={visibilityMap} onToggleVisibility={onToggleVisibility} onClose={() => setShowObjectManager(false)} onDataReload={onDataReload} onJumpToEncounter={onJumpToEncounter} />}
  </>;
};
export default SettingsPanel;
