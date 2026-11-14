// queued-brief.check.mjs — a browser check of 2026-11-14's brief changes (not part of the test suite: it opens Chromium).
//   node plan/intake/queued-brief.check.mjs
// A queued video's brief opens filled from the brief it was queued from; the queue card is on Overview; the Local App
// check offers a codebase one folder down.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { startServer } from './serve.mjs';
import { queueVideos } from '../queue.mjs';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ud-queued-brief-'));
const first = path.join(root, 'acme-launch'); fs.mkdirSync(first);
const video = { url: 'https://acme.example', product: 'Acme', narration: 'voice', length_s: 45, intake: { video_type: 'launch', scope: 'product', cover: 'the launch', voice: { preference: 'female', id: 'rachelle' }, look: { words: 'calm, editorial', chips: ['cinematic'] }, effects: 'subtle', formats: ['landscape', 'vertical'] } };
const [q] = queueVideos(first, [{ video_type: 'spotlight', cover: 'the export panel' }], { url: video.url, product: 'Acme', brief: video });
// a home folder with a codebase one level down, for the Local App check
const product = path.join(os.homedir(), `.ud-check-${process.pid}`); fs.mkdirSync(path.join(product, 'web'), { recursive: true });
fs.writeFileSync(path.join(product, 'web', 'package.json'), JSON.stringify({ name: 'web', dependencies: { next: '15' }, scripts: { dev: 'next dev' } }));

const s = await startServer({ projectDir: q.dir, port: 0, open: false });
const url = s.url || `http://127.0.0.1:${s.address?.().port || s.port}/`;
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
let ok = true;
const check = (name, cond) => { console.log(`${cond ? 'ok  ' : 'FAIL'} ${name}`); if (!cond) ok = false; };
try {
  await page.goto(url, { waitUntil: 'networkidle' });
  check('the cover is the queued idea', (await page.inputValue('#f-cover')) === 'the export panel');
  check('the look words come from the first brief', (await page.inputValue('#f-look')) === 'calm, editorial');
  check('effects come from the first brief', await page.isChecked('input[name="effects"][value="subtle"]'));
  check('the started-from line says it was filled', /Filled from the brief of acme-launch/.test(await page.textContent('#started-from')));
  check('the queue card is on the Overview step', await page.$eval('#s-queue', (el) => el.closest('.bstep').dataset.step) === '2');
  // the Local App folder check, one level down
  await page.evaluate(() => { const c = document.querySelector('input[name="screens"][value="local"]'); if (c && !c.checked) c.click(); });
  await page.evaluate(() => { const st = document.querySelector('.bstep[data-step="3"]'); if (st) st.hidden = false; const l = document.getElementById('screens-local'); if (l) l.hidden = false; });
  await page.fill('#f-local-folder', product);
  await page.click('#local-check');
  await page.waitForFunction(() => /codebase/.test(document.getElementById('local-found').textContent));
  check('the message names the codebase one folder down', /Your app's codebase looks like it's in web\/ \(Next\.js\)/.test(await page.textContent('#local-found')));
  await page.click('#local-cands button');
  await page.waitForFunction(() => /^Found/.test(document.getElementById('local-found').textContent));
  check('using it fills the folder and the command', (await page.inputValue('#f-local-folder')).endsWith('/web') && (await page.inputValue('#f-local-command')) === 'npm run dev');
  check('the Choose folder button shows where a picker exists', process.platform !== 'darwin' || !(await page.$eval('#local-pick', (b) => b.hidden)));
  check('no page errors', errors.length === 0);
  if (errors.length) console.log(errors.join('\n'));
} finally {
  await browser.close(); s.server.closeAllConnections?.(); await s.close();
  fs.rmSync(product, { recursive: true, force: true }); fs.rmSync(root, { recursive: true, force: true });
}
process.exit(ok ? 0 : 1);
