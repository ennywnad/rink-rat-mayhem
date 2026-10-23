// Rink Rat Mayhem · HUD drawn over the 3D view, player badges, graphics settings and the bridge object the 3D renderer reads
'use strict';
// ---------------- 3D overlay (HUD bits drawn over the 3D view)
const hpDrain = new WeakMap();
function burstPath(c, r, spikes, jag, seed){
  c.beginPath();
  for (let i=0;i<spikes*2;i++){
    const a = i/(spikes*2)*Math.PI*2, rr = i%2 ? r*0.62 : r*(1 + (((seed*31 + i*17) % 7)/7 - 0.5)*jag);
    const x = Math.cos(a)*rr*1.35, y = Math.sin(a)*rr*0.82;
    i ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.closePath();
}
function comicPop(p, sx, sy){
  const k = p.life/p.max, sc = k > 0.85 ? 1 + (k - 0.85)*4 : 1, a = Math.min(1, k*2.5);
  const size = Math.round(p.size*sc*1.05), seed = p.text.length + Math.round(p.max*10);
  const tilt = ((seed % 5) - 2)*0.06;
  ctx.save(); ctx.globalAlpha = a; ctx.translate(sx, sy); ctx.rotate(tilt);
  ctx.font = `${size}px Bungee, "Arial Black", Impact, sans-serif`;
  const w = ctx.measureText(p.text).width, r = Math.max(size*1.1, w*0.62);
  const fill = /BODY|TINY|LOADED/.test(p.text) ? '#fff3a8' : p.color === '#ec3b4f' ? '#ff5a3c' : /GOT /.test(p.text) ? '#c9a4ff' : '#ffd23a';
  // offset halftone shadow
  ctx.save(); ctx.translate(5, 5); burstPath(ctx, r, 11, 0.5, seed); ctx.clip();
  ctx.fillStyle = 'rgba(21,14,28,.75)';
  for (let y=-r;y<r;y+=5) for (let x=-r*1.4;x<r*1.4;x+=5) { ctx.beginPath(); ctx.arc(x + ((y/5)%2 ? 2.5 : 0), y, 1.6, 0, 7); ctx.fill(); }
  ctx.restore();
  burstPath(ctx, r, 11, 0.5, seed);
  ctx.fillStyle = fill; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#150e1c'; ctx.lineJoin = 'miter'; ctx.stroke();
  burstPath(ctx, r*0.72, 11, 0.35, seed + 3); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 5; ctx.strokeStyle = '#150e1c'; ctx.strokeText(p.text, 0, 1);
  ctx.fillStyle = p.color === '#f1e7d0' ? '#150e1c' : '#ffffff'; if (fill === '#fff3a8') ctx.fillStyle = '#150e1c';
  ctx.fillText(p.text, 0, 1);
  ctx.restore();
}
function comicHp(s, sx, sy){
  const w = 34, h = 7, k = 5, hp = Math.max(0, s.hp)/100;
  let dr = hpDrain.get(s); if (dr == null || dr < hp) dr = hp; dr = Math.max(hp, dr - 0.012); hpDrain.set(s, dr);
  const x0 = sx - w/2, y0 = sy;
  const para = (x, ww) => { ctx.beginPath(); ctx.moveTo(x + k, y0); ctx.lineTo(x + ww + k, y0); ctx.lineTo(x + ww, y0 + h); ctx.lineTo(x, y0 + h); ctx.closePath(); };
  para(x0 - 2, w + 4); ctx.fillStyle = '#150e1c'; ctx.fill();
  para(x0, w*dr); ctx.fillStyle = '#ffffff'; ctx.fill();
  para(x0, w*hp); ctx.fillStyle = hpCol(hp); ctx.fill();
  ctx.strokeStyle = '#150e1c'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i=1;i<5;i++){ const x = x0 + w*i/5; ctx.moveTo(x + k, y0); ctx.lineTo(x, y0 + h); } ctx.stroke();
  para(x0 - 2, w + 4); ctx.lineWidth = 2.5; ctx.stroke();
}
let speedSeed = 0;
function speedLines(power){
  if (A11Y.rm) return;
  speedSeed++;
  const cx = cw/2, cy = ch/2, R = Math.hypot(cx, cy), n = 46;
  ctx.save(); ctx.lineCap = 'round';
  for (let i=0;i<n;i++){
    const a = i/n*Math.PI*2 + ((speedSeed*7 + i*13) % 11)*0.012, len = R*(0.12 + (((speedSeed*3 + i*29) % 17)/17)*0.22*power);
    const r0 = R*1.02, r1 = r0 - len;
    ctx.strokeStyle = i%3 ? 'rgba(21,14,28,.55)' : 'rgba(255,255,255,.6)'; ctx.lineWidth = i%3 ? 3 : 1.6;
    ctx.beginPath(); ctx.moveTo(cx + Math.cos(a)*r0, cy + Math.sin(a)*r0); ctx.lineTo(cx + Math.cos(a)*r1, cy + Math.sin(a)*r1); ctx.stroke();
  }
  ctx.restore();
}
function renderOverlay3D(R3){
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,cw,ch);
  if (!G) return;
  const cs = ctrlSk();
  if (cs && cs.ko <= 0 && !G.attract) {
    const power = cs.kaiju > 0 ? 1 : cs.rocket > 0 ? 0.85 : (cs.charging && cs.charge > 0.75) ? (cs.charge - 0.75)*4 : 0;
    if (power > 0) speedLines(power);
  }
  for (const s of G.sk) {
    if (s.ko > 0 || (s.hp >= 99.5 && s !== cs)) continue;
    const [sx, sy, ok] = R3.project(s.x, s.y, 8.6*(s.r/(s.baseR||SK_R))); if (!ok) continue;
    comicHp(s, sx, sy);
  }
  for (const p of G.pops) { const [sx, sy, ok] = R3.project(p.x, p.y, 7.5); if (ok) comicPop(p, sx, sy); }
  ctx.globalAlpha = 1;
  drawBadges((x, y, h) => R3.project(x, y, h), performance.now()/1000);
  drawReplayBanner(performance.now()/1000);
  for (let p = 0; p < humans(); p++) { const cs = humanSk(p); if (!cs || cs.ko > 0 || G.attract) continue;
    const [sx, sy] = R3.project(cs.x, cs.y, 0);
    if (sy < 8 || sy > ch - 8 || sx < 4 || sx > cw - 4) { const ex = clamp(sx, 16, cw - 16), ey = clamp(sy, 16, ch - 16), a = Math.atan2(sy - ey, sx - ex); ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = HUMAN_COL[p]; ctx.strokeStyle = '#150e1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); }
  }
  if (joy.id !== null) {
    let dx = joy.x - joy.bx, dy = joy.y - joy.by; const m = hyp(dx, dy); if (m > JR) { dx = dx/m*JR; dy = dy/m*JR; }
    ctx.strokeStyle = 'rgba(241,231,208,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.bx, joy.by, JR, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,181,30,.6)'; ctx.beginPath(); ctx.arc(joy.bx+dx, joy.by+dy, 20, 0, 7); ctx.fill();
  }
}
// ---------------- player badges: P1/P2 tags, the power-up a player is holding, and timer rings for active effects
const HUMAN_COL = ['#ffb51e', '#4fd6ff'];
const iconCache = {};
function iconImg(k, col){
  const key = k + col; if (iconCache[key]) return iconCache[key];
  const img = new Image();
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg(k).replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" ').replace(/currentColor/g, col));
  return (iconCache[key] = img);
}
setTimeout(() => { for (const k of Object.keys(ICON)) for (const c of ['#ffb51e', '#c9a4ff', '#ff8a3d', '#7ef0ff']) iconImg(k, c); }, 0);   // warm the icon cache
const EFFECTS = [['rocket', 'rocket', 3.2], ['magnet', 'magnet', 6], ['kaiju', 'kaiju', 6], ['frozen', 'freeze', 3]];
function badgesFor(s){
  const out = [], tm = s.team, hp = humanOf(s);
  if (hp >= 0 && humans() > 1) out.push({ tag:'P' + (hp + 1), col:HUMAN_COL[hp] });
  const held = G.power[tm];
  if (held && s.ko <= 0) {
    const holders = teamHasHuman(tm) ? [0, 1].filter(p => p < humans() && humanTeam(p) === tm).map(humanSk) : [powerUser(tm)];
    if (holders.includes(s)) out.push({ icon:held, col: tm === 'home' ? '#ffb51e' : '#c9a4ff', ready:true });
  }
  const armed = G.armed[tm];
  if (armed && s.ko <= 0) { const P = G.pucks[0], carrier = P.owner && P.owner.team === tm ? P.owner : (teamHasHuman(tm) ? humanSk(tm === 'away' ? 1 : 0) : null); if (carrier === s) out.push({ icon:armed.type, col:'#ff8a3d', frac:armed.t/14 }); }
  for (const [k, ic, max] of EFFECTS) if (s[k] > 0) out.push({ icon:ic, col: k === 'frozen' ? '#7ef0ff' : tm === 'home' ? '#ffb51e' : '#c9a4ff', frac:Math.min(1, s[k]/max) });
  return out;
}
function drawBadgeRow(list, sx, sy, t){
  if (!list.length) return;
  const R = 13, gap = 4, wTag = 26;
  const widths = list.map(b => b.tag ? wTag : R*2), total = widths.reduce((a, b) => a + b, 0) + gap*(list.length - 1);
  let x = sx - total/2;
  ctx.save(); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  list.forEach((b, i) => {
    const w = widths[i], cx = x + w/2;
    if (b.tag) {
      ctx.fillStyle = b.col; ctx.strokeStyle = 'rgba(11,7,16,.9)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, sy - 9, w, 18, 6) : ctx.rect(x, sy - 9, w, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#120c1a'; ctx.font = '12px Bungee, "Arial Black", Impact, sans-serif'; ctx.fillText(b.tag, cx, sy + 1);
    } else {
      ctx.fillStyle = 'rgba(18,12,26,.88)'; ctx.beginPath(); ctx.arc(cx, sy, R, 0, Math.PI*2); ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = b.ready ? b.col : 'rgba(241,231,208,.35)';
      if (b.ready) ctx.globalAlpha = 0.6 + 0.4*Math.sin(t*6);
      ctx.beginPath(); ctx.arc(cx, sy, R, 0, Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1;
      if (b.frac != null) { ctx.lineWidth = 3.2; ctx.strokeStyle = b.col; ctx.beginPath(); ctx.arc(cx, sy, R + 0.5, -Math.PI/2, -Math.PI/2 + Math.PI*2*Math.max(0, b.frac)); ctx.stroke(); }
      const img = iconImg(b.icon, b.col); if (img.complete && img.naturalWidth) ctx.drawImage(img, cx - 9, sy - 9, 18, 18);
    }
    x += w + gap;
  });
  ctx.restore();
}
// proj(x, y, heightFt) -> [sx, sy, onScreen]
function drawReplayBanner(t){
  if (!G || !G.replay) return;
  const bar = Math.round(ch*0.07);
  ctx.save(); ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = 'rgba(8,5,12,.88)'; ctx.fillRect(0, 0, cw, bar); ctx.fillRect(0, ch - bar, cw, bar);
  ctx.font = '20px Bungee, "Arial Black", Impact, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  const blink = A11Y.rm || Math.floor(t*2) % 2 === 0;
  if (blink) { ctx.fillStyle = '#ec3b4f'; ctx.beginPath(); ctx.arc(22, bar/2, 6, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#f4ecd8'; ctx.fillText('REPLAY', 36, bar/2 + 1);
  ctx.font = '600 13px "Saira Semi Condensed", sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(244,236,216,.75)';
  ctx.fillText(matchMedia('(pointer:coarse)').matches ? 'Tap Shoot to skip' : 'Shoot or pass to skip', cw - 16, bar/2 + 1);
  ctx.restore();
}
function drawBadges(proj, t){
  if (!G || G.attract) return;
  for (const s of G.sk) {
    if (s.ko > 0 && humanOf(s) < 0) continue;
    const list = badgesFor(s); if (!list.length) continue;
    const [sx, sy, ok] = proj(s.x, s.y, 11.5*(s.r/(s.baseR || SK_R))); if (ok) drawBadgeRow(list, sx, sy, t);
  }
  for (const g of [G.gH, G.gA]) {
    if (g.off) continue;
    const list = []; if (g.shrink > 0) list.push({ icon:'shrink', col:'#7ef0ff', frac:g.shrink/8 }); if (g.frozen > 0) list.push({ icon:'freeze', col:'#7ef0ff', frac:g.frozen/3 });
    if (!list.length) continue;
    const [sx, sy, ok] = proj(g.x, g.y, 10); if (ok) drawBadgeRow(list, sx, sy, t);
  }
}
// ---------------- graphics setting
let gfxPref = 'auto';
try { gfxPref = localStorage.getItem('rinkrat-gfx') || 'auto'; } catch(e) {}
const GFX_OPTS = [['auto','Auto'],['high','High'],['med','Medium'],['low','Low'],['classic','Classic 2D']];
function gfxStatusText(){
  const R3 = window.__r3d, names = { high:'High', med:'Medium', low:'Low' };
  if (gfxPref === 'classic') return 'Classic top-down view.';
  if (!R3 || R3.status === 'loading') return 'Loading the 3D arena…';
  if (R3.status === 'failed') return '3D isn\'t available on this device, so the game is using the classic view.';
  return `3D arena running on ${names[R3.tier] || R3.tier} quality (${R3.backend}).${gfxPref === 'auto' ? ' Auto lowers quality if the frame rate drops.' : ''}`;
}
function refreshGfx(){ const el = $('gfxNote'); if (el) el.textContent = gfxStatusText(); document.querySelectorAll('#gfxSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.g === gfxPref))); const eng = gfxEngine(); document.querySelectorAll('#engSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.e === eng))); }
function setGfx(p){
  gfxPref = p; try { localStorage.setItem('rinkrat-gfx', p); } catch(e) {}
  const R3 = window.__r3d;
  if (R3) { if (R3.ok && R3.setPref) R3.setPref(p); else if (p !== 'classic') R3.boot(); }
  if (p === 'classic') $('gl').hidden = true;
  refreshGfx();
}
window.__sim = {
  replayView, humanSk, humans, humanOf, reducedMotion: () => !!A11Y.rm,
  audio: () => ({ ctx: AC ? AC.state : null, loaded: Object.values(sfxBuf).reduce((n, l) => n + l.length, 0), crowd: !!crowdSrc, muted, volume, crowdVol }),
  get G(){ return G; }, ctrlSk, stickPt, aimAngle, HOME, SPECIES,
  C:{ RW, RL, CR, CX, GT, GB, PL, PRt, ND, PUCK_R, SK_R, G_R },
  stageW: () => cw, stageH: () => ch,
  gfxPref: () => gfxPref, on3DStatus: () => refreshGfx(),
  notice: m => { if (G && !G.attract) toast('3D view', m, 2600, 'small'); },
  forceClassic: m => { gfxPref = 'classic'; $('gl').hidden = true; refreshGfx(); if (G && !G.attract) toast('Classic view', m, 3200, 'small'); }
};
// test-only hooks (?debug): fast-forward the simulation and drive the keyboard
if (/[?&]debug\b/.test(location.search)) Object.assign(window.__sim, {
  step(n, dt = 1/60, each){ for (let i = 0; i < n; i++) { if (each) each(i); update(dt); } },
  keys, startChallenge: (i, mode) => { chMode = mode || '1p'; startChallenge(i); }, startPractice: cfg => { Object.assign(practice, cfg || {}); startPractice(); },
});
function gfxEngine(){ try { return localStorage.getItem('rinkrat-gfx-engine') || 'webgpu'; } catch(e) { return 'webgpu'; } }
function setEngine(e){
  try { localStorage.setItem('rinkrat-gfx-engine', e); } catch(err) {}
  const R3 = window.__r3d;
  if (gfxPref !== 'classic' && R3) { if (R3.ok && R3.restart) R3.restart(); else R3.boot(); }
  refreshGfx();
}
