/** Solve e sinh(H) − H = M without wrapping M. Bracketed Newton steps
 * converge both near e=1/perihelion and thousands of years from encounter. */
export function solveHyperbolicAnomaly(mean: number, e: number): number {
  if (mean === 0) return 0;
  const m = Math.abs(mean);
  let lo = 0, hi = Math.max(1, Math.asinh(m / e) + 1);
  while (e * Math.sinh(hi) - hi < m) hi *= 2;
  let h = Math.min(hi, Math.asinh(m / e));
  for (let iteration = 0; iteration < 80; iteration++) {
    const f = e * Math.sinh(h) - h - m;
    if (Math.abs(f) <= 2e-14 * Math.max(m, 1e-8)) break;
    if (f < 0) lo = h; else hi = h;
    const next = h - f / (e * Math.cosh(h) - 1);
    h = next > lo && next < hi ? next : (lo + hi) / 2;
  }
  return Math.sign(mean) * h;
}
