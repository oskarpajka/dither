// app.js - main entry point
(function() {
'use strict';

const errEl = document.getElementById('err');
const infoEl = document.getElementById('info');

function showErr(msg) {
  errEl.textContent = msg;
  errEl.style.display = 'block';
  console.error(msg);
}

function setInfo(msg) {
  infoEl.textContent = msg;
}

window.addEventListener('error', e => showErr('ERROR: ' + e.message + '\n' + (e.error && e.error.stack || '')));
window.addEventListener('unhandledrejection', e => showErr('PROMISE: ' + e.reason));

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const wrap = document.getElementById('canvas-wrap');
const sidebar = document.getElementById('sidebar');
const landing = document.getElementById('landing');
const appView = document.getElementById('app');
const backBtn = document.getElementById('back-btn');
const toolTitle = document.getElementById('tool-title');

let animTime = 0;
let animLastTime = 0;
let renderAccum = 0;
let animFrameId = null;
let animStartTime = 0;
let currentTool = 'gradient';
let asciiFrameId = null;

const FORCE_CPU = new URLSearchParams(location.search).get('cpu') === '1';

let useGL = false;
try {
  useGL = !FORCE_CPU && window.tryInitWebGL();
  setInfo(useGL ? 'GPU (WebGL2) active' : 'CPU renderer active' + (FORCE_CPU ? ' (forced)' : ''));
  if (useGL) window.onRestore(() => render());
} catch (e) {
  showErr('WebGL init failed: ' + e.message);
  useGL = false;
  setInfo('CPU renderer (WebGL failed)');
}

window.setConfig(window.generateConfig());

function render() {
  if (currentTool === 'video') {
    window.renderASCII(canvas, ctx, wrap, window.getConfig(), window.state);
    return;
  }
  const state = window.state;

  if (state.resW > 0 && state.resH > 0) {
    wrap.style.width = state.resW + 'px';
    wrap.style.height = state.resH + 'px';
    wrap.className = 'fixed';
    wrap.style.aspectRatio = '';
  } else {
    wrap.style.width = '';
    wrap.style.height = '';
    const aspect = state.aspect;
    if (aspect === 'free') {
      wrap.className = '';
      wrap.style.aspectRatio = '';
    } else {
      wrap.className = 'fixed';
      const [wa, ha] = aspect.split('/');
      wrap.style.aspectRatio = (parseInt(wa) / parseInt(ha)).toString();
    }
  }

  const w = wrap.clientWidth | 0;
  const h = wrap.clientHeight | 0;
  if (w === 0 || h === 0) {
    setInfo('skip: size ' + w + 'x' + h);
    return;
  }
  if (useGL) {
    try {
      window.renderWebGL(canvas, ctx, wrap, window.getConfig(), state, animTime);
      return;
    } catch (e) {
      console.error('WebGL render error:', e.message);
      useGL = false;
      setInfo('CPU renderer (WebGL: ' + e.message + ')');
    }
  }
  window.renderCPU(canvas, ctx, wrap, window.getConfig(), state, animTime);
}

function animLoop(time) {
  if (!window.state.animOn) return;
  if (animStartTime === 0) animStartTime = time;
  var realMs = time - animStartTime;
  var loopSec = window.state.loopDuration.val;
  var loopMs = loopSec * 1000;
  var wrapped = loopSec > 0 ? realMs % loopMs : realMs;
  animTime = wrapped * window.state.animSpeed.val * 0.00002;
  var dt = animLastTime ? (time - animLastTime) : 16;
  animLastTime = time;
  renderAccum += dt;
  var interval = 1000 / Math.max(1, window.state.animFps.val);
  if (renderAccum >= interval) {
    renderAccum -= interval;
    render();
  }
  animFrameId = requestAnimationFrame(animLoop);
}

function regenerate() {
  window.setConfig(window.generateConfig());
  buildSidebar();
  render();
}

function startAnim(resetTime) {
  window.state.animOn = true;
  if (resetTime) {
    animStartTime = 0;
    animLastTime = 0;
    animTime = 0;
    renderAccum = 0;
  }
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = requestAnimationFrame(animLoop);
}

function stopAnim() {
  window.state.animOn = false;
  if (animFrameId) {
    cancelAnimationFrame(animFrameId);
    animFrameId = null;
  }
}

function showLanding() {
  stopAnim();
  stopASCIILoop();
  appView.style.display = 'none';
  landing.style.display = '';
}

function showTool(name) {
  currentTool = name;
  landing.style.display = 'none';
  appView.style.display = '';
  toolTitle.textContent = name.toUpperCase().replace(/-/g, ' ');

  if (name === 'video') {
    wrap.style.width = '';
    wrap.style.height = '';
    wrap.style.aspectRatio = '';
    document.getElementById('drop-zone').style.display = 'flex';
    wrap.style.display = 'none';
    document.getElementById('random-btn').style.display = 'none';
    document.getElementById('dark-btn').style.display = 'none';
    document.getElementById('export-btn').style.display = 'none';
    document.getElementById('export-video-btn').textContent = 'EXPORT MP4';
    buildVideoSidebar();
    startASCIILoop();
  } else {
    document.getElementById('drop-zone').style.display = 'none';
    wrap.style.display = '';
    document.getElementById('random-btn').style.display = '';
    document.getElementById('dark-btn').style.display = '';
    document.getElementById('export-btn').style.display = '';
    document.getElementById('export-video-btn').textContent = 'EXPORT VIDEO';
    buildSidebar();
    requestAnimationFrame(function() { render(); });
  }
}

document.querySelectorAll('.card[data-tool]').forEach(function(card) {
  card.addEventListener('click', function() { showTool(card.dataset.tool); });
});
backBtn.addEventListener('click', showLanding);

// --- Video / ASCII tool ---

function startASCIILoop() {
  stopASCIILoop();
  var video = document.getElementById('ascii-video');
  function loop() {
    render();
    asciiFrameId = requestAnimationFrame(loop);
  }
  asciiFrameId = requestAnimationFrame(loop);
}

function stopASCIILoop() {
  if (asciiFrameId) {
    cancelAnimationFrame(asciiFrameId);
    asciiFrameId = null;
  }
}

function loadVideoFile(file) {
  if (!file) return;
  var url = URL.createObjectURL(file);
  var video = document.getElementById('ascii-video');
  video.src = url;
  video.load();
  video.onloadedmetadata = function() {
    document.getElementById('drop-zone').style.display = 'none';
    wrap.style.display = '';
    requestAnimationFrame(function() { sizeWrapToVideo(); });
    setInfo(video.videoWidth + 'x' + video.videoHeight);
    video.play();
  };
}

function sizeWrapToVideo() {
  var video = document.getElementById('ascii-video');
  if (!video || video.readyState < 2) return;
  var area = document.getElementById('canvas-area');
  var aw = area.clientWidth;
  var ah = area.clientHeight;
  if (aw === 0 || ah === 0) { requestAnimationFrame(sizeWrapToVideo); return; }
  var ar = video.videoWidth / video.videoHeight;
  var w, h;
  if (aw / ah > ar) {
    h = ah;
    w = h * ar;
  } else {
    w = aw;
    h = w / ar;
  }
  wrap.style.width = Math.floor(w) + 'px';
  wrap.style.height = Math.floor(h) + 'px';
  wrap.className = 'fixed';
  wrap.style.aspectRatio = '';
}

var dropZone = document.getElementById('drop-zone');
var fileInput = document.getElementById('video-file-input');

dropZone.addEventListener('click', function() { fileInput.click(); });

dropZone.addEventListener('dragover', function(e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', function() {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', function(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  var file = e.dataTransfer.files[0];
  if (file && file.type.startsWith('video/')) loadVideoFile(file);
});

fileInput.addEventListener('change', function() {
  if (fileInput.files[0]) loadVideoFile(fileInput.files[0]);
});

function makeSimpleSlider(key, label, opts) {
  var c = window.state[key];
  var sec = document.createElement('div');
  sec.className = 'section';
  sec.innerHTML = '<div class="section-title">' + label + '</div>';
  var row = document.createElement('div');
  row.className = 'ctrl-row';
  var s = document.createElement('input');
  s.type = 'range';
  s.min = c.min; s.max = c.max; s.value = c.val;
  var v = document.createElement('span');
  v.className = 'ctrl-val';
  v.textContent = opts.fmt ? opts.fmt(c.val) : c.val;
  s.addEventListener('input', function() {
    c.val = parseInt(s.value);
    v.textContent = opts.fmt ? opts.fmt(c.val) : c.val;
  });
  row.appendChild(s); row.appendChild(v);
  sec.appendChild(row);
  return sec;
}

function buildVideoSidebar() {
  var state = window.state;
  sidebar.innerHTML = '';

  // Charset
  var csSection = document.createElement('div');
  csSection.className = 'section';
  csSection.innerHTML = '<div class="section-title">Character Set</div>';
  var csSelect = document.createElement('select');
  csSelect.className = 'ascii-select';
  var csets = [
    { value: 'standard', label: 'Standard (10)' },
    { value: 'detailed', label: 'Detailed (70)' },
    { value: 'block', label: 'Block (5)' },
  ];
  csets.forEach(function(c) {
    var opt = document.createElement('option');
    opt.value = c.value; opt.textContent = c.label;
    if (c.value === state.asciiCharset) opt.selected = true;
    csSelect.appendChild(opt);
  });
  csSelect.addEventListener('change', function() { state.asciiCharset = csSelect.value; });
  csSection.appendChild(csSelect);
  sidebar.appendChild(csSection);

  // Cell size
  sidebar.appendChild(makeSimpleSlider('asciiCellSize', 'Cell Size', { fmt: function(v) { return v + 'px'; } }));

  // Scale mode
  var scaleSection = document.createElement('div');
  scaleSection.className = 'section';
  scaleSection.innerHTML = '<div class="section-title">Scale</div>';
  var scaleGroup = document.createElement('div');
  scaleGroup.className = 'ratio-group';
  [
    { label: 'Fit', value: 'fit' },
    { label: 'Fill', value: 'fill' },
  ].forEach(function(m) {
    var btn = document.createElement('button');
    btn.className = 'ratio-btn' + (state.asciiScaleMode === m.value ? ' active' : '');
    btn.textContent = m.label;
    btn.dataset.val = m.value;
    btn.addEventListener('click', function() {
      state.asciiScaleMode = m.value;
      scaleGroup.querySelectorAll('.ratio-btn').forEach(function(b) { b.classList.toggle('active', b.dataset.val === state.asciiScaleMode); });
    });
    scaleGroup.appendChild(btn);
  });
  scaleSection.appendChild(scaleGroup);
  sidebar.appendChild(scaleSection);

  // Colors
  var colorSection = document.createElement('div');
  colorSection.className = 'section';
  colorSection.innerHTML = '<div class="section-title">Colors</div>';
  var colorRow = document.createElement('div');
  colorRow.style.cssText = 'display:flex;gap:8px;align-items:center';

  var bgLbl = document.createElement('label');
  bgLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px';
  bgLbl.textContent = 'Bg';
  var bgInput = document.createElement('input');
  bgInput.type = 'color'; bgInput.value = state.asciiBgColor;
  bgInput.style.cssText = 'width:28px;height:22px;border:1px solid var(--border);padding:0;background:none;cursor:pointer';
  bgInput.addEventListener('input', function() { state.asciiBgColor = bgInput.value; });
  bgLbl.appendChild(bgInput);

  var fgLbl = document.createElement('label');
  fgLbl.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:10px';
  fgLbl.textContent = 'Fg';
  var fgInput = document.createElement('input');
  fgInput.type = 'color'; fgInput.value = state.asciiFgColor;
  fgInput.style.cssText = 'width:28px;height:22px;border:1px solid var(--border);padding:0;background:none;cursor:pointer';
  fgInput.addEventListener('input', function() { state.asciiFgColor = fgInput.value; });
  fgLbl.appendChild(fgInput);

  colorRow.appendChild(bgLbl); colorRow.appendChild(fgLbl);
  colorSection.appendChild(colorRow);
  sidebar.appendChild(colorSection);

  // Invert
  var invSection = document.createElement('div');
  invSection.className = 'section';
  var invLbl = document.createElement('label');
  invLbl.className = 'man-chk';
  var invChk = document.createElement('input');
  invChk.type = 'checkbox';
  invChk.checked = state.asciiInvert;
  invChk.addEventListener('change', function() { state.asciiInvert = invChk.checked; });
  var invBox = document.createElement('span');
  invBox.className = 'chk-box';
  var invTick = document.createElement('span');
  invTick.className = 'chk-tick';
  invBox.appendChild(invTick);
  invLbl.appendChild(invChk); invLbl.appendChild(invBox);
  invLbl.appendChild(document.createTextNode(' Invert'));
  invSection.appendChild(invLbl);
  sidebar.appendChild(invSection);

  // Export framerate
  sidebar.appendChild(makeSimpleSlider('asciiFps', 'Export FPS', { fmt: function(v) { return v + 'fps'; } }));

  // Play/Pause
  var ppSection = document.createElement('div');
  ppSection.className = 'section';
  var ppBtn = document.createElement('button');
  ppBtn.className = 'sidebar-btn';
  ppBtn.textContent = 'Play / Pause';
  ppBtn.addEventListener('click', function() {
    var video = document.getElementById('ascii-video');
    if (video.paused) video.play(); else video.pause();
  });
  ppSection.appendChild(ppBtn);
  sidebar.appendChild(ppSection);

  // Export
  var expBtn = document.createElement('button');
  expBtn.className = 'sidebar-btn';
  expBtn.style.marginTop = '8px';
  expBtn.textContent = 'Export MP4';
  expBtn.addEventListener('click', function() { exportASCIIVideo(); });
  sidebar.appendChild(expBtn);
}

function exportASCIIVideo() {
  var video = document.getElementById('ascii-video');
  if (!video || video.readyState < 2) { showErr('Load a video first.'); return; }

  var dur = video.duration || 5;
  var expFps = window.state.asciiFps || 30;
  if (expFps > 60) expFps = 60;
  if (expFps < 1) expFps = 30;

  var s = window.state;
  var wasResW = s.resW;
  var wasResH = s.resH;
  var wasMaxW = wrap.style.maxWidth;
  var wasMaxH = wrap.style.maxHeight;
  var wasPlaying = !video.paused;
  var wasLoop = video.loop;

  if (wasPlaying) video.pause();

  var cfgW = s.resW > 0 ? s.resW : video.videoWidth;
  var cfgH = s.resH > 0 ? s.resH : video.videoHeight;
  s.resW = cfgW;
  s.resH = cfgH;
  wrap.style.maxWidth = 'none';
  wrap.style.maxHeight = 'none';

  var overlay = document.getElementById('export-overlay');
  var progressEl = overlay.querySelector('.export-overlay-progress');

  function restore() {
    overlay.style.display = 'none';
    s.resW = wasResW;
    s.resH = wasResH;
    wrap.style.maxWidth = wasMaxW;
    wrap.style.maxHeight = wasMaxH;
    video.loop = wasLoop;
    video.pause();
    if (wasPlaying) video.play();
    render();
  }

  function findMp4Mime() {
    var candidates = ['video/mp4;codecs=avc1.4d401e', 'video/mp4;codecs=avc1', 'video/mp4'];
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return null;
  }

  var mime = findMp4Mime();
  if (!mime) { showErr('MP4 export requires Chrome, Edge, or Safari 16.4+.'); return; }

  overlay.style.display = 'flex';
  progressEl.textContent = '0%';

  var stream = canvas.captureStream(expFps);
  var chunks = [];
  var recorder = new MediaRecorder(stream, { mimeType: mime, bitsPerSecond: 50000000 });
  recorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = function() {
    restore();
    var blob = new Blob(chunks, { type: 'video/mp4' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ascii.mp4';
    a.click();
  };

  video.loop = false;
  video.currentTime = 0;
  recorder.start();

  var startReal = performance.now();
  var pollTimer = setInterval(function() {
    var pct = Math.min(99, Math.round((performance.now() - startReal) / (dur * 1000) * 100));
    progressEl.textContent = pct + '%';
  }, 200);

  video.play();

  video.onended = function() {
    clearInterval(pollTimer);
    progressEl.textContent = '100%';
    recorder.stop();
    video.onended = null;
  };

  setTimeout(function() {
    if (recorder.state === 'recording') {
      clearInterval(pollTimer);
      progressEl.textContent = '100%';
      recorder.stop();
      video.onended = null;
    }
  }, dur * 1000 + 3000);
}

function makeSlider(id, label, opts) {
  const c = window.state[id];
  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = '<div class="section-title">' + label + '</div>';
  const row = document.createElement('div');
  row.className = 'ctrl-row';
  const slider = document.createElement('input');
  slider.type = 'range';
  slider.min = c.min; slider.max = c.max; slider.value = c.val;
  slider.step = opts.step || 1;
  const valSpan = document.createElement('span');
  valSpan.className = 'ctrl-val';
  const { lbl: chkLbl, chk } = window.makeCheckbox(c.locked, 'Manual');
  function updateDisabled() { slider.disabled = !c.locked; }
  chk.addEventListener('change', function() { c.locked = chk.checked; updateDisabled(); render(); });
  slider.addEventListener('input', function() {
    c.val = parseInt(slider.value);
    valSpan.textContent = opts.format ? opts.format(c.val) : c.val;
    if (opts.refresh === 'render') render();
  });
  slider.addEventListener('change', function() { if (opts.refresh === 'full') regenerate(); else render(); });
  valSpan.textContent = opts.format ? opts.format(c.val) : c.val;
  updateDisabled();
  row.appendChild(slider); row.appendChild(valSpan); row.appendChild(chkLbl);
  section.appendChild(row);
  return section;
}

function buildSidebar() {
  const state = window.state;
  sidebar.innerHTML = '';
  sidebar.appendChild(makeSlider('cellSize', 'Pixel Size', { format: function(v) { return v + 'px'; }, refresh: 'render' }));
  sidebar.appendChild(makeSlider('layers', 'Layers', { refresh: 'full' }));
  sidebar.appendChild(makeSlider('warp', 'Warp', { format: function(v) { return v + '%'; }, step: 5, refresh: 'render' }));
  sidebar.appendChild(makeSlider('colors', 'Colors', { refresh: 'full' }));

  // Aspect ratio
  const ratioSection = document.createElement('div');
  ratioSection.className = 'section';
  ratioSection.innerHTML = '<div class="section-title">Aspect Ratio</div>';
  const ratioGroup = document.createElement('div');
  ratioGroup.className = 'ratio-group';
  const presets = [
    { label: 'Free', value: 'free' },
    { label: '1:1', value: '1/1' },
    { label: '4:3', value: '4/3' },
    { label: '16:9', value: '16/9' },
    { label: '3:2', value: '3/2' },
  ];
  function updRatio() {
    const isCustom = !presets.some(function(p) { return p.value === state.aspect; });
    ratioGroup.querySelectorAll('.ratio-btn').forEach(function(b) {
      b.classList.toggle('active', b.dataset.val === state.aspect);
    });
    ratioInput.classList.toggle('active', isCustom && state.aspect !== 'free');
  }
  presets.forEach(function(p) {
    const btn = document.createElement('button');
    btn.className = 'ratio-btn' + (state.aspect === p.value ? ' active' : '');
    btn.textContent = p.label; btn.dataset.val = p.value;
    btn.addEventListener('click', function() {
      state.aspect = p.value;
      ratioInput.value = '';
      render();
      updRatio();
    });
    ratioGroup.appendChild(btn);
  });
  ratioSection.appendChild(ratioGroup);
  const ratioInput = document.createElement('input');
  ratioInput.type = 'text'; ratioInput.className = 'ratio-input';
  ratioInput.placeholder = 'custom (e.g. 16:9, 21:9)';
  ratioInput.addEventListener('change', function() {
    const v = ratioInput.value.trim();
    if (!v) { state.aspect = 'free'; render(); updRatio(); return; }
    const m = v.match(/^(\d+)\s*[:x]\s*(\d+)$/);
    if (m) { state.aspect = m[1] + '/' + m[2]; render(); updRatio(); }
  });
  ratioSection.appendChild(ratioInput);
  sidebar.appendChild(ratioSection);

  // Resolution
  const resSection = document.createElement('div');
  resSection.className = 'section';
  resSection.innerHTML = '<div class="section-title">Resolution (0 = auto)</div>';
  const resRow = document.createElement('div');
  resRow.className = 'res-row';
  const resW = document.createElement('input');
  resW.type = 'number'; resW.className = 'res-input'; resW.min = 0; resW.value = state.resW;
  resW.placeholder = 'W';
  const resX = document.createElement('span');
  resX.className = 'res-x'; resX.textContent = '\u00d7';
  const resH = document.createElement('input');
  resH.type = 'number'; resH.className = 'res-input'; resH.min = 0; resH.value = state.resH;
  resH.placeholder = 'H';
  resW.addEventListener('change', function() {
    state.resW = parseInt(resW.value) || 0;
    render();
  });
  resH.addEventListener('change', function() {
    state.resH = parseInt(resH.value) || 0;
    render();
  });
  resRow.appendChild(resW); resRow.appendChild(resX); resRow.appendChild(resH);
  resSection.appendChild(resRow);
  sidebar.appendChild(resSection);

  // Animation
  const animSection = document.createElement('div');
  animSection.className = 'section';
  animSection.innerHTML = '<div class="section-title">Animation</div>';
  const animRow = document.createElement('div');
  animRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px';
  const animChk = window.makeCheckbox(state.animOn, 'Animate');
  animChk.chk.addEventListener('change', function() {
    if (animChk.chk.checked) {
      startAnim(true);
    } else {
      stopAnim();
      render();
    }
  });
  animRow.appendChild(animChk.lbl);
  animSection.appendChild(animRow);

  function makeSub(key, label, isNum) {
    const c = state[key];
    const sec = document.createElement('div');
    sec.className = 'section';
    const title = document.createElement('div');
    title.className = 'section-title'; title.textContent = label;
    sec.appendChild(title);
    const row = document.createElement('div');
    row.className = 'ctrl-row';
    const inp = document.createElement('input');
    if (isNum) { inp.type = 'number'; inp.className = 'num-input'; }
    else { inp.type = 'range'; }
    inp.min = c.min; inp.max = c.max; inp.value = c.val;
    const valSpan = document.createElement('span');
    valSpan.className = 'ctrl-val';
    valSpan.textContent = isNum ? c.val + 'fps' : c.val.toString();
    inp.addEventListener('input', function() {
      let v = parseInt(inp.value);
      if (isNaN(v)) v = c.val;
      if (v < c.min) v = c.min;
      if (v > c.max) v = c.max;
      c.val = v; inp.value = v;
      valSpan.textContent = isNum ? v + 'fps' : v.toString();
    });
    row.appendChild(inp); row.appendChild(valSpan);
    sec.appendChild(row);
    return sec;
  }

  const speSec = makeSub('animSpeed', 'Speed');
  const depSec = makeSub('animDepth', 'Depth');
  const fpsSec = makeSub('animFps', 'Framerate', true);
  const loopSec = makeSub('loopDuration', 'Loop (0 = infinite)', true);
  animSection.appendChild(speSec); animSection.appendChild(depSec); animSection.appendChild(fpsSec); animSection.appendChild(loopSec);
  sidebar.appendChild(animSection);

  // Seed
  const seedSection = document.createElement('div');
  seedSection.className = 'section';
  seedSection.innerHTML = '<div class="section-title">Seed</div>';
  const seedRow = document.createElement('div');
  seedRow.className = 'seed-row';
  const seedInput = document.createElement('input');
  seedInput.type = 'number'; seedInput.min = 0; seedInput.max = 999999999;
  seedInput.value = state.seed.toString();
  seedInput.style.cssText = 'flex:1;min-width:0;font-size:10px;font-family:"SF Mono",Consolas,monospace;background:var(--cbg);color:var(--text);border:1px solid var(--border);padding:2px 4px;outline:none';
  seedInput.disabled = state.seedRandom;
  const { lbl: seedLbl, chk: seedChk } = window.makeCheckbox(state.seedRandom, 'Random');
  seedChk.addEventListener('change', function() {
    state.seedRandom = seedChk.checked; seedInput.disabled = state.seedRandom;
    if (state.seedRandom) { state.seed = Math.floor(Math.random() * 1e9); seedInput.value = state.seed.toString(); regenerate(); }
  });
  seedInput.addEventListener('change', function() {
    const v = parseInt(seedInput.value);
    if (!isNaN(v) && v >= 0) { state.seed = v; state.seedRandom = false; seedChk.checked = false; seedInput.disabled = false; regenerate(); }
    else { seedInput.value = state.seed.toString(); }
  });
  seedRow.appendChild(seedInput); seedRow.appendChild(seedLbl);
  seedSection.appendChild(seedRow);
  sidebar.appendChild(seedSection);

  // Buttons
  var rc = document.createElement('button');
  rc.className = 'sidebar-btn'; rc.textContent = 'New Color Palette';
  rc.addEventListener('click', function() { state.seedRandom = true; regenerate(); });
  sidebar.appendChild(rc);
}

document.getElementById('random-btn').addEventListener('click', function() {
  if (currentTool === 'gradient') regenerate();
});
document.getElementById('dark-btn').addEventListener('click', function() {
  if (currentTool !== 'gradient') return;
  window.state.dark = !window.state.dark;
  document.body.classList.toggle('dark', window.state.dark);
  regenerate();
});
document.getElementById('export-btn').addEventListener('click', function() {
  if (currentTool !== 'gradient') return;
  canvas.toBlob(function(b) {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'dither.png';
    a.click();
  });
});

function getDefaultExportRes() {
  var s = window.state;
  if (s.resW > 0 && s.resH > 0) return { w: s.resW, h: s.resH };
  var aspect = s.aspect;
  if (aspect === 'free') return { w: 1920, h: 1080 };
  var p = aspect.split('/');
  var ratio = parseInt(p[0]) / parseInt(p[1]);
  var w = 1920, h = Math.round(w / ratio);
  if (h > 1080) { h = 1080; w = Math.round(h * ratio); }
  return { w: Math.round(w / 2) * 2, h: Math.round(h / 2) * 2 };
}

document.getElementById('export-video-btn').addEventListener('click', function() {
  if (currentTool === 'video') {
    exportASCIIVideo();
    return;
  }
  var res = getDefaultExportRes();
  document.getElementById('export-w').value = res.w;
  document.getElementById('export-h').value = res.h;
  document.getElementById('export-fps').value = window.state.animFps.val;
  document.getElementById('export-bitrate').value = 50;
  document.getElementById('export-dialog').style.display = 'flex';
});

document.getElementById('export-cancel-btn').addEventListener('click', function() {
  document.getElementById('export-dialog').style.display = 'none';
});

document.getElementById('export-start-btn').addEventListener('click', function() {
  document.getElementById('export-dialog').style.display = 'none';
  var w = parseInt(document.getElementById('export-w').value) || 1920;
  var h = parseInt(document.getElementById('export-h').value) || 1080;
  var fps = parseInt(document.getElementById('export-fps').value) || 60;
  var bitrate = parseInt(document.getElementById('export-bitrate').value) || 50;
  runExport({ w: w, h: h, fps: Math.min(120, Math.max(1, fps)), bitrate: Math.max(1, bitrate) });
});

function runExport(cfg) {
  var dur = window.state.loopDuration.val > 0 ? window.state.loopDuration.val : 5;
  var expFps = cfg.fps;
  var bps = cfg.bitrate * 1000000;

  if (typeof canvas.captureStream !== 'function') {
    showErr('Video export requires canvas.captureStream support');
    return;
  }

  function findMp4Mime() {
    var candidates = [
      'video/mp4;codecs=avc1.4d401e',
      'video/mp4;codecs=avc1',
      'video/mp4',
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (MediaRecorder.isTypeSupported(candidates[i])) return candidates[i];
    }
    return null;
  }

  var mime = findMp4Mime();
  if (!mime) {
    showErr('MP4 export requires Chrome, Edge, or Safari 16.4+.');
    return;
  }

  var s = window.state;
  var wasAnimOn = s.animOn;
  var wasLoopDur = s.loopDuration.val;
  var wasResW = s.resW;
  var wasResH = s.resH;
  var wasMaxW = wrap.style.maxWidth;
  var wasMaxH = wrap.style.maxHeight;
  if (wasAnimOn) stopAnim();

  s.resW = cfg.w;
  s.resH = cfg.h;
  wrap.style.maxWidth = 'none';
  wrap.style.maxHeight = 'none';

  var overlay = document.getElementById('export-overlay');
  var progressEl = overlay.querySelector('.export-overlay-progress');
  overlay.style.display = 'flex';
  progressEl.textContent = '0%';

  var stream = canvas.captureStream(expFps);
  var chunks = [];
  var recorder = new MediaRecorder(stream, { mimeType: mime, bitsPerSecond: bps });
  recorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
  recorder.onstop = function() {
    overlay.style.display = 'none';
    s.resW = wasResW;
    s.resH = wasResH;
    wrap.style.maxWidth = wasMaxW;
    wrap.style.maxHeight = wasMaxH;
    s.loopDuration.val = wasLoopDur;
    s.animOn = false;
    var blob = new Blob(chunks, { type: 'video/mp4' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dither.mp4';
    a.click();
    if (wasAnimOn) startAnim(true); else render();
  };

  s.loopDuration.val = dur;
  recorder.start();

  var startReal = performance.now();
  var pollTimer = setInterval(function() {
    var pct = Math.min(99, Math.round((performance.now() - startReal) / (dur * 1000) * 100));
    progressEl.textContent = pct + '%';
  }, 200);

  startAnim(true);

  setTimeout(function() {
    clearInterval(pollTimer);
    progressEl.textContent = '100%';
    recorder.stop();
  }, dur * 1000 + 200);
}
canvas.addEventListener('click', function() { if (currentTool === 'gradient') regenerate(); });
window.addEventListener('resize', function() {
  if (currentTool === 'video') {
    var video = document.getElementById('ascii-video');
    if (video && video.readyState >= 2) sizeWrapToVideo();
  }
  setInfo('resize: ' + wrap.clientWidth + 'x' + wrap.clientHeight);
  render();
});

// Start on landing page
landing.style.display = '';
appView.style.display = 'none';
setInfo('Ready');

})();
