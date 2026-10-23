// Rink Rat Mayhem · Collisions, damage, skater movement, the stick blade, one-timers and dekes, shooting, passing, goalies, pucks and scoring
'use strict';
// ---------------- collisions
function boardCollide(o, r, rest){
  let hit = 0, cx = null, cy = null;
  if (o.x < CR) cx = CR; else if (o.x > RW-CR) cx = RW-CR;
  if (o.y < CR) cy = CR; else if (o.y > RL-CR) cy = RL-CR;
  if (cx!==null && cy!==null) {
    const dx=o.x-cx, dy=o.y-cy, d=hyp(dx,dy), lim=CR-r;
    if (d > lim) { const nx=dx/d, ny=dy/d; o.x=cx+nx*lim; o.y=cy+ny*lim; const vn=o.vx*nx+o.vy*ny; if (vn>0){ o.vx-=(1+rest)*vn*nx; o.vy-=(1+rest)*vn*ny; hit=vn; } }
  } else {
    if (o.x < r) { o.x=r; if (o.vx<0){ hit=-o.vx; o.vx=-o.vx*rest; o.vy*=0.94; } }
    if (o.x > RW-r) { o.x=RW-r; if (o.vx>0){ hit=o.vx; o.vx=-o.vx*rest; o.vy*=0.94; } }
    if (o.y < r) { o.y=r; if (o.vy<0){ hit=-o.vy; o.vy=-o.vy*rest; o.vx*=0.94; } }
    if (o.y > RL-r) { o.y=RL-r; if (o.vy>0){ hit=o.vy; o.vy=-o.vy*rest; o.vx*=0.94; } }
  }
  return hit;
}
function segPush(o, r, bounce, rest, segs){
  let hit = 0, post = false;
  for (let i=0;i<segs.length;i++){
    const [x1,y1,x2,y2] = segs[i];
    const sx=x2-x1, sy=y2-y1, l2=sx*sx+sy*sy;
    const t = clamp(((o.x-x1)*sx+(o.y-y1)*sy)/l2, 0, 1);
    const qx=x1+sx*t, qy=y1+sy*t;
    let dx=o.x-qx, dy=o.y-qy, d=hyp(dx,dy); const rr=r+0.25;
    if (d < rr) {
      if (d < 1e-6) { dx=0; dy=(y1<100?1:-1); d=1; }
      const nx=dx/d, ny=dy/d; o.x=qx+nx*rr; o.y=qy+ny*rr;
      const vn=o.vx*nx+o.vy*ny;
      if (vn < 0) {
        if (bounce) { o.vx-=(1+rest)*vn*nx; o.vy-=(1+rest)*vn*ny; if (-vn>hit){ hit=-vn; post=(i%3!==2)&&t<0.15; } }
        else { o.vx-=vn*nx; o.vy-=vn*ny; }
      }
    }
  }
  return { hit, post };
}
const wallSegs = () => G.walls.map(w => [w.x1, w.y, w.x2, w.y]);
function pushFromGoalie(s, g){
  if (g.off) return;
  const dx=s.x-g.x, dy=s.y-g.y, d=hyp(dx,dy), rr=s.r+g.r;
  if (d < rr && d > 0) { const nx=dx/d, ny=dy/d; s.x=g.x+nx*rr; s.y=g.y+ny*rr; const vn=s.vx*nx+s.vy*ny; if (vn<0){ s.vx-=vn*nx; s.vy-=vn*ny; } }
}

// ---------------- effects
function pop(x, y, text, color, size=18, life=1.1){ G.pops.push({ x, y, text, color, size, life, max:life }); }
function burst(x, y, n, colors, sp=20, size=0.6, life=0.7){
  for (let i=0;i<n && G.parts.length<420;i++){ const a=rand(0,Math.PI*2), v=rand(sp*0.3,sp); G.parts.push({ x, y, vx:Math.cos(a)*v, vy:Math.sin(a)*v, life:rand(life*0.5,life), max:life, c:pick(colors), s:rand(size*0.5,size*1.4) }); }
}
function ring(x, y, R, color, life=0.5){ G.rings.push({ x, y, R, c:color, life, max:life }); }
function shake(v){ if (A11Y.rm) return; G.shake = Math.max(G.shake, v); }

// ---------------- damage
function dropPuck(s, sp=12){
  const P = G.pucks[0];
  if (P.owner !== s) return;
  P.owner = null; s.charging = false; s.cool = 0.45;
  const a = rand(0, Math.PI*2); P.vx = s.vx*0.5 + Math.cos(a)*sp; P.vy = s.vy*0.5 + Math.sin(a)*sp; P.shotBy = null;
}
function hurt(s, dmg, byTeam, kind){
  if (s.ko > 0 || s.kaiju > 0 || s.inv > 0) return false;
  if (!rule('kos')) { dropPuck(s, 14); return false; }
  s.hp -= dmg; if (byTeam) { s.lastBy = byTeam; s.lastT = G.time; }
  dropPuck(s, 14);
  if (s.hp <= 0) { knockOut(s, kind); return true; }
  return false;
}
function knockOut(s, kind){
  s.hp = 0; s.ko = 4; s.charging = false; s.rocket = s.kaiju = s.magnet = 0; s.r = s.baseR; s.frozen = 0; s.stun = 0;
  dropPuck(s, 16);
  if (G.state === 'play' || G.state === 'goal') {
    G.kos[other(s.team)]++;
    if (!G.attract) checkObjLive();
  }
  const sp = SPECIES[s.species];
  burst(s.x, s.y, 26, [sp.head, sp.head, s.team==='home' ? HOME.jersey : G.ch.opp.jersey, '#ffffff'], 26, 0.8, 0.9);
  ring(s.x, s.y, 9, '#ffffff', 0.4);
  const msg = kind==='drown' ? 'SPLASH!' : kind==='well' ? 'SPAGHETTIFIED' : kind==='mine' ? 'KA-BOOM!' : kind==='saw' ? 'SHREDDED' : kind==='fire' ? 'TOASTED' : kind==='zam' ? 'RESURFACED' : 'KO!';
  pop(s.x, s.y - 4, msg, s.team==='home' ? '#ec3b4f' : '#ffb51e', 22, 1.4);
  if (s.team==='away') pop(s.x, s.y + 2, 'BODY COUNT +1', '#f1e7d0', 12, 1.4);
  sfx(kind==='drown' ? 'splash' : 'ko'); shake(1.2);
  { const hp = humanOf(s); if (hp >= 0) { rumble(1, 1, 380, hp); autoSwitch(true, hp); } }
}
function hit(att, vic, power, nx, ny){
  vic.hitImm = 0.45;
  if (vic.kaiju > 0 || vic.inv > 0) return;
  rumbleSk(vic, Math.min(1, power/55), 0.6, 200); rumbleSk(att, Math.min(0.6, power/90), 0.7, 140);
  G.hits[att.team]++;
  vic.vx += nx * (10 + power*TUNE.knockback); vic.vy += ny * (10 + power*TUNE.knockback);
  const big = power >= TUNE.knockPower;
  vic.stun = Math.max(vic.stun, big ? 0.95 + power/120 : 0.3 + power/170);
  if (big) vic.down = Math.max(vic.down || 0, vic.stun);
  vic.spin = (Math.random()<0.5?-1:1)*rand(1.2, 2.6)*(big ? 1 : 0.4);
  att.check = 0.34; att.checkDir = Math.atan2(ny, nx); att.vx *= TUNE.recoil; att.vy *= TUNE.recoil;
  const ko = hurt(vic, power, att.team, 'hit');
  if (!ko && power > 28) pop((att.x+vic.x)/2, (att.y+vic.y)/2 - 3, pick(HIT_WORDS), '#ffb51e', 15 + Math.min(10, power/8), 0.9);
  burst(vic.x, vic.y, 8 + Math.floor(power/8), ['#ffffff','#ffd77a', SPECIES[vic.species].head], 18, 0.5, 0.5);
  sfx('check'); shake(Math.min(1.4, power/45));
}
function explode(x, y, R, dmg, srcTeam, kind){
  for (const s of G.sk) {
    if (s.ko > 0 || (srcTeam && s.team === srcTeam)) continue;
    const d = hyp(s.x-x, s.y-y);
    if (d < R + s.r) {
      const k = 1 - d/(R+s.r)*0.6, nx = (s.x-x)/(d||1), ny = (s.y-y)/(d||1);
      s.vx += nx*45*k; s.vy += ny*45*k;
      if (s.kaiju <= 0) { s.stun = Math.max(s.stun, 1.0); s.down = Math.max(s.down || 0, 1.0); s.spin = rand(-3, 3); }
      hurt(s, dmg*k, srcTeam || (s.team==='home' ? 'away' : 'home'), kind);
    }
  }
  for (const P of G.pucks) { if (P.owner || P.hold) continue; const d = hyp(P.x-x, P.y-y); if (d < R*1.4) { const nx=(P.x-x)/(d||1), ny=(P.y-y)/(d||1); P.vx += nx*55; P.vy += ny*55; } }
  burst(x, y, 40, ['#ff6a1a','#ffb51e','#fff1b0','#3a2a22'], 34, 1.0, 0.8);
  ring(x, y, R*1.3, '#ffb51e', 0.45);
  sfx('boom'); shake(2.2);
}

