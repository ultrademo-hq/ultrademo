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

/** Queue the ideas. base: { url, product, brand (a saved brand's slug or null), notes }. Returns the new folders. Each
 * also records the brief it was queued from (brand_from), so an unsaved brand still comes along. */
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
    fs.writeFileSync(path.join(dir, 'queued.json'), JSON.stringify({ at, from: path.basename(path.resolve(projectDir)), video_type: idea.video_type, cover: idea.cover, brand: base.brand || null, url: base.url || null }, null, 1) + '\n');
    fs.writeFileSync(path.join(dir, 'brief-seed.json'), JSON.stringify({ from: 'queue', url: base.url || '', product: base.product || '', brand: base.brand || '', brand_from: path.basename(path.resolve(projectDir)), video_type: idea.video_type, scope: 'feature', cover: idea.cover, notes: base.notes || '' }, null, 1) + '\n');
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
