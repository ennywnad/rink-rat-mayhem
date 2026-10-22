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

for (const gfx of ['classic', 'med']) {
  const page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/WebGPU|favicon|ERR_/.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(g => { localStorage.setItem('rinkrat-gfx', g); localStorage.setItem('rinkrat-gfx-engine', 'webgl'); }, gfx);
  await page.goto(base + '?debug');
  await page.waitForSelector('#hub:not([hidden]) .chal[data-i="0"]', { timeout: 20000 });

  // challenge 1
  await page.click('.chal[data-i="0"]');
  await page.click('#btnGo');
  await page.waitForTimeout(5000);
  const st = await page.evaluate(() => ({ state: window.__sim.G.state, t: window.__sim.G.time, attract: window.__sim.G.attract }));
  if (st.attract || !['play', 'faceoff', 'regroup', 'goal'].includes(st.state)) fail(`${gfx}: challenge not running (${JSON.stringify(st)})`);

  // practice
  await page.keyboard.press('KeyP');
  await page.click('#btnQuit');
  await page.click('#btnPractice');
  await page.click('#pracGo');
  await page.waitForTimeout(3000);
  const pr = await page.evaluate(() => !!window.__sim.G.practice);
  if (!pr) fail(`${gfx}: practice did not start`);

  // save code round trip
  await page.keyboard.press('KeyP');
  await page.click('#btnQuit');
  await page.click('#saveCopy');
  const code = await page.inputValue('#saveCode');
  if (!code.startsWith('RRM1.')) fail(`${gfx}: save code missing`);
  await page.click('#saveLoad');
  const msg = await page.textContent('#saveMsg');
  if (!/Loaded/.test(msg)) fail(`${gfx}: save code did not load (${msg})`);

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
