// state.js - shared mutable state
window.state = {
  dark: false,
  cellSize: { val: 3, locked: false, min: 1, max: 15 },
  layers:   { val: 4, locked: false, min: 2, max: 8 },
  warp:     { val: 100, locked: false, min: 0, max: 250 },
  colors:   { val: 16, locked: false, min: 6, max: 30 },
  seed: 0,
  seedRandom: true,
  aspect: 'free',
  resW: 0,
  resH: 0,
  animOn: false,
  animSpeed: { val: 50, min: 1, max: 100 },
  animDepth: { val: 50, min: 0, max: 100 },
  animFps:  { val: 60, min: 1, max: 60 },
  loopDuration: { val: 0, min: 0, max: 60 },

  asciiCharset: 'standard',
  asciiCellSize: { val: 4, min: 1, max: 10 },
  asciiInvert: false,
  asciiBgColor: '#000000',
  asciiFgColor: '#ffffff',
  asciiFps: 30,
  asciiScaleMode: 'fit',
};

let _config = null;
window.setConfig = function(cfg) { _config = cfg; };
window.getConfig = function() { return _config; };
