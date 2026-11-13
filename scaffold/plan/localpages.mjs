// localpages.mjs — the pages of the Local App on this computer (D-117).
//
// Ultrademo picks the pages itself (D-117): the brief only shows the home page's picture, to confirm it is
// the right app, and the user may name in words the pages or parts they want. Finding pages is cheap (the app's own
// links and the routes in its code, names only), so the outline gets every page found and picks one per scene moment.
// A page whose address needs an id ([id], :id) is listed but not opened. Only the local address is ever visited, and
// the code folder is walked for file names only (never node_modules, .git or build output; never a file's content).
import fs from 'node:fs';
import path from 'node:path';
import { localAddress } from './local.mjs';

export const MAX_LIST = 300;
const VIEWPORT = { width: 1280, height: 800 };
const SKIP_DIRS = new Set(['node_modules', '.git', '.next', '.nuxt', '.svelte-kit', 'dist', 'build', 'out', '.turbo', '.vercel', 'coverage', '.claude']);
const ASSET = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|css|js|mjs|json|xml|txt|mp4|webm|woff2?)$/i;
const SIGN_IN = /(^|\/)(log-?in|sign-?in|auth|session)(\/|$)/i;

const file = (projectDir) => path.join(projectDir, 'assets', 'local', 'pages.json');
const shotDir = (projectDir) => path.join(projectDir, 'assets', 'local', 'pages');

export function readLocalPages(projectDir) {
  try { const s = JSON.parse(fs.readFileSync(file(projectDir), 'utf8')); return { address: s.address || null, pages: Array.isArray(s.pages) ? s.pages : [] }; } catch { return { address: null, pages: [] }; }
}
function writeLocalPages(projectDir, set) {
  fs.mkdirSync(path.dirname(file(projectDir)), { recursive: true });
  fs.writeFileSync(file(projectDir), JSON.stringify(set, null, 1) + '\n');
}

/** A route as it is listed: "/" or "/a/b", no query, no hash, no trailing slash. */
export function cleanRoute(r) {
  let p = String(r || '').split(/[?#]/)[0].replace(/\/{2,}/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  if (p.length > 1) p = p.replace(/\/+$/, '');
  return p.slice(0, 300);
}
export const dynamicRoute = (r) => /\[|\]|(^|\/):[^/]+|\*/.test(r);

/** The routes in the code, from file names only: Next.js (app/ and pages/), SvelteKit, Remix, Nuxt. */
export function codeRoutes(folder, { maxFiles = 6000 } = {}) {
  const routes = new Set();
  let seen = 0;
  const walk = (dir, depth, fn) => {
    if (depth > 10 || seen > maxFiles) return;
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (++seen > maxFiles) return;
      if (e.isSymbolicLink()) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name) && !e.name.startsWith('.')) walk(p, depth + 1, fn); } else fn(p);
    }
  };
  // route groups (x) and parallel slots @x drop out of the address; a private folder _x is not a page at all
  const segs = (rel) => (rel.split(path.sep).some((s) => s.startsWith('_')) ? null : rel.split(path.sep).filter((s) => s && !/^\(.*\)$/.test(s) && !s.startsWith('@')));
  const add = (parts) => { if (parts) routes.add(cleanRoute('/' + parts.join('/'))); };
  for (const base of ['app', 'src/app']) {
    const root = path.join(folder, base);
    if (fs.existsSync(root)) walk(root, 0, (f) => { if (/^page\.(tsx|ts|jsx|js|mdx)$/.test(path.basename(f))) add(segs(path.relative(root, path.dirname(f)))); });
  }
  for (const base of ['pages', 'src/pages']) {
    const root = path.join(folder, base);
    if (fs.existsSync(root)) walk(root, 0, (f) => {
      const rel = path.relative(root, f);
      if (!/\.(tsx|ts|jsx|js|vue|mdx)$/.test(rel) || rel.split(path.sep)[0] === 'api' || /^_/.test(path.basename(rel))) return;
      const parts = segs(rel.replace(/\.(tsx|ts|jsx|js|vue|mdx)$/, ''));
      if (parts) add(parts.join('/').replace(/(^|\/)index$/, '').split('/'));
    });
  }
  const sk = path.join(folder, 'src', 'routes');
  if (fs.existsSync(sk)) walk(sk, 0, (f) => { if (/^\+page\.svelte$/.test(path.basename(f))) add(segs(path.relative(sk, path.dirname(f)))); });
  return [...routes].slice(0, MAX_LIST);
}

