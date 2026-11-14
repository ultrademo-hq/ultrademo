// queue-and-where.check.mjs — a browser check of 2026-11-14's direction changes (not part of the test suite: it opens
// Chromium). node plan/direction/queue-and-where.check.mjs
// On the recorded Orbit run: a direction not picked is queued as another video with this brief; on Refine, a scene's
// copy over its limit is listed with "Show me where", which opens and focuses that field, and ticks off once it fits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ud-dir-check-'));
const proj = path.join(root, 'orbit-launch');
fs.cpSync(path.join(HERE, 'fixtures', 'orbit-run', 'project'), proj, { recursive: true });
fs.writeFileSync(path.join(proj, 'direction', 'state.json'), JSON.stringify({ stage: 'direction', style: { choice: 'auto' }, chosen: null }));

const s = await startServer({ projectDir: proj, port: 0, open: false });
const url = s.url || `http://127.0.0.1:${s.port || s.server?.address().port}/`;
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let ok = true;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) ok = false; };
try {
  await page.goto(`${url}direction`, { waitUntil: 'networkidle' });
  const n = await page.$$eval('.qdir', (b) => b.length);
  check(`every direction has "Queue as another video" (${n})`, n >= 2);
  await page.click('.qdir[data-qdir="1"]');
  await page.fill('[data-qform="1"] input', 'inviting a teammate, as a spotlight');
  await page.selectOption('[data-qform="1"] select', 'spotlight');
  const shot = (n) => process.env.SHOTS ? page.screenshot({ path: path.join(process.env.SHOTS, n) }) : null;
  await page.locator('#dir-B').scrollIntoViewIfNeeded(); await shot('queue-form.png');
  await page.click('[data-qform="1"] .qgo');
  await page.waitForSelector('#dir-B .qdone');
  const queued = fs.readdirSync(root).filter((d) => d !== 'orbit-launch');
  check(`a queued folder was made beside this one (${queued.join(', ')})`, queued.length === 1);
  const seed = queued.length ? JSON.parse(fs.readFileSync(path.join(root, queued[0], 'brief-seed.json'), 'utf8')) : {};
  check('its seed carries the brief and direction B', Boolean(seed.base) && seed.direction?.letter === 'B' && seed.video_type === 'spotlight');
  await page.reload({ waitUntil: 'networkidle' });
  check('after a reload direction B still says queued', Boolean(await page.$('#dir-B .qdone')));

  // Refine: a headline far over its limit, then confirm
  await page.evaluate(() => fetch('/api/choose', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ chosen: 0 }) }));
  await page.goto(`${url}refine`, { waitUntil: 'networkidle' });
  const h = page.locator('.mrow[data-moment="1"] .copy .h [contenteditable]');
  const before = await h.textContent();
  await h.click(); await page.keyboard.press('End');
  await page.keyboard.type(' and then many more words that run far past the limit for this scene');
  await page.waitForTimeout(600);
  await page.click('#confirm');
  await page.waitForSelector('#problems.on .showme', { timeout: 10000 });
  check('the fix list has "Show me where"', true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#problems .showme');
  await page.waitForTimeout(700);
  const where = await page.evaluate(() => { const a = document.activeElement; const row = a && a.closest('.mrow'); return { moment: row && row.dataset.moment, flash: Boolean(document.querySelector('.udflash')), inView: a ? a.getBoundingClientRect().top < innerHeight : false }; });
  check(`it focuses scene 2's headline, in view, flashing (${JSON.stringify(where)})`, where.moment === '1' && where.flash && where.inView);
  await page.evaluate((t) => { const el = document.querySelector('.mrow[data-moment="1"] .copy .h [contenteditable]'); el.textContent = t; el.dispatchEvent(new Event('input', { bubbles: true })); }, before);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(200); await shot('fix-list.png');
  check('the item ticks itself off once the words fit', Boolean(await page.$('#problem-list li.done')));
  check('no page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close(); s.server?.closeAllConnections?.(); if (s.close) await s.close(); else s.server?.close();
  fs.rmSync(root, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
