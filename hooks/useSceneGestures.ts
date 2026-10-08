import { useEffect, useRef } from 'react';
import type { RefObject, PointerEvent as ReactPointerEvent, MouseEvent as ReactMouseEvent } from 'react';
import { wheelPixels, sceneDragPans } from '../core/cameraNavigation';

interface GestureCallbacks {
  rotate: (dx: number, dy: number) => void;
  pan: (dx: number, dy: number) => void;
  beginPinch: () => void;
  pinch: (ratio: number, dx: number, dy: number) => void;
  wheel: (pixels: number) => void;
  shortAxis: number;
  interrupt: () => void;
}
const isUI = (target: EventTarget | null) => target instanceof Element && !!target.closest('[data-scene-ui],button,input,select,textarea,a,[data-panel-id]');
type Point = { x: number; y: number; startX: number; startY: number; pan: boolean };

/** One owner for scene input. A joystick/UI touch can never join a scene pinch. */
export function useSceneGestures(container: RefObject<HTMLDivElement | null>, callbacks: GestureCallbacks) {
  const latest = useRef(callbacks); latest.current = callbacks;
  const points = useRef(new Map<number, Point>());
  const dragged = useRef(false);
  const pair = useRef<{distance:number;x:number;y:number} | null>(null);
  const suppressUntil = useRef(0);
  const stop = () => {
    for (const id of points.current.keys()) if (container.current?.hasPointerCapture(id)) container.current.releasePointerCapture(id);
    points.current.clear(); dragged.current = false; pair.current = null;
  };
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      if (isUI(event.target) || event.altKey || event.metaKey) return;
      event.preventDefault(); latest.current.interrupt();
      latest.current.wheel(wheelPixels(event.deltaY, event.deltaMode, latest.current.shortAxis));
    };
    const visibility = () => { if (document.hidden) stop(); };
    element.addEventListener('wheel', wheel, { passive: false });
    window.addEventListener('blur', stop); window.addEventListener('navigation-stop', stop);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stop(); element.removeEventListener('wheel', wheel);
      window.removeEventListener('blur', stop); window.removeEventListener('navigation-stop', stop);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, []);
  const end = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!points.current.has(event.pointerId)) return;
    points.current.delete(event.pointerId);
    pair.current = null;
    if (dragged.current) suppressUntil.current = performance.now() + 400;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    // Rebase the remaining finger: lifting one finger never turns the last pinch into a large drag.
    for (const point of points.current.values()) { point.startX = point.x; point.startY = point.y; }
    dragged.current = false;
  };
  return {
    onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (isUI(event.target) || ![0, 1, 2].includes(event.button) || points.current.size >= 2) return;
      latest.current.interrupt();
      if (!points.current.size) { dragged.current = false; suppressUntil.current = 0; }
      points.current.set(event.pointerId, { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, pan: sceneDragPans(event.button,event.pointerType) });
      if (points.current.size === 2) {
        dragged.current = true;
        const [a,b]=[...points.current.values()];
        pair.current={distance:Math.hypot(a.x-b.x,a.y-b.y),x:(a.x+b.x)/2,y:(a.y+b.y)/2};
        latest.current.beginPinch();
        for (const [id, point] of points.current) {
          point.startX = point.x; point.startY = point.y;
          event.currentTarget.setPointerCapture(id);
        }
      }
    },
    onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => {
      const point = points.current.get(event.pointerId); if (!point) return;
      const other = [...points.current.entries()].find(([id]) => id !== event.pointerId)?.[1];
      const dx = event.clientX - point.x, dy = event.clientY - point.y;
      point.x = event.clientX; point.y = event.clientY;
      if (!dragged.current) {
        if (Math.hypot(point.x - point.startX, point.y - point.startY) < 4) return;
        dragged.current = true; event.currentTarget.setPointerCapture(event.pointerId);
      }
      event.preventDefault(); suppressUntil.current = performance.now() + 400;
      if (other) {
        const after = Math.hypot(other.x - point.x, other.y - point.y);
        const base=pair.current;
        if(base&&base.distance>12&&after>12)latest.current.pinch(after/base.distance,(other.x+point.x)/2-base.x,(other.y+point.y)/2-base.y);
      } else if (point.pan) latest.current.pan(dx, dy);
      else latest.current.rotate(dx, dy);
    },
    onPointerUp: end,
    onPointerCancel: end,
    onLostPointerCapture: (event: ReactPointerEvent<HTMLDivElement>) => {
      if (event.target === event.currentTarget && !event.currentTarget.hasPointerCapture(event.pointerId)) end(event);
    },
    onClickCapture: (event: ReactMouseEvent<HTMLDivElement>) => {
      if (!isUI(event.target) && performance.now() < suppressUntil.current) { event.preventDefault(); event.stopPropagation(); suppressUntil.current = 0; }
    },
    onContextMenu: (event: ReactMouseEvent<HTMLDivElement>) => { if (!isUI(event.target)) event.preventDefault(); },
  };
}
