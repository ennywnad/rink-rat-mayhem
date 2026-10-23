// Rink Rat Mayhem · Input: remappable bindings, controllers, touch, one or two players, controls strip and remap screen
'use strict';
// ---------------- input
// ---------------- input: remappable bindings, any number of controllers, one or two players
const keys = new Set();
let JR = 46;
const joy = { id:null, bx:0, by:0, x:0, y:0 };
const ACTIONS = [['up','Skate up'],['down','Skate down'],['left','Skate left'],['right','Skate right'],['stUp','Stick forward'],['stDown','Stick back'],['stLeft','Stick left'],['stRight','Stick right'],['shoot','Shoot (hold) · check'],['pass','Pass · switch player'],['power','Power-up'],['deke','Deke']];
const PAD_ACTIONS = ['shoot', 'pass', 'power', 'deke'];
const BIND_PROFILES = [['kb','Keyboard'],['kb1','Shared keyboard · P1'],['kb2','Shared keyboard · P2'],['pad','Controller']];
const DEF_BINDS = {
  kb:  { up:['KeyW','ArrowUp'], down:['KeyS','ArrowDown'], left:['KeyA','ArrowLeft'], right:['KeyD','ArrowRight'], stUp:['KeyI'], stDown:['KeyK'], stLeft:['KeyJ'], stRight:['KeyL'], shoot:['Space'], pass:['ShiftLeft','ShiftRight'], power:['KeyE','KeyC'], deke:['KeyQ'] },
  kb1: { up:['KeyW'], down:['KeyS'], left:['KeyA'], right:['KeyD'], stUp:[], stDown:[], stLeft:[], stRight:[], shoot:['KeyF','Space'], pass:['KeyG'], power:['KeyR'], deke:['KeyQ'] },
  kb2: { up:['ArrowUp'], down:['ArrowDown'], left:['ArrowLeft'], right:['ArrowRight'], stUp:[], stDown:[], stLeft:[], stRight:[], shoot:['Slash','Numpad0'], pass:['Period','NumpadDecimal'], power:['Comma','NumpadEnter'], deke:['Semicolon'] },
  pad: { shoot:[0,7], pass:[2,4,6], power:[1,5], deke:[3,11] },
};
let binds = JSON.parse(JSON.stringify(DEF_BINDS));
try { const b = JSON.parse(localStorage.getItem('rinkrat-binds') || 'null'); if (b) for (const p in DEF_BINDS) if (b[p]) for (const a in DEF_BINDS[p]) if (Array.isArray(b[p][a])) binds[p][a] = b[p][a]; } catch(e) {}
const saveBinds = () => { try { localStorage.setItem('rinkrat-binds', JSON.stringify(binds)); } catch(e) {} };
const FIXED_KEYS = ['KeyP', 'Escape', 'KeyM', 'Backquote'];
let capture = null;   // { profile, action } while the remap screen waits for a key or button