// ---------------- skaters
const stickPt = s => { if (s.bl) return [s.bl.x, s.bl.y]; const reach = s.r + 1.7 + (s.lunge>0 ? 1.8 : 0); return [s.x + Math.cos(s.face)*reach, s.y + Math.sin(s.face)*reach]; };
// The blade lives in body space: a = angle off the skater's heading (+ = right side), r = distance from the body centre.
// The skill stick (right stick / IJKL) sets the target directly; otherwise players stickhandle on their own.
const BLADE_MAX = 2.35;
function bladeTarget(s){
  const P = G.pucks[0], own = P.owner === s, v = s.skIn, m = v ? hyp(v[0], v[1]) : 0;
  let a, r;
  if (m > 0.22) {
    const rel = angDiff(Math.atan2(v[1], v[0]), s.face);
    if (own && Math.abs(angDiff(Math.atan2(v[1], v[0]), shotRef(s))) > TUNE.backAngle*DEG) { a = Math.sign(rel || s.bl.a || 1)*BLADE_MAX; r = s.r + 0.9; }
    else if (Math.abs(rel) > 1.95) { a = Math.sign(rel || s.bl.a || 1)*BLADE_MAX; r = s.r + 0.9; }   // pulled back: drag the puck behind the hip
    else { a = rel; r = s.r + 0.6 + (rel < -0.4 ? TUNE.reach*0.73 : TUNE.reach)*Math.min(1, m); }   // backhand side reaches a little less
  } else if (own) {
    const ph = G.time*5.4 + s.idx*1.7, sp = hyp(s.vx, s.vy), calm = 1 - Math.min(0.65, sp/42);
    a = 0.14 + Math.sin(ph)*0.34*calm + Math.sin(ph*0.37 + 1)*0.1; r = s.r + 1.5 + Math.cos(ph*0.5)*0.15;
    if (s.dk > 0) { a = s.dkA; r = s.r + 2.1; }
    if (s.charging) { a = 0.05; r = s.r + 1.6; }
  } else {
    // without the puck: get the stick down toward a loose puck or an incoming pass
    const d = hyp(P.x - s.x, P.y - s.y);
    a = 0.12; r = s.r + 1.7;
    if (!P.owner && !P.hold && !P.ref && !P.sunk && (P.passTo === s || d < 9)) {
      const rel = angDiff(Math.atan2(P.y - s.y, P.x - s.x), s.face);
      if (Math.abs(rel) < 1.9) { a = rel*0.85; r = s.r + Math.min(2.5, 1.3 + d*0.22); }
    }
  }
  if (s.deke && own) [a, r] = dekeBlade(s);
  if (s.swing > 0) { a = clamp(angDiff(s.swingA, s.face), -1.2, 1.2)*0.8; r = s.r + 2.5; }   // pass / shot follow-through
  if (s.relT > 0) { a = 0.05; r = s.r + 1.9; }
  if (s.lunge > 0) { a *= 0.4; r += 1.9; }
  if (s.stun > 0 || s.frozen > 0) { a = 0.9; r = s.r + 1.2; }
  if (!isFinite(a)) a = 0.12; if (!isFinite(r)) r = s.r + 1.7;   // never let a bad target poison the blade
  return [clamp(a, -BLADE_MAX, BLADE_MAX), r];
}
function updBlade(s, h){
  const b = s.bl || (s.bl = { a:0.12, r:s.r + 1.7, va:0, vr:0, x:s.x, y:s.y, sp:0 });
  if (s.ko > 0) { b.x = s.x; b.y = s.y; b.sp = 0; return; }
  const [ta, tr] = bladeTarget(s), own = G.pucks[0].owner === s;
  const k = s.relT > 0 ? 900 : s.deke ? 650 : s.skIn ? TUNE.bladeSkill : TUNE.bladeAuto, c = 2*Math.sqrt(k), lim = s.relT > 0 || s.deke ? 34 : own ? TUNE.bladeLimit : Math.max(20, TUNE.bladeLimit);
  b.va = clamp(b.va + (k*(ta - b.a) - c*b.va)*h, -lim, lim); b.a = clamp(b.a + b.va*h, -BLADE_MAX, BLADE_MAX);
  b.vr += (k*(tr - b.r) - c*b.vr)*h; b.r = clamp(b.r + b.vr*h, s.deke ? s.r*0.25 : s.r + 0.5, s.r + 5);
  const wa = s.face + b.a, nx = s.x + Math.cos(wa)*b.r, ny = s.y + Math.sin(wa)*b.r;
  b.sp = hyp(nx - b.x - s.vx*h, ny - b.y - s.vy*h)/h; b.x = nx; b.y = ny;
}
// ---------------- one-timers and dekes
// One-timer: shoot while a pass is on its way and you fire it straight off the pass, harder and quicker than a normal shot.
function armOneTimer(s){
  if (s.ot > 0) return;
  s.ot = 0.9; s.charging = true; s.charge = 0.35;
}
function fireOneTimer(s){
  const P = G.pucks[0], gy = goalY(s.team);
  P.owner = s; s.ot = 0; s.charging = false;
  const v = s.skIn, base = v && hyp(v[0], v[1]) > 0.4 ? Math.atan2(v[1], v[0]) : Math.atan2(gy - P.y, CX - P.x);
  const err = isHuman(s) ? 0 : rand(-1, 1)*shotErr(s.team)*0.8;
  shoot(s, clamp(0.85 + (s.charge || 0)*0.27, 0, 1.12), assistAim(s, base) + err);
  stat(s.team, 'ot');
  pop(s.x, s.y - 5, 'ONE-TIMER!', s.team === 'home' ? '#ffb51e' : '#c9a4ff', 14, 1.0);
  if (isHuman(s)) rumbleSk(s, 0.3, 0.8, 120);
}
// Dekes: a toe drag pulls the puck wide then snaps it back across; between the legs tucks it behind and through.
// Defenders in front get fooled for a moment (no pokes, no checks on the carrier, a step slower).
function startDeke(s, stick){
  const P = G.pucks[0];
  if (P.owner !== s || s.charging || (s.dekeCd || 0) > 0 || s.stun > 0) return false;
  const m = stick ? hyp(stick[0], stick[1]) : 0;
  const kind = m > 0.4 ? 'drag' : 'btl', side = m > 0.4 ? (angDiff(Math.atan2(stick[1], stick[0]), s.face) >= 0 ? 1 : -1) : 1;
  s.deke = { t:0, dur: kind === 'btl' ? 0.55 : 0.42, kind, side }; s.dekeCd = 1.0; stat(s.team, 'dekes');
  if (kind === 'drag') { const a = s.face + side*Math.PI/2; s.vx += Math.cos(a)*5; s.vy += Math.sin(a)*5; }
  let fooled = 0;
  for (const d of G.sk) {
    if (d.team === s.team || d.ko > 0) continue;
    const dx = d.x - s.x, dy = d.y - s.y, dd = hyp(dx, dy);
    if (dd < 10 && Math.abs(angDiff(Math.atan2(dy, dx), s.face)) < 1.2) { d.faked = 0.55; d.charging = false; fooled++; }
  }
  if (fooled) pop(s.x, s.y - 5, kind === 'btl' ? 'BETWEEN THE LEGS!' : 'DANGLE!', s.team === 'home' ? '#ffb51e' : '#c9a4ff', 13, 0.9);
  sfx('stick', 0.8);
  return true;
}
function dekeBlade(s){
  const d = s.deke, f = d.t/d.dur;
  if (d.kind === 'drag') return f < 0.45 ? [d.side*1.35, s.r + 2.4] : [-d.side*0.45, s.r + 1.15];
  if (f < 0.35) return [2.25, s.r + 0.9];        // tuck it back by the hip
  if (f < 0.62) return [0, s.r*0.3];             // through the legs
  return [-0.15, s.r + 1.7];                     // out in front again
}
// assisted aim around a chosen direction: nudges toward the open side of the net when roughly on target
function assistAim(s, base){
  const P = G.pucks[0], gy = goalY(s.team), opp = goalieOf(other(s.team));
  const tx = opp.x > CX ? PL+1.1 : PRt-1.1;
  const ta = Math.atan2(gy - P.y, tx - P.x), df = angDiff(ta, base);
  const front = s.team==='home' ? P.y > gy+2 : P.y < gy-2;
  return front && Math.abs(df) < 0.6 ? base + df*TUNE.aimAssist : base;
}
// "forward" for the skill stick: toward the net in the attacking half, otherwise where the skater faces,
// so pulling the stick away from the net always loads a shot no matter which way you're skating
function shotRef(s){
  const P = G.pucks[0], gy = goalY(s.team), att = s.team === 'home' ? P.y < 100 : P.y > 100;
  return att ? Math.atan2(gy - P.y, CX - P.x) : s.face;
}
// right-stick shooting: pull back to load (the puck drags with the blade), push toward the target to sweep the blade
// through and release when it comes past the front of the body
function skillShot(s, dt){
  const P = G.pucks[0], v = s.skIn, m = v ? hyp(v[0], v[1]) : 0;
  if (s.relT > 0) {
    s.relT -= dt;
    if (P.owner !== s) { s.relT = 0; return; }
    if ((s.bl && Math.abs(s.bl.a) < 0.4) || s.relT <= 0) { s.relT = 0; shoot(s, s.relPow, s.relAng); }
    return;
  }
  if (P.owner !== s || s.charging) { s.wind = 0; return; }
  const ref = shotRef(s), sa = m > 0.22 ? Math.atan2(v[1], v[0]) : ref, rel = angDiff(sa, ref);
  if (m > 0.55 && Math.abs(rel) > TUNE.backAngle*DEG) { s.wind = Math.min(1, (s.wind || 0) + dt/TUNE.windTime); s.windT = 0.45; s.windAim = assistAim(s, ref); }
  else if ((s.wind || 0) > 0.08 && m > 0.5 && Math.abs(rel) < TUNE.releaseAngle*DEG) {
    s.relPow = clamp(TUNE.shotMin + (1 - TUNE.shotMin)*s.wind, 0, 1); s.relAng = assistAim(s, sa); s.relT = 0.16; s.wind = 0;
  } else { s.windT = (s.windT || 0) - dt; if (s.windT <= 0) s.wind = Math.max(0, (s.wind || 0) - dt*2.5); }
}
const skillAim = s => { const v = s.skIn, m = v ? hyp(v[0], v[1]) : 0; if (m < 0.4) return null; const a = Math.atan2(v[1], v[0]); return Math.abs(angDiff(a, s.face)) < 1.4 ? assistAim(s, a) : null; };
function updSkater(s, ix, iy, h){
  if (s.ko > 0) return;
  if (s.frozen > 0) { ix = iy = 0; s.vx *= Math.exp(-6*h); s.vy *= Math.exp(-6*h); }
  else if (s.stun > 0) { ix = iy = 0; s.face += s.spin*h; s.spin *= Math.exp(-2.2*h); }
  let max = s.max, acc = s.acc;
  if (s.charging) max *= 0.72;
  if (G.pucks[0].owner === s) max *= 0.94;
  if (s.rocket > 0) { max *= 1.6; acc *= 2.3; }
  if (s.slowed) max *= 0.55;
  const fz = freshAt(s.x, s.y); if (fz > 0) max *= 1 + 0.1*fz;
  if (s.faked > 0) max *= 0.7;
  if (G.low) acc *= 0.62;
  if (s.rocket > 0 && !ix && !iy && s.stun <= 0 && s.frozen <= 0) { ix = Math.cos(s.face); iy = Math.sin(s.face); }
  if (!(ix || iy) || hyp(s.vx, s.vy) <= 7) s.braking = false;
  if (ix || iy) {
    // skaters carve: at speed the velocity swings toward the stick direction along an arc (tighter when slow),
    // a hard reversal is a hockey stop, and from a near standstill they can push off any way they like
    const im = Math.min(1, hyp(ix, iy)), th = Math.atan2(iy, ix), sp = hyp(s.vx, s.vy), want = max*im;
    const vh = Math.atan2(s.vy, s.vx), dA = angDiff(th, vh);
    if (sp > 7 && Math.abs(dA) < TUNE.stopAngle*DEG && s.stun <= 0) {
      const rate = (TUNE.carveSlow - (TUNE.carveSlow - TUNE.carveFast)*Math.min(1, sp/Math.max(1, max))) * (s.charging ? 0.75 : 1) * (G.low ? 0.55 : 1) * (s.rocket > 0 ? 0.75 : 1) * (1 - 0.18*fz);
      const turnBy = clamp(dA, -rate*h, rate*h), nh = vh + turnBy;
      let ns = sp + clamp(want - sp, -acc*1.3*h, acc*h);
      ns -= Math.abs(turnBy)*sp*TUNE.carveBleed;                       // a hard carve bleeds a little speed
      s.vx = Math.cos(nh)*ns; s.vy = Math.sin(nh)*ns;
      s.face = turn(s.face, vh + clamp(dA, -0.55, 0.55), 9*h);   // look into the turn, not past it
    } else if (sp > 7 && s.stun <= 0) {
      if (!s.braking && s === ctrlSk()) sfx('stop', Math.min(1.1, sp/24));
      s.braking = true;
      const ns = Math.max(0, sp - acc*TUNE.stopBrake*h);                // hockey stop
      s.vx = s.vx/sp*ns; s.vy = s.vy/sp*ns;
      s.face = turn(s.face, th, 6*h);
    } else {
      const tvx=ix*max, tvy=iy*max, ax=tvx-s.vx, ay=tvy-s.vy, a=hyp(ax,ay), step=acc*h;
      if (a > step) { s.vx += ax/a*step; s.vy += ay/a*step; } else { s.vx = tvx; s.vy = tvy; }
      s.face = turn(s.face, th, 10*h);
    }
  } else if (s.frozen <= 0) {
    const f = Math.exp(-(G.low ? 0.4 : 1.5)*(1 - 0.55*fz)*h); s.vx *= f; s.vy *= f;
  }
  for (const w of G.hz.wells) {
    const dx=w.x-s.x, dy=w.y-s.y, d=hyp(dx,dy);
    if (d < w.R && s.kaiju <= 0) { const k = 75*(1-d/w.R); s.vx += dx/d*k*h; s.vy += dy/d*k*h; }
  }
  const tr = s.kaiju > 0 ? s.baseR*1.75 : s.baseR; s.r += (tr - s.r) * Math.min(1, h*6);
  s.x += s.vx*h; s.y += s.vy*h;
  const b = boardCollide(s, s.r, 0.25); if (b > 16) sfx('board', b*0.7);
  segPush(s, s.r, false, 0, NET_SK);
  if (G.walls.length) segPush(s, s.r, false, 0, wallSegs());
  pushFromGoalie(s, G.gH); pushFromGoalie(s, G.gA);
}
function skaterHazards(s, h){
  if (s.ko > 0) return;
  const H = G.hz; s.slowed = false;
  const immune = s.kaiju > 0 || s.inv > 0;
  for (const o of H.holes) if (!(o.frozen > 0) && hyp(s.x-o.x, s.y-o.y) < o.r - 0.9 && !immune) {
    burst(o.x, o.y, 20, ['#ffffff','#9fc3d8','#3b6b88'], 20, 0.6, 0.8); knockOut(s, 'drown'); return;
  }
  for (const v of H.vents) if (v.on && !v.hit.has(s) && hyp(s.x-v.x, s.y-v.y) < v.r + s.r) {
    v.hit.add(s); if (immune) continue;
    const nx=(s.x-v.x)||0.1, ny=(s.y-v.y)||0.1, d=hyp(nx,ny); s.vx += nx/d*30; s.vy += ny/d*30; s.stun = Math.max(s.stun, 1.0); s.down = Math.max(s.down || 0, 1.0); s.spin = 2;
    burst(s.x, s.y, 12, ['#ff6a1a','#ffb51e','#3a2a22'], 18, 0.7, 0.6);
    hurt(s, 38, other(s.team), 'fire'); sfx('fire');
  }
  for (const m of H.mines) {
    if (m.dead !== 0 || m.arm > 0 || (m.team && m.team === s.team)) continue;
    if (hyp(s.x-m.x, s.y-m.y) < m.r + s.r + 0.6) { m.dead = m.team ? -1 : 6; explode(m.x, m.y, 10, 58, m.team, 'mine'); }
  }
  for (const p of H.slime) if (!(p.clean > 0) && hyp(s.x-p.x, s.y-p.y) < p.r*0.85) { s.slowed = true; if (!immune && rule('kos')) { s.hp -= 7*h; if (s.hp <= 0) { s.lastBy = s.lastBy || other(s.team); knockOut(s, 'hit'); return; } } }
  for (const w of H.wells) if (hyp(s.x-w.x, s.y-w.y) < w.r && !immune) { burst(w.x, w.y, 18, ['#ffffff','#9db8ff','#3d2a80'], 16, 0.5, 0.8); knockOut(s, 'well'); return; }
  s.sawCd -= h;
  for (const w of H.saws) if (s.sawCd <= 0 && hyp(s.x-w.x, s.y-w.y) < w.r + s.r) {
    s.sawCd = 0.8; if (immune) continue;
    const ny = s.y > w.y ? 1 : -1; s.vy += ny*32; s.vx += w.dir*w.sp; s.stun = Math.max(s.stun, 0.95); s.down = Math.max(s.down || 0, 0.95); s.spin = 2.5;
    burst(s.x, s.y, 14, ['#ffffff','#c0c6cc','#ffd77a'], 22, 0.4, 0.5);
    hurt(s, 42, other(s.team), 'saw'); sfx('saw');
  }
  for (const t of G.traps) if (t.kind==='slick' && t.team !== s.team && s.slickCd <= 0 && hyp(s.x-t.x, s.y-t.y) < t.r) {
    s.slickCd = 1.6; if (immune) continue;
    s.stun = Math.max(s.stun, 1.1); s.spin = (Math.random()<0.5?-1:1)*11; dropPuck(s, 16);
    pop(s.x, s.y-3, 'WIPEOUT!', '#ffb51e', 14, 0.9);
  }
}
function contact(a, b){
  if (a.ko > 0 || b.ko > 0) return;
  const dx=b.x-a.x, dy=b.y-a.y, d=hyp(dx,dy), rr=a.r+b.r;
  if (d >= rr || d === 0) return;
  const nx=dx/d, ny=dy/d;
  const sa = a.vx*nx + a.vy*ny, sb = -(b.vx*nx + b.vy*ny);
  const ma = a.kaiju>0 ? 6 : 1, mb = b.kaiju>0 ? 6 : 1, tot = ma+mb;
  const ov = rr - d; a.x -= nx*ov*mb/tot; a.y -= ny*ov*mb/tot; b.x += nx*ov*ma/tot; b.y += ny*ov*ma/tot;
  const rv = (b.vx-a.vx)*nx + (b.vy-a.vy)*ny;
  if (rv < 0) { const j = -rv*0.9; a.vx -= nx*j*mb/tot; a.vy -= ny*j*mb/tot; b.vx += nx*j*ma/tot; b.vy += ny*j*ma/tot; }
  if (a.team === b.team || (G.state !== 'play' && G.state !== 'goal')) return;
  const att = sa >= sb ? a : b, vic = att === a ? b : a, sgn = att === a ? 1 : -1;
  if (vic.hitImm > 0 || att.faked > 0) return;
  const closing = -rv;
  if (G.state === 'regroup' || !rule('checking') || drillTeam(att.team)) return;
  let power = 0;
  if (att.kaiju > 0) power = 70;
  else if (att.rocket > 0 && closing > 6) power = 50;
  else if (closing > 13 && (att.lunge > 0 || closing > 24)) power = (closing-9)*2.1 + (att.lunge>0 ? 14 : 0);
  if (power > 0) hit(att, vic, power*attrOf(att.team, 'check'), nx*sgn, ny*sgn);
}
function knockLoose(o, by){
  stat(by.team, 'take');
  const P = G.pucks[0];
  P.owner = null; o.cool = 0.45; o.charging = false;
  const a = by.face + rand(-0.55, 0.55);
  P.vx = Math.cos(a)*15 + by.vx*0.4; P.vy = Math.sin(a)*15 + by.vy*0.4; P.shotBy = null;
  sfx('stick', 1);
}
function lunge(s, ang){
  if (s.pokeCd > 0 || s.ko > 0 || s.stun > 0 || s.frozen > 0) return;
  s.pokeCd = 0.65; s.lunge = 0.3; s.face = ang;
  s.vx += Math.cos(ang)*15; s.vy += Math.sin(ang)*15;
  const P = G.pucks[0], o = P.owner;
  if (o && o.team !== s.team && !o.deke && !(s.faked > 0)) {
    const [sx, sy] = stickPt(s);
    if (hyp(P.x-sx, P.y-sy) < 3.8 && Math.random() < (s.magnet>0 ? 0.95 : 0.62/attrOf(o.team, 'handle'))) knockLoose(o, s);
  }
  sfx('stick', 0.5);
}
function aimAngle(s){
  const P = G.pucks[0]; let ang = s.face;
  const gy = goalY(s.team), opp = goalieOf(other(s.team));
  const tx = opp.x > CX ? PL+1.1 : PRt-1.1;
  const ta = Math.atan2(gy - P.y, tx - P.x), df = angDiff(ta, ang);
  const front = s.team==='home' ? P.y > gy+2 : P.y < gy-2;
  if (front && Math.abs(df) < 1.05) ang += df*0.7;
  return ang;
}
function shoot(s, power, ang){
  const P = G.pucks[0];
  if (P.owner !== s) { s.charging = false; return; }
  stat(s.team, 'att');
  if (ang == null) ang = aimAngle(s);
  let sp = (46 + 74*power)*attrOf(s.team, 'shot')*TUNE.shotPower;
  const armed = G.armed[s.team]; G.armed[s.team] = null;
  if (armed && armed.type === 'fireball') sp *= 1.3;
  P.owner = null; P.vx = Math.cos(ang)*sp + s.vx*0.3; P.vy = Math.sin(ang)*sp + s.vy*0.3; s.wind = 0; s.recv = 0;
  P.shotBy = s.team; P.team = s.team; P.last = s.team; P.fire = 0; P.homing = 0; P.passTo = null; P.leak = null;
  P.icing = (s.team === 'home' ? P.y > 100 : P.y < 100) ? s.team : null;
  P.powered = s.rocket>0 || s.kaiju>0 || s.magnet>0 || !!armed;
  if (armed) {
    if (armed.type === 'fireball') { P.fire = 3; sfx('fire'); }
    if (armed.type === 'homing') { P.homing = 2.4; sfx('zap'); }
    if (armed.type === 'triple') {
      for (const da of [-0.2, 0.2]) { const b = mkPuck(); Object.assign(b, { x:P.x, y:P.y, vx:Math.cos(ang+da)*sp, vy:Math.sin(ang+da)*sp, bonus:true, life:2.6, shotBy:s.team, team:s.team, last:s.team, powered:true }); G.pucks.push(b); }
      sfx('zap');
    }
  }
  s.cool = 0.3; s.charging = false; s.charge = 0; s.swing = 0.28; s.swingA = ang;
  sfx('shot', power);
  rumbleSk(s, 0.1, 0.3 + power*0.5, 80);
}
function passTargets(s){ return G.sk.filter(m => m.team === s.team && m !== s && m.ko <= 0); }
function passPuck(s, pref){
  const P = G.pucks[0]; if (P.owner !== s) return false;
  const mates = passTargets(s); if (!mates.length) return false;
  stat(s.team, 'passTry');
  const pa = pref != null ? pref : s.face;
  let best = null, bs = 1e9;
  for (const m of mates) {
    const d = hyp(m.x-s.x, m.y-s.y), a = Math.atan2(m.y-s.y, m.x-s.x);
    let sc = Math.abs(angDiff(a, pa))*30 + d*0.15;
    for (const o of G.sk) { if (o.team === s.team || o.ko > 0) continue; const t = clamp(((o.x-s.x)*(m.x-s.x)+(o.y-s.y)*(m.y-s.y))/(d*d), 0, 1); const qx=s.x+(m.x-s.x)*t, qy=s.y+(m.y-s.y)*t; if (hyp(o.x-qx, o.y-qy) < 4) sc += 18; }
    if (sc < bs) { bs = sc; best = m; }
  }
  const d = hyp(best.x-s.x, best.y-s.y), sp = clamp(38 + d*0.85, 44, 82)*TUNE.passSpeed, lt = d/sp;
  const tx = best.x + best.vx*lt*0.85, ty = best.y + best.vy*lt*0.85, a = Math.atan2(ty-P.y, tx-P.x);
  P.owner = null; P.vx = Math.cos(a)*sp; P.vy = Math.sin(a)*sp; P.passTo = best; P.passT = 1.4; P.passBy = s.team; P.shotBy = null; P.last = s.team; P.team = s.team;
  P.icing = (s.team === 'home' ? P.y > 100 : P.y < 100) ? s.team : null;
  s.cool = 0.28; s.charging = false; s.swing = 0.24; s.swingA = a;
  { const hp = humanOf(s); if (hp >= 0 && !isHuman(best)) { setHuman(hp, best); if (hp === 0) G.switchCd = 0.6; else G.switchCd2 = 0.6; } }
  sfx('stick', 0.9);
  return { target:best, score:bs };
}

