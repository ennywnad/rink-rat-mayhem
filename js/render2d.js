// Rink Rat Mayhem · Classic top-down 2D renderer and the scoreboard HUD
'use strict';
// ---------------- rendering
let cw = 1, ch = 1, dpr = 1, scale = 4, camY = 100, OX = 0, OY = 0;
const rinkC = document.createElement('canvas');
const RM = 14;
function rrPath(g, x, y, w, h, r){ g.beginPath(); g.moveTo(x+r,y); g.arcTo(x+w,y,x+w,y+h,r); g.arcTo(x+w,y+h,x,y+h,r); g.arcTo(x,y+h,x,y,r); g.arcTo(x,y,x+w,y,r); g.closePath(); }
function buildRink(){
  if (!G) return;
  const th = G.theme, s = scale*dpr;
  rinkC.width = Math.ceil((RW+2*RM)*s); rinkC.height = Math.ceil((RL+2*RM)*s);
  const g = rinkC.getContext('2d');
  g.setTransform(s,0,0,s,RM*s,RM*s);
  g.fillStyle = th.floor; g.fillRect(-RM,-RM,RW+2*RM,RL+2*RM);
  let seed = 7 + G.ch.tier*31; const rnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
  for (let i=0;i<170;i++){
    const x = -RM + rnd()*(RW+2*RM), y = -RM + rnd()*(RL+2*RM);
    if (insideRink(x, y, -4)) continue;
    g.save(); g.translate(x, y); g.rotate(rnd()*6.28);
    switch (th.decor) {
      case 'tomb': g.fillStyle = '#3c453c'; rrPath(g,-1.6,-2.2,3.2,4.4,1.4); g.fill(); g.fillStyle = '#2a312a'; g.fillRect(-0.2,-1.4,0.4,2); g.fillRect(-0.8,-0.8,1.6,0.4); break;
      case 'lava': g.strokeStyle = `rgba(255,${80+rnd()*80|0},20,.75)`; g.lineWidth = 0.3+rnd()*0.4; g.beginPath(); g.moveTo(0,0); for (let k=0;k<4;k++) g.lineTo(rnd()*6-3, rnd()*6-3); g.stroke(); break;
      case 'rock': g.fillStyle = rnd()<0.5 ? '#2e2620' : '#3a3029'; g.beginPath(); g.ellipse(0,0,1+rnd()*2,0.8+rnd()*1.5,0,0,7); g.fill(); break;
      case 'barrel': g.fillStyle = '#c9b43a'; g.beginPath(); g.arc(0,0,1.7,0,7); g.fill(); g.strokeStyle = '#4a4212'; g.lineWidth = 0.25; g.beginPath(); g.arc(0,0,1.2,0,7); g.stroke(); g.fillStyle='#4a4212'; g.beginPath(); g.arc(0.5,0.3,0.3,0,7); g.fill(); break;
      case 'stars': g.fillStyle = `rgba(255,255,255,${0.3+rnd()*0.7})`; g.beginPath(); g.arc(0,0,0.12+rnd()*0.3,0,7); g.fill(); break;
      case 'logs': g.fillStyle = '#5a3a1e'; rrPath(g,-3.5,-0.9,7,1.8,0.9); g.fill(); g.fillStyle = '#a07040'; g.beginPath(); g.arc(3.3,0,0.85,0,7); g.fill(); break;
      case 'tent': g.strokeStyle = 'rgba(122,79,160,.7)'; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(0,0); g.bezierCurveTo(2,-2,4,2,6,0); g.stroke(); break;
    }
    g.restore();
  }
  rrPath(g,-1.8,-1.8,RW+3.6,RL+3.6,CR+1.8); g.fillStyle = th.boards; g.fill(); g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 0.3; g.stroke();
  rrPath(g,-0.8,-0.8,RW+1.6,RL+1.6,CR+0.8); g.fillStyle = th.kick; g.fill();
  rrPath(g,0,0,RW,RL,CR); g.save(); g.clip();
  const grad = g.createLinearGradient(0,0,RW,0); grad.addColorStop(0, th.ice2); grad.addColorStop(0.5, th.ice); grad.addColorStop(1, th.ice2);
  g.fillStyle = grad; g.fillRect(0,0,RW,RL);
  g.lineWidth = 0.08;
  for (let i=0;i<340;i++){ const x=rnd()*RW, y=rnd()*RL, r=5+rnd()*34, a=rnd()*6.28; g.strokeStyle=`rgba(${th.scr},${0.05+rnd()*0.12})`; g.beginPath(); g.arc(x,y,r,a,a+0.25+rnd()*0.6); g.stroke(); }
  const RED = '#c62a2f', BLUE = '#2a55b8';
  g.fillStyle = RED; g.fillRect(0,99.5,RW,1);
  g.fillStyle = BLUE; g.fillRect(0,74.5,RW,1); g.fillRect(0,124.5,RW,1);
  g.fillStyle = RED; g.fillRect(0,GT-0.1,RW,0.2); g.fillRect(0,GB-0.1,RW,0.2);
  g.strokeStyle = BLUE; g.lineWidth = 0.25; g.beginPath(); g.arc(CX,100,15,0,7); g.stroke();
  // center ice emblem: crossed bones under a rat skull silhouette
  g.save(); g.translate(CX,100); g.globalAlpha = 0.16; g.fillStyle = '#1d1305';
  for (const a of [0.7,-0.7]) { g.save(); g.rotate(a); rrPath(g,-9,-0.7,18,1.4,0.7); g.fill(); for (const sx of [-9,9]) { g.beginPath(); g.arc(sx,-0.8,1.1,0,7); g.arc(sx,0.8,1.1,0,7); g.fill(); } g.restore(); }
  g.beginPath(); g.ellipse(0,-0.5,4.6,4,0,0,7); g.fill(); g.beginPath(); g.moveTo(-2.4,2); g.lineTo(0,6.4); g.lineTo(2.4,2); g.fill();
  g.beginPath(); g.arc(-3.6,-4,2.2,0,7); g.arc(3.6,-4,2.2,0,7); g.fill();
  g.globalAlpha = 0.5; g.fillStyle = th.ice; g.beginPath(); g.arc(-1.7,-0.6,1.1,0,7); g.arc(1.7,-0.6,1.1,0,7); g.fill();
  g.restore();
  g.fillStyle = RED; for (const [x,y] of [[20.5,80],[64.5,80],[20.5,120],[64.5,120]]) { g.beginPath(); g.arc(x,y,1,0,7); g.fill(); }
  for (const [x,y] of [[20.5,31],[64.5,31],[20.5,169],[64.5,169]]) {
    g.strokeStyle = RED; g.lineWidth = 0.25; g.beginPath(); g.arc(x,y,15,0,7); g.stroke();
    g.fillStyle = RED; g.beginPath(); g.arc(x,y,1,0,7); g.fill();
  }
  for (const [gy,a0,a1] of [[GT,0,Math.PI],[GB,Math.PI,2*Math.PI]]) { g.beginPath(); g.moveTo(CX+6*Math.cos(a0),gy); g.arc(CX,gy,6,a0,a1); g.closePath(); g.fillStyle='rgba(110,178,232,.5)'; g.fill(); g.strokeStyle=RED; g.lineWidth=0.17; g.stroke(); }
  // bench doors
  g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0,84,1.2,8); g.fillRect(0,108,1.2,8);
  g.restore();
  for (const [gy,dir] of [[GT,-1],[GB,1]]) {
    const y0 = dir < 0 ? gy-ND : gy;
    g.fillStyle = 'rgba(255,255,255,.82)'; g.fillRect(PL,y0,PRt-PL,ND);
    g.strokeStyle = 'rgba(90,100,115,.35)'; g.lineWidth = 0.06; g.beginPath();
    for (let x=PL+0.6;x<PRt;x+=0.6){ g.moveTo(x,y0); g.lineTo(x,y0+ND); } for (let y=y0+0.6;y<y0+ND;y+=0.6){ g.moveTo(PL,y); g.lineTo(PRt,y); } g.stroke();
    g.strokeStyle = RED; g.lineWidth = 0.32; g.lineJoin = 'round'; g.beginPath(); g.moveTo(PL,gy); g.lineTo(PL,gy+dir*ND); g.lineTo(PRt,gy+dir*ND); g.lineTo(PRt,gy); g.stroke();
    g.fillStyle = RED; for (const px of [PL,PRt]) { g.beginPath(); g.arc(px,gy,0.32,0,7); g.fill(); }
  }
}
function resize(){
  const r = stage.getBoundingClientRect();
  cw = Math.max(1, r.width); ch = Math.max(1, r.height);
  dpr = Math.min(2.5, window.devicePixelRatio || 1);
  cv.width = Math.round(cw*dpr); cv.height = Math.round(ch*dpr);
  scale = Math.min(cw/(RW+8), ch/112);
  buildRink();
}
const circ = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); };
const ell = (x, y, rx, ry) => { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); };
function drawHead(sp, r, t){
  const c = SPECIES[sp], hr = r*0.46;
  ctx.lineCap = 'round';
  switch (sp) {
    case 'rat':
      ctx.fillStyle = c.acc; circ(-0.15, -hr*1.05, hr*0.55); ctx.fill(); circ(-0.15, hr*1.05, hr*0.55); ctx.fill();
      ctx.fillStyle = c.head; circ(0.2, 0, hr); ctx.fill();
      ctx.beginPath(); ctx.moveTo(hr*0.5, -hr*0.6); ctx.lineTo(hr*1.75, 0); ctx.lineTo(hr*0.5, hr*0.6); ctx.fill();
      ctx.fillStyle = c.acc; circ(hr*1.7, 0, hr*0.2); ctx.fill();
      ctx.fillStyle = '#1b1520'; circ(hr*0.75, -hr*0.4, hr*0.15); ctx.fill(); circ(hr*0.75, hr*0.4, hr*0.15); ctx.fill(); break;
    case 'skeleton':
      ctx.fillStyle = c.head; circ(0.2, 0, hr*1.05); ctx.fill(); ctx.fillRect(hr*0.5, -hr*0.55, hr*0.7, hr*1.1);
      ctx.fillStyle = c.acc; circ(hr*0.55, -hr*0.42, hr*0.3); ctx.fill(); circ(hr*0.55, hr*0.42, hr*0.3); ctx.fill();
      ctx.strokeStyle = c.acc; ctx.lineWidth = 0.12; ctx.beginPath(); for (let i=-2;i<=2;i++){ ctx.moveTo(hr*1.05, i*hr*0.2); ctx.lineTo(hr*1.25, i*hr*0.2); } ctx.stroke(); break;
    case 'troll':
      ctx.fillStyle = c.acc; for (const sy of [-1,1]) { ctx.beginPath(); ctx.moveTo(0, sy*hr*0.6); ctx.lineTo(-hr*1.2, sy*hr*1.6); ctx.lineTo(hr*0.4, sy*hr*0.9); ctx.fill(); }
      ctx.fillStyle = c.head; circ(0.2, 0, hr); ctx.fill(); ctx.fillStyle = '#ffd24a'; circ(hr*0.7, -hr*0.35, hr*0.17); ctx.fill(); circ(hr*0.7, hr*0.35, hr*0.17); ctx.fill(); break;
    case 'gremlin':
      ctx.fillStyle = c.head; for (const sy of [-1,1]) { ctx.beginPath(); ctx.moveTo(0, sy*hr*0.5); ctx.lineTo(-hr*0.8, sy*hr*2.2); ctx.lineTo(hr*0.5, sy*hr*0.8); ctx.fill(); }
      ctx.fillStyle = c.acc; for (const sy of [-1,1]) { ctx.beginPath(); ctx.moveTo(0, sy*hr*0.6); ctx.lineTo(-hr*0.55, sy*hr*1.8); ctx.lineTo(hr*0.3, sy*hr*0.85); ctx.fill(); }
      ctx.fillStyle = c.head; circ(0.2, 0, hr); ctx.fill(); ctx.fillStyle = '#ffef6a'; circ(hr*0.7, -hr*0.38, hr*0.22); ctx.fill(); circ(hr*0.7, hr*0.38, hr*0.22); ctx.fill(); break;
    case 'hog':
      ctx.fillStyle = c.head; circ(0.2, 0, hr*1.05); ctx.fill(); ctx.fillStyle = c.acc; ell(hr*1.1, 0, hr*0.42, hr*0.55); ctx.fill();
      ctx.fillStyle = '#5a3020'; circ(hr*1.25, -hr*0.18, hr*0.1); ctx.fill(); circ(hr*1.25, hr*0.18, hr*0.1); ctx.fill();
      ctx.strokeStyle = '#fffbe8'; ctx.lineWidth = 0.22; ctx.beginPath(); ctx.moveTo(hr*0.8, -hr*0.6); ctx.lineTo(hr*1.4, -hr*0.95); ctx.moveTo(hr*0.8, hr*0.6); ctx.lineTo(hr*1.4, hr*0.95); ctx.stroke(); break;
    case 'robot':
      ctx.fillStyle = c.head; rrPath(ctx, -hr*0.8, -hr*0.9, hr*1.9, hr*1.8, hr*0.35); ctx.fill();
      ctx.fillStyle = c.acc; ctx.fillRect(hr*0.7, -hr*0.7, hr*0.35, hr*1.4);
      ctx.strokeStyle = '#5b6470'; ctx.lineWidth = 0.15; ctx.beginPath(); ctx.moveTo(-hr*0.8, 0); ctx.lineTo(-hr*1.4, 0); ctx.stroke(); ctx.fillStyle = c.acc; circ(-hr*1.45, 0, hr*0.18); ctx.fill(); break;
    case 'ogre':
      ctx.fillStyle = c.head; circ(0.2, 0, hr*1.15); ctx.fill(); ctx.fillStyle = c.acc; ctx.beginPath(); ctx.moveTo(hr*0.6, -hr*0.3); ctx.lineTo(hr*1.7, 0); ctx.lineTo(hr*0.6, hr*0.3); ctx.fill();
      ctx.fillStyle = '#1b1520'; circ(hr*0.6, -hr*0.55, hr*0.14); ctx.fill(); circ(hr*0.6, hr*0.55, hr*0.14); ctx.fill(); break;
    case 'horror':
      ctx.strokeStyle = c.acc; ctx.lineWidth = 0.32;
      for (let i=0;i<4;i++){ const oy = (i-1.5)*hr*0.45; ctx.beginPath(); ctx.moveTo(hr*0.5, oy); ctx.quadraticCurveTo(hr*1.3, oy + Math.sin(t*8+i)*hr*0.6, hr*1.9, oy + Math.sin(t*8+i+1)*hr*0.5); ctx.stroke(); }
      ctx.fillStyle = c.head; circ(0.1, 0, hr*1.05); ctx.fill(); ctx.fillStyle = '#ff5a8a'; circ(hr*0.45, 0, hr*0.3); ctx.fill(); ctx.fillStyle = '#1b1520'; circ(hr*0.5, 0, hr*0.12); ctx.fill(); break;
  }
}
function drawSkater(s, t){
  const isHome = s.team === 'home', jer = isHome ? HOME.jersey : G.ch.opp.jersey, trim = isHome ? HOME.trim : G.ch.opp.trim;
  const hpI = humanOf(s), isCtrl = hpI >= 0;
  if (s.ko > 0) {
    ctx.save(); ctx.translate(s.x, s.y);
    const sp = SPECIES[s.species];
    ctx.fillStyle = 'rgba(30,20,40,.25)'; ell(0.4, 0.6, 3, 2); ctx.fill();
    ctx.fillStyle = jer; for (let i=0;i<4;i++){ const a = i*1.7+s.idx; circ(Math.cos(a)*1.6, Math.sin(a)*1.1, 0.7); ctx.fill(); }
    ctx.fillStyle = sp.head; circ(0.6, -0.3, 0.9); ctx.fill(); circ(-1.1, 0.8, 0.5); ctx.fill();
    ctx.fillStyle = '#ffd24a'; for (let i=0;i<3;i++){ const a = t*4 + i*2.1; circ(Math.cos(a)*2.2, -1.8 + Math.sin(a)*0.8, 0.35); ctx.fill(); }
    ctx.restore(); return;
  }
  ctx.save(); ctx.translate(s.x, s.y);
  const r = s.r;
  ctx.fillStyle = 'rgba(30,20,40,.2)'; ell(0.6, 0.8, r*1.05, r*0.85); ctx.fill();
  if (s.inv > 0 && Math.floor(t*12)%2) ctx.globalAlpha = 0.5;
  if (isCtrl) { ctx.strokeStyle = HUMAN_COL[hpI]; ctx.lineWidth = 0.45; ctx.setLineDash([1.1,0.7]); circ(0,0,r+1.2); ctx.stroke(); ctx.setLineDash([]); }
  if (s.magnet > 0) { ctx.strokeStyle = 'rgba(126,240,255,.6)'; ctx.lineWidth = 0.2; for (let i=0;i<2;i++){ circ(0,0, r+1.8 + ((t*6+i*1.2)%2.4)); ctx.stroke(); } }
  ctx.rotate(s.face);
  if (s.species === 'rat') { ctx.strokeStyle = '#d9909f'; ctx.lineWidth = 0.35; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(-r*0.8,0); ctx.quadraticCurveTo(-r*1.7, Math.sin(t*7+s.idx)*r*0.9, -r*2.5, Math.sin(t*7+s.idx+1.5)*r*0.5); ctx.stroke(); }
  if (s.rocket > 0) { const fl = 1.6 + Math.random()*1.4; const gr = ctx.createLinearGradient(-r*0.6,0,-r*0.6-fl*1.6,0); gr.addColorStop(0,'#fff1b0'); gr.addColorStop(0.4,'#ff9a1a'); gr.addColorStop(1,'rgba(255,60,20,0)'); ctx.fillStyle = gr; for (const sy of [-0.55,0.55]) { ctx.beginPath(); ctx.moveTo(-r*0.5, sy*r-0.35); ctx.lineTo(-r*0.6-fl*1.6, sy*r); ctx.lineTo(-r*0.5, sy*r+0.35); ctx.fill(); } }
  ctx.lineCap = 'round';
  { const ba = s.bl ? s.bl.a : 0.12, br = s.bl ? s.bl.r : r + 1.7, lx = Math.cos(ba)*br, ly = Math.sin(ba)*br;
    const hx = 0.3 + Math.max(-0.6, Math.min(0.6, lx*0.1)), hy = Math.max(-r*0.6, Math.min(r*0.6, ly*0.4));
    const ex = lx - hx, ey = ly - hy, el = hyp(ex, ey) || 1, ux = ex/el, uy = ey/el;
    ctx.strokeStyle = '#2a2018'; ctx.lineWidth = 0.42; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(lx - ux*0.3, ly - uy*0.3); ctx.stroke();
    const px = -uy, py = ux, sgn = px >= 0 ? 1 : -1;
    ctx.strokeStyle = '#121212'; ctx.lineWidth = 0.5; ctx.beginPath(); ctx.moveTo(lx - ux*0.35, ly - uy*0.35); ctx.lineTo(lx + px*sgn*0.9 + ux*0.15, ly + py*sgn*0.9 + uy*0.15); ctx.stroke(); }
  ctx.fillStyle = jer; ell(0, 0, r*0.72, r); ctx.fill(); ctx.strokeStyle = trim; ctx.lineWidth = 0.38; ctx.stroke();
  ctx.fillStyle = trim; ctx.fillRect(-r*0.35, -r*0.92, 0.42, r*1.84);
  if (s.species === 'robot') { ctx.fillStyle = '#c9d6ea'; circ(0, -r*0.85, 0.45); ctx.fill(); circ(0, r*0.85, 0.45); ctx.fill(); }
  if (s.species === 'skeleton') { ctx.strokeStyle = '#e9e2cc'; ctx.lineWidth = 0.15; ctx.beginPath(); for (let i=-2;i<=2;i++){ ctx.moveTo(-r*0.15, i*r*0.32); ctx.lineTo(r*0.25, i*r*0.32); } ctx.stroke(); }
  drawHead(s.species, r, t + s.idx);
  if (s.frozen > 0) { ctx.rotate(-s.face); ctx.fillStyle = 'rgba(190,230,255,.55)'; ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.2; rrPath(ctx, -r*1.25, -r*1.25, r*2.5, r*2.5, 0.6); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(-r*0.8, -r*0.9); ctx.lineTo(-r*0.2, -r*0.3); ctx.stroke(); }
  ctx.restore();
  if (s.stun > 0 && s.frozen <= 0) { ctx.fillStyle = '#ffd24a'; for (let i=0;i<3;i++){ const a = t*7 + i*2.1; circ(s.x + Math.cos(a)*(r+0.6), s.y - r - 0.6 + Math.sin(a)*0.5, 0.32); ctx.fill(); } }
}
function drawGoalie(g, t){
  if (g.off) return;
  const isHome = g.team === 'home', jer = isHome ? HOME.jersey : G.ch.opp.jersey, trim = isHome ? HOME.trim : G.ch.opp.trim;
  const sp = isHome ? 'rat' : G.ch.opp.species;
  ctx.save(); ctx.translate(g.x, g.y);
  const r = g.r;
  ctx.fillStyle = 'rgba(30,20,40,.2)'; ell(0.6, 0.8, r*1.15, r*0.9); ctx.fill();
  ctx.rotate(g.face);
  ctx.fillStyle = '#f2f4f7'; ctx.strokeStyle = trim; ctx.lineWidth = 0.25*r/G_R;
  for (const sy of [-1,1]) { rrPath(ctx, 0.2*r/G_R, sy>0 ? 0.25*r/G_R : -1.65*r/G_R, 1.6*r/G_R, 1.4*r/G_R, 0.4*r/G_R); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = jer; ell(-0.3*r/G_R, 0, r*0.75, r); ctx.fill(); ctx.strokeStyle = trim; ctx.lineWidth = 0.38*r/G_R; ctx.stroke();
  ctx.fillStyle = '#e9ecf0'; rrPath(ctx, 0.6*r/G_R, -r-0.5*r/G_R, 1.4*r/G_R, 1.2*r/G_R, 0.3*r/G_R); ctx.fill();
  ctx.fillStyle = trim; circ(0.9*r/G_R, r+0.2*r/G_R, 0.9*r/G_R); ctx.fill();
  ctx.fillStyle = SPECIES[sp].head; circ(0.1, 0, r*0.44); ctx.fill();
  ctx.strokeStyle = '#2b2533'; ctx.lineWidth = 0.13; ctx.beginPath(); for (let i=-1;i<=1;i++){ ctx.moveTo(r*0.15, i*r*0.14); ctx.lineTo(r*0.42, i*r*0.14); } ctx.stroke();
  if (g.frozen > 0) { ctx.rotate(-g.face); ctx.fillStyle = 'rgba(190,230,255,.6)'; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.2; rrPath(ctx, -r*1.3, -r*1.3, r*2.6, r*2.6, 0.6); ctx.fill(); ctx.stroke(); }
  ctx.restore();
  if (g.stun > 0) { ctx.fillStyle = '#ffd24a'; for (let i=0;i<3;i++){ const a = t*7 + i*2.1; circ(g.x + Math.cos(a)*(r+0.6), g.y - r - 0.4 + Math.sin(a)*0.5, 0.32); ctx.fill(); } }
  if (g.shrink > 0) { ctx.strokeStyle = 'rgba(126,240,255,.7)'; ctx.lineWidth = 0.18; circ(g.x, g.y, r + 0.8 + Math.sin(t*10)*0.3); ctx.stroke(); }
}
function drawHazards(t){
  const H = G.hz;
  for (const p of H.slime) {
    ctx.fillStyle = 'rgba(112,170,40,.62)';
    for (const [bx,by,br] of p.blobs) { circ(p.x+bx, p.y+by, br); ctx.fill(); }
    ctx.fillStyle = 'rgba(190,240,90,.75)';
    for (let i=0;i<4;i++){ const a = p.ph + i*1.6 + t*0.5; const rr = ((t*0.8 + i*0.37) % 1); circ(p.x + Math.cos(a)*p.r*0.4, p.y + Math.sin(a)*p.r*0.4, 0.25 + rr*0.5); ctx.fill(); }
  }
  for (const o of H.holes) {
    ctx.save(); ctx.translate(o.x, o.y);
    ctx.beginPath(); o.pts.forEach(([x,y],i) => i ? ctx.lineTo(x*1.12,y*1.12) : ctx.moveTo(x*1.12,y*1.12)); ctx.closePath(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill();
    ctx.beginPath(); o.pts.forEach(([x,y],i) => i ? ctx.lineTo(x,y) : ctx.moveTo(x,y)); ctx.closePath();
    const gr = ctx.createRadialGradient(0,0,0,0,0,o.r); gr.addColorStop(0,'#0b1e2c'); gr.addColorStop(1,'#24506a'); ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = 'rgba(160,210,235,.45)'; ctx.lineWidth = 0.15; for (let i=0;i<2;i++){ circ(0,0, ((t*1.2 + i*0.5) % 1) * o.r*0.85); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(80,110,130,.5)'; ctx.lineWidth = 0.12; ctx.beginPath(); for (let i=0;i<6;i++){ const a = i*1.05+0.3, [x,y] = o.pts[(i*2)%o.pts.length]; ctx.moveTo(x*1.1,y*1.1); ctx.lineTo(Math.cos(a)*(o.r+3.2), Math.sin(a)*(o.r+3.2)); } ctx.stroke();
    ctx.restore();
  }
  for (const v of H.vents) {
    const ph = v.t % 5.5, warn = ph > 3.1 && ph <= 4.4;
    if (warn || v.on) { const k = v.on ? 1 : (ph-3.1)/1.3; const gr = ctx.createRadialGradient(v.x,v.y,0,v.x,v.y,v.r*(v.on?2.2:1.6)); gr.addColorStop(0,`rgba(255,${v.on?200:120},40,${0.35+0.5*k})`); gr.addColorStop(1,'rgba(255,80,20,0)'); ctx.fillStyle = gr; circ(v.x,v.y,v.r*(v.on?2.2:1.6)); ctx.fill(); }
    ctx.fillStyle = '#2b2321'; circ(v.x, v.y, v.r); ctx.fill();
    ctx.strokeStyle = v.on ? '#ffd27a' : warn && Math.floor(t*8)%2 ? '#ff7a2a' : '#5a4a44'; ctx.lineWidth = 0.35; ctx.beginPath();
    for (let i=-2;i<=2;i++){ const y = v.y + i*v.r*0.33, w = Math.sqrt(Math.max(0, v.r*v.r - (i*v.r*0.33)**2))*0.85; ctx.moveTo(v.x-w, y); ctx.lineTo(v.x+w, y); } ctx.stroke();
    if (v.on) { for (let i=0;i<5;i++){ const a = t*20+i*1.3, rr = v.r*(0.4+0.5*Math.random()); ctx.fillStyle = i%2 ? '#fff1b0' : '#ff8a1a'; circ(v.x+Math.cos(a)*rr*0.6, v.y+Math.sin(a)*rr*0.6, rr*0.55); ctx.fill(); } }
  }
  for (const m of H.mines) {
    if (m.dead > 0) { ctx.fillStyle = 'rgba(30,20,20,.35)'; circ(m.x, m.y, 2.6); ctx.fill(); continue; }
    ctx.fillStyle = '#2b2a2e'; circ(m.x, m.y, m.r); ctx.fill();
    ctx.strokeStyle = m.team ? (m.team === 'home' ? HOME.jersey : G.ch.opp.trim) : '#6b6a70'; ctx.lineWidth = 0.3; circ(m.x, m.y, m.r); ctx.stroke();
    ctx.strokeStyle = '#6b6a70'; ctx.lineWidth = 0.25; ctx.beginPath(); for (let i=0;i<6;i++){ const a = i*Math.PI/3; ctx.moveTo(m.x+Math.cos(a)*m.r, m.y+Math.sin(a)*m.r); ctx.lineTo(m.x+Math.cos(a)*(m.r+0.6), m.y+Math.sin(a)*(m.r+0.6)); } ctx.stroke();
    const blink = m.arm > 0 ? '#555' : Math.floor(t*(m.team?6:3))%2 ? '#ff2a2a' : '#661010';
    ctx.fillStyle = blink; circ(m.x, m.y, 0.42); ctx.fill();
  }
  for (const w of H.wells) {
    const gr = ctx.createRadialGradient(w.x,w.y,0,w.x,w.y,w.R*0.7); gr.addColorStop(0,'rgba(20,10,50,.95)'); gr.addColorStop(0.25,'rgba(60,40,140,.5)'); gr.addColorStop(1,'rgba(80,60,180,0)'); ctx.fillStyle = gr; circ(w.x,w.y,w.R*0.7); ctx.fill();
    ctx.strokeStyle = 'rgba(160,180,255,.55)'; ctx.lineWidth = 0.2;
    for (let i=0;i<3;i++){ ctx.beginPath(); for (let k=0;k<=30;k++){ const f = k/30, a = -t*2.2 + i*2.09 + f*5, rr = w.r + f*(w.R*0.62 - w.r); const x = w.x + Math.cos(a)*rr, y = w.y + Math.sin(a)*rr; k ? ctx.lineTo(x,y) : ctx.moveTo(x,y); } ctx.stroke(); }
    ctx.fillStyle = '#05030c'; circ(w.x, w.y, w.r); ctx.fill(); ctx.strokeStyle = '#c9a4ff'; ctx.lineWidth = 0.25; circ(w.x, w.y, w.r); ctx.stroke();
  }
  for (const w of H.saws) {
    ctx.strokeStyle = 'rgba(60,40,25,.45)'; ctx.lineWidth = 0.6; ctx.setLineDash([1.2,0.8]); ctx.beginPath(); ctx.moveTo(8, w.y); ctx.lineTo(77, w.y); ctx.stroke(); ctx.setLineDash([]);
    ctx.save(); ctx.translate(w.x, w.y); ctx.rotate(w.a);
    ctx.fillStyle = '#c0c6cc'; ctx.beginPath(); for (let i=0;i<16;i++){ const a = i/16*Math.PI*2; const rr = i%2 ? w.r : w.r*1.25; i ? ctx.lineTo(Math.cos(a)*rr, Math.sin(a)*rr) : ctx.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); } ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#7d858d'; circ(0,0,w.r*0.55); ctx.fill(); ctx.fillStyle = '#3a3f45'; circ(0,0,w.r*0.18); ctx.fill();
    ctx.restore();
  }
  for (const tr of G.traps) {
    const k = Math.min(1, tr.life/2);
    ctx.globalAlpha = 0.85*k; ctx.fillStyle = '#1e1810'; circ(tr.x, tr.y, tr.r); ctx.fill();
    ctx.fillStyle = '#2f2618'; circ(tr.x+tr.r*0.3, tr.y-tr.r*0.2, tr.r*0.6); ctx.fill();
    const gr = ctx.createLinearGradient(tr.x-tr.r, tr.y, tr.x+tr.r, tr.y); gr.addColorStop(0,'rgba(255,80,200,.25)'); gr.addColorStop(0.5,'rgba(80,220,255,.25)'); gr.addColorStop(1,'rgba(255,220,80,.25)');
    ctx.fillStyle = gr; ell(tr.x-tr.r*0.2, tr.y-tr.r*0.3, tr.r*0.5, tr.r*0.25); ctx.fill(); ctx.globalAlpha = 1;
  }
  for (const c of G.crates) {
    const pulse = 1 + Math.sin(c.t*5)*0.08, fade = c.life < 3 && Math.floor(c.t*8)%2 ? 0.4 : 1;
    ctx.save(); ctx.translate(c.x, c.y); ctx.globalAlpha = fade;
    const gr = ctx.createRadialGradient(0,0,0,0,0,4.5); gr.addColorStop(0,'rgba(255,181,30,.55)'); gr.addColorStop(1,'rgba(255,181,30,0)'); ctx.fillStyle = gr; circ(0,0,4.5); ctx.fill();
    ctx.rotate(c.t*1.4); ctx.scale(pulse, pulse);
    ctx.fillStyle = '#ffb51e'; ctx.beginPath(); for (let i=0;i<6;i++){ const a = i*Math.PI/3; i ? ctx.lineTo(Math.cos(a)*2, Math.sin(a)*2) : ctx.moveTo(Math.cos(a)*2, Math.sin(a)*2); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#1d1305'; ctx.lineWidth = 0.3; ctx.stroke();
    ctx.rotate(-c.t*1.4); ctx.fillStyle = '#1d1305'; ctx.beginPath(); ctx.moveTo(0.3,-1.3); ctx.lineTo(-0.8,0.2); ctx.lineTo(0,0.2); ctx.lineTo(-0.3,1.3); ctx.lineTo(0.8,-0.2); ctx.lineTo(0,-0.2); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  for (const w of G.walls) {
    const k = Math.min(1, w.life/1.2);
    ctx.globalAlpha = k; ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(170,220,255,.85)'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(w.x1, w.y); ctx.lineTo(w.x2, w.y); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 0.3; ctx.beginPath(); for (let x=w.x1+1;x<w.x2;x+=2.5){ ctx.moveTo(x, w.y-0.5); ctx.lineTo(x+1, w.y+0.5); } ctx.stroke();
    ctx.globalAlpha = 1;
  }
}
let lastR = 0;
function render(now){
  const dt = Math.min(0.05, (now - lastR)/1000 || 0); lastR = now;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle = G ? G.theme.floor : '#150e1c'; ctx.fillRect(0,0,cw,ch);
  if (!G) return;
  const t = G.time;
  const viewH = ch/scale, P = G.pucks[0], cs = ctrlSk();
  let hy = 0, hn = 0; if (!G.attract) for (let p = 0; p < humans(); p++) { const h = humanSk(p); if (h && h.ko <= 0) { hy += h.y; hn++; } }
  const focusY = hn ? P.y*0.78 + hy/hn*0.22 : P.y;
  const lo = viewH/2 - 6, hi = RL - viewH/2 + 6;
  const want = lo > hi ? RL/2 : clamp(focusY - 3, lo, hi);
  camY += (want - camY) * Math.min(1, dt*4.5);
  if (lo <= hi) camY = clamp(camY, lo, hi);
  const sh = G.shake*scale*0.5;
  OX = (cw - RW*scale)/2 + (Math.random()-0.5)*sh; OY = ch/2 - camY*scale + (Math.random()-0.5)*sh;
  ctx.drawImage(rinkC, OX - RM*scale, OY - RM*scale, rinkC.width/dpr, rinkC.height/dpr);
  ctx.setTransform(dpr*scale,0,0,dpr*scale,dpr*OX,dpr*OY);
  drawHazards(t);
  if (G.goalLight) {
    const top = G.goalLight.team === 'home', gy = top ? GT-ND-3 : GB+ND+3, pulse = 0.55 + 0.45*Math.sin(G.goalLight.t*14);
    const gr = ctx.createRadialGradient(CX,gy,0,CX,gy,16); gr.addColorStop(0,`rgba(255,40,40,${0.75*pulse})`); gr.addColorStop(1,'rgba(255,40,40,0)'); ctx.fillStyle = gr; ctx.fillRect(CX-16,gy-16,32,32);
  }
  if (cs && (cs.charging || cs.wind > 0) && P.owner === cs) {
    const a = cs.charging ? aimAngle(cs) : cs.windAim, len = 10 + (cs.charging ? cs.charge : cs.wind)*14;
    ctx.strokeStyle = '#ffb51e'; ctx.globalAlpha = 0.6; ctx.lineWidth = 0.35; ctx.setLineDash([0.9,0.9]);
    ctx.beginPath(); ctx.moveTo(P.x, P.y); ctx.lineTo(P.x+Math.cos(a)*len, P.y+Math.sin(a)*len); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  for (const Q of G.pucks) {
    if (Q.owner || Q.hold) continue;
    for (let i=1;i<Q.trail.length;i++){
      const [x0,y0] = Q.trail[i-1], [x1,y1,sp] = Q.trail[i];
      if (sp < 32 && !Q.fire) continue;
      ctx.strokeStyle = Q.fire > 0 ? `rgba(255,${120+i*12},30,${0.15+0.5*i/Q.trail.length})` : Q.homing > 0 || Q.bonus ? `rgba(126,240,255,${0.1+0.35*i/Q.trail.length})` : `rgba(40,30,55,${0.05+0.2*i/Q.trail.length})`;
      ctx.lineWidth = PUCK_R*(Q.fire>0?2.2:1.4)*i/Q.trail.length; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(x1,y1); ctx.stroke();
    }
  }
  const ents = [];
  ents.push({ y:G.gH.y, d:() => drawGoalie(G.gH, t) }, { y:G.gA.y, d:() => drawGoalie(G.gA, t) });
  for (const s of G.sk) ents.push({ y: s.ko > 0 ? s.y - 50 : s.y, d:() => drawSkater(s, t) });
  ents.sort((a,b) => a.y - b.y); for (const e of ents) e.d();
  for (const Q of G.pucks) {
    if (Q.sunk || Q.ref) continue;
    ctx.fillStyle = 'rgba(20,15,30,.25)'; circ(Q.x+0.3, Q.y+0.35, PUCK_R); ctx.fill();
    if (Q.fire > 0) { const gr = ctx.createRadialGradient(Q.x,Q.y,0,Q.x,Q.y,2.6); gr.addColorStop(0,'rgba(255,240,170,.9)'); gr.addColorStop(1,'rgba(255,90,20,0)'); ctx.fillStyle = gr; circ(Q.x,Q.y,2.6); ctx.fill(); }
    ctx.fillStyle = Q.bonus ? '#24384a' : '#0d0f12'; circ(Q.x, Q.y, PUCK_R); ctx.fill();
    ctx.strokeStyle = Q.homing > 0 || Q.bonus ? '#7ef0ff' : '#4a5260'; ctx.lineWidth = 0.15; circ(Q.x, Q.y, PUCK_R*0.7); ctx.stroke();
  }
  if (cs && cs.charging) { ctx.strokeStyle = '#ffb51e'; ctx.lineWidth = 0.55; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(cs.x, cs.y, cs.r+2.2, -Math.PI/2, -Math.PI/2 + cs.charge*Math.PI*2); ctx.stroke(); }
  for (const p of G.parts) { ctx.globalAlpha = Math.max(0, p.life/p.max); ctx.fillStyle = p.c; circ(p.x, p.y, p.s); ctx.fill(); }
  ctx.globalAlpha = 1;
  for (const r of G.rings) { const k = 1 - r.life/r.max; ctx.strokeStyle = r.c; ctx.globalAlpha = 1-k; ctx.lineWidth = 0.6*(1-k)+0.1; circ(r.x, r.y, r.R*k); ctx.stroke(); }
  ctx.globalAlpha = 1;
  for (const b of G.beams) { ctx.globalAlpha = b.life/b.max; ctx.strokeStyle = b.c; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(b.x1,b.y1); ctx.lineTo(b.x2,b.y2); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.25; ctx.stroke(); }
  for (const b of G.bolts) { ctx.globalAlpha = b.life/b.max; ctx.strokeStyle = '#fff7a8'; ctx.lineWidth = 0.7; ctx.lineJoin = 'round'; ctx.beginPath(); b.seg.forEach(([x,y],i) => i ? ctx.lineTo(b.x+x, b.y+y) : ctx.moveTo(b.x+x, b.y+y)); ctx.stroke(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 0.25; ctx.stroke(); }
  ctx.globalAlpha = 1;
  // HP bars and labels in screen space
  ctx.setTransform(dpr,0,0,dpr,0,0);
  const W2S = (x, y) => [OX + x*scale, OY + y*scale];
  for (const s of G.sk) {
    if (s.ko > 0) continue;
    if (s.hp >= 99.5 && s !== cs) continue;
    const [sx, sy] = W2S(s.x, s.y - s.r - 2.2), w = 26;
    ctx.fillStyle = 'rgba(15,10,20,.7)'; ctx.fillRect(sx - w/2 - 1, sy - 1, w + 2, 6);
    ctx.fillStyle = hpCol(s.hp/100); ctx.fillRect(sx - w/2, sy, w*Math.max(0, s.hp)/100, 4);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of G.pops) {
    const [sx, sy] = W2S(p.x, p.y), k = p.life/p.max, sc = k > 0.85 ? 1 + (k-0.85)*3 : 1;
    ctx.globalAlpha = Math.min(1, k*2.5); ctx.font = `${Math.round(p.size*sc)}px Bungee, "Arial Black", Impact, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(21,14,28,.9)'; ctx.strokeText(p.text, sx, sy); ctx.fillStyle = p.color; ctx.fillText(p.text, sx, sy);
  }
  ctx.globalAlpha = 1;
  drawBadges((x, y) => { const [sx, sy] = W2S(x, y - 5.2); return [sx, sy, sy > -20 && sy < ch + 20]; }, t);
  drawReplayBanner(t);
  for (let p = 0; p < humans(); p++) { const hs = humanSk(p); if (!hs || hs.ko > 0 || G.attract) continue;
    const [sx, sy] = W2S(hs.x, hs.y);
    if (sy < 8 || sy > ch - 8) { const ey = sy < 8 ? 14 : ch - 14, d = sy < 8 ? -1 : 1; ctx.fillStyle = HUMAN_COL[p]; ctx.beginPath(); ctx.moveTo(sx, ey + d*8); ctx.lineTo(sx - 9, ey - d*4); ctx.lineTo(sx + 9, ey - d*4); ctx.closePath(); ctx.fill(); }
  }
  if (joy.id !== null) {
    let dx = joy.x - joy.bx, dy = joy.y - joy.by; const m = hyp(dx, dy); if (m > JR) { dx = dx/m*JR; dy = dy/m*JR; }
    ctx.strokeStyle = 'rgba(241,231,208,.45)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.bx, joy.by, JR, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,181,30,.55)'; ctx.beginPath(); ctx.arc(joy.bx+dx, joy.by+dy, 20, 0, 7); ctx.fill();
  }
}

// ---------------- HUD
const hudCache = {};
const setT = (id, v) => { if (hudCache[id] !== v) { hudCache[id] = v; $(id).textContent = v; } };
function fmtClock(c){ if (c < 10 && c > 0) return c.toFixed(1); const t = Math.ceil(c); return Math.floor(t/60) + ':' + String(t%60).padStart(2,'0'); }
function updateHud(){
  if (!G || G.attract) return;
  setT('sH', String(G.score.home)); setT('sA', String(G.score.away));
  setT('hSub', `SOG ${G.sog.home} · KO ${G.kos.home}`); setT('aSub', `SOG ${G.sog.away} · KO ${G.kos.away}`);
  setT('clk', G.vs && G.vs.ot ? 'OT' : G.ch.len > 0 ? fmtClock(G.clock) : 'FREE');
  const low = G.ch.len > 0 && G.clock < 20; if (hudCache.low !== low) { hudCache.low = low; $('clk').classList.toggle('low', low); }
  setT('objProg', condProg(G.ch.obj, G));
  const done = condMet(G.ch.obj, G); if (hudCache.done !== done) { hudCache.done = done; $('objLine').classList.toggle('done', done); }
  const cs = ctrlSk(), has = cs && G.pucks[0].owner === cs;
  setT('shootLabel', has ? 'SHOOT' : 'CHECK'); setT('passLabel', has ? 'PASS' : 'SWITCH');
  const p = G.power.home, ar = G.armed.home;
  const key = (p || '') + '|' + (ar ? ar.type : '');
  if (hudCache.pw !== key) {
    hudCache.pw = key;
    const b = $('bPower');
    b.classList.toggle('has', !!p); b.classList.toggle('armed', !p && !!ar);
    $('pIcon').innerHTML = p ? svg(p) : ar ? svg(ar.type) : '';
    $('pLabel').textContent = p ? POWERS[p].name.toUpperCase() : ar ? 'LOADED' : 'NO POWER';
    b.setAttribute('aria-label', p ? 'Use ' + POWERS[p].name : 'No power-up held');
  }
}
