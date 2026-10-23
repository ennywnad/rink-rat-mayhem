// Rink Rat Mayhem · Versus: multi-period exhibition games (P1 vs P2, co-op vs CPU, or solo vs CPU) with intermissions and stats
'use strict';
const vsDef = () => ({ team:'magma', arena:'boneyard', players:'vs', skaters:3, periods:3, len:180, cpu:4,
  rules:{ icing:true, faceoffs:true, checking:true, kos:true, hazards:true, powerups:true } });
let vsCfg = vsDef();
try { const v = JSON.parse(localStorage.getItem('rinkrat-vs') || 'null'); if (v && typeof v === 'object') { const d = vsDef(); vsCfg = { ...d, ...v, rules:{ ...d.rules, ...(v.rules || {}) } }; } } catch(e) {}
const saveVs = () => { try { localStorage.setItem('rinkrat-vs', JSON.stringify(vsCfg)); } catch(e) {} };
const VS_RULES = [['icing','Icing'],['checking','Body checking'],['kos','Knockouts'],['hazards','Arena hazards'],['powerups','Power-up crates']];
const ARENA_SHORT = { boneyard:'Boneyard', magma:'Magma', mines:'Mines', sludge:'Sludge', orbital:'Orbital', sawmill:'Sawmill', abyss:'Abyss' };

