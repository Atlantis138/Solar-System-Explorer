
import React, { useRef, useState, useEffect, useCallback } from 'react';

interface VirtualJoystickProps {
  onUpdate: (dYaw: number, dTilt: number) => void;
  onReset: () => void;
  show3DToggle?: boolean;
  is3DEnabled?: boolean;
  onToggle3D?: () => void;
  isProximityEnabled?: boolean;
  onToggleProximity?: () => void;
  isSidebarOpen?: boolean; // Deprecated but kept for interface compatibility
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ 
  onUpdate, 
  onReset, 
  show3DToggle = false,
  is3DEnabled = false,
  onToggle3D,
  isProximityEnabled = false,
  onToggleProximity,
}) => {
  const [active, setActive] = useState(false);
  const [knobPos, setKnobPos] = useState({ x: 0, y: 0 });
  
  const containerRef = useRef<HTMLDivElement>(null);
  const startPosRef = useRef({ x: 0, y: 0 });
  const lastPosRef = useRef({ x: 0, y: 0 });
  
  const MAX_RADIUS = 40; // px
  const SENSITIVITY = 0.5; // deg per px

  // Pointer Down: Start Tracking
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    startPosRef.current = { x: e.clientX, y: e.clientY };
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    setActive(true);
  };

  const handleGlobalMove = useCallback((e: PointerEvent) => {
    if (!active) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;

    // 1. Calculate Delta for Output (Yaw/Tilt Change)
    const dx = currentX - lastPosRef.current.x;
    const dy = currentY - lastPosRef.current.y;
    
    onUpdate(dx * SENSITIVITY, dy * SENSITIVITY);
    
    lastPosRef.current = { x: currentX, y: currentY };

    // 2. Calculate Knob Visual Position (Relative to Start)
    let vecX = currentX - startPosRef.current.x;
    let vecY = currentY - startPosRef.current.y;
    
    // Clamp magnitude
    const dist = Math.sqrt(vecX * vecX + vecY * vecY);
    if (dist > MAX_RADIUS) {
        const scale = MAX_RADIUS / dist;
        vecX *= scale;
        vecY *= scale;
    }

    setKnobPos({ x: vecX, y: vecY });
  }, [active, onUpdate]);

  const handleGlobalUp = useCallback(() => {
    if (!active) return;
    setActive(false);
    setKnobPos({ x: 0, y: 0 });
  }, [active]);

  // Attach global listeners when active
  useEffect(() => {
    if (active) {
      window.addEventListener('pointermove', handleGlobalMove);
      window.addEventListener('pointerup', handleGlobalUp);
      window.addEventListener('pointercancel', handleGlobalUp);
    } else {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    }
    return () => {
      window.removeEventListener('pointermove', handleGlobalMove);
      window.removeEventListener('pointerup', handleGlobalUp);
      window.removeEventListener('pointercancel', handleGlobalUp);
    };
  }, [active, handleGlobalMove, handleGlobalUp]);

  return (
    <div 
      className="fixed bottom-32 right-16 z-30 flex flex-col items-center gap-3 pointer-events-auto transition-opacity duration-300 ease-in-out"
    >
      
      <div className="flex items-center gap-2">
        
        {/* Proximity Sim / Immersive Toggle */}
        {show3DToggle && is3DEnabled && onToggleProximity && (
           <button
              onClick={onToggleProximity}
              className={`p-2 rounded-full border backdrop-blur-md transition-all shadow-lg relative group ${isProximityEnabled ? 'bg-green-600/80 border-green-400 text-white' : 'bg-gray-800/60 border-white/20 text-white/70 hover:text-white hover:bg-green-600/60'}`}
              title="Toggle Proximity Simulation (Fly-through)"
           >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 12h4m-2-2v4" /> {/* Plus sign eye roughly? Or just simple circle */}
                 <circle cx="12" cy="12" r="9" strokeWidth="2" />
              </svg>
              {/* Tooltip */}
              <div className="absolute bottom-full right-0 mb-2 w-32 p-2 bg-gray-900 text-[10px] text-white rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-gray-700">
                  Simulates physical camera. Zoom to fly through.
              </div>
           </button>
        )}

        {/* 3D Perspective Toggle */}
        {show3DToggle && onToggle3D && (
          <button 
            onClick={onToggle3D}
            className={`p-2 rounded-full border backdrop-blur-md transition-all shadow-lg ${is3DEnabled ? 'bg-blue-600/80 border-blue-400 text-white' : 'bg-gray-800/60 border-white/20 text-white/70 hover:text-white hover:bg-blue-600/60'}`}
            title="Toggle 3D Perspective"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </button>
        )}

        {/* Reset Button */}
        <button 
          onClick={onReset}
          className="bg-gray-800/60 backdrop-blur-md p-2 rounded-full border border-white/20 text-white/70 hover:text-white hover:bg-blue-600/80 hover:border-white/50 transition-all shadow-lg"
          title="Reset View (Top Down)"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </button>
      </div>

      {/* Joystick Base */}
      <div 
        ref={containerRef}
        className={`w-24 h-24 rounded-full bg-gray-900/40 backdrop-blur-md border border-white/10 flex items-center justify-center shadow-2xl touch-none transition-colors ${active ? 'border-white/30' : ''}`}
        onPointerDown={handlePointerDown}
      >
        {/* Stick/Knob */}
        <div 
          className={`w-10 h-10 rounded-full bg-white/80 shadow-inner shadow-gray-400 transition-transform duration-75 ease-out ${active ? 'bg-white' : 'bg-white/60'}`}
          style={{ 
            transform: `translate(${knobPos.x}px, ${knobPos.y}px)`,
            pointerEvents: 'none' 
          }}
        >
            {/* Decor */}
            <div className="w-full h-full rounded-full bg-gradient-to-br from-transparent to-gray-300/50"></div>
        </div>
      </div>
      
      <div className="text-[10px] text-gray-500 font-mono uppercase tracking-wider select-none">Camera</div>
    </div>
  );
};
