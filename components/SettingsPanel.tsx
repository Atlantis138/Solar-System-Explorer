
import React, { useState } from 'react';
import { AppSettings, BackgroundStyle, RenderQuality, CometRenderMode, PlanetData, StarLabelOption } from '../types';
import ObjectManager from './ObjectManager';

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
}

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
  onDataReload
}) => {
  
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showObjectManager, setShowObjectManager] = useState(false);

  const handleAction = (action: () => void, msg: string) => {
    action();
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2000);
  };

  const toggleScale = () => {
    const newValue = !settings.trueScale;
    const updates: Partial<AppSettings> = { trueScale: newValue };
    
    // Decoupling Logic
    if (!settings.renderSettings.allowTrueScaleAllBodies) {
        if (newValue) {
             updates.showDwarfPlanets = false;
             updates.showAsteroidsComets = false;
             updates.enableSpaceView = false;
        }
    } else {
        if (newValue) updates.enableSpaceView = false;
    }

    onSettingsChange({ ...settings, ...updates });
  };

  const toggleDwarfPlanets = () => {
    const newValue = !settings.showDwarfPlanets;
    const updates: Partial<AppSettings> = { showDwarfPlanets: newValue };
    if (!settings.renderSettings.allowTrueScaleAllBodies && newValue) updates.trueScale = false;
    onSettingsChange({ ...settings, ...updates });
  };

  const toggleAsteroidsComets = () => {
    const newValue = !settings.showAsteroidsComets;
    const updates: Partial<AppSettings> = { showAsteroidsComets: newValue };
    if (!settings.renderSettings.allowTrueScaleAllBodies && newValue) updates.trueScale = false;
    onSettingsChange({ ...settings, ...updates });
  };

  const toggleCameraControl = () => {
    const newValue = !settings.showCameraControl;
    onSettingsChange({ 
      ...settings, 
      showCameraControl: newValue,
      enableSpaceView: newValue ? settings.enableSpaceView : false,
      enablePerspective: newValue ? settings.enablePerspective : false
    });
  };

  const toggleSpaceView = () => {
    const newValue = !settings.enableSpaceView;
    onSettingsChange({ 
        ...settings, 
        enableSpaceView: newValue,
        trueScale: newValue ? false : settings.trueScale
    });
  }

  const handleOrbitOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, orbitOpacity: parseFloat(e.target.value) });
  }
  
  const handlePerspectiveIntensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, orbitPerspectiveIntensity: parseFloat(e.target.value) });
  }

  const handleStarBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, starBrightness: parseFloat(e.target.value) });
  };

  const handleStarDensityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, starDensity: parseInt(e.target.value) });
  };

  const handleGridOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, gridOpacity: parseFloat(e.target.value) });
  };

  const handleRealStarBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, realStarBrightnessMultiplier: parseFloat(e.target.value) });
  };

  const handleConstellationBrightnessChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSettingsChange({ ...settings, constellationBrightnessMultiplier: parseFloat(e.target.value) });
  };

  const setBackground = (style: BackgroundStyle) => onSettingsChange({ ...settings, background: style });

  const updateRenderSetting = (key: keyof AppSettings['renderSettings'], value: any) => {
      onSettingsChange({
          ...settings,
          renderSettings: { ...settings.renderSettings, [key]: value }
      });
  };

  const ToggleItem = ({ label, subLabel, checked, onChange, colorClass, disabled }: { label: string, subLabel: string, checked: boolean, onChange: () => void, colorClass: string, disabled?: boolean }) => (
    <div className={`flex items-center justify-between group py-2 ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`} onClick={!disabled ? onChange : undefined}>
        <div className="flex flex-col">
            <span className="text-gray-200 text-sm font-medium">{label}</span>
            <span className="text-gray-500 text-[10px]">{subLabel}</span>
        </div>
        <div className={`w-10 h-5 flex items-center rounded-full p-0.5 duration-300 ease-in-out ${checked ? colorClass : 'bg-gray-700'}`}>
            <div className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-300 ease-in-out ${checked ? 'translate-x-5' : ''}`} />
        </div>
    </div>
  );

  const SegmentControl = <T extends string>({ 
      label, options, value, onChange 
  }: { 
      label: string, options: {val: T, label: string}[], value: T, onChange: (v: T) => void 
  }) => (
      <div className="mb-3">
          <span className="text-xs text-gray-400 block mb-1.5">{label}</span>
          <div className="flex bg-gray-900/50 rounded p-1 border border-gray-700">
              {options.map((opt) => (
                  <button
                      key={opt.val}
                      onClick={() => onChange(opt.val)}
                      className={`flex-1 py-1 text-[10px] rounded transition-all ${value === opt.val ? 'bg-gray-600 text-white font-bold shadow' : 'text-gray-500 hover:text-gray-300'}`}
                  >
                      {opt.label}
                  </button>
              ))}
          </div>
      </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
        <div 
          className="bg-gray-900/95 border border-gray-700 rounded-2xl p-6 shadow-2xl transform transition-all max-h-[85vh] overflow-y-auto flex flex-col w-auto max-w-[95vw]"
          onClick={(e) => e.stopPropagation()} 
        >
          {/* Header */}
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-900/50 rounded-lg">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
              </div>
              <div>
                  <h2 className="text-xl font-bold text-white">系统设置</h2>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">System Settings</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-full text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-6 flex-1 overflow-y-auto custom-scrollbar pr-2">
            
            {/* --- Left Column --- */}
            <div className="flex flex-col gap-6 w-full md:w-[24rem]">
              
              {/* 1. Celestial Objects */}
              <div className="bg-gray-800/40 rounded-xl p-4 border border-orange-500/20">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-2">
                        <span className="w-1 h-4 bg-orange-500 rounded-full"></span> 天体对象 (Celestial Objects)
                    </h3>
                    <button 
                      onClick={() => setShowObjectManager(true)}
                      className="text-[10px] bg-orange-900/50 hover:bg-orange-800 text-orange-200 px-2 py-1 rounded border border-orange-500/30 transition-colors whitespace-nowrap"
                    >
                      Manage Object List
                    </button>
                  </div>
                  <div className="space-y-1">
                      <ToggleItem 
                          label="高精度天文引擎" subLabel="High Precision Astronomy Engine"
                          checked={settings.useHighPrecision} onChange={() => onSettingsChange({ ...settings, useHighPrecision: !settings.useHighPrecision })} colorClass="bg-orange-600"
                      />
                      <ToggleItem 
                          label="真实比例大小" subLabel="True-to-Scale Size"
                          checked={settings.trueScale} onChange={toggleScale} colorClass="bg-orange-600"
                      />
                      <ToggleItem 
                          label="显示小行星带" subLabel="Show Asteroid Belt"
                          checked={settings.showAsteroidBelt} onChange={() => onSettingsChange({ ...settings, showAsteroidBelt: !settings.showAsteroidBelt })} colorClass="bg-orange-600"
                      />
                      <ToggleItem 
                          label="显示海外天体与矮行星" subLabel="Show TNOs & Dwarf Planets"
                          checked={settings.showDwarfPlanets} onChange={toggleDwarfPlanets} colorClass="bg-orange-600"
                      />
                      <ToggleItem 
                          label="显示彗星与小行星" subLabel="Show Asteroids & Comets"
                          checked={settings.showAsteroidsComets} onChange={toggleAsteroidsComets} colorClass="bg-orange-600"
                      />
                      <ToggleItem 
                          label="显示边疆" subLabel="Show Frontiers (Kuiper/Heliopause)"
                          checked={settings.showRegionLabels} onChange={() => onSettingsChange({...settings, showRegionLabels: !settings.showRegionLabels})} colorClass="bg-orange-600"
                      />
                  </div>

                  {/* Orbit Visibility Slider (Moved Here) */}
                  <div className="mt-4 pt-3 border-t border-gray-700/50">
                      <div className="flex justify-between items-center mb-1">
                          <span className="text-gray-200 text-sm font-medium">轨道可见度 (Orbit Visibility)</span>
                          <span className="text-orange-400 text-xs font-mono">{(settings.orbitOpacity * 100).toFixed(0)}%</span>
                      </div>
                      <input 
                        type="range" min="0" max="1" step="0.05"
                        value={settings.orbitOpacity} onChange={handleOrbitOpacityChange}
                        className="w-full h-1.5 bg-gray-700 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                      />
                  </div>
              </div>

              {/* 2. Event Search */}
              <div className={`bg-gray-800/40 rounded-xl p-4 border border-purple-500/20 ${searchActive ? 'opacity-50 pointer-events-none' : ''}`}>
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-purple-500 rounded-full"></span> 天象搜索 (Event Search)
                  </h3>
                  <div className="space-y-1">
                      <ToggleItem 
                          label="持续遍历" subLabel="Continuous Iteration"
                          checked={settings.continuousIteration} onChange={() => !searchActive && onSettingsChange({ ...settings, continuousIteration: !settings.continuousIteration })} colorClass="bg-purple-600"
                      />
                      <ToggleItem 
                          label="目标天体高亮" subLabel="Highlight Targets"
                          checked={settings.showEventHighlights} onChange={() => !searchActive && onSettingsChange({ ...settings, showEventHighlights: !settings.showEventHighlights })} colorClass="bg-purple-600"
                      />
                      <ToggleItem 
                          label="允许计算式搜索" subLabel="Allow Calculation Search (Exp)"
                          checked={settings.allowCalculationSearch} onChange={() => !searchActive && onSettingsChange({ ...settings, allowCalculationSearch: !settings.allowCalculationSearch })} colorClass="bg-purple-600"
                      />
                  </div>
              </div>

              {/* 3. Render Pressure */}
              <div className="bg-gray-800/40 rounded-xl p-4 border border-green-600/30">
                  <h3 className="text-xs font-bold text-green-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-green-500 rounded-full"></span> 渲染压力 (Render Pressure)
                  </h3>
                  
                  <SegmentControl<RenderQuality>
                      label="内太阳系渲染 (Inner System: Mercury - Belt)"
                      value={settings.renderSettings.innerQuality}
                      onChange={(v) => updateRenderSetting('innerQuality', v)}
                      options={[
                          { val: 'eco', label: '节能 (Cutoff)' },
                          { val: 'standard', label: '通用 (Fade)' },
                          { val: 'performance', label: '性能 (Max)' }
                      ]}
                  />

                  <SegmentControl<RenderQuality>
                      label="海外天体渲染 (Outer System: Jupiter+)"
                      value={settings.renderSettings.outerQuality}
                      onChange={(v) => updateRenderSetting('outerQuality', v)}
                      options={[
                          { val: 'eco', label: '节能 (Cutoff)' },
                          { val: 'standard', label: '通用 (Fade)' },
                          { val: 'performance', label: '性能 (Max)' }
                      ]}
                  />
                  
                  <div className="pt-2 mt-2 border-t border-gray-700/50">
                      <ToggleItem 
                          label="允许真实比例显示所有天体" subLabel="Allow True Scale for TNOs/Comets"
                          checked={settings.renderSettings.allowTrueScaleAllBodies} 
                          onChange={() => updateRenderSetting('allowTrueScaleAllBodies', !settings.renderSettings.allowTrueScaleAllBodies)} 
                          colorClass="bg-green-600"
                      />
                  </div>
              </div>
            </div>

            {/* --- Right Column --- */}
            <div className="flex flex-col gap-6 w-full md:w-[24rem]">
              
              {/* 4. Spatial View (Renamed from Display & View) */}
              <div className="bg-gray-800/40 rounded-xl p-4 border border-blue-500/20">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-blue-500 rounded-full"></span> 空间视角 (Spatial View)
                  </h3>
                  <div className="space-y-4">
                      <ToggleItem 
                          label="允许视角移动" subLabel="Allow View Movement"
                          checked={settings.showCameraControl} onChange={toggleCameraControl} colorClass="bg-blue-600"
                      />
                      
                      {settings.showCameraControl && (
                          <div className="pl-3 border-l-2 border-gray-700/50 ml-1">
                              <ToggleItem 
                                  label="允许透视效果" subLabel="Allow Perspective Effect"
                                  checked={settings.enableSpaceView} onChange={toggleSpaceView} colorClass="bg-blue-400"
                              />
                              {/* Orbit Perspective Intensity Slider */}
                              {settings.enableSpaceView && (
                                  <div className="mt-3 mb-1 pl-2">
                                      <div className="flex justify-between items-center mb-1">
                                          <span className="text-gray-300 text-xs font-medium">轨道透视表现力</span>
                                          <span className="text-blue-300 text-[10px] font-mono">{settings.orbitPerspectiveIntensity.toFixed(1)}x</span>
                                      </div>
                                      <input 
                                          type="range" min="0" max="8" step="0.1"
                                          value={settings.orbitPerspectiveIntensity} onChange={handlePerspectiveIntensityChange}
                                          className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer focus:outline-none"
                                      />
                                  </div>
                              )}
                          </div>
                      )}
                  </div>
              </div>

              {/* 5. Celestial Sphere (New Category) */}
              <div className="bg-gray-800/40 rounded-xl p-4 border border-indigo-500/20">
                  <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <span className="w-1 h-4 bg-indigo-500 rounded-full"></span> 天球 (Celestial Sphere)
                  </h3>

                  <div className="space-y-4">
                      {/* Background Settings */}
                      <div>
                          <span className="text-gray-200 text-sm font-medium block mb-2">背景风格 (Background Style)</span>
                          <div className="grid grid-cols-2 gap-2 mb-3">
                            {['default', 'milkyway'].map((style) => (
                              <button 
                                  key={style}
                                  onClick={() => setBackground(style as any)}
                                  className={`h-10 rounded border transition-all relative overflow-hidden flex items-center justify-center ${settings.background === style ? 'border-indigo-500 ring-1 ring-indigo-500/50 bg-indigo-900/30' : 'border-gray-600 hover:border-gray-400 bg-gray-800/50'}`}
                              >
                                  <span className="text-xs font-medium text-gray-300 z-10 relative">
                                      {style === 'default' ? '随机星空 (Standard)' : '虚拟银河 (Milky Way)'}
                                  </span>
                              </button>
                            ))}
                          </div>

                           {/* Star Density & Brightness (Procedural) */}
                          <div className="space-y-3 pl-1">
                              <div>
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-gray-300 text-xs font-medium">星空密度 (Procedural Count)</span>
                                      <span className="text-gray-400 text-[10px] font-mono">{settings.starDensity}</span>
                                  </div>
                                  <input 
                                    type="range" min="500" max="5000" step="100"
                                    value={settings.starDensity} onChange={handleStarDensityChange}
                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"
                                  />
                              </div>
                              <div>
                                  <div className="flex justify-between items-center mb-1">
                                      <span className="text-gray-300 text-xs font-medium">星空亮度 (Background Dimmer)</span>
                                      <span className="text-gray-400 text-[10px] font-mono">{(settings.starBrightness * 100).toFixed(0)}%</span>
                                  </div>
                                  <input 
                                    type="range" min="0" max="1.0" step="0.05"
                                    value={settings.starBrightness} onChange={handleStarBrightnessChange}
                                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer focus:outline-none"
                                  />
                              </div>
                          </div>
                      </div>

                      {/* Separator */}
                      <div className="my-2 border-t border-gray-700/50"></div>

                      {/* Real Stars & Constellations */}
                      <div>
                           <ToggleItem 
                              label="显示真实恒星" subLabel="Show Real Bright Stars (88+)"
                              checked={settings.useRealStars} onChange={() => onSettingsChange({ ...settings, useRealStars: !settings.useRealStars })} 
                              colorClass="bg-indigo-500"
                           />
                           
                           {settings.useRealStars && (
                             <div className="pl-3 border-l-2 border-gray-700/50 ml-1 mt-2 space-y-4 animate-fade-in">
                                  {/* Real Star Brightness */}
                                  <div>
                                      <div className="flex justify-between items-center mb-1">
                                          <span className="text-gray-300 text-xs font-medium">真实恒星亮度 (Real Star Brightness)</span>
                                          <span className="text-indigo-300 text-[10px] font-mono">{settings.realStarBrightnessMultiplier.toFixed(1)}x</span>
                                      </div>
                                      <input 
                                          type="range" min="0.5" max="3.0" step="0.1"
                                          value={settings.realStarBrightnessMultiplier} onChange={handleRealStarBrightnessChange}
                                          className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer focus:outline-none"
                                      />
                                  </div>

                                  {/* Label Mode */}
                                  <SegmentControl<StarLabelOption>
                                      label="恒星标签 (Star Labels)"
                                      value={settings.realStarLabels}
                                      onChange={(v) => onSettingsChange({ ...settings, realStarLabels: v })}
                                      options={[
                                          { val: 'none', label: '无 (None)' },
                                          { val: 'cn', label: '中文' },
                                          { val: 'bilingual', label: 'CN/EN' }
                                      ]}
                                  />

                                  {/* Constellations Toggle */}
                                  <ToggleItem 
                                      label="显示星座连线" subLabel="Show Constellations"
                                      checked={settings.showConstellations} 
                                      onChange={() => onSettingsChange({ ...settings, showConstellations: !settings.showConstellations })} 
                                      colorClass="bg-indigo-400"
                                  />

                                  {/* Constellation Brightness */}
                                  {settings.showConstellations && (
                                    <div className="pl-2 animate-fade-in">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-gray-300 text-xs font-medium">连线亮度 (Line Brightness)</span>
                                            <span className="text-indigo-300 text-[10px] font-mono">{settings.constellationBrightnessMultiplier.toFixed(1)}x</span>
                                        </div>
                                        <input 
                                            type="range" min="0.5" max="3.0" step="0.1"
                                            value={settings.constellationBrightnessMultiplier} onChange={handleConstellationBrightnessChange}
                                            className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer focus:outline-none"
                                        />
                                    </div>
                                  )}
                             </div>
                           )}
                      </div>

                      {/* Separator */}
                      <div className="my-2 border-t border-gray-700/50"></div>

                      {/* Grids */}
                      <div>
                          <span className="text-gray-200 text-sm font-medium block mb-2">坐标网格 (Coordinate Grids)</span>
                          <div className="space-y-1">
                              <ToggleItem 
                                  label="显示黄道网格 (Ecliptic)" subLabel="Solar System Plane"
                                  checked={settings.showEclipticGrid} 
                                  onChange={() => onSettingsChange({ ...settings, showEclipticGrid: !settings.showEclipticGrid })} 
                                  colorClass="bg-indigo-500"
                              />
                              <ToggleItem 
                                  label="显示赤道网格 (Equatorial)" subLabel="Earth's Equator Projection"
                                  checked={settings.showEquatorialGrid} 
                                  onChange={() => onSettingsChange({ ...settings, showEquatorialGrid: !settings.showEquatorialGrid })} 
                                  colorClass="bg-indigo-500"
                              />
                              {(settings.showEclipticGrid || settings.showEquatorialGrid) && (
                                  <div className="mt-3 pl-3 border-l-2 border-gray-700/50 animate-fade-in">
                                      <div className="mb-3">
                                          <div className="flex justify-between items-center mb-1">
                                              <span className="text-gray-300 text-xs font-medium">网格不透明度</span>
                                              <span className="text-indigo-300 text-[10px] font-mono">{(settings.gridOpacity * 100).toFixed(0)}%</span>
                                          </div>
                                          <input 
                                              type="range" min="0.1" max="1.0" step="0.1"
                                              value={settings.gridOpacity} onChange={handleGridOpacityChange}
                                              className="w-full h-1 bg-gray-600 rounded appearance-none cursor-pointer focus:outline-none"
                                          />
                                      </div>
                                      <ToggleItem 
                                          label="子午线汇聚于极点" subLabel="Converge Meridians at Poles"
                                          checked={settings.convergeMeridians} 
                                          onChange={() => onSettingsChange({ ...settings, convergeMeridians: !settings.convergeMeridians })} 
                                          colorClass="bg-gray-500"
                                      />
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>
              </div>

            </div>
          </div>
          
          {/* --- Footer: Defaults Management --- */}
          <div className="mt-6 pt-4 border-t border-gray-700/50 flex flex-col items-center gap-3 shrink-0">
              <div className="flex gap-4 w-full justify-center">
                  {onRestoreDefaults && (
                      <button 
                          onClick={() => handleAction(onRestoreDefaults, "已重置默认 / Reset")}
                          className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-bold rounded-lg transition-all active:scale-95 border border-gray-600 shadow-sm"
                      >
                          重置默认
                      </button>
                  )}
                  {onSaveDefaults && (
                      <button 
                          onClick={() => handleAction(onSaveDefaults, "已保存偏好 / Saved")}
                          className="px-6 py-2 bg-blue-700 hover:bg-blue-600 text-white text-xs font-bold rounded-lg transition-all active:scale-95 shadow-lg"
                      >
                          存为偏好
                      </button>
                  )}
                  {onClearDefaults && (
                      <button 
                          onClick={() => handleAction(onClearDefaults, "已清除偏好 / Cleared")}
                          className="px-6 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 text-xs font-bold rounded-lg transition-all active:scale-95 border border-red-800/30"
                      >
                          清除偏好
                      </button>
                  )}
              </div>
              <div className={`text-xs text-green-400 font-mono h-4 transition-opacity duration-300 ${feedback ? 'opacity-100' : 'opacity-0'}`}>
                  {feedback || '...'}
              </div>
          </div>

        </div>
      </div>

      {/* Object Manager Overlay */}
      {showObjectManager && (
        <ObjectManager
          bodies={allBodies}
          visibilityMap={visibilityMap}
          onToggleVisibility={onToggleVisibility}
          onClose={() => setShowObjectManager(false)}
          onDataReload={onDataReload}
        />
      )}
    </>
  );
};

export default SettingsPanel;
