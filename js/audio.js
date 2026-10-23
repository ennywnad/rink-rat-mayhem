// Rink Rat Mayhem · Audio: sample pack loader, mixer, crowd bed, sound effects and synth fallback
'use strict';
// ---------------- audio
// Sample pack in assets/sfx (built by tools/gen_sfx.py). Mixer: effects + crowd buses -> compressor -> master volume.
// If a sample hasn't loaded (or fails), the old synthesised version plays instead.
let AC = null, noise = null, master = null, sfxBus = null, crowdBus = null, crowdGain = null, crowdSrc = null;
let volume = 0.8, crowdVol = 0.6, musicVol = 0.6, musicBus = null;
try { const v = parseFloat(localStorage.getItem('rinkrat-vol')); if (v >= 0 && v <= 1) volume = v; const c = parseFloat(localStorage.getItem('rinkrat-crowdvol')); if (c >= 0 && c <= 1) crowdVol = c; const m = parseFloat(localStorage.getItem('rinkrat-musicvol')); if (m >= 0 && m <= 1) musicVol = m; } catch(e) {}
const SFX_SET = { zamhorn:1, zamengine:1, stick:4, shot:3, slap:3, board:3, post:2, pad:3, check:3, skate:4, stop:2, whistle:1, horn:1, buzzer:1, boom:1, splash:1, fire:1, zap:1, thunder:1, freeze:1, grow:1, rocket:1, saw:1, pickup:1, ko:1, level:1, cheer:1, aww:1, crowd:1 };
const SFX_GAIN = { zamhorn:0.4, stick:0.5, shot:0.7, slap:0.85, board:0.7, post:0.55, pad:0.6, check:0.85, skate:0.16, stop:0.32, whistle:0.42, horn:0.5, buzzer:0.45, boom:0.8, splash:0.6, fire:0.55, zap:0.5, thunder:0.75, freeze:0.5, grow:0.6, rocket:0.55, saw:0.45, pickup:0.45, ko:0.55, level:0.5, cheer:0.75, aww:0.55 };
const SFX_GAP = { skate:0.1, stick:0.04, cheer:1.5, aww:1.5 };
const NO_PITCH = new Set(['zamhorn', 'whistle', 'horn', 'buzzer', 'level', 'pickup', 'cheer', 'aww']);
const sfxRaw = {}, sfxBuf = {}, sfxLast = {};
// fetch the bytes right away; decode once the audio context exists (after the first tap / key / button)
for (const [name, n] of Object.entries(SFX_SET)) for (let i=0;i<n;i++) {
  const key = `${name}_${i}`;
  sfxRaw[key] = fetch(`assets/sfx/${key}.mp3`).then(r => r.ok ? r.arrayBuffer() : null).catch(() => null);
}
let sfxDecoding = false;
function decodeSfx(){
  if (sfxDecoding || !AC) return; sfxDecoding = true;
  for (const [name, n] of Object.entries(SFX_SET)) for (let i=0;i<n;i++) {
    sfxRaw[`${name}_${i}`].then(ab => ab && new Promise((res, rej) => AC.decodeAudioData(ab, res, rej))).then(buf => {
      if (!buf) return; (sfxBuf[name] || (sfxBuf[name] = [])).push(buf);
      if (name === 'crowd') startCrowd();
    }).catch(() => {});
  }
  decodeMusic();
}
function ensureAudio(){
  if (!AC) {
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { AC = null; }
    if (AC) {
      const comp = AC.createDynamicsCompressor(); comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.25;
      master = AC.createGain(); master.gain.value = muted ? 0 : volume;
      sfxBus = AC.createGain(); crowdBus = AC.createGain(); crowdBus.gain.value = crowdVol; musicBus = AC.createGain(); musicBus.gain.value = musicVol;
      sfxBus.connect(comp); crowdBus.connect(comp); comp.connect(master); musicBus.connect(master); master.connect(AC.destination);
      decodeSfx();
    }
  }
  if (AC && AC.state === 'suspended') AC.resume().catch(()=>{});
  if (AC && !noise) { noise = AC.createBuffer(1, AC.sampleRate, AC.sampleRate); const d = noise.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = Math.random()*2-1; }
}
function applyA11y(){
  app.dataset.btn = A11Y.btn; document.body.classList.toggle('rm', !!A11Y.rm);
  JR = A11Y.btn === 'xl' ? 66 : A11Y.btn === 'large' ? 56 : 46;
}
function applyVolume(){
  if (!AC) return; const t = AC.currentTime;
  master.gain.setTargetAtTime(muted ? 0 : volume, t, 0.03); crowdBus.gain.setTargetAtTime(crowdVol, t, 0.05); musicBus.gain.setTargetAtTime(musicVol, t, 0.05);
}
function startCrowd(){
  if (crowdSrc || !sfxBuf.crowd) return;
  crowdSrc = AC.createBufferSource(); crowdSrc.buffer = sfxBuf.crowd[0]; crowdSrc.loop = true;
  crowdGain = AC.createGain(); crowdGain.gain.value = 0; crowdSrc.connect(crowdGain); crowdGain.connect(crowdBus); crowdSrc.start();
}
// crowd murmur swells when the puck is near a net and dips when the game is paused
function updateCrowd(){
  if (!crowdGain) return;
  let target = 0.12;
  if (G && !G.attract) {
    if (paused || G.state === 'end') target = 0.06;
    else { const P = G.pucks[0], dn = Math.min(Math.abs(P.y - GT), Math.abs(P.y - GB)); target = 0.24 + 0.4*clamp(1 - dn/45, 0, 1) + (G.goalLight ? 0.25 : 0); }
  }
  crowdGain.gain.setTargetAtTime(target, AC.currentTime, 0.5);
}
function playSample(name, gain, rate){
  const list = sfxBuf[name]; if (!list || !list.length) return false;
  let i = Math.floor(Math.random()*list.length); if (list.length > 1 && i === sfxLast[name]) i = (i + 1) % list.length; sfxLast[name] = i;
  const src = AC.createBufferSource(); src.buffer = list[i]; src.playbackRate.value = rate;
  const g = AC.createGain(); g.gain.value = gain; src.connect(g); g.connect(sfxBus); src.start();
  return true;
}
const lastSfx = {};
function sfx(type, v=1){
  if (!AC || muted || (G && (G.attract || G.replay))) return;
  const t = AC.currentTime;
  if (lastSfx[type] && t - lastSfx[type] < (SFX_GAP[type] || 0.05)) return; lastSfx[type] = t;
  let name = type, g = 1;
  if (type === 'shot') { name = v > 0.62 ? 'slap' : 'shot'; g = 0.75 + 0.35*Math.min(1, v); }
  else if (type === 'board') g = clamp(v/40, 0.25, 1.1);
  else if (type === 'pad' || type === 'stick' || type === 'skate' || type === 'stop') g = clamp(v, 0.3, 1.1);
  if (playSample(name, (SFX_GAIN[name] || 0.5)*g, NO_PITCH.has(name) ? 1 : 0.95 + Math.random()*0.1)) return;
  synthSfx(type, v);
}
function synthSfx(type, v){
  const t = AC.currentTime, out = sfxBus;
  const burst = (dur, ft, freq, q, gain, f2) => {
    gain = Math.max(0.002, gain || 0);
    const s = AC.createBufferSource(); s.buffer = noise;
    const f = AC.createBiquadFilter(); f.type = ft; f.frequency.setValueAtTime(freq, t); if (f2) f.frequency.exponentialRampToValueAtTime(f2, t+dur); f.Q.value = q;
    const g = AC.createGain(); g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.001, t+dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random()*0.5); s.stop(t+dur+0.02);
  };
  const tone = (w, fr, dur, gain, att=0.005, fd, at=0) => {
    gain = Math.max(0.0002, gain || 0);
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
    case 'zamhorn': tone('square',392,0.26,0.05,0.01); tone('square',494,0.26,0.04,0.01); tone('square',392,0.4,0.05,0.01,null,0.38); tone('square',494,0.4,0.04,0.01,null,0.38); break;
    case 'buzzer': tone('square',196,1.0,0.08,0.01); tone('square',198.5,1.0,0.06,0.01); break;
    case 'level': [523,659,784,1047].forEach((f,i) => tone('square',f,0.18,0.07,0.005,null,i*0.09)); break;
  }
}

