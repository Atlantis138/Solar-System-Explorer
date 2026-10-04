import { DependencyList, RefObject, useLayoutEffect, useRef } from 'react';
import { prepareCanvas } from '../core/canvas';
import { observeViewportRecovery } from '../core/viewportRecovery';

type Draw = (ctx: CanvasRenderingContext2D, width: number, height: number) => void | boolean;

/** Paint on scene changes, container resize, and DPR changes, including while paused. */
export function useCanvasDraw(ref: RefObject<HTMLCanvasElement | null>, draw: Draw, deps: DependencyList, maxDpr = Infinity) {
  const drawRef = useRef(draw);
  const dprRef = useRef(maxDpr);
  const sizeRef = useRef<{width:number;height:number} | undefined>(undefined);
  const resetRef = useRef(false);
  const animationFrame=useRef(0);
  dprRef.current = maxDpr;
  const paint = () => {
    cancelAnimationFrame(animationFrame.current);animationFrame.current=0;
    if (!ref.current) return;
    // ResizeObserver owns layout reads. Avoid forcing a synchronous layout after
    // every SVG body update just to rediscover the same canvas dimensions.
    sizeRef.current ??= ref.current.getBoundingClientRect();
    if (resetRef.current && sizeRef.current.width > 0 && sizeRef.current.height > 0) {
      // Rebuild a backing store discarded by WebKit while backgrounded, even
      // if the restored CSS size is unchanged. Never do this on ordinary frames.
      ref.current.width = ref.current.width;
      resetRef.current = false;
    }
    const surface = prepareCanvas(ref.current, Math.min(window.devicePixelRatio || 1, dprRef.current), sizeRef.current);
    if (!surface) return;
    surface.ctx.save();
    try { if(drawRef.current(surface.ctx, surface.width, surface.height)===true)animationFrame.current=requestAnimationFrame(paint); }
    finally { surface.ctx.restore(); }
  };
  useLayoutEffect(() => { drawRef.current = draw; paint(); }, [...deps, maxDpr]);
  useLayoutEffect(() => {
    if (!ref.current) return;
    let frame = 0;
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(paint); };
    const invalidate = () => { sizeRef.current = undefined; schedule(); };
    const restore = () => { resetRef.current = true; invalidate(); };
    const observer = new ResizeObserver(entries => {
      const rect=entries[0]?.contentRect;
      if(rect && rect.width > 0 && rect.height > 0) sizeRef.current={width:rect.width,height:rect.height};
      schedule();
    });
    observer.observe(ref.current);
    let query: MediaQueryList;
    const watch = () => {
      query?.removeEventListener('change', onDprChange);
      query = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`);
      query.addEventListener('change', onDprChange);
    };
    const onDprChange = () => { watch(); invalidate(); };
    watch();
    const unwatch = observeViewportRecovery(invalidate, restore);
    const canvas = ref.current;
    const lost = (event: Event) => { event.preventDefault(); resetRef.current = true; };
    canvas.addEventListener('contextlost', lost);
    canvas.addEventListener('contextrestored', restore);
    let disposed = false;
    document.fonts?.ready.then(() => { if (!disposed) schedule(); });
    return () => {
      disposed = true;
      observer.disconnect(); query.removeEventListener('change', onDprChange);
      unwatch(); canvas.removeEventListener('contextlost', lost); canvas.removeEventListener('contextrestored', restore);
      cancelAnimationFrame(frame);cancelAnimationFrame(animationFrame.current);
    };
  }, []);
}
