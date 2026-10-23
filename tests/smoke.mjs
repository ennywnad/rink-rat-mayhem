// Smoke test: loads the game, plays a few seconds of a challenge and a practice in both views,
// and fails on any page error. Usage: node tests/smoke.mjs [baseUrl]
import { chromium } from 'playwright';

const base = process.argv[2] || 'http://127.0.0.1:8123/';
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
let failed = false;
const fail = msg => { failed = true; console.error('FAIL', msg); };
// DOM clicks: the software-rendered 3D view is too slow for Playwright's "stable element" checks
const tapper = page => sel => page.$eval(sel, el => el.click());

for (const gfx of ['classic', 'med']) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  const tap = tapper(page);
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/WebGPU|favicon|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(g => { localStorage.setItem('rinkrat-gfx', g); localStorage.setItem('rinkrat-gfx-engine', 'webgl'); }, gfx);
  await page.goto(base + '?debug');
  await page.waitForSelector('#hub:not([hidden]) .chal[data-i="0"]', { timeout: 20000 });

  // challenge 1
  await tap('.chal[data-i="0"]');
  await tap('#btnGo');
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({ state: window.__sim.G.state, t: window.__sim.G.time, attract: window.__sim.G.attract }));
  if (st.attract || !['play', 'faceoff', 'regroup', 'goal'].includes(st.state)) fail(`${gfx}: challenge not running (${JSON.stringify(st)})`);

  // practice
  await page.keyboard.press('KeyP');
  await tap('#btnQuit');
  await tap('#btnPractice');
  await tap('#pracGo');
  await page.waitForTimeout(3000);
  const pr = await page.evaluate(() => !!window.__sim.G.practice);
  if (!pr) fail(`${gfx}: practice did not start`);

  // save code round trip
  await page.keyboard.press('KeyP');
  await tap('#btnQuit');
  await tap('#saveCopy');
  await page.waitForFunction(() => document.getElementById('saveMsg').textContent.length > 0, null, { timeout: 5000 }).catch(() => {});   // the copy step finishes asynchronously
  const code = await page.inputValue('#saveCode');
  if (!code.startsWith('RRM1.')) fail(`${gfx}: save code missing`);
  await tap('#saveLoad');
  const msg = await page.textContent('#saveMsg');
  if (!/Loaded/.test(msg)) fail(`${gfx}: save code did not load (${msg})`);

  // two-player versus on one keyboard: P2 skates with the arrow keys (classic view only: software 3D is too slow to drive)
  if (gfx === 'classic') {
  await tap('#btnPractice');
  await tap('#p_players button[data-v="vs"]');
  await tap('#pracGo');
  await page.waitForFunction(() => window.__sim.G && window.__sim.G.state === 'play', null, { timeout: 30000 });
  const vs = await page.evaluate(() => ({ mode: window.__sim.G.mode, humans: window.__sim.humans(), p2team: window.__sim.humanSk(1) && window.__sim.humanSk(1).team }));
  if (vs.mode !== 'vs' || vs.humans !== 2 || vs.p2team !== 'away') fail(`${gfx}: versus not set up (${JSON.stringify(vs)})`);
  const x0 = await page.evaluate(() => (window.__p2 = window.__sim.humanSk(1)).x);   // follow this skater even if P2 auto-switches
  await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(900); await page.keyboard.up('ArrowLeft');
  const x1 = await page.evaluate(() => window.__p2.x);
  if (!(x1 < x0 - 2)) fail(`${gfx}: player 2 did not move (${x0} -> ${x1})`);
  await page.keyboard.press('KeyP');
  await tap('#btnQuit');
  await tap('#btnPractice');
  await tap('#p_players button[data-v="1p"]');
  await tap('#pracBack');
  }

  if (gfx !== 'classic') {
    const r3 = await page.evaluate(() => ({ status: window.__r3d.status, active: window.__r3d.active }));
    if (!r3.active) fail(`3D view not active (${JSON.stringify(r3)})`);
    console.log('3D status', r3.status);
  }
  if (errors.length) fail(`${gfx}: page errors\n  ` + errors.join('\n  '));
  else console.log(`ok: ${gfx}`);
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