// ---------------- arena organ (the only music in the game)
// Cues from tools/gen_sfx.py: a charge for the opening faceoff, rallies when the Rats press, a goal fanfare, a sad trombone-ish
// fall for the other team's goals, little noodles at stoppages, a final-horn tag and a 16-bar loop for menus and intermissions.
const MUSIC_SET = { intro:1, rally:1, goal:1, sad:1, end:1, noodle:3, loop:1 };
const LOOP_LEN = 16*4*60/112;          // 16 bars at 112 bpm
const musRaw = {}, musBuf = {};
let musCue = null, musLoop = null, musSheet = 'hub', musDecoding = false;
function decodeMusic(){
  if (musDecoding || !AC) return; musDecoding = true;
  for (const [name, n] of Object.entries(MUSIC_SET)) for (let i=0;i<n;i++) {
    const file = n > 1 ? `org_${name}_${i}` : `org_${name}`;
    fetch(`assets/sfx/${file}.mp3`).then(r => r.ok ? r.arrayBuffer() : null).then(ab => ab && new Promise((res, rej) => AC.decodeAudioData(ab, res, rej)))
      .then(buf => { if (buf) (musBuf[name] || (musBuf[name] = [])).push(buf); }).catch(() => {});
  }
}
const cueOn = () => musCue && AC && musCue.end > AC.currentTime;
function fadeOut(node, f){
  const t = AC.currentTime;
  node.g.gain.cancelScheduledValues(t); node.g.gain.setValueAtTime(node.g.gain.value, t); node.g.gain.linearRampToValueAtTime(0, t + f);
  try { node.src.stop(t + f + 0.05); } catch(e) {}
}
function stopCue(f = 0.25){ if (musCue && AC) fadeOut(musCue, f); musCue = null; }
// play one cue; 'inter' asks for the loop instead
function organ(cue, delay = 0){
  if (!AC || !musicBus || (G && G.attract && cue !== 'inter')) return;
  if (cue === 'inter') { stopCue(0.4); return organLoop(true); }
  const list = musBuf[cue]; if (!list || !list.length) return;
  organLoop(false); stopCue(0.25);
  const buf = list[Math.floor(Math.random()*list.length)], t = AC.currentTime + delay;
  const src = AC.createBufferSource(); src.buffer = buf;
  const g = AC.createGain(); g.gain.value = 0.72; src.connect(g); g.connect(musicBus); src.start(t);
  musCue = { src, g, name:cue, end: t + buf.duration };
}
function organLoop(on){
  if (!AC || !musicBus) return;
  if (!on) { if (musLoop) { fadeOut(musLoop, 0.7); musLoop = null; } return; }
  if (musLoop || !musBuf.loop) return;
  const buf = musBuf.loop[0], lead = buf.duration - LOOP_LEN > 0.01 ? 1105/buf.sampleRate : 0;   // decoders that keep the mp3 encoder delay
  const src = AC.createBufferSource(); src.buffer = buf; src.loop = true; src.loopStart = lead; src.loopEnd = Math.min(buf.duration, lead + LOOP_LEN);
  const g = AC.createGain(), t = AC.currentTime; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.6, t + 1.6);
  src.connect(g); g.connect(musicBus); src.start(t, lead);
  musLoop = { src, g };
}
// show() reports which sheet is up; the loop plays under menus and intermissions (not the pause menu) once no cue is playing
function musicSheet(which){ musSheet = which; if (!which) organLoop(false); }
function musicFade(){ if (musCue && musCue.name !== 'rally') stopCue(1.4); }   // the puck drops: let the ice be heard
function musicTick(){
  if (!AC || !musicBus) return;
  const live = G && !G.attract && G.state !== 'end';
  if (musSheet && musSheet !== 'pause' && !live && !cueOn()) organLoop(true);
  if (!G || G.attract || G.replay || paused || G.state !== 'play' || musSheet) return;
  if (G.musNext == null) G.musNext = G.time + 35 + Math.random()*25;
  if (G.time < G.musNext || cueOn()) return;
  const y = G.pucks[0].y, press = G.mode === 'vs' ? Math.abs(y - 100) > 30 : y < 70;
  if (!press) { G.musNext = G.time + 3; return; }
  organ(Math.random() < 0.7 ? 'rally' : 'noodle'); G.musNext = G.time + 40 + Math.random()*30;
}

