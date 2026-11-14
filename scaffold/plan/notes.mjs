// notes.mjs — notes that follow the video (D-101): one list per video, <project>/notes.json, that anyone can add to or
// edit on any page and on the dashboard, and that Ultrademo reads before every step. A note marked "keep for the brand"
// is also kept with the saved brand (brands/<slug>/notes.json) and seeds that brand's next video.
// Also here: the furthest stage a video has reached, and reopening an earlier step's page (the step bar).
import { staleStep } from './wait.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAFFOLD_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const NOTE_FROM = ['brief', 'outline', 'direction', 'production', 'review', 'delivery', 'dashboard', 'you', 'ultrademo', 'brand'];
const MAX_NOTES = 200, MAX_TEXT = 1000;
const file = (projectDir) => path.join(projectDir, 'notes.json');
const readJson = (f, fb = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };
const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

/** One note, cleaned: plain text, a known source, a boolean brand flag. */
export function cleanNote(n) {
  if (!n || typeof n !== 'object') return null;
  const text = String(n.text ?? '').replace(/\r/g, '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, MAX_TEXT);
  if (!text) return null;
  return {
    id: /^[a-z0-9]{4,24}$/.test(String(n.id || '')) ? String(n.id) : id(),
    text,
    from: NOTE_FROM.includes(n.from) ? n.from : 'you',
    brand: n.brand === true,
    at: /^\d{4}-\d\d-\d\dT/.test(String(n.at || '')) ? String(n.at).slice(0, 30) : new Date().toISOString(),
  };
}

/** The video's notes. The first read seeds the list: the brief's own notes ("Anything else") and the brand's kept ones. */
export function readNotes(projectDir, { brandsDir = null } = {}) {
  const saved = readJson(file(projectDir));
  if (Array.isArray(saved?.notes)) return saved.notes.map(cleanNote).filter(Boolean);
  const seed = seedNotes(projectDir, { brandsDir });
  if (seed.length) writeNotes(projectDir, seed, { brandsDir: null });
  return seed;
}

/** Replace the list (the drawer saves the whole list). Brand notes are also written to the saved brand, when there is one. */
export function writeNotes(projectDir, notes, { brandsDir = null } = {}) {
  const clean = (Array.isArray(notes) ? notes : []).map(cleanNote).filter(Boolean).slice(0, MAX_NOTES);
  fs.writeFileSync(file(projectDir), JSON.stringify({ notes: clean, updated: new Date().toISOString() }, null, 1) + '\n');
  if (brandsDir) syncBrandNotes(projectDir, brandsDir, clean);
  return clean;
}

/** Copy this video's kept notes into its saved brand's memory (brands/<slug>/notes.json). Also run when the brand is
 * saved after the notes were ticked, so a note kept before the brand existed is not lost. Returns the brand or null. */
export function syncBrandNotes(projectDir, brandsDir, clean = null) {
  const brand = noteBrand(projectDir, brandsDir);
  if (!brand) return null;
  const list = clean || (readJson(file(projectDir), { notes: [] }).notes || []).map(cleanNote).filter(Boolean);
  // the brand keeps notes from all its videos; this video's own kept notes replace what it kept before
  const me = path.basename(path.resolve(projectDir));
  const bf = path.join(brandsDir, brand.slug, 'notes.json');
  const others = (readJson(bf, { notes: [] }).notes || []).filter((n) => n && n.project !== me && !list.some((c) => c.id === n.id));
  const kept = list.filter((n) => n.brand).map((n) => ({ ...n, from: 'brand', project: me }));
  fs.writeFileSync(bf, JSON.stringify({ notes: [...others, ...kept].slice(0, MAX_NOTES) }, null, 1) + '\n');
  return brand;
}

/** The saved brand this video's kept notes go to ({ slug, name }), or null when its brand is not saved yet. */
export function noteBrand(projectDir, brandsDir) {
  const slug = brandsDir ? brandSlugOf(projectDir, brandsDir) : null;
  return slug ? { slug, name: readJson(path.join(brandsDir, slug, 'brand.json'), {})?.name || slug } : null;
}

// a saved brand's slug for this video (by its address or name), without importing brands.mjs's whole surface
function brandSlugOf(projectDir, brandsDir) {
  const video = readJson(path.join(projectDir, 'plan.json'), {})?.video || {};
  let host = '';
  try { host = new URL(video.url).hostname.replace(/^www\./, ''); } catch {}
  for (const d of (() => { try { return fs.readdirSync(brandsDir); } catch { return []; } })()) {
    const b = readJson(path.join(brandsDir, d, 'brand.json'));
    if (!b) continue;
    if ((host && b.domain === host) || (b.name && video.product && b.name.toLowerCase() === String(video.product).toLowerCase()) || (b.from && b.from === path.basename(path.resolve(projectDir)))) return d;
  }
  return null;
}

/** A new video's first notes: what the brief said under "Anything else", and the notes its brand keeps. */
export function seedNotes(projectDir, { brandsDir = null } = {}) {
  const out = [];
  const video = readJson(path.join(projectDir, 'plan.json'), {})?.video || {};
  const said = String(video.intake?.notes || '').trim();
  if (said) out.push(cleanNote({ text: said, from: 'brief' }));
  const seen = new Set();
  const add = (n) => { const c = cleanNote({ ...n, from: 'brand', brand: true }); if (c && !seen.has(c.text)) { seen.add(c.text); out.push(c); } };
  // the saved brand's kept notes
  const slug = brandsDir ? brandSlugOf(projectDir, brandsDir) : null;
  if (slug) for (const n of readJson(path.join(brandsDir, slug, 'notes.json'), { notes: [] }).notes || []) add(n);
  // a queued video: the brand notes of the brief it was queued from
  const from = readJson(path.join(projectDir, 'brief-seed.json'), {})?.brand_from;
  if (from && /^[A-Za-z0-9][A-Za-z0-9._-]{0,120}$/.test(from)) {
    for (const n of readJson(path.join(path.dirname(projectDir), from, 'notes.json'), { notes: [] }).notes || []) if (n.brand) add(n);
  }
  return out.filter(Boolean);
}

/** Add a note unless the same words are already there (the brief's "Anything else" on save, Claude's own notes). */
export function ensureNote(projectDir, text, from = 'brief', { brandsDir = null } = {}) {
  const t = String(text || '').trim();
  if (!t) return readNotes(projectDir, { brandsDir });
  const list = readNotes(projectDir, { brandsDir });
  if (list.some((n) => n.text === t)) return list;
  return writeNotes(projectDir, [...list, { text: t, from }], { brandsDir });
}

/** The notes as a block to append to a model's prompt; '' when there are none. */
export function notesBlock(projectDir) {
  const lines = notesForPrompt(projectDir);
  return lines ? `\n\n# Notes for this video (from the user and the earlier steps)\nFollow them unless one conflicts with the truth rules above; when you cannot follow one, say so in your notes.\n${lines}\n` : '';
}

/** The notes as lines for a model's prompt or a scene brief; '' when there are none. */
export function notesForPrompt(projectDir) {
  let list = [];
  try { list = readNotes(projectDir); } catch {}
  if (!list.length) return '';
  return list.map((n) => `- ${n.text.replace(/\n+/g, ' ')}${n.brand ? ' (kept for the brand)' : ''}`).join('\n');
}

// ---------------------------------------------------------------------------------------------------------------
// the stages, and reopening an earlier one

export const STAGE_IDS = ['brief', 'outline', 'direction', 'production', 'review', 'delivery'];
const has = (dir, rel) => fs.existsSync(path.join(dir, rel));
/** The furthest stage this video has reached (the same reading as the dashboard's). */
export function furthestStage(projectDir) {
  const f = rawFurthest(projectDir);
  // a redone step makes the steps after it start over: the video is no further than the step being written again
  const CAP = { brief: 'outline', outline: 'direction', direction: 'production' };
  const st = staleStep(projectDir);
  return st && STAGE_IDS.indexOf(f) > STAGE_IDS.indexOf(CAP[st]) ? CAP[st] : f;
}
function rawFurthest(projectDir) {
  const plan = readJson(path.join(projectDir, 'plan.json'), {});
  if (has(projectDir, 'review/approved.json')) return 'delivery';
  if (has(projectDir, 'out/video.mp4')) return 'review';
  if (has(projectDir, 'direction/confirmed.json') || plan.direction) return 'production';
  if (plan.video?.intake?.outline?.status === 'confirmed' || (plan.video && !plan.video.intake?.outline && has(projectDir, 'direction/proposals.json'))) return 'direction';
  if (plan.video?.intake?.outline) return 'outline';
  return 'brief';
}

const STAGE_PAGE = {
  brief: ['intake', 'plan/intake/serve.mjs', [], ''],
  outline: ['outline', 'plan/outline/run.mjs', ['--no-test'], ''],
  direction: ['direction', 'plan/direction/serve.mjs', [], 'refine'],
  production: ['direction', 'plan/direction/serve.mjs', [], 'confirmed'],
  review: ['review', 'plan/review/serve.mjs', [], '?review=1'],
  delivery: ['review', 'plan/review/serve.mjs', [], ''],
};
/** Start an earlier (or the current) stage's page for this video and resolve to its address; null when it cannot. */
const reopening = new Map();
export function reopenStage(projectDir, stage, opts = {}) {
  const key = `${path.resolve(projectDir)}|${stage}`;
  if (!reopening.has(key)) reopening.set(key, reopenStageNow(projectDir, stage, opts).finally(() => reopening.delete(key)));
  return reopening.get(key);
}
async function reopenStageNow(projectDir, stage, { timeoutMs = 15000 } = {}) {
  const at = STAGE_IDS.indexOf(furthestStage(projectDir));
  const want = STAGE_IDS.indexOf(stage);
  if (want < 0 || want > at || !STAGE_PAGE[stage]) return null;
  const { pagesOf, pageAlive } = await import('./pages.mjs');
  const [kind, script, args, suffix] = STAGE_PAGE[stage];
  const running = pagesOf(projectDir)[kind];
  if (pageAlive(running)) return running.url + suffix;
  const { spawn } = await import('node:child_process');
  const started = Date.now();
  const child = spawn(process.execPath, ['--env-file-if-exists=.env', path.join(SCAFFOLD_DIR, script), projectDir, ...args], {
    cwd: SCAFFOLD_DIR, detached: true, stdio: 'ignore', env: { ...process.env, ULTRADEMO_NO_OPEN: '1', ULTRADEMO_MODE: 'agent' },
  });
  child.unref();
  while (Date.now() - started < timeoutMs) {
    await new Promise((r) => setTimeout(r, 300));
    const p = pagesOf(projectDir)[kind];
    if (p && pageAlive(p) && Date.parse(p.at) >= started - 1000) return p.url + suffix;
  }
  return null;
}

/** The routes every page server shares: GET /api/notes, POST /api/notes {notes}, POST /api/reopen {stage}. Returns true
 * when it answered. h: { sendJson, readBody, sameOrigin, brandsDir }. */
export async function notesRoutes(req, res, url, projectDir, h) {
  if (url.pathname === '/api/notes' && req.method === 'GET') {
    const { stageLinks } = await import('./pages.mjs');
    h.sendJson(res, 200, { ok: true, notes: readNotes(projectDir, { brandsDir: h.brandsDir }), brand: noteBrand(projectDir, h.brandsDir), furthest: furthestStage(projectDir), links: stageLinks(projectDir) });
    return true;
  }
  if ((url.pathname === '/api/notes' || url.pathname === '/api/reopen') && req.method === 'POST') {
    if (h.sameOrigin && !h.sameOrigin(req)) { h.sendJson(res, 403, { ok: false, error: 'Not from this page.' }); return true; }
    let body = {};
    try { body = JSON.parse((await h.readBody(req)) || '{}'); } catch { h.sendJson(res, 400, { ok: false, error: 'Could not read that.' }); return true; }
    if (url.pathname === '/api/notes') {
      const notes = writeNotes(projectDir, body.notes, { brandsDir: h.brandsDir });
      h.sendJson(res, 200, { ok: true, notes, brand: noteBrand(projectDir, h.brandsDir) });
      return true;
    }
    const u = await reopenStage(projectDir, String(body.stage || ''));
    h.sendJson(res, u ? 200 : 400, u ? { ok: true, url: u } : { ok: false, error: 'That step cannot be opened yet.' });
    return true;
  }
  return false;
}