// controllers
const pads = new Map();   // gamepad index -> { g, prev, axes, raxes, name }
let padBlocked = false;
function padList(){ return [...pads.values()].sort((a, b) => a.g.index - b.g.index); }
// which devices drive which player
function humans(){ return G && !G.attract && (G.mode === 'coop' || G.mode === 'vs') ? 2 : 1; }
function devicesFor(p){
  const list = padList(), n = humans();
  if (n === 1) return { kb:'kb', pads:list, touch:true };
  if (list.length >= 2) return p === 0 ? { kb:'kb', pads:[list[0]], touch:true } : { kb:null, pads:list.slice(1, 2) };
  if (list.length === 1) return p === 0 ? { kb:'kb', pads:[], touch:true } : { kb:null, pads:[list[0]] };
  return p === 0 ? { kb:'kb1', pads:[], touch:true } : { kb:'kb2', pads:[] };
}
function deviceLabel(p){
  const d = devicesFor(p);
  if (d.pads.length) return d.kb ? `Keyboard + ${padName(d.pads[0])}` : padName(d.pads[0]);
  return d.kb === 'kb1' ? 'Left side of keyboard' : d.kb === 'kb2' ? 'Right side of keyboard' : 'Keyboard';
}
function padName(ps){ return padLabels(ps).name; }
const held = (prof, a) => !!prof && (binds[prof][a] || []).some(c => keys.has(c));
function orient(v){
  const R3 = window.__r3d;
  if (R3 && R3.active && R3.basis && (v[0] || v[1])) { const b = R3.basis, m0 = hyp(v[0], v[1]); let x = v[0]*b.rx + (-v[1])*b.fx, y = v[0]*b.ry + (-v[1])*b.fy; const m = hyp(x, y); if (m > 1e-6) { x *= m0/m; y *= m0/m; } return [x, y]; }
  return v;
}
function readInputRaw(p = 0){
  const d = devicesFor(p);
  if (d.touch && joy.id !== null) {
    let dx = (joy.x - joy.bx)/JR, dy = (joy.y - joy.by)/JR; const m = hyp(dx, dy);
    if (m < 0.12) return [0,0]; if (m > 1) { dx /= m; dy /= m; } return [dx, dy];
  }
  for (const ps of d.pads) if (ps.axes[0] || ps.axes[1]) return ps.axes;
  const x = (held(d.kb, 'right')?1:0) - (held(d.kb, 'left')?1:0), y = (held(d.kb, 'down')?1:0) - (held(d.kb, 'up')?1:0);
  const m = hyp(x, y); return m ? [x/m, y/m] : [0,0];
}
function readInput(p = 0){ return orient(readInputRaw(p)); }
function readSkill(p = 0){
  const d = devicesFor(p);
  for (const ps of d.pads) if (ps.raxes[0] || ps.raxes[1]) return orient(ps.raxes);
  const x = (held(d.kb, 'stRight')?1:0) - (held(d.kb, 'stLeft')?1:0), y = (held(d.kb, 'stDown')?1:0) - (held(d.kb, 'stUp')?1:0), m = hyp(x, y);
  return m ? orient([x/m, y/m]) : [0, 0];
}
// players and their skaters (P1 is always G.ctrl; P2 is G.ctrl2)
const humanSk = p => !G ? null : p === 0 ? ctrlSk() : (G.ctrl2 >= 0 ? G.sk[G.ctrl2] : null);
const humanTeam = p => p === 0 ? 'home' : (G && G.mode === 'vs' ? 'away' : 'home');
function humanOf(s){ if (!G || G.attract || !s) return -1; if (s === ctrlSk()) return 0; if (humans() > 1 && s === humanSk(1)) return 1; return -1; }
const isHuman = s => humanOf(s) >= 0;
const teamHasHuman = tm => !!G && !G.attract && (tm === 'home' || (G.mode === 'vs' && tm === 'away'));
function setHuman(p, s){ if (!s) return; const i = G.sk.indexOf(s); if (p === 0) G.ctrl = i; else G.ctrl2 = i; }
const playing = () => G && !G.attract && !paused && (G.state === 'play' || G.state === 'faceoff' || G.state === 'goal' || G.state === 'reset' || G.state === 'regroup');
function pressShoot(p = 0){
  if (G && G.replay) { endReplay(); return; }
  if (!playing() || G.state !== 'play') return;
  const s = humanSk(p); if (!s || s.ko > 0) return;
  const P = G.pucks[0];
  if (P.owner === s) { s.charging = true; s.charge = 0; }
  else if (P.passTo === s && !P.owner) armOneTimer(s);
  else { const [ix, iy] = readInput(p); lunge(s, (ix||iy) ? Math.atan2(iy, ix) : s.face); }
}
function releaseShoot(p = 0){
  const s = humanSk(p); if (!s) return;
  if (s.charging) { if (G.pucks[0].owner === s) shoot(s, s.charge, skillAim(s)); s.charging = false; }
}
function pressPass(p = 0){
  if (G && G.replay) { endReplay(); return; }
  if (!playing() || G.state !== 'play') return;
  const s = humanSk(p); if (!s) return;
  if (G.pucks[0].owner === s) { const [ix, iy] = readInput(p); passPuck(s, (ix||iy) ? Math.atan2(iy, ix) : null); }
  else autoSwitch(true, p);
}
function pressPower(p = 0){ if (!playing()) return; const s = humanSk(p); if (s) usePower(humanTeam(p), s); }
function pressDeke(p = 0){ if (!playing() || G.state !== 'play') return; const s = humanSk(p); if (s) startDeke(s, readSkill(p)); }
function autoSwitch(force, p = 0){
  if (!G || G.attract) return;
  const P = G.pucks[0], cur = humanSk(p), tm = humanTeam(p), mate = humans() > 1 ? humanSk(1 - p) : null;
  const cands = G.sk.filter(s => s.team === tm && s.ko <= 0 && s !== cur && s !== mate);
  if (!cands.length) return;
  cands.sort((a,b) => hyp(a.x-P.x, a.y-P.y) - hyp(b.x-P.x, b.y-P.y));
  const best = cands[0];
  if (force || !cur || cur.ko > 0 || hyp(best.x-P.x, best.y-P.y) < hyp(cur.x-P.x, cur.y-P.y)*0.55) {
    if (cur) cur.charging = false;
    setHuman(p, best); if (p === 0) G.switchCd = 1.0; else G.switchCd2 = 1.0;
  }
}
cv.addEventListener('pointerdown', e => {
  ensureAudio();
  if (!playing()) return;
  const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
  if (x < r.width*0.62 && joy.id === null) { joy.id = e.pointerId; joy.bx = joy.x = x; joy.by = joy.y = y; try { cv.setPointerCapture(e.pointerId); } catch(err) {} }
  e.preventDefault();
});
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  const r = cv.getBoundingClientRect(); joy.x = e.clientX - r.left; joy.y = e.clientY - r.top;
  const dx = joy.x-joy.bx, dy = joy.y-joy.by, m = hyp(dx, dy), lim = JR*1.35;
  if (m > lim) { joy.bx = joy.x - dx/m*lim; joy.by = joy.y - dy/m*lim; }
});
const endJoy = e => { if (e.pointerId === joy.id) joy.id = null; };
cv.addEventListener('pointerup', endJoy); cv.addEventListener('pointercancel', endJoy);
cv.addEventListener('contextmenu', e => e.preventDefault());
function holdBtn(el, down, up){
  el.addEventListener('pointerdown', e => { ensureAudio(); e.preventDefault(); el.classList.add('on'); try { el.setPointerCapture(e.pointerId); } catch(err) {} down(); });
  const end = () => { if (!el.classList.contains('on')) return; el.classList.remove('on'); if (up) up(); };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end); el.addEventListener('lostpointercapture', end);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
