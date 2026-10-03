/** The sky and finite scene share the same 72° field of view on the short axis. */
export const cameraFocalPixels = (width: number, height: number) =>
  Math.min(width, height) / (2 * Math.tan(36 * Math.PI / 180));
