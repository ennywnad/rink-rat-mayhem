// Rink Rat Mayhem · The per-frame simulation step
'use strict';
// ---------------- update
function update(dt){
  if (!G) return;
  G.time += dt;
  if (G.goalLight) G.goalLight.t += dt;
  G.shake = Math.max(0, G.shake - dt*3);
  for (const a of [G.parts]) for (let i=a.length-1;i>=0;i--){ const p=a[i]; p.life-=dt; if(p.life<=0){a.splice(i,1);continue;} p.x+=p.vx*dt; p.y+=p.vy*dt; p.vx*=Math.exp(-3*dt); p.vy*=Math.exp(-3*dt); }
  for (const a of [G.pops, G.rings, G.bolts, G.beams]) for (let i=a.length-1;i>=0;i--){ a[i].life-=dt; if (a[i].life<=0) a.splice(i,1); }
  for (const p of G.pops) p.y -= dt*6;
  const H = G.hz;
  for (const v of H.vents) { v.t += dt; const ph = v.t % 5.5, on = ph > 4.4; if (on && !v.on) { v.hit = new Set(); sfx('fire', 0.6); } v.on = on; if (on) burst(v.x+rand(-1,1), v.y+rand(-1,1), 2, ['#ff6a1a','#ffb51e','#fff1b0'], 6, 0.9, 0.5); }
  for (const w of H.saws) { w.x += w.dir*w.sp*dt; if (w.x > 77) { w.x = 77; w.dir = -1; } if (w.x < 8) { w.x = 8; w.dir = 1; } w.a += dt*18; }
  for (let i=H.mines.length-1;i>=0;i--){ const m = H.mines[i]; if (m.arm > 0) m.arm -= dt; if (m.team) { m.life -= dt; if (m.life <= 0 || m.dead < 0) { H.mines.splice(i,1); continue; } } else if (m.dead > 0) { m.dead -= dt; if (m.dead <= 0) { m.dead = 0; const idx = H.placed.indexOf(m.spot); if (idx >= 0) H.placed.splice(idx,1); const s = placeSpot(1.6, H.placed); if (s) { m.x = s.x; m.y = s.y; m.spot = s; } m.arm = 0.8; } } }
  for (let i=G.traps.length-1;i>=0;i--){ G.traps[i].life -= dt; if (G.traps[i].life <= 0) G.traps.splice(i,1); }
  for (let i=G.walls.length-1;i>=0;i--){ G.walls[i].life -= dt; if (G.walls[i].life <= 0) { burst(CX, G.walls[i].y, 16, ['#e8f6ff','#9fd6ff'], 12, 0.5, 0.6); G.walls.splice(i,1); } }
  for (const tm of ['home','away']) if (G.armed[tm]) { G.armed[tm].t -= dt; if (G.armed[tm].t <= 0) G.armed[tm] = null; }
  for (let i=G.pucks.length-1;i>0;i--){ const b = G.pucks[i]; b.life -= dt; if (b.life <= 0) { burst(b.x, b.y, 6, ['#ffffff','#7ef0ff'], 8, 0.4, 0.4); G.pucks.splice(i,1); } }

  if (G.state === 'end') return;
  if (G.state === 'faceoff') { G.stT -= dt; if (G.stT <= 0) { G.state = 'play'; for (const s of G.sk) s.foT = null; const P = G.pucks[0]; P.vx = rand(-3,3); P.vy = rand(-1,1); sfx('whistle'); musicFade(); } else if (!G.sk.some(s => s.foT)) return; }
  if (G.replay) { stepReplay(dt); return; }
  if (G.state === 'goal' && !G.replayed && replayOn && !G.attract && G.stT <= 2.45) { G.replayed = true; startReplay(); if (G.replay) return; }
  if (G.state === 'goal' && G.vs && G.vs.ot && G.stT - dt <= 0) { endMatch(); return; }   // sudden death
  if (G.state === 'goal' || G.state === 'reset') { G.stT -= dt; if (G.stT <= 0) { startRegroup({ x:CX, y:100 }); return; } }
  if (G.state === 'regroup') { G.regT += dt; if (G.regT > 0.6) { const pending = G.sk.some(s => s.ko <= 0 && s.foT && hyp(s.x - s.foT[0], s.y - s.foT[1]) > 6); if (!pending || G.regT > 4.5) { finishRegroup(); return; } } }
  if (G.goalLight && G.state === 'play' && G.goalLight.t > 2.6) G.goalLight = null;
  if (G.state === 'play') {
    if (G.ch.len > 0) { G.clock -= dt; if (G.clock <= 0) { G.clock = 0; endMatch(); return; } }
    if (G.awayWait > 0) G.awayWait -= dt;
    if (rule('powerups')) crateLogic(dt);
    if ((!G.practice || G.effort === 'full' || G.mode === 'vs') && !teamHasHuman('away')) aiPowers('away', dt); if (G.attract) aiPowers('home', dt);
  }
  G.switchCd = Math.max(0, G.switchCd - dt); G.switchCd2 = Math.max(0, (G.switchCd2 || 0) - dt);
  const cs = ctrlSk();
  if (!G.attract && G.state === 'play') for (let p = 0; p < humans(); p++) {
    const hs = humanSk(p), tm = humanTeam(p), P = G.pucks[0];
    if (!hs || (p === 0 ? G.switchCd : G.switchCd2) > 0) continue;
    if (hs.ko > 0) autoSwitch(true, p);
    else if (G.mode !== 'coop' && !(P.owner && P.owner.team === tm) && !(P.passTo && P.passTo.team === tm)) autoSwitch(false, p);
  }
  for (const s of G.sk) {
    s.cool = Math.max(0, s.cool-dt); s.pokeCd = Math.max(0, s.pokeCd-dt); s.lunge = Math.max(0, s.lunge-dt); s.hitImm = Math.max(0, s.hitImm-dt);
    s.stun = Math.max(0, s.stun-dt); s.down = Math.max(0, (s.down || 0)-dt); s.swing = Math.max(0, (s.swing || 0)-dt); s.check = Math.max(0, (s.check || 0)-dt); s.frozen = Math.max(0, s.frozen-dt); s.inv = Math.max(0, s.inv-dt); s.slickCd = Math.max(0, s.slickCd-dt);
    s.rocket = Math.max(0, s.rocket-dt); s.kaiju = Math.max(0, s.kaiju-dt); s.magnet = Math.max(0, s.magnet-dt);
    if (s.rocket > 0) burst(s.x - Math.cos(s.face)*s.r, s.y - Math.sin(s.face)*s.r, 2, ['#ff6a1a','#ffb51e','#fff1b0'], 6, 0.7, 0.35);
    if (s.ko > 0) { s.ko -= dt; if (s.ko <= 0) { s.ko = 0; s.hp = 100; s.inv = 1.4; s.x = 4.5; s.y = s.team === 'home' ? 112 : 88; s.vx = 14; s.vy = 0; s.face = 0; s.stun = 0; } }
    if (s.hp < 100 && s.ko <= 0) s.hp = Math.min(100, s.hp + dt*2.5);
  }
  for (const s of G.sk) {
    s.skIn = null; s.recv = Math.max(0, (s.recv || 0) - dt); if (s.dk > 0) s.dk -= dt;
    s.dekeCd = Math.max(0, (s.dekeCd || 0) - dt); s.faked = Math.max(0, (s.faked || 0) - dt);
    if (s.deke) { s.deke.t += dt; if (s.deke.t >= s.deke.dur || G.pucks[0].owner !== s) s.deke = null; }
    if (s.ot > 0) { s.ot -= dt; if (s.ot <= 0 || G.pucks[0].passTo !== s) { s.ot = 0; if (G.pucks[0].owner !== s) s.charging = false; } else s.charge = Math.min(1, (s.charge || 0) + dt/0.6); }
    // computer players sometimes one-time a pass in the attacking zone
    const P = G.pucks[0];
    if (P.passTo === s && !isHuman(s) && !s.otTried && G.state === 'play') { s.otTried = true; if (hyp(CX - s.x, goalY(s.team) - s.y) < 46 && Math.random() < 0.35) armOneTimer(s); }
    if (P.passTo !== s) s.otTried = false;
  }
  for (let p = 0; p < humans(); p++) { const hs = humanSk(p); if (!hs || G.attract) continue;
    if ((G.state === 'play' || G.state === 'regroup') && hs.ko <= 0) { const v = readSkill(p); if (v[0] || v[1]) hs.skIn = v; }
    if (G.state === 'play') skillShot(hs, dt);
    if (hs.charging) hs.charge = Math.min(1, hs.charge + dt/TUNE.chargeTime);
    if (G.pucks[0].owner !== hs && !(hs.ot > 0)) hs.charging = false; }
  { const P = G.pucks[0], o = P.owner;   // AI puck carriers deke when a defender closes in front of them
    if (o && !isHuman(o) && (o.dk || 0) <= 0 && G.state === 'play') for (const d of G.sk) { if (d.team === o.team || d.ko > 0) continue; const dx = d.x - o.x, dy = d.y - o.y, dd = hyp(dx, dy); if (dd < 9 && Math.abs(angDiff(Math.atan2(dy, dx), o.face)) < 0.9 && Math.random() < dt*2.2) { if (!(o.dekeCd > 0) && Math.random() < 0.45 && startDeke(o, Math.random() < 0.5 ? null : [Math.cos(o.face + (o.dkA > 0 ? 1.2 : -1.2)), Math.sin(o.face + (o.dkA > 0 ? 1.2 : -1.2))])) break; o.dk = rand(0.3, 0.45); o.dkA = (o.dkA || 1) > 0 ? -1.15 : 1.15; break; } } }
  if (cs && !G.attract && cs.ko <= 0 && cs.stun <= 0 && cs.frozen <= 0) {   // stride sounds
    const csp = hyp(cs.vx, cs.vy), [ix, iy] = readInput();
    cs.strideT = (cs.strideT || 0) - dt;
    if (csp > 9 && (ix || iy) && !cs.braking && cs.strideT <= 0) { sfx('skate', 0.55 + csp/50); cs.strideT = 0.44 - Math.min(0.2, csp/130); }
  }
  const P0 = G.pucks[0]; if (P0.passTo) { P0.passT -= dt; if (P0.passT <= 0 || P0.owner) { P0.passTo = null; if (!P0.owner) P0.passBy = null; } }
  const inputs = G.sk.map(s => { const hp = humanOf(s); return (G.state === 'regroup' || G.state === 'faceoff') ? regroupInput(s) : (hp >= 0 && G.state === 'play') ? readInput(hp) : (G.state === 'play' ? aiSkater(s, dt) : [0,0]); });
  const sub = 3, h = dt/sub;
  for (let i=0;i<sub;i++){
    for (let k=0;k<G.sk.length;k++){ updSkater(G.sk[k], inputs[k][0], inputs[k][1], h); updBlade(G.sk[k], h); }
    for (let a=0;a<G.sk.length;a++) for (let b=a+1;b<G.sk.length;b++) contact(G.sk[a], G.sk[b]);
    for (const s of G.sk) skaterHazards(s, h);
    updGoalie(G.gH, h, 17*attrOf('home', 'goalie'), 0.32/attrOf('home', 'goalie'));
    updGoalie(G.gA, h, (12 + G.tier*1.2)*attrOf('away', 'goalie'), Math.max(0.24, 0.52 - G.tier*0.035)/attrOf('away', 'goalie'));
    for (const P of G.pucks) { stepPuck(P, h); if (G.state === 'reset' || G.state === 'end') break; }
    if (G.state === 'play') pickups();
    if (G.state === 'reset' || G.state === 'end') break;
  }
  if (G.state === 'play') { steals(dt); const Po = G.pucks[0].owner; if (Po) stat(Po.team, 'poss', dt); }
  if (G.state === 'faceoff' && G.foPuck) { const P = G.pucks[0]; P.x = G.foPuck.x; P.y = G.foPuck.y; P.vx = P.vy = 0; P.owner = null; }   // puck sits on the dot while stragglers settle
  for (const P of G.pucks) { const sp = hyp(P.vx, P.vy); P.trail.push([P.x, P.y, sp]); if (P.trail.length > 9) P.trail.shift(); }
  if (G.state === 'play' || G.state === 'goal') recordFrame();
}
