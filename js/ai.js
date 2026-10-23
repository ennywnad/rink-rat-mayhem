// Rink Rat Mayhem · Computer players (including practice drills), power-ups and crates
'use strict';
// ---------------- AI
function moveTo(s, tx, ty){
  let dx = tx - s.x, dy = ty - s.y; const d = hyp(dx, dy);
  if (d < 0.6) return [0, 0];
  const m = Math.min(1, d/3); dx = dx/d*m; dy = dy/d*m;
  const avoid = s.team === 'away' ? 0.9 + G.tier*0.12 : 1.4;
  const H = G.hz;
  const rep = (hx, hy, R) => { const ex = s.x-hx, ey = s.y-hy, e = hyp(ex, ey); if (e < R && e > 0.01) { const k = (R-e)/R*avoid*1.6; dx += ex/e*k; dy += ey/e*k; } };
  if (s.kaiju <= 0) {
    for (const o of H.holes) if (!(o.frozen > 0)) rep(o.x, o.y, o.r+6);
    for (const v of H.vents) { const ph = (v.t % 5.5); if (ph > 3.1) rep(v.x, v.y, v.r+5); }
    for (const mi of H.mines) if (mi.dead === 0 && (!mi.team || mi.team !== s.team)) rep(mi.x, mi.y, 7);
    for (const w of H.wells) rep(w.x, w.y, 9);
    for (const w of H.saws) rep(w.x, w.y, 7);
  }
  if (G.zam && !G.zam.hide) { const Z = G.zam, c = Math.cos(Z.a), sn = Math.sin(Z.a); rep(Z.x, Z.y, 9); rep(Z.x + c*(ZAM_LH + 4), Z.y + sn*(ZAM_LH + 4), 9); }
  const m2 = hyp(dx, dy); if (m2 > 1) { dx /= m2; dy /= m2; }
  return [dx, dy];
}
function shotErr(tm){ return tm === 'home' ? 0.16 : Math.max(0.07, 0.32 - G.tier*0.035); }
// practice opponents: carry briefly, lob it toward center ice, then back off or loop behind their own net
function drillAI(s, dt){
  const P = G.pucks[0], d = s.drill || (s.drill = { mode:'idle', t:0 });
  d.t += dt;
  const slow = (v, k) => [v[0]*k, v[1]*k];
  if (P.owner === s) {
    if (d.mode !== 'carry') { d.mode = 'carry'; d.t = 0; d.wait = rand(0.45, 1.0); }
    s.charging = false;
    if (d.t >= d.wait) {
      const short = Math.random() < 0.35, fa = s.face + rand(-0.5, 0.5);
      const tx = short ? clamp(P.x + Math.cos(fa)*rand(8, 14), 6, 79) : CX + rand(-14, 14), ty = short ? clamp(P.y + Math.sin(fa)*rand(8, 14), 8, 192) : 100 + rand(-6, 12), dist = hyp(tx - P.x, ty - P.y);
      const sp = clamp(12 + dist*0.5, 16, 42) * rand(0.75, 1.1), a = Math.atan2(ty - P.y, tx - P.x) + rand(-0.15, 0.15);
      Object.assign(P, { owner:null, vx:Math.cos(a)*sp, vy:Math.sin(a)*sp, shotBy:null, last:'away', team:'away', passTo:null, icing:null });
      s.cool = 0.9; sfx('stick', 0.7);
      d.from = [P.x, P.y]; d.far = dist > 20; d.mode = 'tossed'; d.t = 0;
    }
    return slow(moveTo(s, s.x + Math.cos(s.face)*4, s.y + Math.sin(s.face)*4), 0.3);
  }
  const backoff = () => { const ax = s.x - P.x, ay = s.y - P.y, al = hyp(ax, ay) || 1; d.bo = [clamp(s.x + ax/al*8, 8, 77), clamp(s.y + ay/al*6 - 6, 14, 186)]; d.mode = 'backoff'; d.t = 0; };
  if (d.mode === 'carry') backoff();                                   // lost it: just back off a little
  if (d.mode === 'tossed') {
    if (d.t < 0.5 && !P.owner) return [0, 0];                          // follow-through glide
    if (d.far && P.owner !== s) {                                       // a few stick lengths up ice: natural loop behind their net
      const side = s.x < CX ? -1 : 1;
      d.wp = [[CX + side*22, GT + 18], [CX + side*13, GT - 3.5], [CX, GT - 7.2], [CX - side*13, GT - 3.5], [CX - side*22, GT + 18], [CX - side*14, 52]];
      d.i = 0; d.mode = 'loop'; d.t = 0;
    } else backoff();
  }
  if (d.mode === 'loop') {
    const [wx, wy] = d.wp[d.i];
    if (hyp(wx - s.x, wy - s.y) < 4.5) { d.i++; if (d.i >= d.wp.length) { d.mode = 'idle'; d.t = 0; } }
    if (d.mode === 'loop') return slow(moveTo(s, wx, wy), 0.8);
  }
  if (d.mode === 'backoff') {
    if (d.t > 2.0) { d.mode = 'idle'; d.t = 0; } else return slow(moveTo(s, d.bo[0], d.bo[1]), 0.55);
  }
  // idle: hover in a lane; light effort chases loose pucks and pokes at the carrier
  const ready = [[CX, 64], [22, 56], [63, 56]][s.idx % 3];
  const carrier = P.owner, mates = G.sk.filter(m => m.team === 'away' && m.ko <= 0);
  let nearest = null, nd = 1e9; for (const m of mates) { const dd = hyp(m.x - P.x, m.y - P.y); if (dd < nd) { nd = dd; nearest = m; } }
  const free = !carrier && !P.hold && !P.ref && !P.sunk;
  if (G.effort === 'light' && nearest === s && d.t > 0.8 && !P.hold && !P.ref) {
    if (free) return slow(moveTo(s, P.x + P.vx*0.3, P.y + P.vy*0.3), 0.62);
    if (carrier && carrier.team === 'home') {
      const dd = hyp(carrier.x - s.x, carrier.y - s.y);
      if (dd < 6 && s.pokeCd <= 0 && Math.random() < 0.5*dt) lunge(s, Math.atan2(carrier.y - s.y, carrier.x - s.x));
      const vx = CX - carrier.x, vy = GT - carrier.y, vl = hyp(vx, vy) || 1;
      return slow(moveTo(s, carrier.x + vx/vl*5, carrier.y + vy/vl*5), 0.55);
    }
  }
  if (G.effort === 'passive' && free && nearest === s && nd < 10) return slow(moveTo(s, P.x, P.y), 0.45);
  return slow(moveTo(s, ready[0] + Math.sin(G.time*0.5 + s.idx*2)*5, ready[1] + Math.cos(G.time*0.4 + s.idx)*4), 0.35);
}
function aiSkater(s, dt){
  if (s.ko > 0 || s.stun > 0 || s.frozen > 0) { s.charging = false; return [0,0]; }
  if (drillTeam(s.team)) return G.awayWait > 0 ? [0,0] : drillAI(s, dt);
  if (s.team === 'away' && G.awayWait > 0) return [0,0];
  const P = G.pucks[0], tm = s.team, dir = dirOf(tm), gy = goalY(tm), oy = ownY(tm);
  const mates = G.sk.filter(m => m.team === tm && m.ko <= 0);
  const opps = G.sk.filter(m => m.team !== tm && m.ko <= 0);
  const carrier = P.owner;
  const fwd = (y, k) => y + dir*k;
  if (P.hold || P.sunk || P.ref) {
    const ours = P.hold && P.hold.team === tm;
    const spots = ours ? [[CX+8, fwd(oy, 45)], [15, fwd(oy, 32)], [70, fwd(oy, 32)]] : [[CX, fwd(oy, 30)], [20, fwd(oy, 22)], [65, fwd(oy, 22)]];
    const [tx, ty] = spots[s.role % 3]; return moveTo(s, tx, ty);
  }
  if (carrier === s) {
    const ai = s.ai; ai.think -= dt;
    const dGoal = hyp(CX - s.x, gy - s.y);
    const past = tm === 'home' ? s.y < gy + 4 : s.y > gy - 4;
    let tx, ty;
    if (past) { tx = s.x < CX ? CX-18 : CX+18; ty = gy - dir*20; }
    else if (dGoal > 45) { tx = ai.lane; ty = gy - dir*30; }
    else { tx = CX + (ai.lane - CX)*0.4; ty = gy - dir*15; }
    let near = null, nd = 1e9;
    for (const o of opps) { const d = hyp(o.x-s.x, o.y-s.y); if (d < nd) { nd = d; near = o; } }
    if (near && nd < 13 && (near.y - s.y)*dir > -2 && !s.charging) tx = clamp(s.x + (near.x > s.x ? -15 : 15), 8, 77);
    if (ai.think <= 0 && !s.charging) {
      ai.think = 0.3;
      if (near && nd < 8 && Math.random() < 0.55) {
        const r = passPuck(s, Math.atan2(gy - s.y, CX - s.x));
        if (r) return [0, 0];
      }
      const inFront = !past && Math.abs(s.x - CX) < 28;
      if (inFront && (dGoal < 34 || (near && nd < 9 && dGoal < 48) || (dGoal < 58 && Math.random() < 0.15))) {
        if (G.power[tm] && SHOT_POWERS.includes(G.power[tm]) && aiControlsPower(tm)) usePower(tm, s);
        s.charging = true; s.charge = 0; ai.chargeTo = rand(0.25, 0.95);
        const og = goalieOf(other(tm)); ai.aimX = og.x > CX ? PL+0.9+rand(0,1.4) : PRt-0.9-rand(0,1.4);
      }
    }
    if (s.charging) {
      s.charge += dt/0.75; tx = s.ai.aimX; ty = gy;
      if (s.charge >= s.ai.chargeTo) { const ang = Math.atan2(gy - P.y, s.ai.aimX - P.x) + rand(-1,1)*shotErr(tm); shoot(s, Math.min(1, s.charge), ang); }
    }
    return moveTo(s, tx, ty);
  }
  s.charging = false;
  if (carrier && carrier.team === tm) {
    const others = mates.filter(m => m !== carrier && !isHuman(m)).sort((a,b) => a.role - b.role);
    const k = others.indexOf(s);
    const side = carrier.x < CX ? 64 : 21;
    const aheadY = tm === 'home' ? Math.max(gy+18, carrier.y-28) : Math.min(gy-18, carrier.y+28);
    const spots = [[side, aheadY], [CX + (carrier.x < CX ? 12 : -12), carrier.y - dir*12]];
    const [tx, ty] = spots[Math.max(0, k) % 2];
    return moveTo(s, clamp(tx, 8, 77), clamp(ty, 14, 186));
  }
  if (carrier) {
    let chaser = null, cd = 1e9;
    for (const m of mates) { const d = hyp(m.x-carrier.x, m.y-carrier.y) + (isHuman(m) ? -3 : 0); if (d < cd) { cd = d; chaser = m; } }
    if (chaser === s) {
      const vx = CX - carrier.x, vy = oy - carrier.y, vd = hyp(vx, vy) || 1;
      const tx = carrier.x + vx/vd*3.5 + carrier.vx*0.18, ty = carrier.y + vy/vd*3.5 + carrier.vy*0.18;
      const d = hyp(carrier.x - s.x, carrier.y - s.y);
      const rate = s.team === 'away' ? 0.3 + G.tier*0.1 : 0.9;
      if (d < 6.5 && s.pokeCd <= 0 && Math.random() < rate*dt*2) lunge(s, Math.atan2(carrier.y - s.y, carrier.x - s.x));
      return moveTo(s, tx, ty);
    }
    const others = mates.filter(m => m !== chaser && !isHuman(m)).sort((a,b) => a.role - b.role);
    const k = others.indexOf(s);
    if (k === 0) {
      let mark = null, md = 1e9;
      for (const o of opps) { if (o === carrier) continue; const d = hyp(o.x - CX, o.y - oy); if (d < md) { md = d; mark = o; } }
      if (mark) { const vx = CX - mark.x, vy = oy - mark.y, vd = hyp(vx, vy) || 1; return moveTo(s, mark.x + vx/vd*5, mark.y + vy/vd*5); }
    }
    return moveTo(s, CX + (carrier.x - CX)*0.3, fwd(oy, 16));
  }
  // loose puck
  let chaser = null, cd = 1e9;
  for (const m of mates) { const d = hyp(m.x-P.x, m.y-P.y) + (isHuman(m) ? -4 : 0); if (d < cd) { cd = d; chaser = m; } }
  if (P.passTo && P.passTo.team === tm) chaser = P.passTo;
  if (chaser === s) {
    const d = hyp(P.x-s.x, P.y-s.y), lead = Math.min(0.5, d/s.max);
    return moveTo(s, P.x + P.vx*lead, P.y + P.vy*lead);
  }
  const others = mates.filter(m => m !== chaser && !isHuman(m)).sort((a,b) => a.role - b.role);
  const k = others.indexOf(s);
  if (k === 0) return moveTo(s, clamp(P.x < CX ? P.x + 20 : P.x - 20, 8, 77), clamp(P.y + dir*12, 14, 186));
  return moveTo(s, CX, clamp(P.y - dir*24, 20, 180));
}
const aiControlsPower = tm => tm === 'away' || G.attract;
function powerUser(tm){
  const P = G.pucks[0];
  if (teamHasHuman(tm)) { const hs = humanSk(tm === 'away' ? 1 : 0); if (hs) return hs; }
  if (P.owner && P.owner.team === tm) return P.owner;
  let best = null, bd = 1e9;
  for (const s of G.sk) { if (s.team !== tm || s.ko > 0) continue; const d = hyp(s.x-P.x, s.y-P.y); if (d < bd) { bd = d; best = s; } }
  return best;
}
function aiPowers(tm, dt){
  const p = G.power[tm]; if (!p) return;
  G.aiPowT[tm] -= dt; if (G.aiPowT[tm] > 0) return;
  const u = powerUser(tm); if (!u || u.ko > 0 || u.stun > 0 || u.frozen > 0) return;
  const P = G.pucks[0], mine = P.owner && P.owner.team === tm, theirs = P.owner && P.owner.team !== tm;
  const oppNear = G.sk.some(o => o.team !== tm && o.ko <= 0 && hyp(o.x-u.x, o.y-u.y) < 14);
  const att = (P.y - 100) * -dirOf(tm) < 0 ? true : false; // puck in attacking half
  let go = false;
  switch (p) {
    case 'rocket': go = mine || (!P.owner && hyp(P.x-u.x, P.y-u.y) > 14); break;
    case 'slick': case 'mine': case 'kaiju': go = oppNear; break;
    case 'fireball': case 'homing': case 'triple': go = false; break;
    case 'magnet': go = !P.owner; break;
    case 'shrink': go = mine && att; break;
    case 'wall': go = theirs && !att; break;
    case 'lightning': case 'freeze': go = theirs || (mine && att); break;
  }
  if (G.aiPowT[tm] < -9) go = true;
  if (go) usePower(tm, u);
}

