// Rink Rat Mayhem · Instant replay recorder/player and challenge objectives
'use strict';
// ---------------- instant replay: a rolling recording of the last few seconds, played back after a goal
const REC_SK = ['x','y','vx','vy','face','stun','down','ko','charging','charge','lunge','rocket','kaiju','magnet','frozen','check','wind','swing','swingA','relT','r','hp'];
const REC_G = ['x','y','face','save','saveLat','saveHigh','stun','frozen','shrink','r','hold'];
const REC_P = ['x','y','vx','vy','sunk','fire','homing','shotBy','ref'];
let replayOn = true;
try { replayOn = localStorage.getItem('rinkrat-replays') !== '0'; } catch(e) {}
function snapState(){
  const P = G.pucks[0];
  return { t:G.time,
    sk: G.sk.map(s => [REC_SK.map(k => s[k]), s.bl ? [s.bl.a, s.bl.r, s.bl.x, s.bl.y] : null]),
    g: [G.gH, G.gA].map(g => REC_G.map(k => g[k])),
    p: [REC_P.map(k => P[k]), P.owner ? G.sk.indexOf(P.owner) : -1, P.hold === G.gH ? 0 : P.hold === G.gA ? 1 : -1], z: zamSnap() };
}
function applyState(f){
  f.sk.forEach(([vals, bl], i) => { const s = G.sk[i]; if (!s) return; REC_SK.forEach((k, j) => { s[k] = vals[j]; }); if (bl && s.bl) { [s.bl.a, s.bl.r, s.bl.x, s.bl.y] = bl; s.bl.va = s.bl.vr = 0; } });
  [G.gH, G.gA].forEach((g, i) => REC_G.forEach((k, j) => { g[k] = f.g[i][j]; }));
  const P = G.pucks[0]; REC_P.forEach((k, j) => { P[k] = f.p[0][j]; });
  P.owner = f.p[1] >= 0 ? G.sk[f.p[1]] : null; P.hold = f.p[2] === 0 ? G.gH : f.p[2] === 1 ? G.gA : null;
  P.trail.length = 0;
  if (f.z !== undefined) zamApply(f.z);
}
function recordFrame(){
  if (!G || G.attract || G.replay) return;
  const rec = G.rec || (G.rec = []);
  rec.push(snapState());
  while (rec.length && G.time - rec[0].t > 2.9) rec.shift();
}
function startReplay(){
  const rec = G.rec || []; if (rec.length < 30) return;
  const t1 = rec[rec.length - 1].t, goalAt = G.goalAt || t1;
  G.replay = { frames: rec.slice(), t: rec[0].t, t0: rec[0].t, t1, goalAt, live: snapState(), team: G.goalLight ? G.goalLight.team : 'home' };
  G.rec = [];
  if (window.__r3d) window.__r3d.cut = true;
}
function endReplay(){
  if (!G || !G.replay) return;
  applyState(G.replay.live); G.replay = null;
  G.stT = Math.min(G.stT, 0.4);
  if (window.__r3d) window.__r3d.cut = true;
}
// playback: real time, easing into slow motion around the goal
function stepReplay(dt){
  const R = G.replay, slow = Math.abs(R.t - R.goalAt) < 0.4 ? 0.45 : 1;
  R.t += dt*slow;
  if (R.t >= R.t1) { endReplay(); return; }
  const fr = R.frames; let i = 0; while (i < fr.length - 1 && fr[i + 1].t <= R.t) i++;
  applyState(fr[i]);
}
const replayView = () => G && G.replay ? { team:G.replay.team, x:G.pucks[0].x, y:G.pucks[0].y } : null;
const rumbleTeam = (tm, a, b, ms) => { for (let p = 0; p < humans(); p++) if (humanTeam(p) === tm) rumble(a, b, ms, p); };
function scoreGoal(tm, P){
  if (P.owner) { const o = P.owner; P.owner = null; o.charging = false; }
  G.score[tm]++;
  if (P.shotBy === tm) G.sog[tm]++;
  const powered = P.powered || P.bonus || (G.time - G.powerT[tm] < 6);
  if (tm === 'home' && powered) G.powerGoals++;
  if (!G.attract && !rule('faceoffs')) {
    if (!G.practice) checkObjLive();
    G.goalLight = { team:tm, t:0 }; G.pucks.length = 1; P.icing = null;
    const g = goalieOf(other(tm));
    if (!g.off) { P.hold = g; g.hold = 1.1; P.vx = P.vy = 0; P.shotBy = null; P.passTo = null; }
    else Object.assign(P, { x:CX + rand(-3, 3), y: tm === 'home' ? GT + 14 : GB - 14, vx:rand(-5, 5), vy: tm === 'home' ? 16 : -16, shotBy:null, passTo:null });
    burst(CX, tm === 'home' ? GT : GB, 30, ['#ffb51e','#ec3b4f','#ffffff'], 26, 0.7, 1);
    if (tm === 'home') { rumbleTeam('home', 0.6, 0.9, 380); toast('GOAL', 'Play on', 1500, 'goal'); sfx('horn'); sfx('cheer'); organ('goal', 0.9); }
    else { toast(G.ch.opp.abbr + ' score', 'Play on', 1300, 'small bad'); sfx('whistle'); sfx('aww'); organ(G.mode === 'vs' ? 'goal' : 'sad', 0.7); }
    return;
  }
  G.state = 'goal'; G.stT = 3; G.goalLight = { team:tm, t:0 }; G.goalAt = G.time; G.replayed = false;
  const gy = tm === 'home' ? GT : GB;
  burst(CX, gy, 40, ['#ffb51e','#ec3b4f','#ffffff'], 30, 0.8, 1.2); shake(1.6);
  if (tm === 'home') { rumbleTeam('home', 0.7, 1, 450); toast('GOAL', powered ? 'Power-up goal' : `${G.score.home}–${G.score.away}`, 2700, 'goal'); sfx('horn'); sfx('cheer'); organ('goal', 0.9); }
  else { toast(G.ch.opp.abbr + ' score', `${G.score.home}–${G.score.away}`, 2400, 'small bad'); sfx('whistle'); sfx('aww'); organ(G.mode === 'vs' ? 'goal' : 'sad', 0.7); }
  if (!G.attract) checkObjLive();
}
function endMatch(){
  G.state = 'end'; sfx('buzzer');
  if (!G.vs || G.vs.ot || G.vs.period >= G.vs.periods) organ('end', 1.1);
  for (const s of G.sk) s.charging = false;
  if (G.vs) { toast(G.vs.ot ? 'Overtime winner' : `End of the ${periodName(G.vs.period)}`, `${G.score.home}–${G.score.away}`, 1500, 'small'); versusEnd(); return; }
  if (G.practice) { toast('Practice over', `${G.score.home}–${G.score.away}`, 1600, 'small'); setTimeout(() => { if (G && G.practice && G.state === 'end') { paused = true; preparePause(true); show('pause'); } }, 1500); return; }
  if (G.attract) { setTimeout(() => { if (G && G.attract && G.state === 'end') startAttract(); }, 1500); return; }
  toast('Final', `${G.score.home}–${G.score.away}`, 1500, 'small');
  const res = evaluate();
  setTimeout(() => showResults(res), 1500);
}

