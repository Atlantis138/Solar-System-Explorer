

import React, { useState, useMemo } from 'react';
import { PlanetData } from '../types';

interface ObjectManagerProps {
  bodies: PlanetData[];
  visibilityMap: Record<string, boolean>;
  onToggleVisibility: (id: string) => void;
  onClose: () => void;
  onDataReload: () => void;
}

const CATEGORY_TEMPLATES: Record<string, string> = {
  PLANET: `[PLANET]
id: my_planet
name: My Planet
englishName: Custom Planet
color: #00ff00
radius: 5
relativeRadius: 1.0
elements: 1.52 0.09 1.85 49.5 286.5 19.4
# elements: a e i N w M`,
  DWARF: `[DWARF]
id: my_dwarf
name: My Dwarf
englishName: Custom Dwarf
type: dwarf
color: #cccccc
radius: 3
relativeRadius: 0.2
elements: 39.4 0.24 17.1 110.3 113.7 14.8`,
  COMET: `[COMET]
id: my_small_body
name: My Small Body
englishName: Custom Asteroid/Comet
type: comet
color: #888888
radius: 2
relativeRadius: 0.05
elements: 2.7 0.07 10.5 80.3 73.5 6.7
# elements: a e i N w M`,
  SATELLITE: `[SATELLITE]
parent: earth
id: my_moon
name: My Moon
englishName: Custom Moon
color: #aaaaaa
radius: 1.5
relativeRadius: 0.1
elements: 0.0025 0.05 5.1 125.0 318.0 115.0`,
  RING: `[RING]
parent: saturn
id: my_ring
name: My Ring
color: #ccaa88
opacity: 0.5
tilt: 26.7
dimensions: 0.0005 0.0009`
};

interface ConfirmState {
  isOpen: boolean;
  type: 'SAVE' | 'DELETE_ONE' | 'CLEAR_ALL' | null;
  targetBody?: PlanetData;
  message: string;
  subMessage?: string;
}

// Helper to split text into blocks similar to DataLoader
const splitTextIntoBlocks = (text: string): string[] => {
    const lines = text.split('\n');
    const blocks: string[] = [];
    let currentBlockStr = '';

    for (const line of lines) {
        const trim = line.trim();
        if (trim.startsWith('[') && trim.endsWith(']')) {
            if (currentBlockStr) blocks.push(currentBlockStr);
            currentBlockStr = line + '\n';
        } else {
            currentBlockStr += line + '\n';
        }
    }
    if (currentBlockStr) blocks.push(currentBlockStr);
    return blocks;
};

