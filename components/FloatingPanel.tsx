import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './floating-panels.css';
import { observeViewportRecovery } from '../core/viewportRecovery';

type PanelEntry = { id: string; title: string; pinned: boolean; minimized: boolean; order: number; restore: () => void };
const PanelContext = createContext<{ entries: PanelEntry[]; register: (p: PanelEntry) => void; remove: (id: string) => void; next: () => number } | null>(null);

export function PanelWorkspace({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<PanelEntry[]>([]);
  const serial = useRef(0);
  const api = React.useMemo(() => ({
    register: (p: PanelEntry) => setEntries(old => [...old.filter(v => v.id !== p.id), p]),
    remove: (id: string) => setEntries(old => old.filter(v => v.id !== id)),
    next: () => ++serial.current,
  }), []);
  return <PanelContext.Provider value={{ ...api, entries }}>{children}</PanelContext.Provider>;
}

export default function FloatingPanel({ id, title, subtitle, children, onClose, width = 284, side = 'left',
  top = 64, className = '', actions, initialMinimized = false, revealKey }: {
  id: string; title: string; subtitle?: string; children: React.ReactNode; onClose?: () => void;
  width?: number; side?: 'left' | 'right' | 'center'; top?: number; className?: string;
  actions?: React.ReactNode; initialMinimized?: boolean;
  revealKey?: string | number;
}) {
  const workspace = useContext(PanelContext)!;
  const { register, remove, next } = workspace;
  const [order, setOrder] = useState(next);
  const [pinned, setPinned] = useState(false);
  const [minimized, setMinimized] = useState(initialMinimized);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const ref = useRef<HTMLElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; px: number; py: number } | null>(null);
  const bringForward = () => setOrder(next());
  const restore = () => { setMinimized(false); bringForward(); };
  useEffect(() => { if (!minimized) window.dispatchEvent(new Event('navigation-stop')); }, [minimized, revealKey]);
  useEffect(() => { if (revealKey !== undefined) restore(); }, [revealKey]);
  useEffect(() => { register({ id, title, pinned, minimized, order, restore }); }, [id, title, pinned, minimized, order]);
  useEffect(() => () => remove(id), [id, remove]);
  const fit = (x: number, y: number) => {
    const w = ref.current?.offsetWidth ?? Math.min(width, window.innerWidth - 24);
    const bottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--scene-bottom-space')) || 104;
    return { x: Math.max(8, Math.min(x, window.innerWidth - w - 8)),
      y: Math.max(8, Math.min(y, window.innerHeight - bottom - 54)) };
  };
  useLayoutEffect(() => {
    const resize = () => {const measured=ref.current?.offsetWidth??width;setPosition(p => fit(p?.x ?? (side === 'right' ? window.innerWidth - measured - 20 : side === 'center' ? (window.innerWidth - measured) / 2 : 20),
      p?.y ?? (window.innerWidth < 640 ? 32 : top)));};
    resize(); const unwatch = observeViewportRecovery(resize);
    return unwatch;
  }, [width]);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || minimized || document.querySelector('[aria-modal="true"]')) return;
      const topPanel = workspace.entries.filter(p => !p.minimized).sort((a,b) => Number(b.pinned)-Number(a.pinned) || b.order-a.order)[0];
      if (topPanel?.id !== id) return;
      e.preventDefault(); closeRef.current ? closeRef.current() : setMinimized(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [workspace.entries, minimized, id]);
  const stopDrag = (e: React.PointerEvent) => {
    if (drag.current?.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  if (typeof document === 'undefined') return null;
  return createPortal(<section ref={ref} data-scene-ui data-panel-id={id} data-pinned={pinned}
    role="dialog" aria-label={title} className={`floating-panel ${className} ${minimized ? 'is-minimized' : ''}`} data-minimized={minimized}
    style={{ width, ['--panel-width' as string]: `${width}px`, left: position?.x ?? 8, top: position?.y ?? top,
      maxHeight: `var(--panel-height-limit, calc(100dvh - ${position?.y ?? top}px - var(--scene-bottom-space, 112px)))`,
      ['--panel-top' as string]: `${position?.y ?? top}px`,
      zIndex: (pinned ? 3000 : 1000) + workspace.entries.filter(p => p.pinned === pinned && p.order < order).length }}
    onPointerDownCapture={()=>{window.dispatchEvent(new Event('navigation-stop'));bringForward();}} onWheel={e => e.stopPropagation()} onDoubleClick={e => e.stopPropagation()}>
    <header className="floating-panel-header" onPointerDown={e => {
      if (e.button !== 0 || (e.target as Element).closest('button,input,a,select')) return;
      e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, px: position?.x ?? 8, py: position?.y ?? top };
    }} onPointerMove={e => {
      const d = drag.current; if (d?.id !== e.pointerId) return;
      setPosition(fit(d.px + e.clientX - d.x, d.py + e.clientY - d.y));
    }} onPointerUp={stopDrag} onPointerCancel={stopDrag} onLostPointerCapture={stopDrag}>
      <div className="floating-panel-title" tabIndex={0} aria-label={`移动${title}，方向键移动，Home 复位`}
        onKeyDown={e => {
          const delta: Record<string, [number, number]> = { ArrowLeft: [-20,0], ArrowRight: [20,0], ArrowUp: [0,-20], ArrowDown: [0,20] };
          if (delta[e.key]) { e.preventDefault(); const [x,y] = delta[e.key]; setPosition(p => fit((p?.x ?? 8)+x,(p?.y ?? top)+y)); }
          if (e.key === 'Home') { e.preventDefault(); setPosition(fit(20,48)); }
        }}><span className="panel-grip" aria-hidden="true">⠿</span><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div></div>
      <div className="floating-panel-tools">{actions}
        <button aria-label={`${pinned ? '取消置顶' : '置顶'}${title}`} title={pinned ? '取消置顶' : '置顶'} aria-pressed={pinned} onClick={() => setPinned(v => !v)}><svg viewBox="0 0 24 24"><path d="m9 4 6 0-1 6 4 4H6l4-4-1-6Zm3 10v7" /></svg></button>
        <button aria-label={`${minimized ? '展开' : '收起'}${title}`} title={minimized ? '展开' : '收起'} aria-expanded={!minimized} onClick={() => setMinimized(v => !v)}><svg viewBox="0 0 24 24"><path d={minimized ? "M5 12h14M12 5v14" : "M5 16h14"} /></svg></button>
        {onClose && <button aria-label={`关闭${title}`} title="关闭" onClick={onClose}><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18" /></svg></button>}
      </div>
    </header>
    <div className="floating-panel-body" hidden={minimized}>{children}</div>
  </section>, document.body);
}