/** Order: the home page, then the top level of each section, then deeper pages; pages needing an id last. */
export function orderRoutes(routes) {
  const depth = (r) => (r === '/' ? 0 : r.split('/').length - 1);
  return [...new Set(routes.map(cleanRoute))].sort((a, b) => (dynamicRoute(a) - dynamicRoute(b)) || (depth(a) - depth(b)) || a.localeCompare(b)).slice(0, MAX_LIST);
}

async function withBrowser(fn) {
  const { chromium } = await import('playwright');
  const { userAgentFor } = await import('./browser.mjs');
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1, userAgent: userAgentFor(browser) });
    return await fn(await context.newPage());
  } finally { await browser.close(); }
}

/** Open one page and keep its picture; never leaves the local address. */
async function shoot(page, projectDir, base, p) {
  const target = new URL(p.route, base);
  try {
    await page.goto(target.href, { waitUntil: 'domcontentloaded', timeout: 15000 });
    await page.waitForLoadState('networkidle', { timeout: 3000 }).catch(() => {});
    const now = new URL(page.url());
    if (now.host !== target.host) return { ...p, error: 'it led away from the app' };
    const title = await page.evaluate(() => (document.querySelector('h1')?.textContent || document.title || '').replace(/\s+/g, ' ').trim().slice(0, 80)).catch(() => '');
    fs.mkdirSync(shotDir(projectDir), { recursive: true });
    const rel = `assets/local/pages/${p.id}.jpg`;
    await page.screenshot({ path: path.join(projectDir, rel), type: 'jpeg', quality: 78 });
    const signin = cleanRoute(now.pathname) !== p.route && SIGN_IN.test(now.pathname);
    return { ...p, title: title || p.title || '', shot: rel, ...(signin ? { signin: true } : { signin: false }), error: undefined };
  } catch (err) { return { ...p, error: 'it did not open' }; }
}

/**
 * List the app's pages (its links and its code's routes) and capture the first ones. Keeps the user's ticks and the
 * pictures already taken for the same routes. Returns the set.
 */
export async function discoverPages(projectDir, { address, folder = null, shots = 1 }) {
  const base = localAddress(address);
  if (!base) throw new Error('not a local address');
  const before = new Map(readLocalPages(projectDir).pages.map((p) => [p.route, p]));
  return withBrowser(async (page) => {
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 4000 }).catch(() => {});
    const host = new URL(page.url()).host;
    const links = await page.evaluate(() => [...document.querySelectorAll('a[href]')].map((a) => a.href)).catch(() => []);
    const fromLinks = links.map((h) => { try { const u = new URL(h); return u.host === host && !ASSET.test(u.pathname) ? cleanRoute(u.pathname) : null; } catch { return null; } }).filter(Boolean);
    const fromCode = folder ? codeRoutes(folder) : [];
    const routes = orderRoutes(['/', ...fromLinks, ...fromCode]);
    let n = 0;
    const pages = routes.map((route) => {
      const old = before.get(route);
      return { id: old?.id || `l${++n}`, route, title: old?.title || '', from: fromLinks.includes(route) ? 'link' : 'code', dynamic: dynamicRoute(route), ...(old?.shot ? { shot: old.shot, signin: old.signin } : {}) };
    });
    // ids stay unique when old and new ones mix
    const used = new Set(pages.map((p) => p.id)); let k = 0;
    for (const p of pages) if (pages.filter((q) => q.id === p.id).length > 1) { while (used.has(`l${++k}`)); p.id = `l${k}`; used.add(p.id); }
    let taken = 0;
    for (let i = 0; i < pages.length && taken < shots; i++) {
      if (pages[i].dynamic || pages[i].shot) { if (pages[i].shot) taken++; continue; }
      pages[i] = await shoot(page, projectDir, base, pages[i]);
      if (pages[i].shot) taken++;
    }
    const set = { address: base, found_at: new Date().toISOString(), pages };
    writeLocalPages(projectDir, set);
    return set;
  });
}

/** The pages the outline picks from: every page found (pages needing an id included, by name), up to 150. */
export function outlinePages(projectDir) {
  return readLocalPages(projectDir).pages.filter((p) => !p.error).map((p) => p.route + (p.title ? ` (${p.title})` : '')).slice(0, 150);
}
/** The home page's picture for the brief (proof it is the right app). */
export function homeShot(projectDir) {
  const p = readLocalPages(projectDir).pages.find((x) => x.route === '/' && x.shot) || readLocalPages(projectDir).pages.find((x) => x.shot);
  return p && fs.existsSync(path.join(projectDir, p.shot)) ? p : null;
}