const ObjectManager: React.FC<ObjectManagerProps> = ({ bodies, visibilityMap, onToggleVisibility, onClose, onDataReload }) => {
  const [showIds, setShowIds] = useState(false);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorCategory, setEditorCategory] = useState('PLANET');
  const [editorContent, setEditorContent] = useState(CATEGORY_TEMPLATES['PLANET']);
  
  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<ConfirmState>({ 
    isOpen: false, type: null, message: '' 
  });

  const groupedBodies = useMemo(() => {
    const groups: Record<string, PlanetData[]> = {};
    bodies.forEach(body => {
      const cat = body.category || 'UNCATEGORIZED';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(body);
    });
    return groups;
  }, [bodies]);

  const handleTemplateChange = (cat: string) => {
    setEditorCategory(cat);
    setEditorContent(CATEGORY_TEMPLATES[cat]);
  };

  // --- Action Triggers (Open Modal) ---

  const handleSaveClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editorContent || !editorContent.trim()) {
       alert("请输入有效的天体配置文本 (Please enter valid object configuration).");
       return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'SAVE',
      message: '确认保存该自定义天体？',
      subMessage: '此操作将修改您的本地存储数据。(Confirm Save)'
    });
  };

  const handleDeleteClick = (body: PlanetData) => {
    setConfirmModal({
      isOpen: true,
      type: 'DELETE_ONE',
      targetBody: body,
      message: `确认删除 '${body.name}'？`,
      subMessage: '此操作无法撤销。(Cannot be undone)'
    });
  };

  const handleClearAllClick = () => {
    setConfirmModal({
      isOpen: true,
      type: 'CLEAR_ALL',
      message: '清空所有自定义天体？',
      subMessage: '这将清除所有用户创建的数据，确定吗？(Delete ALL custom objects?)'
    });
  };

  const closeConfirm = () => {
    setConfirmModal({ isOpen: false, type: null, message: '' });
  };

  // --- Action Executors (Actual Logic) ---

  const executeAction = () => {
    const { type, targetBody } = confirmModal;

    try {
      if (type === 'SAVE') {
          const existing = localStorage.getItem('custom_bodies_text') || '';
          const newData = existing ? `${existing}\n\n${editorContent}` : editorContent;
          localStorage.setItem('custom_bodies_text', newData);
          setIsEditorOpen(false); // Close editor on success
      } 
      else if (type === 'DELETE_ONE' && targetBody) {
          const text = localStorage.getItem('custom_bodies_text') || '';
          
          if (targetBody.rawContent) {
              // Method 1: Robust Block Matching via rawContent
              const blocks = splitTextIntoBlocks(text);
              const targetContentTrimmed = targetBody.rawContent.trim();
              
              // Filter out the block that matches the raw content
              const newBlocks = blocks.filter(b => b.trim() !== targetContentTrimmed);
              
              // Check if we actually removed something
              if (newBlocks.length < blocks.length) {
                  const resultText = newBlocks.join('').trim();
                  if (resultText) {
                      localStorage.setItem('custom_bodies_text', resultText);
                  } else {
                      localStorage.removeItem('custom_bodies_text');
                  }
              } else {
                  // Fallback: Should rarely happen if rawContent is preserved correctly
                  console.warn("Could not find exact raw content match. Trying ID fallback.");
                  fallbackDeleteById(text, targetBody.id);
              }
          } else {
              // Fallback: ID based deletion (legacy)
              fallbackDeleteById(text, targetBody.id);
          }
      } 
      else if (type === 'CLEAR_ALL') {
          localStorage.removeItem('custom_bodies_text');
      }

      // Refresh App Data
      onDataReload();
      closeConfirm();

    } catch (e: any) {
      console.error("Operation failed:", e);
      alert(`Error: ${e.message || e}`);
      closeConfirm();
    }
  };

  const fallbackDeleteById = (text: string, targetId: string) => {
      const lines = text.split('\n');
      let newLines: string[] = [];
      let currentBlockLines: string[] = [];
      let inBlock = false;
      let blockMatchesTarget = false;

      for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const trim = line.trim();
          
          if (trim.startsWith('[') && trim.endsWith(']')) {
              if (inBlock) {
                  if (!blockMatchesTarget) {
                      newLines = newLines.concat(currentBlockLines);
                  }
              }
              inBlock = true;
              blockMatchesTarget = false;
              currentBlockLines = [line];
          } else {
              if (inBlock) {
                  currentBlockLines.push(line);
                  if (trim.startsWith('id:')) {
                      const idVal = trim.split(':')[1].trim();
                      if (idVal === targetId) blockMatchesTarget = true;
                  }
              } else {
                  newLines.push(line);
              }
          }
      }
      if (inBlock && !blockMatchesTarget) {
          newLines = newLines.concat(currentBlockLines);
      }

      const resultText = newLines.join('\n').trim();
      if (resultText) {
          localStorage.setItem('custom_bodies_text', resultText);
      } else {
          localStorage.removeItem('custom_bodies_text');
      }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      
      {/* --- Custom Confirmation Modal Overlay --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={(e) => e.stopPropagation()}>
           <div className="bg-gray-800 border border-gray-600 rounded-xl p-6 w-96 shadow-2xl transform scale-100 transition-all">
              <h3 className="text-xl font-bold text-white mb-2">{confirmModal.message}</h3>
              {confirmModal.subMessage && <p className="text-gray-400 text-sm mb-6">{confirmModal.subMessage}</p>}
              
              <div className="flex gap-3 justify-end">
                 <button 
                    onClick={closeConfirm}
                    className="px-4 py-2 rounded text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                 >
                    取消 (Cancel)
                 </button>
                 <button 
                    onClick={executeAction}
                    className={`px-6 py-2 rounded text-sm font-bold text-white shadow-lg transition-transform active:scale-95 ${confirmModal.type === 'SAVE' ? 'bg-blue-600 hover:bg-blue-500' : 'bg-red-600 hover:bg-red-500'}`}
                 >
                    确定 (Confirm)
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Main Modal Container */}
      <div className="bg-gray-900/90 backdrop-blur-xl border border-gray-700/50 rounded-xl w-[95%] md:w-[90%] max-w-6xl mx-auto h-[85vh] flex flex-col shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700/50 bg-gray-800/50 shrink-0">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            天体列表 (Object List)
          </h2>
          <div className="flex items-center gap-4">
            <label className="hidden md:flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
              <input type="checkbox" checked={showIds} onChange={() => setShowIds(!showIds)} className="rounded bg-gray-700 border-gray-600" />
              显示ID
            </label>
            
            <button 
              onClick={() => setIsEditorOpen(!isEditorOpen)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border transition-all ${isEditorOpen ? 'bg-green-900/50 border-green-500 text-green-300' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              {isEditorOpen ? '关闭添加' : '添加天体'}
            </button>

            <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white transition-colors">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>

        {/* Main Content Area (Split View) */}
        <div className="flex flex-1 overflow-hidden flex-col md:flex-row relative">
          
          {/* Left: Object List */}
          <div className={`flex-1 flex flex-col border-r border-gray-700/50 bg-transparent transition-all duration-300 min-h-0 ${isEditorOpen ? 'md:max-w-[60%]' : 'md:max-w-full'} ${isEditorOpen ? 'hidden md:flex' : 'flex'}`}>
             <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
                {Object.entries(groupedBodies).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-700 pb-1 mb-2 sticky top-0 bg-gray-900/90 z-10">
                      [{category}]
                    </h3>
                    
                    {/* RESPONSIVE GRID LAYOUT (Compact) */}
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-2">
                      {items.map(body => {
                        const isVisible = visibilityMap[body.id] !== false;
                        return (
                          <div key={body.id} className={`flex items-center justify-between p-2 rounded border ${!body.isValid ? 'bg-red-900/20 border-red-800' : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/50'} transition-colors`}>
                            
                            <div className="flex items-center gap-2 overflow-hidden min-w-0">
                              <input 
                                type="checkbox" 
                                checked={isVisible} 
                                onChange={() => onToggleVisibility(body.id)} 
                                disabled={!body.isValid}
                                className="w-3.5 h-3.5 shrink-0 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 cursor-pointer"
                              />
                              
                              <div className="flex flex-col min-w-0">
                                <span className={`text-xs font-medium truncate ${!body.isValid ? 'text-red-400' : 'text-gray-200'}`}>
                                  {showIds ? body.id : body.name}
                                </span>
                                {!body.isValid && <span className="text-[10px] text-red-500 truncate">{body.parseError}</span>}
                              </div>

                              {body.isCustom && (
                                <span className="px-1 py-0.5 bg-purple-900/50 border border-purple-500/30 text-purple-300 text-[9px] rounded uppercase tracking-wide shrink-0">
                                  User
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              {/* Delete Button for Custom Objects */}
                              {body.isCustom && (
                                 <button onClick={() => handleDeleteClick(body)} className="text-red-500/50 hover:text-red-500 p-1 hover:bg-red-900/20 rounded transition-colors" title="删除天体 (Delete)">
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                 </button>
                              )}

                              <div className="relative group">
                                <svg className="w-4 h-4 text-gray-600 hover:text-blue-400 cursor-help transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {/* Tooltip for Raw Config */}
                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-black/90 border border-gray-600 p-2 rounded shadow-xl z-50 hidden group-hover:block pointer-events-none">
                                  <p className="text-[9px] text-gray-500 mb-1 uppercase font-bold">Config Data</p>
                                  <pre className="text-[9px] text-gray-300 whitespace-pre-wrap font-mono max-h-32 overflow-y-auto">{body.rawContent || "No raw content available."}</pre>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
             </div>
             <div className="p-3 border-t border-gray-700/50 bg-gray-800/30 text-center shrink-0">
                <button onClick={handleClearAllClick} className="text-xs text-red-400 hover:text-red-300 underline">清空所有手动添加 (Clear All)</button>
             </div>
          </div>

          {/* Right: Editor Panel */}
          {isEditorOpen && (
            <div className="flex-1 md:flex-none md:w-[40%] flex flex-col bg-gray-800/80 border-l border-gray-700/50 animate-fade-in min-h-0 absolute md:relative inset-0 z-20">
              <div className="p-4 border-b border-gray-700/50 bg-gray-900/30 shrink-0">
                 <h3 className="text-sm font-bold text-white mb-3">添加自定义天体</h3>
                 
                 {/* Template Selector */}
                 <div className="flex gap-2 mb-4 overflow-x-auto pb-1 custom-scrollbar">
                    {Object.keys(CATEGORY_TEMPLATES).map(cat => (
                        <button 
                           key={cat} 
                           onClick={() => handleTemplateChange(cat)}
                           className={`px-3 py-1 text-xs rounded border transition-colors whitespace-nowrap ${editorCategory === cat ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-700 border-gray-600 text-gray-300 hover:bg-gray-600'}`}
                        >
                           {cat}
                        </button>
                    ))}
                 </div>
                 
                 <p className="text-xs text-gray-400">
                    请使用标准格式输入数据。ID必须唯一。
                 </p>
              </div>

              <div className="flex-1 p-4 bg-gray-900/50 min-h-0 flex flex-col overflow-hidden">
                 <textarea 
                    className="w-full h-full bg-black/50 border border-gray-700 rounded-lg p-3 text-xs font-mono text-green-400 focus:border-blue-500 outline-none resize-none"
                    value={editorContent}
                    onChange={(e) => setEditorContent(e.target.value)}
                    spellCheck={false}
                    placeholder="在此粘贴配置..."
                 />
              </div>

              <div className="p-4 border-t border-gray-700/50 bg-gray-800/50 flex justify-end gap-3 shrink-0">
                  <button onClick={() => setIsEditorOpen(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">取消</button>
                  <button 
                    type="button"
                    onClick={handleSaveClick} 
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded shadow-lg transition-transform active:scale-95"
                  >
                    保存天体
                  </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ObjectManager;