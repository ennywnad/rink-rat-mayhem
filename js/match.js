// Rink Rat Mayhem · Match state, feel tuning values, accessibility settings, rules, team attributes and practice/game config
'use strict';
// ---------------- match state
let G = null;
const team = { home:null, away:null };
function mkSkater(tm, idx, role, sp){
  return { team:tm, idx, role, species:sp, x:CX, y:100, vx:0, vy:0, face:0, r:SK_R, max:26, acc:72, hp:100,
    ko:0, stun:0, down:0, check:0, frozen:0, inv:0, cool:0, pokeCd:0, lunge:0, charge:0, charging:false, rocket:0, kaiju:0, magnet:0,
    hitImm:0, slowed:false, slickCd:0, sawCd:0, lastBy:null, lastT:-9, spin:0,
    ai:{ think:0, lane:CX, chargeTo:0.5, aimX:CX } };
}
const mkGoalie = tm => ({ team:tm, x:CX, y: tm==='away' ? GT+2.8 : GB-2.8, r:G_R, sx:CX, sy:100, hold:0, cool:0, face:0, shrink:0, stun:0, frozen:0 });
const mkPuck = () => ({ x:CX, y:100, vx:0, vy:0, owner:null, hold:null, shotBy:null, team:null, last:null, trail:[], fire:0, homing:0, powered:false, bonus:false, life:0, passTo:null, passT:0 });

function insideRink(x, y, m){
  let cx=null, cy=null;
  if (x < CR) cx = CR; else if (x > RW-CR) cx = RW-CR;
  if (y < CR) cy = CR; else if (y > RL-CR) cy = RL-CR;
  if (cx!==null && cy!==null) return hyp(x-cx, y-cy) < CR - m;
  return x > m && x < RW-m && y > m && y < RL-m;
}
function hazardOK(x, y, r, placed){
  if (!insideRink(x, y, r+3)) return false;
  if (hyp(x-CX, y-100) < 17 + r) return false;
  if (hyp(x-CX, y-GT) < 24 + r || hyp(x-CX, y-GB) < 24 + r) return false;
  if (x < 12 && Math.abs(y-100) < 22) return false;
  for (const p of placed) if (hyp(x-p.x, y-p.y) < r + p.r + 7) return false;
  return true;
}
function placeSpot(r, placed, yr){
  for (let i=0;i<300;i++){
    const x = rand(r+4, RW-r-4), y = yr ? rand(yr[0], yr[1]) : rand(30, 170);
    if (hazardOK(x, y, r, placed)) { const p = { x, y, r }; placed.push(p); return p; }
  }
  return null;
}
function buildHazards(hz){
  const H = { holes:[], vents:[], mines:[], slime:[], wells:[], saws:[], placed:[] };
  const P = H.placed;
  if (hz.wells) { H.wells.push({ x:14, y:100, R:20, r:3 }, { x:71, y:100, R:20, r:3 }); P.push({ x:14, y:100, r:12 }, { x:71, y:100, r:12 }); }
  if (hz.saws) { H.saws.push({ x:18, y:78, dir:1, r:2.6, sp:15, a:0 }, { x:67, y:122, dir:-1, r:2.6, sp:15, a:0 }); }
  for (let i=0;i<(hz.holes||0);i++){ const s = placeSpot(5.6, P, i%2 ? [118,168] : [32,82]); if (s) { const pts=[]; for (let k=0;k<14;k++){ const a=k/14*Math.PI*2; pts.push([Math.cos(a)*(s.r+rand(-.6,.9)), Math.sin(a)*(s.r+rand(-.6,.9))]); } H.holes.push({ ...s, pts }); } }
  for (let i=0;i<(hz.vents||0);i++){ const s = placeSpot(4, P); if (s) H.vents.push({ ...s, t:rand(0,5.5), hit:new Set(), on:false }); }
  for (let i=0;i<(hz.slime||0);i++){ const s = placeSpot(rand(6.5,8.5), P); if (s) { const blobs=[]; for (let k=0;k<5;k++) blobs.push([rand(-.45,.45)*s.r, rand(-.45,.45)*s.r, s.r*rand(.45,.7)]); H.slime.push({ ...s, blobs, ph:rand(0,6) }); } }
  for (let i=0;i<(hz.mines||0);i++){ const s = placeSpot(1.6, P); if (s) H.mines.push({ x:s.x, y:s.y, r:1.4, team:null, arm:0, dead:0, spot:s }); }
  return H;
}