// ---------------- resurfacer engine: a diesel idle that swells when the machine is near the puck
let zamSrc = null, zamGain = null;
function updateZamAudio(){
  if (!AC || !sfxBus) return;
  const Z = G && !G.attract && !G.replay && G.zam && !G.zam.hide ? G.zam : null;
  if (!Z && !zamSrc) return;
  if (Z && !zamSrc && sfxBuf.zamengine) {
    zamSrc = AC.createBufferSource(); zamSrc.buffer = sfxBuf.zamengine[0]; zamSrc.loop = true;
    zamGain = AC.createGain(); zamGain.gain.value = 0; zamSrc.connect(zamGain); zamGain.connect(sfxBus); zamSrc.start();
  }
  if (!zamSrc) return;
  const t = AC.currentTime;
  if (!Z || paused) {
    zamGain.gain.setTargetAtTime(0, t, 0.25);
    if (!Z) { const src = zamSrc; zamSrc = null; try { src.stop(t + 1.2); } catch(e) {} }
    return;
  }
  const P = G.pucks[0], d = hyp(Z.x - P.x, Z.y - P.y);
  zamGain.gain.setTargetAtTime(0.1 + 0.22*clamp(1 - d/70, 0, 1), t, 0.3);
  zamSrc.playbackRate.setTargetAtTime(0.85 + 0.25*clamp(Z.sp/ZAM_SP, 0, 1), t, 0.3);
}
