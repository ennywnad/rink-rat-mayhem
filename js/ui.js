// Rink Rat Mayhem · Menus: locker room, challenge brief, loadout, practice/versus setup, results, pause, tuning panel and sound buttons
'use strict';
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
    <div class="card gfx"><h3 class="h">Sound</h3>
      <label class="tog"><input type="checkbox" id="sndOn" ${muted ? '' : 'checked'}><span class="sw" aria-hidden="true"></span><span class="tl"><b>Sound</b><small>Also the speaker button in the scoreboard, or press M</small></span></label>
      <label class="sl home snd"><span>Volume</span><input type="range" id="sndVol" min="0" max="100" step="5" value="${Math.round(volume*100)}"><b id="sndVolV">${Math.round(volume*100)}%</b></label>
      <label class="sl home snd"><span>Crowd</span><input type="range" id="sndCrowd" min="0" max="100" step="5" value="${Math.round(crowdVol*100)}"><b id="sndCrowdV">${Math.round(crowdVol*100)}%</b></label></div>
    <div class="card gfx"><div class="kitrow"><div style="display:flex;flex-direction:column;gap:4px;min-width:0"><h3 class="h">Controls</h3><span class="xptext">Remap keys and controller buttons. Two players: one keyboard, keyboard + controller, or two controllers.</span></div><button class="btn ghost small" id="btnControls" type="button">Change</button></div></div>
    <div class="card gfx"><h3 class="h">Accessibility</h3>
      <label class="tog"><input type="checkbox" id="a_cb" ${A11Y.cb ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="tl"><b>Color-blind friendly teams</b><small>Rats in amber and black, every opponent in blue and white; health bars go blue to magenta</small></span></label>
      <label class="tog"><input type="checkbox" id="a_rm" ${A11Y.rm ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="tl"><b>Reduce motion</b><small>No screen shake, goal-light flashing, speed lines or pulsing buttons</small></span></label>
      <label class="tog"><input type="checkbox" id="a_rp" ${replayOn ? 'checked' : ''}><span class="sw" aria-hidden="true"></span><span class="tl"><b>Goal replays</b><small>A slow-motion replay after each goal; shoot or pass to skip it</small></span></label>
      <div class="prow"><span class="xptext">On-screen buttons</span>${segHtml('a_btn', [['normal','Normal'],['large','Large'],['xl','Extra large']], A11Y.btn)}</div></div>
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
  $('sndOn').onchange = e => setMuted(!e.target.checked);
  $('btnControls').onclick = () => openControls('hub');
  $('a_cb').onchange = e => { A11Y.cb = e.target.checked; saveA11y(); applyA11y(); if (G && G.attract) startAttract(); };
  $('a_rp').onchange = e => { replayOn = e.target.checked; try { localStorage.setItem('rinkrat-replays', replayOn ? '1' : '0'); } catch(err) {} };
  $('a_rm').onchange = e => { A11Y.rm = e.target.checked; saveA11y(); applyA11y(); };
  $('a_btn').querySelectorAll('button').forEach(b => b.onclick = () => { A11Y.btn = b.dataset.v; saveA11y(); applyA11y(); $('a_btn').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); });
  $('sndVol').oninput = e => { volume = Number(e.target.value)/100; $('sndVolV').textContent = e.target.value + '%'; try { localStorage.setItem('rinkrat-vol', String(volume)); } catch(err) {} ensureAudio(); applyVolume(); };
  $('sndCrowd').oninput = e => { crowdVol = Number(e.target.value)/100; $('sndCrowdV').textContent = e.target.value + '%'; try { localStorage.setItem('rinkrat-crowdvol', String(crowdVol)); } catch(err) {} ensureAudio(); applyVolume(); };
  $('sndVol').onchange = () => { sfx('stick', 1); };
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
let chMode = '1p';
try { chMode = localStorage.getItem('rinkrat-chmode') === 'coop' ? 'coop' : '1p'; } catch(e) {}
function playersNote(mode){
  if (mode === '1p') return 'Keyboard, touch or any controller.';
  const saved = G; G = { attract:false, mode, ch:{} };
  const txt = `P1: ${deviceLabel(0)} · P2: ${deviceLabel(1)}` + (mode === 'vs' ? ' · P2 plays for the other team' : ' · both on the Rats');
  G = saved; return txt;
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
    <div class="prow"><div class="kitrow"><span class="xptext">Players</span>${segHtml('chPlayers', [['1p','Solo'],['coop','2P co-op']], chMode)}</div><p class="gfxnote" id="chDevs">${chMode === 'coop' ? playersNote('coop') : ''}</p></div>
    <div class="btns"><button class="btn" id="btnGo" type="button">Drop the puck</button><button class="btn ghost" id="btnBack" type="button">Back to the locker room</button></div>`;
  show('brief');
  $('btnGo').onclick = () => startChallenge(i);
  $('btnBack').onclick = () => show('hub');
  $('briefKit').onclick = () => openKit('brief');
  $('chPlayers').querySelectorAll('button').forEach(b => b.onclick = () => { chMode = b.dataset.v; try { localStorage.setItem('rinkrat-chmode', chMode); } catch(e) {} $('chPlayers').querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); $('chDevs').textContent = chMode === 'coop' ? playersNote('coop') : ''; });
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
  for (const id of ['hub','brief','kit','pause','results','prac','ctrls']) $(id).hidden = id !== which;
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
  newMatch(c, false, chMode);
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  $('aAbbr').textContent = c.opp.abbr; $('aSw').style.background = G.ch.opp.jersey; $('aSw').style.boxShadow = `inset 0 -3px 0 ${G.ch.opp.trim}`;
  $('arenaShort').textContent = c.arena.toUpperCase().slice(0, 14);
  $('objText').textContent = condText(c.obj, c);
  show(null); paused = false; renderCtrlBar();
  setTimeout(resize, 30);
  toast(c.title, c.start ? `Down ${c.start[0]}–${c.start[1]}. ${condText(c.obj, c)}` : condText(c.obj, c), 1700, 'small');
  wake();
}
// ---------------- practice / game settings
let pracLive = false, pracSnap = '', cfgMode = 'practice', cfgFrom = 'hub';
const STRUCT_KEYS = ['arena','players','opp','mates','goalies','clock'];
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
      <div class="prow"><h3 class="h">Players</h3>${segHtml('p_players', [['1p','1 player'],['coop','2P co-op'],['vs','2P versus']], practice.players)}
        <p class="gfxnote" id="p_devs">${playersNote(practice.players)}</p></div>
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
  if (!game) { segBind('p_players', 'players'); $('p_players').addEventListener('click', () => { $('p_devs').textContent = playersNote(practice.players); }); segBind('p_arena', 'arena'); segBind('p_opp', 'opp', true); segBind('p_mates', 'mates', true); segBind('p_goalies', 'goalies'); segBind('p_effort', 'effort'); segBind('p_clock', 'clock', true); }
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
  if (practice.players === 'coop' && practice.mates < 1) practice.mates = 1;     // P2 needs a skater
  if (practice.players === 'vs' && practice.opp < 1) practice.opp = 1;
  return { ...base, title:'Practice', len:practice.clock, tier:3, start:null, short:false, obj:{ type:'practice' }, bonus:[],
    hz: practice.rules.hazards ? base.hz : {}, practice: JSON.parse(JSON.stringify(practice)) };
}
function startPractice(){
  ensureAudio();
  const c = practiceCh(); selected = null;
  newMatch(c, false, practice.players);
  Object.keys(hudCache).forEach(k => delete hudCache[k]);
  $('aAbbr').textContent = c.opp.abbr; $('aSw').style.background = G.ch.opp.jersey; $('aSw').style.boxShadow = `inset 0 -3px 0 ${G.ch.opp.trim}`;
  $('arenaShort').textContent = practice.players === 'vs' ? 'VERSUS' : 'PRACTICE';
  $('objText').textContent = condText(c.obj, c);
  show(null); paused = false; renderCtrlBar();
  setTimeout(resize, 30);
  toast('Practice', 'Free play · no XP · pause for settings', 1700, 'small');
  wake();
}
function startAttract(){
  const c = CHALLENGES[nextChallengeIdx()];
  newMatch(c, true);
}
function showResults(r){
  const c = r.ch.base || r.ch, nIdx = CHALLENGES.indexOf(c), hasNext = nIdx < CHALLENGES.length - 1 && unlockedIdx(nIdx + 1);
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
  if (p) { preparePause(G.state === 'end'); keys.clear(); joy.id = null; for (let p = 0; p < humans(); p++) { const s = humanSk(p); if (s) s.charging = false; } show('pause'); }
  else show(null);
}
$('btnPause').onclick = () => setPaused(!paused);
$('btnResume').onclick = () => setPaused(false);
$('btnRestart').onclick = () => { paused = false; if (G && G.practice) startPractice(); else startChallenge(selected); };
$('btnTune').onclick = () => toggleTune(true);
$('btnPauseCtrls').onclick = () => openControls('pause');
applyA11y();
$('btnPracSet').onclick = () => { if (G && G.practice) openPractice(true); else openGameCfg('pause'); };
$('btnQuit').onclick = () => { paused = false; renderHub(); show('hub'); startAttract(); };
function syncSound(){
  $('btnSound').setAttribute('aria-pressed', String(muted)); $('btnSound').setAttribute('aria-label', muted ? 'Turn sound on' : 'Mute sound'); $('icoOn').hidden = muted; $('icoOff').hidden = !muted;
  const pm = $('btnMute'); if (pm) pm.textContent = muted ? 'Sound: off' : 'Sound: on';
  const hm = $('sndOn'); if (hm) hm.checked = !muted;
}
function setMuted(m){ muted = !!m; ensureAudio(); applyVolume(); try { localStorage.setItem('rinkrat-mute', muted ? '1' : '0'); } catch(e) {} syncSound(); if (G && !G.attract) toast(muted ? 'Sound off' : 'Sound on', '', 900, 'small'); }
$('btnSound').onclick = () => setMuted(!muted);
$('btnMute').onclick = () => setMuted(!muted);
syncSound();
$('btnCtrls').onclick = () => { ctrlBarOn = !ctrlBarOn; try { localStorage.setItem('rinkrat-ctrlbar', ctrlBarOn ? '1' : '0'); } catch(e) {} renderCtrlBar(); };
renderCtrlBar();
let wakeLock = null;