// one-time reset: a crowd shader bug in v14 forced WebGPU off and saved WebGL2 / a lower detail tier; undo that once
try { if (!localStorage.getItem('rinkrat-gfx-fix15')) { if (localStorage.getItem('rinkrat-gfx-engine') === 'webgl') localStorage.removeItem('rinkrat-gfx-engine'); localStorage.removeItem('rinkrat-gfx-auto'); localStorage.setItem('rinkrat-gfx-fix15', '1'); } } catch(e) {}
// ---------------- feel tuning (live sliders; saved in this browser)
const DEG = Math.PI/180;
// ---------------- accessibility (saved per browser)
const A11Y = { cb:false, rm: !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches), btn: (window.matchMedia && matchMedia('(pointer:coarse)').matches) ? 'large' : 'normal' };
try { const a = JSON.parse(localStorage.getItem('rinkrat-a11y') || 'null'); if (a) Object.assign(A11Y, a); } catch(e) {}
const saveA11y = () => { try { localStorage.setItem('rinkrat-a11y', JSON.stringify(A11Y)); } catch(e) {} };
const CB_AWAY = { jersey:'#1f6fe0', trim:'#f2f2f2' };
// colour-blind friendly matchups: Rats stay amber and black, every opponent wears blue and white
function paletteFor(ch){ return A11Y.cb ? { ...ch, opp:{ ...ch.opp, ...CB_AWAY }, base: ch.base || ch } : ch; }
const hpCol = f => A11Y.cb ? (f > 0.55 ? '#4fa8ff' : f > 0.25 ? '#ffb51e' : '#ff4fd8') : (f > 0.55 ? '#74d38f' : f > 0.25 ? '#ffb51e' : '#ec3b4f');
const TUNE_DEF = [
  ['Skating', [
    ['carveSlow', 'Turn rate when slow', 2, 9, 0.1, 5.4, 'rad/s'],
    ['carveFast', 'Turn rate at top speed', 1, 6, 0.1, 2.8, 'rad/s'],
    ['carveBleed', 'Speed lost in turns', 0, 0.4, 0.01, 0.12, ''],
    ['stopAngle', 'Hockey stop past', 70, 170, 1, 117, '°'],
    ['stopBrake', 'Stop strength', 0.8, 4, 0.05, 1.9, '×'],
  ]],
  ['Stick', [
    ['bladeAuto', 'Stick speed (auto)', 80, 500, 5, 210, ''],
    ['bladeSkill', 'Stick speed (right stick)', 100, 800, 10, 300, ''],
    ['bladeLimit', 'Max sweep with the puck', 4, 30, 0.5, 12, 'rad/s'],
    ['reach', 'Stick reach', 1, 4, 0.05, 2.6, 'ft'],
    ['grip', 'Puck grip', 8, 60, 1, 28, ''],
    ['loseDist', 'Lose the puck when dragged', 2, 8, 0.1, 3.6, 'ft'],
  ]],
  ['Shooting and passing', [
    ['windTime', 'Full pull-back wind-up', 0.15, 1.5, 0.05, 0.5, 's'],
    ['backAngle', 'Pull-back zone starts at', 70, 160, 1, 109, '°'],
    ['releaseAngle', 'Flick releases within', 15, 90, 1, 46, '°'],
    ['shotMin', 'Quick-flick power', 0, 0.8, 0.01, 0.28, ''],
    ['shotPower', 'Shot speed', 0.5, 1.8, 0.05, 1, '×'],
    ['aimAssist', 'Aim assist', 0, 1, 0.05, 0.6, ''],
    ['chargeTime', 'Button wind-up', 0.2, 1.5, 0.05, 0.75, 's'],
    ['passSpeed', 'Pass speed', 0.5, 1.6, 0.05, 1, '×'],
  ]],
  ['Hits', [
    ['knockPower', 'Knockdown threshold', 5, 80, 1, 30, ''],
    ['knockback', 'Knockback', 0, 0.8, 0.01, 0.28, ''],
    ['recoil', 'Checker keeps speed', 0.2, 1, 0.01, 0.72, '×'],
  ]],
];
const TUNE = {};
for (const [, items] of TUNE_DEF) for (const [k, , , , , d] of items) TUNE[k] = d;
try { const t = JSON.parse(localStorage.getItem('rinkrat-tune') || 'null'); if (t) for (const k in t) if (k in TUNE && typeof t[k] === 'number') TUNE[k] = t[k]; } catch(e) {}
const saveTune = () => { try { const ch = {}; for (const [, items] of TUNE_DEF) for (const [k, , , , , d] of items) if (TUNE[k] !== d) ch[k] = TUNE[k]; localStorage.setItem('rinkrat-tune', JSON.stringify(ch)); } catch(e) {} };

