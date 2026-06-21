// config.js - generate a random dithering configuration
(function() {

const BAYER8 = [
  [ 0, 32,  8, 40,  2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44,  4, 36, 14, 46,  6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [ 3, 35, 11, 43,  1, 33,  9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47,  7, 39, 13, 45,  5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21]
];
window.BAYER8 = BAYER8;

function makeRng(s) {
  let a = s >>> 0;
  return function() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360 / 360;
  s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

window.generateConfig = function() {
  const s = window.state;
  const seed = s.seedRandom ? Math.floor(Math.random() * 1e9) : s.seed;
  if (s.seedRandom) s.seed = seed;
  const rng = makeRng(seed);

  const colorCount = s.colors.locked ? s.colors.val : (6 + Math.floor(rng() * 25));
  if (!s.colors.locked) s.colors.val = colorCount;

  const baseHue = rng() * 360;
  const spread = 40 + rng() * 320;
  const palette = [];
  for (let i = 0; i < colorCount; i++) {
    const h = baseHue + rng() * spread + (rng() - 0.5) * 20;
    const ss = 50 + rng() * 45;
    const l = s.dark ? 30 + rng() * 32 : 42 + rng() * 30;
    palette.push(hslToRgb(h, ss, l));
  }

  const layerCount = s.layers.locked ? s.layers.val : (2 + Math.floor(rng() * 7));
  if (!s.layers.locked) s.layers.val = layerCount;

  const layers = [];
  for (let i = 0; i < layerCount; i++) {
    const angle = rng() * 180;
    const subset = palette.slice();
    for (let j = subset.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      const tmp = subset[j]; subset[j] = subset[k]; subset[k] = tmp;
    }
    const size = Math.max(6, Math.floor(subset.length * (0.5 + rng() * 0.5)));
    subset.length = size;
    const warpWaves = [];
    const waveCount = 3 + Math.floor(rng() * 2);
    for (let w = 0; w < waveCount; w++) {
      warpWaves.push({
        freq: 0.5 + rng() * 2.5,
        amp: 0.02 + rng() * 0.06,
        angle: rng() * 180,
        phase: rng() * Math.PI * 2
      });
    }
    layers.push({ angle, colors: subset, warpWaves });
  }
  return { palette, layers };
};

})();
