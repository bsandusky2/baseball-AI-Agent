// Diverging blue -> gray -> red scale, per the dataviz skill's validated
// diverging pair. Used for "hot/cold zone" heatmaps (magnitude displayed as
// temperature), not a statistical polarity around a true zero.
const COOL = { r: 0x2a, g: 0x78, b: 0xd6 }; // blue
const NEUTRAL = { r: 0xf0, g: 0xef, b: 0xec }; // gray midpoint
const WARM = { r: 0xe3, g: 0x49, b: 0x48 }; // red

function lerp(a: number, b: number, t: number) {
  return Math.round(a + (b - a) * t);
}

function mixRgb(from: typeof COOL, to: typeof COOL, t: number) {
  return {
    r: lerp(from.r, to.r, t),
    g: lerp(from.g, to.g, t),
    b: lerp(from.b, to.b, t),
  };
}

function rgbForValue(value: number, min: number, max: number) {
  const mid = (min + max) / 2;
  if (value <= mid) {
    const t = mid === min ? 0 : (value - min) / (mid - min);
    return mixRgb(COOL, NEUTRAL, Math.max(0, Math.min(1, t)));
  }
  const t = max === mid ? 1 : (value - mid) / (max - mid);
  return mixRgb(NEUTRAL, WARM, Math.max(0, Math.min(1, t)));
}

export function divergingColor(value: number, min: number, max: number) {
  const { r, g, b } = rgbForValue(value, min, max);
  return `rgb(${r}, ${g}, ${b})`;
}

// Perceived brightness (ITU-R BT.601) decides whether a cell needs dark or
// light text to stay legible against its own fill.
export function textColorForValue(value: number, min: number, max: number) {
  const { r, g, b } = rgbForValue(value, min, max);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 150 ? '#0b0b0b' : '#ffffff';
}