// ---------------- rules, team attributes, practice config
const ATTRS = [['speed','Speed'],['accel','Acceleration'],['shot','Shot power'],['check','Checking'],['handle','Puck control'],['goalie','Goalie']];
const defAttrs = () => Object.fromEntries(ATTRS.map(([k]) => [k, 1]));
const RULES = [['icing','Icing','Clearing the puck from your half past the far goal line brings a faceoff back'],['faceoffs','Faceoffs after goals','Off keeps play going: the goalie or a fresh puck restarts it'],['checking','Body checking','Off still allows poke checks'],['kos','Knockouts','Off means hits and hazards never drain health'],['hazards','Arena hazards','Holes, vents, mines, sludge, wells and saws'],['zam','Ice resurfacer','An arena-themed machine laps the rink during play and leaves fresh, fast ice'],['powerups','Power-up crates','Crates drop on the ice. In practice they hold every power-up you have unlocked']];
const DEFAULT_RULES = { icing:false, faceoffs:true, checking:true, kos:true, hazards:true, zam:true, powerups:true };
const practiceDef = () => ({ arena:'boneyard', players:'1p', opp:2, mates:0, goalies:'both', effort:'light', clock:0,
  rules:{ icing:true, faceoffs:false, checking:true, kos:true, hazards:true, zam:true, powerups:true }, attrs:{ home:defAttrs(), away:defAttrs() } });
let practice = practiceDef();
try { const pr = JSON.parse(localStorage.getItem('rinkrat-practice') || 'null'); if (pr && typeof pr === 'object') { const d = practiceDef(); practice = { ...d, ...pr, rules:{ ...d.rules, ...(pr.rules||{}) }, attrs:{ home:{ ...d.attrs.home, ...((pr.attrs||{}).home||{}) }, away:{ ...d.attrs.away, ...((pr.attrs||{}).away||{}) } } }; } } catch(e) {}
const gameDef = () => ({ rules:{ ...DEFAULT_RULES }, attrs:{ home:defAttrs(), away:defAttrs() } });
let gameCfg = gameDef();
try { const gc = JSON.parse(localStorage.getItem('rinkrat-game') || 'null'); if (gc && typeof gc === 'object') { const d = gameDef(); gameCfg = { rules:{ ...d.rules, ...(gc.rules||{}) }, attrs:{ home:{ ...d.attrs.home, ...((gc.attrs||{}).home||{}) }, away:{ ...d.attrs.away, ...((gc.attrs||{}).away||{}) } } }; } } catch(e) {}
const saveGame = () => { try { localStorage.setItem('rinkrat-game', JSON.stringify(gameCfg)); } catch(e) {} };
const gameCustom = () => { const n = RULES.filter(([k]) => gameCfg.rules[k] !== DEFAULT_RULES[k]).length + ['home','away'].reduce((a, tm) => a + ATTRS.filter(([k]) => Math.abs(gameCfg.attrs[tm][k] - 1) > 0.001).length, 0); return n; };
const savePractice = () => { try { localStorage.setItem('rinkrat-practice', JSON.stringify(practice)); } catch(e) {} };
const drillTeam = tm => tm === 'away' && !!G && !!G.practice && G.effort !== 'full' && G.mode !== 'vs';
const attrOf = (tm, k) => (G && G.attr && G.attr[tm] && G.attr[tm][k]) || 1;
const rule = k => !G || !G.rules ? DEFAULT_RULES[k] : !!G.rules[k];
function applyAttrsLive(){ for (const s of G.sk) { s.max = s.baseMax*attrOf(s.team, 'speed'); s.acc = s.baseAcc*attrOf(s.team, 'accel'); } }