// ---------------- powers
function usePower(tm, user){
  const p = G.power[tm]; if (!p || G.state !== 'play') return;
  user = user || powerUser(tm); if (!user || user.ko > 0) return;
  stat(tm, 'pw');
  G.power[tm] = null; G.powerT[tm] = G.time; G.aiPowT[tm] = rand(2.5, 6);
  if (tm === 'home' && !G.attract) G.powersUsed++;
  const opp = other(tm), col = tm === 'home' ? '#ffb51e' : '#c9a4ff';
  pop(user.x, user.y - 5, POWERS[p].name.toUpperCase(), col, 14, 1.3);
  ring(user.x, user.y, 7, col, 0.4);
  switch (p) {
    case 'rocket': user.rocket = 3.2; sfx('rocket'); break;
    case 'slick': { const bx = user.x - Math.cos(user.face)*5, by = user.y - Math.sin(user.face)*5; G.traps.push({ kind:'slick', team:tm, x:clamp(bx,6,79), y:clamp(by,8,192), r:6.5, life:11, max:11, seed:Math.random()*9 }); sfx('splash'); break; }
    case 'fireball': case 'homing': case 'triple': G.armed[tm] = { type:p, t:14 }; sfx('pickup'); if (tm === 'home' && !G.attract) toast(POWERS[p].name, 'Loaded on your next shot', 1300, 'small'); break;
    case 'mine': G.hz.mines.push({ x:user.x - Math.cos(user.face)*3.5, y:user.y - Math.sin(user.face)*3.5, r:1.4, team:tm, arm:0.6, dead:0, life:25 }); sfx('stick'); break;
    case 'magnet': user.magnet = 6; sfx('zap'); break;
    case 'shrink': { const g = goalieOf(opp); g.shrink = 8; G.beams.push({ x1:user.x, y1:user.y, x2:g.x, y2:g.y, c:'#7ef0ff', life:0.4, max:0.4 }); burst(g.x, g.y, 16, ['#7ef0ff','#ffffff'], 16, 0.5, 0.6); pop(g.x, g.y - 5, 'TINY GOALIE', '#7ef0ff', 13, 1.2); sfx('zap'); break; }
    case 'wall': { const y = tm === 'home' ? GB - 8 : GT + 8; G.walls.push({ team:tm, x1:30, x2:55, y, life:8, max:8 }); burst(CX, y, 24, ['#e8f6ff','#9fd6ff','#ffffff'], 14, 0.6, 0.7); sfx('freeze'); break; }
    case 'kaiju': user.kaiju = 6; sfx('grow'); shake(1.4); break;
    case 'lightning': for (const s of G.sk) { if (s.team !== opp || s.ko > 0) continue; G.bolts.push({ x:s.x, y:s.y, life:0.45, max:0.45, seg:mkBolt() }); s.stun = Math.max(s.stun, 1.3); s.down = Math.max(s.down || 0, 1.3); s.spin = 1.5; hurt(s, 48, tm, 'hit'); burst(s.x, s.y, 14, ['#fff7a8','#ffffff','#7ef0ff'], 20, 0.5, 0.6); } sfx('thunder'); shake(2); break;
    case 'freeze': for (const s of G.sk) if (s.team === opp && s.ko <= 0 && s.kaiju <= 0) { s.frozen = 3; s.charging = false; dropPuck(s, 6); } goalieOf(opp).frozen = 3; sfx('freeze'); shake(0.8); break;
  }
}
const mkBolt = () => { const pts = [[0,-40]]; for (let i=1;i<=7;i++) pts.push([rand(-3.5,3.5), -40 + i*(40/7)]); pts[7] = [0,0]; return pts; };

