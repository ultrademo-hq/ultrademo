// pages.mjs — where a project's pages run. Each page server takes its usual port, or the next free one when another
// video's page holds it, and records its address in <project>/pages.json, so the other pages and the dashboard can link
// to it. Nothing here opens a port to anything but 127.0.0.1.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

/** Start a server on `port`, or the next free port up to `tries` above it. start(port) resolves to { url, ... }. */
export async function listenOnFree(start, port, tries = 20) {
  for (let p = port, i = 0; ; p++, i++) {
    try { return await start(p); }
    catch (err) { if (err?.code !== 'EADDRINUSE' || i >= tries) throw err; }
  }
}

const file = (projectDir) => path.join(projectDir, 'pages.json');
export function pagesOf(projectDir) {
  try { return JSON.parse(fs.readFileSync(file(projectDir), 'utf8')); } catch { return {}; }
}
/** kind: intake | direction | review */
export function recordPage(projectDir, kind, url) {
  try {
    const all = { ...pagesOf(projectDir), [kind]: { url, pid: process.pid, at: new Date().toISOString() } };
    fs.writeFileSync(file(projectDir), JSON.stringify(all, null, 1) + '\n');
  } catch {}
}
/** Stop a project's page servers (its own and its vertical version's): only a process whose command line is one of our
 * page servers for this very folder is stopped, so a reused process number is never touched. Returns how many stopped. */
export function stopPages(projectDir) {
  let n = 0;
  for (const dir of [projectDir, path.join(projectDir, 'vertical')]) {
    for (const p of Object.values(pagesOf(dir))) {
      if (!pageAlive(p)) continue;
      let cmd = '';
      try { cmd = execFileSync('ps', ['-p', String(p.pid), '-o', 'command='], { encoding: 'utf8' }); } catch { continue; }
      if (!/plan\/(intake|direction|review|outline)\/serve\.mjs|plan\/(direction|outline)\/run\.mjs/.test(cmd) || !cmd.includes(path.basename(projectDir))) continue;
      try { process.kill(p.pid); n++; } catch {}
    }
  }
  return n;
}

/** Is the process that recorded the page still running? (The page may still be closed; a fetch tells for sure.) */
export function pageAlive(entry) {
  if (!entry?.pid) return false;
  try { process.kill(entry.pid, 0); return true; } catch (err) { return err.code === 'EPERM'; }
}

// ---------------------------------------------------------------------------
// Moving between a project's pages (2026-11-11): every page links the others that are running, and the dashboard;
// a page that follows the next step (a loader) moves its own tab on, so the next page does not open a second one.
// ---------------------------------------------------------------------------

const SCAFFOLD_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..');

/** The dashboard records its address beside the projects, so every page can link back to it. */
export function recordDashboard(projectsDir, url) {
  try { fs.writeFileSync(path.join(projectsDir, '.dashboard.json'), JSON.stringify({ url, pid: process.pid, at: new Date().toISOString() }) + '\n'); } catch {}
}
export function dashboardUrl(projectDir) {
  for (const d of [path.dirname(projectDir), path.dirname(path.dirname(projectDir))]) {
    try { const r = JSON.parse(fs.readFileSync(path.join(d, '.dashboard.json'), 'utf8')); if (pageAlive(r)) return r.url; } catch {}
  }
  return null;
}

/** Where each stage of this project can be opened right now (null where its page is not running). */
export function stageLinks(projectDir) {
  const live = {};
  for (const [k, p] of Object.entries(pagesOf(projectDir))) if (pageAlive(p)) live[k] = p.url;
  const has = (rel) => fs.existsSync(path.join(projectDir, rel));
  return {
    brief: live.intake || null,
    outline: live.outline || null,
    // once a direction is confirmed, the server's front page sends you on to production: the step goes to refine instead
    direction: live.direction ? (has('direction/confirmed.json') ? `${live.direction}refine` : live.direction) : null,
    production: live.direction && has('direction/confirmed.json') ? `${live.direction}confirmed` : null,
    review: live.review && has('out/video.mp4') ? `${live.review}?review=1` : null,
    delivery: live.review && has('review/approved.json') ? live.review : null,
    dashboard: dashboardUrl(projectDir),
  };
}

const FOLLOW = (projectDir) => path.join(projectDir, '.following.json');
/** A loader page is waiting for `kind` (outline | direction | review) and will move its own tab there. */
export function markFollowing(projectDir, kind) {
  let all = {};
  try { all = JSON.parse(fs.readFileSync(FOLLOW(projectDir), 'utf8')); } catch {}
  try { fs.writeFileSync(FOLLOW(projectDir), JSON.stringify({ ...all, [kind]: Date.now() })); } catch {}
}
export function beingFollowed(projectDir, kind, ms = 15000) {
  try { return Date.now() - (JSON.parse(fs.readFileSync(FOLLOW(projectDir), 'utf8'))[kind] || 0) < ms; } catch { return false; }
}
/** Open the page in a new tab only when no open page is about to move to it. Returns a word for the log line. */
export async function openPage(projectDir, kind, url) {
  if (beingFollowed(projectDir, kind)) return 'the open page moves to it by itself';
  const { openInBrowser } = await import('./open.mjs');
  return openInBrowser(url) ? 'opened in your browser' : '';
}

/** Start the page a project is at, without Claude, and resolve to its address: the review page once there is a video,
 * the direction pages once directions are written, the outline once written, else the brief. Only our own page
 * servers are started, on 127.0.0.1, for a folder under projects/. Resolves null when the step needs Claude first. */
export async function reopenPage(projectDir, { timeoutMs = 15000 } = {}) {
  const has = (rel) => fs.existsSync(path.join(projectDir, rel));
  let plan = {};
  try { plan = JSON.parse(fs.readFileSync(path.join(projectDir, 'plan.json'), 'utf8')); } catch {}
  const [kind, script, args] = has('out/video.mp4') ? ['review', 'plan/review/serve.mjs', []]
    : has('direction/proposals.json') ? ['direction', 'plan/direction/run.mjs', []]
    : plan.video?.intake?.outline ? ['outline', 'plan/outline/run.mjs', ['--no-test']]
    : plan.video || has('intake.log') || has('brief-seed.json') ? ['intake', 'plan/intake/serve.mjs', []] : [null];
  if (!kind) return null;
  const running = pagesOf(projectDir)[kind];
  if (pageAlive(running)) return { kind, url: running.url };
  const { spawn } = await import('node:child_process');
  const started = Date.now();
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', path.join(SCAFFOLD_DIR, script), projectDir, ...args], {
    cwd: SCAFFOLD_DIR, detached: true, stdio: 'ignore', env: { ...process.env, ULTRADEMO_NO_OPEN: '1', ULTRADEMO_MODE: 'agent' },
  });
  child.unref();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 300));
    const p = pagesOf(projectDir)[kind];
    if (p && pageAlive(p) && Date.parse(p.at) >= started - 1000) return { kind, url: p.url };
  }
  return null;
}