function newMatch(ch, attract, mode){
  ch = paletteFor(ch);
  const tier = ch.tier, pr = ch.practice || null;
  G = { ch, attract, theme:THEMES[ch.id], tier, state:'faceoff', stT:1.3, clock:ch.len, time:0,
    score:{ home:0, away:0 }, sog:{ home:0, away:0 }, kos:{ home:0, away:0 }, hits:{ home:0, away:0 },
    powersUsed:0, powerGoals:0, power:{ home:null, away:null }, armed:{ home:null, away:null }, powerT:{ home:-99, away:-99 },
    aiPowT:{ home:3, away:3 }, crates:[], crateT:4, traps:[], walls:[], parts:[], pops:[], rings:[], bolts:[], beams:[], shake:0,
    ctrl: attract ? -1 : 0, ctrl2:-1, switchCd:0, switchCd2:0, mode: attract ? '1p' : (mode || '1p'), objShown:false, goalLight:null, low:!!ch.hz.low, endT:0,
    practice:pr, effort: pr ? pr.effort : 'full', rules: ch.vsCfg ? { ...ch.vsCfg.rules } : pr ? { ...pr.rules } : attract ? { ...DEFAULT_RULES } : { ...gameCfg.rules }, attr: pr ? JSON.parse(JSON.stringify(pr.attrs)) : attract ? { home:defAttrs(), away:defAttrs() } : JSON.parse(JSON.stringify(gameCfg.attrs)), regT:0, foSpot:null };
  if (ch.start) { G.score.home = ch.start[0]; G.score.away = ch.start[1]; }
  G.hz = buildHazards(G.rules.hazards ? ch.hz : {});
  zamInit();
  G.stats = newStats();
  const vc = ch.vsCfg || null;
  const nHome = vc ? vc.skaters : pr ? 1 + pr.mates : ch.short && !attract ? 2 : 3, nAway = vc ? vc.skaters : pr ? pr.opp : 3;
  G.sk = [];
  for (let i=0;i<nHome;i++) { const s = mkSkater('home', i, i, 'rat'); s.max = i===0 && !attract ? 27 : 25; G.sk.push(s); }
  for (let i=0;i<nAway;i++) { const s = mkSkater('away', i, i, ch.opp.species); s.max = Math.min(27.5, 22.4 + tier*0.75); s.acc = 60 + tier*3; if (ch.opp.species==='ogre') { s.r = s.baseR = 2.9; } G.sk.push(s); }
  G.sk.forEach(s => { s.baseR = s.r; s.baseMax = s.max; s.baseAcc = s.acc; });
  applyAttrsLive();
  G.gH = mkGoalie('home'); G.gA = mkGoalie('away');
  if (pr) { G.gH.off = pr.goalies === 'theirs' || pr.goalies === 'none'; G.gA.off = pr.goalies === 'mine' || pr.goalies === 'none'; }
  G.pucks = [mkPuck()];
  setFaceoff();
  buildRink();
}
const goalieOf = tm => tm==='home' ? G.gH : G.gA;
const other = tm => tm==='home' ? 'away' : 'home';
const ctrlSk = () => (G && G.ctrl >= 0) ? G.sk[G.ctrl] : null;
const dirOf = tm => tm==='home' ? -1 : 1;           // attack direction in y
const goalY = tm => tm==='home' ? GT : GB;          // net this team shoots at
const ownY = tm => tm==='home' ? GB : GT;

