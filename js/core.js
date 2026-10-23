// Rink Rat Mayhem · Shared helpers, rink geometry, content (powers, challenges, teams, species), progression and saves
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
const GAME_VERSION = 'v1.5.0';
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
