// pictures.mjs — the pictures already on the product's site (D-113): product UI shots, illustrations, diagrams. The site
// read collects them from the pages it already loads (the product's own address only), as an exact screenshot of each
// as it is shown; simple rules sort them (product UI starts ticked); the user ticks them on the brief and the Refine page;
// ticked ones become screenshot sources the outline and the scenes can use. Kept apart from scout/report.json, which the
// brand read and the directions read: the pictures reach the video only through the ticks.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MAX_PER_PAGE = 8;
export const MAX_PICTURES = 12;
const UI_WORDS = /dashboard|screen|\bapp\b|\bui\b|product|platform|interface|demo|preview|screenshot|feature|portal|console|editor|inbox|analytics|report|workspace|builder|panel/i;
const ART_WORDS = /illustration|graphic|diagram|vector|drawing|art\b|hero-art/i;

// in the page: the visible pictures shown large enough to matter, outside the header, navigation and footer, not logos,
// icons, avatars or badges; each is tagged so it can be screenshotted as it is shown
const FIND_SCRIPT = `(() => {
  const out = []; let n = 0;
  const bad = /logo|icon|avatar|badge|emoji|flag|sprite|social|twitter|linkedin|facebook|youtube|instagram|github|g2crowd|capterra|trustpilot|partner|customer-logo|client-logo|award|rating|stars|qr/i;
  const skipIn = 'header, nav, footer, [role="navigation"], [role="banner"], [role="contentinfo"], [class*="logo" i], [class*="marquee" i]';
  const seen = new Set();
  const consider = (el, kind, src, alt, label) => {
    const r = el.getBoundingClientRect(); const w = r.width, h = r.height;
    if (w < 240 || h < 160 || w / h > 4 || h / w > 3) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || Number(cs.opacity) < 0.2) return;
    if (el.closest(skipIn)) return;
    if (kind !== 'block' && typeof windows !== 'undefined' && windows.some((w) => w.contains(el))) return;
    const cls = typeof el.className === 'string' ? el.className : (el.className && el.className.baseVal) || '';
    if (bad.test([src, alt, cls, el.id].join(' '))) return;
    const key = src || (kind + ':' + Math.round(r.top + scrollY) + ':' + Math.round(r.left));
    if (seen.has(key)) return; seen.add(key);
    el.setAttribute('data-ud-pic', String(n));
    out.push({ n: n++, kind, src: String(src || '').slice(0, 400), alt: String(label || alt || '').slice(0, 160), w: Math.round(w), h: Math.round(h), top: Math.round(r.top + scrollY) });
  };
  const blocks = [];
  document.querySelectorAll('div, section, figure, article').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 380 || r.height < 220 || r.width > innerWidth * 0.75 || r.height > 1100) return;
    const cs = getComputedStyle(el);
    if (parseFloat(cs.borderTopLeftRadius) < 8) return;
    if (!((cs.boxShadow && cs.boxShadow !== 'none') || parseFloat(cs.borderTopWidth) > 0)) return;
    if (el.closest(skipIn) || el.querySelector('input, textarea, select, form, iframe, video')) return;
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let t, k = 0, len = 0;
    while ((t = tw.nextNode())) { const v = t.nodeValue.trim(); if (v) { k++; len += v.length; } }
    if (k < 8 || len / k > 26) return;
    if (/\\$\\s?\\d|\\/\\s?mo\\b|per month|per year|billed|testimonial/i.test(el.innerText || '')) return;
    blocks.push(el);
  });
  const windows = blocks.filter((el) => !blocks.some((o) => o !== el && o.contains(el)));
  windows.forEach((el) => consider(el, 'block', '', '', 'A product window on the site: ' + (el.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 90)));
  document.querySelectorAll('img').forEach((el) => consider(el, 'img', el.currentSrc || el.src, el.alt || el.getAttribute('aria-label') || ''));
  document.querySelectorAll('svg').forEach((el) => { if (el.parentElement && el.parentElement.closest('svg')) return; const t = el.querySelector('title'); consider(el, 'svg', '', el.getAttribute('aria-label') || (t ? t.textContent : '')); });
  document.querySelectorAll('div, section, figure').forEach((el) => { const bg = getComputedStyle(el).backgroundImage; if (!bg || bg === 'none' || bg.indexOf('url(') < 0) return; const m = /url\\(["']?([^"')]+)/.exec(bg); consider(el, 'bg', m ? m[1] : '', el.getAttribute('aria-label') || ''); });
  return out;
})()`;