holdBtn($('bShoot'), () => pressShoot(0), () => releaseShoot(0));
holdBtn($('bPass'), () => pressPass(0));
holdBtn($('bPower'), () => pressPower(0));
window.addEventListener('keydown', e => {
  if (capture && capture.profile !== 'pad') { e.preventDefault(); if (e.code !== 'Escape') bindCaptured(e.code); else endCapture(); return; }
  if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) && e.target.type !== 'range') return;
  const inGame = G && !G.attract && G.state !== 'end';
  if (e.code === 'Backquote' && !e.repeat) { toggleTune(); return; }
  if (e.code === 'KeyM' && !e.repeat) { setMuted(!muted); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (inGame && !paused) setPaused(true); else if (paused) setPaused(false); return; }
  if (!inGame || paused) return;
  let used = false;
  for (let p = 0; p < humans(); p++) {
    const kb = devicesFor(p).kb; if (!kb) continue;
    const B = binds[kb], has = a => (B[a] || []).includes(e.code);
    if (ACTIONS.some(([a]) => has(a))) used = true;
    if (e.repeat) continue;
    if (has('shoot')) { ensureAudio(); pressShoot(p); }
    if (has('pass')) pressPass(p);
    if (has('power')) pressPower(p);
    if (has('deke')) pressDeke(p);
  }
  if (used || ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener('keyup', e => {
  keys.delete(e.code);
  if (!G || G.attract) return;
  for (let p = 0; p < humans(); p++) { const kb = devicesFor(p).kb; if (kb && (binds[kb].shoot || []).includes(e.code)) releaseShoot(p); }
});
window.addEventListener('blur', () => { keys.clear(); releaseShoot(0); if (humans() > 1) releaseShoot(1); });

// ---------------- gamepads (standard mapping: Xbox, PlayStation, Switch Pro)
function scanPads(){
  if (padBlocked || !navigator.getGamepads) return [];
  let list; try { list = navigator.getGamepads(); } catch(e) { padBlocked = true; return []; }
  return [...(list || [])].filter(g => g && g.connected && g.buttons && g.buttons.length >= 10);
}
function rumble(strong, weak, ms, p = 0){
  for (const ps of devicesFor(p).pads) {
    const a = ps.g && ps.g.vibrationActuator; if (!a || !a.playEffect) continue;
    try { const r = a.playEffect('dual-rumble', { duration:ms, strongMagnitude:Math.max(0, Math.min(1, strong)), weakMagnitude:Math.max(0, Math.min(1, weak)) }); if (r && r.catch) r.catch(() => {}); } catch(e) {}
  }
}
const rumbleSk = (s, strong, weak, ms) => { const p = humanOf(s); if (p >= 0) rumble(strong, weak, ms, p); };
function padConfirm(){
  const vis = id => $(id) && !$(id).hidden;
  if (vis('ctrls')) return;
  if (vis('pause')) return setPaused(false);
  if (vis('brief')) return $('btnGo').click();
  if (vis('results')) return ($('resNext') || $('resRetry')).click();
  if (vis('kit')) return $('kitDone').click();
  if (vis('prac')) return $('pracGo').click();
  if (vis('hub')) { const c = document.querySelector('.chal.next') || document.querySelector('.chal[data-i]:not(:disabled)'); if (c) c.click(); }
}
function padBack(){
  const vis = id => $(id) && !$(id).hidden;
  if (vis('ctrls')) return $('ctrlsDone').click();
  if (vis('brief')) return $('btnBack').click();
  if (vis('kit')) return $('kitDone').click();
  if (vis('results')) return $('resHub').click();
  if (vis('prac')) return $('pracBack').click();
  if (vis('pause')) return setPaused(false);
}
function pollPad(){
  const found = scanPads(), seen = new Set();
  let changed = false;
  for (const g of found) {
    seen.add(g.index);
    let ps = pads.get(g.index);
    if (!ps || ps.name !== g.id) { ps = { g, prev:[], axes:[0,0], raxes:[0,0], name:g.id }; pads.set(g.index, ps); changed = true; }
    ps.g = g;
    const now = g.buttons.map(b => !!b && (b.pressed || b.value > 0.5));
    ps.now = now;
    let x = g.axes[0] || 0, y = g.axes[1] || 0; const m = hyp(x, y);
    if (m < 0.2) { x = 0; y = 0; } else { const k = Math.min(1, (m - 0.2)/0.75)/m; x *= k; y *= k; }
    const dx = (now[15] ? 1 : 0) - (now[14] ? 1 : 0), dy = (now[13] ? 1 : 0) - (now[12] ? 1 : 0);
    if (dx || dy) { const mm = hyp(dx, dy); x = dx/mm; y = dy/mm; }
    ps.axes = [x, y];
    let rx = g.axes[2] || 0, ry = g.axes[3] || 0; const rm = hyp(rx, ry);
    if (rm < 0.2) { rx = 0; ry = 0; } else { const k = Math.min(1, (rm - 0.2)/0.7)/rm; rx *= k; ry *= k; }
    ps.raxes = [rx, ry];
  }
  for (const k of [...pads.keys()]) if (!seen.has(k)) { pads.delete(k); changed = true; }
  if (changed) setTimeout(refreshPadNote, 0);
  const inGame = G && !G.attract && G.state !== 'end' && $('results').hidden;
  for (const ps of pads.values()) {
    const now = ps.now, down = i => now[i] && !ps.prev[i];
    if (capture && capture.profile === 'pad') { const i = now.findIndex((b, i) => b && !ps.prev[i] && i !== 8 && i !== 9 && (i < 12 || i > 15)); if (i >= 0) bindCaptured(i); ps.prev = now; continue; }
    if (down(9) || down(8)) { if (inGame && !paused) setPaused(true); else if (paused) setPaused(false); }
    let p = -1; for (let q = 0; q < humans(); q++) if (devicesFor(q).pads.includes(ps)) p = q;
    if (inGame && !paused && p >= 0) {
      const B = binds.pad, on = a => (B[a] || []).some(i => now[i]), was = a => (B[a] || []).some(i => ps.prev[i]), hit = a => on(a) && !was(a);
      if (hit('shoot')) { ensureAudio(); pressShoot(p); }
      if (!on('shoot') && was('shoot')) releaseShoot(p);
      if (hit('pass')) pressPass(p);
      if (hit('power')) pressPower(p);
      if (hit('deke')) pressDeke(p);
    } else if (!inGame || paused) {
      if (down(0)) { ensureAudio(); padConfirm(); }
      if (down(1)) padBack();
    }
    ps.prev = now;
  }
}
function padNoteText(){
  if (padBlocked) return 'Controllers are blocked in this view. Open the game in its own browser tab to use one.';
  const n = pads.size;
  if (n >= 2) return `${n} controllers connected: two-player co-op and versus are ready. Left stick skates, right stick handles the stick (pull back and flick to shoot), and the buttons can be changed under Controls.`;
  if (n === 1) return 'Controller connected. Left stick skates · right stick moves your stick (dangle, poke, pull back and flick to shoot) · buttons can be changed under Controls. Connect a second controller, or use the keyboard, for two players.';
  return 'Got a controller? Connect it and press any button. Two players can share one keyboard, a keyboard and a controller, or two controllers.';
}
function refreshPadNote(){ const el = $('padNote'); if (el) el.textContent = padNoteText(); renderCtrlBar(); if (pads.size && G && !G.attract) toast('Controller', `${pads.size} connected`, 1400, 'small'); }

// ---------------- names for keys and buttons
const KEY_NAMES = { Space:'Space', ShiftLeft:'L Shift', ShiftRight:'R Shift', ControlLeft:'L Ctrl', ControlRight:'R Ctrl', AltLeft:'L Alt', AltRight:'R Alt', MetaLeft:'⌘', MetaRight:'R ⌘', Enter:'Enter', Tab:'Tab', Backspace:'⌫', CapsLock:'Caps',
  ArrowUp:'↑', ArrowDown:'↓', ArrowLeft:'←', ArrowRight:'→', Slash:'/', Period:'.', Comma:',', Semicolon:';', Quote:"'", BracketLeft:'[', BracketRight:']', Backslash:'\\', Minus:'-', Equal:'=', NumpadEnter:'Num Enter', NumpadDecimal:'Num .' };
function keyName(c){ if (KEY_NAMES[c]) return KEY_NAMES[c]; if (/^Key/.test(c)) return c.slice(3); if (/^Digit/.test(c)) return c.slice(5); if (/^Numpad/.test(c)) return 'Num ' + c.slice(6); return c; }
function padLabels(ps){
  const id = ((ps || padList()[0] || {}).name || '').toLowerCase();
  const F = (t, bg, fg = '#fff') => ({ t, bg, fg, face:true }), S = (t, trig) => ({ t, trig:!!trig });
  let fam = 'xbox';
  if (/054c|dualsense|dualshock|playstation/.test(id)) fam = 'ps'; else if (/057e|pro controller|joy-con|nintendo/.test(id)) fam = 'ns';
  const names = {
    xbox:[F('A','#3fae49'), F('B','#e0453c'), F('X','#2f7de1'), F('Y','#e6b422','#1a1a1a'), S('LB'), S('RB'), S('LT',1), S('RT',1), S('View'), S('☰ Menu'), S('L3'), S('R3')],
    ps:[F('✕','#1d1f26','#7fa7ff'), F('○','#1d1f26','#ff6b6b'), F('□','#1d1f26','#f08fd3'), F('△','#1d1f26','#4fd6b6'), S('L1'), S('R1'), S('L2',1), S('R2',1), S('Share'), S('Options'), S('L3'), S('R3')],
    ns:[F('B','#2a2c33'), F('A','#2a2c33'), F('Y','#2a2c33'), F('X','#2a2c33'), S('L'), S('R'), S('ZL',1), S('ZR',1), S('−'), S('+'), S('L3'), S('R3')],
  }[fam];
  return { name: fam === 'ps' ? 'PlayStation controller' : fam === 'ns' ? 'Switch controller' : 'Xbox controller', btn: i => names[i] || S('B' + i),
    stick:S('L stick'), rstick:S('R stick'), dpad:S('D-pad'), start:names[9] };
}
// ---------------- controls strip (toggled from the scoreboard)
let ctrlBarOn = true;
try { ctrlBarOn = localStorage.getItem('rinkrat-ctrlbar') !== '0'; } catch(e) {}
function ctrlItems(){
  const kbKeys = (prof, a) => (binds[prof][a] || []).map(keyName);
  if (G && !G.attract && humans() > 1) {
    const items = [];
    for (let p = 0; p < 2; p++) {
      const d = devicesFor(p), tag = `P${p+1}`;
      if (d.pads.length) { const L = padLabels(d.pads[0]); items.push([[L.stick], `${tag} skate`], [binds.pad.shoot.slice(0, 1).map(L.btn), 'shoot'], [binds.pad.pass.slice(0, 1).map(L.btn), 'pass'], [binds.pad.deke.slice(0, 1).map(L.btn), 'deke']); }
      else { const k = d.kb; items.push([[['up','left','down','right'].map(a => kbKeys(k, a)[0]).join('')], `${tag} skate`], [kbKeys(k, 'shoot').slice(0, 1), 'shoot'], [kbKeys(k, 'pass').slice(0, 1), 'pass'], [kbKeys(k, 'deke').slice(0, 1), 'deke']); }
    }
    return { src:'Two players', items };
  }
  const pl = padList();
  if (pl.length) { const L = padLabels(pl[0]), b = a => binds.pad[a].slice(0, 2).map(L.btn); return { src:L.name, items:[[[L.stick, L.dpad], 'Skate'], [[L.rstick], 'Stickhandle · pull back, flick to shoot'], [b('shoot'), 'Shoot (hold) · check'], [b('pass'), 'Pass · switch'], [b('deke'), 'Deke'], [b('power'), 'Power-up'], [[L.start], 'Pause']] }; }
  if (matchMedia('(pointer:coarse)').matches) return { src:'Touch', items:[[['Left side'], 'Drag to skate'], [['Shoot'], 'Hold · tap to check'], [['Pass'], 'Pass · switch'], [['Power'], 'Power-up']] };
  const k = a => kbKeys('kb', a).slice(0, 2);
  const mv = ['up','left','down','right'].map(a => kbKeys('kb', a)[0]).join('');
  return { src:'Keyboard', items:[[[mv], 'Skate'], [[['stUp','stLeft','stDown','stRight'].map(a => kbKeys('kb', a)[0] || '').join('')], 'Stickhandle · pull back, flick to shoot'], [k('shoot'), 'Shoot (hold) · check'], [k('pass'), 'Pass · switch'], [k('deke'), 'Deke'], [k('power'), 'Power-up'], [['P'], 'Pause'], [['M'], 'Mute'], [['`'], 'Tuning']] };
}
function keyHtml(k){
  if (typeof k === 'string') return `<kbd>${k}</kbd>`;
  if (k.face) return `<kbd class="face" style="background:${k.bg};color:${k.fg}">${k.t}</kbd>`;
  return `<kbd class="${k.trig ? 'trig' : ''}">${k.t}</kbd>`;
}
function renderCtrlBar(){
  const bar = $('ctrlBar'), btn = $('btnCtrls'); if (!bar || !btn) return;
  bar.hidden = !ctrlBarOn;
  btn.setAttribute('aria-pressed', String(ctrlBarOn)); btn.setAttribute('aria-label', ctrlBarOn ? 'Hide controls' : 'Show controls'); btn.title = ctrlBarOn ? 'Hide controls' : 'Show controls';
  if (!ctrlBarOn) return;
  const { src, items } = ctrlItems();
  bar.innerHTML = `<span class="ck src">${src.toUpperCase()}</span>` + items.filter(([ks]) => ks.length && ks[0] !== '').map(([keys, label]) => `<span class="ck">${keys.map(keyHtml).join('<span class="or">/</span>')}<span class="lbl">${label}</span></span>`).join('');
}

// ---------------- remap screen
let ctrlsTab = 'kb', ctrlsFrom = 'hub';
function openControls(from){ ctrlsFrom = from || 'hub'; ctrlsTab = padList().length ? 'pad' : 'kb'; renderControls(); show('ctrls'); }
function renderControls(){
  const prof = ctrlsTab, isPad = prof === 'pad', L = padLabels();
  const acts = isPad ? ACTIONS.filter(([a]) => PAD_ACTIONS.includes(a)) : ACTIONS;
  const chip = (v, a, i) => `<span class="bchip">${isPad ? keyHtml(L.btn(v)) : `<kbd>${keyName(v)}</kbd>`}<button type="button" class="bx" data-a="${a}" data-i="${i}" aria-label="Remove">×</button></span>`;
  $('ctrlsWrap').innerHTML = `
    <div class="sticky"><div style="display:flex;flex-direction:column;gap:6px"><h2 class="h">Controls</h2><span class="slots">CLICK CHANGE, THEN PRESS A ${isPad ? 'BUTTON' : 'KEY'}</span></div><button class="btn small" id="ctrlsDoneTop" type="button">Done</button></div>
    <div class="seg" id="ctrlsTabs">${BIND_PROFILES.map(([k, l]) => `<button type="button" data-p="${k}" aria-pressed="${k === prof}">${l}</button>`).join('')}</div>
    <p class="gfxnote">${isPad ? 'Sticks are fixed: left skates, right moves your stick. The D-pad also skates. Start pauses.' : prof === 'kb' ? 'Used when you play alone, or as player 1 when player 2 has a controller.' : prof === 'kb1' ? 'Player 1 when two people share one keyboard.' : 'Player 2 when two people share one keyboard.'} P / Esc pause, M mutes and \` opens tuning on every keyboard.</p>
    <div class="card bindlist">${acts.map(([a, label]) => `<div class="brow${capture && capture.profile === prof && capture.action === a ? ' cap' : ''}"><span class="bl">${label}</span><span class="bv">${capture && capture.profile === prof && capture.action === a ? `<em>Press a ${isPad ? 'button' : 'key'}… (${isPad ? 'Start' : 'Esc'} cancels)</em>` : ((binds[prof][a] || []).map((v, i) => chip(v, a, i)).join('') || '<em>none</em>')}</span><button class="btn ghost small" type="button" data-change="${a}">Change</button></div>`).join('')}</div>
    <div class="btns"><button class="btn ghost" id="ctrlsReset" type="button">Reset ${BIND_PROFILES.find(p => p[0] === prof)[1]}</button><button class="btn" id="ctrlsDone" type="button">Done</button></div>`;
  $('ctrlsWrap').querySelectorAll('#ctrlsTabs button').forEach(b => b.onclick = () => { endCapture(true); ctrlsTab = b.dataset.p; renderControls(); });
  $('ctrlsWrap').querySelectorAll('[data-change]').forEach(b => b.onclick = () => { capture = { profile:prof, action:b.dataset.change }; renderControls(); });
  $('ctrlsWrap').querySelectorAll('.bx').forEach(b => b.onclick = () => { binds[prof][b.dataset.a].splice(Number(b.dataset.i), 1); saveBinds(); renderControls(); renderCtrlBar(); });
  $('ctrlsReset').onclick = () => { binds[prof] = JSON.parse(JSON.stringify(DEF_BINDS[prof])); saveBinds(); endCapture(true); renderControls(); renderCtrlBar(); };
  const done = () => { endCapture(true); renderCtrlBar(); if (ctrlsFrom === 'pause' && G && !G.attract) { paused = true; preparePause(G.state === 'end'); show('pause'); } else { renderHub(); show('hub'); } };
  $('ctrlsDone').onclick = done; $('ctrlsDoneTop').onclick = done;
}
function bindCaptured(v){
  if (!capture) return;
  const { profile, action } = capture;
  if (profile !== 'pad' && FIXED_KEYS.includes(v)) { endCapture(); return; }
  for (const a in binds[profile]) binds[profile][a] = (binds[profile][a] || []).filter(x => x !== v);   // one action per key
  binds[profile][action] = [v, ...(binds[profile][action] || [])].slice(0, 2);
  saveBinds(); capture = null; renderControls(); renderCtrlBar();
}
function endCapture(silent){ capture = null; if (!silent && !$('ctrls').hidden) renderControls(); }

window.addEventListener('gamepadconnected', () => { pollPad(); });
window.addEventListener('gamepaddisconnected', () => { pollPad(); if (G && !G.attract && !paused && G.state !== 'end') setPaused(true); });
