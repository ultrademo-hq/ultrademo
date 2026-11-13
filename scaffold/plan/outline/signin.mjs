// signin.mjs — the outline's sign-in test (D-91, D-93): right after the brief, try to reach every screen the outline
// needs, so a failing login shows on the outline page, not in production. Read-only: it signs in and looks, never
// clicks anything that changes data.
//   public site           each page is fetched
//   demo-account          signs in with the demo account in <project>/.env (DEMO_EMAIL, DEMO_PASSWORD, DEMO_SIGNIN_URL)
//                         through the product's own sign-in form, then opens each screen in the same session
//   own-browser, dedicated-profile, token, hosted-live-view: the sign-in happens at capture, in the user's browser or
//                         session; the outline says so
// The password is read only here, typed only into the product's password field and never printed, logged or saved.
import fs from 'node:fs';
import path from 'node:path';
import { userAgentFor } from '../browser.mjs';

const AT_CAPTURE = { 'own-browser': 'you sign in through your own browser, so this screen is checked when the steps are captured', 'dedicated-profile': 'you sign in through a profile, so this screen is checked when the steps are captured', token: 'checked when the steps are captured, with the token or link in the env file', 'hosted-live-view': 'hosted app only' };
// D-117: a local app's way in comes from its code, proposed to the user first, so it is checked at capture
AT_CAPTURE['from-code'] = 'the way in comes from your code and is proposed to you first, so this screen is checked when the steps are captured';
const BLOCKED = /verify you are human|are you a robot|captcha|access denied|unusual traffic|cf-chl|checking your browser/i;

