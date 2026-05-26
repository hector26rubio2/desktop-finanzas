export function hexToOklch(hex: string): { l: number; c: number; h: number } {
  const r1 = parseInt(hex.slice(1, 3), 16) / 255;
  const g1 = parseInt(hex.slice(3, 5), 16) / 255;
  const b1 = parseInt(hex.slice(5, 7), 16) / 255;

  const srgbToLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const r = srgbToLinear(r1);
  const g = srgbToLinear(g1);
  const b = srgbToLinear(b1);

  const l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;

  const l3 = Math.cbrt(l_);
  const m3 = Math.cbrt(m_);
  const s3 = Math.cbrt(s_);

  const L = 0.2104542553 * l3 + 0.793617785 * m3 - 0.0040720468 * s3;
  const a = 1.9779984951 * l3 - 2.428592205 * m3 + 0.4505937099 * s3;
  const bb = 0.0259040371 * l3 + 0.7827717662 * m3 - 0.808675766 * s3;

  const hue = ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  const chroma = Math.sqrt(a * a + bb * bb);

  const maxC = Math.max(r1, g1, b1);
  const minC = Math.min(r1, g1, b1);
  const naiveChroma = (maxC - minC) * 0.18;

  return {
    l: L,
    c: chroma > 0.01 ? chroma : naiveChroma,
    h: hue,
  };
}

export function clampChroma(c: number): number {
  return Math.round(Math.max(0.003, Math.min(0.5, c)) * 1000) / 1000;
}

export function clampPct(v: number): number {
  return Math.round(Math.max(3, Math.min(98, v)) * 10) / 10;
}

export function triadicFrom(hue: number): { h2: number; h3: number } {
  return { h2: (hue + 120) % 360, h3: (hue + 240) % 360 };
}