// put each human on the nearest skater of their team for a faceoff
function assignHumans(spot){
  if (!G || G.attract) return;
  const near = (tm, not) => G.sk.filter(s => s.team === tm && s.ko <= 0 && s !== not).sort((a,b) => hyp(a.x-spot.x, a.y-spot.y) - hyp(b.x-spot.x, b.y-spot.y))[0];
  const p1 = near('home'); if (p1) G.ctrl = G.sk.indexOf(p1);
  if (G.mode === 'coop') { const p2 = near('home', p1); G.ctrl2 = p2 ? G.sk.indexOf(p2) : -1; }
  else if (G.mode === 'vs') { const p2 = near('away'); G.ctrl2 = p2 ? G.sk.indexOf(p2) : -1; }
  if (G.mode === 'vs') G.awayWait = 0;
}
function foTargets(spot){
  const { x, y } = spot, cl = (px, py) => [clamp(px, 6, 79), clamp(py, 8, 192)];
  const inward = Math.abs(x - CX) < 2 ? 1 : (x < CX ? 1 : -1), center = Math.abs(x - CX) < 2;
  const home = center ? [cl(x, y+6), cl(x-20, y+10), cl(x+20, y+24)] : [cl(x, y+6), cl(x + inward*16, y+8), cl(x + inward*26, y+22)];
  const away = center ? [cl(x, y-6), cl(x+20, y-10), cl(x-20, y-24)] : [cl(x, y-6), cl(x + inward*16, y-8), cl(x + inward*26, y-22)];
  return { home, away };
}
// stoppage: players skate to the faceoff instead of teleporting
function startRegroup(spot){
  const P = G.pucks[0];
  if (P.owner) P.owner.charging = false;
  G.pucks.length = 1;
  Object.assign(P, { owner:null, hold:null, sunk:false, vx:0, vy:0, x:spot.x, y:spot.y, ref:true, shotBy:null, passTo:null, fire:0, homing:0, icing:null });
  for (const g of [G.gH, G.gA]) { g.hold = 0; g.cool = 0.5; }
  const T = foTargets(spot);
  for (const s of G.sk) { s.charging = false; s.charge = 0; s.rocket = 0; s.foT = T[s.team][s.idx % 3]; s.drill = null; }
  if (!G.attract && !cueOn() && G.state !== 'goal' && Math.random() < 0.6) organ('noodle', 0.4);
  G.state = 'regroup'; G.regT = 0; G.foSpot = spot; G.goalLight = G.goalLight && G.goalLight.t < 2 ? G.goalLight : null;
}
function finishRegroup(){
  const P = G.pucks[0], spot = G.foSpot || { x:CX, y:100 };
  for (const s of G.sk) {
    if (!s.foT) continue;
    if (s.ko > 0) { s.ko = 0; s.hp = 100; s.stun = 0; s.x = s.foT[0]; s.y = s.foT[1]; }
    if (s.ko <= 0 && hyp(s.x - s.foT[0], s.y - s.foT[1]) > 8) { s.x = s.foT[0]; s.y = s.foT[1]; s.vx *= 0.2; s.vy *= 0.2; }   // only true stragglers get placed
  }
  Object.assign(P, { ref:false, x:spot.x, y:spot.y, vx:0, vy:0 }); G.foPuck = { x:spot.x, y:spot.y };
  G.state = 'faceoff'; G.stT = 0.9; G.awayWait = 0.45 - G.tier*0.03;
  assignHumans(spot);
}
function regroupInput(s){
  if (s.ko > 0 || !s.foT) return [0,0];
  { const hp = humanOf(s); if (hp >= 0) { const v = readInput(hp); if (hyp(v[0], v[1]) > 0.25) return v; } }
  const [tx, ty] = s.foT, d = hyp(tx - s.x, ty - s.y);
  if (d < 1.6) { s.face = turn(s.face, s.team === 'home' ? -Math.PI/2 : Math.PI/2, 0.12); return [0,0]; }
  const v = moveTo(s, tx, ty), k = d > 30 ? 1 : d > 10 ? 0.82 : 0.6;
  return [v[0]*k, v[1]*k];
}
function setFaceoff(){
  const pos = { home:[[CX,106],[22,110],[62,124]], away:[[CX,94],[63,90],[23,76]] };
  for (const s of G.sk) {
    const [x,y] = pos[s.team][s.idx];
    Object.assign(s, { x, y, vx:0, vy:0, face: s.team==='home' ? -Math.PI/2 : Math.PI/2, charging:false, charge:0, cool:0, lunge:0, stun:0, frozen:0, rocket:0, kaiju:0, magnet:0, r:s.baseR });
    if (s.ko > 0) { s.ko = 0; s.hp = 100; }
  }
  G.pucks = [mkPuck()];
  for (const g of [G.gH, G.gA]) { g.x = CX; g.y = g.team==='away' ? GT+2.8 : GB-2.8; g.hold = 0; g.cool = 0; g.sx = CX; g.sy = 100; g.stun = 0; g.frozen = 0; }
  G.state = 'faceoff'; G.stT = 1.1;
  assignHumans({ x:CX, y:100 });
  G.awayWait = 0.45 - G.tier*0.03;
}
