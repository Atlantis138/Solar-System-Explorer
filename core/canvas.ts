/** Return a CSS-pixel drawing context without resetting an unchanged backing store. */
export function prepareCanvas(canvas: HTMLCanvasElement, dpr = window.devicePixelRatio || 1,
  size?: {width:number;height:number}) {
  const { width, height } = size ?? canvas.getBoundingClientRect();
  if (width <= 0 || height <= 0) return null;
  const pixelWidth = Math.max(1, Math.round(width * dpr));
  const pixelHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
  if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.setTransform(pixelWidth / width, 0, 0, pixelHeight / height, 0, 0);
  ctx.globalAlpha = 1;
  ctx.clearRect(0, 0, width, height);
  return { ctx, width, height };
}
