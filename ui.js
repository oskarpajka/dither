// ui.js - small UI helpers
window.makeCheckbox = function(checked, text) {
  const lbl = document.createElement('label');
  lbl.className = 'man-chk';
  const chk = document.createElement('input');
  chk.type = 'checkbox';
  chk.checked = checked;
  const box = document.createElement('span');
  box.className = 'chk-box';
  const tick = document.createElement('span');
  tick.className = 'chk-tick';
  box.appendChild(tick);
  lbl.appendChild(chk);
  lbl.appendChild(box);
  if (text) lbl.appendChild(document.createTextNode(text));
  return { lbl, chk };
};
