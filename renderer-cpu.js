// renderer-cpu.js - Canvas 2D fillRect renderer with trig hoisting
(function() {

window.renderCPU = function(canvas, ctx, wrap, config, state, animTime) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = wrap.clientWidth | 0;
  const h = wrap.clientHeight | 0;
  if (w === 0 || h === 0) return;

  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const cell = state.cellSize.val;
  const cols = Math.ceil(w / cell);
  const rows = Math.ceil(h / cell);
  const layers = config.layers;
  const nl = layers.length;
  const wm = state.warp.val / 100;
  const po = state.animOn ? animTime * (state.animDepth.val / 100) : 0;
  const dg = Math.PI / 180;
  const hp = Math.PI * 0.5;
  const BAYER = window.BAYER8;

  // Hoist trig out of inner loop
  const layerData = [];
  for (let li = 0; li < nl; li++) {
    const l = layers[li];
    const la = l.angle * dg;
    const cosLA = Math.cos(la), sinLA = Math.sin(la);
    const waves = [];
    for (let wi = 0; wi < l.warpWaves.length; wi++) {
      const wv = l.warpWaves[wi];
      const rd = wv.angle * dg;
      waves.push({
        cosR: Math.cos(rd), sinR: Math.sin(rd),
        cosRH: Math.cos(rd + hp), sinRH: Math.sin(rd + hp),
        f2: wv.freq * Math.PI * 2, am: wv.amp * wm,
        ph: wv.phase + po * wv.freq
      });
    }
    layerData.push({ cosLA, sinLA, waves, colors: l.colors, n: l.colors.length });
  }

  for (let r = 0; r < rows; r++) {
    const v = (r * cell + cell * 0.5) / h;
    const br = BAYER[r & 7];
    for (let c = 0; c < cols; c++) {
      const u = (c * cell + cell * 0.5) / w;
      const bayer = br[c & 7] / 64;
      let rr = 0, gg = 0, bb = 0;
      for (let li = 0; li < nl; li++) {
        const ld = layerData[li];
        let wu = u, wv = v;
        for (let wi = 0; wi < ld.waves.length; wi++) {
          const w = ld.waves[wi];
          const proj = u * w.cosR + v * w.sinR;
          const off = Math.sin(proj * w.f2 + w.ph) * w.am;
          wu += off * w.cosRH;
          wv += off * w.sinRH;
        }
        const ru = (wu - 0.5) * ld.cosLA - (wv - 0.5) * ld.sinLA + 0.5;
        const pos = ru < 0 ? 0 : (ru > 1 ? 1 : ru);
        const colors = ld.colors;
        let col;
        if (ld.n === 1) {
          col = colors[0];
        } else {
          const t = pos * (ld.n - 1);
          const i = t | 0;
          const f = t - i;
          col = (f >= bayer)
            ? (i >= ld.n - 1 ? colors[ld.n - 1] : colors[i + 1])
            : colors[i];
        }
        rr += col[0]; gg += col[1]; bb += col[2];
      }
      const x = (c * cell) | 0;
      const y = (r * cell) | 0;
      const rt = Math.min(((c + 1) * cell) | 0, w);
      const bt = Math.min(((r + 1) * cell) | 0, h);
      ctx.fillStyle = 'rgb(' + Math.round(rr / nl) + ',' + Math.round(gg / nl) + ',' + Math.round(bb / nl) + ')';
      ctx.fillRect(x, y, rt - x, bt - y);
    }
  }
};

})();
