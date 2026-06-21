// renderer-webgl.js - WebGL2 fragment shader renderer (GPU)
(function() {

const ML = 8, MW = 5, MC = 30;

let gl = null;
let glProg = null;
let glVao = null;
let glVbo = null;
let palTex = null;
let glU = {};
let bayerFlat = null;

let cw = 0, ch = 0;
let contextLost = false;
let tc = null;
let restoreCallbacks = [];
let _giveUp = false;

window.isContextLost = function() { return contextLost; };
window.onRestore = function(cb) { restoreCallbacks.push(cb); };
window.giveUp = function() { return _giveUp; };

window.tryInitWebGL = function() {
  tc = document.createElement('canvas');
  const ctxGL = tc.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!ctxGL) return false;
  gl = ctxGL;
  cw = 0; ch = 0;
  contextLost = false;
  _giveUp = false;

  const vsSrc = `#version 300 es
in vec2 a_pos;
void main(){
gl_Position=vec4(a_pos,0.0,1.0);
}`;

  const fsSrc = `#version 300 es
precision highp float;
uniform vec2 u_res;uniform float u_cell;uniform int u_nlayer;
uniform float u_cosLA[8];uniform float u_sinLA[8];uniform float u_ncols[8];
uniform float u_cosR[40];uniform float u_sinR[40];uniform float u_cosRH[40];uniform float u_sinRH[40];
uniform float u_freq2pi[40];uniform float u_ampWM[40];uniform float u_phase[40];
uniform sampler2D u_pal;uniform float u_bayer[64];
out vec4 outColor;
void main(){
vec2 cc=floor(gl_FragCoord.xy/u_cell);
vec2 uv=(cc*u_cell+u_cell*0.5)/u_res;
int bi=int(mod(cc.y,8.0))*8+int(mod(cc.x,8.0));
float bayer_val=u_bayer[bi]/64.0;
vec3 acc=vec3(0.0);
for(int li=0;li<8;li++){
if(li>=u_nlayer)break;
vec2 wuv=uv;
int wbase=li*5;
for(int wi=0;wi<5;wi++){
int widx=wbase+wi;
float f2=u_freq2pi[widx];
if(f2==0.0)break;
float proj=uv.x*u_cosR[widx]+uv.y*u_sinR[widx];
float off=sin(proj*f2+u_phase[widx])*u_ampWM[widx];
wuv+=off*vec2(u_cosRH[widx],u_sinRH[widx]);
}
float ru=(wuv.x-0.5)*u_cosLA[li]-(wuv.y-0.5)*u_sinLA[li]+0.5;
float pos=clamp(ru,0.0,1.0);
float nc=u_ncols[li];
float t=pos*(nc-1.0);
int ci=int(t);
float fr=t-float(ci);
vec4 c1=texelFetch(u_pal,ivec2(ci,li),0);
int ci2=min(ci+1,int(nc)-1);
vec4 c2=texelFetch(u_pal,ivec2(ci2,li),0);
acc+=(fr>=bayer_val)?c2.rgb:c1.rgb;
}
acc/=float(u_nlayer);
outColor=vec4(acc,1.0);
}`;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc);
  gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    throw new Error('VS: ' + gl.getShaderInfoLog(vs));
  }

  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc);
  gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    throw new Error('FS: ' + gl.getShaderInfoLog(fs));
  }

  glProg = gl.createProgram();
  gl.attachShader(glProg, vs); gl.attachShader(glProg, fs);
  gl.linkProgram(glProg);
  if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) {
    throw new Error('LINK: ' + gl.getProgramInfoLog(glProg));
  }
  gl.useProgram(glProg);

  glVao = gl.createVertexArray();
  gl.bindVertexArray(glVao);
  glVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, glVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(glProg, 'a_pos');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  palTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, palTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, MC, ML);

  const unames = ['u_res','u_cell','u_nlayer','u_cosLA','u_sinLA','u_ncols',
    'u_cosR','u_sinR','u_cosRH','u_sinRH','u_freq2pi','u_ampWM','u_phase','u_bayer','u_pal'];
  for (const n of unames) glU[n] = gl.getUniformLocation(glProg, n);
  gl.uniform1i(glU.u_pal, 0);

  const BAYER = window.BAYER8;
  bayerFlat = new Float32Array(64);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) bayerFlat[i * 8 + j] = BAYER[i][j];
  gl.uniform1fv(glU.u_bayer, bayerFlat);

  let restoreAttempts = 0;
  tc.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    contextLost = true;
  }, false);
  tc.addEventListener('webglcontextrestored', () => {
    restoreAttempts++;
    if (restoreAttempts > 2) { _giveUp = true; contextLost = true; return; }
    glProg = null; glVao = null; glVbo = null; palTex = null; glU = {};
    cw = 0; ch = 0;
    try {
      reinitAfterContextLoss();
      contextLost = false;
      for (const cb of restoreCallbacks) cb();
    } catch (e) {
      contextLost = true;
    }
  }, false);

  return true;
};

