// Rink Rat Mayhem · Ice resurfacers: an arena-themed machine drives out mid-game, laps the rink and leaves fresh, fast ice
'use strict';
// Each arena has its own machine. What they share: a solid body that skaters and pucks bounce off, a front end that
// flattens anyone it catches, a strip of fresh ice behind it (faster skating, quicker pucks) and some hazard clean-up:
// it freezes over open water, scrubs sludge puddles and sets off mines (it's armoured; you aren't).
const ZAM = {
  boneyard:{ name:'The Grave Digger', body:'#2a2631', trim:'#e9e2cc', glow:'#b38cff', ice:'rgba(214,226,255,' },
  magma:   { name:'The Slag Hauler',  body:'#3a2a24', trim:'#8a6a50', glow:'#ff6a1a', ice:'rgba(255,236,220,' },
  mines:   { name:'The Ore Crawler',  body:'#d1a234', trim:'#1e1a16', glow:'#ffe7a0', ice:'rgba(236,242,250,' },
  sludge:  { name:'The Muck Sucker',  body:'#4d6b22', trim:'#d2c27a', glow:'#a8ff3a', ice:'rgba(226,255,226,' },
  orbital: { name:'The Moon Buggy',   body:'#d4deee', trim:'#2c3f66', glow:'#6fd8ff', ice:'rgba(220,240,255,' },
  sawmill: { name:'The Log Skidder',  body:'#2f5d3a', trim:'#a8743a', glow:'#ffd77a', ice:'rgba(240,246,250,' },
  abyss:   { name:'The Angler',       body:'#3a1f5c', trim:'#c78cff', glow:'#7ef0ff', ice:'rgba(214,240,255,' },
};
const ZAM_LH = 3.6, ZAM_R = 2.8;            // body = capsule: half-length of the spine and radius (12.8 ft long, 5.6 ft wide)
const ZAM_SP = 14, ZAM_GATE = 148;          // cruising speed (ft/s); the ice crew gate is in the far side boards (x = 0) at this y, under the stands
const FRESH = 24;                           // seconds the fresh ice stays fast
const ICE_C = 2.5, ICE_W = Math.ceil(RW/ICE_C), ICE_H = Math.ceil(RL/ICE_C);
const zamTheme = () => ZAM[G.ch.id] || ZAM.boneyard;
const zamOn = () => !!G && !!G.rules && G.rules.hazards !== false && G.rules.zam !== false;

function zamInit(){
  G.zam = null; G.zamT = rand(18, 40); G.gate = 0; G.zamTrail = [];
  G.ice = new Float32Array(ICE_W*ICE_H).fill(-1e9);
}
const freshAt = (x, y) => {
  if (!G || !G.ice) return 0;
  const cx = Math.floor(x/ICE_C), cy = Math.floor(y/ICE_C); if (cx < 0 || cy < 0 || cx >= ICE_W || cy >= ICE_H) return 0;
  const age = G.time - G.ice[cy*ICE_W + cx]; return age < 0 ? 1 : Math.max(0, 1 - age/FRESH);
};
function stampIce(x, y, r){
  const x0 = Math.max(0, Math.floor((x - r)/ICE_C)), x1 = Math.min(ICE_W-1, Math.floor((x + r)/ICE_C));
  const y0 = Math.max(0, Math.floor((y - r)/ICE_C)), y1 = Math.min(ICE_H-1, Math.floor((y + r)/ICE_C));
  for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) if (hyp((cx + 0.5)*ICE_C - x, (cy + 0.5)*ICE_C - y) < r + ICE_C*0.5) G.ice[cy*ICE_W + cx] = G.time;
}

