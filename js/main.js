// Rink Rat Mayhem · Main loop and start-up
'use strict';
// ---------------- loop
let paused = false, last = 0;
function frame(t){
  const dt = Math.min(0.05, (t - last)/1000 || 0); last = t;
  try { pollPad(); } catch(e) {}
  if (!paused) update(dt);
  try { updateCrowd(); musicTick(); } catch(e) {}
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


async function wake(){ try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch(e) { wakeLock = null; } }
document.addEventListener('visibilitychange', () => { if (document.hidden) { if (G && !G.attract && G.state !== 'end' && !paused && $('results').hidden) setPaused(true); } else if (G && !G.attract) wake(); });
document.addEventListener('pointerdown', ensureAudio, { once:true });

new ResizeObserver(resize).observe(stage);
startAttract();
renderHub(); show('hub');
resize();
if (document.fonts && document.fonts.load) document.fonts.load('16px Bungee').catch(()=>{});
requestAnimationFrame(frame);