// ---------------- goalies
function updGoalie(g, dt, speed, react){
  if (g.off) { g.x = CX; g.y = g.team === 'away' ? -40 : RL + 40; return; }
  g.cool = Math.max(0, g.cool - dt); g.shrink = Math.max(0, g.shrink - dt); g.stun = Math.max(0, g.stun - dt); g.frozen = Math.max(0, g.frozen - dt);
  g.r += ((g.shrink > 0 ? G_R*0.45 : G_R) - g.r) * Math.min(1, dt*5);
  const top = g.team === 'away', gy = top ? GT : GB, P = G.pucks[0];
  if (g.hold > 0) { g.hold -= dt; if (g.hold <= 0) outlet(g); return; }
  g.save = Math.max(0, (g.save || 0) - dt);
  if (g.stun > 0) return;
  if (g.frozen > 0) return;
  const sp = g.shrink > 0 ? speed*0.6 : speed;
  let tgt = P;
  for (const b of G.pucks) if (b.bonus && hyp(b.x-CX, b.y-gy) < hyp(tgt.x-CX, tgt.y-gy)) tgt = b;
  const k = Math.min(1, dt/react);
  g.sx += (tgt.x - g.sx)*k; g.sy += (tgt.y - g.sy)*k;
  let ax = g.sx - CX, ay = g.sy - gy;
  if (top ? ay < 0.6 : ay > -0.6) ay = top ? 0.6 : -0.6;
  const d = hyp(ax, ay) || 1;
  const near = clamp((55 - Math.abs(g.sy - gy))/55, 0, 1), out = 2.8 + near*1.6;
  const tx = clamp(CX + ax/d*out, PL+0.2, PRt-0.2);
  let ty = gy + (ay/d)*out; ty = top ? Math.max(ty, gy+1.8) : Math.min(ty, gy-1.8);
  const mx=tx-g.x, my=ty-g.y, m=hyp(mx,my), step=sp*dt;
  if (m > step) { g.x += mx/m*step; g.y += my/m*step; } else { g.x = tx; g.y = ty; }
  g.face = Math.atan2(tgt.y - g.y, tgt.x - g.x);
}
function goaliePuck(g, P){
  if (P.hold || g.cool > 0 || g.off) return;
  if (P.icing && hyp(P.x-g.x, P.y-g.y) < g.r + PUCK_R) P.icing = null;
  const dx=P.x-g.x, dy=P.y-g.y, d=hyp(dx,dy)||0.001, rr=g.r+PUCK_R;
  if (d >= rr) return;
  const nx=dx/d, ny=dy/d;
  if (P.owner) {
    const o = P.owner; P.owner = null; o.cool = 0.5; o.charging = false;
    P.x = g.x+nx*rr; P.y = g.y+ny*rr; P.vx = nx*8; P.vy = ny*8; sfx('pad', 0.6); return;
  }
  if (P.fire > 0 && P.team !== g.team) {
    if (g.stun <= 0) { g.stun = 1.8; g.x += -ny*0; burst(g.x, g.y, 18, ['#ff6a1a','#ffb51e','#fff1b0'], 22, 0.7, 0.6); pop(g.x, g.y-4, 'GOALIE TOASTED', '#ffb51e', 14, 1.1); sfx('fire'); shake(1); }
    return;
  }
  const speed = hyp(P.vx, P.vy);
  if (P.shotBy && P.shotBy !== g.team && speed > 38 && G.state === 'play') {
    if (P.leak == null) {
      const gk = (g.team === 'away' ? 1.1 - G.tier*0.06 : 0.9) / attrOf(g.team, 'goalie');
      P.leak = Math.random() < clamp((speed-38)/90, 0, 0.5) * gk * (g.shrink > 0 ? 1.6 : 1);
      if (P.leak) pop(g.x, g.y - 4, pick(['FIVE-HOLE!','SIEVE!','THROUGH HIM!']), '#f1e7d0', 12, 0.9);
    }
    if (P.leak) return;
  }
  P.x = g.x+nx*rr; P.y = g.y+ny*rr;
  const vn = P.vx*nx + P.vy*ny;
  if (vn < 0) {
    if (P.shotBy && P.shotBy !== g.team && G.state === 'play') {
      G.sog[P.shotBy]++; stat(g.team, 'saves'); P.shotBy = null;
      // remember the save for the animation: which side (goalie's right is +) and whether it came in high
      g.save = 0.55; g.saveLat = clamp((dx*-Math.sin(g.face) + dy*Math.cos(g.face))/rr, -1, 1); g.saveHigh = speed > 58 ? 1 : 0;
    }
    P.vx -= 1.4*vn*nx; P.vy -= 1.4*vn*ny;
    const kk = rand(-0.5,0.5)*speed*0.4; P.vx += -ny*kk; P.vy += nx*kk;
    P.vx *= 0.55; P.vy *= 0.55; P.homing = 0;
    sfx('pad', Math.min(1, speed/60));
  }
  if (!P.bonus && G.state === 'play' && g.stun <= 0 && hyp(P.vx, P.vy) < 16) { P.hold = g; g.hold = 0.75; P.vx = P.vy = 0; P.shotBy = null; P.passTo = null; }
}
function outlet(g){
  const P = G.pucks[0], top = g.team === 'away';
  if (G.practice && g.team === 'away' && G.mode !== 'vs') {
    const corner = Math.random() < 0.5, tx = corner ? (Math.random() < 0.5 ? 10 : 75) : CX + rand(-6, 6), ty = corner ? 16 : 100 + rand(-4, 6);
    const a = Math.atan2(ty - P.y, tx - P.x), dist = hyp(tx - P.x, ty - P.y), sp = clamp(20 + dist*0.5, 26, 50);
    P.hold = null; P.x = g.x + Math.cos(a)*(g.r+PUCK_R+0.3); P.y = g.y + Math.sin(a)*(g.r+PUCK_R+0.3);
    P.vx = Math.cos(a)*sp; P.vy = Math.sin(a)*sp; P.shotBy = null; P.last = 'away'; P.team = 'away'; P.passTo = null; P.icing = null;
    g.cool = 0.6; sfx('stick', 0.8); return;
  }
  const mates = G.sk.filter(s => s.team === g.team && s.ko <= 0);
  const hpG = teamHasHuman(g.team) ? (g.team === 'away' ? 1 : 0) : -1, hs = hpG >= 0 ? humanSk(hpG) : null;
  let mate = (hs && hs.ko <= 0) ? hs : mates.sort((a,b) => (top ? b.y-a.y : a.y-b.y))[0];
  let tx, ty;
  if (mate) { tx = mate.x + mate.vx*0.35; ty = mate.y + mate.vy*0.35; }
  if (!mate || (top ? ty < GT+5 : ty > GB-5) || hyp(tx-P.x, ty-P.y) < 7) { tx = P.x < CX ? 8 : 77; ty = top ? 42 : 158; }
  const a = Math.atan2(ty-P.y, tx-P.x), dist = hyp(tx-P.x, ty-P.y), sp = Math.min(64, 28 + dist*0.55);
  P.hold = null;
  P.x = g.x + Math.cos(a)*(g.r+PUCK_R+0.3); P.y = g.y + Math.sin(a)*(g.r+PUCK_R+0.3);
  P.vx = Math.cos(a)*sp; P.vy = Math.sin(a)*sp; P.shotBy = null; P.last = g.team; P.team = g.team; P.passTo = mate || null; P.passT = 1.3;
  if (hpG >= 0 && mate && !isHuman(mate)) setHuman(hpG, mate);
  g.cool = 0.4; sfx('stick', 0.8);
}