// ---------------- crates
function spawnCrate(){
  for (let i=0;i<60;i++){
    const x = rand(10, 75), y = rand(36, 164);
    if (!insideRink(x, y, 6)) continue;
    if (G.hz.placed.some(p => hyp(x-p.x, y-p.y) < p.r + 5)) continue;
    if (hyp(x-CX, y-100) < 4) continue;
    G.crates.push({ x, y, t:0, life:16 }); return;
  }
}
function crateLogic(dt){
  G.crateT -= dt;
  if (G.crateT <= 0 && G.crates.length < 2) { spawnCrate(); G.crateT = rand(5, 8); }
  for (let i=G.crates.length-1;i>=0;i--){
    const c = G.crates[i]; c.t += dt; c.life -= dt;
    if (c.life <= 0) { G.crates.splice(i,1); continue; }
    for (const s of G.sk) {
      if (s.ko > 0 || G.power[s.team] || hyp(s.x-c.x, s.y-c.y) > s.r + 2.2) continue;
      if (drillTeam(s.team)) continue;
      const pool = s.team === 'home' ? (G.attract ? ['rocket','slick','fireball','mine','kaiju'] : G.practice ? PORDER.filter(k => POWERS[k].lvl <= lvlInfo(save.xp).L) : save.loadout) : G.ch.cpu;
      const p = pick(pool.length ? pool : ['rocket']);
      G.power[s.team] = p; G.aiPowT[s.team] = rand(1.2, 3.5);
      burst(c.x, c.y, 16, ['#ffb51e','#ffffff'], 16, 0.5, 0.5);
      pop(c.x, c.y - 3, s.team === 'home' ? POWERS[p].name.toUpperCase() : `${G.ch.opp.abbr} GOT ${POWERS[p].name.toUpperCase()}`, s.team === 'home' ? '#ffb51e' : '#c9a4ff', 12, 1.3);
      sfx('pickup'); G.crates.splice(i,1); break;
    }
  }
}