function reinitAfterContextLoss() {
  const ctxGL = tc.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: true });
  if (!ctxGL) throw new Error('context restore failed');
  gl = ctxGL;

  const vsSrc = `#version 300 es
in vec2 a_pos;
void main(){ gl_Position=vec4(a_pos,0.0,1.0); }`;
  const fsSrc = `#version 300 es
precision highp float;
uniform vec2 u_res;uniform float u_cell;uniform int u_nlayer;
uniform float u_cosLA[8];uniform float u_sinLA[8];uniform float u_ncols[8];
uniform float u_cosR[40];uniform float u_sinR[40];uniform float u_cosRH[40];uniform float u_sinRH[40];
uniform float u_freq2pi[40];uniform float u_ampWM[40];uniform float u_phase[40];
uniform sampler2D u_pal;uniform float u_bayer[64];
out vec4 outColor;
void main(){
vec2 cc=floor(gl_FragCoord.xy/u_cell);
vec2 uv=(cc*u_cell+u_cell*0.5)/u_res;
int bi=int(mod(cc.y,8.0))*8+int(mod(cc.x,8.0));
float bayer_val=u_bayer[bi]/64.0;
vec3 acc=vec3(0.0);
for(int li=0;li<8;li++){
if(li>=u_nlayer)break;
vec2 wuv=uv;
int wbase=li*5;
for(int wi=0;wi<5;wi++){
int widx=wbase+wi;
float f2=u_freq2pi[widx];
if(f2==0.0)break;
float proj=uv.x*u_cosR[widx]+uv.y*u_sinR[widx];
float off=sin(proj*f2+u_phase[widx])*u_ampWM[widx];
wuv+=off*vec2(u_cosRH[widx],u_sinRH[widx]);
}
float ru=(wuv.x-0.5)*u_cosLA[li]-(wuv.y-0.5)*u_sinLA[li]+0.5;
float pos=clamp(ru,0.0,1.0);
float nc=u_ncols[li];
float t=pos*(nc-1.0);
int ci=int(t);
float fr=t-float(ci);
vec4 c1=texelFetch(u_pal,ivec2(ci,li),0);
int ci2=min(ci+1,int(nc)-1);
vec4 c2=texelFetch(u_pal,ivec2(ci2,li),0);
acc+=(fr>=bayer_val)?c2.rgb:c1.rgb;
}
acc/=float(u_nlayer);
outColor=vec4(acc,1.0);
}`;

  const vs = gl.createShader(gl.VERTEX_SHADER);
  gl.shaderSource(vs, vsSrc); gl.compileShader(vs);
  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) throw new Error('VS: ' + gl.getShaderInfoLog(vs));
  const fs = gl.createShader(gl.FRAGMENT_SHADER);
  gl.shaderSource(fs, fsSrc); gl.compileShader(fs);
  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) throw new Error('FS: ' + gl.getShaderInfoLog(fs));
  glProg = gl.createProgram();
  gl.attachShader(glProg, vs); gl.attachShader(glProg, fs);
  gl.linkProgram(glProg);
  if (!gl.getProgramParameter(glProg, gl.LINK_STATUS)) throw new Error('LINK: ' + gl.getProgramInfoLog(glProg));
  gl.useProgram(glProg);

  glVao = gl.createVertexArray();
  gl.bindVertexArray(glVao);
  glVbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, glVbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
  const aLoc = gl.getAttribLocation(glProg, 'a_pos');
  gl.enableVertexAttribArray(aLoc);
  gl.vertexAttribPointer(aLoc, 2, gl.FLOAT, false, 0, 0);
  gl.bindVertexArray(null);

  palTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, palTex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, MC, ML);

  const unames = ['u_res','u_cell','u_nlayer','u_cosLA','u_sinLA','u_ncols',
    'u_cosR','u_sinR','u_cosRH','u_sinRH','u_freq2pi','u_ampWM','u_phase','u_bayer','u_pal'];
  for (const n of unames) glU[n] = gl.getUniformLocation(glProg, n);
  gl.uniform1i(glU.u_pal, 0);
  gl.uniform1fv(glU.u_bayer, bayerFlat);
  cw = 0; ch = 0;
}