/** The demo account from the project's env file (only the three DEMO_ lines are read; values never leave this module). */
export function readDemoAccount(projectDir) {
  let text = '';
  try { text = fs.readFileSync(path.join(projectDir, '.env'), 'utf8'); } catch { return null; }
  const val = (k) => { const m = text.match(new RegExp(`^${k}=[ \\t]*(.*)$`, 'm')); return m ? m[1].trim().replace(/^(["'])(.*)\1$/, '$2') : ''; };
  const a = { email: val('DEMO_EMAIL'), password: val('DEMO_PASSWORD'), signin_url: val('DEMO_SIGNIN_URL') };
  return a.email && a.password ? a : null;
}

const needsCheck = (m) => (m.source === 'live' || m.source === 'site') && (m.url || m.sign_in);

/**
 * Test the outline's screens. Returns { path, tested_at, signed_in, why, results: { [index]: { state, why, shot? } } }
 * state: reached | not-reached | at-capture | not-placed (no address known; found during capture) | not-needed
 */
export async function testReach(plan, projectDir, { chromium = null, fetchImpl = globalThis.fetch, now = new Date(), timeoutMs = 20000 } = {}) {
  const video = plan.video;
  const o = video.intake?.outline || { moments: [] };
  const signPath = video.intake?.sign_in?.path || 'public';
  const out = { path: signPath, tested_at: now.toISOString(), signed_in: null, why: '', results: {} };
  const todo = o.moments.map((m, i) => [m, i]).filter(([m]) => needsCheck(m));
  o.moments.forEach((m, i) => { if (!needsCheck(m)) out.results[i] = { state: 'not-needed', why: m.source === 'rebuilt' ? '' : `from ${m.source}` }; });
  if (!todo.length) return out;

  // behind a sign-in, with a session the test cannot hold: said plainly, checked at capture
  if (AT_CAPTURE[signPath]) {
    for (const [m, i] of todo) out.results[i] = m.sign_in ? { state: 'at-capture', why: AT_CAPTURE[signPath] } : await fetchCheck(m, fetchImpl, timeoutMs);
    return out;
  }
  // D-117: a local app with no sign-in opens every screen as it is
  if (signPath === 'local-none') {
    for (const [m, i] of todo) out.results[i] = await fetchCheck(m, fetchImpl, timeoutMs);
    return out;
  }
  if (signPath !== 'demo-account') {
    for (const [m, i] of todo) out.results[i] = m.sign_in ? { state: 'not-reached', why: 'behind a sign-in, but the brief says public site only: pick a sign-in on the brief' } : await fetchCheck(m, fetchImpl, timeoutMs);
    return out;
  }

  // demo account: sign in through the product's own form, then open each screen in that session
  const account = readDemoAccount(projectDir);
  if (!account) {
    out.signed_in = false; out.why = 'the demo account is not filled in yet: open the env file from the brief and fill in DEMO_EMAIL and DEMO_PASSWORD';
    for (const [, i] of todo) out.results[i] = { state: 'not-reached', why: out.why };
    return out;
  }
  if (!chromium) ({ chromium } = await import('playwright'));
  const shotDir = path.join(projectDir, 'outline', 'reach');
  fs.mkdirSync(shotDir, { recursive: true });
  const browser = await chromium.launch();
  try {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: userAgentFor(browser) })).newPage();
    const s = await signIn(page, account.signin_url || video.url, account, timeoutMs, [video.url, account.signin_url]);
    out.signed_in = s.ok; out.why = s.why;
    for (const [m, i] of todo) {
      if (!m.url) { out.results[i] = { state: 'not-placed', why: 'no address yet; the capture finds the page' }; continue; }
      if (!s.ok && m.sign_in) { out.results[i] = { state: 'not-reached', why: s.why }; continue; }
      out.results[i] = await visit(page, m.url, path.join(shotDir, `${String(i + 1).padStart(2, '0')}.jpg`), timeoutMs, projectDir);
    }
  } finally { await browser.close(); }
  return out;
}

async function fetchCheck(m, fetchImpl, timeoutMs) {
  if (!m.url) return { state: 'not-placed', why: 'no address yet; the capture finds the page' };
  try {
    const r = await fetchImpl(m.url, { redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
    return r.ok ? { state: 'reached', why: '' } : { state: 'not-reached', why: `the page answered ${r.status}` };
  } catch { return { state: 'not-reached', why: 'the page could not be reached' }; }
}

const PASSWORD = 'input[type="password"]';
const SUBMIT = 'button[type="submit"], input[type="submit"], button:has-text("Sign in"), button:has-text("Log in"), button:has-text("Continue"), button:has-text("Next")';
/** Submit the form a field is in: its sign-in button when there is one (Enter alone does not submit a form with two
 * fields and no button), else Enter. */
async function submit(page, field) {
  const form = field.locator('xpath=ancestor::form[1]');
  const scope = (await form.count()) ? form : page;
  const btn = scope.locator(SUBMIT).first();
  if (await btn.isVisible().catch(() => false)) await btn.click();
  else await field.press('Enter');
}
const IDENTITY = 'input[type="email"], input[autocomplete="username"], input[autocomplete="email"], input[name*="email" i], input[name*="user" i], input[name*="login" i], input[id*="email" i], input[id*="user" i]';

/** Sign in through the form on `url`: the identity field, the password field (on the same step or the next), submit. */
// Domains under which many unrelated owners get their own name: two-part country domains and shared hosting. On these,
// a site is the suffix plus one more label (acme.vercel.app, acme.co.uk), never the suffix alone, so another tenant's
// subdomain is never taken for the product's own site. A short built-in list instead of a public-suffix dependency.
export const SHARED_SUFFIXES = [
  'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'me.uk', 'ltd.uk', 'plc.uk', 'com.au', 'net.au', 'org.au', 'co.nz', 'org.nz', 'co.jp', 'ne.jp', 'or.jp',
  'com.br', 'com.sg', 'com.my', 'co.in', 'net.in', 'co.za', 'com.cn', 'com.hk', 'com.tw', 'co.kr', 'com.mx', 'com.tr', 'co.id', 'com.ph', 'com.vn', 'com.ar', 'co.il', 'com.ng', 'com.pk', 'co.th',
  'vercel.app', 'netlify.app', 'github.io', 'gitlab.io', 'pages.dev', 'workers.dev', 'herokuapp.com', 'onrender.com', 'fly.dev', 'web.app', 'firebaseapp.com',
  'azurewebsites.net', 'cloudfront.net', 'amplifyapp.com', 'railway.app', 'up.railway.app', 'glitch.me', 'replit.app', 'repl.co', 'surge.sh', 'webflow.io',
  'framer.app', 'framer.website', 'wixsite.com', 'squarespace.com', 'myshopify.com', 'bubbleapps.io', 'lovable.app', 'supabase.co', 'appspot.com',
  'ngrok.io', 'ngrok-free.app', 'trycloudflare.com', 'blogspot.com', 'wordpress.com', 'notion.site', 'carrd.co', 'softr.app', 'deno.dev', 'val.run',
  // Hosted sign-in providers (Auth0, Clerk, Okta, Cognito) are left out on purpose: their flows can move between two
  // hosts of the same customer (acme.accounts.dev, then acme.clerk.accounts.dev), which a stricter rule would refuse.
];
const SUFFIX_SET = new Set(SHARED_SUFFIXES);

/** The site a page is on, for the sign-in's host check: its host name, and the registrable part of it (the last two
 * labels, or one more under a shared suffix; an IP address or localhost as it is). */
export function siteOf(u) {
  let h = '';
  try { h = new URL(String(u)).hostname.toLowerCase().replace(/\.$/, ''); } catch { return null; }
  if (!h) return null;
  const ip = /^[\d.]+$/.test(h) || h.includes(':') || h === 'localhost';
  if (ip) return { host: h, base: h };
  const labels = h.split('.');
  // the longest shared suffix the host ends with decides how many labels the site keeps
  let keep = 2;
  for (let n = labels.length - 1; n >= 2; n--) if (SUFFIX_SET.has(labels.slice(-n).join('.'))) { keep = n + 1; break; }
  return { host: h, base: labels.slice(-keep).join('.') };
}
/** D-107: the demo account's details are typed only on the product's own site: the host of its address or of
 * DEMO_SIGNIN_URL, or a subdomain of either (app., auth., login.). A page that has moved anywhere else is refused. */
export function onOwnSite(pageUrl, allowed) {
  const here = siteOf(pageUrl);
  if (!here) return false;
  return allowed.map(siteOf).filter(Boolean).some((a) => here.host === a.host || here.host === a.base || here.host.endsWith('.' + a.base));
}

export async function signIn(page, url, account, timeoutMs = 20000, allowed = null) {
  const own = (allowed && allowed.filter(Boolean).length ? allowed.filter(Boolean) : [url]);
  const elsewhere = () => { let h = ''; try { h = new URL(page.url()).hostname; } catch {} return { ok: false, why: `the sign-in page is on ${h || 'another site'}, not your product's site, so the demo details were not typed there; if that is your real sign-in page, put its address in DEMO_SIGNIN_URL` }; };
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForTimeout(800);
    if (BLOCKED.test(await page.content())) return { ok: false, why: 'the site blocked the automated browser; use your own browser or a dedicated profile on the brief' };
    // a sign-in page drawn by script shows its form a moment after the page loads
    await page.locator(IDENTITY).first().waitFor({ state: 'visible', timeout: Math.min(6000, timeoutMs) }).catch(() => {});
    let id = page.locator(IDENTITY).first();
    if (!(await id.count())) {
      // a landing page with a Log in link (the form is one click further): follow it, read-only
      const link = page.locator('a, button').filter({ hasText: /^\s*(log ?in|sign ?in)\s*$/i }).first();
      if (await link.isVisible().catch(() => false)) {
        await link.click();
        await page.waitForLoadState('domcontentloaded', { timeout: timeoutMs }).catch(() => {});
        await page.locator(IDENTITY).first().waitFor({ state: 'visible', timeout: Math.min(8000, timeoutMs) }).catch(() => {});
        if (BLOCKED.test(await page.content())) return { ok: false, why: 'the site blocked the automated browser; use your own browser or a dedicated profile on the brief' };
        id = page.locator(IDENTITY).first();
      }
    }
    if (!(await id.count())) return { ok: false, why: 'no sign-in form found at the sign-in address; set DEMO_SIGNIN_URL in the env file' };
    // D-107: never type the demo details on a page that has left the product's own site (a redirect, a followed link)
    if (!onOwnSite(page.url(), own)) return elsewhere();
    await id.fill(account.email);
    let pw = page.locator(PASSWORD).first();
    if (!(await pw.isVisible().catch(() => false))) {
      // a two-step form: the email first, then the password
      await submit(page, id);
      await pw.waitFor({ state: 'visible', timeout: Math.min(8000, timeoutMs) }).catch(() => {});
      pw = page.locator(PASSWORD).first();
      if (!(await pw.isVisible().catch(() => false))) return { ok: false, why: 'the sign-in asked for something other than a password (a code, a link or single sign-on): use your own browser or a dedicated profile on the brief' };
    }
    if (!onOwnSite(page.url(), own)) return elsewhere();
    await pw.fill(account.password);
    await submit(page, pw);
    await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    await page.waitForTimeout(800);
    if (BLOCKED.test(await page.content())) return { ok: false, why: 'the site blocked the automated browser after sign-in; use your own browser or a dedicated profile on the brief' };
    if (await page.locator(PASSWORD).first().isVisible().catch(() => false)) return { ok: false, why: 'the sign-in was refused: check the email and password in the env file' };
    return { ok: true, why: '' };
  } catch {
    // never the error text itself: it could carry what was typed
    return { ok: false, why: 'the sign-in page did not load or answer in time' };
  }
}

async function visit(page, url, shot, timeoutMs, projectDir) {
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('networkidle', { timeout: Math.min(10000, timeoutMs) }).catch(() => {});
    if (await page.locator(PASSWORD).first().isVisible().catch(() => false)) return { state: 'not-reached', why: 'it sent the browser back to the sign-in' };
    if (r && r.status() >= 400) return { state: 'not-reached', why: `the page answered ${r.status()}` };
    await page.screenshot({ path: shot, type: 'jpeg', quality: 70 });
    return { state: 'reached', why: '', shot: path.relative(projectDir, shot).split(path.sep).join('/') };
  } catch { return { state: 'not-reached', why: 'the page did not load in time' }; }
}
