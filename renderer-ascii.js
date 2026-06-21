(function() {

var CHARSETS = {
  standard: ' .:-=+*#%@',
  detailed: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  block: ' \u2591\u2592\u2593\u2588'
};

window.renderASCII = function(canvas, ctx, wrap, config, state) {
  var w = wrap.clientWidth | 0;
  var h = wrap.clientHeight | 0;
  if (w === 0 || h === 0) return;

  var dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.floor(w * dpr));
  canvas.height = Math.max(1, Math.floor(h * dpr));
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  var cellSize = state.asciiCellSize.val;
  var charset = CHARSETS[state.asciiCharset] || CHARSETS.standard;
  var bg = state.asciiBgColor || '#000';
  var fg = state.asciiFgColor || '#fff';

  var charW = cellSize * 0.6;
  var charH = cellSize;

  var video = document.getElementById('ascii-video');
  if (!video || video.readyState < 2) return;

  var vw = video.videoWidth;
  var vh = video.videoHeight;
  if (vw === 0 || vh === 0) return;

  var cols = Math.floor(w / charW);
  var rows = Math.floor(h / charH);
  if (cols === 0 || rows === 0) return;

  var vr = vw / vh;
  var pa = (cols * charW) / (rows * charH);
  var sw, sh, ox, oy;

  if (state.asciiScaleMode === 'fill') {
    if (vr > pa) {
      sh = rows;
      sw = Math.round((sh * charH * vr) / charW);
      ox = Math.floor((cols - sw) / 2);
      oy = 0;
    } else {
      sw = cols;
      sh = Math.round((sw * charW) / (vr * charH));
      ox = 0;
      oy = Math.floor((rows - sh) / 2);
    }
  } else {
    if (vr > pa) {
      sw = cols;
      sh = Math.round((sw * charW) / (vr * charH));
      ox = 0;
      oy = Math.floor((rows - sh) / 2);
    } else {
      sh = rows;
      sw = Math.round((sh * charH * vr) / charW);
      ox = Math.floor((cols - sw) / 2);
      oy = 0;
    }
  }

  sw = Math.max(1, sw);
  sh = Math.max(1, sh);

  var oc = document.getElementById('ascii-offscreen');
  if (oc.width !== sw || oc.height !== sh) { oc.width = sw; oc.height = sh; }
  var octx = oc.getContext('2d', { willReadFrequently: true });
  octx.drawImage(video, 0, 0, sw, sh);
  var id = octx.getImageData(0, 0, sw, sh);
  var d = id.data;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = fg;
  ctx.font = cellSize + 'px "SF Mono","Cascadia Code",Consolas,monospace';
  ctx.textBaseline = 'top';

  var cl = charset.length;
  var cx, cy, i, b, ci;
  for (var r = 0; r < sh; r++) {
    cy = (oy + r) * charH;
    for (var c = 0; c < sw; c++) {
      i = (r * sw + c) * 4;
      b = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
      ci = Math.floor((state.asciiInvert ? 1 - b : b) * (cl - 1));
      ci = Math.max(0, Math.min(cl - 1, ci));
      ctx.fillText(charset[ci], (ox + c) * charW, cy);
    }
  }
};

})();