window.renderWebGL = function(canvas, ctx, wrap, config, state, animTime) {
  if (_giveUp) throw new Error('WebGL gave up');
  if (contextLost) throw new Error('WebGL context lost');
  if (!gl) throw new Error('WebGL not initialized');
  if (gl.isContextLost && gl.isContextLost()) throw new Error('WebGL context lost');

  const w = wrap.clientWidth | 0;
  const h = wrap.clientHeight | 0;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const targetCw = Math.max(1, Math.floor(w * dpr));
  const targetCh = Math.max(1, Math.floor(h * dpr));

  if (targetCw !== cw || targetCh !== ch) {
    gl.canvas.width = targetCw;
    gl.canvas.height = targetCh;
    gl.viewport(0, 0, targetCw, targetCh);
    gl.useProgram(glProg);
    gl.bindVertexArray(glVao);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, palTex);
    gl.uniform1i(glU.u_pal, 0);
    gl.uniform1fv(glU.u_bayer, bayerFlat);
    cw = targetCw; ch = targetCh;
  }

  gl.useProgram(glProg);
  gl.bindVertexArray(glVao);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, palTex);

  gl.uniform2f(glU.u_res, targetCw, targetCh);
  gl.uniform1f(glU.u_cell, state.cellSize.val);

  const layers = config.layers;
  const nL = layers.length;
  const wm = state.warp.val / 100;
  const po = state.animOn ? animTime * (state.animDepth.val / 100) : 0;
  const dg = Math.PI / 180, hp = Math.PI * 0.5;

  const cosLA = new Float32Array(ML), sinLA = new Float32Array(ML), ncols = new Float32Array(ML);
  const cosR = new Float32Array(ML * MW), sinR = new Float32Array(ML * MW);
  const cosRH = new Float32Array(ML * MW), sinRH = new Float32Array(ML * MW);
  const freq2pi = new Float32Array(ML * MW), ampWM = new Float32Array(ML * MW), phase = new Float32Array(ML * MW);
  const palData = new Uint8Array(ML * MC * 4);

  for (let li = 0; li < nL; li++) {
    const l = layers[li];
    cosLA[li] = Math.cos(l.angle * dg);
    sinLA[li] = Math.sin(l.angle * dg);
    ncols[li] = l.colors.length;
    for (let ci = 0; ci < l.colors.length; ci++) {
      const c = l.colors[ci];
      const o = (li * MC + ci) * 4;
      palData[o] = c[0]; palData[o + 1] = c[1]; palData[o + 2] = c[2]; palData[o + 3] = 255;
    }
    for (let wi = 0; wi < l.warpWaves.length; wi++) {
      const w = l.warpWaves[wi];
      const rd = w.angle * dg;
      const i = li * MW + wi;
      cosR[i] = Math.cos(rd);
      sinR[i] = Math.sin(rd);
      cosRH[i] = Math.cos(rd + hp);
      sinRH[i] = Math.sin(rd + hp);
      freq2pi[i] = w.freq * Math.PI * 2;
      ampWM[i] = w.amp * wm;
      phase[i] = w.phase + po * w.freq;
    }
  }

  gl.uniform1fv(glU.u_cosLA, cosLA);
  gl.uniform1fv(glU.u_sinLA, sinLA);
  gl.uniform1fv(glU.u_ncols, ncols);
  gl.uniform1fv(glU.u_cosR, cosR);
  gl.uniform1fv(glU.u_sinR, sinR);
  gl.uniform1fv(glU.u_cosRH, cosRH);
  gl.uniform1fv(glU.u_sinRH, sinRH);
  gl.uniform1fv(glU.u_freq2pi, freq2pi);
  gl.uniform1fv(glU.u_ampWM, ampWM);
  gl.uniform1fv(glU.u_phase, phase);
  gl.uniform1i(glU.u_nlayer, nL);
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, MC, ML, gl.RGBA, gl.UNSIGNED_BYTE, palData);

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

  canvas.width = targetCw;
  canvas.height = targetCh;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(gl.canvas, 0, 0, w, h);
};

})();