/** Sort one picture by simple rules: its words, its shape, and how much of it is flat colour (interfaces are mostly
 * flat; photos are not). Returns 'ui' | 'illustration' | 'picture', or null for a blank image. */
export async function sortPicture(buf, c) {
  const sharp = (await import('sharp')).default;
  const st = await sharp(buf).stats();
  if (st.channels.slice(0, 3).every((ch) => ch.stdev < 4)) return null; // one colour: nothing to show
  const { data, info } = await sharp(buf).removeAlpha().resize(48, 48, { fit: 'fill' }).raw().toBuffer({ resolveWithObject: true });
  const counts = new Map();
  for (let i = 0; i < data.length; i += info.channels) { const k = (data[i] >> 4) * 256 + (data[i + 1] >> 4) * 16 + (data[i + 2] >> 4); counts.set(k, (counts.get(k) || 0) + 1); }
  const top = Math.max(...counts.values()) / (data.length / info.channels);
  // a product window is found by its build (a frame of labels), so a dark one with little in it still counts;
  // a loose picture that is mostly one colour (an empty frame, a glow) is skipped
  if (c.kind === 'block') return 'ui';
  if (top > 0.92) return null; // measured: a background glow 0.955; real product windows 0.38–0.73
  const hint = `${c.src} ${c.alt}`;
  if (UI_WORDS.test(hint)) return 'ui';
  if (c.kind === 'svg' || ART_WORDS.test(hint) || /\.svg(\?|$)/i.test(c.src)) return 'illustration';
  if (top >= 0.28 && c.w >= 360) return 'ui';
  if (top < 0.12) return 'picture';
  return counts.size <= 40 ? 'illustration' : 'picture';
}

/** In the site read, after a page is captured: screenshot its pictures into <scoutDir>/pictures/. `seen` (hashes) and
 * `list` carry across pages; returns nothing (the list grows). */