function openVersus(){ renderVersus(); show('vsset'); }
function renderVersus(){
  const cpuInvolved = vsCfg.players !== 'vs';
  $('vsWrap').innerHTML = `
    <div class="sticky"><div style="display:flex;flex-direction:column;gap:6px"><h2 class="h">Versus</h2><span class="slots">FULL GAMES · PERIODS · NO XP</span></div><button class="btn small" id="vsGoTop" type="button">Start</button></div>
    <div class="card pset">
      <div class="prow"><h3 class="h">Players</h3>${segHtml('v_players', [['vs','P1 vs P2'],['coop','P1 + P2 vs CPU'],['1p','P1 vs CPU']], vsCfg.players)}
        <p class="gfxnote" id="v_devs">${playersNote(vsCfg.players)}</p></div>
      <div class="prow"><h3 class="h">${vsCfg.players === 'vs' ? 'Player 2 plays as' : 'Opponent'}</h3>
        <div class="teamgrid" id="v_team">${CHALLENGES.map(c => `<button type="button" class="teambtn" data-v="${c.id}" aria-pressed="${c.id === vsCfg.team}"><i class="swatch" style="background:${(A11Y.cb ? CB_AWAY : c.opp).jersey};box-shadow:inset 0 -4px 0 ${(A11Y.cb ? CB_AWAY : c.opp).trim}"></i><span><b>${c.opp.name}</b><small>${c.opp.species}</small></span></button>`).join('')}</div>
        <p class="gfxnote">Player 1 always skates for the Rink Rats.</p></div>
      <div class="prow"><h3 class="h">Arena</h3>${segHtml('v_arena', CHALLENGES.map(c => [c.id, ARENA_SHORT[c.id]]), vsCfg.arena)}</div>
      <div class="prow"><h3 class="h">Skaters per side</h3>${segHtml('v_sk', [[2,'2 + goalie'],[3,'3 + goalie']], vsCfg.skaters)}</div>
      <div class="prow"><h3 class="h">Periods</h3>${segHtml('v_per', [[1,'1'],[2,'2'],[3,'3']], vsCfg.periods)}</div>
      <div class="prow"><h3 class="h">Period length</h3>${segHtml('v_len', [[120,'2 min'],[180,'3 min'],[300,'5 min']], vsCfg.len)}</div>
      ${cpuInvolved ? `<div class="prow"><h3 class="h">CPU skill</h3>${segHtml('v_cpu', [[2,'Rookie'],[4,'Pro'],[7,'Mayhem']], vsCfg.cpu)}</div>` : ''}
      <p class="gfxnote">A tie after the last period goes to sudden-death overtime.</p>
    </div>
    <div class="card pset"><h3 class="h">Rules</h3>
      ${VS_RULES.map(([k, l]) => `<label class="tog"><input type="checkbox" id="vr_${k}" ${vsCfg.rules[k] ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="tl"><b>${l}</b></span></label>`).join('')}
    </div>
    <div class="btns"><button class="btn" id="vsGo" type="button">Start game</button><button class="btn ghost" id="vsBack" type="button">Back to the locker room</button></div>`;
  const bind = (id, key, num, rerender) => $(id).querySelectorAll('button').forEach(b => b.onclick = () => { vsCfg[key] = num ? Number(b.dataset.v) : b.dataset.v; saveVs(); if (rerender) return renderVersus(); $(id).querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  bind('v_players', 'players', false, true); bind('v_team', 'team'); bind('v_arena', 'arena'); bind('v_sk', 'skaters', true); bind('v_per', 'periods', true); bind('v_len', 'len', true);
  if ($('v_cpu')) bind('v_cpu', 'cpu', true);
  for (const [k] of VS_RULES) $('vr_' + k).onchange = e => { vsCfg.rules[k] = e.target.checked; saveVs(); };
  $('vsGo').onclick = startVersus; $('vsGoTop').onclick = startVersus;
  $('vsBack').onclick = () => { renderHub(); show('hub'); };
}
function versusCh(){
  const base = CHALLENGES.find(c => c.id === vsCfg.arena) || CHALLENGES[0], rival = CHALLENGES.find(c => c.id === vsCfg.team) || CHALLENGES[1];
  return { ...base, title:'Versus', opp:{ ...rival.opp }, cpu: rival.cpu, len:vsCfg.len, tier:vsCfg.cpu, start:null, short:false, obj:{ type:'versus' }, bonus:[],
    hz: vsCfg.rules.hazards ? base.hz : {}, vsCfg: JSON.parse(JSON.stringify(vsCfg)) };
}
function startVersus(){
  ensureAudio();
  const c = versusCh(); selected = null;
  newMatch(c, false, vsCfg.players);
  G.vs = { periods:vsCfg.periods, period:1, log:[], ot:false, base:{ home:0, away:0 } };
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  $('aAbbr').textContent = c.opp.abbr; $('aSw').style.background = G.ch.opp.jersey; $('aSw').style.boxShadow = `inset 0 -3px 0 ${G.ch.opp.trim}`;
  $('arenaShort').textContent = 'VERSUS';
  $('objText').textContent = condText(c.obj, c);
  show(null); paused = false; renderCtrlBar();
  setTimeout(resize, 30);
  toast('Versus', `${periodName(1)} period`, 1500, 'small');
  if (typeof organ === 'function') organ('intro');
  wake();
}
const vsText = () => !G || !G.vs ? 'Versus' : G.vs.ot ? 'Overtime · next goal wins' : `${periodName(G.vs.period)} period of ${G.vs.periods}`;
// called from endMatch (clock ran out) and after an overtime goal
function versusEnd(){
  const V = G.vs;
  V.log.push({ name: V.ot ? 'OT' : periodName(V.period), home:G.score.home - V.base.home, away:G.score.away - V.base.away }); V.base = { ...G.score };
  if (!V.ot && V.period < V.periods) return setTimeout(() => showIntermission(false), 1400);
  if (!V.ot && G.score.home === G.score.away) return setTimeout(() => showIntermission(true), 1400);
  setTimeout(showVersusFinal, 1400);
}
function winnerName(){
  const h = G.score.home, a = G.score.away; if (h === a) return 'Tie game';
  if (G.mode === 'vs') return h > a ? 'Player 1 wins!' : 'Player 2 wins!';
  return h > a ? 'Rats win!' : `${G.ch.opp.name} win`;
}
function showIntermission(ot){
  if (!G || !G.vs) return;
  const V = G.vs;
  $('interWrap').innerHTML = `<div class="card" style="width:100%">
    <p class="eyebrow">${ot ? 'TIED AFTER REGULATION' : 'INTERMISSION'}</p>
    <h2 class="h" style="font-size:30px">${ot ? 'Overtime next' : `End of the ${periodName(V.period)}`}</h2>
    <div class="final"><div><div class="n">${G.score.home}</div><div class="who">${teamLabel('home')}</div></div><div class="dash">–</div><div><div class="n">${G.score.away}</div><div class="who">${teamLabel('away')}</div></div></div>
    ${statsTable(V.log)}
    <div class="btns"><button class="btn" id="interGo" type="button">${ot ? 'Start overtime' : `Start the ${periodName(V.period + 1)} period`}</button><button class="btn ghost" id="interQuit" type="button">Quit to locker room</button></div></div>`;
  show('inter');
  if (typeof organ === 'function') organ('inter');
  $('interGo').onclick = () => {
    if (ot) { V.ot = true; G.ch.len = 0; V.period = 4; } else V.period++;
    G.clock = G.ch.len; G.endT = 0;
    $('objText').textContent = vsText();
    show(null); paused = false;
    startRegroup({ x:CX, y:100 });
    toast(ot ? 'Overtime' : `${periodName(V.period)} period`, ot ? 'Next goal wins' : '', 1500, 'small');
    if (typeof organ === 'function') organ('intro');
  };
  $('interQuit').onclick = () => { paused = false; renderHub(); show('hub'); startAttract(); };
}
function showVersusFinal(){
  if (!G || !G.vs) return;
  const h = G.score.home, a = G.score.away, homeWon = h > a;
  $('interWrap').innerHTML = `<div class="card" style="width:100%">
    <div class="resulthead ${homeWon ? 'win' : 'lose'}"><p class="eyebrow">VERSUS · ${G.ch.arena.toUpperCase()}</p><h2>${winnerName()}</h2></div>
    <div class="final"><div><div class="n">${h}</div><div class="who">${teamLabel('home')}</div></div><div class="dash">–</div><div><div class="n">${a}</div><div class="who">${teamLabel('away')}</div></div></div>
    ${statsTable(G.vs.log)}
    <div class="btns"><button class="btn" id="vfRematch" type="button">Rematch</button><button class="btn ghost" id="vfSetup" type="button">Change the setup</button><button class="btn ghost" id="vfHub" type="button">Back to the locker room</button></div></div>`;
  show('inter');
  $('vfRematch').onclick = startVersus;
  $('vfSetup').onclick = () => { startAttract(); openVersus(); };
  $('vfHub').onclick = () => { renderHub(); show('hub'); startAttract(); };
}
// the pause menu's "Game stats" view for any mode
function showStatsFromPause(){
  if (!G || G.attract) return;
  $('interWrap').innerHTML = `<div class="card" style="width:100%">
    <p class="eyebrow">${G.vs ? vsText().toUpperCase() : G.ch.title.toUpperCase()}</p><h2 class="h" style="font-size:28px">Game stats</h2>
    <div class="final"><div><div class="n">${G.score.home}</div><div class="who">${teamLabel('home')}</div></div><div class="dash">–</div><div><div class="n">${G.score.away}</div><div class="who">${teamLabel('away')}</div></div></div>
    ${statsTable(G.vs ? G.vs.log.concat([{ name: G.vs.ot ? 'OT' : periodName(G.vs.period), home:G.score.home - G.vs.base.home, away:G.score.away - G.vs.base.away }]) : null)}
    <div class="btns"><button class="btn" id="statsBack" type="button">Back to the pause menu</button></div></div>`;
  show('inter');
  $('statsBack').onclick = () => { preparePause(G.state === 'end'); show('pause'); };
}
