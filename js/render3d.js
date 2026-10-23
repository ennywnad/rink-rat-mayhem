// Rink Rat Mayhem: comic-book 3D broadcast renderer (three.js WebGPU / WebGL2)
(() => {
'use strict';
const S = window.__sim;
if (!S) return;
const { RW, RL, CR, CX, GT, GB, PL, PRt, ND } = S.C;
const DEBUG = /[?&]debug\b/.test(location.search);
const R3 = window.__r3d = { active:false, ok:false, status:'loading', tier:'med', basis:null, pref:'auto' };
let booted = false;
R3.boot = () => {
  if (booted) return; booted = true;
  init().catch(e => { console.warn('[3D] unavailable, using classic view:', e); R3.status = 'failed'; R3.ok = false; R3.active = false; const c = document.getElementById('gl'); if (c) c.hidden = true; if (S.on3DStatus) S.on3DStatus(); });
};
R3.pref = S.gfxPref();
if (R3.pref !== 'classic') R3.boot();

async function init(){
  R3.pref = S.gfxPref() === 'classic' ? 'auto' : S.gfxPref();
  const [THREE, TSL, BloomMod, BGU] = await Promise.all([
    import('three/webgpu'), import('three/tsl'),
    import('three/addons/tsl/display/BloomNode.js'), import('three/addons/utils/BufferGeometryUtils.js')
  ]);
  const { normalWorld, normalLocal, normalView, positionViewDirection, fract, floor: tFloor, luminance, abs: tAbs, cos, screenCoordinate, texture, uv, vec2, vec3, vec4, float, mix, attribute, time, sin, positionLocal, instanceIndex, hash, screenUV, smoothstep, pass, reflector, atan, step, uniform, oneMinus, instancedBufferAttribute, length, clamp, PI } = TSL;
  const bloomFn = BloomMod.bloom;

  // ------------------------------------------------ renderer
  let engine = 'webgpu'; try { engine = localStorage.getItem('rinkrat-gfx-engine') || 'webgpu'; } catch(e) {}
  R3.engine = engine;
  const canvas = document.getElementById('gl');
  canvas.hidden = false;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias:true, powerPreference:'high-performance', forceWebGL: engine !== 'webgpu' });
  await renderer.init();
  renderer.onDeviceLost = info => { console.warn('[3D] GPU device lost:', info && info.message); if (R3.recover) R3.recover('device lost'); };
  R3.restart = () => {
    R3.active = false; R3.ok = false; R3.status = 'loading'; R3.recover = null;
    try { renderer.dispose(); } catch(e) {}
    const old = document.getElementById('gl'), c = document.createElement('canvas'); c.id = 'gl'; c.setAttribute('aria-hidden', 'true'); old.replaceWith(c);
    if (S.on3DStatus) S.on3DStatus();
    booted = false; setTimeout(() => R3.boot(), 50);
  };
  renderer.toneMapping = THREE.AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const backend = renderer.backend && renderer.backend.isWebGPUBackend ? 'WebGPU' : 'WebGL2';
  R3.gpuErrors = [];
  const dev = renderer.backend && renderer.backend.device;
  if (dev && dev.addEventListener) dev.addEventListener('uncapturederror', e => { const m = (e.error && e.error.message || String(e)).slice(0, 400); if (R3.gpuErrors.length < 20) R3.gpuErrors.push(m); console.error('[3D] GPU error:', m); });
  if (DEBUG) R3._dbg = { renderer, get scene(){ return scene; }, get cam(){ return cam; }, get post(){ return post; }, THREE };

  const scene = new THREE.Scene();
  const BG = new THREE.Color(0x06070a);
  scene.background = BG;
  scene.fog = new THREE.Fog(0x06070a, 240, 560);
  const cam = new THREE.PerspectiveCamera(46, 1, 2, 1400);
  cam.position.set(0, 90, 160); cam.lookAt(0, 0, 0);

  const W = (x, y, h=0, v=new THREE.Vector3()) => v.set(x - CX, h, y - RL/2);
  const isTouch = matchMedia('(pointer:coarse)').matches;

  // ------------------------------------------------ helpers
  const hexMix = (a, b, t) => { const ca = new THREE.Color(a), cb = new THREE.Color(b); return '#' + ca.lerp(cb, t).getHexString(); };
  let seed = 1; const srnd = () => (seed = (seed*16807) % 2147483647) / 2147483647;
  function canvasTex(cvs, srgb=true){ const t = new THREE.CanvasTexture(cvs); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; }
  function perimeter(step){
    const pts = []; let u = 0, last = null;
    const push = (x, y, nx, ny) => { if (last) u += Math.hypot(x-last[0], y-last[1]); pts.push({ x, y, nx, ny, u }); last = [x, y]; };
    const line = (x0,y0,x1,y1,nx,ny) => { const L = Math.hypot(x1-x0,y1-y0), n = Math.max(1, Math.ceil(L/step)); for (let i=0;i<n;i++){ const t = i/n; push(x0+(x1-x0)*t, y0+(y1-y0)*t, nx, ny); } };
    const arc = (cx,cy,a0,a1) => { const n = Math.max(3, Math.ceil(CR*(a1-a0)/Math.min(step,4))); for (let i=0;i<n;i++){ const a = a0+(a1-a0)*i/n; push(cx+Math.cos(a)*CR, cy+Math.sin(a)*CR, Math.cos(a), Math.sin(a)); } };
    line(CR,0,RW-CR,0,0,-1); arc(RW-CR,CR,-Math.PI/2,0);
    line(RW,CR,RW,RL-CR,1,0); arc(RW-CR,RL-CR,0,Math.PI/2);
    line(RW-CR,RL,CR,RL,0,1); arc(CR,RL-CR,Math.PI/2,Math.PI);
    line(0,RL-CR,0,CR,-1,0); arc(CR,CR,Math.PI,Math.PI*1.5);
    push(pts[0].x, pts[0].y, pts[0].nx, pts[0].ny);
    return pts;
  }
  // extrude a list of profile segments [[o0,h0],[o1,h1]] around the rink perimeter (o = outward offset from the ice edge)
  function ringGeo(pts, segs, texLen, vRange, skip){
    const pos = [], nor = [], uvs = [], idx = [];
    for (const seg of segs) {
      const [[o0,h0],[o1,h1]] = seg, base = pos.length/3;
      for (const p of pts) {
        const ho0 = typeof h0 === 'function' ? h0(p) : h0, ho1 = typeof h1 === 'function' ? h1(p) : h1;
        pos.push(p.x + p.nx*o0 - CX, ho0, p.y + p.ny*o0 - RL/2, p.x + p.nx*o1 - CX, ho1, p.y + p.ny*o1 - RL/2);
        uvs.push(p.u/(texLen||1), vRange ? vRange[0] : 0, p.u/(texLen||1), vRange ? vRange[1] : 1);
      }
      for (let i=0;i<pts.length-1;i++){ if (skip && skip(pts[i], pts[i+1], seg)) continue; const a = base+i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(idx); g.computeVertexNormals();
    return g;
  }
  const roundedShape = (off) => {
    const s = new THREE.Shape(), r = CR + off, x0 = -CX - off, x1 = CX + off, y0 = -RL/2 - off, y1 = RL/2 + off;
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.absarc(x1 - r, y0 + r, r, -Math.PI/2, 0, false);
    s.lineTo(x1, y1 - r); s.absarc(x1 - r, y1 - r, r, 0, Math.PI/2, false);
    s.lineTo(x0 + r, y1); s.absarc(x0 + r, y1 - r, r, Math.PI/2, Math.PI, false);
    s.lineTo(x0, y0 + r); s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI*1.5, false);
    return s;
  };

  // ------------------------------------------------ lights + environment
  const hemi = new THREE.HemisphereLight(0xdde6ff, 0x16181e, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xf2f5ff, 2.1);
  key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0015; key.shadow.normalBias = 0.12;
  Object.assign(key.shadow.camera, { left:-75, right:75, top:75, bottom:-75, near:20, far:320 });
  scene.add(key, key.target);
  const fillA = new THREE.DirectionalLight(0xfff0dc, 0.55); fillA.position.set(-90, 110, -70); scene.add(fillA);
  const fillB = new THREE.DirectionalLight(0xe2ecff, 0.5); fillB.position.set(90, 100, 90); scene.add(fillB);
  const goalPoint = new THREE.PointLight(0xff2a1a, 0, 120, 1.6); goalPoint.position.set(0, 14, -95); scene.add(goalPoint);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envCache = new Map();
  async function buildEnv(accentHex){
    if (envCache.has(accentHex)) { scene.environment = envCache.get(accentHex).texture; return; }
    const es = new THREE.Scene();
    es.add(new THREE.Mesh(new THREE.SphereGeometry(400, 24, 12), new THREE.MeshBasicMaterial({ color:0x090a0e, side:THREE.BackSide })));
    const panel = new THREE.MeshBasicMaterial({ color:new THREE.Color(5, 5, 5.3) });
    const pg = new THREE.BoxGeometry(14, 1, 7);
    for (let i=-2;i<=2;i++) for (let j=-4;j<=4;j++){ const m = new THREE.Mesh(pg, panel); m.position.set(i*26, 150, j*34); es.add(m); }
    const jb = new THREE.Mesh(new THREE.BoxGeometry(26, 15, 26), new THREE.MeshBasicMaterial({ color:new THREE.Color(2.2, 1.7, 0.9) })); jb.position.set(0, 128, 0); es.add(jb);
    const acc = new THREE.Color(accentHex).multiplyScalar(2.2);
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(150, 150, 3, 48, 1, true), new THREE.MeshBasicMaterial({ color:acc, side:THREE.BackSide })); rib.position.y = 24; es.add(rib);
    const ice = new THREE.Mesh(new THREE.PlaneGeometry(85, 200), new THREE.MeshBasicMaterial({ color:new THREE.Color(0.75, 0.8, 0.86) })); ice.rotation.x = -Math.PI/2; ice.position.y = -6; es.add(ice);
    const rt = await pmrem.fromSceneAsync(es, 0.035, 1, 900);
    envCache.set(accentHex, rt);
    scene.environment = rt.texture; scene.environmentIntensity = 0.75;
  }

  // ------------------------------------------------ ice
  const ACCENT = { boneyard:'#8fd0a0', magma:'#ff6a1a', mines:'#e0b23a', sludge:'#a8c93f', orbital:'#4cc3ff', sawmill:'#d63b2b', abyss:'#a46bff' };
  const BRANDS = {
    boneyard:['BONEZ COLA','CRYPT KEEPER BANK','GRAVEDIGGER TOOLS','MOSSY MOTORS'],
    magma:['MAGMA MINTS','CINDER AIR','LAVA LUBE','SCORCH ENERGY'],
    mines:['DYNA-MITE SNACKS','PICKAXE PIZZA','GRUBWORKS','BLASTCO'],
    sludge:['SLUDGECO','TOXIC TACOS','BOG BREW','OOZE INSURANCE'],
    orbital:['VOID AIRLINES','ORBITAL OATS','ZERO-G GYM','STARGRIT'],
    sawmill:['OGRE OIL','TIMBER TACK','SAWDUST SODA','LUMBERJAX'],
    abyss:['ABYSS ENERGY','KRAKKEN KOLA','DEEP DARK DATA','TENTACLE TIRES']
  };
  const COMMON_BRANDS = ['RATTLER ENERGY','MUTANT MUTUAL','ZAMBO-NO','SKATE OR DIE INC'];
  let k = 16, paintLocked = false;  // paint texture px per foot (fixed once the texture exists)
  let paintCvs = null, paintTex = null;
  const SK = 4;                   // scuff texture px per foot
  const scuffCvs = document.createElement('canvas'); scuffCvs.width = RW*SK; scuffCvs.height = RL*SK;
  const sctx = scuffCvs.getContext('2d');
  const scuffTex = canvasTex(scuffCvs, false);
  const snowU = uniform(0.2);

  function paintIce(G){
    const th = G.theme, cvs = paintCvs || document.createElement('canvas');
    cvs.width = Math.round(RW*k); cvs.height = Math.round(RL*k);
    const g = cvs.getContext('2d'); g.setTransform(k,0,0,k,0,0);
    const edge = hexMix('#dfe8f0', th.ice, 0.35), mid = hexMix('#f6f9fb', th.ice, 0.18);
    const gr = g.createLinearGradient(0,0,RW,0); gr.addColorStop(0, edge); gr.addColorStop(0.18, mid); gr.addColorStop(0.82, mid); gr.addColorStop(1, edge);
    g.fillStyle = gr; g.fillRect(0,0,RW,RL);
    seed = 11 + G.ch.tier*7;
    for (let i=0;i<220;i++){ const x = srnd()*RW, y = srnd()*RL, r = 3 + srnd()*16; const rg = g.createRadialGradient(x,y,0,x,y,r); const w = srnd() < 0.5; rg.addColorStop(0, w ? 'rgba(255,255,255,.08)' : 'rgba(150,170,190,.05)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(x-r,y-r,r*2,r*2); }
    const H = G.hz;
    for (const o of H.holes) { g.strokeStyle = 'rgba(70,95,115,.55)'; g.lineWidth = 0.12; g.beginPath(); for (let i=0;i<9;i++){ const a = srnd()*Math.PI*2; let x = o.x + Math.cos(a)*o.r, y = o.y + Math.sin(a)*o.r; g.moveTo(x,y); for (let s=0;s<4;s++){ x += Math.cos(a + (srnd()-0.5))*1.6; y += Math.sin(a + (srnd()-0.5))*1.6; g.lineTo(x,y); } } g.stroke(); const rg = g.createRadialGradient(o.x,o.y,o.r,o.x,o.y,o.r+5); rg.addColorStop(0,'rgba(255,255,255,.7)'); rg.addColorStop(1,'rgba(255,255,255,0)'); g.fillStyle = rg; g.beginPath(); g.arc(o.x,o.y,o.r+5,0,7); g.fill(); }
    for (const v of H.vents) { const rg = g.createRadialGradient(v.x,v.y,v.r*0.8,v.x,v.y,v.r+5); rg.addColorStop(0,'rgba(60,35,25,.55)'); rg.addColorStop(1,'rgba(60,35,25,0)'); g.fillStyle = rg; g.beginPath(); g.arc(v.x,v.y,v.r+5,0,7); g.fill(); }
    for (const p of H.slime) { const rg = g.createRadialGradient(p.x,p.y,p.r*0.6,p.x,p.y,p.r+3); rg.addColorStop(0,'rgba(120,170,50,.35)'); rg.addColorStop(1,'rgba(120,170,50,0)'); g.fillStyle = rg; g.beginPath(); g.arc(p.x,p.y,p.r+3,0,7); g.fill(); }
    for (const w of H.wells) { g.strokeStyle = 'rgba(90,80,170,.25)'; g.lineWidth = 0.3; for (let i=1;i<6;i++){ g.beginPath(); g.arc(w.x,w.y,w.r + i*2.6, i, i + 4); g.stroke(); } }
    for (const w of H.saws) { g.fillStyle = 'rgba(30,26,24,.85)'; g.fillRect(7, w.y-0.18, 71, 0.36); g.fillStyle = 'rgba(255,200,40,.6)'; for (let x=8;x<77;x+=4){ g.fillRect(x, w.y-0.9, 2, 0.25); g.fillRect(x, w.y+0.65, 2, 0.25); } }
    // ---- comic inking: crosshatch helpers
    const RED = '#c4262e', BLUE = '#2048a8', INK = '#120d18';
    const rrect = (inset) => { const r = Math.max(1, CR - inset), x0 = inset, y0 = inset, x1 = RW - inset, y1 = RL - inset; g.moveTo(x0 + r, y0); g.arcTo(x1, y0, x1, y1, r); g.arcTo(x1, y1, x0, y1, r); g.arcTo(x0, y1, x0, y0, r); g.arcTo(x0, y0, x1, y0, r); g.closePath(); };
    const hatch = (clip, spacing, alpha, dirs = [1]) => {
      g.save(); g.beginPath(); clip(); g.clip('evenodd');
      g.strokeStyle = `rgba(18,13,24,${alpha})`; g.lineWidth = 0.08; g.lineCap = 'round';
      for (const d of dirs) { g.beginPath(); for (let k = -RL; k < RW + RL; k += spacing*(0.8 + srnd()*0.4)) { const j = (srnd() - 0.5)*0.3; if (d > 0) { g.moveTo(k + j, 0); g.lineTo(k + RL + j, RL); } else { g.moveTo(k + j, 0); g.lineTo(k - RL + j, RL); } } g.stroke(); }
      g.restore();
    };
    // gritty hatching along the boards (denser right at the boards)
    hatch(() => { rrect(0); rrect(5.5); }, 0.95, 0.13, [1]);
    hatch(() => { rrect(0); rrect(2.4); }, 0.75, 0.12, [-1]);
    // radiating ink around hazards
    for (const hz of [...H.holes, ...H.vents, ...H.slime, ...H.wells]) {
      const r0 = (hz.r || 3) + 0.3, r1 = r0 + 4.5;
      hatch(() => { g.arc(hz.x, hz.y, r1, 0, 7); g.moveTo(hz.x + r0, hz.y); g.arc(hz.x, hz.y, r0, 0, 7); }, 0.55, 0.2, [1, -1]);
      g.strokeStyle = 'rgba(18,13,24,.55)'; g.lineWidth = 0.14; g.beginPath();
      for (let i=0;i<14;i++){ const a = srnd()*Math.PI*2, l = 1.5 + srnd()*3.5; g.moveTo(hz.x + Math.cos(a)*r0, hz.y + Math.sin(a)*r0); g.lineTo(hz.x + Math.cos(a)*(r0 + l), hz.y + Math.sin(a)*(r0 + l)); }
      g.stroke();
    }
    // markings: a thick ink pass first, then the paint on top, so every line carries a black border
    const creasePath = (gy, d) => { g.beginPath(); g.moveTo(CX-4, gy); g.lineTo(CX-4, gy + d*4.5); g.arc(CX, gy + d*4.5, 4, d > 0 ? Math.PI : 0, d > 0 ? 0 : Math.PI, d > 0); g.lineTo(CX+4, gy); g.closePath(); };
    const marks = (ink) => {
      const lw = n => ink ? n + 0.36 : n, R = ink ? INK : RED, Bl = ink ? INK : BLUE, pad = ink ? 0.2 : 0;
      g.fillStyle = R; g.fillRect(0, 99.5 - pad, RW, 1 + pad*2);
      g.fillStyle = Bl; g.fillRect(0, 74.5 - pad, RW, 1 + pad*2); g.fillRect(0, 124.5 - pad, RW, 1 + pad*2);
      g.fillStyle = R; g.fillRect(0, GT-0.09 - pad, RW, 0.18 + pad*2); g.fillRect(0, GB-0.09 - pad, RW, 0.18 + pad*2);
      g.strokeStyle = Bl; g.lineWidth = lw(0.17); g.beginPath(); g.arc(CX, 100, 15, 0, 7); g.stroke();
      g.fillStyle = Bl; g.beginPath(); g.arc(CX, 100, ink ? 0.75 : 0.5, 0, 7); g.fill();
      g.fillStyle = R; for (const [x,y] of [[20.5,80],[64.5,80],[20.5,120],[64.5,120]]) { g.beginPath(); g.arc(x, y, ink ? 1.25 : 1, 0, 7); g.fill(); }
      for (const [x,y] of [[20.5,31],[64.5,31],[20.5,169],[64.5,169]]) {
        g.strokeStyle = R; g.lineWidth = lw(0.17); g.beginPath(); g.arc(x,y,15,0,7); g.stroke();
        g.fillStyle = R; g.beginPath(); g.arc(x, y, ink ? 1.25 : 1, 0, 7); g.fill();
        g.lineWidth = lw(0.17); g.beginPath();
        for (const sd of [-1,1]) for (const dy of [-2.9,2.9]) { const ex = x + sd*14.72; g.moveTo(ex, y+dy); g.lineTo(ex+sd*2, y+dy); }
        for (const sx of [-1,1]) for (const sy of [-1,1]) { g.moveTo(x+sx*2, y+sy*0.75); g.lineTo(x+sx*2, y+sy*3.75); g.moveTo(x+sx*2, y+sy*0.75); g.lineTo(x+sx*6, y+sy*0.75); }
        g.stroke();
      }
      for (const [gy, d] of [[GT,1],[GB,-1]]) {
        creasePath(gy, d);
        if (!ink) { g.fillStyle = 'rgba(96,165,226,.6)'; g.fill(); }
        g.strokeStyle = R; g.lineWidth = lw(0.17); g.stroke();
        g.beginPath(); g.moveTo(CX-11, gy); g.lineTo(CX-14, gy - d*GT); g.moveTo(CX+11, gy); g.lineTo(CX+14, gy - d*GT); g.stroke();
      }
    };
    g.lineJoin = 'round'; g.lineCap = 'round';
    g.globalAlpha = 0.92; marks(true);
    marks(false);
    g.fillStyle = 'rgba(255,255,255,.8)'; for (let x=1;x<RW;x+=3) g.fillRect(x, 99.86, 1.2, 0.28);
    g.globalAlpha = 1;
    for (const [gy, d] of [[GT,1],[GB,-1]]) hatch(() => creasePath(gy, d), 0.55, 0.22, [1]);
    // distressed ink: knock small flecks of ice back through the lines
    g.fillStyle = mid; for (let i=0;i<900;i++){ const x = srnd()*RW, y = srnd()*RL; g.fillRect(x, y, 0.08 + srnd()*0.22, 0.05 + srnd()*0.12); }
    g.fillStyle = 'rgba(18,13,24,.18)'; for (let i=0;i<500;i++){ const x = srnd()*RW, y = srnd()*RL; g.beginPath(); g.arc(x, y, 0.04 + srnd()*0.1, 0, 7); g.fill(); }
    // center ice: hand-inked Rink Rat stencil with halftone shading and splatter
    g.save(); g.translate(CX, 100);
    const emblem = () => {
      for (const a of [0.7,-0.7]) { g.save(); g.rotate(a); g.rect(-11,-0.8,22,1.6); for (const sx of [-11,11]) { g.moveTo(sx + 1.3, -0.9); g.arc(sx,-0.9,1.3,0,7); g.moveTo(sx + 1.3, 0.9); g.arc(sx,0.9,1.3,0,7); } g.restore(); }
      g.moveTo(5.6, -0.6); g.ellipse(0,-0.6,5.6,4.9,0,0,7); g.moveTo(-2.9,2.4); g.lineTo(0,7.6); g.lineTo(2.9,2.4); g.closePath();
      g.moveTo(-1.7, -4.9); g.arc(-4.4,-4.9,2.7,0,7); g.moveTo(7.1, -4.9); g.arc(4.4,-4.9,2.7,0,7);
    };
    g.fillStyle = 'rgba(18,13,24,.55)'; for (let i=0;i<26;i++){ const a = srnd()*Math.PI*2, r = 8.5 + srnd()*6, rr = 0.15 + srnd()*0.6; g.beginPath(); g.arc(Math.cos(a)*r, Math.sin(a)*r, rr, 0, 7); g.fill(); for (let k=0;k<3;k++){ g.beginPath(); g.arc(Math.cos(a)*(r + rr + srnd()*1.4), Math.sin(a)*(r + rr + srnd()*1.4), rr*0.35, 0, 7); g.fill(); } }
    g.beginPath(); emblem(); g.strokeStyle = INK; g.lineWidth = 0.9; g.stroke();
    g.beginPath(); emblem(); g.fillStyle = 'rgba(255,181,30,.88)'; g.fill('nonzero');
    g.save(); g.beginPath(); emblem(); g.clip('nonzero');
    g.fillStyle = 'rgba(18,13,24,.26)'; for (let y=-14;y<14;y+=0.7) for (let x=-14;x<14;x+=0.7) { const rr = 0.08 + Math.max(0, (y + 2)/14)*0.22; g.beginPath(); g.arc(x + ((y*10|0)%2 ? 0.35 : 0), y, rr, 0, 7); g.fill(); }
    g.restore();
    g.fillStyle = INK; g.beginPath(); g.arc(-2.1,-0.7,1.35,0,7); g.arc(2.1,-0.7,1.35,0,7); g.fill();
    g.beginPath(); g.moveTo(-0.5, 1.2); g.lineTo(0, 0.4); g.lineTo(0.5, 1.2); g.closePath(); g.fill();
    g.fillStyle = '#f6f2e6'; g.beginPath(); g.arc(-2.5, -1.1, 0.35, 0, 7); g.arc(1.7, -1.1, 0.35, 0, 7); g.fill();
    g.globalAlpha = 0.7; g.fillStyle = INK; g.font = '2.3px Bungee, "Arial Black", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const ringText = (txt, rad, a0, dir) => { const chars = [...txt], step = 0.155; let a = a0 - dir*step*(chars.length-1)/2; for (const ch of chars) { g.save(); g.rotate(a); g.translate(0, -dir*rad); g.fillText(ch, 0, 0); g.restore(); a += dir*step; } };
    ringText('RINK RAT MAYHEM', 12.3, 0, 1); ringText(G.ch.arena.toUpperCase(), 12.3, Math.PI, -1);
    g.restore();
    g.fillStyle = 'rgba(246,250,253,0.035)'; g.fillRect(0,0,RW,RL);
    if (!paintTex) { paintCvs = cvs; paintTex = canvasTex(cvs); paintTex.generateMipmaps = true; paintTex.minFilter = THREE.LinearMipmapLinearFilter; }
    else paintTex.needsUpdate = true;
  }
  function resetScuff(G){
    sctx.setTransform(1,0,0,1,0,0); sctx.globalCompositeOperation = 'source-over'; sctx.fillStyle = '#000'; sctx.fillRect(0,0,scuffCvs.width,scuffCvs.height);
    sctx.setTransform(SK,0,0,SK,0,0); sctx.globalCompositeOperation = 'lighter';
    const path = () => { sctx.beginPath(); sctx.moveTo(CR,0); sctx.arcTo(RW,0,RW,RL,CR); sctx.arcTo(RW,RL,0,RL,CR); sctx.arcTo(0,RL,0,0,CR); sctx.arcTo(0,0,RW,0,CR); sctx.closePath(); };
    for (const [w,a] of [[14,0.12],[8,0.18],[4,0.25],[1.6,0.35]]) { sctx.strokeStyle = `rgba(0,255,0,${a})`; sctx.lineWidth = w; path(); sctx.stroke(); }
    for (const gy of [GT, GB]) { const rg = sctx.createRadialGradient(CX, gy, 0, CX, gy, 9); rg.addColorStop(0,'rgba(0,255,0,.55)'); rg.addColorStop(1,'rgba(0,255,0,0)'); sctx.fillStyle = rg; sctx.fillRect(CX-9, gy-9, 18, 18); }
    for (const [x,y] of [[20.5,31],[64.5,31],[20.5,169],[64.5,169],[CX,100],[20.5,80],[64.5,80],[20.5,120],[64.5,120]]) { const rg = sctx.createRadialGradient(x,y,0,x,y,3.5); rg.addColorStop(0,'rgba(0,255,0,.45)'); rg.addColorStop(1,'rgba(0,255,0,0)'); sctx.fillStyle = rg; sctx.fillRect(x-3.5,y-3.5,7,7); }
    scuffTex.needsUpdate = true;
  }
  function scuffLine(x0, y0, x1, y1, w, a){ sctx.strokeStyle = `rgba(255,0,0,${a})`; sctx.lineWidth = w; sctx.beginPath(); sctx.moveTo(x0,y0); sctx.lineTo(x1,y1); sctx.stroke(); }

  const iceGeo = new THREE.ShapeGeometry(roundedShape(0), 24);
  iceGeo.rotateX(-Math.PI/2);
  { const p = iceGeo.attributes.position, u = new Float32Array(p.count*2); for (let i=0;i<p.count;i++){ u[i*2] = (p.getX(i) + CX)/RW; u[i*2+1] = 1 - (p.getZ(i) + RL/2)/RL; } iceGeo.setAttribute('uv', new THREE.BufferAttribute(u, 2)); }
  const ice = new THREE.Mesh(iceGeo); ice.receiveShadow = true; scene.add(ice);
  const iceMats = {};
  function iceMaterial(mode){
    if (iceMats[mode]) return iceMats[mode];
    const m = new THREE.MeshPhysicalNodeMaterial();
    const P = texture(paintTex, uv()), Sc = texture(scuffTex, uv());
    const frost = clamp(Sc.r.mul(1.5).add(Sc.g.mul(snowU)), 0, 1);
    const tx = 1/(RW*SK), ty = 1/(RL*SK);
    const sEdge = tAbs(Sc.r.sub(texture(scuffTex, uv().add(vec2(tx*1.5, 0))).r)).add(tAbs(Sc.r.sub(texture(scuffTex, uv().add(vec2(0, ty*1.5))).r)));
    const scuffInk = smoothstep(0.035, 0.12, sEdge).mul(0.55);
    const base = mix(mix(P.rgb, vec3(0.965, 0.98, 1.0), frost.mul(0.6)), vec3(0.09, 0.07, 0.12), scuffInk);
    m.roughnessNode = float(0.14).add(frost.mul(0.5));
    m.metalnessNode = float(0);
    m.clearcoatNode = oneMinus(frost.mul(0.65));
    m.clearcoatRoughnessNode = float(0.04).add(frost.mul(0.35));
    if (mode === 'low') { m.colorNode = base; }
    else {
      const r = reflector({ resolutionScale: mode === 'high' ? 0.75 : 0.5 });
      r.target.rotateX(-Math.PI/2); scene.add(r.target);
      const rk = float(0.2).mul(oneMinus(frost.mul(0.85)));
      const rl = luminance(r.rgb.min(vec3(1.0)));
      const band = tFloor(rl.mul(4)).div(4);                       // cartoon glint bands
      const rc = mix(vec3(band), r.rgb.min(vec3(0.85)), 0.35);
      m.colorNode = mix(base, rc, rk);
      m.emissiveNode = vec3(band).mul(step(0.7, rl)).mul(rk.mul(0.9));
      m.userData.reflTarget = r.target;
    }
    iceMats[mode] = m; return m;
  }

  // ------------------------------------------------ arena
  const arena = new THREE.Group(); scene.add(arena);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), new THREE.MeshStandardNodeMaterial({ color:0x0c0d11, roughness:0.9 }));
  floor.rotation.x = -Math.PI/2; floor.position.y = -0.06; floor.receiveShadow = true; arena.add(floor);
  const P1 = perimeter(4);
  const PERIM = P1[P1.length-1].u;
  // ice crew gate: a doorway in the far side boards (x = 0) with a tunnel under the stands
  const ZT = S.Z, GATE_Y = ZT.GATE;
  const inGate = (p, q) => p.nx < -0.9 && q.nx < -0.9 && Math.min(p.y, q.y) >= GATE_Y - 4.05 && Math.max(p.y, q.y) <= GATE_Y + 4.05;
  const TUN0 = GATE_Y - 7.1, TUN1 = GATE_Y + 4.6;   // the stands' gap (perimeter(6) points on the side wall)
  const inTunnel = (p, q, seg) => p.nx < -0.9 && q.nx < -0.9 && Math.abs((p.y + q.y)/2 - GATE_Y + 1.2) < 6 && Math.max(seg[0][1], seg[1][1]) <= 8.31;
  const boardCvs = document.createElement('canvas'); boardCvs.width = 4096; boardCvs.height = 128;
  const boardTex = canvasTex(boardCvs); boardTex.wrapS = THREE.RepeatWrapping;
  const BOARD_TEX_LEN = 128;
  const boardMat = new THREE.MeshPhysicalNodeMaterial({ map:boardTex, roughness:0.38, clearcoat:0.35, clearcoatRoughness:0.25, side:THREE.DoubleSide });
  const boards = new THREE.Mesh(ringGeo(P1, [[[0,0],[0,3.5]]], BOARD_TEX_LEN, null, inGate), boardMat); boards.receiveShadow = true; boards.castShadow = true; arena.add(boards);
  const capMat = new THREE.MeshStandardNodeMaterial({ color:0x5b6a80, roughness:0.45, metalness:0.1, side:THREE.DoubleSide });
  arena.add(new THREE.Mesh(ringGeo(P1, [[[0,3.5],[0.75,3.5]], [[0.75,3.5],[0.75,0]]], null, null, inGate), capMat));
  const glassH = p => 3.5 + (Math.abs(p.y - 100) > 74 ? 8 : 5.5);
  const glassMat = new THREE.MeshPhysicalNodeMaterial({ color:0xffffff, roughness:0.05, metalness:0, transparent:true, side:THREE.DoubleSide, depthWrite:false, clearcoat:1 });
  { const NV = TSL.normalView, VD = TSL.positionViewDirection; glassMat.opacityNode = float(0.06).add(oneMinus(NV.dot(VD).abs()).pow(3).mul(0.45)); }
  const glass = new THREE.Mesh(ringGeo(P1, [[[0.35,3.5],[0.35,glassH]]], null, null, inGate), glassMat); glass.renderOrder = 5; arena.add(glass);
  { // stanchions every 8 ft
    const P8 = perimeter(8), geo = new THREE.BoxGeometry(0.16, 1, 0.16), inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardNodeMaterial({ color:0xc9d2dc, roughness:0.35, metalness:0.6 }), P8.length);
    const m = new THREE.Matrix4(); P8.forEach((p,i) => { const h = glassH(p) - 3.5, gap = p.nx < -0.9 && Math.abs(p.y - GATE_Y) < 4.2; m.compose(new THREE.Vector3(p.x + p.nx*0.35 - CX, 3.5 + h/2, p.y + p.ny*0.35 - RL/2), new THREE.Quaternion(), new THREE.Vector3(1, gap ? 0 : h, 1)); inst.setMatrixAt(i, m); });
    arena.add(inst);
  }
  // seating bowl
  const ROWS = 24, rowOff = r => 7 + r*2.9, rowH = r => 4.6 + r*1.85;
  { const segs = [[[3,0],[3,4.0]], [[3,4.0],[rowOff(0),4.0]], [[rowOff(0),4.0],[rowOff(0),rowH(0)]]];
    for (let r=0;r<ROWS;r++){ segs.push([[rowOff(r),rowH(r)],[rowOff(r)+2.9,rowH(r)]]); segs.push([[rowOff(r)+2.9,rowH(r)],[rowOff(r)+2.9,rowH(r+1)]]); }
    segs.push([[rowOff(ROWS),rowH(ROWS)],[rowOff(ROWS)+6,rowH(ROWS)+30]]);
    const bowl = new THREE.Mesh(ringGeo(perimeter(6), segs, null, null, inTunnel), new THREE.MeshStandardNodeMaterial({ color:0x15161c, roughness:0.92, side:THREE.DoubleSide }));
    arena.add(bowl);
  }
  const ribbonCvs = document.createElement('canvas'); ribbonCvs.width = 2048; ribbonCvs.height = 32;
  const ribbonTex = canvasTex(ribbonCvs); ribbonTex.wrapS = THREE.RepeatWrapping;
  const ribbonMat = new THREE.MeshBasicNodeMaterial({ side:THREE.DoubleSide });
  ribbonMat.colorNode = texture(ribbonTex, uv()).rgb.mul(1.6);
  { const rr = 9; arena.add(new THREE.Mesh(ringGeo(perimeter(6), [[[rowOff(rr)-0.05, rowH(rr)+0.2],[rowOff(rr)-0.05, rowH(rr)+1.6]]], 220), ribbonMat)); }
  // crowd
  const crowdPos = [];
  for (let r=0;r<ROWS;r++){
    const off = rowOff(r) + 1.3, pts = perimeter(2.25);
    for (const p of pts) {
      if (r < 4 && p.nx < -0.9 && Math.abs(p.y - 100) < 24) continue;
      if (r < 2 && p.nx < -0.9 && p.y > TUN0 - 1 && p.y < TUN1 + 1) continue;
      if (r === 9) continue;
      crowdPos.push([p.x + p.nx*off - CX, rowH(r), p.y + p.ny*off - RL/2, Math.atan2(-p.nx, -p.ny)]);
    }
  }
  for (let i=crowdPos.length-1;i>0;i--){ const j = Math.floor(Math.random()*(i+1)); [crowdPos[i], crowdPos[j]] = [crowdPos[j], crowdPos[i]]; }
  // crowd: comic mutant fans built like the players (species heads, team jerseys), cel shaded and inked.
  // One instanced mesh per species; arms swing up from the shoulder in the vertex shader when they cheer.
  const cheerU = uniform(0), standU = uniform(0), cheerAU = uniform(0), standAU = uniform(0);
  const FAN_SPECIES = ['rat', 'skeleton', 'troll', 'gremlin', 'hog', 'robot', 'ogre', 'horror'];
  const FAN_W = [0.3, 0.1, 0.09, 0.1, 0.09, 0.11, 0.09, 0.12];
  const fans = [];   // { mesh, ink, species, idx:[seat indices], jer, trim, team }
  function fanGeo(sp){
    const SP = S.SPECIES[sp], head = SP.head, acc = SP.acc, pants = '#26222e', dark = '#120d16', white = '#f4f1e8';
    const parts = [], E = new THREE.Euler(), Q = new THREE.Quaternion(), M = new THREE.Matrix4(), V = new THREE.Vector3(), Sc = new THREE.Vector3();
    // kind: 0 = fixed colour, 1 = jersey, 2 = trim; arm: 0 body, 1 left arm, -1 right arm
    const add = (g, col, kind, arm, pos, rot = [0,0,0], scl = [1,1,1]) => {
      g = g.index ? g.toNonIndexed() : g; g.deleteAttribute('uv');
      g.applyMatrix4(M.compose(V.set(...pos), Q.setFromEuler(E.set(...rot)), Sc.set(...scl)));
      const n = g.attributes.position.count, c = new THREE.Color(col || '#ffffff'), ca = new Float32Array(n*3), fa = new Float32Array(n*2);
      for (let i=0;i<n;i++){ ca[i*3] = c.r; ca[i*3+1] = c.g; ca[i*3+2] = c.b; fa[i*2] = kind; fa[i*2+1] = arm; }
      g.setAttribute('color', new THREE.Float32BufferAttribute(ca, 3)); g.setAttribute('aFan', new THREE.Float32BufferAttribute(fa, 2));
      parts.push(g);
    };
    const cyl = (a, b, h, n = 7, open = false) => new THREE.CylinderGeometry(a, b, h, n, 1, open), sph = (r, w = 8, h = 6) => new THREE.SphereGeometry(r, w, h), box = (x, y, z) => new THREE.BoxGeometry(x, y, z), cone = (r, h, n = 6) => new THREE.ConeGeometry(r, h, n);
    // seated body
    add(box(0.92, 0.34, 0.95), pants, 0, 0, [0, 0.17, 0.36]);
    add(cyl(0.4, 0.47, 0.95), null, 1, 0, [0, 0.8, 0]);
    add(cyl(0.41, 0.43, 0.13, 7, true), null, 2, 0, [0, 0.58, 0]);
    add(cyl(0.46, 0.41, 0.2), null, 2, 0, [0, 1.22, 0]);
    for (const sd of [-1, 1]) {
      add(sph(0.27, 6, 4), null, 1, 0, [sd*0.44, 1.22, 0]);
      add(cyl(0.15, 0.13, 0.62, 5, true), null, 1, sd, [sd*0.55, 0.96, 0.05]);          // upper arm (hangs from the shoulder)
      add(cyl(0.13, 0.12, 0.5, 5, true), null, 2, sd, [sd*0.57, 0.48, 0.12], [0.35, 0, 0]);
      add(sph(0.14, 5, 3), head, 0, sd, [sd*0.57, 0.22, 0.2]);                    // hand
    }
    add(cyl(0.17, 0.2, 0.22, 6, true), head, 0, 0, [0, 1.38, 0]);
    // species heads
    const H = [0, 1.76, 0.02];
    switch (sp) {
      case 'rat':
        add(sph(0.36), head, 0, 0, H);
        for (const sd of [-1, 1]) { add(cyl(0.19, 0.19, 0.06, 8), head, 0, 0, [sd*0.27, 2.08, -0.02], [Math.PI/2, 0, 0]); add(cyl(0.12, 0.12, 0.07, 8), acc, 0, 0, [sd*0.27, 2.08, 0.01], [Math.PI/2, 0, 0]); }
        add(cone(0.16, 0.34), head, 0, 0, [0, 1.7, 0.42], [Math.PI/2, 0, 0]); add(sph(0.06, 5, 4), acc, 0, 0, [0, 1.7, 0.6]);
        break;
      case 'skeleton':
        add(sph(0.36), head, 0, 0, H, [0,0,0], [1, 1.05, 1]);
        for (const sd of [-1, 1]) add(sph(0.1, 6, 4), dark, 0, 0, [sd*0.13, 1.8, 0.3]);
        add(box(0.34, 0.14, 0.28), head, 0, 0, [0, 1.5, 0.12]); add(box(0.26, 0.04, 0.02), dark, 0, 0, [0, 1.52, 0.27]);
        break;
      case 'troll':
        add(sph(0.38), head, 0, 0, H, [0,0,0], [1.05, 0.95, 1]);
        add(cone(0.16, 0.42), acc, 0, 0, [0, 2.18, -0.05], [-0.3, 0, 0]);
        for (const sd of [-1, 1]) add(cone(0.06, 0.2, 5), white, 0, 0, [sd*0.14, 1.6, 0.33], [0.4, 0, 0]);
        add(sph(0.11, 6, 4), head, 0, 0, [0, 1.74, 0.38]);
        break;
      case 'gremlin':
        add(sph(0.33), head, 0, 0, H);
        for (const sd of [-1, 1]) { add(cone(0.12, 0.55, 5), head, 0, 0, [sd*0.48, 1.86, 0], [0, 0, -sd*Math.PI/2.4]); add(sph(0.09, 6, 4), '#ffe14a', 0, 0, [sd*0.12, 1.8, 0.27]); }
        break;
      case 'hog':
        add(sph(0.38), head, 0, 0, H);
        add(cyl(0.16, 0.17, 0.2, 10), acc, 0, 0, [0, 1.7, 0.38], [Math.PI/2, 0, 0]);
        for (const sd of [-1, 1]) { add(cone(0.12, 0.24, 4), head, 0, 0, [sd*0.24, 2.1, 0], [0, 0, -sd*0.5]); add(sph(0.035, 4, 3), dark, 0, 0, [sd*0.06, 1.7, 0.49]); }
        break;
      case 'robot':
        add(box(0.58, 0.52, 0.52), head, 0, 0, H);
        add(box(0.48, 0.12, 0.04), acc, 0, 0, [0, 1.8, 0.28]);
        add(cyl(0.025, 0.025, 0.3, 4), head, 0, 0, [0.14, 2.15, 0]); add(sph(0.07, 5, 4), acc, 0, 0, [0.14, 2.32, 0]);
        break;
      case 'ogre':
        add(sph(0.42), head, 0, 0, H, [0,0,0], [1.1, 0.95, 1]);
        add(box(0.6, 0.1, 0.16), dark, 0, 0, [0, 1.92, 0.3]);
        for (const sd of [-1, 1]) add(cone(0.06, 0.24, 5), acc, 0, 0, [sd*0.15, 1.62, 0.36], [0.2, 0, 0]);
        break;
      default: // horror
        add(sph(0.38), head, 0, 0, H);
        add(sph(0.19, 8, 6), white, 0, 0, [0, 1.83, 0.26]); add(sph(0.09, 6, 4), dark, 0, 0, [0, 1.83, 0.42]);
        for (const dx of [-0.16, 0, 0.16]) add(cone(0.06, 0.34, 5), head, 0, 0, [dx, 1.4, 0.18], [Math.PI, 0, 0]);
    }
    return BGU.mergeGeometries(parts);
  }
  // shared fan animation: idle bob and the odd waver; on a goal the scoring team's fans stand, jump and throw their arms up
  function fanAnim(jtA, ink){
    const h = hash(instanceIndex), h2 = hash(instanceIndex.add(7)), h3 = hash(instanceIndex.add(19));
    const team = instancedBufferAttribute(jtA).w;
    const cheer = mix(cheerU, cheerAU, team), stand = mix(standU, standAU, team);
    const bob = sin(time.mul(float(1.6).add(h.mul(2))).add(h.mul(40))).mul(0.05);
    const jump = sin(time.mul(float(8).add(h2.mul(4))).add(h.mul(30))).abs().mul(0.62).mul(cheer).mul(step(0.3, h));
    const lift = stand.mul(step(0.22, h)).mul(0.55);
    const wave = step(0.9, h3).mul(float(0.5).add(sin(time.mul(2.4).add(h.mul(20))).mul(0.4)));
    const theta = wave.add(cheer.mul(float(2.25).add(sin(time.mul(11).add(h2.mul(30))).mul(0.35))).mul(step(0.18, h2)));
    const side = attribute('aFan', 'vec2').y, isArm = side.abs();
    const ang = theta.mul(side), ca = cos(ang), sa = sin(ang);
    const pv = vec3(side.mul(0.52), 1.24, 0);
    const rp = positionLocal.sub(pv);
    const pArm = pv.add(vec3(rp.x.mul(ca).sub(rp.y.mul(sa)), rp.x.mul(sa).add(rp.y.mul(ca)), rp.z));
    let pos = mix(positionLocal, pArm, isArm);
    if (ink) { const n = normalLocal, nArm = vec3(n.x.mul(ca).sub(n.y.mul(sa)), n.x.mul(sa).add(n.y.mul(ca)), n.z); pos = pos.add(mix(n, nArm, isArm).mul(0.075)); }
    return pos.add(vec3(0, bob.add(jump).add(lift), 0));
  }
  function fanMat(jtA, trimA){
    const m = new THREE.MeshBasicNodeMaterial();
    const kind = attribute('aFan', 'vec2').x, vc = attribute('color', 'vec3');
    let col = mix(vc, instancedBufferAttribute(jtA).xyz, step(0.5, kind).mul(step(kind, 1.5)));
    col = mix(col, instancedBufferAttribute(trimA), step(1.5, kind));
    const ndl = normalWorld.dot(vec3(0.36, 0.86, 0.36).normalize());
    const tone = mix(float(0.42), mix(float(0.7), float(0.95), step(0.45, ndl)), step(0.02, ndl));
    const facing = normalView.dot(positionViewDirection).abs();
    const rim = step(0.76, oneMinus(facing)).mul(step(0.0, ndl));
    m.colorNode = col.mul(tone).add(vec3(1.0, 0.82, 0.5).mul(rim.mul(0.18))).mul(0.9);
    m.positionNode = fanAnim(jtA, false);
    return m;
  }
  function fanInk(jtA){ const m = new THREE.MeshBasicNodeMaterial({ color:0x0b0710, side:THREE.BackSide }); m.positionNode = fanAnim(jtA, true); return m; }
  const CROWD_MAX = Math.min(6000, crowdPos.length);
  {
    const seatsBy = FAN_SPECIES.map(() => []), wsum = FAN_W.reduce((a, b) => a + b, 0);
    for (let i=0;i<CROWD_MAX;i++){ let r = Math.random()*wsum, k = 0; while (r > FAN_W[k] && k < FAN_W.length - 1) { r -= FAN_W[k]; k++; } seatsBy[k].push(i); }
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pv = new THREE.Vector3(), sv = new THREE.Vector3();
    FAN_SPECIES.forEach((sp, k) => {
      const idx = seatsBy[k], n = idx.length; if (!n) return;
      const geo = fanGeo(sp);
      const jer = new THREE.InstancedBufferAttribute(new Float32Array(n*4).fill(0.5), 4), trim = new THREE.InstancedBufferAttribute(new Float32Array(n*3).fill(0.8), 3);
      const mesh = new THREE.InstancedMesh(geo, fanMat(jer, trim), n), ink = new THREE.InstancedMesh(geo, fanInk(jer), n);
      idx.forEach((ci, j) => { const [x, y, z, yaw] = crowdPos[ci]; const sc = 0.88 + Math.random()*0.22; m4.compose(pv.set(x, y, z), q.setFromEuler(e.set(0, yaw + (Math.random()-0.5)*0.35, 0)), sv.set(sc, sc, sc)); mesh.setMatrixAt(j, m4); ink.setMatrixAt(j, m4); });
      mesh.frustumCulled = ink.frustumCulled = false;
      arena.add(mesh); arena.add(ink);
      fans.push({ mesh, ink, species:sp, n, jer, trim });
    });
  }
  function setCrowdCount(total){ const f = Math.min(1, total/CROWD_MAX); for (const F of fans) { F.mesh.count = F.ink.count = Math.round(F.n*f); } }
  function recolorCrowd(G){
    const H = S.HOME, O = G.ch.opp, tmp = new THREE.Color(), oppSp = O.species;
    const neutral = ['#4a4f5c','#6a6f78','#8a7a60','#2a2f3a','#7a2430','#2f4f7a','#4b5b3a','#9aa0a8'];
    for (const F of fans) {
      const J = F.jer.array, T = F.trim.array;
      const pHome = F.species === 'rat' ? 0.78 : F.species === oppSp ? 0.08 : 0.4, pAway = F.species === oppSp ? 0.8 : F.species === 'rat' ? 0.05 : 0.3;
      for (let i=0;i<F.n;i++){
        const r = Math.random(), tm = r < pHome ? 0 : r < pHome + pAway ? 1 : 0.5;
        const jc = tm === 0 ? H.jersey : tm === 1 ? O.jersey : neutral[Math.floor(Math.random()*neutral.length)];
        const tc = tm === 0 ? H.trim : tm === 1 ? O.trim : '#d8d4c8';
        const sh = 0.78 + Math.random()*0.22;
        tmp.set(jc).multiplyScalar(sh); J[i*4] = tmp.r; J[i*4+1] = tmp.g; J[i*4+2] = tmp.b; J[i*4+3] = tm;
        tmp.set(tc).multiplyScalar(sh); T[i*3] = tmp.r; T[i*3+1] = tmp.g; T[i*3+2] = tmp.b;
      }
      F.jer.needsUpdate = F.trim.needsUpdate = true;
    }
  }
  // benches and penalty boxes
  { const m = new THREE.MeshStandardNodeMaterial({ color:0x22252d, roughness:0.8 });
    for (const [z, w] of [[-8, 12], [8, 12]]) { const b = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, w), m); b.position.set(-CX - 3.4, 0.8, z); arena.add(b); const bk = new THREE.Mesh(new THREE.BoxGeometry(0.4, 3.2, w), m); bk.position.set(-CX - 6, 1.6, z); arena.add(bk); }
    const pb = new THREE.Mesh(new THREE.BoxGeometry(5, 1.6, 9), m); pb.position.set(CX + 3.4, 0.8, 0); arena.add(pb);
  }
  // ice crew tunnel + swinging gate
  const gateDoor = new THREE.Group();
  { const len = 34, hgt = 8, wd = TUN1 - TUN0, zc = (TUN0 + TUN1)/2 - RL/2;
    const tm = new THREE.MeshStandardNodeMaterial({ color:0x0e0d13, roughness:0.95, side:THREE.DoubleSide });
    const tg = new THREE.Group(); tg.position.set(-CX, 0, zc); arena.add(tg);
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(len, wd), new THREE.MeshStandardNodeMaterial({ color:0x1b1c22, roughness:0.85 })); fl.rotation.x = -Math.PI/2; fl.position.set(-len/2, 0.01, 0); fl.receiveShadow = true; tg.add(fl);
    const rf = new THREE.Mesh(new THREE.PlaneGeometry(len, wd), tm); rf.rotation.x = Math.PI/2; rf.position.set(-len/2, hgt, 0); tg.add(rf);
    for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.PlaneGeometry(len, hgt), tm); w.position.set(-len/2, hgt/2, sd*wd/2); tg.add(w); }
    const bk = new THREE.Mesh(new THREE.PlaneGeometry(wd, hgt), new THREE.MeshBasicNodeMaterial({ color:0x020203 })); bk.rotation.y = Math.PI/2; bk.position.set(-len, hgt/2, 0); tg.add(bk);
    const lamp = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(1.6, 1.45, 1.1) });
    for (let i = 0; i < 4; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 0.5), lamp); l.position.set(-4 - i*8, hgt - 0.1, 0); tg.add(l); }
    // frame posts and a lit header sign over the doorway
    const steel = new THREE.MeshStandardNodeMaterial({ color:0x8b95a3, roughness:0.4, metalness:0.7 });
    for (const y of [GATE_Y - 4.15, GATE_Y + 4.15]) { const po = new THREE.Mesh(new THREE.BoxGeometry(0.6, hgt + 1.4, 0.6), steel); po.position.set(-CX - 0.1, (hgt + 1.4)/2, y - RL/2); po.castShadow = true; arena.add(po); }
    const sc = document.createElement('canvas'); sc.width = 256; sc.height = 40; const sg = sc.getContext('2d');
    sg.fillStyle = '#0b0a10'; sg.fillRect(0, 0, 256, 40); sg.fillStyle = '#7ef0ff'; sg.font = '26px Bungee, "Arial Black", sans-serif'; sg.textAlign = 'center'; sg.textBaseline = 'middle'; sg.fillText('ICE CREW', 128, 21);
    const signMat = new THREE.MeshBasicNodeMaterial(); signMat.colorNode = texture(canvasTex(sc), uv()).rgb.mul(1.7);
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.4, 8.9), [signMat, steel, steel, steel, steel, steel]); sign.position.set(-CX - 0.1, hgt + 0.7, GATE_Y - RL/2); arena.add(sign);   // +x face looks at the ice
    // the gate: a board panel with its glass, hinged at the far post, swings back into the tunnel
    gateDoor.position.set(-CX, 0, GATE_Y + 4 - RL/2); arena.add(gateDoor);
    const pan = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.5, 8), new THREE.MeshStandardNodeMaterial({ color:0xe9edf2, roughness:0.45 })); pan.position.set(0, 1.75, -4); pan.castShadow = true; gateDoor.add(pan);
    const kick = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.6, 8), new THREE.MeshStandardNodeMaterial({ color:0xd8a020, roughness:0.6 })); kick.position.set(0, 0.3, -4); gateDoor.add(kick);
    const gp = new THREE.Mesh(new THREE.BoxGeometry(0.08, 5.5, 8), glassMat); gp.position.set(0.15, 6.25, -4); gp.renderOrder = 5; gateDoor.add(gp);
  }
  // nets
  const netCvs = document.createElement('canvas'); netCvs.width = 64; netCvs.height = 64;
  { const g = netCvs.getContext('2d'); g.clearRect(0,0,64,64); g.strokeStyle = '#ffffff'; g.lineWidth = 3; for (let i=0;i<=64;i+=16){ g.beginPath(); g.moveTo(i,0); g.lineTo(i,64); g.stroke(); g.beginPath(); g.moveTo(0,i); g.lineTo(64,i); g.stroke(); } }
  const netTex = canvasTex(netCvs); netTex.wrapS = netTex.wrapT = THREE.RepeatWrapping;
  const netMeshMat = new THREE.MeshStandardNodeMaterial({ map:netTex, transparent:true, alphaTest:0.4, side:THREE.DoubleSide, roughness:0.8 });
  const postMat = new THREE.MeshPhysicalNodeMaterial({ color:0xd0202a, roughness:0.32, metalness:0.75, clearcoat:0.6 });
  const nets = [];
  for (const [gy, d] of [[GT, -1], [GB, 1]]) {
    const n = new THREE.Group(); n.position.set(0, 0, gy - RL/2); n.rotation.y = d > 0 ? 0 : Math.PI;
    const w = PRt - PL, H = 4;
    const post = new THREE.CylinderGeometry(0.12, 0.12, H, 10);
    for (const sx of [-w/2, w/2]) { const p = new THREE.Mesh(post, postMat); p.position.set(sx, H/2, 0); p.castShadow = true; n.add(p); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, w, 10), postMat); bar.rotation.z = Math.PI/2; bar.position.set(0, H, 0); bar.castShadow = true; n.add(bar);
    const base = new THREE.Mesh(new THREE.TorusGeometry(ND*0.9, 0.08, 6, 16, Math.PI), postMat); base.rotation.x = Math.PI/2; base.scale.set(w/2/(ND*0.9), 1, 1); base.position.y = 0.08; n.add(base);
    const mesh = new THREE.Group();
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, H), netMeshMat); back.position.set(0, H/2, ND*0.85); back.rotation.x = -0.25; mesh.add(back);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(w, ND), netMeshMat); top.rotation.x = Math.PI/2; top.position.set(0, H-0.2, ND/2); mesh.add(top);
    for (const sx of [-1, 1]) { const sd = new THREE.Mesh(new THREE.PlaneGeometry(ND, H), netMeshMat); sd.rotation.y = Math.PI/2; sd.position.set(sx*w/2, H/2, ND/2); mesh.add(sd); }
    const skirt = new THREE.Mesh(new THREE.PlaneGeometry(w-0.3, ND-0.3), new THREE.MeshStandardNodeMaterial({ color:0xf2f2f2, roughness:0.9 })); skirt.rotation.x = -Math.PI/2; skirt.position.set(0, 0.03, ND/2); mesh.add(skirt);
    n.add(mesh);
    // goal light behind the glass
    const lamp = new THREE.Group(); lamp.position.set(0, 13.5, ND + 9);
    lamp.add(new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 12), new THREE.MeshStandardNodeMaterial({ color:0x202228, roughness:0.6 })));
    const domeMat = new THREE.MeshBasicNodeMaterial({ transparent:true, opacity:0.95 }); const domeU = uniform(0.25); domeMat.colorNode = vec3(1, 0.08, 0.05).mul(domeU.mul(8).add(0.6));
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.85, 14, 8, 0, Math.PI*2, 0, Math.PI/2), domeMat); dome.position.y = 0.3; lamp.add(dome);
    n.add(lamp);
    arena.add(n);
    nets.push({ g:n, mesh, domeU, ripple:0, team: d < 0 ? 'away' : 'home' });
  }
  // jumbotron, ceiling, banners
  const jumboCvs = document.createElement('canvas'); jumboCvs.width = 512; jumboCvs.height = 296;
  const jumboTex = canvasTex(jumboCvs);
  const jumboMat = new THREE.MeshBasicNodeMaterial(); const jumboFlash = uniform(0);
  jumboMat.colorNode = texture(jumboTex, uv()).rgb.mul(float(1.6).add(jumboFlash.mul(3)));
  const jumbo = new THREE.Group(); jumbo.position.set(0, 128, 0);
  jumbo.add(new THREE.Mesh(new THREE.BoxGeometry(27, 16, 27), new THREE.MeshStandardNodeMaterial({ color:0x111216, roughness:0.5, metalness:0.4 })));
  for (let i=0;i<4;i++){ const s = new THREE.Mesh(new THREE.PlaneGeometry(25, 14.4), jumboMat); const a = i*Math.PI/2; s.position.set(Math.sin(a)*13.55, 0, Math.cos(a)*13.55); s.rotation.y = a; jumbo.add(s); }
  arena.add(jumbo);
  { const ceil = new THREE.Mesh(new THREE.PlaneGeometry(500, 600), new THREE.MeshStandardNodeMaterial({ color:0x07080a, roughness:1 })); ceil.rotation.x = Math.PI/2; ceil.position.y = 172; arena.add(ceil);
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(12, 0.6, 5), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(2.1, 2.1, 2.25) }), 45);
    const m4 = new THREE.Matrix4(); let i = 0; for (let a=-2;a<=2;a++) for (let b=-4;b<=4;b++){ m4.makeTranslation(a*28, 160, b*34); panels.setMatrixAt(i++, m4); }
    arena.add(panels);
    const steel = new THREE.MeshStandardNodeMaterial({ color:0x1a1c22, roughness:0.7, metalness:0.5 });
    for (let b=-4;b<=4;b++){ const t = new THREE.Mesh(new THREE.BoxGeometry(200, 1.2, 1.2), steel); t.position.set(0, 156, b*34 + 17); arena.add(t); }
  }
  const bannerCvs = document.createElement('canvas'); bannerCvs.width = 1024; bannerCvs.height = 256;
  const bannerTex = canvasTex(bannerCvs);
  const banners = new THREE.Group(); arena.add(banners);
  { const bm = new THREE.MeshStandardNodeMaterial({ map:bannerTex, roughness:0.8, side:THREE.DoubleSide });
    for (let i=0;i<4;i++){ const geo = new THREE.PlaneGeometry(10, 20); const uvs = geo.attributes.uv; for (let j=0;j<uvs.count;j++) uvs.setX(j, i*0.25 + uvs.getX(j)*0.25); const b = new THREE.Mesh(geo, bm); b.position.set(-30 + i*20, 120, -150); banners.add(b); const b2 = b.clone(); b2.position.z = 150; b2.rotation.y = Math.PI; banners.add(b2); } }

  function drawBoardAds(G){
    const g = boardCvs.getContext('2d'), Wd = boardCvs.width, Ht = boardCvs.height, px = Wd/BOARD_TEX_LEN;
    g.fillStyle = '#f3f4f2'; g.fillRect(0,0,Wd,Ht);
    const brands = [...BRANDS[G.ch.id], ...COMMON_BRANDS];
    const kick = Math.round(Ht*0.18);
    let x = 4*px, i = 0;
    const cols = ['#1d2433','#c62a2f','#1f5fd6','#2a8a4a','#f0a020','#3a1f5c','#111111'];
    while (x < Wd - 20*px) {
      const w = (14 + (i%3)*3)*px, b = brands[i % brands.length], c = cols[(i*3 + G.ch.tier) % cols.length];
      const y0 = 8, hh = Ht - kick - 16;
      g.fillStyle = c; g.fillRect(x, y0, w, hh);
      g.save(); g.beginPath(); g.rect(x, y0, w, hh); g.clip(); g.fillStyle = 'rgba(0,0,0,.16)';
      for (let yy = y0; yy < y0 + hh; yy += 6) for (let xx = x + ((yy/6)%2 ? 3 : 0); xx < x + w; xx += 6) { g.beginPath(); g.arc(xx, yy, 1.3, 0, 7); g.fill(); }
      g.restore();
      g.fillStyle = c === '#f0a020' ? '#1d1305' : '#ffffff';
      g.font = `${Math.round(hh*0.5)}px Bungee, "Arial Black", Impact, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 5; g.strokeStyle = '#120d18'; g.lineJoin = 'round'; g.strokeText(b, x + w/2, y0 + hh/2 + 2, w - 16); g.fillText(b, x + w/2, y0 + hh/2 + 2, w - 16);
      g.lineWidth = 7; g.strokeStyle = '#120d18'; g.strokeRect(x + 3.5, y0 + 3.5, w - 7, hh - 7);
      g.lineWidth = 3; g.beginPath(); for (const [cx2, cy2, sx, sy] of [[x, y0, 1, 1], [x + w, y0, -1, 1], [x, y0 + hh, 1, -1], [x + w, y0 + hh, -1, -1]]) { g.moveTo(cx2 - sx*6, cy2 - sy*6); g.lineTo(cx2 + sx*10, cy2 + sy*10); } g.stroke();
      x += w + 6*px; i++;
    }
    g.fillStyle = G.theme.kick; g.fillRect(0, Ht - kick, Wd, kick);
    g.save(); g.beginPath(); g.rect(0, Ht - kick, Wd, kick); g.clip(); g.strokeStyle = 'rgba(18,13,24,.32)'; g.lineWidth = 1.5;
    g.beginPath(); for (let xx = -kick; xx < Wd; xx += 7) { g.moveTo(xx, Ht); g.lineTo(xx + kick, Ht - kick); } g.stroke();
    g.strokeStyle = 'rgba(18,13,24,.18)'; g.beginPath(); for (let xx = 0; xx < Wd + kick; xx += 11) { g.moveTo(xx, Ht); g.lineTo(xx - kick, Ht - kick); } g.stroke(); g.restore();
    g.fillStyle = '#120d18'; g.fillRect(0, Ht - kick - 3, Wd, 4);
    g.fillStyle = 'rgba(0,0,0,.18)'; for (let j=0;j<160;j++){ g.fillRect(Math.random()*Wd, Ht - kick - Math.random()*Ht*0.35, 3 + Math.random()*8, 2 + Math.random()*3); }
    g.fillStyle = 'rgba(0,0,0,.25)'; for (let s=8*px; s<Wd; s+=8*px) g.fillRect(s, 0, 2, Ht);
    boardTex.needsUpdate = true;
    const r = ribbonCvs.getContext('2d'); r.fillStyle = '#05060a'; r.fillRect(0,0,2048,32);
    const acc = ACCENT[G.ch.id] || '#ffb51e';
    r.font = '20px Bungee, "Arial Black", sans-serif'; r.textBaseline = 'middle';
    let rx = 10; for (let j=0;j<12;j++){ const t = j%2 ? G.ch.arena.toUpperCase() : 'RINK RAT MAYHEM'; r.fillStyle = j%2 ? acc : '#ffb51e'; r.fillText(t, rx, 17); rx += r.measureText(t).width + 40; }
    ribbonTex.needsUpdate = true;
    const bn = bannerCvs.getContext('2d'); const names = ['RATS', G.ch.opp.abbr, 'MAYHEM CUP', G.ch.arena.toUpperCase()];
    for (let j=0;j<4;j++){ const x0 = j*256; bn.fillStyle = j%2 ? G.ch.opp.jersey : '#1d1305'; bn.fillRect(x0,0,256,256); bn.fillStyle = j%2 ? G.ch.opp.trim : '#ffb51e'; bn.fillRect(x0+12,12,232,8); bn.fillRect(x0+12,236,232,8); bn.font = '30px Bungee, "Arial Black", sans-serif'; bn.textAlign = 'center'; bn.fillText(names[j].slice(0,12), x0+128, 110, 230); bn.font = '20px Bungee, "Arial Black", sans-serif'; bn.fillText(j === 2 ? 'EST. 1347' : 'CHAMPIONS', x0+128, 160); }
    bannerTex.needsUpdate = true;
  }
  let jumboKey = '';
  function drawJumbo(G){
    const key = `${G.score.home}|${G.score.away}|${Math.ceil(G.clock)}|${G.sog.home}|${G.sog.away}|${G.ch.id}`;
    if (key === jumboKey) return; jumboKey = key;
    const g = jumboCvs.getContext('2d'); g.fillStyle = '#08090c'; g.fillRect(0,0,512,296);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = '#ffb51e'; g.font = '22px Bungee, "Arial Black", sans-serif'; g.fillText(G.ch.arena.toUpperCase(), 256, 30);
    g.font = '96px Bungee, "Arial Black", sans-serif'; g.fillStyle = '#ffb547'; g.fillText(String(G.score.home), 120, 140); g.fillText(String(G.score.away), 392, 140);
    g.font = '28px Bungee, "Arial Black", sans-serif'; g.fillStyle = '#f1e7d0'; g.fillText('RAT', 120, 214); g.fillText(G.ch.opp.abbr, 392, 214);
    const c = Math.max(0, Math.ceil(G.clock)); g.font = '44px Bungee, "Arial Black", sans-serif'; g.fillText(G.ch.len > 0 ? `${Math.floor(c/60)}:${String(c%60).padStart(2,'0')}` : 'FREE', 256, 140);
    g.font = '18px Bungee, "Arial Black", sans-serif'; g.fillStyle = '#a898b2'; g.fillText(`SOG ${G.sog.home} – ${G.sog.away}`, 256, 262);
    jumboTex.needsUpdate = true;
  }

  // ------------------------------------------------ hazards
  const hazG = new THREE.Group(); scene.add(hazG);
  const metal = new THREE.MeshPhysicalNodeMaterial({ color:0x3a3d44, roughness:0.4, metalness:0.85 });
  const steelBright = new THREE.MeshPhysicalNodeMaterial({ color:0xc8ced6, roughness:0.22, metalness:1 });
  const waterMat = new THREE.MeshPhysicalNodeMaterial({ color:0x0a2232, roughness:0.04, metalness:0, clearcoat:1, clearcoatRoughness:0.02 });
  const rimMat = new THREE.MeshStandardNodeMaterial({ color:0xf3f7fa, roughness:0.75 });
  const slimeMat = new THREE.MeshPhysicalNodeMaterial({ color:0x6fa82a, roughness:0.12, clearcoat:1, clearcoatRoughness:0.05 }); slimeMat.emissiveNode = vec3(0.05, 0.12, 0.0);
  const flameMat = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  { const fy = uv().y;   // 3 hard bands: hot yellow core -> orange -> deep red tips
    flameMat.colorNode = mix(mix(vec3(1.6, 1.5, 0.7), vec3(1.7, 0.62, 0.08), step(0.34, fy)), vec3(1.25, 0.1, 0.1), step(0.68, fy));
    flameMat.opacityNode = tFloor(oneMinus(fy).mul(3).add(0.6)).div(3).mul(0.92); }
  const glowMat = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false, blending:THREE.AdditiveBlending });
  { const d = length(uv().sub(0.5)).mul(2); glowMat.opacityNode = oneMinus(clamp(d, 0, 1)).pow(2); }
  const ledOn = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(6, 0.3, 0.2) });
  const ledOff = new THREE.MeshBasicNodeMaterial({ color:0x401010 });
  const inkHullMat = new THREE.MeshBasicNodeMaterial({ color:0x0b0710, side:THREE.BackSide });
  const inkMat = new THREE.MeshBasicNodeMaterial({ color:0x0b0710 });
  let hz = { holes:[], vents:[], mines:new Map(), slime:[], wells:[], saws:[] };
  function clearGroup(g){ while (g.children.length) { const c = g.children.pop(); c.traverse(o => { if (o.geometry && !o.userData.shared) o.geometry.dispose(); }); } }
  const mineGeo = (() => { const parts = [new THREE.CylinderGeometry(1.15, 1.35, 0.45, 14), new THREE.SphereGeometry(0.75, 12, 6, 0, Math.PI*2, 0, Math.PI/2)]; parts[0].translate(0, 0.22, 0); parts[1].translate(0, 0.42, 0); for (let i=0;i<6;i++){ const c = new THREE.ConeGeometry(0.14, 0.55, 6); c.rotateZ(-Math.PI/2); c.translate(1.45, 0.25, 0); c.rotateY(i*Math.PI/3); parts.push(c); } return BGU.mergeGeometries(parts.map(p => { const n = p.toNonIndexed(); n.deleteAttribute('uv'); return n; })); })();
  const ledGeo = new THREE.SphereGeometry(0.22, 8, 6);
  function buildHazards(G){
    clearGroup(hazG); hz = { holes:[], vents:[], mines:new Map(), slime:[], wells:[], saws:[] };
    const H = G.hz;
    for (const o of H.holes) {
      const sh = new THREE.Shape(o.pts.map(([x,y]) => new THREE.Vector2(x*1.13, -y*1.13)));
      sh.holes.push(new THREE.Path(o.pts.map(([x,y]) => new THREE.Vector2(x*0.98, -y*0.98))));
      const rim = new THREE.Mesh(new THREE.ShapeGeometry(sh), rimMat); rim.rotation.x = -Math.PI/2; rim.position.copy(W(o.x, o.y, 0.12));
      const water = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(o.pts.map(([x,y]) => new THREE.Vector2(x, -y)))), waterMat); water.rotation.x = -Math.PI/2; water.position.copy(W(o.x, o.y, 0.08));
      const rip = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 32), new THREE.MeshBasicNodeMaterial({ color:0x9cc8e0, transparent:true, opacity:0.4, depthWrite:false })); rip.rotation.x = -Math.PI/2; rip.position.copy(W(o.x, o.y, 0.14));
      const shI = new THREE.Shape(o.pts.map(([x,y]) => new THREE.Vector2(x*1.24, -y*1.24))); shI.holes.push(new THREE.Path(o.pts.map(([x,y]) => new THREE.Vector2(x*1.12, -y*1.12))));
      const inkRing = new THREE.Mesh(new THREE.ShapeGeometry(shI), inkMat); inkRing.rotation.x = -Math.PI/2; inkRing.position.copy(W(o.x, o.y, 0.1));
      const inkIn = new THREE.Mesh(new THREE.RingGeometry(o.r*0.96, o.r*1.0, 32), inkMat); inkIn.rotation.x = -Math.PI/2; inkIn.position.copy(W(o.x, o.y, 0.11));
      const capM = new THREE.MeshBasicNodeMaterial({ color:0xd6e7f2, transparent:true, opacity:0, depthWrite:false });
      const cap = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(o.pts.map(([x,y]) => new THREE.Vector2(x*1.04, -y*1.04)))), capM); cap.rotation.x = -Math.PI/2; cap.position.copy(W(o.x, o.y, 0.16)); cap.visible = false; cap.renderOrder = 2;
      hazG.add(rim, water, rip, inkRing, inkIn, cap); hz.holes.push({ o, rip, cap });
    }
    for (const v of H.vents) {
      const g = new THREE.Group(); g.position.copy(W(v.x, v.y, 0));
      const plate = new THREE.Mesh(new THREE.CylinderGeometry(v.r, v.r + 0.25, 0.18, 24), metal); plate.position.y = 0.09; plate.receiveShadow = true; g.add(plate);
      const vInk = new THREE.Mesh(new THREE.TorusGeometry(v.r + 0.32, 0.2, 6, 28), inkMat); vInk.rotation.x = Math.PI/2; vInk.position.y = 0.1; g.add(vInk);
      { const bars = []; for (let i=-2;i<=2;i++){ const w = Math.sqrt(Math.max(0, v.r*v.r - (i*v.r*0.33)**2))*1.7; const bg = new THREE.BoxGeometry(w, 0.12, 0.28); bg.translate(0, 0.22, i*v.r*0.33); bars.push(bg); } g.add(new THREE.Mesh(BGU.mergeGeometries(bars), steelBright)); }
      const glowM = glowMat.clone(); const gU = uniform(0); glowM.colorNode = vec3(4, 1.2, 0.2).mul(gU);
      const glow = new THREE.Mesh(new THREE.PlaneGeometry(v.r*4.4, v.r*4.4), glowM); glow.rotation.x = -Math.PI/2; glow.position.y = 0.3; g.add(glow);
      const fl = []; for (let i=0;i<5;i++){ const cg = new THREE.ConeGeometry(0.9 + Math.random()*0.5, 7*(0.7 + Math.random()*0.5), 8, 1, true); cg.translate((Math.random()-0.5)*v.r, 3.5, (Math.random()-0.5)*v.r); fl.push(cg); }
      const flames = new THREE.Mesh(BGU.mergeGeometries(fl), flameMat); flames.visible = false; g.add(flames);
      hazG.add(g); hz.vents.push({ v, g, gU, flames });
    }
    for (const p of H.slime) {
      const g = new THREE.Group(); g.position.copy(W(p.x, p.y, 0));
      for (const [bx, by, br] of p.blobs) { const b = new THREE.Mesh(new THREE.SphereGeometry(br, 20, 10), slimeMat); b.scale.y = 0.08; b.position.set(bx, 0.06, by); b.receiveShadow = true; const bh = new THREE.Mesh(b.geometry, inkHullMat); bh.scale.set(1.07, 1.4, 1.07); bh.userData.shared = true; b.add(bh); g.add(b); }
      const bubbles = []; for (let i=0;i<5;i++){ const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6), slimeMat); g.add(b); bubbles.push(b); }
      hazG.add(g); hz.slime.push({ p, g, bubbles });
    }
    for (const w of H.wells) {
      const g = new THREE.Group(); g.position.copy(W(w.x, w.y, 0.1));
      const m = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false });
      const q = uv().sub(0.5), r = length(q).mul(2), a = atan(q.y, q.x);
      const band = sin(a.mul(3).add(r.mul(14)).sub(time.mul(5))).mul(0.5).add(0.5);
      m.colorNode = mix(vec3(0.05, 0.02, 0.15), vec3(1.6, 0.9, 3.6), band.mul(oneMinus(r)));
      m.opacityNode = oneMinus(smoothstep(0.55, 1.0, r)).mul(0.95);
      const disc = new THREE.Mesh(new THREE.CircleGeometry(w.R*0.75, 48), m); disc.rotation.x = -Math.PI/2; g.add(disc);
      const core = new THREE.Mesh(new THREE.CircleGeometry(w.r, 32), new THREE.MeshBasicNodeMaterial({ color:0x000000 })); core.rotation.x = -Math.PI/2; core.position.y = 0.02; g.add(core);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(w.r, 0.18, 8, 32), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(2.5, 1.4, 4.5) })); rim.rotation.x = -Math.PI/2; rim.position.y = 0.05; g.add(rim);
      hazG.add(g); hz.wells.push({ w, g });
    }
    for (const w of H.saws) {
      const sh = new THREE.Shape(); for (let i=0;i<=24;i++){ const a = i/24*Math.PI*2, rr = i%2 ? w.r : w.r*1.22; i ? sh.lineTo(Math.cos(a)*rr, Math.sin(a)*rr) : sh.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); }
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.35, 0, Math.PI*2, true); sh.holes.push(hole);
      const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth:0.14, bevelEnabled:false }), steelBright); blade.geometry.translate(0, 0, -0.07); blade.castShadow = true;
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.36, 16), metal); hub.rotation.x = Math.PI/2;
      const g = new THREE.Group(); g.add(blade, hub); g.position.copy(W(w.x, w.y, 0.9));
      const bhull = new THREE.Mesh(blade.geometry, inkHullMat); bhull.scale.set(1.07, 1.07, 2.2); bhull.userData.shared = true; blade.add(bhull);
      hazG.add(g); hz.saws.push({ w, g, blade });
    }
  }
  function syncMines(G, t){
    const seen = new Set();
    for (const m of G.hz.mines) {
      seen.add(m);
      let e = hz.mines.get(m);
      if (!e) { const g = new THREE.Group(); const body = new THREE.Mesh(mineGeo, metal); body.castShadow = true; g.add(body); const mh = new THREE.Mesh(mineGeo, inkHullMat); mh.scale.setScalar(1.15); mh.userData.shared = true; g.add(mh); const led = new THREE.Mesh(ledGeo, ledOff); led.position.y = 0.95; g.add(led); body.userData.shared = true; led.userData.shared = true; if (m.team) { const ring = new THREE.Mesh(new THREE.TorusGeometry(1.4, 0.1, 6, 20), new THREE.MeshBasicNodeMaterial({ color: new THREE.Color(m.team === 'home' ? 0xf0a020 : 0xc9a4ff).multiplyScalar(2) })); ring.rotation.x = Math.PI/2; ring.position.y = 0.2; g.add(ring); } hazG.add(g); e = { g, led }; hz.mines.set(m, e); }
      e.g.visible = m.dead === 0;
      W(m.x, m.y, 0, e.g.position);
      e.led.material = m.arm > 0 ? ledOff : (Math.floor(t*(m.team ? 6 : 3)) % 2 ? ledOn : ledOff);
    }
    for (const [m, e] of hz.mines) if (!seen.has(m)) { hazG.remove(e.g); hz.mines.delete(m); }
  }

  // ------------------------------------------------ ice resurfacers (one model per arena, built on first use; +X is the nose)
  const zamG = new THREE.Group(); zamG.visible = false; scene.add(zamG);
  const zamModels = {};
  const inkBox = (m, sx, sy, sz, t = 0.13) => { const h = new THREE.Mesh(m.geometry, inkProp); h.scale.set(1 + 2*t/sx, 1 + 2*t/sy, 1 + 2*t/sz); m.add(h); return m; };
  function zamModel(id){
    if (zamModels[id]) return zamModels[id];
    const th = ZT.ZAM[id] || ZT.ZAM.boneyard, g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    const md = { g, body, wheels:[], spin:[], embers:[], bubbles:[], tent:[], hover:0, lure:null, beacon:null, dish:null };
    const glow = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(th.glow).multiplyScalar(3.2) });
    const C = { body:celMat(th.body), trim:celMat(th.trim), dark:celMat('#1d1c22'), steel:celMat('#9aa3ad'), suit:celMat('#3c4a5e'), skin:celMat('#c9b49a'), wood:celMat('#6b4520'), cut:celMat('#e3b980', 0.05) };
    const box = (w, h, d, mat, x, y, z, ink = 0.13, par = body) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = true; if (ink) inkBox(m, w, h, d, ink); par.add(m); return m; };
    const mesh = (geo, mat, x, y, z, ink = 1.1, par = body) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; if (ink) withInk(m, ink); par.add(m); return m; };
    const lamp = (x, y, z, r = 0.3) => mesh(new THREE.SphereGeometry(r, 12, 8), glow, x, y, z, 1.25);
    const wheelsAt = (r, xs, zs, y = r) => { for (const x of xs) for (const z of zs) { const w = mesh(new THREE.CylinderGeometry(r, r, 0.8, 18).rotateX(Math.PI/2), C.dark, x, y, z, 1.08); const cap = new THREE.Mesh(new THREE.CylinderGeometry(r*0.45, r*0.45, 0.84, 10).rotateX(Math.PI/2), C.trim); w.add(cap); const sp = new THREE.Mesh(new THREE.BoxGeometry(r*1.5, r*0.18, 0.86), C.steel); w.add(sp); w.userData.r = r; md.wheels.push(w); } };
    const driver = (x, y, z) => {
      mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.5, 12), C.suit, x, y + 0.75, z);
      const hd = mesh(new THREE.SphereGeometry(0.52, 16, 12), C.skin, x + 0.05, y + 1.9, z);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.3, 14), C.trim); cap.position.set(-0.04, 0.32, 0); hd.add(cap);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.06, 0.8), C.trim); brim.position.set(0.5, 0.2, 0); hd.add(brim);
      for (const sd of [-1, 1]) { const a = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.2, 8), C.suit, x + 0.55, y + 1.05, z + sd*0.45, 1.15); a.rotation.z = -1.1; }
      const sw = mesh(new THREE.TorusGeometry(0.42, 0.07, 6, 16), C.dark, x + 1.05, y + 1.05, z, 0); sw.rotation.y = Math.PI/2; sw.rotation.x = 0.5;
    };
    const L = 11.6, Wd = 5.2;
    if (id !== 'abyss') {
      // the common chassis: hull, hood, conditioner, dash, seat
      box(L, 2.0, Wd, C.body, 0, 2.0, 0);
      box(1.3, 1.3, Wd - 0.3, C.trim, L/2 + 0.2, 1.7, 0);
      box(1.0, 0.9, Wd + 0.6, celMat('#4a5260'), -L/2 - 0.35, 0.6, 0);
      box(0.25, 0.3, Wd + 0.5, celMat('#e8eef4'), -L/2 - 0.35, 0.12, 0, 0);
      box(1.0, 1.3, Wd - 0.6, C.body, 3.7, 3.6, 0);
      box(0.4, 1.7, 1.7, C.dark, 1.2, 3.9, -1.2);
      driver(1.7, 3.0, -1.2);
      lamp(L/2 + 0.9, 2.2, -1.9); lamp(L/2 + 0.9, 2.2, 1.9);
      md.beacon = mesh(new THREE.CylinderGeometry(0.28, 0.32, 0.5, 12), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(3.4, 1.6, 0.1) }), -2.4, 6.0, 1.5, 1.2);
    }
    if (id === 'boneyard') {           // a hearse that hauls a coffin
      wheelsAt(1.0, [-3.6, 3.6], [-2.75, 2.75]);
      const sh = new THREE.Shape([[3.3,-1.4],[2.0,-2.2],[-3.3,-1.6],[-3.3,1.6],[2.0,2.2],[3.3,1.4]].map(([a, b]) => new THREE.Vector2(a, b)));
      const cof = new THREE.ExtrudeGeometry(sh, { depth:2.3, bevelEnabled:true, bevelThickness:0.12, bevelSize:0.12, bevelSegments:1 }); cof.rotateX(-Math.PI/2);
      mesh(cof, celMat('#3b2a22'), -2.6, 3.05, 0, 1.06);
      for (const x of [-4.6, -1.0]) for (const sd of [-1, 1]) box(0.9, 0.18, 0.18, celMat('#c9a24a', 0.1), x, 4.1, sd*2.05, 0);
      const sk = mesh(new THREE.SphereGeometry(0.75, 16, 12), C.trim, L/2 + 0.3, 3.0, 0); sk.scale.set(1, 0.95, 0.9);
      for (const sd of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(th.glow).multiplyScalar(3) })); e.position.set(0.62, 0.1, sd*0.26); sk.add(e); }
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.7), C.trim); jaw.position.set(0.25, -0.65, 0); sk.add(jaw);
      const bone = mesh(new THREE.CylinderGeometry(0.22, 0.22, Wd + 0.2, 10).rotateX(Math.PI/2), C.trim, L/2 + 0.95, 1.2, 0, 1.12);
      for (const sd of [-1, 1]) { const k = new THREE.Mesh(new THREE.SphereGeometry(0.36, 10, 8), C.trim); k.position.set(0, 0, sd*(Wd/2 + 0.2)); bone.add(k); }
    } else if (id === 'magma') {       // iron slag hauler with a smokestack
      wheelsAt(1.05, [-3.6, 3.6], [-2.75, 2.75], 1.05);
      box(6.4, 2.5, 4.6, celMat('#2a1d18'), -2.6, 4.25, 0);
      for (const [x, y, rz, l] of [[-4.4, 4.5, 0.5, 1.6], [-3.1, 4.0, -0.7, 1.4], [-1.6, 4.6, 0.3, 1.8], [-0.4, 4.1, -0.5, 1.2]]) for (const sd of [-1, 1]) { const c = new THREE.Mesh(new THREE.BoxGeometry(l, 0.14, 0.06), glow); c.position.set(x, y, sd*2.33); c.rotation.z = rz; body.add(c); }
      mesh(new THREE.CylinderGeometry(0.45, 0.6, 2.4, 12), C.dark, -4.8, 6.6, 1.4, 1.1);
      for (let i = 0; i < 7; i++) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.16 + (i % 3)*0.06, 6, 5), glow); body.add(e); md.embers.push(e); }
    } else if (id === 'mines') {       // ore crawler on treads with a hopper of ore
      for (const sd of [-1, 1]) {
        box(10.2, 1.5, 1.1, C.dark, 0, 0.8, sd*2.75);
        for (const x of [-4, -1.3, 1.3, 4]) { const w = mesh(new THREE.CylinderGeometry(0.55, 0.55, 1.16, 12).rotateX(Math.PI/2), C.steel, x, 0.8, sd*2.75, 0); w.userData.r = 0.55; md.wheels.push(w); }
      }
      for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.45, 2.3, 0.05), C.dark); st.position.set(-4.6 + i*1.8, 2.0, sd*(Wd/2 + 0.02)); st.rotation.z = 0.75; body.add(st); }
      const hop = new THREE.CylinderGeometry(3.3, 2.5, 2.4, 4, 1); hop.rotateY(Math.PI/4); hop.scale(1.25, 1, 0.82);
      mesh(hop, celMat('#6d5a3a'), -2.6, 4.2, 0, 1.06);
      for (let i = 0; i < 9; i++) mesh(new THREE.DodecahedronGeometry(0.45 + (i % 3)*0.12), i % 3 ? celMat('#5e5248') : celMat('#ffd25a', 0.25), -4.6 + (i % 5)*1.0, 5.4 + (i % 2)*0.2, (i % 3 - 1)*1.1, 1.12);
      for (const [x, z] of [[0.6, -2.3], [0.6, 2.3], [3.3, -2.3], [3.3, 2.3]]) box(0.18, 3.4, 0.18, C.trim, x, 4.6, z, 0.08);
      box(3.0, 0.2, 4.8, C.trim, 1.95, 6.3, 0, 0.08);
      const hl = mesh(new THREE.CylinderGeometry(0.55, 0.45, 0.7, 14).rotateZ(Math.PI/2), C.dark, 3.4, 6.75, 0, 1.1);
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.46, 16).rotateY(Math.PI/2), glow); lens.position.set(0.37, 0, 0); hl.add(lens);
    } else if (id === 'sludge') {      // muck sucker: a tanker with a hose and bubbling vent
      wheelsAt(1.0, [-3.6, 3.6], [-2.75, 2.75]);
      mesh(new THREE.CylinderGeometry(2.0, 2.0, 6.4, 20).rotateZ(Math.PI/2), C.trim, -2.6, 4.8, 0, 1.05);
      for (const sd of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.7, 0.1), glow); w.position.set(-2.6, 4.8, sd*2.0); body.add(w); }
      for (const x of [-5.4, 0.2]) mesh(new THREE.TorusGeometry(2.02, 0.12, 6, 24).rotateY(Math.PI/2), C.dark, x, 4.8, 0, 0);
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.2, 5.8, 1.4), new THREE.Vector3(2.4, 6.4, 2.4), new THREE.Vector3(5.2, 3.6, 2.7), new THREE.Vector3(6.4, 1.2, 2.2)]);
      mesh(new THREE.TubeGeometry(curve, 24, 0.28, 8), C.dark, 0, 0, 0, 0);
      mesh(new THREE.CylinderGeometry(0.4, 0.5, 0.6, 10), C.dark, -3.6, 6.9, -0.8, 1.1);
      for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.22 + (i % 3)*0.08, 8, 6), glow); body.add(b); md.bubbles.push(b); }
    } else if (id === 'orbital') {     // moon buggy: hovers on thrusters under a glass dome
      md.hover = 1;
      for (const [x, z] of [[-3.8, -2.0], [-3.8, 2.0], [3.8, -2.0], [3.8, 2.0]]) { mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.45, 16), C.steel, x, 0.85, z, 1.08); const f = new THREE.Mesh(new THREE.CircleGeometry(0.75, 16).rotateX(Math.PI/2), glow); f.position.set(x, 0.6, z); body.add(f); }
      const pod = mesh(new THREE.SphereGeometry(1, 24, 16), celMat('#aab8cc'), -2.6, 4.1, 0, 1.06); pod.scale.set(3.4, 1.4, 2.3);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.55, 20, 12, 0, Math.PI*2, 0, Math.PI/2), crystalMat); dome.position.set(1.9, 3.2, -1.2); body.add(dome);
      const post = mesh(new THREE.CylinderGeometry(0.12, 0.12, 1.5, 6), C.steel, -4.6, 6.0, 1.5, 0);
      md.dish = new THREE.Group(); md.dish.position.set(-4.6, 6.8, 1.5); body.add(md.dish);
      const dsh = new THREE.Mesh(new THREE.SphereGeometry(0.9, 16, 8, 0, Math.PI*2, 0, Math.PI/3), C.steel); dsh.rotation.z = Math.PI/2.4; md.dish.add(withInk(dsh, 1.1));
      for (const sd of [-1, 1]) box(1.6, 1.3, 0.2, C.trim, -L/2 + 0.5, 3.4, sd*2.2, 0.08);
      void post;
    } else if (id === 'sawmill') {     // log skidder with a buzz saw on the nose
      wheelsAt(1.1, [-3.6, 3.6], [-2.75, 2.75], 1.1);
      const logMats = [C.wood, C.cut, C.cut];
      for (const [y, z] of [[3.85, -1.0], [3.85, 1.0], [5.45, 0]]) mesh(new THREE.CylinderGeometry(0.85, 0.85, 6.8, 14).rotateZ(Math.PI/2), logMats, -2.6, y, z, 1.06);
      for (const x of [-5.4, 0.2]) for (const sd of [-1, 1]) box(0.18, 3.2, 0.18, C.dark, x, 4.4, sd*2.1, 0.06);
      const sh = new THREE.Shape(); for (let i = 0; i <= 28; i++) { const a = i/28*Math.PI*2, rr = i % 2 ? 1.25 : 1.55; i ? sh.lineTo(Math.cos(a)*rr, Math.sin(a)*rr) : sh.moveTo(Math.cos(a)*rr, Math.sin(a)*rr); }
      const saw = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth:0.14, bevelEnabled:false }).translate(0, 0, -0.07), steelBright); saw.position.set(L/2 + 1.0, 2.0, 0); saw.castShadow = true;
      const sw2 = new THREE.Mesh(saw.geometry, inkHullMat); sw2.scale.set(1.06, 1.06, 2.4); saw.add(sw2);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.4, 12).rotateX(Math.PI/2), metal); saw.add(hub);
      body.add(saw); md.spin.push(saw);
      box(1.0, 0.4, 0.4, C.dark, L/2 + 0.6, 2.0, 0, 0.06);
    } else if (id === 'abyss') {       // the angler: a submarine with a glowing lure and tentacles
      md.hover = 0.55;
      const hull = mesh(new THREE.CapsuleGeometry(2.4, 6.6, 8, 18).rotateZ(Math.PI/2), C.body, 0, 2.6, 0, 1.05); hull.scale.set(1, 0.95, 1.05);
      for (const x of [-2.4, 0.6]) for (const sd of [-1, 1]) { const ph = mesh(new THREE.TorusGeometry(0.62, 0.14, 8, 18), C.trim, x, 2.9, sd*2.45, 0); const gl = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), glow); ph.add(gl); if (sd < 0) gl.rotation.y = Math.PI; }
      const fin = new THREE.Shape([[0, 0], [2.6, 0], [0.4, 1.9]].map(([a, b]) => new THREE.Vector2(a, b)));
      mesh(new THREE.ExtrudeGeometry(fin, { depth:0.2, bevelEnabled:false }).translate(-1.3, 0, -0.1), C.trim, -1.6, 4.85, 0, 1.08);
      const tail = new THREE.Shape([[0, -1.6], [1.4, 0], [0, 1.6], [0.5, 0]].map(([a, b]) => new THREE.Vector2(a, b)));
      mesh(new THREE.ExtrudeGeometry(tail, { depth:0.2, bevelEnabled:false }).translate(0, 0, -0.1).rotateY(Math.PI), C.trim, -5.6, 2.7, 0, 1.08);
      for (let i = 0; i < 4; i++) {
        const sd = i % 2 ? 1 : -1, x = i < 2 ? -3.2 : -1.0;
        const cv = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(-0.6, -0.8, sd*0.5), new THREE.Vector3(-1.6, -1.2, sd*0.4), new THREE.Vector3(-2.4, -1.0, sd*0.9)]);
        const tg = new THREE.Group(); tg.position.set(x, 1.0, sd*1.5); body.add(tg);
        tg.add(withInk(new THREE.Mesh(new THREE.TubeGeometry(cv, 16, 0.22, 6), C.trim), 1.12)); md.tent.push(tg);
      }
      lamp(5.5, 2.3, -1.4, 0.26); lamp(5.5, 2.3, 1.4, 0.26);
      box(1.6, 0.8, 1.6, C.dark, 1.4, 4.9, 0, 0.1);
      driver(1.4, 4.0, 0);
      md.lure = new THREE.Group(); md.lure.position.set(3.4, 4.9, 0); body.add(md.lure);
      const lc = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(1.4, 2.0, 0), new THREE.Vector3(3.6, 1.6, 0), new THREE.Vector3(4.6, -0.4, 0)]);
      md.lure.add(withInk(new THREE.Mesh(new THREE.TubeGeometry(lc, 20, 0.11, 6), C.trim), 1.2));
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 10), glow); bulb.position.set(4.6, -0.9, 0); md.lure.add(bulb);
    }
    zamModels[id] = md; return md;
  }
  // the strip of fresh ice the conditioner lays down
  const ZN = 760;
  const zamRibMat = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide });
  { const zc = attribute('zCol', 'vec4'); zamRibMat.colorNode = zc.xyz; zamRibMat.opacityNode = zc.w; }
  const zamRibGeo = new THREE.BufferGeometry();
  zamRibGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ZN*2*3), 3));
  zamRibGeo.setAttribute('zCol', new THREE.BufferAttribute(new Float32Array(ZN*2*4), 4));
  { const nrm = new Float32Array(ZN*2*3); for (let i = 0; i < ZN*2; i++) nrm[i*3+1] = 1; zamRibGeo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    const idx = []; for (let i = 0; i < ZN - 1; i++) { const a = i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); } zamRibGeo.setIndex(idx); }
  const zamRib = new THREE.Mesh(zamRibGeo, zamRibMat); zamRib.frustumCulled = false; zamRib.renderOrder = 1; scene.add(zamRib);
  const _wet = new THREE.Color(), _dry = new THREE.Color(), _rc = new THREE.Color();
  let zamCond = null;
  function syncZam(G, t, dt){
    gateDoor.rotation.y = (G.gate || 0)*1.45;
    // ribbon
    const tr = G.zamTrail || [], n = Math.min(tr.length, ZN), off = tr.length - n, R = ZT.R*0.97;
    const pos = zamRibGeo.attributes.position.array, col = zamRibGeo.attributes.zCol.array;
    const th = ZT.ZAM[G.ch.id] || ZT.ZAM.boneyard;
    _dry.setRGB(0.42, 0.6, 0.82); _wet.setRGB(0.22, 0.36, 0.56);
    for (let i = 0; i < n; i++) {
      const p = tr[off + i], nx = -Math.sin(p.a), ny = Math.cos(p.a), age = G.time - p.t;
      const k = Math.max(0, 1 - age/ZT.FRESH), wet = Math.max(0, 1 - age/3.5);
      const gap = i > 0 && Math.hypot(p.x - tr[off + i - 1].x, p.y - tr[off + i - 1].y) > 4;
      const a = gap ? 0 : (0.62*Math.min(1, k*1.6) + 0.25*wet)*Math.min(1, i/3, (n - 1 - i)/2 + 0.4);
      _rc.copy(_dry).lerp(_wet, wet);
      for (const sd of [0, 1]) {
        const j = i*2 + sd, o = sd ? R : -R;
        pos[j*3] = p.x + nx*o - CX; pos[j*3+1] = 0.035; pos[j*3+2] = p.y + ny*o - RL/2;
        col[j*4] = _rc.r; col[j*4+1] = _rc.g; col[j*4+2] = _rc.b; col[j*4+3] = a;
      }
    }
    zamRibGeo.setDrawRange(0, Math.max(0, n - 1)*6);
    zamRibGeo.attributes.position.needsUpdate = zamRibGeo.attributes.zCol.needsUpdate = true;
    zamRib.visible = n > 1;
    // the machine
    const Z = G.zam;
    if (!Z || Z.hide) { zamG.visible = false; zamCond = null; return; }
    const md = zamModel(G.ch.id);
    if (zamG.children[0] !== md.g) { zamG.clear(); zamG.add(md.g); }
    zamG.visible = true;
    W(Z.x, Z.y, md.hover ? md.hover + Math.sin(t*2.3)*0.15 : 0, zamG.position); zamG.rotation.y = -Z.a;
    md.body.rotation.x = Math.sin(t*23)*0.006; md.body.position.y = Math.abs(Math.sin(t*11))*0.03;
    for (const w of md.wheels) w.rotation.z = -Z.d/w.userData.r;
    for (const s of md.spin) s.rotation.z = -t*16;
    if (md.beacon) md.beacon.scale.setScalar(0.85 + 0.3*(Math.sin(t*9) > 0 ? 1 : 0));
    if (md.dish) md.dish.rotation.y = t*1.6;
    if (md.lure) { md.lure.rotation.z = Math.sin(t*2.1)*0.12; md.lure.rotation.x = Math.sin(t*1.7)*0.1; }
    md.tent.forEach((tg, i) => { tg.rotation.x = Math.sin(t*3 + i*1.7)*0.35; tg.rotation.z = Math.sin(t*2.4 + i)*0.2; });
    md.embers.forEach((e, i) => { const f = (t*0.8 + i/md.embers.length) % 1; e.position.set(-4.8 - f*2.2, 7.8 + f*3.4, 1.4 + Math.sin(t*2 + i*2.3)*f*0.8); e.scale.setScalar(1 - f*0.8); });
    md.bubbles.forEach((b, i) => { const f = (t*0.7 + i/md.bubbles.length) % 1; b.position.set(-3.6 + Math.sin(i*2.1)*0.3, 7.2 + f*2.2, -0.8 + Math.cos(i*1.3)*0.3); b.scale.setScalar(0.4 + f*0.9); });
    // the conditioner scrubs skate marks and snow off the ice
    const c = Math.cos(Z.a), sn = Math.sin(Z.a), bx = Z.x - c*(ZT.LH + ZT.R*0.5), by = Z.y - sn*(ZT.LH + ZT.R*0.5);
    if (bx > 0.5 && bx < RW - 0.5) {
      if (zamCond) { sctx.save(); sctx.globalCompositeOperation = 'source-over'; sctx.strokeStyle = '#000'; sctx.lineCap = 'round'; sctx.lineWidth = ZT.R*2; sctx.beginPath(); sctx.moveTo(zamCond[0], zamCond[1]); sctx.lineTo(bx, by); sctx.stroke(); sctx.restore(); }
      zamCond = [bx, by];
    } else zamCond = null;
  }

  // ------------------------------------------------ dynamic pools
  const dyn = new THREE.Group(); scene.add(dyn);
  const crateMat = new THREE.MeshPhysicalNodeMaterial({ color:0xffb51e, roughness:0.3, metalness:0.2, clearcoat:0.8 }); crateMat.emissiveNode = vec3(1.4, 0.75, 0.08).mul(sin(time.mul(5)).mul(0.3).add(0.8));
  const crateEdge = new THREE.MeshStandardNodeMaterial({ color:0x1d1305, roughness:0.5 });
  const crateGeo = new THREE.CylinderGeometry(1.9, 1.9, 1.3, 6);
  const crateTop = (() => { const s = new THREE.Shape(); s.moveTo(0.35,-1.2); s.lineTo(-0.85,0.25); s.lineTo(-0.05,0.25); s.lineTo(-0.35,1.2); s.lineTo(0.85,-0.25); s.lineTo(0.05,-0.25); s.closePath(); const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI/2); g.translate(0, 0.67, 0); return g; })();
  const crates = new Map();
  const slickTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); const rg = g.createRadialGradient(64,64,10,64,64,64); rg.addColorStop(0,'rgba(20,16,12,1)'); rg.addColorStop(0.8,'rgba(30,24,16,.95)'); rg.addColorStop(1,'rgba(30,24,16,0)'); g.fillStyle = rg; g.fillRect(0,0,128,128); for (let i=0;i<5;i++){ g.strokeStyle = `hsla(${i*70},90%,60%,.25)`; g.lineWidth = 4; g.beginPath(); g.ellipse(60+i*3, 58+i*2, 30-i*4, 18-i*2, 0.4, 0, 7); g.stroke(); } return canvasTex(c); })();
  const slickMat = new THREE.MeshPhysicalNodeMaterial({ map:slickTex, transparent:true, roughness:0.05, clearcoat:1, depthWrite:false });
  const traps = new Map();
  const wallMat = new THREE.MeshPhysicalNodeMaterial({ color:0xcfeaff, roughness:0.08, transparent:true, opacity:0.62, clearcoat:1 }); wallMat.emissiveNode = vec3(0.08, 0.16, 0.24);
  const walls = new Map();
  const puckMat = new THREE.MeshPhysicalNodeMaterial({ color:0x0b0b0d, roughness:0.45, clearcoat:0.4 });
  // vulcanised-rubber puck: rounded edge, knurled band, small amber logo on top
  const puckGeo = new THREE.LatheGeometry([[0,-0.11],[0.385,-0.11],[0.415,-0.085],[0.42,-0.04],[0.42,0.04],[0.415,0.085],[0.385,0.11],[0,0.11]].map(([x,y]) => new THREE.Vector2(x, y)), 28);
  const puckLogoMat = new THREE.MeshStandardNodeMaterial({ color:0xe0a024, roughness:0.5 });
  const puckLogoGeo = new THREE.RingGeometry(0.14, 0.24, 24).rotateX(-Math.PI/2).translate(0, 0.112, 0);
  const puckBandMat = new THREE.MeshStandardNodeMaterial({ color:0x26272b, roughness:0.85 });
  const puckBandGeo = new THREE.CylinderGeometry(0.423, 0.423, 0.06, 28, 1, true);
  const pucks = [0,1,2].map(() => { const m = new THREE.Mesh(puckGeo, puckMat); m.castShadow = true; const fire = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), (() => { const fm = glowMat.clone(); fm.colorNode = vec3(5, 1.6, 0.25); return fm; })()); fire.scale.setScalar(1.6); fire.visible = false; m.add(fire); const halo = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.08, 6, 20), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(0.6, 3, 3.4) })); halo.rotation.x = Math.PI/2; halo.visible = false; m.add(halo); m.add(new THREE.Mesh(puckLogoGeo, puckLogoMat), new THREE.Mesh(puckBandGeo, puckBandMat)); { const ph = new THREE.Mesh(puckGeo, new THREE.MeshBasicNodeMaterial({ color:0x0b0710, side:THREE.BackSide })); ph.scale.set(1.22, 1.5, 1.22); m.add(ph); } m.userData = { fire, halo, lift:0, lv:0, hist:[], init:false }; dyn.add(m); return m; });
  const TRAIL_N = 18;
  const trailMat = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false, side:THREE.DoubleSide });
  trailMat.colorNode = attribute("color", "vec3"); trailMat.opacityNode = attribute("aA", "float");
  const mkRibbon = (order) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(TRAIL_N*2*3), 3));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(TRAIL_N*2*3), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(TRAIL_N*2), 1));
    { const nrm = new Float32Array(TRAIL_N*2*3); for (let i=0;i<TRAIL_N*2;i++) nrm[i*3+1] = 1; g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); }
    const idx = []; for (let i=0;i<TRAIL_N-1;i++){ const a = i*2; idx.push(a, a+1, a+2, a+1, a+3, a+2); } g.setIndex(idx);
    const m = new THREE.Mesh(g, trailMat); m.frustumCulled = false; m.renderOrder = order; dyn.add(m); return m;
  };
  const ribbons = pucks.map(() => ({ ink: mkRibbon(2), core: mkRibbon(3), set visible(v){ this.ink.visible = v; this.core.visible = v; } }));
  function fillRibbon(mesh, h, n, wmax, c, amax){
    const pos = mesh.geometry.attributes.position.array, col = mesh.geometry.attributes.color.array, al = mesh.geometry.attributes.aA.array;
    for (let j=0;j<TRAIL_N;j++){
      const a = h[Math.min(j, n-1)], b = h[Math.min(j+1, n-1)], b0 = h[Math.min(Math.max(j-1, 0), n-1)];
      let dx = b0[0] - b[0], dz = b0[2] - b[2]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      const f = j/(TRAIL_N-1), w = j < n ? wmax*(1 - f*0.85) : 0;
      pos.set([a[0] - dz*w, a[1], a[2] + dx*w, a[0] + dz*w, a[1], a[2] - dx*w], j*6);
      col.set([c[0], c[1], c[2], c[0], c[1], c[2]], j*6);
      const av = j < n ? amax*(1 - f) : 0; al[j*2] = av; al[j*2+1] = av;
    }
    mesh.geometry.attributes.position.needsUpdate = true; mesh.geometry.attributes.color.needsUpdate = true; mesh.geometry.attributes.aA.needsUpdate = true;
  }
  const PART_MAX = 420;
  const partMat = new THREE.MeshBasicNodeMaterial(); partMat.colorNode = vec3(1.8);
  const shardGeo = new THREE.OctahedronGeometry(1, 0); shardGeo.scale(1.9, 0.42, 0.42);
  const partMesh = new THREE.InstancedMesh(shardGeo, partMat, PART_MAX); partMesh.frustumCulled = false; partMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(PART_MAX*3), 3); dyn.add(partMesh);
  const SPARK_MAX = 80, sparks = [];
  const sparkMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0).scale(1.8, 0.35, 0.35), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(4.5, 3.6, 1.2) }), SPARK_MAX); sparkMesh.frustumCulled = false; sparkMesh.count = 0;
  function emitSparks(x, y, vx, vy, n){ const a0 = Math.atan2(vy, vx); for (let i=0;i<n && sparks.length<SPARK_MAX;i++){ const a = a0 + Math.PI + (Math.random()-0.5)*2.2, sp = 10 + Math.random()*22; sparks.push({ x:x - CX, y:0.4, z:y - RL/2, vx:Math.cos(a)*sp, vy:4 + Math.random()*7, vz:Math.sin(a)*sp, life:0.25 + Math.random()*0.3, s:0.22 + Math.random()*0.2 }); } }
  const SNOW_MAX = 320, snow = [];
  const snowMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardNodeMaterial({ color:0xffffff, roughness:0.6, emissive:0x606870 }), SNOW_MAX); snowMesh.frustumCulled = false; dyn.add(snowMesh);
  dyn.add(sparkMesh);
  const ringPool = []; for (let i=0;i<12;i++){ const m = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false }); const r = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 48), m); r.rotation.x = -Math.PI/2; r.visible = false; dyn.add(r); ringPool.push(r); }
  const boltMat = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(5, 5, 3.2) });
  const bolts = new Map(), beams = new Map();
  const starMesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.35, 0), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(3.5, 2.8, 0.6) }), 40); starMesh.frustumCulled = false; dyn.add(starMesh);
  const blobTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const rg = g.createRadialGradient(32,32,0,32,32,32); rg.addColorStop(0,'rgba(0,0,0,.55)'); rg.addColorStop(0.6,'rgba(0,0,0,.25)'); rg.addColorStop(1,'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(0,0,64,64); return canvasTex(c, false); })();
  const blobMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI/2), new THREE.MeshBasicNodeMaterial({ map:blobTex, transparent:true, depthWrite:false, color:0x000000 }), 16); blobMesh.frustumCulled = false; blobMesh.renderOrder = 1; dyn.add(blobMesh);
  // per-player markers: control ring, shot-charge ring and aim line (P1 amber, P2 cyan)
  function mkHumanFx(ringCol, chargeCol, aimCol){
    const ring = new THREE.Mesh(new THREE.RingGeometry(3.1, 3.5, 48), new THREE.MeshBasicNodeMaterial({ color:ringCol, transparent:true, opacity:0.9, depthWrite:false })); ring.rotation.x = -Math.PI/2; ring.visible = false; dyn.add(ring);
    const chargeU = uniform(0);
    const charge = (() => { const m = new THREE.MeshBasicNodeMaterial({ color:chargeCol, transparent:true, depthWrite:false }); const q = uv().sub(0.5); const ang = atan(q.x, q.y).add(PI).div(PI.mul(2)); m.opacityNode = step(ang, chargeU); const r = new THREE.Mesh(new THREE.RingGeometry(3.8, 4.4, 64), m); r.rotation.x = -Math.PI/2; r.visible = false; dyn.add(r); return r; })();
    const aimTex = (() => { const c = document.createElement('canvas'); c.width = 16; c.height = 64; const g = c.getContext('2d'); g.clearRect(0,0,16,64); g.fillStyle = '#fff'; g.fillRect(0,0,16,34); const t = canvasTex(c); t.wrapT = THREE.RepeatWrapping; return t; })();
    const aim = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1).rotateX(-Math.PI/2).translate(0, 0, -0.5), new THREE.MeshBasicNodeMaterial({ map:aimTex, transparent:true, depthWrite:false, color:aimCol })); aim.visible = false; dyn.add(aim);
    return { ring, chargeU, charge, aimTex, aim };
  }
  const humanFx = [mkHumanFx(new THREE.Color(1.6, 0.95, 0.12), new THREE.Color(2.2, 1.4, 0.2), new THREE.Color(2.4, 1.5, 0.2)),
                   mkHumanFx(new THREE.Color(0.3, 1.35, 1.9), new THREE.Color(0.4, 1.8, 2.6), new THREE.Color(0.5, 1.9, 2.6))];
  const ctrlRing = humanFx[0].ring;

  // ------------------------------------------------ players
  const DOWN = new THREE.Vector3(0, -1, 0);
  // comic cel shading: 3 hard light bands, Ben-Day dots in the shade, a sharp rim, and ink at grazing angles
  const rigMat = new THREE.MeshBasicNodeMaterial();
  { const rm = attribute('aRM', 'vec4'), col = attribute('color', 'vec3');
    const ndl = normalWorld.dot(vec3(0.36, 0.86, 0.36).normalize());
    const tone = mix(float(0.36), mix(float(0.72), float(1.04), step(0.48, ndl)), step(0.04, ndl));
    const sc = screenCoordinate.xy.div(5.5), rc = vec2(sc.x.add(sc.y), sc.x.sub(sc.y)).mul(0.7071);
    const cell = fract(rc).sub(0.5);
    const dotR = clamp(float(0.46).sub(ndl.mul(0.5)), 0.0, 0.46);
    const dots = step(length(cell), dotR).mul(step(ndl, 0.48));
    const facing = normalView.dot(positionViewDirection).abs();
    const rim = step(0.74, oneMinus(facing)).mul(step(0.0, ndl));
    const glint = step(0.93, normalView.dot(vec3(0.3, 0.6, 0.74).normalize())).mul(rm.z);
    const shaded = col.mul(tone).mul(oneMinus(dots.mul(0.24))).add(vec3(1.0, 0.82, 0.5).mul(rim.mul(0.32))).add(vec3(0.9).mul(glint.mul(0.55))).add(col.mul(rm.w).mul(2.6));
    rigMat.colorNode = mix(shaded, vec3(0.05, 0.035, 0.07), step(facing, 0.18).mul(0.9)); }
  // inverted-hull ink outline (thin on sticks); width follows camera distance so ink weight stays even on screen
  const outlineW = uniform(0.3);
  const outlineMat = new THREE.MeshBasicNodeMaterial({ color:0x0b0710, side:THREE.BackSide });
  outlineMat.positionNode = positionLocal.add(normalLocal.mul(outlineW.mul(attribute('aOL', 'float'))));
  // comic power-up props: opaque cel shading + ink hulls so they read on bright ice
  function celMat(hex, emis = 0){
    const m = new THREE.MeshBasicNodeMaterial(), c = new THREE.Color(hex);
    const ndl = normalWorld.dot(vec3(0.36, 0.86, 0.36).normalize());
    const tone = mix(float(0.45), mix(float(0.78), float(1.06), step(0.45, ndl)), step(0.03, ndl));
    m.colorNode = vec3(c.r, c.g, c.b).mul(tone.add(emis));
    return m;
  }
  const inkProp = new THREE.MeshBasicNodeMaterial({ color:0x0b0710, side:THREE.BackSide });
  const withInk = (mesh, k = 1.12) => { const h = new THREE.Mesh(mesh.geometry, inkProp); h.scale.setScalar(k); mesh.add(h); return mesh; };
  const flameOuterMat = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(1.3, 0.32, 0.02) });
  const flameMidMat = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(1.35, 0.78, 0.06) });
  const flameCoreMat = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(1.6, 1.5, 0.85) });
  const packMat = celMat('#8d97a6'), packTrimMat = celMat('#ec3b4f'), spikeMat = celMat('#d9f27a', 0.15), eyeMat = new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(4.5, 0.5, 0.3) });
  const magRedMat = celMat('#e8323f', 0.1), magTipMat = celMat('#e9eef4', 0.2);
  const crystalMat = new THREE.MeshBasicNodeMaterial({ transparent:true, depthWrite:false });
  { const ndl = normalWorld.dot(vec3(0.36, 0.86, 0.36).normalize()), fr = oneMinus(normalView.dot(positionViewDirection).abs());
    crystalMat.colorNode = mix(mix(vec3(0.42, 0.72, 0.92), vec3(0.72, 0.92, 1.0), step(0.0, ndl)), vec3(1.15, 1.2, 1.25), step(0.55, ndl)).add(vec3(0.9).mul(step(0.62, fr)));
    crystalMat.opacityNode = float(0.5).add(step(0.62, fr).mul(0.4)); }
  const crystalEdgeMat = new THREE.MeshBasicNodeMaterial({ color:0x1d4a6a, side:THREE.BackSide, transparent:true, opacity:0.85, depthWrite:false });
  const SPEC = S.SPECIES;
  const FAB = [0.78, 0, 0, 0], GLOSS = [0.22, 0, 1, 0], MATTE = [0.9, 0, 0, 0], METAL = [0.25, 1, 0, 0], RUB = [0.5, 0, 0.3, 0], GLOW = [0.5, 0, 0, 1];
  function darker(hex, f){ return '#' + new THREE.Color(hex).multiplyScalar(f).getHexString(); }
  function mkBones(){
    const B = {}, list = [];
    const add = (name, parent, x, y, z) => { const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z); if (parent) B[parent].add(b); B[name] = b; b.userData.i = list.length; list.push(b); };
    add('root', null, 0, 0, 0); add('hips', 'root', 0, 3.25, 0); add('spine', 'hips', 0, 0.35, 0); add('chest', 'spine', 0, 0.75, 0); add('neck', 'chest', 0, 0.75, 0); add('head', 'neck', 0, 0.25, 0);
    for (const [s, n] of [[1,'L'],[-1,'R']]) { add('upArm'+n, 'chest', s*0.84, 0.52, 0); add('foreArm'+n, 'upArm'+n, 0, -0.95, 0); add('hand'+n, 'foreArm'+n, 0, -0.82, 0); add('thigh'+n, 'hips', s*0.36, -0.12, 0); add('shin'+n, 'thigh'+n, 0, -1.4, 0); add('foot'+n, 'shin'+n, 0, -1.3, 0); }
    add('stick', 'root', 0, 0, 0); add('tail', 'hips', 0, -0.15, -0.55);
    return { B, list };
  }
  function bladeShape(G){
    const s = new THREE.Shape(), len = G ? 1.25 : 1.05, h = G ? 0.3 : 0.26, x0 = -0.48, x1 = x0 + len;
    s.moveTo(x0, -h/2); s.lineTo(x1 - 0.16, -h/2); s.quadraticCurveTo(x1, -h/2, x1, 0); s.quadraticCurveTo(x1, h/2, x1 - 0.18, h/2);
    s.lineTo(x0 + 0.06, h/2); s.lineTo(x0, h/2 - 0.08); s.closePath();
    return { s, x0, len };
  }
  function bendBlade(g, x0, len, curve){
    const p = g.attributes.position;
    for (let i=0;i<p.count;i++){ const u = (p.getX(i) - x0)/len; p.setZ(i, p.getZ(i) + curve*u*u); }
    g.computeVertexNormals(); return g;
  }
  function bladeGeo(G){ const { s, x0, len } = bladeShape(G); const g = new THREE.ExtrudeGeometry(s, { depth:0.055, bevelEnabled:true, bevelThickness:0.01, bevelSize:0.01, bevelSegments:1, curveSegments:6 }); g.translate(0, 0, -0.0275); return bendBlade(g, x0, len, 0.13); }
  function bladeTape(G){ const len = G ? 0.6 : 0.5, h = G ? 0.27 : 0.23; const g = new THREE.BoxGeometry(len, h, 0.07, 6, 1, 1); g.translate(0.08, 0, 0); return bendBlade(g, -0.48, G ? 1.25 : 1.05, 0.13); }
  function buildRig(o){ // o: {species, jersey, trim, goalie, number}
    const { B, list } = mkBones();
    const holder = new THREE.Group(); holder.add(B.root); holder.updateMatrixWorld(true);
    const parts = [];
    const E = new THREE.Euler(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), Sv = new THREE.Vector3();
    const P = (geo, bone, col, rm, pos=[0,0,0], rot=[0,0,0], scl=[1,1,1]) => { parts.push({ geo, bone:B[bone], col:new THREE.Color(col), rm, m:new THREE.Matrix4().compose(V.set(...pos).clone(), Q.setFromEuler(E.set(...rot)).clone(), Sv.set(...scl).clone()) }); };
    const cyl = (rt, rb, h, seg=12) => new THREE.CylinderGeometry(rt, rb, h, seg);
    const sph = (r, ws=14, hs=10, ps=0, pl=Math.PI*2, ts=0, tl=Math.PI) => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl);
    const box = (x, y, z) => new THREE.BoxGeometry(x, y, z);
    const cone = (r, h, seg=10) => new THREE.ConeGeometry(r, h, seg);
    const J = o.jersey, T = o.trim, pants = darker(J, 0.35), glove = darker(J, 0.75), sp = SPEC[o.species], skin = sp.head, G = o.goalie;
    const pad = '#eef0f2';
    // torso + pants
    P(cyl(0.64, 0.6, 0.9), 'hips', pants, FAB, [0, -0.18, 0]);
    P(cyl(0.66, 0.66, 0.12), 'hips', T, FAB, [0, 0.22, 0]);
    P(cyl(G ? 0.85 : 0.72, 0.64, 0.82), 'spine', J, FAB, [0, 0.35, 0]);
    P(cyl(G ? 0.87 : 0.74, G ? 0.86 : 0.73, 0.16), 'spine', T, FAB, [0, 0.08, 0]);
    P(cyl(G ? 1.18 : 0.98, G ? 0.9 : 0.74, 0.86), 'chest', J, FAB, [0, 0.32, 0]);
    P(cyl(G ? 1.2 : 1.0, G ? 1.17 : 0.97, 0.14), 'chest', T, FAB, [0, 0.62, 0]);
    for (const s of [-1, 1]) P(sph(G ? 0.52 : 0.44), 'chest', J, FAB, [s*(G ? 0.95 : 0.82), 0.58, 0], [0,0,0], [1, 0.62, 0.95]);
    P(cyl(0.22, 0.24, 0.32, 8), 'neck', skin, MATTE, [0, 0.1, 0]);
    // arms
    for (const n of ['L', 'R']) {
      P(cyl(G ? 0.36 : 0.31, 0.27, 0.95), 'upArm'+n, J, FAB, [0, -0.47, 0]);
      P(cyl(0.3, 0.3, 0.1), 'upArm'+n, T, FAB, [0, -0.72, 0]); P(cyl(0.29, 0.29, 0.07), 'upArm'+n, J === T ? '#ffffff' : J, FAB, [0, -0.81, 0]);
      P(cyl(0.3, 0.26, 0.74), 'foreArm'+n, glove, RUB, [0, -0.4, 0]);
      P(box(0.38, 0.36, 0.44), 'hand'+n, glove, RUB, [0, -0.1, 0.04]);
    }
    if (G) {
      P(box(0.28, 1.0, 0.78), 'handR', pad, RUB, [-0.12, -0.15, 0.1]);
      P(box(0.08, 0.84, 0.66), 'handR', T, RUB, [-0.27, -0.15, 0.1]);
      P(cyl(0.55, 0.55, 0.22, 16), 'handL', T, RUB, [0.1, -0.2, 0.15], [0, 0, Math.PI/2]);
      P(cyl(0.38, 0.38, 0.24, 16), 'handL', pad, RUB, [0.12, -0.2, 0.15], [0, 0, Math.PI/2]);
    }
    // legs
    for (const n of ['L', 'R']) {
      if (G) {
        P(box(0.78, 1.05, 0.62), 'thigh'+n, pad, RUB, [0, -0.62, 0.12]);
        P(box(0.8, 1.95, 0.64), 'shin'+n, pad, RUB, [0, -0.62, 0.18]);
        P(box(0.82, 0.14, 0.66), 'shin'+n, T, RUB, [0, -0.25, 0.18]); P(box(0.82, 0.14, 0.66), 'shin'+n, T, RUB, [0, -1.0, 0.18]);
      } else {
        P(cyl(0.44, 0.34, 1.32), 'thigh'+n, pants, FAB, [0, -0.62, 0]);
        P(cyl(0.33, 0.25, 1.25), 'shin'+n, J, FAB, [0, -0.6, 0]);
        P(cyl(0.335, 0.32, 0.12), 'shin'+n, T, FAB, [0, -0.38, 0]); P(cyl(0.3, 0.28, 0.12), 'shin'+n, T, FAB, [0, -0.62, 0]);
      }
      P(box(0.38, 0.42, 1.08), 'foot'+n, '#121316', GLOSS, [0, -0.2, 0.18]);
      P(box(0.3, 0.12, 0.3), 'foot'+n, '#e8e8e8', MATTE, [0, 0.02, -0.25]);
      P(box(0.06, 0.2, 1.18), 'foot'+n, '#d6dbe0', METAL, [0, -0.43, 0.18]);
    }
    // head + helmet
    const hd = 'head';
    switch (o.species) {
      case 'rat':
        P(sph(0.4), hd, skin, MATTE, [0, 0, 0], [0,0,0], [1, 0.95, 1.05]);
        P(cone(0.26, 0.6), hd, skin, MATTE, [0, -0.12, 0.5], [Math.PI/2, 0, 0]);
        P(sph(0.1), hd, sp.acc, GLOSS, [0, -0.12, 0.8]);
        P(box(0.07, 0.12, 0.03), hd, '#fff8e0', GLOSS, [-0.04, -0.3, 0.68]); P(box(0.07, 0.12, 0.03), hd, '#fff8e0', GLOSS, [0.04, -0.3, 0.68]);
        for (const s of [-1, 1]) { P(sph(0.28), hd, skin, MATTE, [s*0.34, 0.46, -0.08], [0, 0, s*0.4], [1, 1, 0.3]); P(sph(0.2), hd, sp.acc, MATTE, [s*0.35, 0.46, -0.03], [0, 0, s*0.4], [1, 1, 0.25]); P(sph(0.06), hd, '#0b0b0d', GLOSS, [s*0.17, 0.06, 0.36]); }
        break;
      case 'skeleton':
        P(sph(0.42), hd, skin, MATTE, [0, 0.02, 0]);
        P(box(0.48, 0.2, 0.36), hd, skin, MATTE, [0, -0.32, 0.12]);
        for (const s of [-1, 1]) { P(sph(0.13), hd, '#0b0a0c', MATTE, [s*0.15, 0.03, 0.33]); P(sph(0.04), hd, '#ff3020', GLOW, [s*0.15, 0.03, 0.42]); }
        P(box(0.36, 0.06, 0.03), hd, '#fffbe8', MATTE, [0, -0.22, 0.32]);
        break;
      case 'troll':
        P(sph(0.44), hd, skin, MATTE);
        for (const s of [-1, 1]) { P(cone(0.13, 0.75), hd, sp.acc, GLOSS, [s*0.52, 0.32, 0], [0, 0, -s*1.0]); P(sph(0.07), hd, '#ffd24a', GLOW, [s*0.17, 0.05, 0.4]); P(cone(0.05, 0.2), hd, '#fffbe8', MATTE, [s*0.13, -0.28, 0.36]); }
        break;
      case 'gremlin':
        P(sph(0.4), hd, skin, MATTE);
        for (const s of [-1, 1]) { P(cone(0.22, 1.1), hd, skin, MATTE, [s*0.75, 0.22, -0.05], [0, 0, -s*1.25], [1, 1, 0.35]); P(sph(0.11), hd, '#ffef6a', GLOW, [s*0.17, 0.06, 0.34]); }
        break;
      case 'hog':
        P(sph(0.45), hd, skin, MATTE);
        P(cyl(0.2, 0.23, 0.32, 14), hd, sp.acc, MATTE, [0, -0.1, 0.5], [Math.PI/2, 0, 0]);
        for (const s of [-1, 1]) { P(sph(0.04), hd, '#3a1e14', MATTE, [s*0.08, -0.1, 0.67]); P(cone(0.05, 0.3), hd, '#fffbe8', MATTE, [s*0.24, -0.28, 0.4], [0, 0, s*0.4]); P(cone(0.14, 0.3, 4), hd, skin, MATTE, [s*0.3, 0.45, -0.05], [0, 0, -s*0.5]); }
        break;
      case 'robot':
        P(box(0.78, 0.72, 0.78), hd, skin, METAL, [0, 0.05, 0]);
        P(box(0.66, 0.15, 0.06), hd, sp.acc, GLOW, [0, 0.08, 0.4]);
        P(cyl(0.03, 0.03, 0.5, 6), hd, '#5b6470', METAL, [0, 0.65, 0]); P(sph(0.08), hd, sp.acc, GLOW, [0, 0.92, 0]);
        break;
      case 'ogre':
        P(sph(0.54), hd, skin, MATTE);
        P(cone(0.16, 0.6), hd, sp.acc, GLOSS, [0, 0.35, 0.45], [0.9, 0, 0]);
        for (const s of [-1, 1]) { P(cone(0.07, 0.28), hd, sp.acc, MATTE, [s*0.18, -0.32, 0.42]); P(sph(0.06), hd, '#1b1520', GLOSS, [s*0.2, 0.08, 0.48]); }
        break;
      case 'horror':
        P(sph(0.46), hd, skin, MATTE);
        P(sph(0.16), hd, '#ff5a8a', GLOW, [0, 0.06, 0.4]);
        for (let i=0;i<4;i++){ const x = (i-1.5)*0.15; P(cone(0.07, 0.95, 6), hd, sp.acc, MATTE, [x, -0.5, 0.42], [Math.PI*0.88, 0, x*0.6]); }
        break;
    }
    if (o.species !== 'robot') {
      const hR = o.species === 'ogre' ? 0.6 : 0.5;
      if (G) {
        P(sph(hR + 0.04, 18, 12, 0, Math.PI*2, 0, Math.PI*0.62), hd, T, GLOSS, [0, 0.1, -0.02], [0,0,0], [1, 1, 1.1]);
        for (let i=-2;i<=2;i++) P(box(0.04, 0.6, 0.04), hd, '#f4f4f4', METAL, [i*0.13, -0.05, hR + 0.12]);
        for (let j=0;j<3;j++) P(box(0.62, 0.04, 0.04), hd, '#f4f4f4', METAL, [0, 0.18 - j*0.22, hR + 0.12]);
      } else {
        P(sph(hR, 18, 10, 0, Math.PI*2, 0, Math.PI*0.5), hd, J, GLOSS, [0, 0.12, -0.03], [0,0,0], [1, 0.95, 1.1]);
        P(new THREE.CylinderGeometry(hR + 0.02, hR + 0.02, 0.24, 18, 1, true, -1.0, 2.0), hd, '#1c2834', GLOSS, [0, 0.03, 0]);
        P(cyl(hR + 0.025, hR + 0.025, 0.07, 18), hd, T, GLOSS, [0, 0.16, -0.03], [0,0,0], [1, 1, 1.1]);
      }
    }
    // stick (grip at bone origin, shaft along -Y)
    const L = G ? 4.4 : 4.6, BOFF = G ? 0.5 : 0.4;
    // shaft: carbon with a team graphic, white knob tape, tapered hosel
    P(box(0.105, L - 0.55, 0.13), 'stick', '#18191d', GLOSS, [0, -(L - 0.55)/2, 0]);
    P(box(0.11, 0.7, 0.135), 'stick', T, GLOSS, [0, -1.05, 0]);
    P(box(0.125, 0.34, 0.15), 'stick', '#f4f4f2', MATTE, [0, -0.17, 0]);
    P(cyl(0.05, 0.075, 0.55, 8), 'stick', '#18191d', GLOSS, [0.03, -L + 0.27, 0], [0, 0, -0.12]);
    if (G) P(box(0.24, 1.55, 0.16), 'stick', '#202126', GLOSS, [0, -L + 1.0, 0]);
    P(bladeGeo(G), 'stick', '#101013', MATTE, [BOFF, -L - 0.02, 0], [Math.PI/4, 0, 0]);
    P(bladeTape(G), 'stick', '#f2f2ee', MATTE, [BOFF, -L - 0.02, 0], [Math.PI/4, 0, 0]);
    if (o.species === 'rat') { const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0,0,0), new THREE.Vector3(0,-0.4,-0.7), new THREE.Vector3(0.15,-1.0,-1.4), new THREE.Vector3(0.4,-1.35,-2.1)]); P(new THREE.TubeGeometry(curve, 16, 0.09, 6), 'tail', '#d9909f', MATTE); }
    // bake
    const geos = parts.map(p => {
      const g = p.geo.index ? p.geo.toNonIndexed() : p.geo;
      if (g.attributes.uv) g.deleteAttribute('uv');
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(p.bone.matrixWorld, p.m));
      const n = g.attributes.position.count, c = new Float32Array(n*3), rm = new Float32Array(n*4), si = new Uint16Array(n*4), sw = new Float32Array(n*4), ol = new Float32Array(n);
      const olv = p.bone.name === 'stick' ? 0.28 : p.bone.name === 'tail' ? 0.5 : 1;
      for (let i=0;i<n;i++){ c[i*3] = p.col.r; c[i*3+1] = p.col.g; c[i*3+2] = p.col.b; rm.set(p.rm, i*4); si[i*4] = p.bone.userData.i; sw[i*4] = 1; ol[i] = olv; }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aRM', new THREE.BufferAttribute(rm, 4)); g.setAttribute('aOL', new THREE.BufferAttribute(ol, 1));
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
      return g;
    });
    const merged = BGU.mergeGeometries(geos);
    const mesh = new THREE.SkinnedMesh(merged, rigMat);
    mesh.add(B.root); mesh.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(list));
    mesh.castShadow = true; mesh.frustumCulled = false;
    const hull = new THREE.SkinnedMesh(merged, outlineMat); hull.bind(mesh.skeleton, mesh.bindMatrix); hull.frustumCulled = false;
    const group = new THREE.Group(); group.add(mesh, hull);
    // number on the back
    if (o.number != null) {
      const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
      g.font = '86px Bungee, "Arial Black", Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 10; g.strokeStyle = T; g.strokeText(String(o.number), 64, 70); g.fillStyle = new THREE.Color(J).getHSL({}).l > 0.5 ? '#151515' : '#ffffff'; g.fillText(String(o.number), 64, 70);
      const nm = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 1.15), new THREE.MeshStandardNodeMaterial({ map:canvasTex(c), transparent:true, alphaTest:0.3, roughness:0.8, polygonOffset:true, polygonOffsetFactor:-2 }));
      nm.position.set(0, 0.32, G ? -1.07 : -0.88); nm.rotation.set(-0.12, Math.PI, 0); B.chest.add(nm);
    }
    // power-up attachments
    // rocket skates: a twin-tube jet pack on the back with layered comic flames
    const flames = new THREE.Group(); flames.visible = false; B.chest.add(flames);
    { const pack = withInk(new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.45), packMat), 1.1); pack.position.set(0, 0.25, -0.95); flames.add(pack);
      flames.userData.jets = [];
      for (const sx of [-0.34, 0.34]) {
        const tube = withInk(new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 1.3, 10), packMat), 1.12); tube.position.set(sx, 0.05, -1.25); flames.add(tube);
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.255, 0.18, 10), packTrimMat); band.position.set(sx, 0.25, -1.25); flames.add(band);
        const jet = new THREE.Group(); jet.position.set(sx, -0.62, -1.25); flames.add(jet);
        const cone = (r, h, m) => { const g = new THREE.ConeGeometry(r, h, 8); g.rotateX(Math.PI); g.translate(0, -h/2, 0); return new THREE.Mesh(g, m); };   // wide at the nozzle, tip trailing
        const outer = withInk(cone(0.34, 1.7, flameOuterMat), 1.12), mid = cone(0.25, 1.15, flameMidMat), core = cone(0.15, 0.65, flameCoreMat);
        jet.add(outer, mid, core); jet.rotation.x = -0.45;   // chest leans forward, so this points the flames down and back
        flames.userData.jets.push(jet);
      }
    }
    // deep freeze: a faceted ice crystal around the player
    const ice = new THREE.Group(); ice.visible = false; group.add(ice);
    { const shard = (sx, sy, sz, x, y, z, rx, rz) => { const g = new THREE.OctahedronGeometry(1, 0); const m = new THREE.Mesh(g, crystalMat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.set(rx, 0.4, rz); const e = new THREE.Mesh(g, crystalEdgeMat); e.scale.setScalar(1.06); m.add(e); m.renderOrder = 6; ice.add(m); };
      shard(2.3, 4.4, 2.1, 0, 3.6, 0.2, 0.05, 0.04);
      shard(0.9, 2.0, 0.8, 1.7, 1.2, 0.6, 0.2, -0.55); shard(0.8, 1.7, 0.8, -1.6, 1.0, -0.4, -0.2, 0.6); shard(0.7, 1.5, 0.7, 0.4, 1.0, 1.9, 0.6, 0.1); }
    // kaiju mode: back spikes and glowing eyes
    const kaiju = new THREE.Group(); kaiju.visible = false;
    { for (const [y, z, h] of [[0.75, -0.8, 0.95], [0.25, -0.88, 0.8], [-0.2, -0.85, 0.65]]) { const sp = withInk(new THREE.Mesh(new THREE.ConeGeometry(0.22, h, 6), spikeMat), 1.14); sp.position.set(0, y, z - h*0.25); sp.rotation.x = -1.05; kaiju.add(sp); }
      B.chest.add(kaiju);
      const eyes = new THREE.Group(); for (const sx of [-0.2, 0.2]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), eyeMat); e.position.set(sx, 0.5, 0.52); eyes.add(e); } B.head.add(eyes); kaiju.userData.eyes = eyes; eyes.visible = false; }
    // magnet stick: a horseshoe magnet on the blade plus the pulse ring on the ice
    const mag = new THREE.Mesh(new THREE.TorusGeometry(3.2, 0.09, 6, 40), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(0.6, 3, 3.4) })); mag.rotation.x = Math.PI/2; mag.position.y = 0.4; mag.visible = false; group.add(mag);
    { const hs = new THREE.Group(); const arc = withInk(new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.13, 8, 16, Math.PI), magRedMat), 1.12); hs.add(arc);
      for (const sx of [-0.36, 0.36]) { const tip = withInk(new THREE.Mesh(new THREE.BoxGeometry(0.27, 0.26, 0.27), magTipMat), 1.12); tip.position.set(sx, -0.13, 0); hs.add(tip); }
      hs.position.set(BOFF + 0.1, -L + 0.75, 0); hs.rotation.set(0, Math.PI/2, Math.PI); hs.visible = false; B.stick.add(hs); mag.userData.shoe = hs; }
    return { group, mesh, B, flames, ice, mag, kaiju, goalie:!!G, L, boff:BOFF };
  }
  const rigs = new Map(); let goalieRigs = null;
  function disposeRig(r){ dyn.remove(r.group); r.mesh.geometry.dispose(); r.group.traverse(o => { if (o.isMesh && o !== r.mesh && o.material && o.material.map && o.material.map.isCanvasTexture) { o.material.map.dispose(); o.material.dispose(); } }); }
  function buildPlayers(G){
    for (const r of rigs.values()) disposeRig(r); rigs.clear();
    if (goalieRigs) { disposeRig(goalieRigs.home); disposeRig(goalieRigs.away); }
    const used = new Set();
    for (const s of G.sk) {
      const home = s.team === 'home';
      let num; do { num = [7, 9, 13, 17, 19, 22, 27, 33, 44, 66, 71, 88, 91, 99][Math.floor(Math.random()*14)]; } while (used.has(num + s.team)); used.add(num + s.team);
      const r = buildRig({ species:s.species, jersey: home ? S.HOME.jersey : G.ch.opp.jersey, trim: home ? S.HOME.trim : G.ch.opp.trim, goalie:false, number:num });
      r.v = mkVis(); dyn.add(r.group); rigs.set(s, r);
    }
    goalieRigs = {};
    for (const tm of ['home', 'away']) {
      const r = buildRig({ species: tm === 'home' ? 'rat' : G.ch.opp.species, jersey: tm === 'home' ? S.HOME.jersey : G.ch.opp.jersey, trim: tm === 'home' ? S.HOME.trim : G.ch.opp.trim, goalie:true, number:tm === 'home' ? 31 : 1 });
      r.v = mkVis(); dyn.add(r.group); goalieRigs[tm] = r;
    }
  }
  const mkVis = () => ({ init:false, x:0, z:0, ox:0, oz:0, yaw:0, yawV:0, bank:0, phase:Math.random()*6, stride:0, lastSpeed:0, stopT:0, stopYaw:0, follow:0, cele:0, lx:0, ly:0, sx:0, sy:0, hasPuck:false, wasCharging:false, butter:0 });

  // IK helpers
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion();
  function ik2(upper, lower, L1, L2, targetW, poleW){
    upper.getWorldPosition(_a);
    _b.subVectors(targetW, _a); let dist = _b.length(); const tn = _b.clone().normalize();
    dist = Math.min(Math.max(dist, 0.05), (L1 + L2)*0.999);
    const cosA = (L1*L1 + dist*dist - L2*L2)/(2*L1*dist), A = Math.acos(Math.max(-1, Math.min(1, cosA)));
    _c.copy(poleW).addScaledVector(tn, -poleW.dot(tn)); if (_c.lengthSq() < 1e-6) _c.set(0, 0, 1); _c.normalize();
    const upDir = _d.copy(tn).multiplyScalar(Math.cos(A)).addScaledVector(_c, Math.sin(A)).normalize();
    const elbow = _e.copy(_a).addScaledVector(upDir, L1);
    const end = _a.clone().addScaledVector(tn, dist);
    const loDir = end.sub(elbow).normalize();
    upper.parent.getWorldQuaternion(_q); const pInv = _q2.copy(_q).invert();
    upper.quaternion.setFromUnitVectors(DOWN, upDir.clone().applyQuaternion(pInv));
    _q3.copy(_q).multiply(upper.quaternion).invert();
    lower.quaternion.setFromUnitVectors(DOWN, loDir.applyQuaternion(_q3));
  }
  const _tw = new THREE.Vector3(), _pw = new THREE.Vector3(), _gq = new THREE.Quaternion();
  const toW = (r, x, y, z, out) => out.set(x, y, z).applyMatrix4(r.group.matrixWorld);
  const dirW = (r, x, y, z, out) => out.set(x, y, z).applyQuaternion(r.group.getWorldQuaternion(_gq));

  function poseSkater(r, s, dt, t, G, P){
    const v = r.v, B = r.B;
    const scale = 1.12 * (s.r / (s.baseR || 2.6));
    // position, teleport smoothing
    const sxw = s.x - CX, szw = s.y - RL/2;
    if (!v.init) { v.x = sxw; v.z = szw; v.yaw = Math.atan2(Math.cos(s.face), Math.sin(s.face)); v.init = true; }
    if (Math.hypot(sxw - (v.x - v.ox), szw - (v.z - v.oz)) > 9) { v.ox = v.x - sxw; v.oz = v.z - szw; }
    const dec = Math.exp(-dt*3.5); v.ox *= dec; v.oz *= dec;
    v.x = sxw + v.ox; v.z = szw + v.oz;
    const speed = Math.hypot(s.vx, s.vy);
    const acc = (speed - v.lastSpeed)/Math.max(dt, 1e-3); v.lastSpeed = speed;
    // heading spring
    const want = Math.atan2(Math.cos(s.face), Math.sin(s.face));
    let dy = want - v.yaw; while (dy > Math.PI) dy -= 2*Math.PI; while (dy < -Math.PI) dy += 2*Math.PI;
    const k = 140, c = 2*Math.sqrt(k); v.yawV += (k*dy - c*v.yawV)*dt; v.yaw += v.yawV*dt;
    // hard stop
    if (acc < -38 && v.lastSpeed > 6 && v.stopT <= 0 && s.stun <= 0) { v.stopT = 0.45; v.stopYaw = (Math.random() < 0.5 ? 1 : -1)*1.35; emitSnow(s.x, s.y, s.vx, s.vy, 26); scuffLine(s.x - s.vx*0.12, s.y - s.vy*0.12, s.x, s.y, 1.1, 0.55); }
    v.stopT = Math.max(0, v.stopT - dt);
    const stopK = v.stopT > 0 ? Math.sin(Math.min(1, v.stopT/0.45)*Math.PI) : 0;
    const latAcc = speed * v.yawV;
    v.bank += (Math.max(-0.55, Math.min(0.55, -latAcc/70)) - v.bank)*Math.min(1, dt*8);
    const g = r.group;
    g.position.set(v.x, 0, v.z); g.rotation.set(0, v.yaw + v.stopYaw*stopK, 0); g.scale.setScalar(scale);
    // celebration / KO / frozen
    const ko = s.ko > 0, frozen = s.frozen > 0, cele = v.cele > 0;
    r.ice.visible = frozen; r.flames.visible = s.rocket > 0; r.mag.visible = s.magnet > 0; r.mag.userData.shoe.visible = s.magnet > 0;
    r.kaiju.visible = s.kaiju > 0; r.kaiju.userData.eyes.visible = s.kaiju > 0;
    if (s.rocket > 0) r.flames.userData.jets.forEach((j, i) => { const f = 0.75 + Math.random()*0.5 + Math.min(0.4, speed/80); j.scale.set(0.9 + Math.random()*0.2, f, 0.9 + Math.random()*0.2); j.rotation.z = Math.sin(t*31 + i*2)*0.06; });
    if (s.magnet > 0) { const ps = 1 + ((t*1.5) % 1)*0.5; r.mag.scale.setScalar(ps); r.mag.userData.shoe.rotation.x = Math.sin(t*20)*0.08; }
    if (frozen) r.ice.rotation.y = -v.yaw + 0.3;
    B.root.rotation.set(0, 0, 0); B.root.position.set(0, 0, 0);
    if (ko) {
      v.koT = (v.koT || 0) + dt; const fall = Math.min(1, v.koT/0.35), bounce = v.koT < 0.6 ? Math.abs(Math.sin(v.koT*9))*0.35*(1 - v.koT/0.6) : 0;
      poseNeutral(B);
      B.root.rotation.set(-Math.PI/2*fall, 0, 0.25*fall); B.root.position.set(0, 0.75*fall + bounce, 3.1*fall);
      B.upArmL.rotation.set(0.2, 0, 1.9); B.upArmR.rotation.set(-0.3, 0, -1.6); B.foreArmL.rotation.set(-0.6, 0, 0); B.foreArmR.rotation.set(-0.9, 0, 0);
      B.thighL.rotation.set(0.25, 0, 0.45); B.thighR.rotation.set(-0.15, 0, -0.3); B.shinL.rotation.set(-0.5, 0, 0); B.shinR.rotation.set(-0.2, 0, 0);
      B.head.rotation.set(0, Math.sin(t*3)*0.35, 0);
      g.rotation.y = v.yaw; placeStickNeutral(r); r.B.stick.position.set(-2.4, 0.25, 1.6); return;
    }
    v.koT = 0;
    // knocked off the skates: topple the way they were sent, slide, then scramble back up
    if ((s.down || 0) > 0) {
      if (!(v.downPrev > 0)) {
        v.downT = 0; const sp0 = Math.hypot(s.vx, s.vy) || 1, wx = s.vx/sp0, wz = s.vy/sp0, cy = Math.cos(v.yaw), sy = Math.sin(v.yaw);
        v.fallX = wx*cy - wz*sy; v.fallZ = wx*sy + wz*cy; if (!isFinite(v.fallX)) { v.fallX = 0; v.fallZ = -1; }
      }
      v.downPrev = s.down; v.downT += dt;
      const tilt = 1.32 * Math.min(1, v.downT/0.2) * Math.min(1, s.down/0.38), up = s.down < 0.38 ? 1 - s.down/0.38 : 0;
      poseNeutral(B);
      B.root.rotation.set(tilt*v.fallZ, 0, -tilt*v.fallX);
      const fl = Math.sin(t*13 + s.idx)*0.5*(1 - up);
      B.upArmL.rotation.set(-0.6 + fl, 0, 1.3 + fl*0.5); B.upArmR.rotation.set(-0.4 - fl, 0, -1.2 + fl*0.5);
      B.thighL.rotation.set(0.7 + up*0.6, 0, 0.25); B.thighR.rotation.set(0.3 + up*0.9, 0, -0.2); B.shinL.rotation.set(-0.9 - up*0.6, 0, 0); B.shinR.rotation.set(-0.5 - up*1.1, 0, 0);
      B.hips.position.y = 3.25 - up*0.9;
      g.updateMatrixWorld(true); placeStickNeutral(r); r.B.stick.position.set(-1.6, 0.4, 1.2);
      return;
    }
    v.downPrev = 0;
    if (frozen) return;
    // locomotion
    const moving = speed > 3.5;
    const accel = acc > 4;
    // one-skate glide: coasting players sometimes lift a skate off the ice (more often while skating to a faceoff)
    // crossovers: in a carved turn the outside skate steps over the inside one
    const crossT = Math.max(0, Math.min(1, (Math.abs(v.yawV) - 0.9)/1.6)) * Math.min(1, speed/12) * (1 - stopK);
    v.cross = (v.cross || 0) + (crossT - (v.cross || 0))*Math.min(1, dt*6);
    const outSg = v.yawV > 0 ? -1 : 1;
    const coast = speed > 5 && speed < 27 && !accel && stopK === 0 && s.stun <= 0 && !s.charging && s.lunge <= 0 && !cele && v.cross < 0.2;
    v.liftT = (v.liftT ?? Math.random()*3) - dt;
    if (v.liftT <= 0) {
      if (v.liftOn) { v.liftOn = false; v.liftT = (G.state === 'regroup' ? 0.6 : 2.2) + Math.random()*(G.state === 'regroup' ? 1.2 : 4); }
      else if (coast) { v.liftOn = true; v.liftLeg = Math.random() < 0.5 ? 'L' : 'R'; v.liftT = 0.7 + Math.random()*1.1; }
      else v.liftT = 0.3;
    }
    if (!coast) v.liftOn = false;
    v.lift = (v.lift || 0) + ((v.liftOn ? 1 : 0) - (v.lift || 0))*Math.min(1, dt*6);
    const strideAmp = Math.min(1, speed/22) * (accel || speed < 14 ? 1 : 0.45) * (s.stun > 0 ? 0 : 1) * (1 - stopK) * (1 - v.lift*0.85);
    v.stride += (strideAmp - v.stride)*Math.min(1, dt*5);
    const freq = 0.9 + speed/27*1.3;
    if (moving) v.phase += dt*freq*Math.PI*2;
    const a = v.stride;
    const crouch = cele ? 0.2 : 1;
    const hipsY = 3.25 - (0.75 + a*0.12 + stopK*0.35)*crouch;
    B.hips.position.y = hipsY;
    B.hips.rotation.set(s.stun > 0 ? -0.18 : 0, 0, v.bank*0.8 + (s.stun > 0 ? Math.sin(t*14)*0.16 : 0) + (v.lift || 0)*(v.liftLeg === 'L' ? -0.07 : 0.07));
    const charge = s.charging ? s.charge : 0;
    B.spine.rotation.set((0.5 + a*0.12)*crouch + stopK*0.1, -charge*0.5, 0);
    B.chest.rotation.set(0.12*crouch, -charge*0.3 + Math.sin(v.phase)*0.12*a, 0);
    if ((s.check || 0) > 0) {
      const ck = Math.sin(Math.PI*(1 - s.check/0.34)), side = Math.sign(Math.sin((s.checkDir || 0) - s.face)) || 1;
      B.spine.rotation.x += 0.35*ck; B.chest.rotation.y += side*0.6*ck; B.hips.position.y -= 0.3*ck;
    }
    B.neck.rotation.set(-(0.62 + a*0.12)*crouch, 0, 0); B.head.rotation.set(0, 0, 0);
    if (B.tail) B.tail.rotation.set(0, Math.sin(t*6 + s.idx)*0.4, 0);
    g.updateMatrixWorld(true);
    // legs
    for (const [sg, n, ph] of [[1, 'L', v.phase], [-1, 'R', v.phase + Math.PI]]) {
      const sn = Math.sin(ph), push = Math.max(0, sn), rec = Math.max(0, -sn);
      let fx = sg*(0.55 + a*0.85*push + stopK*0.6), fz = 0.25 - a*1.5*sn - stopK*0.3, fy = 0.43 + a*0.32*rec;
      if (v.cross > 0.02) {
        const ck = v.cross, cs = Math.sin(ph*1.0), cpush = Math.max(0, cs), crec = Math.max(0, -cs);
        if (sg === outSg) { fx += (-sg*0.5 - fx)*crec*ck; fy += 0.42*crec*ck; fz += 0.45*crec*ck - 0.2*cpush*ck; }   // over the top
        else { fx += (sg*(1.05 + 0.55*cpush) - fx)*ck*0.75; fz -= 0.25*cpush*ck; }                                // push out underneath
      }
      if (cele) { fx = sg*0.6; fz = 0.2; fy = 0.43; }
      if (v.lift > 0.01) { if (n === v.liftLeg) { fx = sg*(0.45 - 0.1*v.lift); fy += 0.75*v.lift; fz -= 0.85*v.lift; } else fx -= sg*0.12*v.lift; }
      toW(r, fx, fy, fz, _tw); dirW(r, sg*0.15, 0, 1, _pw);
      ik2(B['thigh'+n], B['shin'+n], 1.4*scale, 1.3*scale, _tw, _pw);
      B['shin'+n].getWorldQuaternion(_q); r.group.getWorldQuaternion(_gq);
      B['foot'+n].quaternion.copy(_q.invert().multiply(_gq)).multiply(_q2.setFromAxisAngle(_a.set(0,1,0), sg*(0.15 + a*0.45*push)));
    }
    // stick + arms
    // blade target = blade centre in rig space; the puck sits just in front of it at the sim's stick point
    const reach = (s.r + 1.7 + (s.lunge > 0 ? 1.8 : 0)) / scale;
    const hasP = P.owner === s;
    const PUCK_GAP = 0.5, ph = t*5.6 + s.idx*1.7;
    const handle = hasP && !s.charging ? 1 - Math.min(0.6, speed/45) : 0;
    let cx = handle ? (Math.sin(ph)*0.42 + Math.sin(ph*0.37 + 1)*0.1)*handle : 0.05;
    let cy = 0.16, cz = reach - PUCK_GAP + (handle ? Math.cos(ph)*0.1*handle : 0);
    if (s.charging) v.lastCharge = charge;
    if (v.wasCharging && !s.charging && P.shotBy === s.team) { v.follow = 0.4; if ((v.lastCharge || 0) > 0.45) emitSparks(P.x, P.y, P.vx, P.vy, 8 + Math.round(v.lastCharge*12)); v.lastCharge = 0; }
    // skill-stick flick release: short follow-through
    if ((v.lastWind || 0) > 0.1 && !(s.wind > 0) && P.owner !== s && P.shotBy === s.team) { v.follow = 0.3; if (v.lastWind > 0.5) emitSparks(P.x, P.y, P.vx, P.vy, 6 + Math.round(v.lastWind*10)); }
    v.lastWind = s.wind || 0;
    // the sim owns the blade: track it in rig space so stick, hands and puck all agree
    const track = !!s.bl && !s.charging && !cele && s.stun <= 0;
    if (track) { _bt.set(s.bl.x - CX, 0, s.bl.y - RL/2); r.group.worldToLocal(_bt); cx = Math.max(-4.8, Math.min(4.8, _bt.x)); cz = Math.max(-2.4, Math.min(5.4, _bt.z)); cy = 0.16 + (s.wind || 0)*0.55; }
    v.wasCharging = s.charging;
    v.follow = Math.max(0, v.follow - dt);
    let bk = 260;
    if (s.charging) { cx = -0.5 - charge*0.7; cy = 0.16 + charge*charge*3.6; cz = reach*(1 - charge*0.9) - charge*2.4; bk = 140; }
    if (v.follow > 0) { const f = 1 - v.follow/0.4; cx = 0.1 - f*0.4; cy = 0.3 + f*3.2; cz = reach + 0.6 + f*0.6; bk = 420; }
    if (cele) { cx = 0.6; cy = 8.2; cz = 1.2; bk = 90; }
    if (s.stun > 0) { cx = Math.sin(t*9)*1.4; cy = 1.4; cz = 2.4; bk = 90; }
    if (s.lunge > 0) bk = 520;
    const sb = smoothBlade(v, cx, cy, cz, dt, bk);
    v.trk = Math.max(0, Math.min(1, (v.trk || 0) + (track && v.follow <= 0 && s.lunge <= 0 ? dt : -dt)/0.12));
    const bl = _bb.copy(sb).lerp(_bt.set(cx, cy, cz), v.trk);
    const hx = Math.max(-1, Math.min(1, bl.x*0.3));
    B.chest.rotation.y += Math.max(-0.35, Math.min(0.35, bl.x*0.07));
    placeStick(r, bl.x - r.boff, bl.y, bl.z, cele ? [0.4, 6.4, 0.6] : [-0.25 + hx, 3.6, 0.9 + Math.min(0, bl.z)*0.25]);
    armsToStick(r, cele);
    // where the carried puck should sit: in front of the blade, on the ice
    r.puckW = toW(r, bl.x, 0, bl.z + PUCK_GAP, r.puckW || new THREE.Vector3());
  }
  const _bt = new THREE.Vector3(), _bb = new THREE.Vector3();
  const _sp = new THREE.Vector3(), _gp = new THREE.Vector3(), _bx = new THREE.Vector3(), _bz = new THREE.Vector3(), _bm = new THREE.Matrix4();
  // spring-smooth a blade target (rig-local) so the stick never snaps between states
  function smoothBlade(v, x, y, z, dt, k = 260){
    if (!v.bl) { v.bl = new THREE.Vector3(x, y, z); v.blv = new THREE.Vector3(); }
    const c = 2*Math.sqrt(k), h = Math.min(dt, 0.04);
    v.blv.x += (k*(x - v.bl.x) - c*v.blv.x)*h; v.blv.y += (k*(y - v.bl.y) - c*v.blv.y)*h; v.blv.z += (k*(z - v.bl.z) - c*v.blv.z)*h;
    v.bl.addScaledVector(v.blv, h);
    return v.bl;
  }
  function placeStick(r, bx, by, bz, pref){
    const L = r.L + 0.05;
    _sp.set(bx, by, bz); _gp.set(pref[0], pref[1], pref[2]).sub(_sp);
    if (_gp.lengthSq() < 0.01) _gp.set(0, 1, -1);
    _gp.normalize();
    const grip = _sp.clone().addScaledVector(_gp, L);
    const st = r.B.stick; st.position.copy(grip);
    // basis: y up the shaft, x lateral and level, so the blade never rolls
    _bx.set(1, 0, 0).addScaledVector(_gp, -_gp.x).normalize();
    _bz.crossVectors(_bx, _gp);
    _bm.makeBasis(_bx, _gp, _bz); st.quaternion.setFromRotationMatrix(_bm);
    r.stickGrip = grip; r.stickDir = _gp.clone().negate();
  }
  function placeStickNeutral(r){ r.B.stick.position.set(-1.2, 0.3, 0.5); r.B.stick.quaternion.setFromAxisAngle(_a.set(0,0,1), Math.PI/2); }
  function poseNeutral(B){ for (const n of ['hips','spine','chest','neck','head','upArmL','upArmR','foreArmL','foreArmR','thighL','thighR','shinL','shinR','footL','footR']) B[n].quaternion.identity(); B.hips.position.y = 3.25; B.upArmL.rotation.z = 0.5; B.upArmR.rotation.z = -0.5; }
  const _h1 = new THREE.Vector3(), _h2 = new THREE.Vector3(), _pl = new THREE.Vector3(), _pr = new THREE.Vector3();
  const _s1 = new THREE.Vector3(), _s2 = new THREE.Vector3(), _hq = new THREE.Vector3();
  function armsToStick(r, up){
    r.group.updateMatrixWorld(true);
    const sc = r.group.scale.x, B = r.B;
    if (up) { toW(r, 0.7, 7.0, 0.5, _h1); toW(r, -0.7, 7.0, 0.5, _h2); }
    else {
      const g0 = r.stickGrip, dir = r.stickDir, REACH = 1.78;
      B.upArmL.getWorldPosition(_s1); r.group.worldToLocal(_s1); B.upArmR.getWorldPosition(_s2); r.group.worldToLocal(_s2);
      const at = (u, out) => out.copy(g0).addScaledVector(dir, u), proj = sh => _hq.copy(sh).sub(g0).dot(dir);
      let ut = 0; if (at(0, _hq).distanceTo(_s1) > REACH) ut = Math.max(0, Math.min(r.L*0.4, proj(_s1)));
      let ub = ut + 1.25; if (at(ub, _hq).distanceTo(_s2) > REACH) ub = Math.max(ut + 0.6, Math.min(ut + 1.8, proj(_s2)));
      at(ut, _hq); toW(r, _hq.x, _hq.y, _hq.z, _h1);
      at(ub, _hq); toW(r, _hq.x, _hq.y, _hq.z, _h2);
    }
    dirW(r, 1, -1, -0.6, _pl); dirW(r, -1, -1, -0.6, _pr);
    ik2(B.upArmL, B.foreArmL, 0.95*sc, 0.95*sc, _h1, _pl);
    ik2(B.upArmR, B.foreArmR, 0.95*sc, 0.95*sc, _h2, _pr);
  }
  function poseGoalie(r, g, dt, t, G, P){
    const v = r.v, B = r.B;
    r.group.visible = !g.off; if (g.off) return;
    const scale = 1.15 * (g.r / S.C.G_R);
    const gx = g.x - CX, gz = g.y - RL/2;
    if (!v.init) { v.x = gx; v.z = gz; v.init = true; }
    if (Math.hypot(gx - v.x, gz - v.z) > 9) { v.ox = v.x - gx; v.oz = v.z - gz; }
    v.ox *= Math.exp(-dt*3.5); v.oz *= Math.exp(-dt*3.5);
    const lastX = v.x, lastZ = v.z; v.x = gx + v.ox; v.z = gz + v.oz;
    const latV = (v.x - lastX)/Math.max(dt, 1e-3), latVz = (v.z - lastZ)/Math.max(dt, 1e-3);
    const want = Math.atan2(Math.cos(g.face), Math.sin(g.face));
    let dy = want - v.yaw; while (dy > Math.PI) dy -= 2*Math.PI; while (dy < -Math.PI) dy += 2*Math.PI; v.yaw += dy*Math.min(1, dt*8);
    const grp = r.group; grp.position.set(v.x, 0, v.z); grp.rotation.set(0, v.yaw, 0); grp.scale.setScalar(scale);
    r.ice.visible = g.frozen > 0; r.flames.visible = false; r.mag.visible = false; r.mag.userData.shoe.visible = false; r.kaiju.visible = false; r.kaiju.userData.eyes.visible = false;
    if (g.frozen > 0) return;
    B.root.rotation.set(0, 0, 0); B.root.position.set(0, 0, 0);
    if (g.stun > 0) { poseNeutral(B); B.root.rotation.set(-Math.PI/2, 0, 0.2); B.root.position.set(0, 0.95, 3.0); B.upArmL.rotation.set(0, 0, 1.7); B.upArmR.rotation.set(0, 0, -1.7); placeStickNeutral(r); r.B.stick.position.set(-2.2, 0.3, 1.4); return; }
    // incoming shot -> butterfly
    let threat = 0;
    for (const Q of G.pucks) { if (Q.owner || Q.hold) continue; const sp = Math.hypot(Q.vx, Q.vy), d = Math.hypot(Q.x - g.x, Q.y - g.y); const toward = (Q.vx*(g.x - Q.x) + Q.vy*(g.y - Q.y))/(sp*d + 1e-6); if (sp > 28 && toward > 0.75 && d < 38) threat = Math.max(threat, 1); }
    if (P.hold === g) threat = 0.6;
    v.butter += (threat - v.butter)*Math.min(1, dt*(threat > v.butter ? 14 : 3));
    // save reactions: kick a pad out low, flash the glove or blocker up high; a held puck gets covered
    const se = (g.save || 0) > 0 ? Math.min(1, (0.55 - g.save)/0.07) * Math.min(1, g.save/0.25) : 0;
    v.se = (v.se || 0) + (se - (v.se || 0))*Math.min(1, dt*20);
    const sideSg = (g.saveLat || 0) > 0 ? -1 : 1, high = !!g.saveHigh, low = v.se*(high ? 0.25 : 1), up = v.se*(high ? 1 : 0);
    if (low > 0.05) v.butter = Math.max(v.butter, low*0.85);
    // shuffle: lateral steps lift the lead skate
    const lx = latV*Math.cos(v.yaw) - latVz*Math.sin(v.yaw);
    if (Math.abs(lx) > 3) v.gph = (v.gph || 0) + dt*11; const shuf = Math.min(1, Math.abs(lx)/14), leadSg = lx > 0 ? 1 : -1;
    const b = v.butter;
    B.hips.position.y = 2.35 - b*1.05; B.hips.position.x = sideSg*0.45*low;
    B.hips.rotation.set(0, 0, Math.max(-0.3, Math.min(0.3, -latV/60)));
    B.spine.rotation.set(0.32 - b*0.1, 0, 0); B.chest.rotation.set(0.05, 0, 0); B.neck.rotation.set(-0.3, 0, 0);
    grp.updateMatrixWorld(true);
    for (const [sg, n] of [[1, 'L'], [-1, 'R']]) {
      let fx = sg*(1.3 + b*0.7), fz = 0.1 - b*1.0, fy = 0.43 + b*0.05;
      if (sg === sideSg && low > 0.05) { fx = sg*(1.3 + b*0.7 + 1.5*low); fz += 0.35*low; }
      if (sg === leadSg && shuf > 0.1 && b < 0.4) { fy += 0.22*shuf*Math.max(0, Math.sin(v.gph)); fx += sg*0.25*shuf; }
      toW(r, fx, fy, fz, _tw); dirW(r, sg*(0.4 - b*1.2), 0, 1, _pw);
      ik2(B['thigh'+n], B['shin'+n], 1.4*scale, 1.3*scale, _tw, _pw);
      B['shin'+n].getWorldQuaternion(_q); grp.getWorldQuaternion(_gq);
      B['foot'+n].quaternion.copy(_q.invert().multiply(_gq)).multiply(_q2.setFromAxisAngle(_a.set(0,1,0), sg*(0.5 + b*0.9)));
    }
    // glove reaches toward the puck
    const gb = smoothBlade(v, -0.1 + r.boff, 0.16, 2.3 - b*0.4, dt, 300);
    placeStick(r, gb.x - r.boff, gb.y, gb.z, [-0.9, 2.7 - b*0.8, 1.1]);
    grp.updateMatrixWorld(true);
    const sc = scale;
    toW(r, r.stickGrip.x, r.stickGrip.y, r.stickGrip.z, _h2);
    if (P.hold === g) toW(r, 0.35, 0.9, 1.7, _h1);                                                     // glove covers the puck
    else if (up > 0.05 && sideSg === 1) toW(r, 1.5 + 0.7*up, 2.8 + 2.2*up, 1.2 + 0.4*up, _h1);           // glove save
    else toW(r, 1.5 + b*0.4, 2.8 - b*0.6 + Math.sin(t*2)*0.1, 1.2, _h1);
    if (up > 0.05 && sideSg === -1) toW(r, -1.6 - 0.6*up, 2.7 + 1.9*up, 1.3, _h2);                         // blocker save
    dirW(r, 1, -1, -0.6, _pl); dirW(r, -1, -1, -0.6, _pr);
    ik2(B.upArmL, B.foreArmL, 0.95*sc, 0.95*sc, _h1, _pl);
    ik2(B.upArmR, B.foreArmR, 0.95*sc, 0.95*sc, _h2, _pr);
  }

  // ------------------------------------------------ snow spray
  function emitSnow(x, y, vx, vy, n){
    for (let i=0;i<n && snow.length<SNOW_MAX;i++){ const a = Math.atan2(vy, vx) + (Math.random()-0.5)*1.6, sp = 8 + Math.random()*18; snow.push({ x:x - CX, y:0.3, z:y - RL/2, vx:Math.cos(a)*sp, vy:3 + Math.random()*6, vz:Math.sin(a)*sp, life:0.5 + Math.random()*0.5, max:1, s:0.12 + Math.random()*0.16 }); }
  }

  // ------------------------------------------------ post
  let post = null, bloomNode = null;
  const vignetteU = uniform(1);
  const texelU = uniform(new THREE.Vector2(1/1000, 1/1000)), shakeU = uniform(0);
  function buildPost(){
    post = post || new THREE.PostProcessing(renderer);
    const sp = pass(scene, cam);
    const tex = sp.getTextureNode('output');
    // chromatic ink bleed that pulses with big hits
    const off = vec2(texelU.x.mul(shakeU.mul(3.5)), texelU.y.mul(shakeU.mul(1.5)));
    const cR = tex.sample(screenUV.add(off)).r, cB = tex.sample(screenUV.sub(off)).b;
    let col = vec3(cR, tex.g, cB);
    // screen-space ink: darken strong luminance steps like a printed page
    const L = q => { const l = luminance(tex.sample(q).rgb); return l.div(l.add(1)); };
    const o = texelU.mul(1.35);
    const edge = tAbs(L(screenUV.add(vec2(o.x, 0))).sub(L(screenUV.sub(vec2(o.x, 0))))).add(tAbs(L(screenUV.add(vec2(0, o.y))).sub(L(screenUV.sub(vec2(0, o.y))))));
    col = col.mul(oneMinus(smoothstep(0.07, 0.2, edge).mul(0.6)));
    if (R3.tier !== 'low') { bloomNode = bloomFn(tex, 0.4, 0.35, 0.9); col = col.add(bloomNode.rgb); } else bloomNode = null;
    // newsprint halftone: faint dots that grow in the darks
    const lc = luminance(col); const lcn = lc.div(lc.add(1));
    const hs = screenCoordinate.xy.div(4.2), hr = vec2(hs.x.add(hs.y), hs.x.sub(hs.y)).mul(0.7071);
    const hd = step(length(fract(hr).sub(0.5)), oneMinus(lcn).mul(0.5));
    col = col.mul(oneMinus(hd.mul(0.08)));
    const d = length(screenUV.sub(0.5));
    const vig = oneMinus(smoothstep(0.38, 0.9, d).mul(0.3).mul(vignetteU));
    post.outputNode = vec4(col.mul(vig), 1);
    post.needsUpdate = true;
  }


  // ------------------------------------------------ tiers
  const TIERS = { low:{ dpr:1.5, shadow:1024, crowd:800, pk:10 }, med:{ dpr:2, shadow:2048, crowd:2500, pk:14 }, high:{ dpr:2, shadow:2048, crowd:6000, pk:18 } };
  let autoTier = null; try { autoTier = localStorage.getItem('rinkrat-gfx-auto'); } catch(e) {}
  function pickTier(){ if (R3.pref === 'low' || R3.pref === 'med' || R3.pref === 'high') return R3.pref; if (autoTier && TIERS[autoTier]) return autoTier; return isTouch ? 'med' : 'high'; }
  let curDims = [0, 0, 0];
  function applyTier(t){
    R3.tier = t; const T = TIERS[t];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, T.dpr)); curDims = [0,0,0];
    key.shadow.mapSize.set(T.shadow, T.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; }
    setCrowdCount(T.crowd);
    ice.material = iceMaterial(t);
    for (const m of Object.values(iceMats)) if (m.userData.reflTarget) m.userData.reflTarget.visible = m === ice.material;
    if (!paintLocked) { k = T.pk; paintLocked = true; }
    buildPost();
    perf.n = 0; perf.sum = 0; perf.skip = 90;
    if (lastG && !lastG.attract) checkPlan.push(performance.now() + 1500);
    if (S.on3DStatus) S.on3DStatus();
  }
  const perf = { n:0, sum:0, skip:90 };
  R3.setPref = p => {
    R3.pref = p;
    if (p === 'classic') { R3.active = false; canvas.hidden = true; return; }
    canvas.hidden = false; R3.active = R3.ok;
    applyTier(pickTier());
  };

  // ------------------------------------------------ camera
  const camS = { px:0, py:110, pz:170, vx:0, vy:0, vz:0, tx:0, ty:0, tz:0, wx:0, wy:0, wz:0 };
  let orbitA = 0, goalT = -1, goalTeam = null, aspect = 1;
  function spring(cur, vel, target, k, dt){ const c = 2*Math.sqrt(k); const a = k*(target - cur) - c*vel; vel += a*dt; return [cur + vel*dt, vel]; }
  const _cf = new THREE.Vector3(), _cr = new THREE.Vector3();
  let camCut = false;
  function updateCamera(G, dt){
    const P = G.pucks[0];
    let tx, ty = 0, tz, px, py, pz;
    const fx = P.x - CX, fz = P.y - RL/2;
    // lean toward the human players (both of them in two-player games)
    let hx = 0, hz = 0, hn = 0;
    if (!G.attract) for (let p = 0; p < S.humans(); p++) { const h = S.humanSk(p); if (h && h.ko <= 0) { hx += h.x - CX; hz += h.y - RL/2; hn++; } }
    const focusX = hn ? fx*0.75 + hx/hn*0.25 : fx, focusZ = hn ? fz*0.78 + hz/hn*0.22 : fz;
    if (G.attract) {
      // stays over the ice and above the lower seats, so the stands never block the view
      orbitA += dt*0.07; const R = 70;
      tx = 0; ty = 2; tz = 0; px = Math.sin(orbitA)*R; py = 26; pz = Math.cos(orbitA)*R*1.25;
      cam.fov = 40;
    } else if (aspect < 1.05) {
      const pitch = 48*Math.PI/180; cam.fov = 44;
      const halfW = 24, tanH = Math.tan(cam.fov*Math.PI/360)*aspect;
      const d = Math.min(150, Math.max(70, halfW/tanH));
      tx = Math.max(-16, Math.min(16, focusX*0.45)); tz = Math.max(-62, Math.min(58, focusZ - 4 - P.vy*0.12));
      px = tx; py = d*Math.sin(pitch); pz = tz + d*Math.cos(pitch);
    } else {
      // pitch must stay steeper than the seating rake (~33 deg) so the near stands never block the view
      const pitch = 37*Math.PI/180; cam.fov = 30;
      const halfW = 58, tanH = Math.tan(cam.fov*Math.PI/360)*aspect;
      const d = Math.min(200, Math.max(90, halfW/tanH));
      tx = Math.max(-14, Math.min(14, focusX*0.3)) - 4; tz = Math.max(-58, Math.min(58, focusZ + P.vy*0.15));
      px = tx + d*Math.cos(pitch); py = d*Math.sin(pitch); pz = tz;
    }
    // instant replay: a low camera by the net that scored, following the puck
    const rv = S.replayView && S.replayView();
    if (rv && !G.attract) {
      const gz = (rv.team === 'home' ? GT : GB) - RL/2, dir = rv.team === 'home' ? 1 : -1, side = rv.x >= CX ? 1 : -1;
      px = side*26; py = 7.5; pz = gz + dir*24; tx = (rv.x - CX)*0.7; ty = 2.2; tz = (rv.y - RL/2)*0.75 + gz*0.25; cam.fov = 44; goalT = -1;
    }
    if (goalT >= 0) {
      goalT += dt; const f = goalT < 0.4 ? goalT/0.4 : goalT < 1.9 ? 1 : Math.max(0, 1 - (goalT - 1.9)/0.8);
      const ez = goalTeam === 'home' ? GT - RL/2 : GB - RL/2, e = f*f*(3 - 2*f);
      tx += (0 - tx)*e; tz += (ez - tz)*e;
      px += (tx - px)*0.38*e; py += (ty - py)*0.38*e + 0; pz += (tz - pz)*0.38*e;
      if (goalT > 2.8) goalT = -1;
    }
    const kk = G.attract ? 6 : rv ? 14 : 26;
    if (camCut) { camCut = false; Object.assign(camS, { tx, ty, tz, px, py, pz, wx:0, wy:0, wz:0, vx:0, vy:0, vz:0 }); }
    [camS.tx, camS.wx] = spring(camS.tx, camS.wx, tx, kk, dt); [camS.ty, camS.wy] = spring(camS.ty, camS.wy, ty, kk, dt); [camS.tz, camS.wz] = spring(camS.tz, camS.wz, tz, kk, dt);
    [camS.px, camS.vx] = spring(camS.px, camS.vx, px, kk, dt); [camS.py, camS.vy] = spring(camS.py, camS.vy, py, kk, dt); [camS.pz, camS.vz] = spring(camS.pz, camS.vz, pz, kk, dt);
    const sh = (G.shake || 0)*0.7;
    cam.position.set(camS.px + (Math.random()-0.5)*sh, camS.py + (Math.random()-0.5)*sh, camS.pz + (Math.random()-0.5)*sh);
    cam.lookAt(camS.tx, camS.ty, camS.tz);
    if (DEBUG && R3.debugCam) { const d = R3.debugCam(); cam.position.set(...d.p); cam.lookAt(...d.t); if (d.fov) cam.fov = d.fov; }
    cam.updateProjectionMatrix();
    // input basis (screen right / screen up on the ice, in sim coords)
    cam.updateMatrixWorld();
    _cr.setFromMatrixColumn(cam.matrixWorld, 0); _cr.y = 0; _cr.normalize();
    _cf.set(0, 0, -1).applyQuaternion(cam.quaternion); _cf.y = 0; _cf.normalize();
    R3.basis = { rx:_cr.x, ry:_cr.z, fx:_cf.x, fy:_cf.z };
    // shadow camera follows the view
    key.position.set(camS.tx + 22, 150, camS.tz + 30); key.target.position.set(camS.tx, 0, camS.tz); key.target.updateMatrixWorld();
  }
  const _pv = new THREE.Vector3(), _dbs = new THREE.Vector2(), _ctr = new THREE.Vector3();
  R3.project = (x, y, h) => { _pv.set(x - CX, h, y - RL/2).project(cam); return [(_pv.x + 1)/2*R3.cw, (1 - _pv.y)/2*R3.ch, _pv.z < 1]; };

  // ------------------------------------------------ per-match sync
  let lastG = null, lastTheme = null, prevScore = { home:0, away:0 }, prevState = null, cheer = 0, stand = 0, cheerA = 0, standA = 0, frameN = 0;
  async function onNewMatch(G){
    lastG = G;
    if (!G.attract) { checkPlan = [2500, 8000, 20000].map(ms => performance.now() + ms); }
    if (G.ch.id !== lastTheme) { lastTheme = G.ch.id; drawBoardAds(G); recolorCrowd(G); buildEnv(ACCENT[G.ch.id] || '#ffb51e').catch(() => {}); scene.fog.color.set(0x06070a); }
    paintIce(G); resetScuff(G); buildHazards(G); buildPlayers(G);
    for (const [, e] of crates) dyn.remove(e); crates.clear();
    for (const [, e] of traps) dyn.remove(e); traps.clear();
    for (const [, e] of walls) dyn.remove(e); walls.clear();
    for (const [, e] of bolts) { dyn.remove(e); e.geometry.dispose(); } bolts.clear();
    for (const [, e] of beams) dyn.remove(e); beams.clear();
    prevScore = { ...G.score }; prevState = G.state; goalT = -1; jumboKey = '';
  }
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();
  const _pe = new THREE.Euler();
  const colorCache = new Map(); const colOf = s => { let c = colorCache.get(s); if (!c) { c = new THREE.Color(s); colorCache.set(s, c); } return c; };
  const lastPos = new Map();

  // ------------------------------------------------ self-check: catch static/black output and fall back
  let checkPlan = [], checking = false, recovering = false, pendingFail = false;
  async function selfCheck(){
    checking = true;
    try {
      const Wd = 128, Ht = 224, rt = new THREE.RenderTarget(Wd, Ht);
      renderer.setRenderTarget(rt); post.render(); renderer.setRenderTarget(null);
      const px = await renderer.readRenderTargetPixelsAsync(rt, 0, 0, Wd, Ht); rt.dispose();
      let diff = 0, lum = 0, n = 0;
      for (let y = Math.floor(Ht*0.3); y < Math.floor(Ht*0.75); y++) for (let x = 12; x < Wd - 13; x++) {
        const i = (y*Wd + x)*4, j = i + 4, q = i + Wd*4;
        const a = px[i] + px[i+1] + px[i+2], b = px[j] + px[j+1] + px[j+2], c = px[q] + px[q+1] + px[q+2];
        diff += Math.abs(a - b) + Math.abs(a - c); lum += a; n++;
      }
      const noise = diff/n/6, L = lum/n/3;
      R3.lastCheck = { noise: Math.round(noise*10)/10, lum: Math.round(L), engine, tier: R3.tier };
      const bad = !(noise < 65) || !(L > 50);
      if (bad && !(DEBUG && R3.debugCam)) {
        if (pendingFail) { pendingFail = false; R3.recover('self-check ' + JSON.stringify(R3.lastCheck)); }
        else { pendingFail = true; checkPlan.unshift(performance.now() + 1200); }
      } else pendingFail = false;
    } catch (e) { console.warn('[3D] self-check skipped:', e); }
    checking = false;
  }
  R3.recover = why => {
    if (recovering) return; recovering = true;
    console.warn('[3D] output problem (' + why + '), engine ' + engine + ', tier ' + R3.tier);
    if (why !== 'device lost' && R3.tier !== 'low') { applyTier('low'); recovering = false; if (S.notice) S.notice('Lowered graphics quality to keep the 3D view working.'); return; }
    if (engine === 'webgpu') { try { localStorage.setItem('rinkrat-gfx-engine', 'webgl'); } catch(e) {} if (S.notice) S.notice('Switched the 3D engine to WebGL2.'); R3.restart(); return; }
    R3.active = false; R3.status = 'failed'; canvas.hidden = true;
    if (S.forceClassic) S.forceClassic('3D had trouble on this device, so the game switched to the classic view.');
  };
  R3.frame = (dt, tms) => {
    const G = S.G; if (!G) return;
    if (G !== lastG) onNewMatch(G);
    frameN++;
    const t = G.time, P = G.pucks[0];
    // sizing
    const cw = R3.cw = S.stageW(), ch = R3.ch = S.stageH(), dpr = renderer.getPixelRatio();
    if (curDims[0] !== cw || curDims[1] !== ch || curDims[2] !== dpr) { renderer.setSize(cw, ch, false); curDims = [cw, ch, dpr]; aspect = cw/ch; cam.aspect = aspect; }
    // events
    if (G.score.home > prevScore.home || G.score.away > prevScore.away) {
      goalTeam = G.score.home > prevScore.home ? 'home' : 'away'; goalT = 0;
      const net = nets.find(n => n.team !== goalTeam); if (net) net.ripple = 1;
      goalPoint.position.set(0, 14, (goalTeam === 'home' ? GT : GB) - RL/2 + (goalTeam === 'home' ? -10 : 10));
      for (const [s, r] of rigs) if (s.team === goalTeam) r.v.cele = 2.6;
      if (!G.attract) { if (goalTeam === 'home') { cheer = 1; stand = 1; } else { cheerA = 1; standA = 1; } }
    }
    prevScore = { home:G.score.home, away:G.score.away };
    if (G.state === 'faceoff' && prevState !== 'faceoff') { /* players blend in via teleport smoothing */ }
    prevState = G.state;
    cheer = Math.max(0, cheer - dt*0.3); stand = Math.max(0, stand - dt*0.35); cheerA = Math.max(0, cheerA - dt*0.3); standA = Math.max(0, standA - dt*0.35);
    cheerU.value = cheer; standU.value = stand; cheerAU.value = cheerA; standAU.value = standA;
    // goal lights
    for (const n of nets) {
      const lit = goalT >= 0 && goalT < 3 && n.team !== goalTeam;
      n.domeU.value = lit ? (S.reducedMotion() ? 0.85 : 0.6 + 0.4*Math.sin(t*14)) : 0.05;
      if (n.ripple > 0) { n.ripple = Math.max(0, n.ripple - dt*0.8); const r = n.ripple; n.mesh.scale.set(1 + Math.sin(t*30)*0.04*r, 1 + Math.sin(t*25)*0.03*r, 1 + r*0.12 + Math.sin(t*22)*0.05*r); }
    }
    goalPoint.intensity = goalT >= 0 && goalT < 3 ? 900*(0.6 + 0.4*Math.sin(t*14)) : 0;
    jumboFlash.value = goalT >= 0 && goalT < 2.5 ? (Math.sin(t*16) > 0 ? 1 : 0) : 0;
    if (bloomNode) bloomNode.strength.value = 0.45 + (goalT >= 0 && goalT < 1.2 ? 0.5*(1 - goalT/1.2) : 0);
    drawJumbo(G);
    snowU.value = 0.15 + (G.ch.len > 0 ? Math.min(1, Math.max(0, 1 - G.clock/G.ch.len)) : 0.4)*0.9;
    // hazards
    for (const h of hz.holes) { const f = (t*0.6) % 1; h.rip.scale.setScalar(0.5 + f*h.o.r*0.9); h.rip.material.opacity = 0.45*(1 - f);
      const fr = h.o.frozen > 0 ? Math.min(1, h.o.frozen/2.5, (20 - h.o.frozen)/0.6) : 0; h.cap.visible = fr > 0.01; h.cap.material.opacity = 0.92*fr; h.rip.visible = fr < 0.5; }
    for (const v of hz.vents) { const ph = v.v.t % 5.5, warn = ph > 3.1 && ph <= 4.4; v.gU.value = v.v.on ? 1.3 : warn ? (0.4 + 0.4*Math.sin(t*16))*((ph-3.1)/1.3) : 0.04; v.flames.visible = v.v.on; if (v.v.on) { v.flames.scale.set(1, 0.65 + Math.random()*0.6, 1); v.flames.rotation.y = t*3; } }
    for (const sl of hz.slime) { const cl = sl.p.clean > 0 ? Math.min(1, sl.p.clean/2, (20 - sl.p.clean)/0.8) : 0, k = 1 - 0.92*cl; sl.g.scale.set(k, 1, k); }
    for (const sl of hz.slime) sl.bubbles.forEach((b, i) => { const f = ((t*0.7 + i*0.37) % 1); b.position.set(Math.cos(sl.p.ph + i*1.6)*sl.p.r*0.4, 0.1 + f*0.25, Math.sin(sl.p.ph + i*1.6)*sl.p.r*0.4); b.scale.setScalar(0.3 + f*0.9); });
    for (const w of hz.wells) w.g.rotation.y = -t*0.5;
    for (const sw of hz.saws) { W(sw.w.x, sw.w.y, 0.9, sw.g.position); sw.blade.rotation.z = -sw.w.a*sw.w.dir; }
    syncMines(G, t);
    syncZam(G, t, dt);
    // crates
    { const seen = new Set(); for (const c of G.crates) { seen.add(c); let m = crates.get(c); if (!m) { m = new THREE.Group(); const b = new THREE.Mesh(crateGeo, crateMat); b.castShadow = true; const bh = new THREE.Mesh(crateGeo, inkHullMat); bh.scale.setScalar(1.13); m.add(bh); const top = new THREE.Mesh(crateTop, crateEdge); m.add(b, top); dyn.add(m); crates.set(c, m); } W(c.x, c.y, 1.4 + Math.sin(c.t*3)*0.35, m.position); m.rotation.y = c.t*1.3; m.visible = !(c.life < 3 && Math.floor(c.t*8) % 2); } for (const [c, m] of crates) if (!seen.has(c)) { dyn.remove(m); crates.delete(c); } }
    { const seen = new Set(); for (const tr of G.traps) { seen.add(tr); let m = traps.get(tr); if (!m) { m = new THREE.Mesh(new THREE.CircleGeometry(tr.r, 32), slickMat.clone()); m.rotation.x = -Math.PI/2; dyn.add(m); traps.set(tr, m); } W(tr.x, tr.y, 0.1, m.position); m.material.opacity = Math.min(1, tr.life/2); } for (const [tr, m] of traps) if (!seen.has(tr)) { dyn.remove(m); m.geometry.dispose(); traps.delete(tr); } }
    { const seen = new Set(); for (const w of G.walls) { seen.add(w); let m = walls.get(w); if (!m) { m = new THREE.Mesh(new THREE.BoxGeometry(w.x2 - w.x1, 4, 1.3), wallMat); m.castShadow = true; dyn.add(m); walls.set(w, m); } W((w.x1 + w.x2)/2, w.y, 2, m.position); m.scale.y = Math.min(1, w.life/0.8, (w.max - w.life)/0.3 + 0.05); } for (const [w, m] of walls) if (!seen.has(w)) { dyn.remove(m); m.geometry.dispose(); walls.delete(w); } }
    // players
    for (const [s, r] of rigs) { r.v.cele = Math.max(0, r.v.cele - dt); poseSkater(r, s, dt, t, G, P); }
    poseGoalie(goalieRigs.home, G.gH, dt, t, G, P); poseGoalie(goalieRigs.away, G.gA, dt, t, G, P);
    // scuffs
    for (const s of G.sk) {
      if (s.ko > 0 || s.frozen > 0) { lastPos.delete(s); continue; }
      const lp = lastPos.get(s); const sp = Math.hypot(s.vx, s.vy);
      if (lp && Math.hypot(s.x - lp[0], s.y - lp[1]) > 0.6) {
        const nx = -Math.sin(s.face), ny = Math.cos(s.face), a = 0.035 + Math.min(0.08, sp/600);
        for (const o of [-0.45, 0.45]) scuffLine(lp[0] + nx*o, lp[1] + ny*o, s.x + nx*o, s.y + ny*o, 0.22, a);
        lastPos.set(s, [s.x, s.y]);
      } else if (!lp) lastPos.set(s, [s.x, s.y]);
    }
    if (frameN % 3 === 0) scuffTex.needsUpdate = true;
    // pucks: carried pucks ride the blade; state changes blend instead of snapping
    pucks.forEach((m, i) => {
      const Q = G.pucks[i], ud = m.userData, rb = ribbons[i];
      m.visible = !!Q && !Q.sunk && !Q.hold && !Q.ref;
      if (!m.visible) { ud.init = false; ud.hist = []; rb.visible = false; return; }
      const sp = Math.hypot(Q.vx, Q.vy);
      let tx, tz, mode = 'loose';
      if (Q.owner) mode = 'own';   // the sim keeps the carried puck on the blade
      if (tx === undefined) { tx = Q.x - CX; tz = Q.y - RL/2; }
      const key = mode + (Q.owner ? Q.owner.team + Q.owner.idx : '');
      if (!ud.init || Math.hypot(tx - ud.x, tz - ud.z) > 14) { ud.x = tx; ud.z = tz; ud.init = true; ud.blend = 0; ud.key = key; ud.hist = []; }
      if (key !== ud.key) { ud.key = key; ud.blend = 0.14; }
      let kk = 0;
      if (ud.blend > 0) { ud.blend -= dt; kk = 30; }
      if (kk) { const f = 1 - Math.exp(-dt*kk); ud.x += (tx - ud.x)*f; ud.z += (tz - ud.z)*f; } else { ud.x = tx; ud.z = tz; }
      // lift on hard shots, then fall back to the ice under gravity
      const liftT = !Q.owner && Q.shotBy && sp > 45 ? Math.min(2.2, (sp - 45)/30) : 0;
      if (liftT > ud.lift) { ud.lift += (liftT - ud.lift)*Math.min(1, dt*12); ud.lv = 0; }
      else { ud.lv = (ud.lv || 0) - 34*dt; ud.lift = Math.max(liftT, ud.lift + ud.lv*dt); if (ud.lift <= liftT) ud.lv = 0; }
      m.position.set(ud.x, 0.13 + ud.lift, ud.z);
      m.rotation.y += Math.min(sp, 120)*dt*0.25;
      m.rotation.x = ud.lift > 0.05 ? Math.sin(t*23)*0.12*Math.min(1, ud.lift) : 0;
      ud.fire.visible = Q.fire > 0; if (Q.fire > 0) ud.fire.scale.setScalar(1.4 + Math.random()*0.5);
      ud.halo.visible = Q.homing > 0 || !!Q.bonus;
      // ribbon trail from the rendered positions
      const fast = !Q.owner && (sp > 30 || Q.fire > 0);
      if (fast) { ud.hist.unshift([ud.x, 0.16 + ud.lift*0.9, ud.z]); if (ud.hist.length > TRAIL_N) ud.hist.length = TRAIL_N; }
      else if (ud.hist.length) ud.hist.splice(-2, 2);
      const h = ud.hist, n = h.length; rb.visible = n > 2;
      if (n > 2) {   // comic action streak: black ink edge with a bright cel core
        const c = Q.fire > 0 ? [4.2, 2.6, 0.5] : (Q.homing > 0 || Q.bonus) ? [0.7, 2.8, 3.2] : [1.6, 1.55, 1.4];
        const wmax = Q.fire > 0 ? 0.8 : 0.5;
        fillRibbon(rb.ink, h, n, wmax*1.55, [0.03, 0.02, 0.04], 0.85);
        fillRibbon(rb.core, h, n, wmax*0.75, c, 0.95);
      }
    });
    // particles from the sim
    { let n = 0; for (const p of G.parts) { if (n >= PART_MAX) break; const k2 = 1 - p.life/p.max; tmpM.compose(W(p.x, p.y, 0.6 + Math.sin(k2*Math.PI)*3.5*(p.s > 0.6 ? 1 : 0.5), tmpV), tmpQ.setFromEuler(_pe.set(n*1.7, Math.atan2(p.vx, p.vy) + n*0.3, n*2.3)), tmpS.setScalar(p.s*0.6*(1 - k2*0.6))); partMesh.setMatrixAt(n, tmpM); partMesh.setColorAt(n, colOf(p.c)); n++; } partMesh.count = n; partMesh.instanceMatrix.needsUpdate = true; partMesh.instanceColor.needsUpdate = true; }
    // snow
    { let n = 0; for (let i=snow.length-1;i>=0;i--){ const p = snow[i]; p.life -= dt; if (p.life <= 0 || p.y < 0) { snow.splice(i,1); continue; } p.vy -= 22*dt; p.x += p.vx*dt; p.y += p.vy*dt; p.z += p.vz*dt; p.vx *= 0.96; p.vz *= 0.96; } for (const p of snow) { tmpM.compose(tmpV.set(p.x, p.y, p.z), tmpQ.identity(), tmpS.setScalar(p.s*Math.min(1, p.life*3))); snowMesh.setMatrixAt(n++, tmpM); } snowMesh.count = n; snowMesh.instanceMatrix.needsUpdate = true; }
    { let n = 0; for (let i=sparks.length-1;i>=0;i--){ const p = sparks[i]; p.life -= dt; if (p.life <= 0) { sparks.splice(i,1); continue; } p.vy -= 30*dt; p.x += p.vx*dt; p.y = Math.max(0.05, p.y + p.vy*dt); p.z += p.vz*dt; }
      for (const p of sparks) { tmpM.compose(tmpV.set(p.x, p.y, p.z), tmpQ.setFromEuler(_pe.set(0, Math.atan2(p.vx, p.vz) - Math.PI/2, Math.atan2(p.vy, Math.hypot(p.vx, p.vz)))), tmpS.setScalar(p.s*Math.min(1, p.life*4))); sparkMesh.setMatrixAt(n++, tmpM); }
      sparkMesh.count = n; sparkMesh.instanceMatrix.needsUpdate = true; }
    // rings, bolts, beams
    ringPool.forEach((r, i) => { const g = G.rings[i]; r.visible = !!g; if (!g) return; const k2 = 1 - g.life/g.max; W(g.x, g.y, 0.2, r.position); r.scale.setScalar(Math.max(0.01, g.R*k2)); r.material.color.copy(colOf(g.c)).multiplyScalar(2.5); r.material.opacity = 1 - k2; });
    { const seen = new Set(); for (const b of G.bolts) { seen.add(b); let m = bolts.get(b); if (!m) { const pts = b.seg.map(([x, y]) => new THREE.Vector3(b.x + x - CX, -y*1.6, b.y - RL/2)); m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.1), 24, 0.35, 5), boltMat); dyn.add(m); bolts.set(b, m); } m.visible = Math.random() > 0.15; } for (const [b, m] of bolts) if (!seen.has(b)) { dyn.remove(m); m.geometry.dispose(); bolts.delete(b); } }
    { const seen = new Set(); for (const b of G.beams) { seen.add(b); let m = beams.get(b); if (!m) { const a = W(b.x1, b.y1, 3), c2 = W(b.x2, b.y2, 3); const len = a.distanceTo(c2); m = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, len, 6), new THREE.MeshBasicNodeMaterial({ color:new THREE.Color(0.8, 3.5, 4) })); m.position.copy(a).add(c2).multiplyScalar(0.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), c2.clone().sub(a).normalize()); dyn.add(m); beams.set(b, m); } } for (const [b, m] of beams) if (!seen.has(b)) { dyn.remove(m); m.geometry.dispose(); beams.delete(b); } }
    // stars over KO'd and stunned players, blob shadows
    { let n = 0, bn = 0;
      const blob = (x, y, sz) => { if (bn >= 16) return; tmpM.compose(W(x, y, 0.03, tmpV), tmpQ.identity(), tmpS.set(sz, 1, sz)); blobMesh.setMatrixAt(bn++, tmpM); };
      for (const s of G.sk) {
        blob(s.x, s.y, s.ko > 0 ? 7 : 5.2*(s.r/(s.baseR||2.6)));
        if ((s.ko > 0 || (s.stun > 0 && s.frozen <= 0)) && n < 37) for (let i=0;i<3;i++){ const a = t*5 + i*2.1 + s.idx; const h = s.ko > 0 ? 1.7 : 7, kx = s.ko > 0 ? s.x - Math.cos(s.face)*2.6 : s.x, ky = s.ko > 0 ? s.y - Math.sin(s.face)*2.6 : s.y; tmpM.compose(W(kx + Math.cos(a)*1.4, ky + Math.sin(a)*1.4, h + Math.sin(a*2)*0.3, tmpV), tmpQ.setFromEuler(new THREE.Euler(t*4, t*3, 0)), tmpS.setScalar(1)); starMesh.setMatrixAt(n++, tmpM); }
      }
      for (const g of [G.gH, G.gA]) { if (g.off) continue; blob(g.x, g.y, 6.5*(g.r/S.C.G_R)); if (g.stun > 0 && n < 37) for (let i=0;i<3;i++){ const a = t*5 + i*2.1; tmpM.compose(W(g.x + Math.cos(a)*1.8, g.y + Math.sin(a)*1.8, 2.4, tmpV), tmpQ.identity(), tmpS.setScalar(1)); starMesh.setMatrixAt(n++, tmpM); } }
      for (const Q of G.pucks) if (!Q.sunk && !Q.hold && !Q.ref) blob(Q.x, Q.y, 1.6);
      starMesh.count = n; starMesh.instanceMatrix.needsUpdate = true; blobMesh.count = bn; blobMesh.instanceMatrix.needsUpdate = true; }
    // control ring, charge ring, aim line for each human player
    humanFx.forEach((fx, p) => {
      const cs = !G.attract && p < S.humans() ? S.humanSk(p) : null;
      fx.ring.visible = !!cs && cs.ko <= 0;
      if (fx.ring.visible) { const r = rigs.get(cs); W(cs.x, cs.y, 0.06, fx.ring.position); if (r) { fx.ring.position.x = r.v.x; fx.ring.position.z = r.v.z; } fx.ring.scale.setScalar((cs.r/(cs.baseR||2.6))*(1 + Math.sin(t*5 + p)*0.04)); }
      const chg = cs ? (cs.charging ? cs.charge : (cs.wind || 0)) : 0;
      fx.charge.visible = !!cs && (cs.charging || cs.wind > 0); fx.aim.visible = fx.charge.visible && P.owner === cs;
      if (fx.charge.visible) { fx.charge.position.copy(fx.ring.position); fx.charge.position.y = 0.07; fx.chargeU.value = chg; }
      if (fx.aim.visible) { const a = cs.charging ? S.aimAngle(cs) : cs.windAim, len = 10 + chg*14; W(P.x, P.y, 0.08, fx.aim.position); fx.aim.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a)); fx.aim.scale.set(1, 1, len); fx.aimTex.repeat.set(1, len/2.2); }
    });
    if (R3.cut) {   // replay start/end: snap everything instead of gliding
      R3.cut = false; camCut = true;
      for (const r of rigs.values()) { r.v.init = false; r.v.ox = r.v.oz = 0; }
      if (goalieRigs) for (const r of Object.values(goalieRigs)) { r.v.init = false; r.v.ox = r.v.oz = 0; }
      pucks.forEach(m => { m.userData.init = false; m.userData.hist = []; });
    }
    updateCamera(G, dt);
    { const db = renderer.getDrawingBufferSize(_dbs); texelU.value.set(1/Math.max(1, db.x), 1/Math.max(1, db.y)); }
    shakeU.value = S.reducedMotion() ? 0 : Math.min(1.6, (G.shake || 0) + (goalT >= 0 && goalT < 0.8 ? 0.8*(1 - goalT/0.8) : 0));
    outlineW.value = Math.min(0.42, Math.max(0.05, cam.position.distanceTo(_ctr.set(camS.tx, camS.ty, camS.tz))*0.0021));
    post.render();
    if (checkPlan.length && !checking && performance.now() > checkPlan[0]) { checkPlan.shift(); selfCheck(); }
    // perf monitor for auto tier
    if (R3.pref === 'auto') {
      if (perf.skip > 0) perf.skip--; else { perf.sum += dt; perf.n++; if (perf.n >= 120) { const avg = perf.sum/perf.n; perf.n = 0; perf.sum = 0; if (avg > 0.026 && R3.tier !== 'low') { const nt = R3.tier === 'high' ? 'med' : 'low'; autoTier = nt; try { localStorage.setItem('rinkrat-gfx-auto', nt); } catch(e) {} applyTier(nt); } } }
    }
  };

  // ------------------------------------------------ go
  if (document.fonts && document.fonts.ready) { try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch(e) {} }
  const G0 = S.G; if (G0) { lastG = null; }
  k = TIERS[pickTier()].pk; paintLocked = true;
  paintIce(S.G);
  applyTier(pickTier());
  if (S.G) await onNewMatch(S.G);
  await buildEnv(ACCENT[S.G ? S.G.ch.id : 'boneyard']);
  R3.ok = true; R3.status = backend; R3.backend = backend;
  R3.pref = S.gfxPref();
  if (R3.pref === 'classic') { R3.active = false; canvas.hidden = true; }
  else { if (pickTier() !== R3.tier) applyTier(pickTier()); R3.active = true; canvas.hidden = false; }
  if (S.on3DStatus) S.on3DStatus();
}
})();