// ---------------- objectives
function condMet(c, st){
  const h = st.score.home, a = st.score.away;
  switch (c.type) {
    case 'win': return h > a;
    case 'goals': return h >= c.n;
    case 'kos': return st.kos.home >= c.n && (!c.noLose || h >= a);
    case 'powers': return st.powersUsed >= c.n;
    case 'margin': return h - a >= c.n;
    case 'shutout': return a === 0 && h > a;
    case 'comeback': return h > a;
    case 'takenMax': return st.kos.away <= c.n;
    case 'powerGoals': return st.powerGoals >= c.n;
  }
  return false;
}
function condText(c, ch){
  switch (c.type) {
    case 'win': return ch && ch.short ? 'Win the period two skaters short' : 'Win the period';
    case 'goals': return `Score ${c.n} goals`;
    case 'kos': return c.noLose ? `KO ${c.n} skaters and don't lose` : `KO ${c.n} skaters`;
    case 'powers': return `Use ${c.n} power-ups`;
    case 'margin': return `Win by ${c.n} or more`;
    case 'shutout': return 'Win without allowing a goal';
    case 'comeback': return 'Start down 0–2. Win anyway';
    case 'takenMax': return `Lose ${c.n} or fewer skaters to KOs`;
    case 'powerGoals': return c.n === 1 ? 'Score a power-up goal' : `Score ${c.n} power-up goals`;
    case 'versus': return vsText();
    case 'practice': { const pr = ch && ch.practice; return pr ? (pr.players === 'vs' ? `Versus · P1 Rats vs P2 ${ch.opp.abbr}` : `Practice${pr.players === 'coop' ? ' co-op' : ''} · ${pr.opp} opponent${pr.opp === 1 ? '' : 's'} · ${pr.effort === 'full' ? 'full effort' : pr.effort}`) : 'Practice'; }
  }
  return '';
}
function condProg(c, st){
  const h = st.score.home, a = st.score.away;
  switch (c.type) {
    case 'goals': return `${Math.min(h, c.n)}/${c.n}`;
    case 'kos': return `${Math.min(st.kos.home, c.n)}/${c.n} KO`;
    case 'powers': return `${Math.min(st.powersUsed, c.n)}/${c.n}`;
    case 'margin': return `${h-a >= 0 ? '+' : ''}${h-a}`;
    case 'takenMax': return `${st.kos.away}/${c.n}`;
    case 'powerGoals': return `${Math.min(st.powerGoals, c.n)}/${c.n}`;
    case 'shutout': return a === 0 ? 'Clean' : 'Broken';
    case 'practice': case 'versus': return '';
    default: return h > a ? 'Leading' : h === a ? 'Tied' : 'Trailing';
  }
}
function checkObjLive(){
  const o = G.ch.obj;
  if (!G.objShown && (o.type === 'goals' || (o.type === 'kos' && !o.noLose)) && condMet(o, G)) { G.objShown = true; setTimeout(() => toast('Objective', 'Complete. Keep going for bonus stars', 1800, 'small'), 900); }
}
function evaluate(){
  const ch = G.ch, st = G;
  const objOk = condMet(ch.obj, st);
  const b = ch.bonus.map(c => objOk && condMet(c, st));
  const got = [objOk, b[0], b[1]];
  const prev = save.stars[ch.id] || [false,false,false];
  const prevArr = Array.isArray(prev) ? prev : [false,false,false];
  const newStars = got.map((g,i) => g && !prevArr[i]);
  const rows = [['Played the period', 20]];
  if (st.score.home - (ch.start ? ch.start[0] : 0) > 0) rows.push([`${st.score.home - (ch.start?ch.start[0]:0)} goal${st.score.home===1?'':'s'}`, 12*(st.score.home - (ch.start?ch.start[0]:0))]);
  if (st.kos.home > 0) rows.push([`${st.kos.home} KO${st.kos.home===1?'':'s'}`, 6*st.kos.home]);
  if (objOk) rows.push(['Objective complete', 60]);
  const nNew = newStars.filter(Boolean).length;
  if (nNew) rows.push([`${nNew} new star${nNew===1?'':'s'}`, 50*nNew]);
  const total = rows.reduce((a,r) => a + r[1], 0);
  const before = lvlInfo(save.xp);
  save.xp += total; save.plays++;
  save.stars[ch.id] = prevArr.map((p,i) => p || got[i]);
  const after = lvlInfo(save.xp);
  const unlocked = PORDER.filter(k => POWERS[k].lvl > before.L && POWERS[k].lvl <= after.L);
  const slotsUp = slotsFor(after.L) > slotsFor(before.L);
  if (unlocked.length && save.loadout.length < slotsFor(after.L)) for (const k of unlocked) if (save.loadout.length < slotsFor(after.L)) save.loadout.push(k);
  fixLoadout(save); persist();
  return { ch, objOk, got, newStars, rows, total, before, after, unlocked, slotsUp, score:{ ...st.score }, sog:{ ...st.sog }, kos:{ ...st.kos } };
}