// ---------------- pucks
function bodyPuck(P, s){
  if (s.ko > 0) return;
  const dx=P.x-s.x, dy=P.y-s.y, d=hyp(dx,dy), rr=s.r+PUCK_R;
  if (d < rr && d > 0) {
    const nx=dx/d, ny=dy/d;
    if (P.fire > 0 && P.team !== s.team && s.hitImm <= 0) {
      s.hitImm = 0.5; s.vx += P.vx*0.3; s.vy += P.vy*0.3; s.stun = Math.max(s.stun, 1.0); s.down = Math.max(s.down || 0, 1.0); s.spin = 3;
      hurt(s, 32, P.team, 'fire'); burst(s.x, s.y, 12, ['#ff6a1a','#ffb51e'], 18, 0.6, 0.5);
      P.vx *= 0.85; P.vy *= 0.85; return;
    }
    if (P === G.pucks[0] && G.state === 'play' && !P.owner && !P.hold && P.fire <= 0 && s.cool <= 0 && s.stun <= 0 && s.frozen <= 0 && !(s.team === 'away' && G.awayWait > 0)
        && (P.passTo === s || hyp(P.vx - s.vx, P.vy - s.vy) < (P.shotBy && P.shotBy !== s.team ? 22 : 40))) { P.icing = null; take(s); return; }
    P.x = s.x+nx*rr; P.y = s.y+ny*rr; P.icing = null;
    const vn = (P.vx-s.vx)*nx + (P.vy-s.vy)*ny;
    if (vn < 0) { P.vx -= 1.3*vn*nx; P.vy -= 1.3*vn*ny; if (-vn > 20) { P.shotBy = null; P.homing = 0; sfx('pad', 0.5); } }
  }
}
function checkGoal(P, py){
  if (G.state !== 'play') return;
  if (P.x > PL && P.x < PRt) {
    if (py > GT && P.y <= GT) scoreGoal('home', P);
    else if (py < GB && P.y >= GB) scoreGoal('away', P);
    return;
  }
  if (P.icing && !P.bonus && rule('icing')) {
    const t = P.icing;
    if ((t === 'home' && py > GT && P.y <= GT) || (t === 'away' && py < GB && P.y >= GB)) {
      P.icing = null; sfx('whistle');
      toast('Icing', `Faceoff in the ${t === 'home' ? 'Rats' : G.ch.opp.abbr} zone`, 1600, 'small');
      startRegroup({ x: P.x < CX ? 20.5 : 64.5, y: t === 'home' ? 169 : 31 });
    }
  }
}
function stepPuck(P, h){
  if (P.hold) { const g = P.hold, dir = g.team === 'away' ? 1 : -1; P.x = g.x; P.y = g.y + dir*(g.r+0.6); P.vx = P.vy = 0; return; }
  const py = P.y;
  if (P.owner) {
    const s = P.owner, [bx, by] = stickPt(s), tx = bx + Math.cos(s.face)*0.55, ty = by + Math.sin(s.face)*0.55;
    const k = Math.min(1, h*(s.deke ? 55 : s.recv > 0 ? 10 : TUNE.grip)), nx = P.x + (tx-P.x)*k, ny = P.y + (ty-P.y)*k;
    P.vx = (nx - P.x)/h; P.vy = (ny - P.y)/h; P.x = nx; P.y = ny;
    if (s.recv <= 0 && !s.deke && hyp(tx - P.x, ty - P.y) > TUNE.loseDist) { P.owner = null; s.cool = 0.3; s.charging = false; P.vx = s.vx*0.6; P.vy = s.vy*0.6; }
  } else {
    P.x += P.vx*h; P.y += P.vy*h;
    let fr = G.low ? 0.1 : 0.32;
    { const fz = freshAt(P.x, P.y); if (fz > 0) fr *= 1 - 0.6*fz; }   // fresh ice from the resurfacer is quick
    for (const p of G.hz.slime) if (!(p.clean > 0) && hyp(P.x-p.x, P.y-p.y) < p.r*0.85) fr = 2.6;
    const f = Math.exp(-fr*h); P.vx *= f; P.vy *= f;
    for (const w of G.hz.wells) { const dx=w.x-P.x, dy=w.y-P.y, d=hyp(dx,dy); if (d < w.R) { const k = 110*(1-d/w.R); P.vx += dx/d*k*h; P.vy += dy/d*k*h; } if (d < w.r) { const a = rand(0, Math.PI*2); P.x = w.x + Math.cos(a)*(w.r+1); P.y = w.y + Math.sin(a)*(w.r+1); P.vx = Math.cos(a)*55; P.vy = Math.sin(a)*55; ring(w.x, w.y, 6, '#9db8ff', 0.4); } }
    for (const s of G.sk) if (s.magnet > 0 && s.ko <= 0 && !P.bonus) { const [sx, sy] = stickPt(s), dx=sx-P.x, dy=sy-P.y, d=hyp(dx,dy); if (d < 32 && d > 0.5) { P.vx += dx/d*170*h; P.vy += dy/d*170*h; const v = hyp(P.vx,P.vy); if (v > 55) { P.vx *= 55/v; P.vy *= 55/v; } } }
    if (P.homing > 0) {
      P.homing -= h;
      const og = goalieOf(other(P.team)), gy = goalY(P.team), tx = og.x > CX ? PL+0.9 : PRt-0.9;
      const toward = (gy - P.y) * dirOf(P.team) < 0 ? false : true;
      if ((P.team==='home' ? P.y > gy : P.y < gy)) {
        const sp = hyp(P.vx, P.vy), cur = Math.atan2(P.vy, P.vx), want = Math.atan2(gy + dirOf(P.team)*1.5 - P.y, tx - P.x);
        const na = turn(cur, want, 5*h); P.vx = Math.cos(na)*Math.max(sp, 40); P.vy = Math.sin(na)*Math.max(sp, 40);
      }
      void toward;
    }
  }
  checkGoal(P, py);
  if (G.state === 'reset') return;
  if (P.owner) { boardCollide(P, PUCK_R, 0); segPush(P, PUCK_R, false, 0, NET); goaliePuck(G.gH, P); goaliePuck(G.gA, P); return; }
  const b = boardCollide(P, PUCK_R, 0.72);
  if (b > 6) { sfx('board', b); P.shotBy = null; P.homing = 0; }
  const n = segPush(P, PUCK_R, true, 0.45, NET);
  if (n.hit > 6) sfx(n.post ? 'post' : 'board', n.hit);
  if (G.walls.length) { const w = segPush(P, PUCK_R, true, 0.6, wallSegs()); if (w.hit > 6) { sfx('pad', 0.8); P.shotBy = null; P.homing = 0; P.fire = 0; } }
  for (const w of G.hz.saws) { const dx=P.x-w.x, dy=P.y-w.y, d=hyp(dx,dy), rr=w.r+PUCK_R; if (d < rr && d > 0) { const nx=dx/d, ny=dy/d; P.x = w.x+nx*rr; P.y = w.y+ny*rr; const vn = P.vx*nx+P.vy*ny; if (vn < 0) { P.vx -= 1.8*vn*nx; P.vy -= 1.8*vn*ny; P.vx += w.dir*20; sfx('saw'); burst(P.x, P.y, 5, ['#ffd77a','#ffffff'], 14, 0.3, 0.3); } } }
  goaliePuck(G.gH, P); goaliePuck(G.gA, P);
  for (const s of G.sk) bodyPuck(P, s);
  zamPuck(P);
  for (const o of G.hz.holes) if (!(o.frozen > 0) && hyp(P.x-o.x, P.y-o.y) < o.r - 0.6) {
    burst(P.x, P.y, 14, ['#ffffff','#9fc3d8'], 14, 0.5, 0.6); sfx('splash');
    if (P.bonus) { P.life = 0; return; }
    if (G.state === 'play' && !G.attract && !rule('faceoffs')) { Object.assign(P, { x:CX, y:100, vx:rand(-4,4), vy:rand(-4,4), sunk:false, icing:null, shotBy:null }); toast('Fresh puck', 'Dropped at center ice', 1100, 'small'); return; }
    if (G.state === 'play') { G.state = 'reset'; G.stT = 1.6; toast('Puck sunk', 'Faceoff at center', 1500, 'small'); sfx('whistle'); }
    P.vx = P.vy = 0; P.x = o.x; P.y = o.y; P.sunk = true; return;
  }
  if (P.fire > 0) { P.fire -= h; if (hyp(P.vx,P.vy) < 28) P.fire = 0; }
}
function take(s){
  const P = G.pucks[0];
  P.icing = null;
  if (P.passBy && G.state === 'play') { if (P.passBy === s.team) stat(s.team, 'passes'); else stat(s.team, 'take'); }   // completed pass or interception
  P.passBy = null;
  if (s.ot > 0 && G.state === 'play') { fireOneTimer(s); return; }
  P.owner = s; P.shotBy = null; P.last = s.team; P.team = s.team; P.passTo = null; P.fire = 0; P.homing = 0; P.powered = false;
  s.recv = 0.2; s.wind = 0; s.relT = 0;
  if (s.bl) { const rel = clamp(angDiff(Math.atan2(P.y - s.y, P.x - s.x), s.face), -BLADE_MAX, BLADE_MAX); s.bl.va += (rel - s.bl.a)*4; }
  if (!G.attract && !isHuman(s) && teamHasHuman(s.team) && !(G.mode === 'coop' && s.team === 'home')) setHuman(s.team === 'away' ? 1 : 0, s);
  else if (!G.attract && !isHuman(s) && s.team === 'home' && humans() === 1) setHuman(0, s);
  s.ai.think = rand(0.3, 0.7); s.ai.lane = pick([20, CX, 65]);
  sfx('stick', 0.6);
}
function pickups(){
  const P = G.pucks[0]; if (P.owner || P.hold || P.sunk || P.ref) return;
  let best = null, bd = 1e9;
  for (const s of G.sk) {
    if (s.ko > 0 || s.stun > 0 || s.frozen > 0 || s.cool > 0) continue;
    if (s.team === 'away' && G.awayWait > 0) continue;
    if (P.fire > 0 && P.team !== s.team) continue;
    const [sx, sy] = stickPt(s), d = hyp(P.x-sx, P.y-sy), rel = hyp(P.vx-s.vx, P.vy-s.vy);
    let rad = s.lunge > 0 ? 3.4 : 2.6; if (P.passTo === s) rad = 3.7; if (s.magnet > 0) rad = 4.4; if (s.kaiju > 0) rad += 1.2;
    if (d < rad && rel < (P.passTo === s ? 100 : 72) && d < bd) { best = s; bd = d; }
  }
  if (best) take(best);
}
function steals(dt){
  const P = G.pucks[0], o = P.owner; if (!o) return;
  for (const s of G.sk) {
    if (s.team === o.team || s.ko > 0 || s.stun > 0 || s.frozen > 0 || s.cool > 0) continue;
    if (o.deke || s.faked > 0) continue;
    if (isHuman(s)) {
      if (s.bl && s.bl.sp > 16 && s.pokeCd <= 0 && hyp(s.bl.x - P.x, s.bl.y - P.y) < 2.7) {
        s.pokeCd = 0.4;
        if (Math.random() < (s.magnet > 0 ? 0.95 : 0.7/attrOf(o.team, 'handle'))) { knockLoose(o, s); const a = s.face + s.bl.a + Math.sign(s.bl.va || 1)*1.2; P.vx = Math.cos(a)*16 + s.vx*0.4; P.vy = Math.sin(a)*16 + s.vy*0.4; return; }
        sfx('stick', 0.5);
      }
      continue;
    }
    const [sx, sy] = stickPt(s);
    if (hyp(sx-P.x, sy-P.y) < 2.8) {
      let rate = (s.team === 'away' ? 0.55 + G.tier*0.22 : 0.9) / attrOf(o.team, 'handle');
      if (drillTeam(s.team)) rate = G.effort === 'light' ? 0.35 : 0;
      if (s.magnet > 0) rate *= 3;
      if (Math.random() < rate*dt) { knockLoose(o, s); return; }
    }
  }
}

// ---------------- goals and flow
let toastTimer = 0;
function toast(main, sub, ms, cls){
  if (G && G.attract) return;
  const t = $('toast'); $('tMain').textContent = main; $('tSub').textContent = sub || '';
  t.className = 'toast' + (cls ? ' ' + cls : ''); t.hidden = true; void t.offsetWidth; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}
