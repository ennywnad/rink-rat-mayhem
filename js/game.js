// Rink Rat Mayhem: game simulation, menus, input and the classic 2D view
(() => {
'use strict';
const $ = id => document.getElementById(id);
const cv = $('rink'), ctx = cv.getContext('2d'), stage = $('stage'), app = $('app');

// ---------------- geometry (feet, NHL proportions)
const RW = 85, RL = 200, CR = 24, CX = 42.5, GT = 11, GB = 189, PL = 38.5, PRt = 46.5, ND = 3.6;
const PUCK_R = 1.0, SK_R = 2.6, G_R = 2.5;
const NET = [[PL,GT,PL,GT-ND],[PRt,GT,PRt,GT-ND],[PL,GT-ND,PRt,GT-ND],[PL,GB,PL,GB+ND],[PRt,GB,PRt,GB+ND],[PL,GB+ND,PRt,GB+ND]];
const NET_SK = NET.concat([[PL,GT,PRt,GT],[PL,GB,PRt,GB]]);

const clamp = (v,a,b) => v<a?a:v>b?b:v;
const rand = (a,b) => a + Math.random()*(b-a);
const pick = a => a[Math.floor(Math.random()*a.length)];
const angDiff = (a,b) => { let d=a-b; while(d>Math.PI)d-=2*Math.PI; while(d<-Math.PI)d+=2*Math.PI; return d; };
const turn = (c,w,m) => c + clamp(angDiff(w,c),-m,m);
const hyp = Math.hypot;

// ---------------- content
const ICON = {
  rocket:'<path d="M12 2c3.2 2.2 4.5 6 4.3 10.2L14.5 15h-5l-1.8-2.8C7.5 8 8.8 4.2 12 2z"/><circle cx="12" cy="8.5" r="1.6"/><path d="M10 17.5l-1.5 3.5M14 17.5l1.5 3.5M12 18v4"/>',
  slick:'<path d="M12 3c-3 4-5 6.2-5 9a5 5 0 0 0 10 0c0-2.8-2-5-5-9z"/><path d="M3 20.5c3 0 3-1.5 6-1.5s3 1.5 6 1.5 3-1.5 6-1.5"/>',
  fireball:'<circle cx="15" cy="15" r="5"/><path d="M11 11L3 3M10 15H2M12 19l-6 3M15 10V2"/>',
  mine:'<circle cx="12" cy="13" r="5.5"/><path d="M12 3.5v4M12 18.5v3M2.5 13h4M17.5 13h4M5 6l2.8 2.8M19 6l-2.8 2.8"/><circle cx="12" cy="13" r="1.2" fill="currentColor"/>',
  magnet:'<path d="M5 3h4.5v8.5a2.5 2.5 0 0 0 5 0V3H19v8.5a7 7 0 0 1-14 0z"/><path d="M5 7h4.5M14.5 7H19"/>',
  shrink:'<path d="M3 3l7 7M10 4.5V10H4.5M21 21l-7-7M14 19.5V14h5.5"/>',
  wall:'<rect x="2.5" y="6" width="19" height="12" rx="1"/><path d="M2.5 12h19M8.5 6v6M15.5 12v6M12 6v0"/>',
  homing:'<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4"/>',
  kaiju:'<path d="M5.5 21.5c0-6.5 2.6-10 6.5-10s6.5 3.5 6.5 10z"/><path d="M4 9.5l1.5-4 2 3.5M10 7l2-5 2 5M16.5 9l2-3.5 1.5 4"/>',
  triple:'<circle cx="4.5" cy="19.5" r="2"/><circle cx="19.5" cy="4.5" r="2"/><circle cx="20.5" cy="13" r="2"/><circle cx="11" cy="3.5" r="2"/><path d="M6 18L18 6M6.3 18.5l12.4-4.6M5.5 17.8L10.2 5.4" stroke-dasharray="2 2"/>',
  lightning:'<path d="M13.5 2L4.5 13.5h6.5L9.5 22l10-12h-6.5z"/>',
  freeze:'<path d="M12 2v20M3.3 7l17.4 10M3.3 17L20.7 7M9 3.5l3 3 3-3M9 20.5l3-3 3 3M3 11l4 1-1 4M21 13l-4-1 1-4"/>',
  star:'<path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5-4.8-4.6 6.6-.9z"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'
};
const svg = (k, fill) => `<svg viewBox="0 0 24 24" fill="${fill?'currentColor':'none'}" stroke="currentColor" stroke-width="${fill?0:1.8}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[k]}</svg>`;

const POWERS = {
  rocket:   { name:'Rocket Skates',  lvl:1,  desc:'Jet boots for 3 seconds. Anyone you touch gets flattened.' },
  slick:    { name:'Oil Slick',      lvl:1,  desc:'Dump a puddle of sludge. Opponents who hit it spin out and cough up the puck.' },
  fireball: { name:'Fireball Puck',  lvl:2,  desc:'Your next shot is on fire. It bowls over the goalie and scorches skaters.' },
  mine:     { name:'Land Mine',      lvl:3,  desc:'Drop a mine. It blows when an opponent skates near it.' },
  magnet:   { name:'Magnet Stick',   lvl:4,  desc:'For 6 seconds, loose pucks fly to your stick and steals get easy.' },
  shrink:   { name:'Shrink Ray',     lvl:5,  desc:'Zap the other goalie down to half size for 8 seconds.' },
  wall:     { name:'Ice Wall',       lvl:6,  desc:'Raise a wall of ice across your own crease for 8 seconds.' },
  homing:   { name:'Heat-Seeker',    lvl:7,  desc:'Your next shot curves into the open corner on its own.' },
  kaiju:    { name:'Kaiju Mode',     lvl:8,  desc:'Grow to giant size for 6 seconds. Nothing knocks you down.' },
  triple:   { name:'Split Shot',     lvl:9,  desc:'Your next shot splits into three pucks. Any of them counts.' },
  lightning:{ name:'Thunderstrike',  lvl:10, desc:'Lightning hits every opposing skater at once.' },
  freeze:   { name:'Deep Freeze',    lvl:12, desc:'Freeze the whole other team, goalie included, for 3 seconds.' }
};
const PORDER = Object.keys(POWERS);
const SHOT_POWERS = ['fireball','homing','triple'];

const HOME = { name:'Mutant Rink Rats', abbr:'RAT', species:'rat', jersey:'#f0a020', trim:'#2a1607' };
const CHALLENGES = [
  { id:'boneyard', arena:'Boneyard Pond', title:'Opening Night', len:120, tier:1,
    opp:{ name:'Boneyard Bruisers', abbr:'BNY', species:'skeleton', jersey:'#3d3a46', trim:'#e9e2cc' },
    obj:{ type:'win' }, bonus:[{ type:'goals', n:3 }, { type:'kos', n:2 }],
    hz:{ holes:2 }, cpu:['rocket'],
    blurb:'A frozen pond in the cemetery. Two patches of <b>open water</b> swallow anyone who skates in, puck included.' },
  { id:'magma', arena:'Magma Bowl', title:'Hot Hands', len:120, tier:2,
    opp:{ name:'Molten Maulers', abbr:'MOL', species:'troll', jersey:'#8f1d10', trim:'#ffb070' },
    obj:{ type:'goals', n:3 }, bonus:[{ type:'win' }, { type:'powers', n:3 }],
    hz:{ vents:5 }, cpu:['rocket','fireball'],
    blurb:'<b>Fire vents</b> glow orange, then erupt. Anyone standing on one gets scorched.' },
  { id:'mines', arena:'Mine Shaft', title:'Body Count', len:120, tier:3,
    opp:{ name:'Gremlin Sappers', abbr:'GRM', species:'gremlin', jersey:'#2f4a2a', trim:'#c7e07a' },
    obj:{ type:'kos', n:4, noLose:true }, bonus:[{ type:'margin', n:2 }, { type:'takenMax', n:2 }],
    hz:{ mines:6 }, cpu:['mine','slick'],
    blurb:'The ice is seeded with <b>live mines</b> that rearm after they blow. Check people into them.' },
  { id:'sludge', arena:'Sludge Pit', title:'Brick Wall', len:120, tier:4,
    opp:{ name:'Bog Hogs', abbr:'HOG', species:'hog', jersey:'#5b4a22', trim:'#d2c27a' },
    obj:{ type:'shutout' }, bonus:[{ type:'goals', n:2 }, { type:'powerGoals', n:1 }],
    hz:{ slime:5 }, cpu:['slick','magnet','rocket'],
    blurb:'<b>Toxic sludge</b> puddles slow skaters, chew through health, and grab the puck.' },
  { id:'orbital', arena:'Orbital Ice', title:'Gravity Well', len:120, tier:5, start:[0,2],
    opp:{ name:'Chrome Crushers', abbr:'CHR', species:'robot', jersey:'#2c3f66', trim:'#c9d6ea' },
    obj:{ type:'comeback' }, bonus:[{ type:'margin', n:2 }, { type:'kos', n:3 }],
    hz:{ wells:true, low:true }, cpu:['shrink','homing','rocket'],
    blurb:'Low-gravity ice with almost no friction. Two <b>gravity wells</b> pull in skaters and pucks, and anyone who reaches the core is gone.' },
  { id:'sawmill', arena:'Sawmill Slough', title:'Shorthanded', len:120, tier:6, short:true,
    opp:{ name:'Timber Ogres', abbr:'OGR', species:'ogre', jersey:'#2f5d3a', trim:'#e7c48c' },
    obj:{ type:'win' }, bonus:[{ type:'shutout' }, { type:'powers', n:4 }],
    hz:{ saws:2 }, cpu:['kaiju','mine','fireball'],
    blurb:'You skate <b>two against three</b>. Two <b>buzz saws</b> run across the neutral zone on tracks.' },
  { id:'abyss', arena:'The Abyss', title:'Mayhem Cup Final', len:150, tier:7,
    opp:{ name:'Abyssal Horrors', abbr:'ABY', species:'horror', jersey:'#3a1f5c', trim:'#c78cff' },
    obj:{ type:'margin', n:2 }, bonus:[{ type:'kos', n:5 }, { type:'powerGoals', n:2 }],
    hz:{ holes:2, vents:3, mines:3 }, cpu:['lightning','kaiju','fireball','triple','freeze'],
    blurb:'Everything at once: <b>open water, fire vents and mines</b>, and a team that fights dirty with your best power-ups.' }
];
const THEMES = {
  boneyard:{ ice:'#d3dde3', ice2:'#c2cfd8', scr:'90,110,125', boards:'#b3a78c', kick:'#5d5446', floor:'#141b16', decor:'tomb' },
  magma:   { ice:'#eadbd2', ice2:'#dcc4b6', scr:'150,90,70', boards:'#3b2b27', kick:'#ff6a1a', floor:'#210b07', decor:'lava' },
  mines:   { ice:'#d8d8d1', ice2:'#c4c4ba', scr:'110,105,95', boards:'#6e4c2f', kick:'#e0b23a', floor:'#1a1613', decor:'rock' },
  sludge:  { ice:'#d3e2cd', ice2:'#bfd2b5', scr:'90,120,80', boards:'#5c5a32', kick:'#a8c93f', floor:'#111a0d', decor:'barrel' },
  orbital: { ice:'#dbe5f7', ice2:'#c4d2ee', scr:'90,110,160', boards:'#8f9bb0', kick:'#4cc3ff', floor:'#070918', decor:'stars' },
  sawmill: { ice:'#dfe7ea', ice2:'#ccd7db', scr:'100,115,120', boards:'#8b5a32', kick:'#d63b2b', floor:'#22180f', decor:'logs' },
  abyss:   { ice:'#dcd3ea', ice2:'#c6badd', scr:'110,90,140', boards:'#2d2441', kick:'#a46bff', floor:'#0c0714', decor:'tent' }
};
const SPECIES = {
  rat:{ head:'#8e8796', acc:'#f2a5b5' }, skeleton:{ head:'#efe8d4', acc:'#1b1520' }, troll:{ head:'#d0612a', acc:'#2b1a10' },
  gremlin:{ head:'#78b04f', acc:'#2f4a1f' }, hog:{ head:'#b77e5c', acc:'#f0b8a8' }, robot:{ head:'#a7b0bb', acc:'#ff3b3b' },
  ogre:{ head:'#7b8b3e', acc:'#e8e0c8' }, horror:{ head:'#7a4fa0', acc:'#c9a4ff' }
};
const HIT_WORDS = ['CRUNCH!','SMASH!','WHAM!','BONK!','KER-SPLAT!','THWACK!','CLOBBERED!'];

// ---------------- progression and save
const SKEY = 'rinkrat-mayhem-save';
const defSave = () => ({ xp:0, stars:{}, loadout:['rocket','slick'], plays:0, v:1 });
const xpNeed = L => 90 + 30*L;
function lvlInfo(xp){ let L=1, acc=0; while (xp >= acc + xpNeed(L)) { acc += xpNeed(L); L++; } return { L, into:xp-acc, need:xpNeed(L) }; }
const slotsFor = L => L>=8 ? 4 : L>=4 ? 3 : 2;
function normSave(s){
  const o = { ...defSave(), ...s };
  o.xp = Math.max(0, Number(o.xp)||0);
  o.stars = (s && typeof s.stars==='object' && s.stars) ? { ...s.stars } : {};
  o.loadout = Array.isArray(s.loadout) ? s.loadout.filter(k => POWERS[k]) : ['rocket','slick'];
  fixLoadout(o); return o;
}
function fixLoadout(o){
  const L = lvlInfo(o.xp).L, n = slotsFor(L);
  o.loadout = [...new Set(o.loadout)].filter(k => POWERS[k].lvl <= L).slice(0, n);
  if (!o.loadout.length) o.loadout = ['rocket'];
}
let save = defSave();
try { const s = JSON.parse(localStorage.getItem(SKEY) || 'null'); if (s && typeof s.xp === 'number') save = normSave(s); } catch(e) {}
let muted = false;
try { muted = localStorage.getItem('rinkrat-mute') === '1'; } catch(e) {}
let dbDoc = null, dbChain = Promise.resolve();
const GAME_VERSION = 'v1.2.0';
// save codes: "RRM1." + base64url(JSON)
function exportSave(){ const j = JSON.stringify({ ...save, updatedAt:Date.now() }); return 'RRM1.' + btoa(unescape(encodeURIComponent(j))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
function importSave(code){
  code = String(code || '').trim();
  if (!code.startsWith('RRM1.')) return { ok:false, msg:'That doesn’t look like a Rink Rat save code. It starts with RRM1.' };
  try {
    let b = code.slice(5).replace(/-/g, '+').replace(/_/g, '/'); while (b.length % 4) b += '=';
    const d = JSON.parse(decodeURIComponent(escape(atob(b))));
    if (!d || typeof d.xp !== 'number') throw new Error('bad');
    save = normSave(d); persist();
    const stars = Object.values(save.stars || {}).reduce((a, s) => a + s.filter(Boolean).length, 0);
    return { ok:true, stars };
  } catch(e) { return { ok:false, msg:'That save code is damaged or incomplete. Copy the whole thing and try again.' }; }
}
function persist(){
  try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch(e) {}
  if (dbDoc) {
    const copy = JSON.parse(JSON.stringify(save)); copy.updatedAt = Date.now();
    dbChain = dbChain.then(() => dbDoc.set(copy)).catch(() => {});
  }
}
(async () => {
  try {
    const c = window.claude; if (!c || !c.use) return;
    const db = await c.use('db'); if (!db) return;
    const u = await c.use('user'); const id = u ? await u.id() : null; if (!id) return;
    const ref = db.collection('data/users/' + id).doc('save');
    const snap = await ref.get(); dbDoc = ref;
    const d = snap.exists ? snap.data() : null;
    if (d && typeof d.xp === 'number' && d.xp > save.xp) {
      save = normSave(d);
      try { localStorage.setItem(SKEY, JSON.stringify(save)); } catch(e) {}
      refreshMenus();
    } else if (save.xp > ((d && d.xp) || 0) || (!d && save.plays > 0)) persist();
  } catch(e) { dbDoc = null; }
})();

// ---------------- audio
let AC = null, noise = null;
function ensureAudio(){
  if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { AC = null; } }
  if (AC && AC.state === 'suspended') AC.resume().catch(()=>{});
  if (AC && !noise) { noise = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noise.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
}
const lastSfx = {};
function sfx(type, v=1){
  if (!AC || muted || (G && G.attract)) return;
  const t = AC.currentTime;
  if (lastSfx[type] && t - lastSfx[type] < 0.05) return; lastSfx[type] = t;
  const out = AC.destination;
  const burst = (dur, ft, freq, q, gain, f2) => {
    const s = AC.createBufferSource(); s.buffer = noise;
    const f = AC.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t+dur); f.Q.value = q;
    const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
  };
  const tone = (w, fr, dur, gain, att=0.005, fd, at=0) => {
    const o = AC.createOscillator(); o.type = w; o.frequency.setValueAtTime(fr, t+at); if (fd) o.frequency.exponentialRampToValueAtTime(fd, t+at+dur);
    const g = AC.createGain(); g.gain.setValueAtTime(0.0001, t+at); g.gain.exponentialRampToValueAtTime(gain, t+at+att); g.gain.exponentialRampToValueAtTime(0.0001, t+at+dur);
    o.connect(g); g.connect(out); o.start(t+at); o.stop(t+at+dur+0.05); return o;
  };
  switch(type){
    case 'shot': burst(0.07,'bandpass',2600,0.9,0.35+0.35*v); tone('triangle',180,0.06,0.12*v); break;
    case 'stick': burst(0.035,'bandpass',1900,1.4,0.18*v); break;
    case 'board': burst(0.18,'lowpass',260,0.7,Math.min(0.7,v/50)); break;
    case 'post': tone('sine',1320,0.6,0.22); tone('sine',2710,0.35,0.08); break;
    case 'pad': burst(0.09,'lowpass',650,0.8,0.32*v); break;
    case 'check': burst(0.22,'lowpass',200,0.6,0.7); tone('sine',90,0.2,0.3,0.005,40); break;
    case 'boom': burst(0.8,'lowpass',900,0.5,0.9,60); tone('sine',70,0.6,0.5,0.005,28); break;
    case 'splash': burst(0.5,'bandpass',1400,0.6,0.5,300); break;
    case 'fire': burst(0.6,'bandpass',700,0.5,0.4,2400); break;
    case 'zap': tone('sawtooth',1200,0.25,0.08,0.005,180); tone('square',600,0.2,0.05,0.005,90); break;
    case 'thunder': burst(1.1,'lowpass',2000,0.4,0.8,80); tone('sawtooth',90,0.5,0.15,0.005,40); break;
    case 'freeze': tone('sine',2400,0.6,0.08,0.01,600); tone('triangle',1800,0.8,0.06,0.02,3000); break;
    case 'grow': tone('sawtooth',80,0.8,0.12,0.02,220); break;
    case 'rocket': burst(0.9,'highpass',1800,0.5,0.25,4000); break;
    case 'pickup': tone('square',660,0.08,0.06); tone('square',990,0.12,0.06,0.005,null,0.08); break;
    case 'ko': tone('triangle',520,0.5,0.15,0.005,90); burst(0.3,'bandpass',900,1,0.35); break;
    case 'saw': tone('sawtooth',300,0.3,0.06,0.005,900); break;
    case 'whistle': { const o = tone('sine',2850,0.42,0.09,0.02); const l = AC.createOscillator(); l.frequency.value = 32; const lg = AC.createGain(); lg.gain.value = 90; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t+0.45); break; }
    case 'horn': {
      const f = AC.createBiquadFilter(); f.type='lowpass'; f.frequency.value=1100;
      const g = AC.createGain(); g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(0.16,t+0.06); g.gain.setValueAtTime(0.16,t+1.7); g.gain.exponentialRampToValueAtTime(0.0001,t+2.1);
      f.connect(g); g.connect(out); [138,174,207].forEach(fr => { const o = AC.createOscillator(); o.type='sawtooth'; o.frequency.value=fr; o.connect(f); o.start(t); o.stop(t+2.2); }); break;
    }
    case 'buzzer': tone('square',196,1.0,0.08,0.01); tone('square',198.5,1.0,0.06,0.01); break;
    case 'level': [523,659,784,1047].forEach((f,i) => tone('square',f,0.18,0.07,0.005,null,i*0.09)); break;
  }
}

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
const RULES = [['icing','Icing','Clearing the puck from your half past the far goal line brings a faceoff back'],['faceoffs','Faceoffs after goals','Off keeps play going: the goalie or a fresh puck restarts it'],['checking','Body checking','Off still allows poke checks'],['kos','Knockouts','Off means hits and hazards never drain health'],['hazards','Arena hazards','Holes, vents, mines, sludge, wells and saws'],['powerups','Power-up crates','Crates drop on the ice. In practice they hold every power-up you have unlocked']];
const DEFAULT_RULES = { icing:false, faceoffs:true, checking:true, kos:true, hazards:true, powerups:true };
const practiceDef = () => ({ arena:'boneyard', opp:2, mates:0, goalies:'both', effort:'light', clock:0,
  rules:{ icing:true, faceoffs:false, checking:true, kos:true, hazards:true, powerups:true }, attrs:{ home:defAttrs(), away:defAttrs() } });
let practice = practiceDef();
try { const pr = JSON.parse(localStorage.getItem('rinkrat-practice') || 'null'); if (pr && typeof pr === 'object') { const d = practiceDef(); practice = { ...d, ...pr, rules:{ ...d.rules, ...(pr.rules||{}) }, attrs:{ home:{ ...d.attrs.home, ...((pr.attrs||{}).home||{}) }, away:{ ...d.attrs.away, ...((pr.attrs||{}).away||{}) } } }; } } catch(e) {}
const gameDef = () => ({ rules:{ ...DEFAULT_RULES }, attrs:{ home:defAttrs(), away:defAttrs() } });
let gameCfg = gameDef();
try { const gc = JSON.parse(localStorage.getItem('rinkrat-game') || 'null'); if (gc && typeof gc === 'object') { const d = gameDef(); gameCfg = { rules:{ ...d.rules, ...(gc.rules||{}) }, attrs:{ home:{ ...d.attrs.home, ...((gc.attrs||{}).home||{}) }, away:{ ...d.attrs.away, ...((gc.attrs||{}).away||{}) } } }; } } catch(e) {}
const saveGame = () => { try { localStorage.setItem('rinkrat-game', JSON.stringify(gameCfg)); } catch(e) {} };
const gameCustom = () => { const n = RULES.filter(([k]) => gameCfg.rules[k] !== DEFAULT_RULES[k]).length + ['home','away'].reduce((a, tm) => a + ATTRS.filter(([k]) => Math.abs(gameCfg.attrs[tm][k] - 1) > 0.001).length, 0); return n; };
const savePractice = () => { try { localStorage.setItem('rinkrat-practice', JSON.stringify(practice)); } catch(e) {} };
const attrOf = (tm, k) => (G && G.attr && G.attr[tm] && G.attr[tm][k]) || 1;
const rule = k => !G || !G.rules ? DEFAULT_RULES[k] : !!G.rules[k];
function applyAttrsLive(){ for (const s of G.sk) { s.max = s.baseMax*attrOf(s.team, 'speed'); s.acc = s.baseAcc*attrOf(s.team, 'accel'); } }

function newMatch(ch, attract){
  const tier = ch.tier, pr = ch.practice || null;
  G = { ch, attract, theme:THEMES[ch.id], tier, state:'faceoff', stT:1.3, clock:ch.len, time:0,
    score:{ home:0, away:0 }, sog:{ home:0, away:0 }, kos:{ home:0, away:0 }, hits:{ home:0, away:0 },
    powersUsed:0, powerGoals:0, power:{ home:null, away:null }, armed:{ home:null, away:null }, powerT:{ home:-99, away:-99 },
    aiPowT:{ home:3, away:3 }, crates:[], crateT:4, traps:[], walls:[], parts:[], pops:[], rings:[], bolts:[], beams:[], shake:0,
    ctrl: attract ? -1 : 0, switchCd:0, objShown:false, goalLight:null, low:!!ch.hz.low, endT:0,
    practice:pr, effort: pr ? pr.effort : 'full', rules: pr ? { ...pr.rules } : attract ? { ...DEFAULT_RULES } : { ...gameCfg.rules }, attr: pr ? JSON.parse(JSON.stringify(pr.attrs)) : attract ? { home:defAttrs(), away:defAttrs() } : JSON.parse(JSON.stringify(gameCfg.attrs)), regT:0, foSpot:null };
  if (ch.start) { G.score.home = ch.start[0]; G.score.away = ch.start[1]; }
  G.hz = buildHazards(G.rules.hazards ? ch.hz : {});
  const nHome = pr ? 1 + pr.mates : ch.short && !attract ? 2 : 3, nAway = pr ? pr.opp : 3;
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
  G.state = 'regroup'; G.regT = 0; G.foSpot = spot; G.goalLight = G.goalLight && G.goalLight.t < 2 ? G.goalLight : null;
}
function finishRegroup(){
  const P = G.pucks[0], spot = G.foSpot || { x:CX, y:100 };
  for (const s of G.sk) {
    if (!s.foT) continue;
    if (s.ko > 0) { s.ko = 0; s.hp = 100; s.stun = 0; s.x = s.foT[0]; s.y = s.foT[1]; }
    if (s.ko <= 0 && hyp(s.x - s.foT[0], s.y - s.foT[1]) > 2.4) { s.x = s.foT[0]; s.y = s.foT[1]; }
    s.vx *= 0.2; s.vy *= 0.2; s.face = s.team === 'home' ? -Math.PI/2 : Math.PI/2; s.foT = null;
  }
  Object.assign(P, { ref:false, x:spot.x, y:spot.y, vx:0, vy:0 });
  G.state = 'faceoff'; G.stT = 0.8; G.awayWait = 0.45 - G.tier*0.03;
  if (!G.attract) { const h = G.sk.filter(s => s.team === 'home' && s.ko <= 0); if (h.length) { h.sort((a,b) => hyp(a.x-spot.x, a.y-spot.y) - hyp(b.x-spot.x, b.y-spot.y)); G.ctrl = G.sk.indexOf(h[0]); } }
}
function regroupInput(s, cs){
  if (s.ko > 0 || !s.foT) return [0,0];
  if (s === cs) { const v = readInput(); if (hyp(v[0], v[1]) > 0.25) return v; }
  const [tx, ty] = s.foT, d = hyp(tx - s.x, ty - s.y);
  if (d < 1.6) { s.face = turn(s.face, s.team === 'home' ? -Math.PI/2 : Math.PI/2, 0.12); return [0,0]; }
  const v = moveTo(s, tx, ty), k = d > 30 ? 0.85 : d > 10 ? 0.66 : 0.5;
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
  if (!G.attract) { const h = G.sk.filter(s => s.team==='home'); G.ctrl = G.sk.indexOf(h[0]); }
  G.awayWait = 0.45 - G.tier*0.03;
}

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
function shake(v){ G.shake = Math.max(G.shake, v); }

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
  const msg = kind==='drown' ? 'SPLASH!' : kind==='well' ? 'SPAGHETTIFIED' : kind==='mine' ? 'KA-BOOM!' : kind==='saw' ? 'SHREDDED' : kind==='fire' ? 'TOASTED' : 'KO!';
  pop(s.x, s.y - 4, msg, s.team==='home' ? '#ec3b4f' : '#ffb51e', 22, 1.4);
  if (s.team==='away') pop(s.x, s.y + 2, 'BODY COUNT +1', '#f1e7d0', 12, 1.4);
  sfx(kind==='drown' ? 'splash' : 'ko'); shake(1.2);
  if (s === ctrlSk()) { rumble(1, 1, 380); autoSwitch(true); }
}
function hit(att, vic, power, nx, ny){
  vic.hitImm = 0.45;
  if (vic.kaiju > 0 || vic.inv > 0) return;
  if (vic === ctrlSk()) rumble(Math.min(1, power/55), 0.6, 200); else if (att === ctrlSk()) rumble(Math.min(0.6, power/90), 0.7, 140);
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
  if (s.swing > 0) { a = clamp(angDiff(s.swingA, s.face), -1.2, 1.2)*0.8; r = s.r + 2.5; }   // pass / shot follow-through
  if (s.relT > 0) { a = 0.05; r = s.r + 1.9; }
  if (s.lunge > 0) { a *= 0.4; r += 1.9; }
  if (s.stun > 0 || s.frozen > 0) { a = 0.9; r = s.r + 1.2; }
  return [clamp(a, -BLADE_MAX, BLADE_MAX), r];
}
function updBlade(s, h){
  const b = s.bl || (s.bl = { a:0.12, r:s.r + 1.7, va:0, vr:0, x:s.x, y:s.y, sp:0 });
  if (s.ko > 0) { b.x = s.x; b.y = s.y; b.sp = 0; return; }
  const [ta, tr] = bladeTarget(s), own = G.pucks[0].owner === s;
  const k = s.relT > 0 ? 900 : s.skIn ? TUNE.bladeSkill : TUNE.bladeAuto, c = 2*Math.sqrt(k), lim = s.relT > 0 ? 34 : own ? TUNE.bladeLimit : Math.max(20, TUNE.bladeLimit);
  b.va = clamp(b.va + (k*(ta - b.a) - c*b.va)*h, -lim, lim); b.a = clamp(b.a + b.va*h, -BLADE_MAX, BLADE_MAX);
  b.vr += (k*(tr - b.r) - c*b.vr)*h; b.r = clamp(b.r + b.vr*h, s.r + 0.5, s.r + 5);
  const wa = s.face + b.a, nx = s.x + Math.cos(wa)*b.r, ny = s.y + Math.sin(wa)*b.r;
  b.sp = hyp(nx - b.x - s.vx*h, ny - b.y - s.vy*h)/h; b.x = nx; b.y = ny;
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
  if (G.low) acc *= 0.62;
  if (s.rocket > 0 && !ix && !iy && s.stun <= 0 && s.frozen <= 0) { ix = Math.cos(s.face); iy = Math.sin(s.face); }
  if (ix || iy) {
    // skaters carve: at speed the velocity swings toward the stick direction along an arc (tighter when slow),
    // a hard reversal is a hockey stop, and from a near standstill they can push off any way they like
    const im = Math.min(1, hyp(ix, iy)), th = Math.atan2(iy, ix), sp = hyp(s.vx, s.vy), want = max*im;
    const vh = Math.atan2(s.vy, s.vx), dA = angDiff(th, vh);
    if (sp > 7 && Math.abs(dA) < TUNE.stopAngle*DEG && s.stun <= 0) {
      const rate = (TUNE.carveSlow - (TUNE.carveSlow - TUNE.carveFast)*Math.min(1, sp/Math.max(1, max))) * (s.charging ? 0.75 : 1) * (G.low ? 0.55 : 1) * (s.rocket > 0 ? 0.75 : 1);
      const turnBy = clamp(dA, -rate*h, rate*h), nh = vh + turnBy;
      let ns = sp + clamp(want - sp, -acc*1.3*h, acc*h);
      ns -= Math.abs(turnBy)*sp*TUNE.carveBleed;                       // a hard carve bleeds a little speed
      s.vx = Math.cos(nh)*ns; s.vy = Math.sin(nh)*ns;
      s.face = turn(s.face, vh + clamp(dA, -0.55, 0.55), 9*h);   // look into the turn, not past it
    } else if (sp > 7 && s.stun <= 0) {
      const ns = Math.max(0, sp - acc*TUNE.stopBrake*h);                // hockey stop
      s.vx = s.vx/sp*ns; s.vy = s.vy/sp*ns;
      s.face = turn(s.face, th, 6*h);
    } else {
      const tvx=ix*max, tvy=iy*max, ax=tvx-s.vx, ay=tvy-s.vy, a=hyp(ax,ay), step=acc*h;
      if (a > step) { s.vx += ax/a*step; s.vy += ay/a*step; } else { s.vx = tvx; s.vy = tvy; }
      s.face = turn(s.face, th, 10*h);
    }
  } else if (s.frozen <= 0) {
    const f = Math.exp(-(G.low ? 0.4 : 1.5)*h); s.vx *= f; s.vy *= f;
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
  for (const o of H.holes) if (hyp(s.x-o.x, s.y-o.y) < o.r - 0.9 && !immune) {
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
  for (const p of H.slime) if (hyp(s.x-p.x, s.y-p.y) < p.r*0.85) { s.slowed = true; if (!immune && rule('kos')) { s.hp -= 7*h; if (s.hp <= 0) { s.lastBy = s.lastBy || other(s.team); knockOut(s, 'hit'); return; } } }
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
  if (vic.hitImm > 0) return;
  const closing = -rv;
  if (G.state === 'regroup' || !rule('checking') || (G.practice && G.effort !== 'full' && att.team === 'away')) return;
  let power = 0;
  if (att.kaiju > 0) power = 70;
  else if (att.rocket > 0 && closing > 6) power = 50;
  else if (closing > 13 && (att.lunge > 0 || closing > 24)) power = (closing-9)*2.1 + (att.lunge>0 ? 14 : 0);
  if (power > 0) hit(att, vic, power*attrOf(att.team, 'check'), nx*sgn, ny*sgn);
}
function knockLoose(o, by){
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
  if (o && o.team !== s.team) {
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
  if (s === ctrlSk()) rumble(0.1, 0.3 + power*0.5, 80);
}
function passTargets(s){ return G.sk.filter(m => m.team === s.team && m !== s && m.ko <= 0); }
function passPuck(s, pref){
  const P = G.pucks[0]; if (P.owner !== s) return false;
  const mates = passTargets(s); if (!mates.length) return false;
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
  P.owner = null; P.vx = Math.cos(a)*sp; P.vy = Math.sin(a)*sp; P.passTo = best; P.passT = 1.4; P.shotBy = null; P.last = s.team; P.team = s.team;
  P.icing = (s.team === 'home' ? P.y > 100 : P.y < 100) ? s.team : null;
  s.cool = 0.28; s.charging = false; s.swing = 0.24; s.swingA = a;
  if (s === ctrlSk()) { G.ctrl = G.sk.indexOf(best); G.switchCd = 0.6; }
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
      G.sog[P.shotBy]++; P.shotBy = null;
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
  if (G.practice && g.team === 'away') {
    const corner = Math.random() < 0.5, tx = corner ? (Math.random() < 0.5 ? 10 : 75) : CX + rand(-6, 6), ty = corner ? 16 : 100 + rand(-4, 6);
    const a = Math.atan2(ty - P.y, tx - P.x), dist = hyp(tx - P.x, ty - P.y), sp = clamp(20 + dist*0.5, 26, 50);
    P.hold = null; P.x = g.x + Math.cos(a)*(g.r+PUCK_R+0.3); P.y = g.y + Math.sin(a)*(g.r+PUCK_R+0.3);
    P.vx = Math.cos(a)*sp; P.vy = Math.sin(a)*sp; P.shotBy = null; P.last = 'away'; P.team = 'away'; P.passTo = null; P.icing = null;
    g.cool = 0.6; sfx('stick', 0.8); return;
  }
  const mates = G.sk.filter(s => s.team === g.team && s.ko <= 0);
  let mate = (g.team === 'home' && ctrlSk() && ctrlSk().ko <= 0) ? ctrlSk() : mates.sort((a,b) => (top ? b.y-a.y : a.y-b.y))[0];
  let tx, ty;
  if (mate) { tx = mate.x + mate.vx*0.35; ty = mate.y + mate.vy*0.35; }
  if (!mate || (top ? ty < GT+5 : ty > GB-5) || hyp(tx-P.x, ty-P.y) < 7) { tx = P.x < CX ? 8 : 77; ty = top ? 42 : 158; }
  const a = Math.atan2(ty-P.y, tx-P.x), dist = hyp(tx-P.x, ty-P.y), sp = Math.min(64, 28 + dist*0.55);
  P.hold = null;
  P.x = g.x + Math.cos(a)*(g.r+PUCK_R+0.3); P.y = g.y + Math.sin(a)*(g.r+PUCK_R+0.3);
  P.vx = Math.cos(a)*sp; P.vy = Math.sin(a)*sp; P.shotBy = null; P.last = g.team; P.team = g.team; P.passTo = mate || null; P.passT = 1.3;
  if (g.team === 'home' && mate && !G.attract) G.ctrl = G.sk.indexOf(mate);
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
    const k = Math.min(1, h*(s.recv > 0 ? 10 : TUNE.grip)), nx = P.x + (tx-P.x)*k, ny = P.y + (ty-P.y)*k;
    P.vx = (nx - P.x)/h; P.vy = (ny - P.y)/h; P.x = nx; P.y = ny;
    if (s.recv <= 0 && hyp(tx - P.x, ty - P.y) > TUNE.loseDist) { P.owner = null; s.cool = 0.3; s.charging = false; P.vx = s.vx*0.6; P.vy = s.vy*0.6; }
  } else {
    P.x += P.vx*h; P.y += P.vy*h;
    let fr = G.low ? 0.1 : 0.32;
    for (const p of G.hz.slime) if (hyp(P.x-p.x, P.y-p.y) < p.r*0.85) fr = 2.6;
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
  for (const o of G.hz.holes) if (hyp(P.x-o.x, P.y-o.y) < o.r - 0.6) {
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
  P.owner = s; P.shotBy = null; P.last = s.team; P.team = s.team; P.passTo = null; P.fire = 0; P.homing = 0; P.powered = false;
  s.recv = 0.2; s.wind = 0; s.relT = 0;
  if (s.bl) { const rel = clamp(angDiff(Math.atan2(P.y - s.y, P.x - s.x), s.face), -BLADE_MAX, BLADE_MAX); s.bl.va += (rel - s.bl.a)*4; }
  if (s.team === 'home' && !G.attract) { G.ctrl = G.sk.indexOf(s); }
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
    if (s === ctrlSk()) {
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
      if (G.practice && G.effort !== 'full' && s.team === 'away') rate = G.effort === 'light' ? 0.35 : 0;
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
    if (tm === 'home') { rumble(0.6, 0.9, 380); toast('GOAL', 'Play on', 1500, 'goal'); sfx('horn'); }
    else { toast(G.ch.opp.abbr + ' score', 'Play on', 1300, 'small bad'); sfx('whistle'); }
    return;
  }
  G.state = 'goal'; G.stT = 3; G.goalLight = { team:tm, t:0 };
  const gy = tm === 'home' ? GT : GB;
  burst(CX, gy, 40, ['#ffb51e','#ec3b4f','#ffffff'], 30, 0.8, 1.2); shake(1.6);
  if (tm === 'home') { rumble(0.7, 1, 450); toast('GOAL', powered ? 'Power-up goal' : `${G.score.home}–${G.score.away}`, 2700, 'goal'); sfx('horn'); }
  else { toast(G.ch.opp.abbr + ' score', `${G.score.home}–${G.score.away}`, 2400, 'small bad'); sfx('whistle'); }
  if (!G.attract) checkObjLive();
}
function endMatch(){
  G.state = 'end'; sfx('buzzer');
  for (const s of G.sk) s.charging = false;
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
    case 'practice': { const pr = ch && ch.practice; return pr ? `Practice · ${pr.opp} opponent${pr.opp === 1 ? '' : 's'} · ${pr.effort === 'full' ? 'full effort' : pr.effort}` : 'Practice'; }
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
    case 'practice': return '';
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

// ---------------- AI
function moveTo(s, tx, ty){
  let dx = tx - s.x, dy = ty - s.y; const d = hyp(dx, dy);
  if (d < 0.6) return [0, 0];
  const m = Math.min(1, d/3); dx = dx/d*m; dy = dy/d*m;
  const avoid = s.team === 'away' ? 0.9 + G.tier*0.12 : 1.4;
  const H = G.hz;
  const rep = (hx, hy, R) => { const ex = s.x-hx, ey = s.y-hy, e = hyp(ex, ey); if (e < R && e > 0.01) { const k = (R-e)/R*avoid*1.6; dx += ex/e*k; dy += ey/e*k; } };
  if (s.kaiju <= 0) {
    for (const o of H.holes) rep(o.x, o.y, o.r+6);
    for (const v of H.vents) { const ph = (v.t % 5.5); if (ph > 3.1) rep(v.x, v.y, v.r+5); }
    for (const mi of H.mines) if (mi.dead === 0 && (!mi.team || mi.team !== s.team)) rep(mi.x, mi.y, 7);
    for (const w of H.wells) rep(w.x, w.y, 9);
    for (const w of H.saws) rep(w.x, w.y, 7);
  }
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
  if (s.team === 'away' && G.practice && G.effort !== 'full') return G.awayWait > 0 ? [0,0] : drillAI(s, dt);
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
    const others = mates.filter(m => m !== carrier && m !== ctrlSk()).sort((a,b) => a.role - b.role);
    const k = others.indexOf(s);
    const side = carrier.x < CX ? 64 : 21;
    const aheadY = tm === 'home' ? Math.max(gy+18, carrier.y-28) : Math.min(gy-18, carrier.y+28);
    const spots = [[side, aheadY], [CX + (carrier.x < CX ? 12 : -12), carrier.y - dir*12]];
    const [tx, ty] = spots[Math.max(0, k) % 2];
    return moveTo(s, clamp(tx, 8, 77), clamp(ty, 14, 186));
  }
  if (carrier) {
    let chaser = null, cd = 1e9;
    for (const m of mates) { const d = hyp(m.x-carrier.x, m.y-carrier.y) + (m === ctrlSk() ? -3 : 0); if (d < cd) { cd = d; chaser = m; } }
    if (chaser === s) {
      const vx = CX - carrier.x, vy = oy - carrier.y, vd = hyp(vx, vy) || 1;
      const tx = carrier.x + vx/vd*3.5 + carrier.vx*0.18, ty = carrier.y + vy/vd*3.5 + carrier.vy*0.18;
      const d = hyp(carrier.x - s.x, carrier.y - s.y);
      const rate = s.team === 'away' ? 0.3 + G.tier*0.1 : 0.9;
      if (d < 6.5 && s.pokeCd <= 0 && Math.random() < rate*dt*2) lunge(s, Math.atan2(carrier.y - s.y, carrier.x - s.x));
      return moveTo(s, tx, ty);
    }
    const others = mates.filter(m => m !== chaser && m !== ctrlSk()).sort((a,b) => a.role - b.role);
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
  for (const m of mates) { const d = hyp(m.x-P.x, m.y-P.y) + (m === ctrlSk() ? -4 : 0); if (d < cd) { cd = d; chaser = m; } }
  if (P.passTo && P.passTo.team === tm) chaser = P.passTo;
  if (chaser === s) {
    const d = hyp(P.x-s.x, P.y-s.y), lead = Math.min(0.5, d/s.max);
    return moveTo(s, P.x + P.vx*lead, P.y + P.vy*lead);
  }
  const others = mates.filter(m => m !== chaser && m !== ctrlSk()).sort((a,b) => a.role - b.role);
  const k = others.indexOf(s);
  if (k === 0) return moveTo(s, clamp(P.x < CX ? P.x + 20 : P.x - 20, 8, 77), clamp(P.y + dir*12, 14, 186));
  return moveTo(s, CX, clamp(P.y - dir*24, 20, 180));
}
const aiControlsPower = tm => tm === 'away' || G.attract;
function powerUser(tm){
  const P = G.pucks[0];
  if (tm === 'home' && !G.attract) return ctrlSk();
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
      if (s.team === 'away' && G.practice && G.effort !== 'full') continue;
      const pool = s.team === 'home' ? (G.attract ? ['rocket','slick','fireball','mine','kaiju'] : G.practice ? PORDER.filter(k => POWERS[k].lvl <= lvlInfo(save.xp).L) : save.loadout) : G.ch.cpu;
      const p = pick(pool.length ? pool : ['rocket']);
      G.power[s.team] = p; G.aiPowT[s.team] = rand(1.2, 3.5);
      burst(c.x, c.y, 16, ['#ffb51e','#ffffff'], 16, 0.5, 0.5);
      pop(c.x, c.y - 3, s.team === 'home' ? POWERS[p].name.toUpperCase() : `${G.ch.opp.abbr} GOT ${POWERS[p].name.toUpperCase()}`, s.team === 'home' ? '#ffb51e' : '#c9a4ff', 12, 1.3);
      sfx('pickup'); G.crates.splice(i,1); break;
    }
  }
}

// ---------------- input
const keys = new Set();
const JR = 46;
const joy = { id:null, bx:0, by:0, x:0, y:0 };
function orient(v){
  const R3 = window.__r3d;
  if (R3 && R3.active && R3.basis && (v[0] || v[1])) { const b = R3.basis, m0 = hyp(v[0], v[1]); let x = v[0]*b.rx + (-v[1])*b.fx, y = v[0]*b.ry + (-v[1])*b.fy; const m = hyp(x, y); if (m > 1e-6) { x *= m0/m; y *= m0/m; } return [x, y]; }
  return v;
}
function readSkill(){
  if (pad.raxes[0] || pad.raxes[1]) return orient(pad.raxes);
  const x = (keys.has('KeyL')?1:0) - (keys.has('KeyJ')?1:0), y = (keys.has('KeyK')?1:0) - (keys.has('KeyI')?1:0), m = hyp(x, y);
  return m ? orient([x/m, y/m]) : [0, 0];
}
function readInput(){
  const v = readInputRaw(), R3 = window.__r3d;
  if (R3 && R3.active && R3.basis && (v[0] || v[1])) {
    const b = R3.basis, m0 = hyp(v[0], v[1]);
    let x = v[0]*b.rx + (-v[1])*b.fx, y = v[0]*b.ry + (-v[1])*b.fy; const m = hyp(x, y);
    if (m > 1e-6) { x *= m0/m; y *= m0/m; } return [x, y];
  }
  return v;
}
function readInputRaw(){
  if (joy.id !== null) {
    let dx = (joy.x - joy.bx)/JR, dy = (joy.y - joy.by)/JR; const m = hyp(dx, dy);
    if (m < 0.12) return [0,0]; if (m > 1) { dx /= m; dy /= m; } return [dx, dy];
  }
  if (pad.axes[0] || pad.axes[1]) return pad.axes;
  const x = (keys.has('ArrowRight')||keys.has('KeyD')?1:0) - (keys.has('ArrowLeft')||keys.has('KeyA')?1:0);
  const y = (keys.has('ArrowDown')||keys.has('KeyS')?1:0) - (keys.has('ArrowUp')||keys.has('KeyW')?1:0);
  const m = hyp(x, y); return m ? [x/m, y/m] : [0,0];
}
const playing = () => G && !G.attract && !paused && (G.state === 'play' || G.state === 'faceoff' || G.state === 'goal' || G.state === 'reset' || G.state === 'regroup');
function pressShoot(){
  if (!playing() || G.state !== 'play') return;
  const s = ctrlSk(); if (!s || s.ko > 0) return;
  if (G.pucks[0].owner === s) { s.charging = true; s.charge = 0; }
  else { const [ix, iy] = readInput(); lunge(s, (ix||iy) ? Math.atan2(iy, ix) : s.face); }
}
function releaseShoot(){
  const s = ctrlSk(); if (!s) return;
  if (s.charging) { if (G.pucks[0].owner === s) shoot(s, s.charge, skillAim(s)); s.charging = false; }
}
function pressPass(){
  if (!playing() || G.state !== 'play') return;
  const s = ctrlSk(); if (!s) return;
  if (G.pucks[0].owner === s) { const [ix, iy] = readInput(); passPuck(s, (ix||iy) ? Math.atan2(iy, ix) : null); }
  else autoSwitch(true);
}
function autoSwitch(force){
  if (!G || G.attract) return;
  const P = G.pucks[0], cur = ctrlSk();
  const homes = G.sk.filter(s => s.team === 'home' && s.ko <= 0 && s !== cur);
  if (!homes.length) return;
  homes.sort((a,b) => hyp(a.x-P.x, a.y-P.y) - hyp(b.x-P.x, b.y-P.y));
  const best = homes[0];
  if (force || !cur || cur.ko > 0 || hyp(best.x-P.x, best.y-P.y) < hyp(cur.x-P.x, cur.y-P.y)*0.55) {
    if (cur) cur.charging = false;
    G.ctrl = G.sk.indexOf(best); G.switchCd = 1.0;
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
holdBtn($('bShoot'), pressShoot, releaseShoot);
holdBtn($('bPass'), pressPass);
holdBtn($('bPower'), () => { if (playing()) usePower('home'); });
window.addEventListener('keydown', e => {
  const inGame = G && !G.attract && G.state !== 'end';
  if (inGame && ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
  if (e.code === 'Backquote' && !e.repeat) { toggleTune(); return; }
  if (e.code === 'KeyP' || e.code === 'Escape') { if (inGame && !paused) setPaused(true); else if (paused) setPaused(false); return; }
  if (!inGame || paused) return;
  if (e.code === 'Space') { if (!e.repeat) { ensureAudio(); pressShoot(); } return; }
  if ((e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyX') && !e.repeat) { pressPass(); return; }
  if ((e.code === 'KeyE' || e.code === 'KeyC') && !e.repeat) { usePower('home'); return; }
  keys.add(e.code);
});
window.addEventListener('keyup', e => { if (e.code === 'Space') releaseShoot(); keys.delete(e.code); });
window.addEventListener('blur', () => { keys.clear(); releaseShoot(); });

// ---------------- gamepad (standard mapping: Xbox, PlayStation, Switch Pro)
const pad = { g:null, prev:[], axes:[0,0], raxes:[0,0], blocked:false, name:'' };
function findPad(){
  if (pad.blocked || !navigator.getGamepads) return null;
  let list; try { list = navigator.getGamepads(); } catch(e) { pad.blocked = true; return null; }
  for (const g of list || []) if (g && g.connected && g.buttons && g.buttons.length >= 10) return g;
  return null;
}
function rumble(strong, weak, ms){
  const a = pad.g && pad.g.vibrationActuator;
  if (!a || !a.playEffect) return;
  try { const r = a.playEffect('dual-rumble', { duration:ms, strongMagnitude:Math.max(0, Math.min(1, strong)), weakMagnitude:Math.max(0, Math.min(1, weak)) }); if (r && r.catch) r.catch(() => {}); } catch(e) {}
}
function padConfirm(){
  const vis = id => !$(id).hidden;
  if (vis('pause')) return setPaused(false);
  if (vis('brief')) return $('btnGo').click();
  if (vis('results')) return ($('resNext') || $('resRetry')).click();
  if (vis('kit')) return $('kitDone').click();
  if (vis('prac')) return $('pracGo').click();
  if (vis('hub')) { const c = document.querySelector('.chal.next') || document.querySelector('.chal:not(:disabled)'); if (c) c.click(); }
}
function padBack(){
  const vis = id => !$(id).hidden;
  if (vis('brief')) return $('btnBack').click();
  if (vis('kit')) return $('kitDone').click();
  if (vis('results')) return $('resHub').click();
  if (vis('prac')) return $('pracBack').click();
  if (vis('pause')) return setPaused(false);
}
function pollPad(){
  const g = findPad();
  if (!!g !== !!pad.g || (g && g.id !== pad.name)) { pad.name = g ? g.id : ''; pad.prev = []; setTimeout(refreshPadNote, 0); }
  pad.g = g;
  if (!g) { pad.axes = [0,0]; pad.raxes = [0,0]; return; }
  const now = g.buttons.map(b => !!b && (b.pressed || b.value > 0.5));
  const down = i => now[i] && !pad.prev[i];
  let x = g.axes[0] || 0, y = g.axes[1] || 0; const m = hyp(x, y);
  if (m < 0.2) { x = 0; y = 0; } else { const k = Math.min(1, (m - 0.2)/0.75)/m; x *= k; y *= k; }
  const dx = (now[15] ? 1 : 0) - (now[14] ? 1 : 0), dy = (now[13] ? 1 : 0) - (now[12] ? 1 : 0);
  if (dx || dy) { const mm = hyp(dx, dy); x = dx/mm; y = dy/mm; }
  pad.axes = [x, y];
  { let rx = g.axes[2] || 0, ry = g.axes[3] || 0; const rm = hyp(rx, ry);
    if (rm < 0.2) { rx = 0; ry = 0; } else { const k = Math.min(1, (rm - 0.2)/0.7)/rm; rx *= k; ry *= k; }
    pad.raxes = [rx, ry]; }
  const inGame = G && !G.attract && G.state !== 'end' && $('results').hidden;
  if (down(9) || down(8)) { if (inGame && !paused) setPaused(true); else if (paused) setPaused(false); }
  if (inGame && !paused) {
    const sNow = now[0] || now[7], sPrev = pad.prev[0] || pad.prev[7];
    if (sNow && !sPrev) { ensureAudio(); pressShoot(); }
    if (!sNow && sPrev) releaseShoot();
    if (down(2) || down(4) || down(6)) pressPass();
    if (down(1) || down(3) || down(5)) usePower('home');
  } else {
    if (down(0)) { ensureAudio(); padConfirm(); }
    if (down(1)) padBack();
  }
  pad.prev = now;
}
function padNoteText(){
  if (pad.blocked) return 'Controllers are blocked in this view. Open the game in its own browser tab to use one.';
  if (pad.g) return 'Controller connected. Left stick or D-pad skates · Right stick moves your stick: dangle side to side, sweep to poke check, pull back and flick forward to shoot · A or RT shoots (hold to wind up) and checks · X or LB passes and switches · B or RB fires your power-up · Start pauses · A picks and B goes back in menus.';
  return 'Got a controller? Connect it and press any button.';
}
function refreshPadNote(){ const el = $('padNote'); if (el) el.textContent = padNoteText(); renderCtrlBar(); if (pad.g && G && !G.attract) toast('Controller', 'Connected', 1400, 'small'); }
// ---------------- controls strip (toggled from the scoreboard)
let ctrlBarOn = true;
try { ctrlBarOn = localStorage.getItem('rinkrat-ctrlbar') !== '0'; } catch(e) {}
function padLabels(){
  const id = (pad.name || '').toLowerCase();
  // face buttons: { t:text, bg, fg, face:true }; shoulders/triggers: { t, trig:true }
  const F = (t, bg, fg = '#fff') => ({ t, bg, fg, face:true }), S = (t, trig) => ({ t, trig:!!trig });
  if (/054c|dualsense|dualshock|playstation/.test(id)) return { name:'PlayStation controller', stick:S('L stick'), rstick:S('R stick'), dpad:S('D-pad'),
    a:F('✕', '#1d1f26', '#7fa7ff'), b:F('○', '#1d1f26', '#ff6b6b'), x:F('□', '#1d1f26', '#f08fd3'), rt:S('R2', 1), lb:S('L1'), rb:S('R1'), start:S('Options') };
  if (/057e|pro controller|joy-con|nintendo/.test(id)) return { name:'Switch controller', stick:S('L stick'), rstick:S('R stick'), dpad:S('D-pad'),
    a:F('B', '#2a2c33'), b:F('A', '#2a2c33'), x:F('Y', '#2a2c33'), rt:S('ZR', 1), lb:S('L'), rb:S('R'), start:S('+') };
  return { name:'Xbox controller', stick:S('L stick'), rstick:S('R stick'), dpad:S('D-pad'),
    a:F('A', '#3fae49'), b:F('B', '#e0453c'), x:F('X', '#2f7de1'), rt:S('RT', 1), lb:S('LB'), rb:S('RB'), start:S('☰ Menu') };
}
function ctrlItems(){
  if (pad.g) { const L = padLabels(); return { src:L.name, items:[[[L.stick, L.dpad], 'Skate'], [[L.rstick], 'Stickhandle · pull back, flick to shoot'], [[L.a, L.rt], 'Shoot (hold) · check'], [[L.x, L.lb], 'Pass · switch'], [[L.b, L.rb], 'Power-up'], [[L.start], 'Pause']] }; }
  if (matchMedia('(pointer:coarse)').matches) return { src:'Touch', items:[[['Left side'], 'Drag to skate'], [['Shoot'], 'Hold · tap to check'], [['Pass'], 'Pass · switch'], [['Power'], 'Power-up']] };
  return { src:'Keyboard', items:[[['WASD', 'Arrows'], 'Skate'], [['IJKL'], 'Stickhandle · pull back, flick to shoot'], [['Space'], 'Shoot (hold) · check'], [['Shift'], 'Pass · switch'], [['E'], 'Power-up'], [['P'], 'Pause'], [['`'], 'Tuning']] };
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
  bar.innerHTML = `<span class="ck src">${src.toUpperCase()}</span>` + items.map(([keys, label]) => `<span class="ck">${keys.map(keyHtml).join('<span class="or">/</span>')}<span class="lbl">${label}</span></span>`).join('');
}

window.addEventListener('gamepadconnected', () => { pollPad(); });
window.addEventListener('gamepaddisconnected', () => { pollPad(); if (G && !G.attract && !paused && G.state !== 'end') setPaused(true); });

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
  if (G.state === 'faceoff') { G.stT -= dt; if (G.stT <= 0) { G.state = 'play'; const P = G.pucks[0]; P.vx = rand(-3,3); P.vy = rand(-1,1); sfx('whistle'); } return; }
  if (G.state === 'goal' || G.state === 'reset') { G.stT -= dt; if (G.stT <= 0) { startRegroup({ x:CX, y:100 }); return; } }
  if (G.state === 'regroup') { G.regT += dt; if (G.regT > 0.6) { const pending = G.sk.some(s => s.ko <= 0 && s.foT && hyp(s.x - s.foT[0], s.y - s.foT[1]) > 3); if (!pending || G.regT > 7) { finishRegroup(); return; } } }
  if (G.goalLight && G.state === 'play' && G.goalLight.t > 2.6) G.goalLight = null;
  if (G.state === 'play') {
    if (G.ch.len > 0) { G.clock -= dt; if (G.clock <= 0) { G.clock = 0; endMatch(); return; } }
    if (G.awayWait > 0) G.awayWait -= dt;
    if (rule('powerups')) crateLogic(dt);
    if (!G.practice || G.effort === 'full') aiPowers('away', dt); if (G.attract) aiPowers('home', dt);
  }
  G.switchCd = Math.max(0, G.switchCd - dt);
  const cs = ctrlSk();
  if (cs && !G.attract && G.switchCd <= 0 && G.state === 'play') {
    const P = G.pucks[0];
    if (cs.ko > 0) autoSwitch(true);
    else if (!(P.owner && P.owner.team === 'home') && !(P.passTo && P.passTo.team === 'home')) autoSwitch(false);
  }
  for (const s of G.sk) {
    s.cool = Math.max(0, s.cool-dt); s.pokeCd = Math.max(0, s.pokeCd-dt); s.lunge = Math.max(0, s.lunge-dt); s.hitImm = Math.max(0, s.hitImm-dt);
    s.stun = Math.max(0, s.stun-dt); s.down = Math.max(0, (s.down || 0)-dt); s.swing = Math.max(0, (s.swing || 0)-dt); s.check = Math.max(0, (s.check || 0)-dt); s.frozen = Math.max(0, s.frozen-dt); s.inv = Math.max(0, s.inv-dt); s.slickCd = Math.max(0, s.slickCd-dt);
    s.rocket = Math.max(0, s.rocket-dt); s.kaiju = Math.max(0, s.kaiju-dt); s.magnet = Math.max(0, s.magnet-dt);
    if (s.rocket > 0) burst(s.x - Math.cos(s.face)*s.r, s.y - Math.sin(s.face)*s.r, 2, ['#ff6a1a','#ffb51e','#fff1b0'], 6, 0.7, 0.35);
    if (s.ko > 0) { s.ko -= dt; if (s.ko <= 0) { s.ko = 0; s.hp = 100; s.inv = 1.4; s.x = 4.5; s.y = s.team === 'home' ? 112 : 88; s.vx = 14; s.vy = 0; s.face = 0; s.stun = 0; } }
    if (s.hp < 100 && s.ko <= 0) s.hp = Math.min(100, s.hp + dt*2.5);
  }
  for (const s of G.sk) { s.skIn = null; s.recv = Math.max(0, (s.recv || 0) - dt); if (s.dk > 0) s.dk -= dt; }
  if (cs && !G.attract && (G.state === 'play' || G.state === 'regroup') && cs.ko <= 0) { const v = readSkill(); if (v[0] || v[1]) cs.skIn = v; }
  if (cs && G.state === 'play') skillShot(cs, dt);
  { const P = G.pucks[0], o = P.owner;   // AI puck carriers deke when a defender closes in front of them
    if (o && o !== cs && (o.dk || 0) <= 0 && G.state === 'play') for (const d of G.sk) { if (d.team === o.team || d.ko > 0) continue; const dx = d.x - o.x, dy = d.y - o.y, dd = hyp(dx, dy); if (dd < 9 && Math.abs(angDiff(Math.atan2(dy, dx), o.face)) < 0.9 && Math.random() < dt*2.2) { o.dk = rand(0.3, 0.45); o.dkA = (o.dkA || 1) > 0 ? -1.15 : 1.15; break; } } }
  if (cs && cs.charging) cs.charge = Math.min(1, cs.charge + dt/TUNE.chargeTime);
  if (cs && G.pucks[0].owner !== cs) cs.charging = false;
  const P0 = G.pucks[0]; if (P0.passTo) { P0.passT -= dt; if (P0.passT <= 0 || P0.owner) P0.passTo = null; }
  const inputs = G.sk.map(s => G.state === 'regroup' ? regroupInput(s, cs) : (s === cs && G.state === 'play') ? readInput() : (G.state === 'play' ? aiSkater(s, dt) : [0,0]));
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
  if (G.state === 'play') steals(dt);
  for (const P of G.pucks) { const sp = hyp(P.vx, P.vy); P.trail.push([P.x, P.y, sp]); if (P.trail.length > 9) P.trail.shift(); }
}

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
  const isCtrl = s === ctrlSk();
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
  if (isCtrl) { ctx.strokeStyle = '#ffb51e'; ctx.lineWidth = 0.45; ctx.setLineDash([1.1,0.7]); circ(0,0,r+1.2); ctx.stroke(); ctx.setLineDash([]); }
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
  const focusY = cs && cs.ko <= 0 ? P.y*0.78 + cs.y*0.22 : P.y;
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
    ctx.fillStyle = s.hp > 55 ? '#74d38f' : s.hp > 25 ? '#ffb51e' : '#ec3b4f'; ctx.fillRect(sx - w/2, sy, w*Math.max(0, s.hp)/100, 4);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of G.pops) {
    const [sx, sy] = W2S(p.x, p.y), k = p.life/p.max, sc = k > 0.85 ? 1 + (k-0.85)*3 : 1;
    ctx.globalAlpha = Math.min(1, k*2.5); ctx.font = `${Math.round(p.size*sc)}px Bungee, "Arial Black", Impact, sans-serif`;
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(21,14,28,.9)'; ctx.strokeText(p.text, sx, sy); ctx.fillStyle = p.color; ctx.fillText(p.text, sx, sy);
  }
  ctx.globalAlpha = 1;
  if (cs && cs.ko <= 0) {
    const [sx, sy] = W2S(cs.x, cs.y);
    if (sy < 8 || sy > ch - 8) { const ey = sy < 8 ? 14 : ch - 14, d = sy < 8 ? -1 : 1; ctx.fillStyle = '#ffb51e'; ctx.beginPath(); ctx.moveTo(sx, ey + d*8); ctx.lineTo(sx - 9, ey - d*4); ctx.lineTo(sx + 9, ey - d*4); ctx.closePath(); ctx.fill(); }
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
  setT('clk', G.ch.len > 0 ? fmtClock(G.clock) : 'FREE');
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
  para(x0, w*hp); ctx.fillStyle = hp > 0.55 ? '#74d38f' : hp > 0.25 ? '#ffb51e' : '#ec3b4f'; ctx.fill();
  ctx.strokeStyle = '#150e1c'; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i=1;i<5;i++){ const x = x0 + w*i/5; ctx.moveTo(x + k, y0); ctx.lineTo(x, y0 + h); } ctx.stroke();
  para(x0 - 2, w + 4); ctx.lineWidth = 2.5; ctx.stroke();
}
let speedSeed = 0;
function speedLines(power){
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
  if (cs && cs.ko <= 0 && !G.attract) {
    const [sx, sy] = R3.project(cs.x, cs.y, 0);
    if (sy < 8 || sy > ch - 8 || sx < 4 || sx > cw - 4) { const ex = clamp(sx, 16, cw - 16), ey = clamp(sy, 16, ch - 16), a = Math.atan2(sy - ey, sx - ex); ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = '#ffb51e'; ctx.strokeStyle = '#150e1c'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(11, 0); ctx.lineTo(-7, -9); ctx.lineTo(-7, 9); ctx.closePath(); ctx.stroke(); ctx.fill(); ctx.restore(); }
  }
  if (joy.id !== null) {
    let dx = joy.x - joy.bx, dy = joy.y - joy.by; const m = hyp(dx, dy); if (m > JR) { dx = dx/m*JR; dy = dy/m*JR; }
    ctx.strokeStyle = 'rgba(241,231,208,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(joy.bx, joy.by, JR, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,181,30,.6)'; ctx.beginPath(); ctx.arc(joy.bx+dx, joy.by+dy, 20, 0, 7); ctx.fill();
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
  get G(){ return G; }, ctrlSk, stickPt, aimAngle, HOME, SPECIES,
  C:{ RW, RL, CR, CX, GT, GB, PL, PRt, ND, PUCK_R, SK_R, G_R },
  stageW: () => cw, stageH: () => ch,
  gfxPref: () => gfxPref, on3DStatus: () => refreshGfx(),
  notice: m => { if (G && !G.attract) toast('3D view', m, 2600, 'small'); },
  forceClassic: m => { gfxPref = 'classic'; $('gl').hidden = true; refreshGfx(); if (G && !G.attract) toast('Classic view', m, 3200, 'small'); }
};
function gfxEngine(){ try { return localStorage.getItem('rinkrat-gfx-engine') || 'webgpu'; } catch(e) { return 'webgpu'; } }
function setEngine(e){
  try { localStorage.setItem('rinkrat-gfx-engine', e); } catch(err) {}
  const R3 = window.__r3d;
  if (gfxPref !== 'classic' && R3) { if (R3.ok && R3.restart) R3.restart(); else R3.boot(); }
  refreshGfx();
}

// ---------------- loop
let paused = false, last = 0;
function frame(t){
  const dt = Math.min(0.05, (t - last)/1000 || 0); last = t;
  try { pollPad(); } catch(e) {}
  if (!paused) update(dt);
  const R3 = window.__r3d;
  let drew = false;
  if (R3 && R3.active) {
    try { R3.frame(dt, t); renderOverlay3D(R3); drew = true; }
    catch (e) { console.warn('[3D] render error, switching to the classic view', e); R3.active = false; R3.ok = false; R3.status = 'failed'; $('gl').hidden = true; refreshGfx(); }
  }
  if (!drew) render(t);
  updateHud();
  requestAnimationFrame(frame);
}

// ---------------- menus
let selected = null;
const starsHtml = arr => `<span class="stars" aria-label="${arr.filter(Boolean).length} of 3 stars">${arr.map(s => `<span class="${s?'star-on':'star-off'}">${svg('star', true)}</span>`).join('')}</span>`;
const starsOf = id => { const s = save.stars[id]; return Array.isArray(s) ? s : [false,false,false]; };
const unlockedIdx = i => i === 0 || starsOf(CHALLENGES[i-1].id)[0];
function nextChallengeIdx(){ for (let i=0;i<CHALLENGES.length;i++) if (unlockedIdx(i) && !starsOf(CHALLENGES[i].id)[0]) return i; return CHALLENGES.length - 1; }
function renderHub(){
  const li = lvlInfo(save.xp), nextP = PORDER.find(k => POWERS[k].lvl > li.L), nIdx = nextChallengeIdx();
  const totalStars = CHALLENGES.reduce((a,c) => a + starsOf(c.id).filter(Boolean).length, 0);
  const slots = slotsFor(li.L);
  const chips = [];
  for (let i=0;i<slots;i++){ const k = save.loadout[i]; chips.push(k ? `<span class="chip">${svg(k)}${POWERS[k].name}</span>` : `<span class="chip empty">Empty slot</span>`); }
  $('hubWrap').innerHTML = `
    <div class="logo"><p class="eyebrow">Mutant shinny · 3-on-3 · no rules</p><h1>Rink Rat <em>Mayhem</em></h1><div class="tape"></div>
      <p class="lede">Lead the Mutant Rink Rats through seven cursed arenas. Each challenge is one period with one job. Win it to earn XP and unlock nastier power-ups.</p></div>
    <div class="card">
      <div class="lvl"><div class="lvbadge"><small>LEVEL</small><span>${li.L}</span></div>
        <div class="xpbar"><i id="hubXp"></i></div>
        <div class="xptext"><b>${li.into}</b> / ${li.need} XP to level ${li.L+1} · ${totalStars}/21 stars${nextP ? `<br>Level ${POWERS[nextP].lvl} unlocks <b>${POWERS[nextP].name}</b>` : '<br>Every power-up unlocked'}</div></div>
      <div class="kitrow"><div style="display:flex;flex-direction:column;gap:8px;min-width:0"><h3 class="h">Loadout · ${save.loadout.length}/${slots} slots</h3><div class="chips">${chips.join('')}</div></div>
        <button class="btn ghost small" id="btnKit" type="button">Change loadout</button></div>
      <div class="kitrow"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><h3 class="h">Rules and sliders</h3><span class="xptext">${gameCustom() ? `Custom · ${gameCustom()} change${gameCustom() === 1 ? '' : 's'} from standard` : 'Standard'}</span></div>
        <button class="btn ghost small" id="btnCfg" type="button">Change</button></div>
    </div>
    <button class="chal prac" type="button" id="btnPractice">
      <span class="num">P</span>
      <span class="cinfo"><span class="arena">PRACTICE RINK · NO XP</span><span class="ct">Practice</span><span class="co">Pick the arena, opponents and rules, and tune each team's speed, shot and checking.</span></span>
      <span class="lock" style="color:var(--hazard)">Set up</span></button>
    <div style="display:flex;flex-direction:column;gap:10px">
      <h3 class="h">Challenges</h3>
      ${CHALLENGES.map((c,i) => { const ul = unlockedIdx(i); return `<button class="chal${i===nIdx && ul ? ' next' : ''}" type="button" data-i="${i}" ${ul ? '' : 'disabled'}>
        <span class="num">${ul ? i+1 : `<span style="width:18px;height:18px;display:block">${svg('lock')}</span>`}</span>
        <span class="cinfo"><span class="arena">${c.arena.toUpperCase()}</span><span class="ct">${c.title}</span><span class="co">${condText(c.obj, c)} · vs ${c.opp.name}</span></span>
        ${ul ? starsHtml(starsOf(c.id)) : `<span class="lock">Clear ${CHALLENGES[i-1].title} to unlock</span>`}</button>`; }).join('')}
    </div>
    <div class="card gfx"><h3 class="h">Graphics</h3><div class="seg" id="gfxSeg">${GFX_OPTS.map(([k,l]) => `<button type="button" data-g="${k}" aria-pressed="${k===gfxPref}">${l}</button>`).join('')}</div><h3 class="h" style="margin-top:6px">3D engine</h3><div class="seg" id="engSeg">${[['webgpu','WebGPU'],['webgl','WebGL2 (compatibility)']].map(([k,l]) => `<button type="button" data-e="${k}" aria-pressed="${k===gfxEngine()}">${l}</button>`).join('')}</div><p class="gfxnote" id="gfxNote">${gfxStatusText()}</p></div>
    <p class="foot">Power-ups drop in yellow crates on the ice. Grab one and fire it from the power button.</p>
    <div class="card gfx"><h3 class="h">Save data</h3>
      <p class="gfxnote">Progress lives in this browser. Copy your save code to move it to another browser or device, then paste it there and load it.</p>
      <textarea id="saveCode" class="savecode" rows="2" spellcheck="false" autocomplete="off" aria-label="Save code" placeholder="Paste a save code here"></textarea>
      <div class="savebtns"><button class="btn ghost small" id="saveCopy" type="button">Copy my save code</button><button class="btn ghost small" id="saveLoad" type="button">Load code</button></div>
      <p class="gfxnote" id="saveMsg" aria-live="polite"></p></div>
    <p class="foot" id="padNote">${padNoteText()}</p>
    <p class="foot ver">Rink Rat Mayhem ${GAME_VERSION} · <a href="https://github.com/ennywnad/rink-rat-mayhem" target="_blank" rel="noopener">source</a></p>`;
  requestAnimationFrame(() => { const x = $('hubXp'); if (x) x.style.width = (li.into/li.need*100).toFixed(1) + '%'; });
  $('btnKit').onclick = () => openKit('hub');
  document.querySelectorAll('#gfxSeg button').forEach(b => b.onclick = () => setGfx(b.dataset.g));
  $('saveCopy').onclick = async () => {
    const code = exportSave(); $('saveCode').value = code;
    let ok = false; try { await navigator.clipboard.writeText(code); ok = true; } catch(e) {}
    $('saveMsg').textContent = ok ? 'Save code copied to the clipboard.' : 'Select the code above and copy it.';
    if (!ok) $('saveCode').select();
  };
  $('saveLoad').onclick = () => {
    const r = importSave($('saveCode').value);
    if (!r.ok) { $('saveMsg').textContent = r.msg; return; }
    renderHub(); $('saveMsg').textContent = `Loaded: level ${lvlInfo(save.xp).L}, ${r.stars} stars.`;
  };
  document.querySelectorAll('#engSeg button').forEach(b => b.onclick = () => setEngine(b.dataset.e));
  $('btnPractice').onclick = () => openPractice(false);
  $('btnCfg').onclick = () => openGameCfg('hub');
  $('hubWrap').querySelectorAll('.chal[data-i]').forEach(b => b.onclick = () => openBrief(Number(b.dataset.i)));
}
function openBrief(i){
  selected = i; const c = CHALLENGES[i], st = starsOf(c.id);
  const goals = [[c.obj, 'OBJECTIVE', st[0]], [c.bonus[0], 'BONUS', st[1]], [c.bonus[1], 'BONUS', st[2]]];
  $('briefCard').innerHTML = `
    <div style="display:flex;flex-direction:column;gap:8px"><p class="eyebrow">${c.arena.toUpperCase()} · CHALLENGE ${i+1} · ${fmtClock(c.len)} PERIOD</p><h2 class="h" style="font-size:30px">${c.title}</h2>
    <div class="vs"><i class="swatch" style="background:${c.opp.jersey};box-shadow:inset 0 -3px 0 ${c.opp.trim}"></i>vs ${c.opp.name}</div></div>
    <div class="hazard"><span style="width:20px;flex:none;color:var(--hazard)">${svg('mine')}</span><span>${c.blurb}</span></div>
    <ul class="goals">${goals.map(([g,tag,done]) => `<li class="${done?'ok':''}"><span class="${done?'star-on':'star-off'}">${svg('star', true)}</span><span>${condText(g, c)}</span><span class="tag">${done ? 'EARNED' : tag}</span></li>`).join('')}</ul>
    <p class="lede" style="font-size:14px">They carry ${c.cpu.map(k => POWERS[k].name).join(', ')}. Bonus stars count only if you complete the objective.</p>
    <div class="kitrow"><div class="chips">${save.loadout.map(k => `<span class="chip">${svg(k)}${POWERS[k].name}</span>`).join('')}</div><button class="btn ghost small" id="briefKit" type="button">Change</button></div>
    <div class="kitrow"><span class="xptext">Rules and sliders: <b>${gameCustom() ? `custom (${gameCustom()} change${gameCustom() === 1 ? '' : 's'})` : 'standard'}</b></span><button class="btn ghost small" id="briefCfg" type="button">Change</button></div>
    <div class="btns"><button class="btn" id="btnGo" type="button">Drop the puck</button><button class="btn ghost" id="btnBack" type="button">Back to the locker room</button></div>`;
  show('brief');
  $('btnGo').onclick = () => startChallenge(i);
  $('btnBack').onclick = () => show('hub');
  $('briefKit').onclick = () => openKit('brief');
  $('briefCfg').onclick = () => openGameCfg('brief');
}
let kitReturn = 'hub';
function openKit(from){ kitReturn = from; renderKit(); show('kit'); }
function renderKit(){
  const li = lvlInfo(save.xp), slots = slotsFor(li.L);
  $('kitWrap').innerHTML = `
    <div class="sticky"><div style="display:flex;flex-direction:column;gap:6px"><h2 class="h">Loadout</h2><span class="slots">${save.loadout.length} OF ${slots} SLOTS · LEVEL ${li.L}</span></div><button class="btn small" id="kitDone" type="button">Done</button></div>
    <p class="lede" style="font-size:14px">Crates on the ice give you a random power-up from your loadout. You get more slots at levels 4 and 8.</p>
    <div class="pgrid">${PORDER.map(k => { const P = POWERS[k], lock = P.lvl > li.L, eq = save.loadout.includes(k);
      return `<button class="pc${eq?' eq':''}${lock?' locked':''}" type="button" data-k="${k}" ${lock?'disabled':''} aria-pressed="${eq}"><span class="ic">${svg(lock ? 'lock' : k)}</span><span class="pn">${P.name}</span><span class="pd">${P.desc}</span><span class="ps">${lock ? `UNLOCKS AT LEVEL ${P.lvl}` : eq ? 'EQUIPPED' : 'TAP TO EQUIP'}</span></button>`; }).join('')}</div>`;
  $('kitDone').onclick = () => { if (kitReturn === 'brief' && selected != null) openBrief(selected); else { renderHub(); show('hub'); } };
  $('kitWrap').querySelectorAll('.pc').forEach(b => b.onclick = () => {
    const k = b.dataset.k, i = save.loadout.indexOf(k);
    if (i >= 0) { if (save.loadout.length > 1) save.loadout.splice(i, 1); }
    else { if (save.loadout.length >= slots) save.loadout.shift(); save.loadout.push(k); }
    persist(); renderKit();
  });
}
function show(which){
  for (const id of ['hub','brief','kit','pause','results','prac']) $(id).hidden = id !== which;
  const menu = which === 'hub' || which === 'brief' || which === 'kit' || which === 'results' || (which === 'prac' && !pracLive);
  app.classList.toggle('menu', menu);
  if (which) { const el = $(which); el.scrollTop = 0; }
  requestAnimationFrame(resize);
}
function refreshMenus(){
  if (!$('hub').hidden) renderHub();
  else if (!$('kit').hidden) renderKit();
  else if (!$('brief').hidden && selected != null) openBrief(selected);
}
function startChallenge(i){
  ensureAudio();
  const c = CHALLENGES[i]; selected = i;
  newMatch(c, false);
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  $('aAbbr').textContent = c.opp.abbr; $('aSw').style.background = c.opp.jersey; $('aSw').style.boxShadow = `inset 0 -3px 0 ${c.opp.trim}`;
  $('arenaShort').textContent = c.arena.toUpperCase().slice(0, 14);
  $('objText').textContent = condText(c.obj, c);
  show(null); paused = false;
  setTimeout(resize, 30);
  toast(c.title, c.start ? `Down ${c.start[0]}–${c.start[1]}. ${condText(c.obj, c)}` : condText(c.obj, c), 1700, 'small');
  wake();
}
// ---------------- practice / game settings
let pracLive = false, pracSnap = '', cfgMode = 'practice', cfgFrom = 'hub';
const STRUCT_KEYS = ['arena','opp','mates','goalies','clock'];
const structKey = () => cfgMode === 'game' ? JSON.stringify([gameCfg.rules.hazards]) : JSON.stringify(STRUCT_KEYS.map(k => practice[k]).concat([practice.rules.hazards]));
function segHtml(id, opts, cur){ return `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" aria-pressed="${String(v) === String(cur)}">${l}</button>`).join('')}</div>`; }
function openPractice(live){ cfgMode = 'practice'; pracLive = !!live; pracSnap = structKey(); renderPractice(); show('prac'); }
function openGameCfg(from){ cfgMode = 'game'; cfgFrom = from; pracLive = from === 'pause'; pracSnap = structKey(); renderPractice(); show('prac'); }
function renderPractice(){
  const game = cfgMode === 'game', cfg = game ? gameCfg : practice, persist = game ? saveGame : savePractice;
  const A = cfg.attrs, short = { boneyard:'Boneyard', magma:'Magma', mines:'Mines', sludge:'Sludge', orbital:'Orbital', sawmill:'Sawmill', abyss:'Abyss' };
  const sl = (tm, k) => { const v = Math.round(A[tm][k]*100); return `<label class="sl ${tm}"><span>${tm === 'home' ? 'Rats' : 'CPU'}</span><input type="range" id="a_${tm}_${k}" min="50" max="150" step="5" value="${v}"><b id="v_${tm}_${k}">${v}%</b></label>`; };
  const goLbl = pracLive ? 'Apply and resume' : game ? 'Done' : 'Start practice';
  const backLbl = pracLive ? 'Back to pause menu' : game && cfgFrom === 'brief' ? 'Back to the challenge' : 'Back to the locker room';
  $('pracWrap').innerHTML = `
    <div class="sticky"><div style="display:flex;flex-direction:column;gap:6px"><h2 class="h">${game ? 'Rules and sliders' : 'Practice'}</h2><span class="slots">${game ? 'APPLIES TO EVERY CHALLENGE' : 'NO XP · CHANGE ANYTHING'}</span></div><button class="btn small" id="pracGoTop" type="button">${pracLive ? 'Apply' : game ? 'Done' : 'Start'}</button></div>
    ${game ? `<p class="lede" style="font-size:14px">Standard is all rules on except icing, with both teams at 100%. Changes save automatically and stay on until you reset them. Some objectives need a rule: Body Count needs knockouts.</p>` : `<div class="card pset">
      <div class="prow"><h3 class="h">Arena</h3>${segHtml('p_arena', CHALLENGES.map(c => [c.id, short[c.id]]), practice.arena)}</div>
      <div class="prow"><h3 class="h">Opponents</h3>${segHtml('p_opp', [[0,'None'],[1,'1'],[2,'2'],[3,'3']], practice.opp)}</div>
      <div class="prow"><h3 class="h">Teammates</h3>${segHtml('p_mates', [[0,'None'],[1,'1'],[2,'2']], practice.mates)}</div>
      <div class="prow"><h3 class="h">Goalies</h3>${segHtml('p_goalies', [['both','Both'],['mine','Mine only'],['theirs','Theirs only'],['none','None']], practice.goalies)}</div>
      <div class="prow"><h3 class="h">Opponent effort</h3>${segHtml('p_effort', [['passive','Passive'],['light','Light'],['full','Full game']], practice.effort)}
        <p class="gfxnote">Passive and Light opponents never body-check. When they get the puck they lob it toward center ice, then back off or loop behind their net.</p></div>
      <div class="prow"><h3 class="h">Clock</h3>${segHtml('p_clock', [[0,'Off'],[120,'2 min'],[300,'5 min']], practice.clock)}</div>
    </div>`}
    <div class="card pset"><div class="kitrow"><h3 class="h">Rules</h3>${game ? '<button class="btn ghost small" id="rulesReset" type="button">Standard rules</button>' : ''}</div>
      ${RULES.map(([k, l, d]) => `<label class="tog"><input type="checkbox" id="r_${k}" ${cfg.rules[k] ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="tl"><b>${l}</b><small>${d}${game && pracLive && k === 'hazards' ? ' · changing this restarts the period' : ''}</small></span></label>`).join('')}
    </div>
    <div class="card pset"><div class="kitrow"><h3 class="h">Team attributes</h3><button class="btn ghost small" id="pracReset" type="button">Reset to 100%</button></div>
      ${ATTRS.map(([k, l]) => `<div class="arow"><span class="al">${l}</span>${sl('home', k)}${sl('away', k)}</div>`).join('')}
    </div>
    <div class="btns"><button class="btn" id="pracGo" type="button">${goLbl}</button><button class="btn ghost" id="pracBack" type="button">${backLbl}</button></div>`;
  const segBind = (id, key, num) => $(id).querySelectorAll('button').forEach(b => b.onclick = () => { practice[key] = num ? Number(b.dataset.v) : b.dataset.v; savePractice(); $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  if (!game) { segBind('p_arena', 'arena'); segBind('p_opp', 'opp', true); segBind('p_mates', 'mates', true); segBind('p_goalies', 'goalies'); segBind('p_effort', 'effort'); segBind('p_clock', 'clock', true); }
  for (const [k] of RULES) $('r_' + k).onchange = e => { cfg.rules[k] = e.target.checked; persist(); };
  for (const tm of ['home','away']) for (const [k] of ATTRS) { const inp = $(`a_${tm}_${k}`); inp.oninput = () => { cfg.attrs[tm][k] = Number(inp.value)/100; $(`v_${tm}_${k}`).textContent = inp.value + '%'; persist(); }; }
  $('pracReset').onclick = () => { cfg.attrs = { home:defAttrs(), away:defAttrs() }; persist(); renderPractice(); };
  if (game) $('rulesReset').onclick = () => { gameCfg.rules = { ...DEFAULT_RULES }; saveGame(); renderPractice(); };
  const back = () => {
    if (pracLive && G && !G.attract) { paused = true; preparePause(G.state === 'end'); show('pause'); }
    else if (game && cfgFrom === 'brief' && selected != null) openBrief(selected);
    else { renderHub(); show('hub'); }
  };
  const go = () => {
    if (game) {
      if (!pracLive) return back();
      if (structKey() !== pracSnap) return startChallenge(selected);
      applyGameLive(); paused = false; show(null); return;
    }
    if (pracLive && G && G.practice && G.state !== 'end' && structKey() === pracSnap) { applyPracticeLive(); paused = false; show(null); } else startPractice();
  };
  $('pracGo').onclick = go; $('pracGoTop').onclick = go; $('pracBack').onclick = back;
}
function applyGameLive(){
  G.rules = { ...gameCfg.rules }; G.attr = JSON.parse(JSON.stringify(gameCfg.attrs));
  applyAttrsLive();
  toast('Settings applied', '', 1000, 'small');
}
function applyPracticeLive(){
  G.practice = JSON.parse(JSON.stringify(practice)); G.ch.practice = G.practice;
  G.rules = { ...practice.rules }; G.effort = practice.effort; G.attr = JSON.parse(JSON.stringify(practice.attrs));
  applyAttrsLive();
  for (const s of G.sk) s.drill = null;
  $('objText').textContent = condText(G.ch.obj, G.ch);
  toast('Settings applied', '', 1000, 'small');
}
function practiceCh(){
  const base = CHALLENGES.find(c => c.id === practice.arena) || CHALLENGES[0];
  return { ...base, title:'Practice', len:practice.clock, tier:3, start:null, short:false, obj:{ type:'practice' }, bonus:[],
    hz: practice.rules.hazards ? base.hz : {}, practice: JSON.parse(JSON.stringify(practice)) };
}
function startPractice(){
  ensureAudio();
  const c = practiceCh(); selected = null;
  newMatch(c, false);
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  $('aAbbr').textContent = c.opp.abbr; $('aSw').style.background = c.opp.jersey; $('aSw').style.boxShadow = `inset 0 -3px 0 ${c.opp.trim}`;
  $('arenaShort').textContent = 'PRACTICE';
  $('objText').textContent = condText(c.obj, c);
  show(null); paused = false;
  setTimeout(resize, 30);
  toast('Practice', 'Free play · no XP · pause for settings', 1700, 'small');
  wake();
}
function startAttract(){
  const c = CHALLENGES[nextChallengeIdx()];
  newMatch(c, true);
}
function showResults(r){
  const c = r.ch, nIdx = CHALLENGES.indexOf(c), hasNext = nIdx < CHALLENGES.length - 1 && unlockedIdx(nIdx + 1);
  const labels = [c.obj, c.bonus[0], c.bonus[1]];
  const levelUp = r.after.L > r.before.L;
  $('resCard').innerHTML = `
    <div class="resulthead ${r.objOk ? 'win' : 'lose'}" style="display:flex;flex-direction:column;gap:8px"><p class="eyebrow">${c.arena.toUpperCase()} · ${c.title.toUpperCase()}</p><h2>${r.objOk ? 'Objective complete' : 'Objective failed'}</h2></div>
    <div class="final"><div><div class="n">${r.score.home}</div><div class="who">RATS</div></div><div class="dash">–</div><div><div class="n">${r.score.away}</div><div class="who">${c.opp.abbr}</div></div></div>
    <p class="lede" style="font-size:14px;text-align:center">Shots ${r.sog.home}–${r.sog.away} · Body count ${r.kos.home}–${r.kos.away}</p>
    <ul class="goals">${labels.map((g,i) => `<li class="${r.got[i]?'ok':'no'}"><span class="${r.got[i]?'star-on':'star-off'}">${svg('star', true)}</span><span>${condText(g, c)}</span><span class="tag">${r.newStars[i] ? 'NEW STAR' : r.got[i] ? 'DONE' : 'MISSED'}</span></li>`).join('')}</ul>
    <dl class="xprows">${r.rows.map(([k,v]) => `<div><dt>${k}</dt><dd>+${v}</dd></div>`).join('')}<div class="tot"><dt>XP earned</dt><dd>+${r.total}</dd></div></dl>
    <div class="lvl"><div class="lvbadge"><small>LEVEL</small><span>${r.after.L}</span></div><div class="xpbar"><i id="resXp"></i></div><div class="xptext">${levelUp ? `<b>Level up!</b> ` : ''}<b>${r.after.into}</b> / ${r.after.need} XP to level ${r.after.L+1}</div></div>
    ${r.unlocked.map(k => `<div class="unlock"><span class="ic">${svg(k)}</span><div><b>Unlocked: ${POWERS[k].name}</b><span>${POWERS[k].desc}${save.loadout.includes(k) ? ' Added to your loadout.' : ''}</span></div></div>`).join('')}
    ${r.slotsUp ? `<div class="unlock"><span class="ic">${svg('star', true)}</span><div><b>New loadout slot</b><span>You can now carry ${slotsFor(r.after.L)} power-ups.</span></div></div>` : ''}
    <div class="btns">
      ${r.objOk && hasNext ? `<button class="btn" id="resNext" type="button">Next: ${CHALLENGES[nIdx+1].title}</button>` : ''}
      <button class="btn ${r.objOk && hasNext ? 'ghost' : ''}" id="resRetry" type="button">${r.objOk ? 'Replay for more XP' : 'Try again'}</button>
      ${r.unlocked.length ? `<button class="btn ghost" id="resKit" type="button">Edit loadout</button>` : ''}
      <button class="btn ghost" id="resHub" type="button">Back to the locker room</button>
    </div>`;
  show('results');
  const startW = levelUp ? 0 : (r.before.into/r.before.need*100);
  const bar = $('resXp'); bar.style.transition = 'none'; bar.style.width = startW.toFixed(1) + '%';
  requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.transition = ''; bar.style.width = (r.after.into/r.after.need*100).toFixed(1) + '%'; }));
  if (levelUp) sfx('level');
  if ($('resNext')) $('resNext').onclick = () => openBrief(nIdx + 1);
  $('resRetry').onclick = () => startChallenge(nIdx);
  if ($('resKit')) $('resKit').onclick = () => { selected = nIdx; openKit('brief'); };
  $('resHub').onclick = () => { renderHub(); show('hub'); startAttract(); };
}
// ---------------- feel tuning panel (` key or the pause menu); the game keeps running while it's open
function buildTunePanel(){
  let el = $('tune');
  if (!el) { el = document.createElement('aside'); el.id = 'tune'; el.className = 'tune'; el.hidden = true; el.setAttribute('aria-label', 'Feel tuning'); stage.appendChild(el); }
  const fmt = (v, st) => st >= 1 ? String(Math.round(v)) : st >= 0.1 ? v.toFixed(1) : v.toFixed(2);
  el.innerHTML = `<div class="tune-head"><b>Feel tuning</b><span>live · saved in this browser</span><button class="ib" id="tuneClose" type="button" aria-label="Close tuning">×</button></div>
    <div class="tune-body">${TUNE_DEF.map(([grp, items]) => `<h4>${grp}</h4>` + items.map(([k, label, mn, mx, st, d, unit]) => `
      <label class="trow${TUNE[k] !== d ? ' changed' : ''}" data-k="${k}"><span class="tl">${label}</span><input type="range" min="${mn}" max="${mx}" step="${st}" value="${TUNE[k]}" data-k="${k}" data-st="${st}" data-d="${d}"><span class="tv">${fmt(TUNE[k], st)}${unit && unit !== '°' && unit !== '×' ? ' ' : ''}${unit}</span></label>`).join('')).join('')}</div>
    <div class="tune-foot"><button class="btn ghost small" id="tuneCopy" type="button">Copy values</button><button class="btn ghost small" id="tuneReset" type="button">Reset all</button><span id="tuneMsg" aria-live="polite"></span></div>`;
  el.querySelectorAll('input[type=range]').forEach(inp => {
    const k = inp.dataset.k, st = Number(inp.dataset.st), unit = TUNE_DEF.flatMap(g => g[1]).find(x => x[0] === k)[6];
    inp.oninput = () => { TUNE[k] = Number(inp.value); inp.nextElementSibling.textContent = fmt(TUNE[k], st) + (unit && unit !== '°' && unit !== '×' ? ' ' : '') + unit; inp.parentElement.classList.toggle('changed', TUNE[k] !== Number(inp.dataset.d)); saveTune(); };
    inp.onchange = () => inp.blur();   // hand the keyboard straight back to the game
    inp.addEventListener('pointerup', () => setTimeout(() => inp.blur(), 0));
  });
  $('tuneClose').onclick = () => toggleTune(false);
  $('tuneReset').onclick = () => { for (const [, items] of TUNE_DEF) for (const [k, , , , , d] of items) TUNE[k] = d; saveTune(); buildTunePanel(); $('tune').hidden = false; $('tuneMsg').textContent = 'Back to defaults.'; };
  $('tuneCopy').onclick = async () => {
    const ch = {}; for (const [, items] of TUNE_DEF) for (const [k, , , , , d] of items) if (TUNE[k] !== d) ch[k] = TUNE[k];
    const txt = JSON.stringify(ch, null, 1); let ok = false; try { await navigator.clipboard.writeText(txt); ok = true; } catch(e) {}
    $('tuneMsg').textContent = ok ? (Object.keys(ch).length ? 'Copied your changes.' : 'Nothing changed yet.') : txt;
  };
}
function toggleTune(on){
  if (!$('tune')) buildTunePanel();
  const el = $('tune'); el.hidden = on == null ? !el.hidden : !on;
  if (!el.hidden && paused && G && !G.attract && G.state !== 'end') setPaused(false);
}
function preparePause(over){
  const pr = !!G.practice;
  $('btnPracSet').hidden = false;
  $('btnPracSet').textContent = pr ? 'Practice settings' : 'Rules and sliders';
  $('btnRestart').textContent = pr ? 'Restart practice' : 'Restart challenge';
  $('btnResume').hidden = !!over;
  $('pauseTitle').textContent = over ? 'Practice over' : 'Timeout';
  $('pauseInfo').textContent = pr ? (over ? `Practice over · ${G.score.home}–${G.score.away}` : `Practice · ${G.score.home}–${G.score.away}`) : `${G.ch.title} · ${fmtClock(G.clock)} left`;
}
function setPaused(p){
  if (!G || G.attract) return;
  if (!p && G.state === 'end') return;
  paused = p;
  if (p) { preparePause(G.state === 'end'); keys.clear(); joy.id = null; const s = ctrlSk(); if (s) s.charging = false; show('pause'); }
  else show(null);
}
$('btnPause').onclick = () => setPaused(!paused);
$('btnResume').onclick = () => setPaused(false);
$('btnRestart').onclick = () => { paused = false; if (G && G.practice) startPractice(); else startChallenge(selected); };
$('btnTune').onclick = () => toggleTune(true);
$('btnPracSet').onclick = () => { if (G && G.practice) openPractice(true); else openGameCfg('pause'); };
$('btnQuit').onclick = () => { paused = false; renderHub(); show('hub'); startAttract(); };
function syncSound(){ $('btnSound').setAttribute('aria-pressed', String(muted)); $('btnSound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound'); $('icoOn').hidden = muted; $('icoOff').hidden = !muted; }
$('btnSound').onclick = () => { muted = !muted; ensureAudio(); try { localStorage.setItem('rinkrat-mute', muted ? '1' : '0'); } catch(e) {} syncSound(); };
syncSound();
$('btnCtrls').onclick = () => { ctrlBarOn = !ctrlBarOn; try { localStorage.setItem('rinkrat-ctrlbar', ctrlBarOn ? '1' : '0'); } catch(e) {} renderCtrlBar(); };
renderCtrlBar();
let wakeLock = null;
async function wake(){ try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch(e) { wakeLock = null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G && !G.attract && G.state !== 'end' && !paused && $('results').hidden) setPaused(true); } else if (G && !G.attract) wake(); });
document.addEventListener('pointerdown', ensureAudio, { once:true });

new ResizeObserver(resize).observe(stage);
startAttract();
renderHub(); show('hub');
resize();
if (document.fonts && document.fonts.load) document.fonts.load('16px Bungee').catch(()=>{});
requestAnimationFrame(frame);
})();
