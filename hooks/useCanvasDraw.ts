import { DependencyList, RefObject, useLayoutEffect, useRef } from 'react';
import { prepareCanvas } from '../core/canvas';

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void;

/** Paint on scene changes, container resize, and DPR changes, including while paused. */
export function useCanvasDraw(ref: RefObject<HTMLCanvasElement | null>, draw: Draw, deps: DependencyList, maxDpr = Infinity) {
  const drawRef = useRef(draw);
  const dprRef = useRef(maxDpr);
  const sizeRef = useRef<{width:number;height:number} | undefined>(undefined);
  dprRef.current = maxDpr;
  const paint = () => {
    if (!ref.current) return;
    // ResizeObserver owns layout reads. Avoid forcing a synchronous layout after
    // every SVG body update just to rediscover the same canvas dimensions.
    sizeRef.current ??= ref.current.getBoundingClientRect();
    const surface = prepareCanvas(ref.current, Math.min(window.devicePixelRatio || 1, dprRef.current), sizeRef.current);
    if (!surface) return;
    surface.ctx.save();
    try { drawRef.current(surface.ctx, surface.width, surface.height); }
    finally { surface.ctx.restore(); }
  };
  useLayoutEffect(() => { drawRef.current = draw; paint(); }, [...deps, maxDpr]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
    const observer = new ResizeObserver(entries => {
      const rect=entries[0]?.contentRect;
      if(rect) sizeRef.current={width:rect.width,height:rect.height};
      schedule();
    });
    observer.observe(ref.current);
    let query: MediaQueryList;
    const watch = () => {
      query?.removeEventListener('change', onDprChange);
      query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      query.addEventListener('change', onDprChange);
    };
    const onDprChange = () => { watch(); schedule(); };
    watch();
    window.addEventListener('resize', schedule);
    let disposed = false;
    document.fonts?.ready.then(() => { if (!disposed) schedule(); });
    return () => {
      disposed = true;
      observer.disconnect(); query.removeEventListener('change', onDprChange);
      window.removeEventListener('resize', schedule); cancelAnimationFrame(frame);
    };
  }, []);
}
