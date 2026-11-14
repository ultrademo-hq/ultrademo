// queue.mjs — more video ideas for the same product (D-97). Each idea becomes its own project folder beside the one it
// was queued from: queued.json (what was asked, and when) and brief-seed.json (its brief's Start, filled from the first
// video's). Nothing is built until the user starts it: its brief page opens on Start, and from there it is a video like
// any other (outline, direction, review). A queued video stops being "queued" the moment its brief is saved.
import { localDay } from './day.mjs';
import fs from 'node:fs';
import path from 'node:path';

const TYPES = ['launch', 'explainer', 'spotlight', 'ad', 'tutorial'];
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const slugOf = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'video';

// what belongs to one video only and never comes along to the next: its overview, title and name, what it covers,
// its message and proof, its outline, its uploads (files in the other project's folder), the sign-in note
const PER_VIDEO_INTAKE = ['overview', 'submitted_at', 'title', 'project_name', 'feature', 'tutorial', 'exact', 'cover', 'purpose', 'outline', 'proposed', 'length_target', 'started_from', 'notes', 'video_type', 'scope', 'unsure'];

/** The brief a queued video starts from (2026-11-14): the saved brief of the video it was queued from, without what
 * belongs to that video only. With another video type, the length and the cut are left to the new type's defaults. */
export function briefBase(video, { sameType = true } = {}) {
  if (!video || typeof video !== 'object') return null;
  const v = JSON.parse(JSON.stringify(video));
  for (const k of ['claim', 'proof_moment', 'reference', 'sources', 'claims', 'template']) delete v[k];
  const it = v.intake && typeof v.intake === 'object' ? v.intake : {};
  for (const k of PER_VIDEO_INTAKE) delete it[k];
  if (it.sign_in) it.sign_in = { path: it.sign_in.path, ...(it.sign_in.browser ? { browser: it.sign_in.browser } : {}) };
  if (it.screens) { it.screens = { ...it.screens, from: (it.screens.from || []).filter((f) => f !== 'screenshots' && f !== 'mockups') }; delete it.screens.uploads; }
  if (!sameType) { delete v.length_s; delete it.length_fit; delete it.cut; }
  v.intake = it;
  return v;
}

/** A direction from the direction step, kept compact for the queued video's own direction step. */
export function directionSeed(d, { from, letter, style = null } = {}) {
  if (!d || typeof d !== 'object') return null;
  const pick = ['name', 'idea', 'mood', 'canvas', 'energy', 'text_animation', 'camera', 'signature', 'hook', 'close', 'palette', 'type', 'music', 'video_style', 'motion_grammar', 'ground'];
  const out = Object.fromEntries(pick.filter((k) => d[k] != null).map((k) => [k, d[k]]));
  out.scenes = (d.moments || []).map((m) => ({ name: m.name, beat: m.beat, goal: m.goal }));
  return { from: String(from || ''), letter: String(letter || ''), style: style || d.video_style || null, direction: out };
}

/** Queue the ideas. base: { url, product, brand (a saved brand's slug or null), notes, brief (the saved video block it
 * was queued from), direction (directionSeed) }. Returns the new folders. Each also records the brief it was queued
 * from (brand_from), so an unsaved brand still comes along. */
export function queueVideos(projectDir, ideas, base = {}, now = new Date()) {
  const projectsDir = path.dirname(path.resolve(projectDir));
  const made = [];
  const list = (Array.isArray(ideas) ? ideas : []).map((i) => ({ video_type: TYPES.includes(i?.video_type) ? i.video_type : 'explainer', cover: String(i?.cover || '').trim().slice(0, 600) })).filter((i) => i.cover).slice(0, 12);
  list.forEach((idea, n) => {
    const stem = `${slugOf(base.product || base.brand)}-${idea.video_type}-${localDay(now)}`;
    let name = stem, k = 2;
    while (fs.existsSync(path.join(projectsDir, name))) name = `${stem}-${k++}`;
    const dir = path.join(projectsDir, name);
    fs.mkdirSync(dir, { recursive: true });
    const at = new Date(now.getTime() + n).toISOString();
    const dirSeed = base.direction && base.direction.direction ? base.direction : null;
    fs.writeFileSync(path.join(dir, 'queued.json'), JSON.stringify({ at, from: path.basename(path.resolve(projectDir)), video_type: idea.video_type, cover: idea.cover, brand: base.brand || null, url: base.url || null, ...(dirSeed ? { direction: { letter: dirSeed.letter, name: dirSeed.direction.name } } : {}) }, null, 1) + '\n');
    const brief = base.brief ? briefBase(base.brief, { sameType: (base.brief.intake?.video_type || '') === idea.video_type }) : null;
    fs.writeFileSync(path.join(dir, 'brief-seed.json'), JSON.stringify({ from: 'queue', url: base.url || '', product: base.product || '', brand: base.brand || '', brand_from: path.basename(path.resolve(projectDir)), video_type: idea.video_type, scope: base.brief?.intake?.scope || 'feature', cover: idea.cover, notes: base.notes || '', ...(brief ? { base: brief } : {}), ...(dirSeed ? { direction: dirSeed } : {}) }, null, 1) + '\n');
    made.push({ project: name, dir, at, ...idea });
  });
  return made;
}

/** A queued video: queued.json, and no brief saved yet. */
export function queuedOf(dir) {
  const q = readJson(path.join(dir, 'queued.json'));
  if (!q) return null;
  if (readJson(path.join(dir, 'plan.json'))?.video) return null;
  return q;
}

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };

/** The oldest queued video for this product (same saved brand, or the same site). */
export function nextQueued(projectsDir, { brand = null, url = '' } = {}) {
  let names = [];
  try { names = fs.readdirSync(projectsDir); } catch { return null; }
  const host = hostOf(url);
  return names.map((name) => ({ name, dir: path.join(projectsDir, name) }))
    .filter((p) => !p.name.startsWith('.') && p.name !== '_removed')
    .map((p) => ({ ...p, q: queuedOf(p.dir) }))
    .filter((p) => p.q && ((brand && p.q.brand === brand) || (host && hostOf(p.q.url) === host)))
    .sort((a, b) => String(a.q.at).localeCompare(String(b.q.at)))
    .map((p) => ({ project: p.name, dir: p.dir, video_type: p.q.video_type, cover: p.q.cover }))[0] || null;
}

/** The direction this video was queued with, or null: { from, letter, style, direction }. */
export function queuedDirection(projectDir) {
  const s = readJson(path.join(projectDir, 'brief-seed.json'));
  return s?.from === 'queue' && s.direction?.direction ? s.direction : null;
}

/** The queued direction as a block for the directions prompt; '' when there is none. */
export function queuedDirectionBlock(projectDir) {
  const q = queuedDirection(projectDir);
  if (!q) return '';
  return `\n\n# A direction the user queued for this video\nThe user liked direction ${q.letter} "${q.direction.name}" of the video ${q.from} and queued it for this one. Make it the first direction: keep its idea, signature move, look, pace and music, and write its scenes fresh for this video's outline and story (its old scenes are listed only to show its shape). The other directions are your own, as usual.\n\`\`\`json\n${JSON.stringify(q.direction, null, 1)}\n\`\`\`\n`;
}
