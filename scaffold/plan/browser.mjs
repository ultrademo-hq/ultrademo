// browser.mjs — how the skill's automated browser introduces itself to the user's own site (D-99).
// Bundled headless Chromium says "HeadlessChrome" in its user agent, and some bot rules (Cloudflare's among them)
// refuse that word outright: the site read, the sign-in test and capture then see a "you have been blocked" page
// instead of the product. These reads are of the user's own product, read-only, at a person's pace, so the browser
// gives the ordinary Chrome user agent of the same version. Nothing else is disguised: no fingerprint spoofing,
// no challenge solving. A site that still blocks it (a "verify you are human" check) goes through the user's own
// browser or a dedicated profile, as before.

const OS = {
  darwin: 'Macintosh; Intel Mac OS X 10_15_7',
  win32: 'Windows NT 10.0; Win64; x64',
  linux: 'X11; Linux x86_64',
};

/** The ordinary Chrome user agent for a browser version ("149.0.7827.55"), in Chrome's reduced form. */
export function ordinaryUserAgent(version, platform = process.platform) {
  const major = String(version || '').match(/^(\d+)/)?.[1] || '142';
  return `Mozilla/5.0 (${OS[platform] || OS.linux}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36`;
}

/** The user agent for a launched browser (`chromium.launch()`), to pass as `userAgent` to `newContext`. */
export function userAgentFor(browser) {
  return ordinaryUserAgent(typeof browser?.version === 'function' ? browser.version() : '');
}

/** For a persistent context (a saved profile), whose options are fixed before the version is known: send the
 * ordinary user agent as a header on every request from now on. */
export async function useOrdinaryUserAgent(context) {
  let version = '';
  try {
    const page = context.pages()[0] || (await context.newPage());
    version = ((await page.evaluate(() => navigator.userAgent)) || '').match(/Chrome\/([\d.]+)/)?.[1] || '';
  } catch { /* fall back to the default version */ }
  await context.setExtraHTTPHeaders({ 'user-agent': ordinaryUserAgent(version) });
}