export async function collectPictures(page, { scoutDir, pageId, pageUrl, seen, list }) {
  if (list.length >= MAX_PICTURES) return;
  try {
    // lazy pictures load as they come into view: scroll the page through once
    await page.evaluate(async () => { const step = innerHeight * 0.9; for (let y = 0, i = 0; y < document.body.scrollHeight && i < 14; y += step, i++) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    const found = (await page.evaluate(FIND_SCRIPT)).sort((a, b) => a.top - b.top);
    // a sticky header, a cookie banner or a chat button floats over whatever is scrolled under it: hide what floats while
    // the pictures are captured (never a picture itself or anything holding one), and show it again after
    await page.evaluate(() => {
      for (const el of document.querySelectorAll('body *')) {
        const pos = getComputedStyle(el).position;
        if ((pos === 'fixed' || pos === 'sticky') && !el.querySelector('[data-ud-pic]') && !el.closest('[data-ud-pic]')) { el.setAttribute('data-ud-float', el.style.visibility || ''); el.style.visibility = 'hidden'; }
      }
    }).catch(() => {});
    const dir = path.join(scoutDir, 'pictures');
    let k = 0;
    for (const c of found) {
      if (list.length >= MAX_PICTURES || k >= MAX_PER_PAGE) break;
      let buf;
      try {
        const loc = page.locator(`[data-ud-pic="${c.n}"]`).first();
        await loc.scrollIntoViewIfNeeded({ timeout: 3000 });
        await page.waitForTimeout(200);
        buf = await loc.screenshot({ type: 'png', timeout: 5000 });
      } catch { continue; }
      if (!buf || buf.length < 500) continue; // blank pictures are caught by sortPicture
      const hash = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
      if (seen.has(hash)) continue;
      const sort = await sortPicture(buf, c).catch(() => 'picture');
      if (!sort) continue;
      seen.add(hash);
      fs.mkdirSync(dir, { recursive: true });
      const name = `${pageId}-${++k}.png`;
      fs.writeFileSync(path.join(dir, name), buf);
      list.push({ file: `pictures/${name}`, page: pageUrl, alt: c.alt, kind: sort, w: c.w, h: c.h, hash });
    }
    await page.evaluate(() => { for (const el of document.querySelectorAll('[data-ud-float]')) { el.style.visibility = el.getAttribute('data-ud-float'); el.removeAttribute('data-ud-float'); } scrollTo(0, 0); });
  } catch { /* pictures are a bonus: the site read goes on without them */ }
}

// ---- the project's set (assets/site/pictures.json): merged from every site read, the user's ticks kept ----

const setFile = (projectDir) => path.join(projectDir, 'assets', 'site', 'pictures.json');

export function readPictures(projectDir) {
  try { const s = JSON.parse(fs.readFileSync(setFile(projectDir), 'utf8')); return Array.isArray(s.pictures) ? s.pictures : []; } catch { return []; }
}
function writePictures(projectDir, pictures) {
  fs.mkdirSync(path.dirname(setFile(projectDir)), { recursive: true });
  fs.writeFileSync(setFile(projectDir), JSON.stringify({ pictures }, null, 1) + '\n');
}

/** Add the pictures a site read collected (<scoutDir>/pictures.json) to the project's set: copied into
 * assets/site/pictures/, the same picture never twice, product UI ticked to start with, a tick the user set kept. */
export function mergePictures(projectDir, scoutDir, from) {
  let found = [];
  try { found = JSON.parse(fs.readFileSync(path.join(scoutDir, 'pictures.json'), 'utf8')).pictures || []; } catch { return readPictures(projectDir); }
  const set = readPictures(projectDir);
  const have = new Set(set.map((p) => p.hash));
  for (const p of found) {
    if (have.has(p.hash) || set.length >= MAX_PICTURES) continue;
    const id = `p${set.length + 1}`;
    const rel = `assets/site/pictures/${id}.png`;
    fs.mkdirSync(path.join(projectDir, 'assets', 'site', 'pictures'), { recursive: true });
    try { fs.copyFileSync(path.join(scoutDir, p.file), path.join(projectDir, rel)); } catch { continue; }
    set.push({ id, file: rel, page: p.page, alt: p.alt || '', kind: p.kind, w: p.w, h: p.h, hash: p.hash, use: p.kind === 'ui', from });
    have.add(p.hash);
  }
  writePictures(projectDir, set);
  return set;
}

/** Tick or untick one picture. Returns the set. */
export function setPictureUse(projectDir, id, use) {
  const set = readPictures(projectDir);
  const p = set.find((x) => x.id === id);
  if (p) { p.use = Boolean(use); writePictures(projectDir, set); }
  return set;
}

const KIND_WORDS = { ui: 'product UI', illustration: 'an illustration', picture: 'a picture' };
/** The ticked pictures as screenshot sources (in place of any earlier site-picture sources). */
export function withPictureSources(projectDir, sources = []) {
  const kept = (sources || []).filter((s) => !String(s.id || '').startsWith('site-pic-'));
  const pics = readPictures(projectDir).filter((p) => p.use && fs.existsSync(path.join(projectDir, p.file)));
  return kept.concat(pics.map((p) => ({ id: `site-pic-${p.id}`, kind: p.kind === 'ui' ? 'screenshot' : 'site-image', path: p.file, what: `From the product's site (${KIND_WORDS[p.kind] || 'a picture'})${p.alt ? `: ${p.alt}` : ''}` })));
}