// route: out through the gate, one rounded lap at a random distance from the boards, back out the gate
function zamRoute(){
  const i = rand(13, 19), xa = i, xb = RW - i, ya = 30, yb = 170, gy = ZAM_GATE;
  const out = [-26, gy], inn = [7, gy];
  const lap = Math.random() < 0.5 ? [[xa, ya], [xb, ya], [xb, yb], [xa, yb]] : [[xa, yb], [xb, yb], [xb, ya], [xa, ya], [xa, gy - 30]];
  const P = [out, inn, ...lap, inn, out];
  // round every corner with a quadratic curve, then resample every foot
  const R = 11, pts = [P[0]];
  for (let k = 1; k < P.length - 1; k++) {
    const [ax, ay] = P[k-1], [bx, by] = P[k], [cx, cy] = P[k+1];
    const l1 = hyp(bx-ax, by-ay), l2 = hyp(cx-bx, cy-by), t = Math.min(R, l1/2, l2/2);
    const p0 = [bx + (ax-bx)/l1*t, by + (ay-by)/l1*t], p1 = [bx + (cx-bx)/l2*t, by + (cy-by)/l2*t];
    for (let q = 0; q <= 10; q++) { const u = q/10, a = (1-u)*(1-u), b = 2*(1-u)*u, c = u*u; pts.push([a*p0[0] + b*bx + c*p1[0], a*p0[1] + b*by + c*p1[1]]); }
  }
  pts.push(P[P.length-1]);
  const xs = [], ys = []; let carry = 0;
  xs.push(pts[0][0]); ys.push(pts[0][1]);
  for (let k = 1; k < pts.length; k++) {
    const [ax, ay] = pts[k-1], [bx, by] = pts[k], L = hyp(bx-ax, by-ay); if (L < 1e-6) continue;
    let s = 1 - carry;
    while (s <= L) { xs.push(ax + (bx-ax)*s/L); ys.push(ay + (by-ay)*s/L); s += 1; }
    carry = L - (s - 1);
  }
  return { xs, ys, L: xs.length - 1 };
}
function zamPose(Z){
  const p = Z.path, i = Math.min(p.L - 1, Math.max(0, Math.floor(Z.d))), f = Math.min(1, Z.d - i);
  Z.x = p.xs[i] + (p.xs[i+1] - p.xs[i])*f; Z.y = p.ys[i] + (p.ys[i+1] - p.ys[i])*f;
  const a = Math.max(0, i - 2), b = Math.min(p.L, i + 3);
  Z.a = Math.atan2(p.ys[b] - p.ys[a], p.xs[b] - p.xs[a]);
}
function zamSpawn(){
  const th = zamTheme();
  G.zam = { path: zamRoute(), d:0, sp:7, x:0, y:0, a:-Math.PI/2, name: th.name, honk:0, lastT:null };
  zamPose(G.zam);
  if (!G.attract) {
    toast('Ice time', `${th.name} is on the ice`, 1700, 'small');
    if (typeof organ === 'function' && !cueOn()) organ('noodle', 0.3);
  }
}
// nearest point on the body's spine
function zamNear(px, py){
  const Z = G.zam, c = Math.cos(Z.a), s = Math.sin(Z.a), t = clamp((px - Z.x)*c + (py - Z.y)*s, -ZAM_LH, ZAM_LH);
  return [Z.x + c*t, Z.y + s*t, t];
}
const zamTouch = (x, y, r) => { const [qx, qy] = zamNear(x, y); return hyp(x - qx, y - qy) < ZAM_R + r; };

