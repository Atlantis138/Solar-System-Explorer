/** Safari can restore layout and compositing in separate steps after Split View.
 * All scene surfaces remeasure on the same events; no polling while idle. */
export function observeViewportRecovery(onResize: () => void, onRestore = onResize) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const resize = () => onResize();
  const restore = () => {
    if (document.hidden) return;
    onRestore();
    clearTimeout(timer);
    timer = setTimeout(onRestore, 220);
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', restore);
  window.addEventListener('pageshow', restore);
  window.addEventListener('focus', restore);
  document.addEventListener('visibilitychange', restore);
  window.visualViewport?.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('scroll', resize);
  return () => {
    clearTimeout(timer);
    window.removeEventListener('resize', resize);
    window.removeEventListener('orientationchange', restore);
    window.removeEventListener('pageshow', restore);
    window.removeEventListener('focus', restore);
    document.removeEventListener('visibilitychange', restore);
    window.visualViewport?.removeEventListener('resize', resize);
    window.visualViewport?.removeEventListener('scroll', resize);
  };
}
