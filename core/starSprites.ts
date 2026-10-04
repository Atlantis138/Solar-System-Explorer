/** Cached soft star kernels avoid the shimmer of subpixel hard-edged circles.
 * Color is quantized only for the tiny glow texture; catalog values are untouched. */
const sprites=new Map<string,HTMLCanvasElement>();
export function drawStar(ctx:CanvasRenderingContext2D,x:number,y:number,radius:number,color:string,opacity:number) {
  if(opacity<=0)return;
  const hex=/^#([0-9a-f]{6})$/i.exec(color)?.[1];
  const rgb=hex?[0,2,4].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)/16)*16)):[220,225,240];
  const key=rgb.join(',');let sprite=sprites.get(key);
  if(!sprite){
    sprite=document.createElement('canvas');sprite.width=sprite.height=32;
    const c=sprite.getContext('2d')!,gradient=c.createRadialGradient(16,16,0,16,16,16);
    gradient.addColorStop(0,`rgba(${key},1)`);gradient.addColorStop(.22,`rgba(${key},.95)`);
    gradient.addColorStop(.48,`rgba(${key},.45)`);gradient.addColorStop(.75,`rgba(${key},.08)`);gradient.addColorStop(1,`rgba(${key},0)`);
    c.fillStyle=gradient;c.fillRect(0,0,32,32);sprites.set(key,sprite);
  }
  const r=Math.max(.85,radius)*1.8;ctx.globalAlpha=opacity;ctx.drawImage(sprite,x-r,y-r,r*2,r*2);
}