function zamStep(dt){
  const H = G.hz;
  for (const o of H.holes) if (o.frozen > 0) o.frozen -= dt;
  for (const p of H.slime) if (p.clean > 0) p.clean -= dt;
  for (const s of G.sk) if (s.zamCd > 0) s.zamCd -= dt;
  const Z = G.zam;
  G.gate = clamp(G.gate + (Z && (Z.d < 42 || Z.d > Z.path.L - 42) ? 1.8 : -1.2)*dt, 0, 1);
  const tr = G.zamTrail; while (tr.length && G.time - tr[0].t > FRESH + 1) tr.shift();
  if (!Z) {
    if (zamOn() && G.state === 'play' && G.ch.id) { G.zamT -= dt; if (G.zamT <= 0) zamSpawn(); }
    return;
  }
  // creep through the gate, cruise the lap
  const want = Z.d < 14 || Z.path.L - Z.d < 14 ? 7 : ZAM_SP;
  Z.sp += clamp(want - Z.sp, -7*dt, 7*dt);
  Z.d += Z.sp*dt;
  if (Z.d >= Z.path.L) { G.zam = null; G.zamT = rand(55, 85); return; }
  zamPose(Z);
  const c = Math.cos(Z.a), s = Math.sin(Z.a);
  // the conditioner at the back lays down fresh water
  const bx = Z.x - c*(ZAM_LH + ZAM_R*0.5), by = Z.y - s*(ZAM_LH + ZAM_R*0.5);
  if (bx > 0.5 && bx < RW - 0.5) {
    stampIce(bx, by, ZAM_R);
    const last = tr[tr.length - 1];
    if (!last || hyp(bx - last.x, by - last.y) > 1.2) tr.push({ x:bx, y:by, a:Z.a, t:G.time });
  }
  // hazard clean-up
  for (const o of H.holes) if (zamTouch(o.x, o.y, o.r*0.6)) { if (!(o.frozen > 0)) { burst(o.x, o.y, 12, ['#ffffff','#cfe8ff'], 10, 0.5, 0.5); sfx('freeze', 0.5); } o.frozen = 20; }
  for (const p of H.slime) if (zamTouch(p.x, p.y, p.r*0.6)) p.clean = 20;
  for (const m of H.mines) if (m.dead === 0 && m.arm <= 0 && zamTouch(m.x, m.y, m.r)) { m.dead = m.team ? -1 : 6; explode(m.x, m.y, 10, 58, m.team, 'mine'); }
  // skaters bounce off the body; the front end flattens anyone it catches
  let ahead = false;
  for (const k of G.sk) {
    if (k.ko > 0) continue;
    const [qx, qy, t] = zamNear(k.x, k.y), dx = k.x - qx, dy = k.y - qy, d = hyp(dx, dy), rr = ZAM_R + k.r;
    const fx = k.x - Z.x, fy = k.y - Z.y, along = fx*c + fy*s, side = -fx*s + fy*c;
    if (along > 0 && along < ZAM_LH + ZAM_R + 9 && Math.abs(side) < ZAM_R + k.r + 0.5) ahead = true;
    if (d >= rr) continue;
    const nx = d > 0.01 ? dx/d : -s, ny = d > 0.01 ? dy/d : c;
    k.x = qx + nx*rr; k.y = qy + ny*rr;
    const rv = (k.vx - c*Z.sp)*nx + (k.vy - s*Z.sp)*ny;
    if (rv < 0) { k.vx -= rv*1.15*nx; k.vy -= rv*1.15*ny; }
    if (t > ZAM_LH*0.55 && nx*c + ny*s > 0.3 && !(k.zamCd > 0) && k.kaiju <= 0 && k.inv <= 0) {
      k.zamCd = 1.4;
      const sd = side >= 0 ? 1 : -1;
      k.vx += c*(Z.sp*0.5 + 6) - s*sd*13; k.vy += s*(Z.sp*0.5 + 6) + c*sd*13;
      k.stun = Math.max(k.stun, 1.1); k.down = Math.max(k.down || 0, 1.1); k.spin = sd*rand(2, 3.5);
      const ko = hurt(k, G.ch.id === 'sawmill' ? 40 : 30, null, 'zam');
      if (!ko) pop(k.x, k.y - 3, 'FLATTENED!', '#ffb51e', 16, 1.0);
      burst(k.x, k.y, 12, ['#ffffff', '#cfe8ff', SPECIES[k.species].head], 18, 0.5, 0.6);
      sfx('check'); shake(0.9); rumbleSk(k, 0.8, 0.8, 260);
    }
  }
  Z.honk -= dt;
  if (ahead && Z.honk <= 0 && Z.d > 20) { Z.honk = 3.5; sfx('zamhorn'); }
}
// pucks carom off the machine
function zamPuck(P){
  const Z = G.zam; if (!Z || P.owner || P.hold) return;
  const [qx, qy] = zamNear(P.x, P.y), dx = P.x - qx, dy = P.y - qy, d = hyp(dx, dy), rr = ZAM_R + PUCK_R;
  if (d >= rr || d < 1e-4) return;
  const nx = dx/d, ny = dy/d, zvx = Math.cos(Z.a)*Z.sp, zvy = Math.sin(Z.a)*Z.sp;
  P.x = qx + nx*rr; P.y = qy + ny*rr;
  const vn = (P.vx - zvx)*nx + (P.vy - zvy)*ny;
  if (vn < 0) { P.vx -= 1.55*vn*nx; P.vy -= 1.55*vn*ny; if (-vn > 6) { sfx('board', -vn*0.8); P.shotBy = null; P.homing = 0; } }
}
// replay support
const zamSnap = () => G.zam ? G.zam.d : -1;
function zamApply(d){
  if (d < 0 || !G.zam) { if (G.zam) G.zam.hide = d < 0; return; }
  G.zam.hide = false; G.zam.d = d; zamPose(G.zam);
}
