// page.mjs — the intake page and the confirmation page, as HTML strings.
// No external assets; the light/dark tokens are the ones plan/to-html.mjs uses.
// Every word a person reads is a plain word (D-55, D-64); field names stay in the JSON.

import { PICVIEW } from '../ui/picview.mjs';
import { localDay } from '../day.mjs';
import fs from 'node:fs';
import { notesUi } from '../notes-ui.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { voiceOptions, loadCatalogue, findVoice } from '../../tts/catalogue.mjs';
import { THEME_TOGGLE } from '../ui/theme.mjs';
import { STYLES as CAPTION_STYLES, ENGINE_JS as CAPTION_ENGINE, styleCss as captionCss, DEFAULT_CAPTIONS } from '../captions/styles.mjs';
import { previewFontCss, fontFor as captionFontFor } from '../captions/captions.mjs';
import { FAVICON } from '../ui/favicon.mjs';

const e = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const jsonForScript = (obj) => JSON.stringify(obj ?? null).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');

/** What the user reads for each field in the file. */
export const LABELS = {
  product: 'Product name', url: 'Product address', product_type: 'Target surface',
  viewer: 'Who it is for', claim: 'What it is (the core message)',
  pain_point: 'The problem it solves', proof_moment: 'The proof (the aha moment)', cta: 'Call to action',
  template: 'Template', video_type: 'Video type', length_s: 'Length', narration: 'Narration', voice: 'Voice', voice_source: 'Voice source',
  register: 'Copy tone', autonomy: 'Autonomy level',
  look: 'Styles and effects', footage: 'Footage you already have', sign_in: 'Your app authentication', screens: 'Where the product UI/screens come from',
  reference: 'Reference video', project_name: 'Project name', format: 'Frame',
};

/** The curated music (music/curated.json, D-65) with each track's credit and its 12-second preview (music/samples/, scripts/music-samples.mjs). */
export function musicTracks() {
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'music');
  let tracks = [], credits = {};
  try { tracks = JSON.parse(fs.readFileSync(path.join(dir, 'curated.json'), 'utf8')).tracks || []; } catch { tracks = []; }
  try {
    const md = fs.readFileSync(path.join(dir, 'ATTRIBUTION.md'), 'utf8');
    for (const m of md.matchAll(/^\| ([^|]+\.(?:mp3|ogg)) \| [^|]+ \| ([^|]+) \| [^|]+ \| ([^|]+) \|$/gm)) credits[m[1].trim()] = { creator: m[2].trim(), licence: m[3].trim().split(' (')[0].replace(/^BY\b/, 'CC BY') };
  } catch { credits = {}; }
  return tracks.filter((t) => fs.existsSync(path.join(dir, t.file))).map((t) => {
    const sample = `${path.basename(t.file).replace(/\.[^.]+$/, '')}.mp3`;
    return { file: t.file, title: t.title, set: t.set || 'energetic', bpm: t.bpm, mood: t.mood || [], ...(credits[t.file] || {}), sample: fs.existsSync(path.join(dir, 'samples', sample)) ? sample : null };
  });
}

/** The folder of template thumbnails, served at /assets/ and referenced relatively so preview.html works too. */
export const ASSETS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), 'assets');

/** `template id \u2192 source name` from assets/templates/SOURCES.md, when it is there. */
export function readTemplateSources(file = path.join(ASSETS_DIR, 'templates', 'SOURCES.md')) {
  let text = '';
  try { text = fs.readFileSync(file, 'utf8'); } catch { return {}; }
  const after = text.split(/Sources:\s*/)[1] ?? '';
  const out = {};
  for (const m of after.matchAll(/\b([a-z][a-z0-9-]*)=([^;]+?)(?=;|\.\s|\.?\s*$)/g)) out[m[1]] = m[2].trim();
  return out;
}
export const TEMPLATE_SOURCES = readTemplateSources();

/** The nine templates: the name shown, a one-line description, the typical length, and the suggested seconds. */
export const TEMPLATE_META = [
  { id: 'launch', name: 'Launch', desc: 'A hook, the reveal, the result in motion, the breadth, a punchline, the close.', typical: '20–30 s short, 45–60 s full', suggest: 30 },
  { id: 'feature-showcase', name: 'Feature showcase', desc: 'A hook, then numbered features at a fixed rhythm, then the close.', typical: '45–90 s', suggest: 60 },
  { id: 'feature-focus', name: 'Feature focus', desc: 'One feature end to end, before and after.', typical: '30–60 s', suggest: 45 },
  { id: 'product-tour', name: 'Product tour', desc: 'The main screens in order, usually narrated.', typical: '1–3 min', suggest: 120 },
  { id: 'explainer', name: 'Explainer', desc: 'The problem, the solution, how it works, usually narrated.', typical: '1–2 min', suggest: 90 },
  { id: 'milestone', name: 'Milestone / data story', desc: 'The number is the claim.', typical: '30–90 s', suggest: 45 },
  { id: 'kinetic-type', name: 'Kinetic type', desc: 'The words are the motion.', typical: '20–40 s', suggest: 30 },
  { id: 'talking-head-recut', name: 'Talking-head recut', desc: 'Your presenter footage with titles, captions and cards timed to the words.', typical: 'the length of your footage', suggest: null },
  { id: 'ad', name: 'Ad', desc: 'A hook in the first second, one proof, one call to action; works with the sound off.', typical: '6–15 s', suggest: 10 },
];

/** D-77: the four video types, each for the whole product or one feature; the length is indicative. */
export const VIDEO_TYPE_META = [
  { id: 'launch', name: 'Launch', desc: 'A hyped reveal of the product or a new feature: the hook, the reveal, the result in motion, the close.', typical: '20–60 s', suggest: { product: 45, feature: 30 } },
  { id: 'explainer', name: 'Explainer', desc: 'How it works: the problem, the product, the main screens in order. A full tour is an explainer at 1–3 min.', typical: '45 s–3 min', suggest: { product: 90, feature: 45 } },
  { id: 'spotlight', name: 'Spotlight', desc: 'Hyped like a launch, but built around a few values or features rather than an introduction.', typical: '30–90 s', suggest: { product: 60, feature: 40 } },
  { id: 'ad', name: 'Ad', desc: 'For paid placement: a hook in the first second, one proof, one call to action; works with the sound off.', typical: '6–30 s', suggest: { product: 15, feature: 15 } },
  // D-88: the fifth type
  { id: 'tutorial', name: 'Tutorial', desc: 'Step by step: how to use an area of the product, reach a goal or work a feature, with the cursor on every click.', typical: '1–5 min, longer in chapters', suggest: { product: 120, feature: 90 } },
];

/** D-89: what a tutorial covers, with the context each kind asks for. */
export const TUTORIAL_KIND_META = [
  { id: 'interface', name: 'An interface', desc: 'What you can do in one screen or area, e.g. the dashboard.' },
  { id: 'use-case', name: 'A use case', desc: 'A goal reached end to end, e.g. connect your mailbox, then set up an outbound sequence.' },
  { id: 'feature', name: 'A feature', desc: 'How one feature works, e.g. campaigns, or connecting Stripe and creating billing products.' },
];

export const NARRATION = [
  { id: 'narrated', value: 'voice', name: 'Narrated & music', desc: 'A voice tells it; music underneath.' },
  { id: 'both', value: 'hybrid', name: 'Narrated & music', desc: 'A voice in the middle; music alone at the open and close.' },
  { id: 'music-only', value: 'music-only', name: 'Music only', desc: 'The words on screen.' },
];

export const PRODUCT_TYPES = [
  { id: 'web-app', name: 'Web app', desc: 'Runs in the browser. Widescreen, 16:9; screens behind a login can be captured.' },
  { id: 'mobile-app', name: 'Mobile app', desc: 'Its screens shown inside a phone outline, in a wide or a vertical video (Format, under Video type).' },
  { id: 'website', name: 'Website only', desc: 'Nothing to sign into: the public site is what gets captured. Widescreen.' },
];

// D-100: where the video shows the product, any mix; the main one becomes product_type
export const SURFACES = [
  { id: 'website', name: 'Public website', desc: 'Your public pages, nothing to sign into.' },
  { id: 'web-app', name: 'Web app (signed in)', desc: 'The product in the browser; screens behind your login can be captured.' },
  { id: 'mobile-app', name: 'Mobile app', desc: 'From your screen recordings or an iPhone connected to this Mac, shown in a phone outline.', soon: true },
];

export const VOICE = [
  { id: 'female', name: 'Female' },
  { id: 'male', name: 'Male' },
  { id: 'none', name: 'No preference' },
];

export const VOICE_SOURCE = [
  { id: 'built-in', name: 'Free built-in voice', desc: 'Included; nothing to set up.' },
  { id: 'own-account', name: 'My own paid voice account', desc: 'e.g. ElevenLabs. The API key goes in the project’s env file, never here.' },
];

export const TONE = [
  { id: 'factual', name: 'Factual', example: 'Invite teammates from Settings; each gets an email link.' },
  { id: 'balanced', name: 'Balanced', example: 'Bring your whole team in with one invite.' },
  { id: 'bold', name: 'Bold', example: 'Your whole team on board before the coffee cools.' },
];

export const AUTONOMY = [
  { id: 'user-reviewed', value: 'review', name: 'User reviewed', desc: 'You approve the direction and the still frames before anything renders.' },
  { id: 'auto', value: 'director', name: 'Auto', desc: 'The skill self-reviews to a score and shows you the finished video.' },
];

// D-96: the brief's steps, and what a video can be for
const BRIEF_STEPS = ['Start', 'Overview', 'Screens and footage', 'Sound', 'Look and finish'];
export const PURPOSE_CHIPS = ['Landing page', 'Launch post', 'Product Hunt', 'Onboarding', 'Help centre', 'Sales demos', 'Paid ads', 'Social posts'];

export const LOOK_CHIPS = ['kinetic type', '3D elements', 'cinematic', 'minimal', 'neon', 'playful', 'corporate', 'warm', 'dark', 'light'];

// 2026-11-11: each look gets a small moving picture of itself, drawn in CSS (no images to ship), so a word like
// "kinetic" or "3D" is not left to the imagination. Motion stops for viewers who ask for less of it.
const LOOK_CLASS = { 'kinetic type': 'lk-kin', '3D elements': 'lk-3d', cinematic: 'lk-cine', minimal: 'lk-min', neon: 'lk-neon', playful: 'lk-play', corporate: 'lk-corp', warm: 'lk-warm', dark: 'lk-dark', light: 'lk-light' };
const LOOK_ART = {
  'kinetic type': '<i>MAKE</i><i>IT</i><i>MOVE</i>',
  '3D elements': '<i></i>',
  cinematic: '<i></i>',
  minimal: '<i></i>',
  neon: '<i>live</i>',
  playful: '<i></i><i></i><i></i>',
  corporate: '<i></i><i></i><i></i><i></i>',
  warm: '<i></i>',
  dark: '<i></i><i></i>',
  light: '<i></i><i></i>',
};
const LOOK_CSS = `
.ltiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:10px}
@media (max-width:760px){.ltiles{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width:460px){.ltiles{grid-template-columns:repeat(2,minmax(0,1fr))}}
.ltile{display:flex;flex-direction:column;gap:6px;padding:6px;border:1px solid var(--line);border-radius:12px;background:var(--card);cursor:pointer;font:inherit;color:var(--fg);text-align:left}
.ltile b{font-size:12.5px;font-weight:600;padding:0 2px 2px}
.ltile.on{border-color:var(--fg);background:var(--pale);box-shadow:inset 0 0 0 1px var(--fg)}
.lk{position:relative;display:block;aspect-ratio:16/9;border-radius:8px;overflow:hidden;container-type:size}
.lk i{position:absolute;display:block;font-style:normal}
.lk-kin{background:#111;color:#fff}
.lk-kin i{left:10%;opacity:0;font:900 19cqh/1 var(--ud-display,system-ui),system-ui,sans-serif;letter-spacing:-.03em;animation:lkKin 3s infinite}.lk-kin i:nth-child(1){top:14%}.lk-kin i:nth-child(2){top:40%;animation-delay:.25s;color:#DFFE02}.lk-kin i:nth-child(3){top:66%;animation-delay:.5s}
@keyframes lkKin{0%{opacity:0;transform:translateX(-30%)}12%,70%{opacity:1;transform:none}85%,100%{opacity:0;transform:translateX(20%)}}
.lk-3d{background:linear-gradient(160deg,#e9ecf4,#cfd6e6);perspective:120px}
.lk-3d i{left:28%;top:18%;width:44%;height:64%;border-radius:6px;background:linear-gradient(135deg,#fff,#dfe4f0);box-shadow:6px 10px 14px rgba(20,30,60,.3);animation:lk3d 4s ease-in-out infinite alternate}
@keyframes lk3d{from{transform:rotateY(-28deg) rotateX(10deg)}to{transform:rotateY(28deg) rotateX(-6deg)}}
.lk-cine{background:radial-gradient(circle at 60% 40%,#d8a35a,#5a3420 70%)}
.lk-cine:before,.lk-cine:after{content:"";position:absolute;left:0;right:0;height:16%;background:#000;z-index:1}.lk-cine:before{top:0}.lk-cine:after{bottom:0}
.lk-cine i{inset:0;background:radial-gradient(circle at 40% 55%,rgba(255,230,180,.55),transparent 45%);animation:lkCine 6s ease-in-out infinite alternate}
@keyframes lkCine{from{transform:scale(1)}to{transform:scale(1.25) translateX(6%)}}
.lk-min{background:#fafaf7}
.lk-min i{left:18%;top:50%;height:2px;width:0;background:#111;animation:lkMin 3s ease-in-out infinite}
.lk-min:after{content:"";position:absolute;right:18%;top:calc(50% - 4px);width:8px;height:8px;border-radius:50%;background:#111}
@keyframes lkMin{0%{width:0}50%,100%{width:54%}}
.lk-neon{background:#07060d}
.lk-neon i{inset:0;display:grid;place-items:center;font:700 26cqh/1 system-ui,sans-serif;color:#ffe6fb;text-shadow:0 0 4px #ff2bd6,0 0 12px #ff2bd6,0 0 24px #7a2bff;animation:lkNeon 2.4s infinite}
@keyframes lkNeon{0%,100%{opacity:1}46%{opacity:1}48%{opacity:.35}50%{opacity:1}}
.lk-play{background:#fff4d6}
.lk-play i{width:22%;aspect-ratio:1;border-radius:50%;bottom:18%;animation:lkPlay 1.2s ease-in-out infinite alternate}
.lk-play i:nth-child(1){left:12%;background:#ff5a5f}.lk-play i:nth-child(2){left:39%;background:#3ec1ff;animation-delay:.2s}.lk-play i:nth-child(3){left:66%;background:#ffc93c;animation-delay:.4s}
@keyframes lkPlay{to{transform:translateY(-55%)}}
.lk-corp{background:#0f3d8c}
.lk-corp i{bottom:16%;width:12%;background:#cfe0ff;border-radius:2px 2px 0 0;animation:lkCorp 3s ease-out infinite}
.lk-corp i:nth-child(1){left:18%;height:30%}.lk-corp i:nth-child(2){left:36%;height:45%;animation-delay:.15s}.lk-corp i:nth-child(3){left:54%;height:58%;animation-delay:.3s}.lk-corp i:nth-child(4){left:72%;height:70%;animation-delay:.45s}
@keyframes lkCorp{0%{transform:scaleY(0);transform-origin:bottom}30%,100%{transform:scaleY(1);transform-origin:bottom}}
.lk-warm{background:linear-gradient(180deg,#ffb36b,#ff7a59 60%,#c8495a)}
.lk-warm i{left:38%;width:24%;aspect-ratio:1;border-radius:50%;background:#ffe2a6;animation:lkWarm 5s ease-in-out infinite alternate}
@keyframes lkWarm{from{top:55%}to{top:22%}}
.lk-dark{background:#121417}.lk-light{background:#f4f3ef}
.lk-dark i,.lk-light i{left:12%;border-radius:4px}
.lk-dark i:nth-child(1),.lk-light i:nth-child(1){top:18%;width:46%;height:14%}
.lk-dark i:nth-child(2),.lk-light i:nth-child(2){top:42%;width:76%;height:40%}
.lk-dark i{background:#2a2e35}.lk-dark i:nth-child(1){background:#e8eaed}
.lk-light i{background:#dcdad3}.lk-light i:nth-child(1){background:#17181a}
@media (prefers-reduced-motion:reduce){.lk i{animation:none!important;opacity:1!important}}
`;

const NARRATION_WORDS = { voice: 'narrated', 'music-only': 'music only', hybrid: 'narrated with music' };
const AUTONOMY_WORDS = { review: 'user reviewed', director: 'auto' };
const SIGN_IN_WORDS = {
  public: 'public website only',
  'own-browser': 'your own browser, through the Claude in Chrome extension',
  'dedicated-profile': 'a dedicated profile with a visible first sign-in',
  'hosted-live-view': 'the hosted live view (hosted app only)',
  token: 'an auth token or magic link sent by your app',
  'demo-account': 'a demo or test account, its sign-in in the project\'s env file',
};
const FOOTAGE_WORDS = { none: 'none needed; the skill records the product', upload: 'video files on this computer', existing: 'YouTube videos', record: 'you will record some first' };
const PRODUCT_TYPE_WORDS = { 'web-app': 'web app · widescreen', 'mobile-app': 'mobile app · vertical frame in a phone outline', website: 'website only · the public site is captured' };
const VOICE_WORDS = { female: 'female', male: 'male', none: 'no preference' };
const VOICE_SOURCE_WORDS = { 'built-in': 'free built-in voice', 'own-account': 'your own paid voice account (key in the env file)' };

// ---------------------------------------------------------------------------
// Shared CSS: the same tokens as plan/to-html.mjs, phone-first
// ---------------------------------------------------------------------------
/** The page header: the logo (light and dark colourways, swapped by ui.css). */
export const UD_HEAD = '<header class="ud-head"><a href="/" aria-label="Ultrademo"><img class="ud-logo ud-logo--light" src="/ui/logos/ultrademo-horizontal-flow-light.svg" alt="Ultrademo" width="168" height="28"><img class="ud-logo ud-logo--dark" src="/ui/logos/ultrademo-horizontal-flow-dark.svg" alt="" width="168" height="28"></a>' + THEME_TOGGLE + '</header>';

// password managers (LastPass, 1Password, Bitwarden) must not offer to fill these: they are not logins
const NOFILL = 'autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"';

/** The loader card the saved and outline pages share: a spinner, the steps Claude works through, a copy box. */
export const WORK_CSS = `
.working .work-head{display:grid;grid-template-columns:auto 1fr;gap:16px;align-items:start}.working h2{margin:0 0 4px}.working p{margin:0}
.spin{width:28px;height:28px;border-radius:50%;border:3px solid var(--line);border-top-color:var(--fg);animation:udspin 0.9s linear infinite;margin-top:4px}
.spin.stop{animation:none;border-color:var(--fg);background:var(--action)}
@keyframes udspin{to{transform:rotate(360deg)}}
.work-steps{list-style:none;margin:18px 0 0;padding:0;display:grid;gap:8px}
.work-steps li{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:14.5px}
.work-steps li::before{content:"";flex:none;width:16px;height:16px;border-radius:50%;border:1.5px solid var(--line)}
.work-steps li.now{color:var(--fg);font-weight:600}.work-steps li.now::before{border-color:var(--fg);border-top-color:transparent;animation:udspin 0.9s linear infinite}
.work-steps li.done{color:var(--fg)}.work-steps li.done::before{content:"✓";display:grid;place-items:center;font-size:11px;font-weight:800;line-height:1;color:var(--card);background:var(--fg);border-color:var(--fg)}
.nudge{margin-top:18px;padding:12px 14px;border:1.5px dashed var(--fg);border-radius:var(--radius-md);background:var(--pale)}.nudge p{margin:0 0 8px}
.copyrow{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.copyrow code{font:500 14px var(--font-mono);padding:8px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card)}`;

const CSS = `
/* D-96: the brief in five steps, the overview, the summary rail */
/* the brief's five steps: a slim segmented track under the header, not a second row of pills */
.bsub{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;margin:0;padding:0;list-style:none;font-size:12.5px}
.bsub li button{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-wrap:wrap;align-items:center;gap:2px 6px;width:100%;padding:2px 0;color:var(--muted)}
.bsub li button::before{content:"";flex:1 0 100%;height:5px;border-radius:3px;background:var(--line);margin-bottom:4px}
.bsub li button:disabled{cursor:default;opacity:.6}
.bsub li button .n{font:600 11px var(--font-mono);opacity:.7}
.bsub li.now button{color:var(--fg);font-weight:600}.bsub li.now button::before{background:var(--fg)}
.bsub li.done button{color:var(--fg)}.bsub li.done button::before{background:color-mix(in srgb,var(--fg) 35%,transparent)}
.bsub li button:not(:disabled):hover::before{background:color-mix(in srgb,var(--fg) 60%,transparent)}
.bsub .cnt{font:600 11px var(--font-mono);color:var(--hot)}
.bgrid{display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:24px;align-items:start}
@media (max-width:980px){.bgrid{grid-template-columns:1fr}}
.bstep[hidden]{display:none}#s-captions[hidden]{display:none}.bhead h1{margin:6px 0 4px}.bhead .lead{margin:0 0 16px}
.brail{position:sticky;top:150px;border:1px solid var(--line);border-radius:18px;background:var(--card);padding:14px;max-height:calc(100vh - 180px);overflow:auto}
.brail h3{margin:0 0 2px;font-size:15px}.brail .rsub{font-size:12.5px;color:var(--muted);margin:0 0 10px}
.brail ol{list-style:none;margin:0;padding:0;display:grid;gap:1px}
.brail li button{all:unset;cursor:pointer;display:grid;grid-template-columns:1fr auto;gap:1px 8px;width:100%;box-sizing:border-box;padding:6px 8px;border-radius:8px;font-size:13px}
.brail li button:hover{background:var(--bg)}
.brail .k{color:var(--muted);font-size:11.5px}.brail .v{grid-column:1;font-weight:600;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.brail .st{grid-row:1/span 2;grid-column:2;align-self:center;font:600 9.5px var(--font-mono);text-transform:uppercase;color:var(--muted);white-space:nowrap}
.brail .check .st{color:var(--hot)}.brail .gap{font:600 10.5px var(--font-mono);text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:10px 8px 2px}
:root{--hot:#d10f57;--mk-bg:#eefbb4;--mk-line:#0c0e09;--mk-fg:#0c0e09;--ck-bg:#ffe1ec;--ck-fg:#0c0e09;--ed-bg:#fff4c2;--pick:#4d6b1f}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--hot:#ff5c93;--mk-bg:rgba(223,254,2,.16);--mk-line:#dffe02;--mk-fg:#f4f6ee;--ck-bg:rgba(255,32,112,.24);--ck-fg:#fff;--ed-bg:rgba(248,225,49,.2);--pick:#c5e46a}}
:root[data-theme="dark"]{--hot:#ff5c93;--mk-bg:rgba(223,254,2,.16);--mk-line:#dffe02;--mk-fg:#f4f6ee;--ck-bg:rgba(255,32,112,.24);--ck-fg:#fff;--ed-bg:rgba(248,225,49,.2);--pick:#c5e46a}
.atag{font:600 10px var(--font-mono);text-transform:uppercase;letter-spacing:.05em;color:var(--muted);display:inline-flex;gap:6px;align-items:center;margin-left:auto}
.atag.pick{color:var(--pick)}.atag.check{color:var(--hot)}.atag.done,.atag.you{color:var(--fg)}
.atag.check:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--hot)}
.atag button{all:unset;cursor:pointer;font:600 10px var(--font-mono);padding:2px 8px;border-radius:999px;background:var(--fg);color:var(--card);text-transform:none;letter-spacing:0}
.field[data-from="check"]{border-left:3px solid var(--hot);padding-left:10px}
.agrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 18px}@media (max-width:760px){.agrid{grid-template-columns:1fr}}
.agrid textarea{min-height:0}
/* the attributes line up in rows: label, help, box share their tracks across the two columns */
.agrid .field{margin:0 0 18px;min-width:0}
.agrid .field:has(> textarea){display:grid;grid-template-rows:subgrid;grid-row:span 2;align-content:start}
.agrid .field:has(> textarea)>.hint{margin:0!important;align-self:start}
.agrid .lab{align-items:center;flex-wrap:wrap;row-gap:4px}.agrid .lab>label,.agrid .lab>.l{margin-right:auto}
.agrid .lab .atag{order:1;margin-left:0}.agrid .lab .unsure{order:2}
/* the length: the seconds first, then a compact choice of how strict */
.lenfit[hidden]{display:none!important}.lensent #f-length_s{width:calc(4ch + 66px)!important;min-width:0;padding-right:46px!important;text-align:right}.lensent select{max-width:180px}
.lensent{display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px}.lensent select{width:auto;flex:none}
.lenin{position:relative;display:inline-flex;align-items:center;flex:none}.lenin input{width:calc(4ch + 58px);padding-right:44px;text-align:right;font-variant-numeric:tabular-nums}.lenin .unit{position:absolute;right:12px;color:var(--muted);font-size:14px;pointer-events:none}
.lenfit-desc{margin-top:6px}
[data-slot="attrs-after"]>*{margin-top:4px}
.fromstart{display:flex;gap:6px 14px;flex-wrap:wrap;margin:-4px 0 12px;color:var(--muted)}.fromstart b{color:var(--fg);font-weight:600}.fromstart button{all:unset;cursor:pointer;text-decoration:underline;color:var(--fg)}
.ovcard{border:1.5px solid var(--fg)}
.ovhead{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:10px}.ovhead .quiet{margin-left:auto}
.overview{font-size:18.5px;line-height:1.6;outline:none;padding:6px 4px;border-radius:8px;min-height:3em}
.overview:focus{box-shadow:0 0 0 3px var(--focus,#9bb7ff)}
.overview,.overview *{color:var(--fg)!important;font-family:inherit!important;font-size:inherit!important}.overview *:not(mark){background:transparent!important}
.overview mark{background:var(--mk-bg)!important;color:var(--mk-fg)!important;border-bottom:2px solid var(--mk-line);padding:0 2px;border-radius:3px}
.overview mark.check{background:var(--ck-bg)!important;color:var(--ck-fg)!important;border-bottom-color:var(--hot)}
.overview mark.edited{background:var(--ed-bg)!important;border-bottom-style:dashed}.overview mark.flash{outline:2px solid var(--fg)}
.missing{margin-top:12px;padding:10px 12px;border:1.5px dashed var(--hot);border-radius:12px;font-size:14px}.missing[hidden]{display:none}
.missing .row{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.missing button{font-size:13px;padding:5px 11px}
.drafting[hidden],.ovcard[hidden]{display:none}
.ovcard .drafting{margin:14px 0 4px}.ovcard .drafting h2{font-size:19px;letter-spacing:-.01em}.ovcard.loading #overview,.ovcard.loading #ov-missing,.ovcard.loading #ov-foot,.ovcard.loading #ov-again{display:none}
.ov-skel{display:grid;gap:10px;margin-top:18px}.ov-skel i{display:block;height:14px;border-radius:7px;background:linear-gradient(90deg,var(--line) 0%,var(--bg) 50%,var(--line) 100%);background-size:200% 100%;animation:ovshim 1.4s ease-in-out infinite}.ov-skel i:nth-child(2){width:92%}.ov-skel i:nth-child(3){width:64%}
@keyframes ovshim{0%{background-position:100% 0}100%{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){.ov-skel i{animation:none}}
.pchips{display:grid;grid-template-columns:repeat(8,auto);justify-content:start;gap:6px;margin-bottom:8px}
@media (max-width:1240px){.pchips{grid-template-columns:repeat(4,minmax(0,1fr));justify-content:stretch}}@media (max-width:560px){.pchips{grid-template-columns:repeat(2,minmax(0,1fr))}}
.pchips .chip{white-space:nowrap;text-align:center;font:inherit;font-size:13px;padding:6px 11px;border-radius:999px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer}
.pchips .chip.on{background:var(--pale);border-color:var(--fg)}
.dstate{display:inline-flex;gap:6px;align-items:center;padding-top:9px}.dstate.good{color:var(--good);font-weight:600}.dstate.bad{color:var(--bad);font-weight:600}.dmark{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;color:#fff;font-size:12px;font-weight:700;flex:none}.dstate.good .dmark{background:var(--good)}.dstate.bad .dmark{background:var(--bad)}
.brandrow.br-done .br-name input{background:transparent;border-color:transparent;padding-left:0;font-weight:600;box-shadow:none}.brandrow [hidden]{display:none!important}
.brandrow{display:flex;flex-wrap:wrap;align-items:center;gap:12px 16px;padding:18px 22px}.br-q{flex:1 1 280px;display:flex;flex-direction:column;gap:2px}.br-name{display:flex;align-items:center;gap:8px;flex:0 1 260px}.br-name input{width:100%;height:44px}.brandrow button{height:44px}.brandrow #brand-ask-status{flex-basis:100%;margin:0}.brandrow #brand-ask-status:empty{display:none}
.bname{max-width:460px;margin:6px 0 12px}.bname label{display:block;font-weight:600;margin-bottom:4px}.bname input{width:100%}.bname .small{display:block;margin-top:4px}.bstat.good{color:var(--good);font-weight:600}.bstat.bad{color:var(--bad);font-weight:600}
/* help lines folded into an (i): shown on hover, focus or a tap (less noise on the page) */
.hinfo{all:unset;box-sizing:border-box;position:relative;display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;margin-left:8px;padding:0;border-radius:50%;border:1.5px solid var(--muted);background:none;color:var(--muted);font:700 12px/1 Georgia,serif;font-style:italic;cursor:help;vertical-align:middle;flex:none}
.hinfo:hover,.hinfo:focus-visible,.hinfo.open{border-color:var(--fg);color:var(--fg);outline:none}
.hinfo .tip{display:none;position:absolute;left:-10px;top:28px;z-index:40;width:max-content;max-width:360px;padding:10px 12px;border-radius:10px;background:var(--fg);color:var(--card);font:400 13.5px/1.45 var(--font-body,system-ui);font-style:normal;text-align:left;text-transform:none;letter-spacing:0;white-space:normal;box-shadow:0 12px 30px rgba(0,0,0,.18)}
.hinfo .tip a{color:inherit}
.hinfo:hover .tip,.hinfo:focus-visible .tip,.hinfo.open .tip{display:block}
h2 .hinfo{width:22px;height:22px;font-size:13px}.hinfo{min-height:0;min-width:0;line-height:1}
input::placeholder,textarea::placeholder{font-size:.84em}
.ud-eyebrow .started{margin-left:10px;padding:2px 10px;border:1px solid var(--line);border-radius:999px;text-transform:none;letter-spacing:0;font:500 12px var(--ud-body);color:var(--muted)}
.fpick{position:relative;max-width:420px}.fpbtn{width:100%;display:flex;align-items:center;justify-content:space-between;gap:10px;height:52px;padding:0 16px;border:1.5px solid var(--line);border-radius:12px;background:var(--card);color:var(--fg);font-size:20px;cursor:pointer;text-align:left}.fpbtn:focus-visible{outline:2px solid var(--fg);outline-offset:2px}.fpcar{font-size:14px;color:var(--muted)}
.fppanel{position:absolute;left:0;right:0;top:56px;z-index:30;background:var(--card);border:1.5px solid var(--line);border-radius:12px;box-shadow:0 18px 40px rgba(0,0,0,.14);padding:8px}.fpsearch{width:100%;margin-bottom:6px}.fplist{max-height:300px;overflow:auto;display:flex;flex-direction:column;gap:2px}
.fpopt{display:flex;align-items:baseline;justify-content:space-between;gap:10px;padding:8px 10px;border:0;border-radius:8px;background:none;color:var(--fg);font-size:20px;text-align:left;cursor:pointer}.fpopt:hover,.fpopt:focus-visible,.fpopt.on{background:var(--pale)}.fpopt small{font:500 11px var(--font-mono,ui-monospace);text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.fpnote{margin-top:4px}.fpnote:empty{display:none}
.qhead{display:flex;gap:16px;align-items:center;justify-content:space-between;flex-wrap:wrap}.qhead>div{flex:1 1 320px}.qhead b{display:block;font-size:16px;margin-bottom:2px}#qbody{margin-top:4px}
.qrows{display:grid;gap:8px;margin:12px 0 8px}.qrow{display:grid;grid-template-columns:150px 1fr auto;gap:8px}@media (max-width:640px){.qrow{grid-template-columns:1fr}}
.bar-r{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-left:auto}
.traits{display:flex!important;gap:4px;flex-wrap:wrap;margin-top:4px}.traits i{font-style:normal;font-size:11px;line-height:1.5;padding:0 6px;border-radius:999px;border:1px solid var(--line);color:var(--fg)}
.opts.vgrid .vmeta{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vcollapsed .vopt.more{display:none}
main:has(.bgrid){max-width:1200px}
#bmain section.card>h2,#bmain details.card>summary b{font-family:var(--ud-display);font-weight:800;font-size:20px;letter-spacing:-.02em;line-height:1.2;margin:0 0 12px}
.bar .status{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12.5px}
.bar{flex-wrap:nowrap}@media (max-width:700px){.bar{flex-wrap:wrap}.bar .status{flex-basis:100%;order:3}}
/* The Ultrademo design system, Flow (plan/ui/ui.css, linked first): the page's names map onto its role tokens. */
:root{--bg:var(--surface-soft);--card:var(--surface);--fg:var(--text);--muted:var(--text-muted);--pale:var(--surface-highlight);--good:#2f7a3d;--bad:#b23a2e;--mid:#8a6400}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--good:#6cc27c;--bad:#ff8a7a;--mid:#e0b23c}}
:root[data-theme="dark"]{--good:#6cc27c;--bad:#ff8a7a;--mid:#e0b23c}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 var(--ud-body)}
main{max-width:1200px;margin:0 auto;padding:28px 16px 120px}
h1{font-family:var(--ud-display);font-weight:800;font-size:clamp(30px,5vw,44px);letter-spacing:-.035em;line-height:1.04;margin:10px 0 10px;text-wrap:balance}h2{font-family:var(--ud-display);font-weight:800;font-size:28px;letter-spacing:-.03em;line-height:1.1;margin:0 0 8px}
.ud-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 28px}
.lead{color:var(--muted);margin:0 0 6px}.notice{background:var(--pale);border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 16px;margin:14px 0 22px;font-size:14.5px}
.muted{color:var(--muted)}.small{font-size:12.5px}.mono{font:500 12.5px var(--font-mono)}
section.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-flow);padding:var(--space-5);margin:0 0 var(--space-5)}
section.card.hero{border:1.5px solid var(--text);box-shadow:var(--shadow-block)}
@media(max-width:520px){section.card{padding:var(--space-4)}}
section.card>.help{color:var(--muted);font-size:13.5px;margin:0 0 12px}
.field{margin:14px 0 0}.field:first-of-type{margin-top:0}
.lab{display:flex;justify-content:space-between;align-items:baseline;gap:12px;margin-bottom:4px}
.lab label,.lab .l{font-weight:600;font-size:14px}.lab .hint{color:var(--muted);font-size:12.5px;font-weight:400}
.unsure{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted);cursor:pointer;white-space:nowrap}.unsure input{margin:0}
input[type=text],input[type=url],input[type=number],textarea,select{width:100%;font:inherit;color:var(--fg);background:var(--bg);border:1px solid var(--line);border-radius:var(--radius-md);padding:10px 12px;outline:none}
input:focus,textarea:focus{border-color:var(--fg)}textarea{min-height:68px;resize:vertical}
.field.is-unsure input,.field.is-unsure textarea{background:var(--card);border-style:dashed;color:var(--muted)}
.row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:start}
.counter{font-size:12.5px;color:var(--muted);margin-top:3px}.counter.over{color:var(--bad)}
button{font:600 14px/1 var(--ud-body);cursor:pointer;border-radius:var(--radius-pill);padding:10px 16px;min-height:40px;border:0;background:transparent;color:var(--fg);box-shadow:inset 0 0 0 1.5px var(--fg);transition:transform .3s var(--ud-ease)}button:hover{transform:translateY(-1px)}
button.primary{background:var(--action);box-shadow:inset 0 0 0 1.5px var(--ud-action-edge);color:var(--on-action);font-size:15.5px;padding:14px 24px;min-height:48px}
button.primary:disabled{opacity:.6;cursor:wait}
button.quiet{box-shadow:inset 0 0 0 1px var(--line);color:var(--fg);background:var(--card);padding:7px 12px;min-height:32px;font-size:13px}
.chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.chip{display:inline-block;border:1px solid var(--line);border-radius:999px;padding:3px 10px;font-size:13px;background:var(--bg);cursor:pointer;user-select:none}
.chip.on{background:var(--pale);border-color:var(--fg)}
.opts{display:grid;grid-template-columns:1fr;gap:8px;margin-top:6px}
@media(min-width:640px){.opts.two{grid-template-columns:1fr 1fr}.opts.three{grid-template-columns:1fr 1fr 1fr}}
@media(min-width:640px){.opts.vgrid{grid-template-columns:1fr 1fr}}@media(min-width:900px){.opts.vgrid{grid-template-columns:1fr 1fr 1fr}}
.opt em.pill{display:inline-block;vertical-align:2px;margin-left:6px;padding:1px 8px;border:1px solid var(--line);border-radius:999px;font:600 11px var(--ud-body);font-style:normal;color:var(--muted);white-space:nowrap}.opt em.pill.soon{border-color:var(--fg);color:var(--fg)}
.opts.four{gap:8px}@media(min-width:760px){.opts.four{grid-template-columns:repeat(4,minmax(0,1fr))}}
#s-sound .opt{padding:10px 12px}#s-sound .opts.vgrid .opt{padding:8px 10px}#s-sound .vmeta{font-size:12.5px}#s-sound .opt span{font-size:13px;line-height:1.35}
.opts.vgrid{gap:6px}.opts.vgrid .opt{padding:8px 10px;gap:8px}.opts.vgrid .opt>div{min-width:0}
.vtop{display:flex;align-items:center;justify-content:space-between;gap:6px}.vtop b{font-size:13.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.vdesc{display:block;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.vmeta{display:block;font-size:11.5px;color:var(--muted);opacity:.8}.vsetup{display:block;font-size:11.5px;color:var(--muted);margin-top:2px}
.vopt button.play{flex:none;min-width:30px;height:26px;padding:0 9px;font-size:12px;line-height:1;border-radius:999px}
.vopt[hidden]{display:none}.vopt .tag{font-style:normal;font-weight:600;font-size:11px;background:var(--pale);border:1px solid var(--line);border-radius:999px;padding:1px 7px;margin-left:6px;vertical-align:1px}
.opt{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:start;border:1px solid var(--line);border-radius:var(--radius-md);padding:12px 14px;background:var(--bg);cursor:pointer}
.opt input[type=radio],.opt input[type=checkbox],.unsure input{accent-color:var(--fg)}
.opt input{margin:4px 0 0}.opt b{display:block;font-size:14px}.opt span{display:block;color:var(--muted);font-size:12.5px}.opt .ex{font-style:italic;color:var(--fg);margin-top:2px}
.opt:has(input:checked){background:var(--pale);border-color:var(--fg);box-shadow:inset 0 0 0 0.5px var(--fg)}
.opt .thumb{margin:8px 0 0;max-width:100%}.opt .thumb img{display:block;width:160px;max-width:100%;height:auto;aspect-ratio:16/9;border:1px solid var(--line);border-radius:6px;background:var(--card);object-fit:cover}
button.link{background:none;border:0;padding:0;font:inherit;color:var(--muted);text-decoration:underline;cursor:pointer}
.opt .thumb figcaption{display:block;color:var(--muted);font-size:11.5px;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.opt.off{opacity:.55;cursor:not-allowed}.tag{display:inline-block;font-size:11px;border:1px solid var(--line);border-radius:999px;padding:0 7px;margin-left:6px;color:var(--muted);vertical-align:middle}
.sub{margin:10px 0 0 0;padding:12px;border:1px dashed var(--line);border-radius:10px;background:var(--card)}
.picstrip{margin:14px 0 0}.picstrip[hidden]{display:none}.pgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px;margin-top:6px}
.ptile{position:relative;display:flex;flex-direction:column;gap:5px;padding:6px;border:1.5px solid var(--line);border-radius:10px;background:var(--card);cursor:pointer}
.ptile.on{border-color:var(--fg);background:var(--pale)}.ptile img{width:100%;aspect-ratio:16/10;object-fit:contain;background:var(--bg);border-radius:6px}
.ptile .pview{all:unset;display:block;cursor:zoom-in;border-radius:6px}.ptile .pview:focus-visible{outline:3px solid var(--focus,#5b3df5);outline-offset:2px}
.ptile .pcheck{display:flex;align-items:center;gap:7px;cursor:pointer}.ptile .pcheck input{width:17px;height:17px;margin:0;accent-color:var(--fg)}
.ptile.padd{align-items:center;justify-content:center;gap:4px;min-height:120px;border-style:dashed;border-color:var(--muted);font:inherit;color:var(--fg)}.ptile.padd b{font-size:26px;line-height:1}.ptile.padd span{color:var(--fg);font-weight:600}.ptile span{font-size:12px;color:var(--muted)}
/* a file picker reads as a box to drop into, not part of the page */
input[type=file]{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:14px;border:2px dotted var(--muted);border-radius:12px;background:var(--bg);color:var(--muted);font:inherit;font-size:14px;cursor:pointer}input[type=file]:hover{border-color:var(--fg)}input[type=file]::file-selector-button{margin-right:12px;padding:8px 14px;border:1px solid var(--fg);border-radius:999px;background:var(--card);color:var(--fg);font:inherit;font-weight:600;cursor:pointer}
.sub h3{margin:0 0 6px;font-size:14px}.sub ul,.sub ol{margin:6px 0 0;padding-left:20px}.sub li{margin:3px 0}
/* the logo and the stage bar stay at the top while the page scrolls */
.ud-pin{position:sticky;top:0;z-index:20;background:var(--bg);margin:-28px -16px 18px;padding:14px 16px 10px;border-bottom:1px solid transparent}
.ud-pin.stuck{border-bottom-color:var(--line);box-shadow:0 4px 14px rgba(0,0,0,.05)}.ud-pin .ud-head{margin-bottom:8px}
${WORK_CSS}
.spin-sm{display:inline-block;width:12px;height:12px;border-radius:50%;border:2px solid var(--line);border-top-color:var(--fg);animation:udspin .9s linear infinite;vertical-align:-1px;margin-right:4px}
details.card{background:var(--card);border:1px solid var(--line);border-radius:var(--radius-flow);padding:var(--space-4) var(--space-5);margin:0 0 var(--space-4)}
details.saved-sum>summary{cursor:pointer;list-style:none;display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}details.saved-sum>summary::-webkit-details-marker{display:none}
details.saved-sum>summary::before{content:"▸";color:var(--muted)}details.saved-sum[open]>summary::before{content:"▾"}details.saved-sum[open]>summary{margin-bottom:12px}
aside.info{margin:8px 0 0;padding:14px 18px;border-left:0;border:1px dashed var(--line);border-radius:var(--radius-md);color:var(--muted);font-size:14px}
aside.info h3{margin:0 0 6px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;font-family:var(--font-mono);font-weight:500}aside.info ul{margin:0;padding-left:18px}aside.info li{margin:3px 0}
.brandgrid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:18px}@media(max-width:760px){.brandgrid{grid-template-columns:1fr}}
.logoprev{min-height:90px;border:1px solid var(--line);border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;padding:14px}.logoprev img{max-width:100%;max-height:64px}
.swatches{display:grid;grid-template-columns:1fr 1fr;gap:8px}.swatch{display:flex;gap:8px;align-items:center;font-size:13px;cursor:pointer}.swatch span{display:flex;flex-direction:column}.swatch code{font:500 11.5px var(--font-mono);color:var(--muted)}
.swatch input[type=color]{width:38px;height:38px;border:0;padding:0;background:none;cursor:pointer}.swatch input[type=color]::-webkit-color-swatch-wrapper{padding:0}.swatch input[type=color]::-webkit-color-swatch{border:1px solid var(--line);border-radius:8px}
.ud-progress{list-style:none;display:flex;gap:6px;flex-wrap:wrap;margin:0;padding:0;font-size:13px}
.ud-progress li{display:flex;align-items:center;gap:6px;padding:5px 12px 5px 6px;border:1px solid var(--line);border-radius:999px;color:var(--muted);background:var(--card)}
.ud-progress li span{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--bg);font-size:11.5px;font-weight:700}
.ud-progress li.now{color:var(--fg);border-color:var(--fg);font-weight:600}.ud-progress li.now span{background:var(--fg);color:var(--card)}
.ud-progress li.done{color:var(--fg)}.ud-progress li.done span{background:var(--pale)}
section.card.acc{padding:0}
section.card.acc>.sec-head{all:unset;box-sizing:border-box;display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;width:100%;padding:var(--space-4) var(--space-5);cursor:pointer}
section.card.acc>.sec-head:focus-visible{outline:2px solid var(--fg);outline-offset:-2px;border-radius:var(--radius-flow)}
.sec-head .n{display:inline-grid;place-items:center;width:26px;height:26px;border-radius:50%;border:1px solid var(--line);font-size:12.5px;font-weight:700}
.sec-head h2{margin:0;font-size:20px}.sec-head .sum{grid-column:2;color:var(--muted);font-size:13.5px;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.sec-head .chev{grid-row:1;grid-column:3;color:var(--muted);transition:transform .15s}
section.card.acc.open>.sec-head .chev{transform:rotate(180deg)}section.card.acc.open>.sec-head .sum{display:none}
section.card.acc.filled>.sec-head .n{background:var(--pale)}
section.card.acc>.sec-body{display:none;padding:0 var(--space-5) var(--space-5)}section.card.acc.open>.sec-body{display:block}
.sec-next{margin-top:18px}
details.sitelines{margin:0 0 12px;border:1px solid var(--line);border-radius:10px;padding:8px 12px;background:var(--bg)}details.sitelines summary{cursor:pointer;font-weight:600;font-size:13.5px}
#autofill-note{margin-top:8px}#autofill-note:empty{display:none}
.site{margin-top:10px;padding:10px 12px;border:1px solid var(--line);border-radius:10px;background:var(--bg);display:none}.site.on{display:block}
.site b{display:block;font-size:13px}.site .desc{font-size:13.5px;margin:4px 0}
.detect{font-size:13.5px;margin:0 0 8px;padding:8px 10px;border-radius:8px;background:var(--bg);border:1px solid var(--line)}.detect.remind{background:rgba(214,48,49,.08);border-color:rgba(214,48,49,.4)}.detect[hidden]{display:none}
.bar{position:sticky;bottom:0;background:var(--bg);padding:12px 0 16px;border-top:1px solid var(--line);display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.bar .status{color:var(--muted);font-size:13.5px}.bar .status.bad{color:var(--bad)}
.problems{background:var(--card);border:1px solid var(--bad);border-radius:10px;padding:10px 14px;margin:0 0 14px;display:none}.problems.on{display:block}.problems ul{margin:4px 0 0;padding-left:18px}
.kv{display:grid;grid-template-columns:150px 1fr;gap:10px;padding:7px 0;border-bottom:1px solid var(--line);font-size:14px}.kv:last-child{border-bottom:0}.kv>span{color:var(--muted);font:500 11.5px/1.4 var(--font-mono);text-transform:uppercase;letter-spacing:.1em;padding-top:4px}
@media(max-width:520px){.kv{grid-template-columns:1fr;gap:2px}}
.pill{display:inline-block;font-size:12px;border:1px solid var(--line);border-radius:999px;padding:1px 8px;margin-left:6px;background:var(--bg)}
.pill.unsure{border-style:dashed;color:var(--muted)}
ol.next{padding-left:20px}ol.next li{margin:4px 0}
code{font:500 12.5px var(--font-mono);background:var(--bg);border:1px solid var(--line);border-radius:5px;padding:1px 5px}
`;

// ---------------------------------------------------------------------------
// The intake page
// ---------------------------------------------------------------------------

/**
 * @param {{ prefill?: any, projectDir?: string, today?: string, sample?: boolean }} opts
 *   prefill: an existing `video` block (nulls and `intake` honoured); sample: static preview, no server.
 */
/** D-79: one progress bar across the pages: Brief → Direction → Production → Review → Delivery. */
export const STAGES = [['brief', 'Brief'], ['outline', 'Outline'], ['direction', 'Direction'], ['production', 'Production'], ['review', 'Review'], ['delivery', 'Delivery']];
export function progressBar(current) {
  const at = STAGES.findIndex(([id]) => id === current);
  // the steps whose page is running for this project become links (same tab), and "All videos" leads to the dashboard
  // (/api/pages on every page server; nothing happens on a page opened as a file)
  return `<ol class="ud-progress" aria-label="Where you are">${STAGES.map(([id, name], i) => `<li data-stage="${id}" class="${i < at ? 'done' : i === at ? 'now' : ''}"${i === at ? ' aria-current="step"' : ''} title="${e(name)}"><span>${i + 1}</span><em class="ud-sn">${e(name)}</em></li>`).join('')}<li class="ud-dash" hidden><a href="#">All videos</a></li></ol><script>(function(){
  var ol = document.currentScript.previousElementSibling; if (location.protocol !== 'http:') return;
  fetch('/api/pages', { cache: 'no-store' }).then(function(r){ return r.ok ? r.json() : null; }).then(function(j){
    if (!j) return;
    Array.prototype.forEach.call(ol.querySelectorAll('li[data-stage]'), function(li){
      var u = j[li.getAttribute('data-stage')]; if (!u || li.getAttribute('aria-current')) return;
      var a = document.createElement('a'); a.className = 'ud-step'; a.href = u; a.title = 'Open this step';
      while (li.firstChild) a.appendChild(li.firstChild); li.appendChild(a);
    });
    if (j.dashboard) { var d = ol.querySelector('.ud-dash'); d.querySelector('a').href = j.dashboard; d.hidden = false; }
  }).catch(function(){});
})();</script>`;
}

export function renderIntakePage(opts = {}) {
  const { prefill = null, seed = null, projectDir = '', today = localDay(), sample = false, brands = [], fonts = [] } = opts;
  // a reopened brief whose video already has an outline: Save offers to keep it or to write it again
  const hasOutline = Boolean(prefill?.intake?.outline?.moments?.length);
  // the voices to hear and pick (D-71): free ones always, ElevenLabs ones when the project has a key
  const elevenlabs = opts.elevenlabs ?? false;
  const voices = opts.voices ?? voiceOptions({ elevenlabs, ...(opts.engines ? { engines: opts.engines } : {}) });
  const sampleLine = loadCatalogue().sample_line;
  const tracks = opts.music ?? musicTracks();
  const trackCard = (t) => `<label class="opt vopt"><input type="radio" name="music" value="${e(t.file)}"><div><div class="vtop"><b>${e(t.title)}</b>${t.sample ? `<button type="button" class="quiet play" data-sample="music-samples/${e(t.sample)}" aria-label="Play the ${e(t.title)} preview" title="Play a 12-second preview">▶</button>` : ''}</div><span class="vmeta" title="${e((t.mood || []).join(', '))}${t.creator ? ` · ${e(t.creator)}, ${e(t.licence)}` : ''}">${t.set === 'calm' ? 'Calm' : 'Energetic'}${t.bpm ? ` · ${e(Math.round(t.bpm))} bpm` : ''}${(t.mood || []).length ? ` · ${e(t.mood.slice(0, 2).join(', '))}` : ''}</span></div></label>`;
  const recOf = (v) => (v.recommended ?? v.house) && v.paid === elevenlabs;
  const houseOf = (g) => (voices.find((v) => recOf(v) && v.gender === g) || voices.find((v) => v.gender === g) || {}).id || '';
  // a free voice whose engine is not set up yet says so: picking it sets it up after the brief is saved (the agent runs it)
  const setupNote = (v) => (!v.paid && v.ready === false && v.setup ? `<span class="vsetup">Sets up when picked · ${e(v.setup.size)}</span>` : '');
  const voiceCard = (v) => `<label class="opt vopt" data-gender="${e(v.gender)}"><input type="radio" name="voice_id" value="${e(v.id)}" data-paid="${v.paid ? 1 : 0}"${!v.paid && v.ready === false ? ' data-setup="1"' : ''}><div><div class="vtop"><b>${e(v.name)}${recOf(v) ? ' <em class="tag">recommended</em>' : ''}</b>${v.sample ? `<button type="button" class="quiet play" data-sample="voice-samples/${e(v.sample)}" aria-label="Play the ${e(v.name)} sample" title="Play the sample">▶</button>` : ''}</div><span class="vmeta" title="${e(v.desc)}">${v.paid ? 'ElevenLabs' : 'Free'} · ${e(v.accent)} · ${v.gender === 'female' ? 'Female' : 'Male'}</span>${(v.traits || []).length ? `<span class="traits">${v.traits.slice(0, 3).map((t) => `<i>${e(t)}</i>`).join('')}</span>` : ''}${setupNote(v)}</div></label>`;


  const text = (field, label, hint, { multi = false, placeholder = '' } = {}) => `
<div class="field" data-field="${field}">
  <div class="lab"><label for="f-${field}">${e(label)}</label><span class="unsure"><input type="checkbox" data-unsure="${field}"> Unsure</span></div>
  ${multi
    ? `<textarea id="f-${field}" name="${field}" placeholder="${e(placeholder)}"></textarea>`
    : `<input type="text" id="f-${field}" name="${field}" placeholder="${e(placeholder)}" ${NOFILL}>`}
  ${hint ? `<div class="hint small muted">${hint}</div>` : ''}
</div>`;

  const area = (field, label, hint, placeholder) => `
<div class="field" data-field="${field}">
  <div class="lab"><label for="f-${field}">${e(label)}</label><span class="unsure"><input type="checkbox" data-unsure="${field}"> Unsure</span></div>
  ${hint ? `<div class="hint small muted" style="margin:0 0 6px">${hint}</div>` : ''}
  <textarea id="f-${field}" name="${field}" rows="3" placeholder="${e(placeholder)}" ${NOFILL}></textarea>
</div>`;
  const typeOpts = VIDEO_TYPE_META.map((t) => `
<label class="opt"><input type="radio" name="video_type" value="${t.id}" data-suggest-product="${t.suggest.product}" data-suggest-feature="${t.suggest.feature}"><div><b>${e(t.name)}</b><span>${e(t.desc)}</span><span>Typically ${e(t.typical)}.</span></div></label>`).join('')
    + `<label class="opt"><input type="radio" name="video_type" value="unsure"><div><b>Unsure</b><span>The direction step picks one from your brief and your site.</span></div></label>`;

  const thumb = (t) => {
    if (!fs.existsSync(path.join(ASSETS_DIR, 'templates', `${t.id}.gif`))) return '';
    return `<figure class="thumb"><img src="assets/templates/${e(t.id)}.gif" width="160" loading="lazy" decoding="async" alt="A four-second example of the ${e(t.name.toLowerCase())} template"></figure>`;
  };
  const templateOpts = TEMPLATE_META.map((t) => `
<label class="opt"><input type="radio" name="template" value="${t.id}" data-suggest="${t.suggest ?? ''}"><div><b>${e(t.name)}</b><span>${e(t.desc)}</span><span>Typically ${e(t.typical)}.</span>${thumb(t)}</div></label>`).join('')
    + `<label class="opt"><input type="radio" name="template" value="unsure"><div><b>Unsure</b><span>The direction step picks one from your brief and your site.</span></div></label>`;

  const radioOpts = (name, items, extra = '') => items.map((it) => `
<label class="opt"><input type="radio" name="${name}" value="${it.id}"><div><b>${e(it.name)}</b>${it.desc ? `<span>${e(it.desc)}</span>` : ''}${it.example ? `<span class="ex">“${e(it.example)}”</span>` : ''}</div></label>`).join('')
    + `<label class="opt"><input type="radio" name="${name}" value="unsure"><div><b>Unsure</b><span>${extra || 'The direction step proposes it.'}</span></div></label>`;

  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON}<title>Brief · Ultrademo</title>
<link rel="stylesheet" href="/ui/ui.css"><style>${CSS}</style></head><body><main>
<div class="ud-pin">${UD_HEAD}
${progressBar('brief')}
<ol class="bsub" id="bsub" aria-label="Brief steps">${BRIEF_STEPS.map((n, i) => `<li data-step="${i + 1}"><button type="button" data-go="${i + 1}"><span class="n">${i + 1}</span>${e(n)}<span class="cnt"></span></button></li>`).join('')}</ol></div>
${sample ? '<div class="notice"><b>Static preview.</b> Sample values, no server: nothing here reads a site or saves.</div>' : ''}
<audio id="voice-player" preload="none"></audio>
<div class="problems" id="problems"><b>A few things to fix before saving</b><ul id="problem-list"></ul></div>
<div class="bgrid"><div id="bmain">
<div class="bstep" data-step="1">
  <header class="bhead"><div class="ud-eyebrow">Brief · step 1 of 5<span class="started" id="started-from" hidden></span></div><h1>What is this video about?</h1><p class="lead">A few words on each. Ultrademo reads your site next and drafts the overview from all of it.</p></header>
  <div class="bslot" data-slot="1a"></div>
  <section class="card" id="s-start-type"><h2>Video type</h2><div class="bslot" data-slot="type"></div></section>
  <section class="card" id="s-about"><h2>What it covers and what it is for</h2>
    <div class="field" data-field="cover">
      <div class="lab"><label for="f-cover">What it covers</label><span class="hint">a few words or a rough list; the outline turns it into scene moments</span></div>
      <textarea id="f-cover" name="cover" rows="3" placeholder="${e(['e.g. From a product address to a finished video: the brief, the directions, the review page.', 'e.g. How a support agent learns from a knowledge base and answers at 11 p.m.', 'e.g. Setting up a weekly report: pick the data, the schedule, who gets it.'].join('\n'))}" ${NOFILL}></textarea>
    </div>
    <div class="field" data-field="purpose">
      <div class="lab"><span class="l">What the video is for</span><span class="hint">where it will be seen; it sets the opening, the length and the call to action</span></div>
      <div class="pchips" id="purpose">${PURPOSE_CHIPS.map((p) => `<button type="button" class="chip" data-purpose="${e(p)}" aria-pressed="false">${e(p)}</button>`).join('')}</div>
      <input type="text" id="f-purpose_text" name="purpose_text" placeholder="Or in your words, e.g. the hero of our pricing page, sent with every sales follow-up" ${NOFILL}>
    </div>
  </section>
  <div class="bslot" data-slot="notes"></div>
  <section class="card queue" id="s-queue">
    <div class="qhead"><div><b>More video ideas for this product?</b> <span class="muted small">Queue them; each waits on the dashboard with this brand and its own brief.</span></div><button type="button" class="quiet" id="qopen" aria-expanded="false" aria-controls="qbody">Add to queue</button></div>
    <div id="qbody" hidden>
      <div class="qrows" id="qrows"></div>
      <button type="button" class="quiet" id="qadd">+ Another idea</button>
      <p class="small muted" style="margin:10px 0 0">Each one gets its own brief, filled from this one (brand, product, notes), and its own outline, direction and review. They are made one at a time: start the next from the dashboard, or from this video's Delivery page.</p>
    </div>
  </section>
</div>
<div class="bstep" data-step="2" hidden>
  <header class="bhead"><div class="ud-eyebrow">Brief · step 2 of 5</div><h1>Here is the video Ultrademo would make</h1><p class="lead">Read it, change anything in your own words, and the key attributes follow from it.</p></header>
  <section class="card ovcard" id="ov-card" hidden>
    <div class="ovhead"><b>The video, in a paragraph</b><span class="muted small">From your start and your site. Edit it in your own words.</span><button type="button" class="quiet small" id="ov-again">Draft it again</button></div>
    <div class="drafting working" id="drafting" hidden aria-live="polite">
      <div class="work-head"><span class="spin" id="d-spin" aria-hidden="true"></span><div><h2 style="margin:0 0 4px">Ultrademo is drafting your overview</h2><p style="margin:0" id="d-status">Usually under a minute. It appears here by itself.</p></div></div>
      <ol class="work-steps"><li data-w="request">Reads what you said</li><li data-w="site">Reads your site</li><li data-w="write">Writes the overview and the key attributes</li></ol>
      <div class="nudge" id="d-nudge" hidden><p><b>Still waiting?</b> If your AI session looks idle, paste this into it:</p><div class="copyrow"><code>a brief task is waiting</code><button type="button" id="d-copy">Copy</button><button type="button" class="quiet" id="d-skip">Fill it in myself</button></div></div>
      <div class="ov-skel" aria-hidden="true"><i></i><i></i><i></i></div>
    </div>
    <div class="overview" id="overview" contenteditable="true" spellcheck="true" role="textbox" aria-multiline="true" aria-label="The video, in a paragraph"></div>
    <div class="missing" id="ov-missing" hidden></div>
    <div class="ovfoot small muted" id="ov-foot">Highlighted words feed the key attributes below; change them and the attribute follows. The outline step reads the whole paragraph.</div>
  </section>
  <section class="card" id="s-attrs"><h2>Key attributes of your video</h2>
    <div class="fromstart small" id="fromstart"></div>
    <div class="agrid bslot" data-slot="attrs"></div><div class="bslot" data-slot="attrs-after"></div>
  </section>
  <div class="bslot" data-slot="2b"></div>
</div>
<div class="bstep" data-step="3" hidden>
  <header class="bhead"><div class="ud-eyebrow">Brief · step 3 of 5</div><h1>Screens and footage</h1><p class="lead">Where the video's pictures come from, and how Ultrademo reaches the screens behind your login.</p></header>
  <div class="bslot" data-slot="3"></div>
</div>
<div class="bstep" data-step="4" hidden>
  <header class="bhead"><div class="ud-eyebrow">Brief · step 4 of 5</div><h1>Sound</h1><p class="lead">Ultrademo's picks for this video type are already in place. Press play to hear them; pick another only if you want to.</p></header>
  <div class="bslot" data-slot="4"></div>
  <section class="card" id="s-captions"><h2>Captions</h2><div class="bslot" data-slot="captions"></div></section>
</div>
<div class="bstep" data-step="5" hidden>
  <header class="bhead"><div class="ud-eyebrow">Brief · step 5 of 5</div><h1>Look and finish</h1><p class="lead">The last few choices. The direction step after the outline shows the full styles as rendered frames.</p></header>
  <div class="bslot" data-slot="5a"></div>
  <section class="card" id="s-finish"><h2>Format and finish</h2><div class="bslot" data-slot="finish"></div></section>
  <div class="bslot" data-slot="5b"></div>
</div>
</div>
<aside class="brail" id="brail" aria-label="Your brief"><h3>Your brief</h3><p class="rsub" id="rsub"></p><ol id="rail-list"></ol></aside>
</div>
<div id="bpool" hidden>

<style>.localapp .lchk{display:flex;gap:10px;align-items:flex-start;cursor:pointer}.localapp .lchk input{margin:4px 0 0;width:18px;height:18px;accent-color:var(--ink,#0c0e09)}.localapp .lchk b{display:block}.localapp .lchk .lhint{display:block;font-size:13.5px;line-height:1.4;color:var(--text-muted,#5b5f57);margin-top:2px}.localapp .lchk b{font-size:15px}#screens-local{display:flex;flex-direction:column;gap:6px;margin-top:10px}#screens-local[hidden]{display:none}#screens-local .lrun{display:flex;flex-direction:column;gap:6px}#screens-local .lrun[hidden]{display:none}
.lhome{display:flex;gap:14px;align-items:center;margin:6px 0 4px;padding:10px;border:1px solid var(--line);border-radius:12px;background:var(--surface,#fff)}.lhome[hidden]{display:none}.lthumb{all:unset;cursor:zoom-in;flex:none;width:168px;aspect-ratio:16/10;border-radius:8px;overflow:hidden;border:1px solid var(--line)}.lthumb img{width:100%;height:100%;object-fit:cover;object-position:top;display:block}.lthumb:focus-visible{outline:3px solid var(--fg);outline-offset:2px}.lphead{display:flex;gap:10px;align-items:center;justify-content:space-between}.lphead input{width:240px;max-width:50%;box-sizing:border-box;padding:7px 12px;border:1px solid var(--line);border-radius:999px;background:var(--surface,#fff);color:var(--text);font:inherit;font-size:14px}
.lpall summary{cursor:pointer;font-weight:600;font-size:14px}.lpall ul{list-style:none;margin:8px 0 0;padding:0;max-height:320px;overflow:auto;border:1px solid var(--line);border-radius:10px}
.lpall li{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;padding:7px 10px;border-top:1px solid var(--line);font-size:13.5px}.lpall li:first-child{border-top:0}.lpall li code{font-size:12.5px}.lpall li .m{color:var(--muted);font-size:12px}.lpall li input{width:16px;height:16px;margin:0;accent-color:var(--fg)}
.ptile .lptag{font-size:11.5px;color:var(--muted)}.localapp .lab{margin-top:8px}#local-status.bad{color:#b42318}#local-status.ok{color:#0f6a40}</style>
<section class="card hero" id="s-product">
  <h2>Your product</h2>
  <p class="help">Give the address and we read the page title and headings to suggest the rest. Nothing else is read here.</p>
  ${brands.length ? `<div class="field savedbrand" data-field="saved_brand">
    <div class="lab"><span class="l">Which brand is this video for?</span><span class="hint">a saved brand fills the brand and the story; change anything for this video</span></div>
    <div class="opts three" id="brand-pick"><label class="opt"><input type="radio" name="saved_brand" value="" checked><div><b>A new brand</b><span>Create from this brief</span></div></label>${brands.map((b) => `<label class="opt"><input type="radio" name="saved_brand" value="${e(b.slug)}" data-domain="${e(b.domain || '')}" data-name="${e(b.name)}"><div><b>${e(b.name)}</b><span>Saved${b.domain && !/^(127\.|localhost|0\.0\.0\.0)/.test(b.domain) ? ` · ${e(b.domain)}` : ''}</span></div></label>`).join('')}</div>
    <div class="small muted" id="saved-brand-status"></div>
  </div>` : ''}
  <div class="field" data-field="site_mode">
    <div class="opts two" id="site-mode">
      <label class="opt"><input type="radio" name="site_mode" value="public" checked><div><b>Read my public site</b><span>Brand, wording and claims come from it.</span></div></label>
      <label class="opt"><input type="radio" name="site_mode" value="none"><div><b>No site to read: I'll describe it</b><span>The overview is drafted from what you write here. The screens are picked on step 3.</span></div></label>
    </div>
  </div>
  <div class="field" data-field="url">
    <div class="lab"><label for="f-url">Product address</label><span class="hint">your public site</span></div>
    <div class="row"><input type="url" id="f-url" name="url" placeholder="https://" autocomplete="off" inputmode="url"><button type="button" id="read-site">Read my site</button></div>
    <div class="small muted" id="read-status"></div>
    <div class="site" id="site">
      <b id="site-title"></b>
      <div class="desc muted" id="site-desc"></div>
      <div class="small" id="autofill-note"></div>
    </div>
  </div>
<div class="field" data-field="product_type">
    <div class="lab"><span class="l">Target surface</span><span class="hint">Where the video shows your product. Tick more than one and the video can move between them, for example from your public website into the signed-in app. It also sets the frame and what the capture can reach.</span></div>
    <div class="opts three" id="surfaces">${SURFACES.map((s) => `<label class="opt${s.soon ? ' off' : ''}"><input type="checkbox" name="surfaces" value="${s.id}"${s.soon ? ' disabled' : ''}><div><b>${e(s.name)}${s.soon ? ' <em class="pill soon">coming soon</em>' : ''}</b><span>${e(s.id === 'mobile-app' && process.platform !== 'darwin' ? 'From your screen recordings, shown in a phone outline.' : s.desc)}</span></div></label>`).join('')}</div>
    <div class="ptradio" hidden>${radioOpts('product_type', PRODUCT_TYPES, 'Decided from the site.')}</div>
  </div>
  <div class="field" data-field="product">
    <div class="lab"><label for="f-product">Product name</label><span class="unsure"><input type="checkbox" data-unsure="product"> Unsure</span></div>
    <input type="text" id="f-product" name="product" placeholder="As it appears on your site" autocomplete="off">
    <div class="chips" id="product-suggestions"></div>
  </div>
</section>

<section class="card" id="s-brand">
  <h2>Your brand</h2>
  <p class="help">Read from your site when you press Read my site; change anything that is off. The directions start from these, and you can refine them there.</p>
  <div class="small muted" id="brand-status">Press <b>Read my site</b> above and your logo, colours and fonts appear here.</div>
  <div class="brandgrid">
    <div class="field" data-field="logo">
      <div class="lab"><span class="l">Logo</span></div>
      <div class="logoprev" id="logo-prev"><span class="muted small">No logo yet</span></div>
      <input type="hidden" id="f-logo">
      <label class="small" style="display:block;margin-top:8px">Use a different logo <input type="file" id="f-logo-file" accept=".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp"></label>
      <div class="small muted" id="logo-status"></div>
    </div>
    <div class="field" data-field="colors">
      <div class="lab"><span class="l">Colours</span></div>
      <div class="swatches">${[['brand', 'Brand colour'], ['accent', 'Accent'], ['ground', 'Background'], ['ink', 'Text']].map(([k, l]) => `<label class="swatch"><input type="color" id="f-col-${k}" data-col="${k}" value="#ffffff"><span>${l}<code id="hex-${k}"></code></span></label>`).join('')}</div>
    </div>
    <div class="field" data-field="fonts">
      <div class="lab"><span class="l">Fonts</span></div>
      <style>${fonts.map((f) => `@font-face{font-family:"fp-${e(f.family)}";src:url("/open-fonts/${encodeURIComponent(f.file)}") format("woff2");font-weight:${f.weight};font-display:swap}`).join('')}</style>
      ${[['display', 'Headings'], ['body', 'Body text']].map(([k, l]) => `<div class="lab small" style="margin-top:${k === 'display' ? 4 : 10}px"><span class="l" id="fl-${k}">${l}</span></div>
      <input type="hidden" id="f-font-${k}">
      <div class="fpick" data-font="${k}"><button type="button" class="fpbtn" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="fl-${k}"><span class="fpname">Pick a font</span><span class="fpcar" aria-hidden="true">▾</span></button>
       <div class="fppanel" hidden><input type="text" class="fpsearch" placeholder="Search fonts" aria-label="Search fonts" ${NOFILL}><div class="fplist" role="listbox"></div></div>
       <div class="small muted fpnote"></div></div>`).join('')}
    </div>
  </div>
</section>

<section class="card" id="s-screens">
  <h2>Where the product UI/screens come from</h2>
  <p class="help">Pick every source you have for your product UI assets. The video shows your product's real UI, taken from these.</p>
  <div class="field" data-field="screens">
    <div class="opts">
      <label class="opt"><input type="checkbox" name="screens" value="live" checked><div><b>The live site or app</b><span>The skill opens it and captures the screens it needs (sign-in further down, if any).</span></div></label>
      <label class="opt" id="opt-local"><input type="checkbox" name="screens" value="local"><div><b>Local App on this computer</b><span>Ultrademo starts it and captures its pages (sign-in further down). Its address never shows in the video.</span></div></label>
      <label class="opt" id="opt-code"><input type="checkbox" name="screens" value="code"><div><b>Your product's code (read only)</b><span>Its screens and flows, real wording and sample data, design tokens and components, so screens rebuilt in code match it exactly.</span></div></label>
      <label class="opt"><input type="checkbox" name="screens" value="mockups"><div><b>HTML mockups</b><span>Pages your team built for a feature that is not live yet. Each one is opened and used like a screen of the app.</span></div></label>
      <label class="opt"><input type="checkbox" name="screens" value="screenshots"><div><b>Screenshots</b><span>Images of the product you already have.</span></div></label>
      <label class="opt"><input type="checkbox" name="screens" value="figma"><div><b>A Figma file</b><span>Needs a paid Figma plan: the free plan's limit stops the export part-way.</span></div></label>
    </div>
    <div class="sub localapp" id="screens-local" hidden>
      <div class="lab"><label for="f-local-folder">Code folder</label><span class="hint">read only: Ultrademo never changes it and never opens env files or keys</span></div>
      <div class="row"><input type="text" id="f-local-folder" placeholder="~/code/my-app" spellcheck="false"><button type="button" id="local-check">Check</button></div>
      <div class="small muted" id="local-found" aria-live="polite"></div>
      <div class="lrun" id="local-run">
        <div class="lab"><label for="f-local-command">Start command</label><span class="hint">your AI session runs it in that folder; Claude Code shows it and asks you first</span></div>
        <input type="text" id="f-local-command" placeholder="npm run dev" spellcheck="false">
        <div class="lab"><label for="f-local-address">Local address</label><span class="hint">where the app answers once it runs</span></div>
        <div class="row"><input type="url" id="f-local-address" placeholder="http://localhost:3000" inputmode="url"><button type="button" id="local-start">Start it</button></div>
        <div class="small" id="local-status" aria-live="polite"></div>
        <div class="lhome" id="local-home" hidden><button type="button" class="lthumb" id="lh-view" title="See it large"><img id="lh-img" alt="The app's home page"></button><div><b id="lh-name"></b><div class="small muted" id="lh-line"></div></div></div>
        <div class="lab"><label for="f-local-wants">Pages or parts you want in it</label><span class="hint">optional, in your own words; Ultrademo picks the pages from the code and the story</span></div>
        <textarea id="f-local-wants" rows="2" maxlength="1500" placeholder="e.g. the subject detail page, the risk score on the dashboard, the case timeline"></textarea>
      </div>
    </div>
    <div class="sub" id="screens-upload" hidden>
      <div class="lab"><label for="f-screen-files">Your files</label><span class="hint">HTML up to 15 MB, PNG, JPEG or WebP up to 25 MB; copied into this project only</span></div>
      <input type="file" id="f-screen-files" multiple accept=".html,.htm,.png,.jpg,.jpeg,.webp,text/html,image/png,image/jpeg,image/webp">
      <ul class="small" id="screen-list" style="margin:8px 0 0;padding-left:18px"></ul>
      <div class="small muted" id="screen-status"></div>
    </div>
    <div class="sub" id="screens-figma" hidden>
      <div class="lab"><label for="f-figma">Figma file link</label></div>
      <input type="url" id="f-figma" name="figma_url" placeholder="https://www.figma.com/design/…" autocomplete="off">
    </div>
  </div>
  <div class="picstrip" id="site-pics" hidden>
    <div class="lab"><span class="l">Pictures from your site</span><span class="hint">Found on your site's own pages: product screenshots, illustrations and diagrams. Ticked ones can be used as your product UI in the video; product UI shots start ticked.</span></div>
    <div class="pgrid" id="pic-grid"></div>
  </div>
</section>

<section class="card" id="s-story">
  <h2>The story</h2>
  <p class="help">In your own words, as long or short as you like. These are notes the video is built from; the on-screen words and the narration are written from them. Anything that must appear word for word goes in the next section.</p>
  <details class="sitelines" id="site-lines-box" hidden><summary>Lines from your site</summary><div class="small muted">Click one to put it in the story field you were last in.</div><div class="chips" id="site-lines"></div></details>
  ${area('claim', LABELS.claim, 'What the product (or the feature) does and why it matters, in a sentence or two. The headline and the narration are written from it.', [
    'e.g. Turns your product\'s own screens into a finished launch video, and remakes it when the UI changes.',
    'e.g. One inbox for every client conversation, so nothing slips through.',
    'e.g. Invoices that chase themselves: reminders go out until the client pays.'].join('\n'))}
  ${area('viewer', LABELS.viewer, 'The person watching: their role, and what they are in the middle of when they see it.', [
    'e.g. Founders shipping a feature every week, with no time to edit video.',
    'e.g. Agency owners managing ten or more client accounts.',
    'e.g. Finance leads at companies of 20 to 200 people.'].join('\n'))}
  ${area('pain_point', LABELS.pain_point, 'What the viewer puts up with today, before your product. The video usually opens on it.', [
    'e.g. A demo video takes days in an editor and is out of date by the next release.',
    'e.g. Client messages are spread across email, Slack and WhatsApp.',
    'e.g. Chasing late invoices by hand every Friday.'].join('\n'))}
  ${area('proof_moment', LABELS.proof_moment, 'The one moment on screen that makes the viewer think <i>oh, that is good</i>: a result appearing, a before and after, a number that moves. The video builds up to it, so pick the strongest thing your product does in front of someone.', [
    'e.g. A finished video appears from nothing more than the product\'s address.',
    'e.g. Twelve scattered threads collapse into one inbox, sorted by client.',
    'e.g. The overdue total drops from $18,400 to $2,100 once the reminders go out.'].join('\n'))}
</section>

<section class="card" id="s-exact">
  <h2>Exact wording</h2>
  <p class="help">Optional. Words used exactly as you write them, never reworded.</p>
  <div class="field" data-field="tagline">
    <div class="lab"><label for="f-tagline">Tagline</label><span class="hint">optional</span></div>
    <input type="text" id="f-tagline" name="tagline" placeholder="Always-current demo videos" ${NOFILL}>
  </div>
  <div class="field" data-field="cta">
    <div class="lab"><label for="f-cta">Call to action</label><span class="unsure"><input type="checkbox" data-unsure="cta"> Unsure</span></div>
    <input type="text" id="f-cta" name="cta" placeholder="e.g. Make your first video · Start free · Book a demo" ${NOFILL}>
    <div class="hint small muted">The words on the last frame (the button text or the address).</div>
  </div>
  <div class="field" data-field="exact_lines">
    <div class="lab"><label for="f-exact_lines">Lines that must appear</label><span class="hint">optional, one per line</span></div>
    <textarea id="f-exact_lines" name="exact_lines" rows="3" placeholder="A slogan, a legal line, a product name spelled a certain way" ${NOFILL}></textarea>
  </div>
</section>

<section class="card" id="s-type">
  <h2>Video type</h2>
  <p class="help">Pick the kind of video and what it covers; the length follows, and you can change it.</p>
  <div class="field" data-field="video_type">
    <div class="opts two">${typeOpts}</div>
  </div>
  <div class="field" data-field="scope">
    <div class="lab"><span class="l">What it covers</span></div>
    <div class="opts two"><label class="opt"><input type="radio" name="scope" value="product" checked><div><b>The whole product</b><span>What it is and what it does.</span></div></label><label class="opt"><input type="radio" name="scope" value="feature"><div><b>One feature</b><span>A feature you shipped or are about to ship.</span></div></label></div>
    <div class="sub" id="feature-sub" hidden>
      <div class="lab"><label for="f-feature">Which feature</label></div>
      <input type="text" id="f-feature" name="feature" placeholder="e.g. Custom dashboards for your clients" ${NOFILL}>
    </div>
  </div>
  <div class="field" data-field="tutorial" id="tutorial-sub" hidden>
    <div class="lab"><span class="l">What the tutorial covers</span><span class="hint">the steps are settled on the next page, the outline</span></div>
    <div class="opts three">${TUTORIAL_KIND_META.map((k) => `<label class="opt"><input type="radio" name="tut_kind" value="${k.id}"><div><b>${e(k.name)}</b><span>${e(k.desc)}</span></div></label>`).join('')}</div>
    <div class="tutf" data-kinds="interface"><div class="lab"><label for="f-tut-area">Which screen or area</label></div><input type="text" id="f-tut-area" placeholder="e.g. The dashboard" ${NOFILL}></div>
    <div class="tutf" data-kinds="interface use-case feature"><div class="lab"><label for="f-tut-goal" id="tut-goal-label">The goal</label></div><input type="text" id="f-tut-goal" placeholder="e.g. A support agent that answers from your own content" ${NOFILL}></div>
    <div class="tutf" data-kinds="use-case"><div class="lab"><label for="f-tut-start">Where it starts</label></div><input type="text" id="f-tut-start" placeholder="e.g. Signed in, an empty workspace" ${NOFILL}></div>
    <div class="tutf" data-kinds="use-case"><div class="lab"><label for="f-tut-end">The end result</label></div><input type="text" id="f-tut-end" placeholder="e.g. The agent answering a real question" ${NOFILL}></div>
    <div class="tutf" data-kinds="use-case feature"><div class="lab"><label for="f-tut-pre">What has to be in place first</label><span class="hint">optional</span></div><input type="text" id="f-tut-pre" placeholder="e.g. A connected mailbox" ${NOFILL}></div>
    <div class="tutf" data-kinds="feature interface"><div class="lab"><label for="f-tut-understand">Afterwards, the viewer can…</label></div><input type="text" id="f-tut-understand" placeholder="e.g. Create a campaign and see who opened it" ${NOFILL}></div>
    <div class="tutf" data-kinds="interface use-case feature"><div class="lab"><label for="f-tut-steps">The steps, if you know them</label><span class="hint">optional, one per line; else Ultrademo proposes them</span></div><textarea id="f-tut-steps" rows="3" placeholder="Make a knowledge base&#10;Add your content&#10;Create the agent" ${NOFILL}></textarea></div>
    <div class="tutf" data-kinds="interface use-case feature"><div class="lab"><label for="f-tut-leave">Leave out</label><span class="hint">optional</span></div><input type="text" id="f-tut-leave" placeholder="e.g. Voice and phone numbers" ${NOFILL}></div>
    <div class="tutf" data-kinds="interface use-case feature"><div class="lab"><label for="f-tut-docs">Your help docs for this</label><span class="hint">optional, a link; read like your site</span></div><input type="url" id="f-tut-docs" placeholder="https://docs.your-product.com/…" ${NOFILL}></div>
    <div class="tutf" data-kinds="interface use-case feature"><div class="lab"><span class="l">Opening</span></div><div class="opts three">${[['hook', 'A hook', 'why this is worth doing; best for a use case'], ['message', 'An opening message', 'a title card naming what you will be able to do'], ['none', 'None', 'start on the first step']].map(([v, n, d]) => `<label class="opt"><input type="radio" name="tut_opening" value="${v}"><div><b>${n}</b><span>${d}</span></div></label>`).join('')}</div></div>
    <div class="tutf" data-kinds="interface use-case feature"><div class="lab"><span class="l">Closing</span></div><div class="opts three">${[['message', 'A closing message', 'drives the point home'], ['cta', 'A call to action', 'what to do next'], ['none', 'None', 'end on the result']].map(([v, n, d]) => `<label class="opt"><input type="radio" name="tut_closing" value="${v}"><div><b>${n}</b><span>${d}</span></div></label>`).join('')}</div></div>
  </div>
  <div class="field" data-field="motion_between" id="motion-sub" hidden>
    <div class="lab"><span class="l">Motion between scenes</span><span class="hint">the cursor, the click ring and the zoom on the click stay at every level</span></div>
    <div class="opts three">${[['none', 'None', 'the scene transitions only; still feels finished'], ['minimal', 'Minimal', 'the camera glides from one step to the next; the cursor carries across'], ['full', 'Full', 'animated title cards and motion graphics between steps or sections']].map(([v, n, d]) => `<label class="opt"><input type="radio" name="motion_between" value="${v}"${v === 'minimal' ? ' checked' : ''}><div><b>${n}${v === 'minimal' ? ' <em class="tag">default</em>' : ''}</b><span>${d}</span></div></label>`).join('')}</div>
  </div>
  <div class="field" data-field="formats">
    <div class="lab"><span class="l">Format</span><span class="hint">vertical is for Shorts, Reels and TikTok</span></div>
    <div class="opts three">${[['landscape', 'Landscape (16:9)', 'For YouTube, X, Facebook and websites.'], ['vertical', 'Vertical (9:16)', 'For YouTube Shorts, Reels and TikTok.'], ['both', 'Both (16:9 & 9:16)', 'Takes 2x longer to create.']].map(([v, l, d]) => `<label class="opt"><input type="radio" name="formats" value="${v}"><div><b>${l}</b><span>${d}</span></div></label>`).join('')}</div>
  </div>
  <div class="field" data-field="caption_style" id="captions-field">
    <div class="lab"><span class="l">Captions</span><span class="hint">every narrated video also comes with a caption file (.srt and .vtt) for YouTube, LinkedIn and X; these are captions in the picture itself</span></div>
    <style>
${previewFontCss('/caption-fonts/')}
${CAPTION_STYLES.map((cs) => captionCss(cs.id, { family: () => captionFontFor(cs), accent: '#45792a' })).join('\n')}
.capwrap{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:16px;align-items:start}
@media (max-width:820px){.capwrap{grid-template-columns:1fr}}
.capopts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.capopts .opt{padding:9px 12px}.capopts .opt span{display:none}
#cap-desc{margin-top:6px;font-size:13.5px}
.capstage{position:relative;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:linear-gradient(160deg,#eef1ec,#dfe6dc);container-type:size;border:1px solid #dfe2e8}
.capstage .capwin{position:absolute;left:9%;top:12%;width:82%;height:76%;border-radius:1.6cqh;background:#fff;box-shadow:0 2cqh 5cqh rgba(0,0,0,.12)}
.capstage .capwin:before{content:"";position:absolute;left:0;top:0;bottom:0;width:22%;background:#3f6f27;border-radius:1.6cqh 0 0 1.6cqh}
.capstage .capwin:after{content:"";position:absolute;left:28%;top:10%;width:40%;height:6%;border-radius:1cqh;background:#e5e9e2;box-shadow:0 9cqh 0 #eef1ec,0 16cqh 0 #eef1ec,0 23cqh 0 #eef1ec}
    </style>
    <div class="capwrap">
      <div class="capprev"><div class="capstage"><div class="capwin"></div><div id="cap-root" class="s-none"><div class="cap"></div></div></div>
      <div id="cap-desc"></div>
      <div class="small muted" style="margin-top:4px">A sample line. The example input in it, <b>Spring launch</b>, takes the style's highlight colour, as the sample data typed into your product will. The scenes keep the bottom of the frame free for the captions.</div></div>
      <div class="capopts">${[['none', 'None', 'no captions in the picture; the caption file still comes with it'], ...CAPTION_STYLES.map((cs) => [cs.id, cs.name, cs.desc])].map(([v, l, d]) => `<label class="opt" title="${e(d)}"><input type="radio" name="caption_style" value="${v}"><div><b>${e(l)}</b><span>${e(d)}</span></div></label>`).join('')}</div>
    </div>
  </div>
  <div class="field" data-field="cut">
    <div class="lab"><span class="l">Social cut</span><span class="hint">a short version from the same scenes, after the video</span></div>
    <div class="opts three">${[['', 'None', 'just the video'], ['15', '15 seconds', 'the hook, the reveal and the call to action'], ['30', '30 seconds', 'the hook, a proof or two and the call to action']].map(([v, l, d]) => `<label class="opt"><input type="radio" name="cut" value="${v}"${v === '' ? ' checked' : ''}><div><b>${l}</b><span>${d}. Music and on-screen words, no narration; vertical when the video has a vertical version.</span></div></label>`).join('')}</div>
  </div>
  <div class="field" data-field="length_s">
    <div class="lab"><label for="f-length_s">Length in seconds</label><span class="unsure"><input type="checkbox" data-unsure="length_s"> Unsure</span></div>
    <div class="opts three lenfit" hidden>${[['about', 'About', 'within 10% either way; the scenes keep the lengths that read best'], ['max', 'No more than', 'up to this length, shorter if it reads better'], ['exact', 'Exactly', 'to the second, e.g. for an ad slot']].map(([v, n, d]) => `<label class="opt" title="${e(d)}"><input type="radio" name="length_fit" value="${v}"${v === 'about' ? ' checked' : ''}><div><b>${n}</b><span>${d}</span></div></label>`).join('')}</div>
    <div class="lensent"><select id="f-lenfit" aria-label="How strict the length is"><option value="about">About</option><option value="max">No more than</option><option value="exact">Exactly</option></select><span class="lenin"><input type="number" id="f-length_s" name="length_s" min="3" step="1" inputmode="numeric" placeholder="30"><span class="unit">sec</span></span><span class="small muted" id="length-hint"></span></div>
    <div class="small muted lenfit-desc" id="lenfit-desc" aria-live="polite"></div>
  </div>
</section>

<section class="card" id="s-sound">
  <h2>Voice and music</h2>
  <div class="field" data-field="narration">
    <div class="lab"><span class="l">Narration</span></div>
    <div class="opts three">${NARRATION.map((it) => `<label class="opt"><input type="radio" name="narration" value="${it.id}"><div><b>${e(it.name)}${it.id === 'narrated' ? ' <em class="pill">full length</em>' : it.id === 'both' ? ' <em class="pill">minimal</em>' : ' <em class="pill">no narration</em>'}</b><span>${e(it.desc)}</span></div></label>`).join('')}</div>
    <div class="sub" id="voice-sub" hidden>
      <div class="lab"><span class="l">${e(LABELS.voice)}</span></div>
      <div class="opts three">${VOICE.map((v) => `<label class="opt"><input type="radio" name="voice" value="${v.id}"><div><b>${e(v.name)}</b></div></label>`).join('')}</div>
      <div class="hint small muted" style="margin:12px 0 8px">Listen, then pick. Every voice reads the same line: “${e(sampleLine)}”</div>
      <div class="opts vgrid" id="voice-cards" data-house-female="${e(houseOf('female'))}" data-house-male="${e(houseOf('male'))}">${voices.map(voiceCard).join('')}</div>
      <div class="hint small muted" style="margin-top:8px">${elevenlabs ? 'ElevenLabs voices are read with your own account; the key stays in the project’s env file.' : 'Have an ElevenLabs account? Put the key in the project’s <span class="mono">.env</span> file as <span class="mono">ELEVENLABS_API_KEY</span> and open this page again to hear its voices. The key never goes in this form.'}</div>
    </div>
  </div>
  <div class="field" data-field="music">
    <div class="lab"><span class="l">Music</span><span class="hint">a 12-second preview of each track; every track is CC0: free to use, no credit needed</span></div>
    <div class="opts vgrid"><label class="opt vopt"><input type="radio" name="music" value="auto"><div><b>Let AI choose</b><span>Recommended for your look</span></div></label>${tracks.filter((t) => t.set !== 'calm').map(trackCard).join('')}${tracks.filter((t) => t.set === 'calm').map(trackCard).join('')}<label class="opt vopt"><input type="radio" name="music" value="own"><div><b>Use my own track</b><span>A track you hold a licence for, e.g. from Epidemic Sound, Artlist or a Free To Use commercial licence.</span></div></label></div>
    <div class="sub" id="own-sub" hidden>
      <div class="lab"><label for="f-own-file">Your track</label><span class="hint">MP3, WAV, M4A, OGG, AAC or FLAC, up to 60 MB; it is copied into this project only</span></div>
      <input type="file" id="f-own-file" accept=".mp3,.wav,.m4a,.ogg,.aac,.flac,audio/*">
      <div class="row" style="margin-top:8px;gap:8px;align-items:center"><input type="text" id="f-own-local" placeholder="Or its path on this computer, e.g. ~/Music/track.mp3" aria-label="The track's path on this computer" autocomplete="off" style="flex:1"><button type="button" class="quiet" id="own-local-go">Use this file</button></div>
      <div class="small muted" id="own-status" style="margin-top:6px"></div>
      <label class="unsure" style="margin-top:10px;white-space:normal"><input type="checkbox" id="f-own-licence"> My licence covers commercial videos (ads, launch videos, posts for a business). Credit lines, if the licence asks for them, are mine to add.</label>
      <input type="hidden" id="f-own-path"><input type="hidden" id="f-own-title">
    </div>
  </div>
</section>

<section class="card" id="s-make">
  <h2>How it's made</h2>
  <div class="field" data-field="register">
    <div class="lab"><span class="l">Copy tone</span><span class="hint">facts are always checked; this sets how far the rest may stretch</span></div>
    <div class="opts two">${radioOpts('tone', TONE)}</div>
  </div>
  <div class="field" data-field="autonomy">
    <div class="lab"><span class="l">Autonomy level</span></div>
    <div class="opts three">${radioOpts('autonomy', AUTONOMY)}</div>
  </div>
</section>

<section class="card" id="s-look">
  <h2>Styles and effects</h2>
  <p class="help">The feel of the video, in your words. Tap a few examples or write freely; the direction step shows you the video and motion styles as rendered frames to pick from.</p>
  <div class="field" data-field="look">
    <div class="lab"><label for="f-look">Describe it</label><span class="unsure"><input type="checkbox" data-unsure="look"> Unsure</span></div>
    <textarea id="f-look" name="look" placeholder="Glowing letters on black, a slow camera, the product doing the talking"></textarea>
    <style>${LOOK_CSS}</style>
    <div class="ltiles" id="look-chips">${LOOK_CHIPS.map((c) => `<button type="button" class="chip ltile" data-chip="${e(c)}" aria-pressed="false"><span class="lk ${LOOK_CLASS[c]}" aria-hidden="true">${LOOK_ART[c] || ''}</span><b>${e(c)}</b></button>`).join('')}</div>
  </div>
  <div class="field" data-field="effects">
    <div class="lab"><span class="l">Effects</span><span class="hint">a visual and a sound when something happens: money paid, a task done, a launch</span></div>
    <div class="opts three"><label class="opt"><input type="radio" name="effects" value="lively" checked><div><b>Lively</b><span>Bursts, confetti, reactions where the story has a moment.</span></div></label><label class="opt"><input type="radio" name="effects" value="subtle"><div><b>Subtle</b><span>Small and quick; for explainers and serious products.</span></div></label><label class="opt"><input type="radio" name="effects" value="none"><div><b>None</b><span>No effects; interface sounds only.</span></div></label></div>
  </div>
</section>

<section class="card" id="s-footage">
  <h2>Footage you already have</h2>
  <p class="help">Optional. Ultrademo captures and rebuilds the product itself; add footage only if you have it: a talking head, an avatar video, live action or b-roll. Screen recordings, camera footage, or videos already published.</p>
  <div class="field" data-field="footage">
    <div class="opts">
      <label class="opt"><input type="radio" name="footage" value="none"><div><b>None needed: Ultrademo records the product itself</b><span>Screens are captured and rebuilt from the site, the app or your mockups. The usual choice.</span></div></label>
      <label class="opt off"><input type="radio" name="footage" value="upload" disabled><div><b>Video files on this computer <em class="pill soon">coming soon</em></b><span>Screen recordings or camera footage. Ultrademo transcribes them and places the clips in the outline.</span></div></label>
      <label class="opt off"><input type="radio" name="footage" value="existing" disabled><div><b>YouTube videos, up to two <em class="pill soon">coming soon</em></b><span>Links to videos you own. Ultrademo downloads them, or you give the downloaded file instead.</span></div></label>
      <label class="opt off"><input type="radio" name="footage" value="record" disabled><div><b>I'll record some first <em class="pill soon">coming soon</em></b><span>Show me how, then I'll list the files before the outline.</span></div></label>
    </div>
    <div class="sub" id="footage-upload" hidden>
      <h3>Where the files are</h3>
      <textarea name="footage_files" placeholder="One path per line, e.g. ~/Movies/invite-flow.mov"></textarea>
      <div class="small muted">Full paths on this machine. They are read when the direction step runs, not now.</div>
    </div>
    <div class="sub" id="footage-existing" hidden>
      <h3>The videos, up to two</h3>
      <div class="lab"><label for="f-footage_link_1">YouTube video link</label></div>
      <input type="url" id="f-footage_link_1" name="footage_link_1" placeholder="https://www.youtube.com/watch?v=…" inputmode="url">
      <div class="lab" style="margin-top:8px"><label for="f-footage_link_2">Second video link (optional)</label></div>
      <input type="url" id="f-footage_link_2" name="footage_link_2" placeholder="https://youtu.be/…" inputmode="url">
      <p class="small muted" style="margin:10px 0 8px">Use only videos you own or have the right to reuse. Downloading from YouTube can go against YouTube's terms of service, so it's better to download your video from YouTube Studio first and give its file path instead.</p>
      <div class="opts two">
        <label class="opt"><input type="radio" name="footage_yt" value="download"><div><b>Accept the risk</b><span>Ultrademo downloads the videos from these links.</span></div></label>
        <label class="opt"><input type="radio" name="footage_yt" value="own-file" checked><div><b>I'll download them first</b><span>From YouTube Studio; then give the file paths below.</span></div></label>
      </div>
      <div id="footage-yt-files">
        <div class="lab" style="margin-top:8px"><label for="f-footage_downloaded">The downloaded files</label></div>
        <textarea id="f-footage_downloaded" name="footage_downloaded" placeholder="One path per line, e.g. ~/Downloads/launch-demo.mp4"></textarea>
      </div>
    </div>
    <div class="sub" id="footage-record" hidden>
      <div id="recipe">
        <h3 style="margin-top:10px">How to record, briefly</h3>
        <ol>
          <li><b>Screen.</b> Mac: press Shift-Command-5 and choose “Record Selected Portion”, then draw the box around the product window. Windows: press Win-Alt-R, or use the Snipping Tool’s record mode. If you want your camera in the same take, OBS Studio works on both; it is optional.</li>
          <li><b>Phone screen.</b> iPhone: Control Centre, the record button (add it under Settings → Control Centre first). Android: Screen record in the quick settings panel. Record upright; the frame goes into a phone outline for you.</li>
          <li><b>Camera.</b> Face a window or a lamp, camera at eye level, 1080p, a quiet room, the mic within arm's reach. A 20-second test first, then listen back.</li>
          <li><b>What to show.</b> The proof moment above, slowly: deliberate cursor, no notifications, demo data instead of real customers, a reset state before each take. One action per take is easier to cut than one long take.</li>
          <li><b>Save</b> as .mov or .mp4 and list the paths above under “I'll upload files” when you have them.</li>
        </ol>
      </div>
    </div>
  </div>
</section>

<section class="card" id="s-signin">
  <h2>Your app authentication</h2>
  <p class="help">Only needed when the video shows screens behind a login. The capture never uses a stored password; you sign in yourself, once.</p>
  <div class="detect" id="detect">Checking which browser this is…</div>
  <div class="detect" id="website-note" hidden>Only the public website is ticked under Target surface, so there is nothing to sign into and “Public website only” is picked for you. If part of the site sits behind a login, pick another option.</div>
  <div class="detect remind" id="app-signin-note" hidden>You ticked <b id="app-signin-what">Web app (signed in)</b> under Target surface. Pick how Ultrademo signs in to it below; “Public website only” leaves out every screen behind your login.</div>
  <div class="field" data-field="sign_in">
    <div class="opts" id="signin-opts">
      <label class="opt"><input type="radio" name="sign_in" value="public"><div><b>Public website only</b><span>Nothing behind a login needs to appear.</span></div></label>
      <label class="opt" data-needs="chromium"><input type="radio" name="sign_in" value="own-browser"><div><b>Use my own browser</b><span>Captured in the browser you are signed into, through the Claude in Chrome extension.</span></div></label>
      <label class="opt"><input type="radio" name="sign_in" value="dedicated-profile"><div><b>A dedicated profile, signed in once by hand</b><span id="profile-note">A real Chrome window opens the first time; you sign in (Google sign-in and two-factor included) and later runs reuse it silently.</span></div></label>
      <label class="opt off"><input type="radio" name="sign_in" value="hosted-live-view" disabled><div><b>Sign in on the hosted live view <em class="pill">via hosted app only</em> <em class="pill soon">coming soon</em></b><span>A live view of the capture browser where you sign in by hand.</span></div></label>
      <label class="opt"><input type="radio" name="sign_in" value="token"><div><b>An auth token or magic link sent by your app</b><span>An API key, a magic link or a demo account your app provides. It goes into the project's env file, never into this page.</span></div></label>
      <label class="opt"><input type="radio" name="sign_in" value="demo-account"><div><b>A demo or test account</b><span>Its email and password go in this video's env file, never into this page or the chat; Ultrademo signs in with them.</span></div></label>
      <label class="opt localauth" hidden><input type="radio" name="sign_in" value="local-none"><div><b>No sign-in on my local server</b><span>The app opens signed in, or has a development bypass.</span></div></label>
      <label class="opt localauth" hidden><input type="radio" name="sign_in" value="from-code"><div><b>Find out from the code</b><span>Ultrademo reads how sign-in works locally and proposes a way in with the outline. It asks you before creating any user.</span></div></label>
      <label class="opt"><input type="radio" name="sign_in" value="unsure"><div><b>Unsure</b><span>The direction step asks once it knows which screens the video needs.</span></div></label>
    </div>
    <div class="sub" id="token-sub" hidden>
      <h3>How your app issues it</h3>
      <input type="text" name="token_note" placeholder="e.g. a magic link from the admin page; a read-only API key" maxlength="500">
      <div class="small muted">Describe it only. The value itself belongs in the project's env file.</div>
    </div>
    <div class="sub" id="demo-sub" hidden>
      <h3>The demo account</h3>
      <p class="small">Use an account made for demos or testing: the outline asks before anything is created in it. Open the file, fill in the lines after <code>DEMO_EMAIL=</code> and <code>DEMO_PASSWORD=</code> (and <code>DEMO_SIGNIN_URL=</code> if the sign-in page is elsewhere), save it, then check.</p>
      <div class="row"><button type="button" class="quiet" id="demo-open">Open the file</button><button type="button" class="quiet" id="demo-check">Check</button><span class="small" id="demo-state" aria-live="polite"></span></div>
      <div class="small muted" id="demo-path"></div>
    </div>
  </div>
</section>

<section class="card" id="s-ref">
  <h2>Reference video</h2>
  <div class="field" data-field="reference">
    <div class="lab"><label for="f-reference">A reference demo video you like</label><span class="hint">optional</span></div>
    <input type="text" id="f-reference" name="reference" placeholder="A link or a file path" autocomplete="off">
    <div class="hint small muted">Its pace and feel are measured and offered as one of the directions.</div>
  </div>
</section>

<section class="card" id="s-notes">
  <h2>Anything else</h2>
  <div class="field" data-field="notes">
    <div class="lab"><label for="f-notes">Comments and notes for the video</label><span class="hint">optional</span></div>
    <textarea id="f-notes" name="notes" rows="4" placeholder="Anything Ultrademo should know: what to stress or avoid, an audience detail, a feature to show first, a competitor never to mention…" ${NOFILL}></textarea>
    <div class="hint small muted">Read by the direction step with the rest of the brief.</div>
  </div>
</section>

<section class="card" id="s-name">
  <h2>Title and project name</h2>
  <div class="field" data-field="title">
    <div class="lab"><label for="f-title">Video title</label><span class="hint">optional</span></div>
    <input type="text" id="f-title" name="title" maxlength="120" placeholder="e.g. Launch video, Billing feature, Q4 update" autocomplete="off">
    <div class="hint small muted">How the video is listed in your dashboard. It is not shown in the video itself.</div>
  </div>
  <div class="field" data-field="project_name">
    <div class="lab"><label for="f-project_name">Name</label><span class="unsure"><input type="checkbox" data-unsure="project_name"> Unsure</span></div>
    <input type="text" id="f-project_name" name="project_name" autocomplete="off" spellcheck="false">
    <div class="hint small muted">Proposed from the product, the title (or the video type) and today's date. It names the folder and the finished files.</div>
  </div>
</section>

</div>
<div class="bar">
  <button type="button" class="quiet" id="b-back" hidden>Back</button>
  <span class="status" id="save-status">${projectDir ? `Saves to <span class="mono">${e(projectDir)}/plan.json</span>` : ''}</span>
  <span class="bar-r"><button type="button" class="quiet" id="b-skip" hidden>Ultrademo's picks are fine, skip to the end</button><button type="button" class="primary" id="b-next">Draft the overview</button>${hasOutline ? '<button type="button" id="save-keep" hidden>Save, keep the current outline</button>' : ''}<button type="button" class="primary" id="save" hidden>${hasOutline ? 'Save and rewrite the outline' : 'Save and continue to the outline'}</button></span>
</div>
</main>
<script>
window.__PREFILL__ = ${jsonForScript(prefill)};
window.__SEED__ = ${jsonForScript(prefill ? null : seed)};
window.__TODAY__ = ${jsonForScript(today)};
window.__SAMPLE__ = ${sample ? 'true' : 'false'};
(function(){
  var $ = function(s, r){ return (r||document).querySelector(s); };
  var $$ = function(s, r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
  var lastStoryField = 'claim';
  var siteRead = null;
  var lengthTouched = false;
  var nameTouched = false;

  function countWords(s){ return String(s||'').trim().split(/\\s+/).filter(function(w){ return /[\\p{L}\\p{N}]/u.test(w); }).length; }
  function slug(s){ return String(s||'').toLowerCase().normalize('NFKD').replace(/[^\\p{L}\\p{N}]+/gu,'-').replace(/^-+|-+$/g,'') || 'product'; }
  function radio(name){ var el = $('input[name="'+name+'"]:checked'); return el ? el.value : ''; }
  function setRadio(name, value){ var el = $('input[name="'+name+'"][value="'+value+'"]'); if (el && !el.disabled) { el.checked = true; el.dispatchEvent(new Event('change', {bubbles:true})); } }

  // ---- browser detection (D-60): only the sign-in paths that apply are shown
  function detectBrowser(){
    var ua = navigator.userAgent || '';
    var brands = (navigator.userAgentData && navigator.userAgentData.brands || []).map(function(b){ return b.brand; });
    var chromium = brands.some(function(b){ return /Chromium|Google Chrome|Microsoft Edge|Brave|Opera/i.test(b); });
    if (!brands.length) chromium = /Chrome\\/|Chromium\\/|CriOS\\//.test(ua) && !/Firefox\\//.test(ua);
    var label = 'a browser we could not identify';
    if (/Edg\\//.test(ua) || brands.some(function(b){ return /Edge/i.test(b); })) label = 'Edge';
    else if (brands.some(function(b){ return /Brave/i.test(b); }) || navigator.brave) label = 'Brave';
    else if (/OPR\\//.test(ua)) label = 'Opera';
    else if (chromium) label = 'Chrome (or another browser built on it)';
    else if (/Firefox\\//.test(ua)) label = 'Firefox';
    else if (/Safari\\//.test(ua) && /Apple/.test(navigator.vendor || '')) label = 'Safari';
    return { chromium: chromium, label: label };
  }
  var browser = detectBrowser();
  $('#detect').innerHTML = browser.chromium
    ? 'You are in <b>' + browser.label + '</b>, so the capture can run inside this browser through the Claude in Chrome extension.'
    : 'You are in <b>' + browser.label + '</b>. The Claude in Chrome extension needs Chrome, Edge, Brave or Arc, so it is not offered; the dedicated profile works here (Chrome must be installed; your password manager, iCloud Passwords included, can fill into that window).';
  $$('[data-needs="chromium"]').forEach(function(el){ if (!browser.chromium) el.remove(); });

  // ---- Unsure toggles
  // A tick the user makes keeps what they type as a hint. A tick that came back from the saved brief (data-from-plan)
  // clears the moment they type in the field: typing means they know it now.
  $$('[data-unsure]').forEach(function(box){
    var field = box.getAttribute('data-unsure');
    var wrap = $('.field[data-field="'+field+'"]');
    var input = wrap && (wrap.querySelector('input[type=text],input[type=number],textarea'));
    box.addEventListener('change', function(ev){
      if (ev.isTrusted) delete box.dataset.fromPlan;
      wrap.classList.toggle('is-unsure', box.checked);
      if (input) {
        if (box.checked) { if (input.getAttribute('data-ph') == null) input.setAttribute('data-ph', input.placeholder); input.placeholder = 'Anything you do know goes here as a hint (optional)'; }
        else if (input.getAttribute('data-ph') != null) input.placeholder = input.getAttribute('data-ph');
      }
    });
    if (input) input.addEventListener('input', function(){
      if (box.checked && box.dataset.fromPlan && input.value.trim()) { box.checked = false; delete box.dataset.fromPlan; box.dispatchEvent(new Event('change')); }
    });
  });
  function isUnsure(field){ var b = $('[data-unsure="'+field+'"]'); return !!(b && b.checked); }

  // the story has no word limits (the direction step writes the on-screen words from it)
  function updateClaim(){}

  // ---- story field focus memory (for site lines)
  ['viewer','claim','pain_point','proof_moment'].forEach(function(f){ var el = $('#f-'+f); el.addEventListener('focus', function(){ lastStoryField = f; }); });

  // ---- video type and scope → suggested length, project name
  var lengthEl = $('#f-length_s'), lengthHint = $('#length-hint');
  lengthEl.addEventListener('input', function(){ lengthTouched = true; });
  function suggestLength(){
    var el = $('input[name="video_type"]:checked'); if (!el) return;
    if (el.value === 'unsure') { lengthHint.textContent = 'Suggested once the video type is known.'; return; }
    var s = el.getAttribute('data-suggest-' + (radio('scope') || 'product'));
    lengthHint.textContent = 'Suggested for this video: ' + s + ' s.';
    if (!lengthTouched) lengthEl.value = s;
  }
  function scopeBranch(){ $('#feature-sub').hidden = radio('scope') !== 'feature'; }
  // D-88 to D-90: the tutorial block, the motion level (tutorial and explainer), the kind's own fields and suggestions
  var tutTouched = { opening: false, closing: false };
  $$('input[name="tut_opening"]').forEach(function(r){ r.addEventListener('change', function(){ tutTouched.opening = true; }); });
  $$('input[name="tut_closing"]').forEach(function(r){ r.addEventListener('change', function(){ tutTouched.closing = true; }); });
  function tutorialBranch(){
    var t = radio('video_type');
    $('#tutorial-sub').hidden = t !== 'tutorial';
    $('#motion-sub').hidden = t !== 'tutorial' && t !== 'explainer';
    var k = radio('tut_kind');
    $$('#tutorial-sub .tutf').forEach(function(f){ f.hidden = !k || f.getAttribute('data-kinds').split(' ').indexOf(k) < 0; });
    $('#tut-goal-label').textContent = k === 'interface' ? 'What it is for' : k === 'feature' ? 'The feature' : 'The goal';
    if (k && !tutTouched.opening) setRadio('tut_opening', k === 'use-case' ? 'hook' : 'message');
    if (k && !tutTouched.closing) setRadio('tut_closing', k === 'use-case' ? 'message' : 'none');
  }
  $$('input[name="tut_kind"]').forEach(function(r){ r.addEventListener('change', tutorialBranch); });
  $$('input[name="video_type"]').forEach(function(r){ r.addEventListener('change', tutorialBranch); });
  // D-93: no cap on the length; a long video is built in chapters
  lengthEl.addEventListener('input', function(){ var n = Number(lengthEl.value); if (n > 300) lengthHint.textContent = 'A long video: the outline groups its scene moments into chapters, each built and checked on its own.'; });
  $$('input[name="scope"]').forEach(function(r){ r.addEventListener('change', function(){ scopeBranch(); suggestLength(); }); });
  var nameEl = $('#f-project_name');
  nameEl.addEventListener('input', function(){ nameTouched = true; });
  // the project name follows the product and the title until the user types their own; a reopened brief keeps its
  // first date (nameDate) so editing the title does not re-date the name
  var nameDate = window.__TODAY__;
  function autoName(p, ti, t){ return slug(p || 'product') + '-' + (ti ? slug(ti).split('-').slice(0, 4).join('-') : (t && t !== 'unsure' ? t : 'video')); }
  function proposeName(){
    if (nameTouched) return;
    var t = radio('video_type'); var p = $('#f-product').value; var ti = $('#f-title') ? $('#f-title').value.trim() : '';
    nameEl.value = autoName(p, ti, t) + '-' + nameDate;
  }
  if ($('#f-title')) $('#f-title').addEventListener('input', proposeName);
  $$('input[name="video_type"]').forEach(function(r){ r.addEventListener('change', function(){ suggestLength(); proposeName(); }); });
  // D-94: captions in the picture; a live preview of the chosen style on a sample line, the default per video type
  ${CAPTION_ENGINE}
  var CAP_STYLES = ${JSON.stringify(Object.fromEntries(CAPTION_STYLES.map((cs) => [cs.id, { id: cs.id, group: cs.group }])))};
  var CAP_DEFAULTS = ${JSON.stringify(DEFAULT_CAPTIONS)};
  var capTouched = false, capGroups = null, capCur = 'none';
  var CAP_TEXT = "Name it something you'll recognise, like Spring launch, then press Create.".split(' ');
  var CAP_WORDS = (function(){ var at = 0.4, out = []; CAP_TEXT.forEach(function(w){ var d = 0.12 + w.replace(/[^A-Za-z]/g,'').length * 0.055 + (/[.,]$/.test(w) ? 0.18 : 0); out.push({ text: w, start: at, end: at + d - (/[.,]$/.test(w) ? 0.15 : 0.02), lit: w === 'Spring' || w === 'launch,' }); at += d; }); return out; })();
  var capRoot = $('#cap-root'), capEl = capRoot ? capRoot.querySelector('.cap') : null;
  function capSet(id){ capCur = id; if (!capRoot) return; capRoot.className = 's-' + id; capEl.innerHTML = ''; capEl._k = null; capGroups = CAP_STYLES[id] ? window.CAPTIONS.groups(CAP_WORDS, CAP_STYLES[id].group) : null; }
  function capTick(){ if (capGroups && !$('#captions-field').hidden) window.CAPTIONS.render(CAP_STYLES[capCur], capEl, (performance.now() / 1000) % 7.5, capGroups); requestAnimationFrame(capTick); }
  $$('input[name="caption_style"]').forEach(function(r){ r.addEventListener('change', function(ev){ if (ev.isTrusted) capTouched = true; capSet(r.value); var lab = r.closest('label'), d = $('#cap-desc'); if (d && lab) d.innerHTML = '<b>' + lab.querySelector('b').textContent + '</b>: ' + lab.querySelector('span').textContent.replace(/</g, '&lt;'); }); });
  $$('input[name="video_type"]').forEach(function(r){ r.addEventListener('change', function(){ if (!capTouched) setRadio('caption_style', CAP_DEFAULTS[radio('video_type')] || 'none'); }); });
  // music only: no captions to choose, so the whole Captions card goes, not only its field
  function captionsBranch(){ var off = radio('narration') === 'music-only'; $('#captions-field').hidden = off; var s = $('#s-captions'); if (s) s.hidden = off; }
  // 2026-11-12: narration follows the video type until the user picks one (a saved brief keeps its own)
  var NAR_DEFAULT = { launch: 'music-only', ad: 'music-only', explainer: 'narrated', spotlight: 'narrated', tutorial: 'narrated' }, narTouched = false;
  $$('input[name="narration"]').forEach(function(r){ r.addEventListener('change', function(ev){ if (ev.isTrusted) narTouched = true; }); });
  $$('input[name="video_type"]').forEach(function(r){ r.addEventListener('change', function(){ if (!narTouched && NAR_DEFAULT[r.value]) setRadio('narration', NAR_DEFAULT[r.value]); }); });
  $$('input[name="narration"]').forEach(function(r){ r.addEventListener('change', captionsBranch); });
  if (!radio('caption_style')) setRadio('caption_style', 'none');
  captionsBranch(); requestAnimationFrame(capTick);

  $('#f-product').addEventListener('input', proposeName);

  // ---- look chips
  var look = $('#f-look'), lookFromSaved = false;
  $$('#look-chips .chip').forEach(function(c){
    c.addEventListener('click', function(){
      c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on') ? 'true' : 'false');
      var word = c.getAttribute('data-chip');
      var words = look.value.split(/,\\s*/).map(function(s){ return s.trim(); }).filter(Boolean);
      if (c.classList.contains('on')) { if (words.indexOf(word) < 0) words.push(word); }
      else words = words.filter(function(w){ return w !== word; });
      look.value = words.join(', ');
    });
  });

  // ---- footage branches
  function footageBranch(){
    var v = radio('footage');
    $('#footage-upload').hidden = v !== 'upload';
    $('#footage-existing').hidden = v !== 'existing';
    $('#footage-record').hidden = v !== 'record';
    $('#footage-yt-files').hidden = radio('footage_yt') !== 'own-file';
  }
  $$('input[name="footage"], input[name="footage_yt"]').forEach(function(r){ r.addEventListener('change', footageBranch); });


  // ---- sign-in branches
  function appSignInNote(){
    var n = $('#app-signin-note'); if (!n) return;
    var app = $$('input[name="surfaces"]:checked').some(function(c){ return c.value === 'web-app'; });
    n.hidden = !(app && radio('sign_in') === 'public');
  }
  function signInBranch(){ appSignInNote(); $('#token-sub').hidden = radio('sign_in') !== 'token'; $('#demo-sub').hidden = radio('sign_in') !== 'demo-account'; if (radio('sign_in') === 'demo-account') demoCheck(); }
  // D-93: the demo account's sign-in is in the env file; the page only learns whether each line is filled in
  function demoShow(s, asked){
    var st = $('#demo-state');
    if (!s || !s.ok) { st.className = 'small dstate bad'; st.innerHTML = '<span class="dmark" aria-hidden="true">✕</span> Could not check the file.'; return; }
    $('#demo-path').textContent = s.path;
    var good = s.email && s.password;
    st.className = 'small dstate ' + (good ? 'good' : asked ? 'bad' : '');
    st.innerHTML = (good || asked ? '<span class="dmark" aria-hidden="true">' + (good ? '✓' : '✕') + '</span> ' : '') + (good ? 'The email and password are in the file.' : s.exists ? 'Not saved in the file yet: ' + [!s.email && 'email', !s.password && 'password'].filter(Boolean).join(' and ') + '. Fill them in, save the file, then check again.' : 'No file yet: press Open the file.');
  }
  function demoCheck(asked){ fetch('/api/demo-account').then(function(r){ return r.json(); }).then(function(s){ demoShow(s, asked === true); }).catch(function(){ demoShow(null, true); }); }
  $('#demo-open').addEventListener('click', function(){ fetch('/api/demo-account/open', { method: 'POST' }).then(function(r){ return r.json(); }).then(demoShow).catch(function(){ demoShow(null); }); });
  $('#demo-check').addEventListener('click', function(){ demoCheck(true); });
  // the compact length choice keeps the chosen fit's description under it
  // the length reads as a sentence: [About ▾] [30 sec]; the select drives the (hidden) length_fit radios
  var lenSel = $('#f-lenfit');
  lenSel.addEventListener('change', function(){ setRadio('length_fit', lenSel.value); });
  $$('input[name="length_fit"]').forEach(function(r){ r.addEventListener('change', function(){ if (r.checked) lenSel.value = r.value; }); });
  function lenfitDesc(){ var r = $('input[name="length_fit"]:checked'); var l = r && r.closest('label'); $('#lenfit-desc').textContent = l ? l.getAttribute('title') + '.' : ''; }
  $$('input[name="length_fit"]').forEach(function(r){ r.addEventListener('change', lenfitDesc); }); lenfitDesc();
  $$('input[name="sign_in"]').forEach(function(r){ r.addEventListener('change', signInBranch); });

  // ---- narration → voice follow-ups (shown for Narrated and Both only)
  function voiceBranch(){
    var n = radio('narration');
    var on = n === 'narrated' || n === 'both';
    $('#voice-sub').hidden = !on;
    if (on) { if (!radio('voice')) setRadio('voice', 'none'); voiceFilter(); }
  }
  $$('input[name="narration"]').forEach(function(r){ r.addEventListener('change', voiceBranch); });
  // the gender preference filters the voice cards; a hidden pick moves to the recommended voice of that gender
  var cards = $('#voice-cards');
  function voiceFilter(){
    if (!cards) return;
    var g = radio('voice') || 'none';
    $$('#voice-cards .vopt').forEach(function(c){ c.hidden = g !== 'none' && c.getAttribute('data-gender') !== g; });
    var pick = $('#voice-cards input[name="voice_id"]:checked');
    if (!pick || pick.closest('.vopt').hidden) setRadio('voice_id', cards.getAttribute(g === 'male' ? 'data-house-male' : 'data-house-female'));
  }
  $$('input[name="voice"]').forEach(function(r){ r.addEventListener('change', voiceFilter); });
  // one sample plays at a time; pressing again stops it
  var player = $('#voice-player'), playing = null;
  // ---- screens: HTML mockups and screenshots are uploaded to the local server, checked, and kept in the project
  var screenUploads = [];
  function screensBranch(){
    var on = $$('input[name="screens"]:checked').map(function(c){ return c.value; });
    $('#screens-upload').hidden = on.indexOf('mockups') < 0 && on.indexOf('screenshots') < 0;
    $('#screens-figma').hidden = on.indexOf('figma') < 0;
  }
  function drawScreens(){
    var ul = $('#screen-list'); ul.textContent = '';
    screenUploads.forEach(function(u, k){
      var li = document.createElement('li');
      li.textContent = (u.kind === 'mockup' ? 'Mockup: ' : 'Screenshot: ') + u.title + (u.kind === 'mockup' ? (u.shot ? ' (screenshot taken)' : ' (no screenshot yet)') : '') + ' ';
      var x = document.createElement('button'); x.type = 'button'; x.className = 'link'; x.textContent = 'remove';
      x.addEventListener('click', function(){ screenUploads.splice(k, 1); drawScreens(); });
      li.appendChild(x); ul.appendChild(li);
    });
  }
  $$('input[name="screens"]').forEach(function(c){ c.addEventListener('change', screensBranch); });
  var screenFiles = $('#f-screen-files');
  if (screenFiles) screenFiles.addEventListener('change', function(){
    var files = [].slice.call(screenFiles.files || []); var st = $('#screen-status');
    if (!files.length) return;
    if (location.protocol === 'file:') { st.textContent = 'Static preview: nothing is uploaded.'; return; }
    var left = files.length; st.textContent = 'Uploading ' + left + ' file' + (left === 1 ? '' : 's') + '… (a mockup takes a few seconds: it is opened to take its screenshot)';
    files.reduce(function(p, file){
      return p.then(function(){
        return fetch('/api/source-upload?name=' + encodeURIComponent(file.name), { method: 'POST', body: file })
          .then(function(r){ return r.json(); })
          .then(function(j){ if (j.ok) { screenUploads.push({ path: j.path, shot: j.shot, kind: j.kind, title: j.title }); drawScreens(); } else st.textContent = file.name + ': ' + (j.error || 'could not be used'); })
          .catch(function(){ st.textContent = 'The upload did not reach the page server.'; })
          .then(function(){ left--; if (!left && !/:/.test(st.textContent.split('…')[0])) st.textContent = 'Ready.'; });
      });
    }, Promise.resolve()).then(function(){ screenFiles.value = ''; });
  });
  // ---- your own music track: shown when chosen; the file is uploaded to the local server, checked, and kept in the project
  function ownBranch(){ var on = radio('music') === 'own'; $('#own-sub').hidden = !on; }
  $$('input[name="music"]').forEach(function(r){ r.addEventListener('change', ownBranch); });
  // or a file already on this computer, by its path: the same checks as an upload, then copied into the project
  var ownLocal = $('#own-local-go');
  if (ownLocal) ownLocal.addEventListener('click', function(){
    var v = $('#f-own-local').value.trim(), st = $('#own-status'); if (!v) return;
    if (location.protocol === 'file:') { st.textContent = 'Static preview: nothing is copied.'; return; }
    st.textContent = 'Checking ' + v + '…';
    fetch('/api/music-path', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ path: v }) })
      .then(function(r){ return r.json(); })
      .then(function(j){ if (j.ok) { $('#f-own-path').value = j.path; $('#f-own-title').value = j.title; st.textContent = 'Ready: ' + j.title + ' (' + Math.floor(j.seconds / 60) + ':' + String(j.seconds % 60).padStart(2, '0') + ').'; } else st.textContent = j.error || 'That file can\u2019t be used.'; })
      .catch(function(){ st.textContent = 'Could not reach the page server.'; });
  });
  var ownFile = $('#f-own-file');
  if (ownFile) ownFile.addEventListener('change', function(){
    var file = ownFile.files && ownFile.files[0]; if (!file) return;
    var st = $('#own-status'); st.textContent = 'Uploading ' + file.name + '…';
    if (location.protocol === 'file:') { st.textContent = 'Static preview: nothing is uploaded.'; return; }
    fetch('/api/music-upload?name=' + encodeURIComponent(file.name), { method: 'POST', body: file })
      .then(function(r){ return r.json(); })
      .then(function(j){ if (j.ok) { $('#f-own-path').value = j.path; $('#f-own-title').value = j.title; st.textContent = 'Ready: ' + j.title + ' (' + Math.floor(j.seconds / 60) + ':' + String(j.seconds % 60).padStart(2, '0') + ').'; } else { $('#f-own-path').value = ''; st.textContent = j.error || 'That file could not be used.'; } })
      .catch(function(){ st.textContent = 'The upload did not reach the page server.'; });
  });
  function stopPlay(){ if (playing) { playing.textContent = '▶'; playing = null; } }
  if (player) player.addEventListener('ended', stopPlay);
  $$('button.play').forEach(function(b){ b.addEventListener('click', function(ev){
    ev.preventDefault();
    var same = playing === b;
    player.pause(); stopPlay();
    if (same) return;
    player.src = b.getAttribute('data-sample'); player.currentTime = 0;
    var p = player.play(); if (p && p.catch) p.catch(function(){ stopPlay(); });
    playing = b; b.textContent = '■';
    var r = b.closest('.vopt').querySelector('input'); if (r) { r.checked = true; r.dispatchEvent(new Event('change', {bubbles:true})); }
  }); });

  // ---- product type → frame note, and "website only" preselects the public path
  var signInTouched = false;
  $$('input[name="sign_in"]').forEach(function(r){ r.addEventListener('click', function(){ signInTouched = true; }); });
  function productTypeBranch(){
    var t = radio('product_type');
    var website = t === 'website';
    $('#website-note').hidden = !website;
    if (website) { setRadio('sign_in', 'public'); signInTouched = false; }
  }
  $$('input[name="product_type"]').forEach(function(r){ r.addEventListener('change', productTypeBranch); });
  // D-100: the surface checkboxes drive the (hidden) product type: the app when one is ticked, else the website
  var surfTouched = false;
  function surfaces(){ return $$('input[name="surfaces"]:checked').map(function(c){ return c.value; }); }
  function surfToType(){ var s = surfaces(); return s.indexOf('web-app') >= 0 ? 'web-app' : s.indexOf('mobile-app') >= 0 ? 'mobile-app' : s.indexOf('website') >= 0 ? 'website' : 'unsure'; }
  function typeToSurf(){ if (surfTouched) return; var t = radio('product_type'); var on = $('input[name="surfaces"][value="' + t + '"]'); if (!on || on.disabled) t = 'website'; $$('input[name="surfaces"]').forEach(function(c){ c.checked = c.value === t; }); appSignInNote(); }
  $$('input[name="surfaces"]').forEach(function(c){ c.addEventListener('change', function(ev){ if (ev.isTrusted) surfTouched = true; setRadio('product_type', surfToType()); appSignInNote(); refreshSummaries(); }); });
  $$('input[name="product_type"]').forEach(function(r){ r.addEventListener('change', typeToSurf); });
  function setSurfaces(list){ if (!Array.isArray(list) || !list.length) return; $$('input[name="surfaces"]').forEach(function(c){ c.checked = list.indexOf(c.value) >= 0 && !c.disabled; }); surfTouched = true; setRadio('product_type', surfToType()); appSignInNote(); }

  // ---- read my site
  function showSite(site){
    siteRead = site;
    var box = $('#site'); box.classList.add('on');
    $('#site-title').textContent = site.title || site.site_name || '(no title found)';
    $('#site-desc').textContent = site.description || '';
    var lines = $('#site-lines'); lines.innerHTML = '';
    var all = (site.description ? [site.description] : []).concat(site.headings || []);
    all.forEach(function(line){
      var c = document.createElement('span'); c.className = 'chip'; c.textContent = line;
      // fills the story field you were last in, without moving the page
      c.addEventListener('click', function(){ var el = $('#f-'+lastStoryField); el.value = line; el.dispatchEvent(new Event('input')); refreshSummaries(); });
      lines.appendChild(c);
    });
    $('#site-lines-box').hidden = !all.length;
    var sug = $('#product-suggestions'); sug.innerHTML = '';
    (site.product_suggestions || []).forEach(function(name){
      var c = document.createElement('span'); c.className = 'chip'; c.textContent = name;
      c.addEventListener('click', function(){ $('#f-product').value = name; proposeName(); });
      sug.appendChild(c);
    });
    // fill what is still empty from the site, and say what was filled so the user checks it as they go
    var filled = [];
    if (!$('#f-product').value && site.product_suggestions && site.product_suggestions[0]) { $('#f-product').value = site.product_suggestions[0]; proposeName(); filled.push('product name'); }
    // the site's description reads as a sentence: "a | b | c" becomes "a. b. c."
    var msg = (site.description || (site.headings || [])[0] || '').split(/\\s+[|·•]\\s+/).join('. ').replace(/\\s+,/g, ',').replace(/\\.\\./g, '.');
    if (msg && !$('#f-claim').value && !isUnsure('claim')) { $('#f-claim').value = msg; filled.push('what it is'); }
    $('#autofill-note').textContent = filled.length ? 'Filled from your site: ' + filled.join(' and ') + '. Check them as you go; change anything that is off.' : '';
    refreshSummaries();
  }
  function readSiteNow(localUrl){
    var url = localUrl || $('#f-url').value.trim(); var st = localUrl ? $('#local-status') : $('#read-status');
    if (!url) { st.textContent = 'Enter the address first.'; return Promise.resolve(); }
    if (!localUrl && !/^https?:\\/\\//i.test(url)) { url = 'https://' + url; $('#f-url').value = url; }
    if (window.__SAMPLE__) { st.textContent = 'The static preview does not read sites.'; return Promise.resolve(); }
    var pre = localUrl ? 'Running at ' + url + '. ' : '';
    st.textContent = pre + 'Reading…';
    return fetch('/api/read-site', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ url: url }) })
      .then(function(r){ return r.json(); })
      .then(function(j){ if (!j.ok) { st.textContent = pre + (j.error || 'Could not read the site.'); return; } st.textContent = pre + (localUrl ? 'Read it.' : 'Read.'); showSite(j.site); readBrand(url); })
      .catch(function(){ st.textContent = 'Could not reach the page server.'; });
  }
  $('#read-site').addEventListener('click', function(){ readSiteNow(); });
  // ---- D-117 (option A): Start reads a public site or not; the Local App on this computer is a screens source ----
  function siteNone(){ return radio('site_mode') === 'none'; }
  function siteModeShow(){
    var none = siteNone(), uw = $('#f-url') && $('#f-url').closest('.field');
    if (uw) uw.hidden = none;
    var lv = $('input[name="screens"][value="live"]'); if (lv && none && lv.checked && !$('#f-url').value.trim()) lv.checked = false;
    if (typeof refreshSummaries === 'function') refreshSummaries();
  }
  $$('input[name="site_mode"]').forEach(function(r){ r.addEventListener('change', siteModeShow); });
  function localOn(){ var c = $('input[name="screens"][value="local"]'); return !!(c && c.checked); }
  function codeOn(){ var c = $('input[name="screens"][value="code"]'); return !!(c && c.checked); }
  function localAddr(){ return $('#f-local-address') ? $('#f-local-address').value.trim() : ''; }
  function localShow(){
    var on = localOn();
    $('#screens-local').hidden = !(on || codeOn());
    $('#local-run').hidden = !on;
    $$('.localauth').forEach(function(l){ l.hidden = !on; });
    var hv = $('input[name="sign_in"][value="hosted-live-view"]'); if (hv) hv.closest('label').hidden = on;
    // a Local App starts on "Find out from the code" unless the user picked a sign-in; unticked, a local option goes back
    var cur = radio('sign_in');
    if (on && !signInTouched && (!cur || cur === 'public' || cur === 'unsure')) setRadio('sign_in', 'from-code');
    if (!on && (cur === 'from-code' || cur === 'local-none')) setRadio('sign_in', 'public');
    if (typeof signInBranch === 'function') signInBranch();
    if (typeof refreshSummaries === 'function') refreshSummaries();
  }
  $$('input[name="screens"][value="local"], input[name="screens"][value="code"]').forEach(function(c){ c.addEventListener('change', function(){ if (c.value === 'local' && c.checked) { var cc = $('input[name="screens"][value="code"]'); if (cc && !cc.checked) cc.checked = true; } localShow(); }); });
  var lstat = $('#local-status');
  function lsay(t, cls){ lstat.textContent = t; lstat.className = 'small' + (cls ? ' ' + cls : ''); }
  $('#local-check').addEventListener('click', function(){
    var found = $('#local-found'); found.textContent = 'Checking…';
    fetch('/api/local-check', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ folder: $('#f-local-folder').value.trim() }) })
      .then(function(r){ return r.json(); }).then(function(f){
        if (!f.ok) { found.textContent = f.error || 'Could not check the folder.'; return; }
        $('#f-local-folder').value = f.folder;
        if (!$('#f-local-command').value.trim() && f.command) $('#f-local-command').value = f.command;
        if (!localAddr() && f.address) $('#f-local-address').value = f.address;
        if (!$('#f-product').value.trim() && f.name) $('#f-product').value = f.name;
        found.textContent = 'Found ' + f.name + (f.kind ? ' (' + f.kind + ')' : '') + (f.scripts && f.scripts.length ? ' · scripts: ' + f.scripts.join(', ') : '') + '.' + (f.up ? ' It is already running at ' + f.address + '.' : '') + (f.installed === false ? ' Its packages are not installed yet: your AI session asks you before installing them.' : '');
        if (typeof refreshSummaries === 'function') refreshSummaries();
      }).catch(function(){ found.textContent = 'Could not reach the page server.'; });
  });
  var lpoll = null;
  function startLocal(){
    if (window.__SAMPLE__) { lsay('The static preview does not start apps.'); return Promise.resolve(false); }
    var body = { folder: $('#f-local-folder').value.trim(), command: $('#f-local-command').value.trim(), address: localAddr() };
    lsay('Asking your AI session to start it…');
    return fetch('/api/local-start', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json(); }).then(function(j){
      if (!j.ok) { lsay(j.error || 'Could not ask for the start.', 'bad'); return false; }
      if (j.address) $('#f-local-address').value = j.address;
      if (j.state === 'done' && j.up) { lsay('Running at ' + j.address + '.', 'ok'); return true; }
      var t0 = Date.now();
      lsay('Waiting for your AI session to start it. It shows you the command in the terminal and asks first.');
      return new Promise(function(done){
        if (lpoll) clearInterval(lpoll);
        lpoll = setInterval(function(){
          fetch('/api/local-start?address=' + encodeURIComponent(localAddr()), { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(st){
            if (st.state === 'failed') { clearInterval(lpoll); lsay('It did not start: ' + st.why, 'bad'); done(false); return; }
            if (st.up) { clearInterval(lpoll); lsay('Running at ' + localAddr() + (st.state === 'done' && st.started ? ', started by your AI session.' : '.'), 'ok'); done(true); return; }
            if (Date.now() - t0 > 120000) lsay('Still waiting. Check the terminal: your AI session may be asking you to approve the command, or the app may need longer to start.');
          }).catch(function(){});
        }, 2000);
      });
    });
  }
  // the app's home page as a picture (is it the right app?) and how many pages were found; Ultrademo picks from them
  function showHome(j){
    if (!j || !j.count) return;
    $('#local-home').hidden = false;
    $('#lh-name').textContent = (j.home && j.home.title) || $('#f-product').value.trim() || 'Your app';
    $('#lh-line').textContent = 'Running · ' + j.count + ' page' + (j.count === 1 ? '' : 's') + ' found. Ultrademo picks the ones each scene needs; name any you want below.';
    if (j.home) { var src = '/local-page/' + j.home.id + '.jpg?t=' + Date.now(); $('#lh-img').src = src; $('#lh-view').onclick = function(){ if (window.udPicView) window.udPicView.open([{ src: src, label: (j.home.title || 'Home'), alt: j.home.route }], 0, null); }; }
  }
  function findPages(){
    lsay('Running at ' + localAddr() + '. Finding its pages…', 'ok');
    return fetch('/api/local-pages', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ address: localAddr(), folder: $('#f-local-folder').value.trim() }) }).then(function(r){ return r.json(); }).then(function(j){
      if (!j.ok) { lsay(j.error || 'Could not list its pages.', 'bad'); return; }
      lsay('Running at ' + j.address + '.', 'ok'); showHome(j);
    }).catch(function(){ lsay('Could not reach the page server.', 'bad'); });
  }
  $('#local-start').addEventListener('click', function(){ startLocal().then(function(up){ if (up) return findPages(); }); });
  setTimeout(localShow, 0); // after the rest of the script (the summary rail) is set up
  fetch('/api/local-pages', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){ if (j.ok && j.count) showHome(j); }).catch(function(){});


  // ---- the pinned header shows a line under it once the page has scrolled
  var pin = $('.ud-pin');
  if (pin) window.addEventListener('scroll', function(){ pin.classList.toggle('stuck', window.scrollY > 8); }, { passive: true });

  // ---- password managers: every field here is a note, not a login (set on all of them, the server's too)
  $$('input[type=text],input[type=url],input[type=number],textarea').forEach(function(el){
    el.setAttribute('autocomplete', 'off'); el.setAttribute('data-lpignore', 'true'); el.setAttribute('data-1p-ignore', 'true'); el.setAttribute('data-bwignore', 'true'); el.setAttribute('data-form-type', 'other');
  });

  // ---- sections open one at a time (D-79); a closed one shows what it holds in a line
  var SECTIONS = [];
  function val(id){ var el = $('#f-'+id); return el ? el.value.trim() : ''; }
  function pickedName(name){ var el = $('input[name="'+name+'"]:checked'); var b = el && el.closest('label') && el.closest('label').querySelector('b'); return b ? b.childNodes[0].textContent.trim() : ''; }
  var SUMMARY = {
    's-product': function(){ return [val('product'), val('url'), siteNone() ? 'no site read: described here' : '', surfaceWords()].filter(Boolean).join(' · '); },
    's-brand': function(){ var f = $('#f-logo').value; var c = $('#hex-brand').textContent; var font = $('#f-font-display').value; return f || c || font ? [f ? 'logo' : 'no logo yet', c, font].filter(Boolean).join(' · ') : ''; },
    's-screens': function(){ var on = $$('input[name="screens"]:checked').map(function(c){ return c.closest('label').querySelector('b').textContent; }); return on.join(', ') + (screenUploads.length ? ' · ' + screenUploads.length + ' file' + (screenUploads.length === 1 ? '' : 's') : ''); },
    's-story': function(){ return val('claim') || (isUnsure('claim') ? 'Unsure: proposed from your site' : ''); },
    's-exact': function(){ return [val('tagline') && '“' + val('tagline') + '”', val('cta') && 'Call to action: ' + val('cta')].filter(Boolean).join(' · ') || 'Nothing word for word'; },
    's-type': function(){ var t = pickedName('video_type'); var fit = { about: 'about ', max: 'up to ', exact: '' }[radio('length_fit') || 'about']; return t ? t + ' · ' + (radio('scope') === 'feature' ? (val('feature') || 'one feature') : 'the whole product') + (val('length_s') ? ' · ' + fit + val('length_s') + ' s' : '') + ({ landscape: ' · landscape', vertical: ' · vertical', both: ' · landscape and vertical' }[radio('formats')] || '') + (radio('cut') ? ' · ' + radio('cut') + ' s cut' : '') : ''; },
    's-sound': function(){ var v = radio('narration') !== 'music-only' ? pickedName('voice_id') : ''; return [pickedName('narration'), v, pickedName('music')].filter(Boolean).join(' · '); },
    's-make': function(){ return [pickedName('tone'), pickedName('autonomy')].filter(Boolean).join(' · '); },
    's-look': function(){ return [val('look'), 'effects ' + (radio('effects') || 'lively')].filter(Boolean).join(' · '); },
    's-footage': function(){ return pickedName('footage'); },
    's-signin': function(){ return pickedName('sign_in'); },
    's-ref': function(){ return val('reference') || 'None'; },
    's-notes': function(){ var n = val('notes'); return n ? (n.length > 90 ? n.slice(0, 90) + '…' : n) : 'None'; },
    's-name': function(){ var t = val('title'); return (t ? t + ' · ' : '') + val('project_name'); }
  };
  // ---- D-96: the brief in five steps. The sections are moved into their step; the overview Claude drafts feeds the
  // key attributes; a summary of every choice, and where it came from, stays beside the steps.
  var STEP = 1, drafted = false, drafting = false, draftT0 = 0, draftTimer = null, seededFromChat = false;
  var NEXT_LABEL = ['', 'Continue: overview', 'Continue: screens and footage', 'Continue: sound', 'Continue: look and finish', ''];
  var FROM_WORDS = { you: 'From you', request: 'From your request', site: 'From your site', pick: "Ultrademo's pick", check: 'Check this', done: 'Set by you' };
  // the paragraph's highlights and the brief field each one feeds
  var MARK_FIELD = { length: 'length_s', purpose: 'purpose_text', viewer: 'viewer', pain: 'pain_point', cover: 'cover', aha: 'proof_moment', cta: 'cta' };
  var FIELD_MARK = {}; Object.keys(MARK_FIELD).forEach(function(k){ FIELD_MARK[MARK_FIELD[k]] = k; });
  var PUT_BACK = { length: ['It runs about ', '.'], purpose: ['It is for ', '.'], viewer: ['It is made for ', '.'], pain: ['It opens on ', '.'], cover: ['It covers ', '.'], aha: ['The moment it clicks: ', '.'], cta: ['It ends on ', '.'] };
  var markedAtDraft = [];
  function slot(n){ return $('.bslot[data-slot="' + n + '"]'); }
  function wrapOf(f){ return $('.field[data-field="' + f + '"]'); }
  function stepOfEl(el){ var st = el && el.closest('.bstep'); return st ? Number(st.dataset.step) : 1; }
  function moveSection(id, to){ var x = $('#' + id); if (x && slot(to)) slot(to).appendChild(x); }
  function moveField(f, to){ var w = wrapOf(f); if (w && slot(to)) slot(to).appendChild(w); }
  function setFrom(f, from){ var w = wrapOf(f); if (!w) return; w.setAttribute('data-from', from); drawTag(w); }
  function drawTag(w){
    var lab = w.querySelector('.lab'); if (!lab) return;
    // a label inside one of the field's follow-up panels (the footage links) is not the field's own label
    var sub = lab.closest('.sub'); if (sub && sub !== w && w.contains(sub)) return;
    var t = lab.querySelector('.atag'); if (!t) { t = document.createElement('span'); lab.appendChild(t); var h = lab.querySelector(':scope > .hint'); if (h) h.style.display = 'none'; }
    var from = w.getAttribute('data-from') || '';
    t.className = 'atag ' + from; t.textContent = FROM_WORDS[from] || '';
    if (from === 'check') { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Looks right'; b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); setFrom(w.getAttribute('data-field'), 'done'); var m = $('#overview mark[data-field="' + FIELD_MARK[w.getAttribute('data-field')] + '"]'); if (m) m.classList.remove('check'); drawRail(); }); t.appendChild(b); }
  }
  // help lines next to headings and labels go into an (i) beside them: the text shows on hover, focus or a tap
  function infoize(){
    function make(target, src){
      if (!target || !src || src.id || !src.textContent.trim()) return;
      var had = target.querySelector(':scope > .hinfo .tip');
      if (had) { had.innerHTML += '<br><br>' + src.innerHTML; src.remove(); return; }
      var b = document.createElement('button'); b.type = 'button'; b.className = 'hinfo'; b.setAttribute('aria-label', 'More about this'); b.textContent = 'i';
      var t = document.createElement('span'); t.className = 'tip'; t.setAttribute('role', 'tooltip'); t.innerHTML = src.innerHTML; b.appendChild(t);
      b.addEventListener('click', function(ev){ ev.preventDefault(); ev.stopPropagation(); var was = b.classList.contains('open'); $$('.hinfo.open').forEach(function(x){ x.classList.remove('open'); }); if (!was) b.classList.add('open'); });
      target.appendChild(b); src.remove();
    }
    $$('section.card > h2').forEach(function(h){ var n = h.nextElementSibling; if (n && n.matches('p.help')) make(h, n); });
    $$('.lab > .hint').forEach(function(hn){ var lab = hn.parentNode, l = lab.querySelector('label, .l'); if (l) make(l, hn); });
    $$('.field > .hint').forEach(function(hn){ var w = hn.parentNode, l = w.querySelector('.lab label, .lab .l'); if (l) make(l, hn); });
    var qh = $('.qhead > div'); if (qh) make(qh.querySelector('b'), qh.querySelector('span.muted'));
    document.addEventListener('click', function(){ $$('.hinfo.open').forEach(function(x){ x.classList.remove('open'); }); });
  }
  infoize();
  function buildSteps(){
    moveSection('s-product', '1a'); moveField('video_type', 'type'); moveField('scope', 'type'); moveField('tutorial', 'type'); moveSection('s-notes', 'notes');
    ['claim', 'viewer', 'pain_point', 'proof_moment', 'cta', 'length_s'].forEach(function(f){ moveField(f, 'attrs'); });
    var lines = $('#site-lines-box'); if (lines) slot('attrs-after').appendChild(lines);
    moveSection('s-brand', '2b'); moveSection('s-exact', '2b'); var reg = wrapOf('register'); if (reg) $('#s-exact').appendChild(reg);
    moveSection('s-screens', '3'); var pt = wrapOf('product_type'); if (pt) $('#s-screens').appendChild(pt); moveSection('s-signin', '3'); moveSection('s-footage', '3');
    moveSection('s-sound', '4'); moveField('caption_style', 'captions');
    moveSection('s-look', '5a'); ['formats', 'cut', 'motion_between', 'autonomy'].forEach(function(f){ moveField(f, 'finish'); }); moveSection('s-ref', '5b'); moveSection('s-name', '5b');
    // where each choice came from, until the user changes it
    ['url', 'product', 'video_type', 'cover', 'purpose', 'notes'].forEach(function(f){ if (!wrapOf(f) || !wrapOf(f).getAttribute('data-from')) setFrom(f, seededFromChat ? 'request' : 'you'); });
    ['screens', 'product_type', 'footage', 'sign_in', 'narration', 'music', 'caption_style', 'look', 'effects', 'formats', 'cut', 'autonomy'].forEach(function(f){ if (wrapOf(f) && !wrapOf(f).getAttribute('data-from')) setFrom(f, 'pick'); });
    // a choice the user makes is theirs from then on
    function mine(ev){ if (!ev.isTrusted) return; var w = ev.target.closest && ev.target.closest('.field[data-field]'); if (!w || !w.closest('.bstep')) return; var f = w.getAttribute('data-field'); if (stepOfEl(w) === 1) { if (w.getAttribute('data-from') !== 'you') setFrom(f, 'you'); } else if (w.getAttribute('data-from') !== 'done') setFrom(f, 'done'); }
    document.addEventListener('input', mine, true); document.addEventListener('change', mine, true);
    document.addEventListener('input', drawRail); document.addEventListener('change', drawRail);
    // music: the first four tracks, then all of them on request (the picked one always shows)
    var mg = wrapOf('music') && wrapOf('music').querySelector('.opts.vgrid');
    if (mg) {
      var tracks = $$('.vopt', mg).filter(function(o){ var v = o.querySelector('input').value; return v !== 'auto' && v !== 'own'; });
      tracks.forEach(function(o, i){ if (i >= 4) o.classList.add('more'); });
      if (tracks.length > 4) {
        mg.classList.add('vcollapsed');
        var mb = document.createElement('button'); mb.type = 'button'; mb.className = 'quiet'; mb.style.marginTop = '8px'; mb.textContent = 'All ' + tracks.length + ' tracks';
        mb.addEventListener('click', function(){ mg.classList.toggle('vcollapsed'); mb.textContent = mg.classList.contains('vcollapsed') ? 'All ' + tracks.length + ' tracks' : 'Fewer tracks'; });
        mg.parentNode.insertBefore(mb, mg.nextSibling);
        var picked = $('input[name="music"]:checked', mg); if (picked && picked.closest('.vopt').classList.contains('more')) mg.classList.remove('vcollapsed');
      }
    }
    $$('[data-go]').forEach(function(b){ b.addEventListener('click', function(){ go(Number(b.getAttribute('data-go'))); }); });
    $('#b-back').addEventListener('click', function(){ go(STEP - 1); });
    $('#b-skip').addEventListener('click', function(){ go(5); });
    $('#b-next').addEventListener('click', function(){ if (STEP === 1 && !drafted) draft(); else go(STEP + 1); });
    $('#ov-again').addEventListener('click', function(){ draft(); });
    $('#d-skip').addEventListener('click', function(){ stopDraft(); drafted = true; $('#ov-card').hidden = false; if (!$('#overview').textContent.trim()) $('#overview').textContent = ''; $('#ov-foot').textContent = 'No overview drafted. Fill in the key attributes below, or press Draft it again once your AI session is back.'; go(2); });
    $('#d-copy').addEventListener('click', function(ev){ var b = ev.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText('a brief task is waiting') : Promise.reject()).then(function(){ b.textContent = 'Copied'; }, function(){ b.textContent = 'Select and copy'; }); setTimeout(function(){ b.textContent = 'Copy'; }, 2000); });
    // the overview: a pasted text keeps only its words; an edited highlight edits its attribute
    var ov = $('#overview');
    ov.addEventListener('paste', function(ev){ ev.preventDefault(); var t = (ev.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
    ov.addEventListener('input', overviewEdited);
    Object.keys(FIELD_MARK).forEach(function(f){ var el = $('#f-' + f); if (el) el.addEventListener('input', function(ev){ if (ev.isTrusted) fieldToMark(f); }); });
    // purpose chips and the queue
    $$('#purpose .chip').forEach(function(c){ c.addEventListener('click', function(){ c.classList.toggle('on'); c.setAttribute('aria-pressed', c.classList.contains('on') ? 'true' : 'false'); setFrom('purpose', 'you'); drawRail(); }); });
    $('#qadd').addEventListener('click', function(){ addIdea().querySelector('input').focus(); });
    $('#qopen').addEventListener('click', function(){ openQueue(); var r = $('#qrows .qrow') || addIdea(); r.querySelector('input').focus(); });
    // where the brief opens: the overview when one is there; for a request from the chat, drafting it straight away
    var startAt = drafted ? 2 : 1;
    go(startAt);
    if (seededFromChat && !drafted && $('#f-url').value.trim()) draft();
    drawRail();
  }
  function addIdea(type, cover){
    var row = document.createElement('div'); row.className = 'qrow';
    row.innerHTML = '<select aria-label="Video type"><option value="spotlight">Spotlight</option><option value="explainer">Explainer</option><option value="tutorial">Tutorial</option><option value="launch">Launch</option><option value="ad">Ad</option></select><input type="text" placeholder="What it covers, e.g. the review page: comments pinned to a moment" aria-label="What it covers"><button type="button" class="quiet" aria-label="Remove this idea">×</button>';
    if (type) row.querySelector('select').value = type; if (cover) row.querySelector('input').value = cover;
    row.querySelector('button').addEventListener('click', function(){ row.remove(); });
    $('#qrows').appendChild(row); openQueue(); return row;
  }
  function openQueue(){ $('#qbody').hidden = false; $('#qopen').hidden = true; $('#qopen').setAttribute('aria-expanded', 'true'); }
  function queueIdeas(){ return $$('#qrows .qrow').map(function(r){ return { video_type: r.querySelector('select').value, cover: r.querySelector('input').value.trim() }; }).filter(function(i){ return i.cover; }); }
  function purposeChips(){ return $$('#purpose .chip.on').map(function(c){ return c.getAttribute('data-purpose'); }); }
  function go(n){
    // a voice sample or a music preview stops when the user moves to another step
    try { if (player && !player.paused) { player.pause(); stopPlay(); } } catch (e) {}
    n = Math.max(1, Math.min(5, Number(n) || 1));
    if (n > 1 && !drafted && !drafting) n = 1;
    STEP = n;
    $$('.bstep').forEach(function(x){ x.hidden = Number(x.dataset.step) !== n; });
    // step 2 always shows the paragraph: an empty one (never drafted, or the draft was skipped) says so and offers the draft
    if (n === 2 && !drafting && !$('#overview').textContent.trim()) { $('#ov-card').hidden = false; $('#ov-foot').textContent = 'No overview yet. Press Draft it again to have Ultrademo write one from Start and your site, or write it here in your own words.'; }
    $$('#bsub li').forEach(function(li){ var k = Number(li.dataset.step); li.className = k === n ? 'now' : k < n ? 'done' : ''; li.querySelector('button').disabled = k > 1 && !drafted && !drafting; });
    $('#b-back').hidden = n === 1;
    $('#b-skip').hidden = !(n === 3 || n === 4);
    $('#b-next').hidden = n === 5; $('#save').hidden = n !== 5; if ($('#save-keep')) $('#save-keep').hidden = n !== 5;
    $('#b-next').textContent = n === 1 && !drafted ? 'Draft the overview' : NEXT_LABEL[n];
    if (n === 2) drawFromStart();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    drawRail();
  }
  // ---- drafting the overview: a model step (a task for Claude in agent mode); the page asks until the answer is there
  function startData(){
    return { url: $('#f-url').value.trim(), product: $('#f-product').value.trim(), brand: radio('saved_brand') || '', video_type: radio('video_type') || '', scope: radio('scope') || 'product', feature: $('#f-feature').value.trim(), cover: $('#f-cover').value.trim(), purpose: purposeChips(), purpose_text: $('#f-purpose_text').value.trim(), notes: $('#f-notes').value.trim(), site: siteRead ? { title: siteRead.title, description: siteRead.description, headings: siteRead.headings } : null };
  }
  function draftStage(k){ var order = ['request', 'site', 'write'], at = order.indexOf(k); $$('#drafting .work-steps li').forEach(function(li, i){ li.className = i < at ? 'done' : i === at ? 'now' : ''; }); }
  function stopDraft(){ drafting = false; if (draftTimer) clearTimeout(draftTimer); draftTimer = null; $('#drafting').hidden = true; $('#d-nudge').hidden = true; $('#ov-card').classList.remove('loading'); }
  function draft(){
    if (window.__SAMPLE__) { showProblems(['Static preview: the overview is drafted by Ultrademo when the page runs from the skill.']); return; }
    var url = siteNone() ? '' : $('#f-url').value.trim();
    var noSite = siteNone();
    if (!url && !noSite) { showProblems([{ what: 'The product address is empty', fix: 'give the address, pick a saved product, or pick No site to read', field: 'url' }]); return; }
    if (url && !/^https?:\\/\\//i.test(url)) $('#f-url').value = 'https://' + url;
    showProblems([]); drafting = true; draftT0 = Date.now();
    $('#drafting').hidden = false; $('#ov-card').hidden = false; $('#ov-card').classList.add('loading'); $('#d-nudge').hidden = true; draftStage('site');
    go(2);
    (siteRead || noSite ? Promise.resolve() : readSiteNow()).then(function(){ draftStage('write'); attempt(); });
  }
  function attempt(){
    if (!drafting) return;
    fetch('/api/overview', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ start: startData() }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!drafting) return;
        if (j.ok) { stopDraft(); applyOverview(j.overview); return; }
        if (j.waiting) { if (Date.now() - draftT0 > 120000) $('#d-nudge').hidden = false; $('#d-status').textContent = 'Ultrademo is writing it: ' + Math.round((Date.now() - draftT0) / 1000) + ' s. It appears here by itself.'; draftTimer = setTimeout(attempt, 4000); return; }
        $('#d-status').textContent = (j.error || 'The overview could not be drafted.') + ' Try again, or fill it in yourself.'; $('#d-nudge').hidden = false;
      })
      .catch(function(){ if (drafting) { $('#d-status').textContent = 'Could not reach the page server.'; $('#d-nudge').hidden = false; } });
  }
  function renderOverview(segments){
    var ov = $('#overview'); ov.innerHTML = ''; markedAtDraft = [];
    (segments || []).forEach(function(g){
      if (g.field && MARK_FIELD[g.field] && markedAtDraft.indexOf(g.field) < 0) { var m = document.createElement('mark'); m.setAttribute('data-field', g.field); m.textContent = g.text; m.setAttribute('data-was', g.text); ov.appendChild(m); markedAtDraft.push(g.field); }
      else ov.appendChild(document.createTextNode(g.text));
    });
    $('#ov-card').hidden = false; $('#ov-missing').hidden = true;
  }
  function applyOverview(o){
    renderOverview(o.segments);
    var src = o.sources || {}, a = o.attributes || {};
    ['claim', 'viewer', 'pain_point', 'proof_moment', 'cta'].forEach(function(f){
      var el = $('#f-' + f), w = wrapOf(f); if (!el || a[f] == null) return;
      var mineAlready = w && (w.getAttribute('data-from') === 'done') && el.value.trim();
      if (!mineAlready) { el.value = a[f]; var ub = $('[data-unsure="' + f + '"]'); if (ub && ub.checked) { ub.checked = false; ub.dispatchEvent(new Event('change')); } setFrom(f, src[f] || 'pick'); }
    });
    if (a.product && !$('#f-product').value.trim()) $('#f-product').value = a.product;
    if (a.length_s && !lengthTouched) { lengthEl.value = a.length_s; setFrom('length_s', src.length_s || 'pick'); }
    // a highlight Claude marked as a guess shows pink in the paragraph too
    Object.keys(MARK_FIELD).forEach(function(k){ var f = MARK_FIELD[k], w = wrapOf(f), m = $('#overview mark[data-field="' + k + '"]'); if (m && w && w.getAttribute('data-from') === 'check') m.classList.add('check'); });
    if (a.length_s == null && $('#overview mark[data-field="length"]')) markToField('length');
    if (!look.value.trim() && !$$('#look-chips .chip.on').length) (o.look || []).forEach(function(w){ var c = $('#look-chips .chip[data-chip="' + w + '"]'); if (c) c.click(); });
    if (o.product_type && wrapOf('product_type') && wrapOf('product_type').getAttribute('data-from') !== 'done') { setRadio('product_type', o.product_type); setFrom('product_type', 'site'); }
    drafted = true; $('#ov-foot').textContent = 'Highlighted words feed the key attributes below; change them and the attribute follows. The outline step reads the whole paragraph.';
    updateClaim(); proposeName(); go(2);
  }
  // ---- paragraph and attributes, kept in step
  function cleanValue(k, t){ t = t.replace(/^\\s*["\\u201c]|["\\u201d]\\s*$/g, '').trim(); return k === 'cta' || !t ? t : t.charAt(0).toUpperCase() + t.slice(1); }
  function markToField(k){
    var m = $('#overview mark[data-field="' + k + '"]'), f = MARK_FIELD[k], el = $('#f-' + f); if (!m || !el) return;
    var t = m.textContent;
    if (k === 'length') { var mm = /(\\d+(?:\\.\\d+)?)\\s*-?\\s*(minute|min|second|sec|s)\\b/i.exec(t); if (mm) { el.value = Math.round(Number(mm[1]) * (/^m/i.test(mm[2]) ? 60 : 1)); lengthTouched = true; } return; }
    el.value = cleanValue(k, t);
  }
  function fieldToMark(f){
    var k = FIELD_MARK[f], m = $('#overview mark[data-field="' + k + '"]'), el = $('#f-' + f); if (!m || !el) return;
    var v = el.value.trim(); if (!v) return;
    if (k === 'length') { var n = Number(v); if (n) m.textContent = n >= 60 && n % 60 === 0 ? (n / 60) + '-minute' : n + '-second'; return; }
    m.textContent = k === 'cta' ? '"' + v.replace(/^"|"$/g, '') + '"' : v.charAt(0).toLowerCase() + v.slice(1);
    m.classList.add('edited');
  }
  function overviewEdited(){
    $$('#overview mark').forEach(function(m){
      var k = m.getAttribute('data-field'); if (!MARK_FIELD[k]) return;
      if (m.getAttribute('data-was') === null) m.setAttribute('data-was', m.textContent);
      if (m.textContent !== m.getAttribute('data-was')) { markToField(k); m.classList.add('edited'); m.classList.remove('check'); setFrom(MARK_FIELD[k], 'done'); m.setAttribute('data-was', m.textContent); }
    });
    drawMissing(); drawRail();
  }
  // a highlight whose words were deleted: flagged, and offered back as a sentence
  function goneMarks(){ return markedAtDraft.filter(function(k){ return !$('#overview mark[data-field="' + k + '"]'); }); }
  function drawMissing(focus){
    var gone = goneMarks(), box = $('#ov-missing');
    gone.forEach(function(k){ var w = wrapOf(MARK_FIELD[k]); if (w && w.getAttribute('data-from') !== 'check') { w.setAttribute('data-was-from', w.getAttribute('data-from') || ''); setFrom(MARK_FIELD[k], 'check'); } });
    box.hidden = !gone.length; if (!gone.length) return;
    box.innerHTML = '';
    var p = document.createElement('div'); p.innerHTML = '<b>No longer in the paragraph:</b> ';
    p.appendChild(document.createTextNode(gone.map(function(k){ return labelOf(MARK_FIELD[k]); }).join(', ') + '. Write ' + (gone.length === 1 ? 'it' : 'them') + ' back in your own words, or put the last version back.'));
    var row = document.createElement('div'); row.className = 'row';
    gone.forEach(function(k){ var b = document.createElement('button'); b.type = 'button'; b.className = 'quiet'; b.textContent = 'Put back: ' + labelOf(MARK_FIELD[k]).toLowerCase(); if (k === focus) b.style.outline = '2px solid var(--fg)'; b.addEventListener('click', function(){ putBack(k); }); row.appendChild(b); });
    box.appendChild(p); box.appendChild(row);
  }
  function putBack(k){
    var f = MARK_FIELD[k], el = $('#f-' + f), ov = $('#overview'); var v = el ? el.value.trim() : '';
    if (k === 'length') { var n = Number(v) || 60; v = n >= 60 && n % 60 === 0 ? (n / 60) + '-minute' : n + '-second'; }
    else if (k === 'cta') v = '"' + v + '"'; else v = v.charAt(0).toLowerCase() + v.slice(1);
    if (!v) { if (el) el.focus(); return; }
    var m = document.createElement('mark'); m.setAttribute('data-field', k); m.textContent = v; m.setAttribute('data-was', v);
    ov.appendChild(document.createTextNode(' ' + PUT_BACK[k][0])); ov.appendChild(m); ov.appendChild(document.createTextNode(PUT_BACK[k][1]));
    var w = wrapOf(f); if (w) setFrom(f, w.getAttribute('data-was-from') || 'done');
    drawMissing(); drawRail();
  }
  // the label's own words: not the info button (its "i" and tooltip) or the "From you" tag added beside it
  function labelWords(l){ var c = l.cloneNode(true); Array.prototype.forEach.call(c.querySelectorAll('.hinfo, .atag'), function(x){ x.remove(); }); return c.textContent; }
  function labelOf(f){ var w = wrapOf(f); var l = w && (w.querySelector('.lab label') || w.querySelector('.lab .l')); return l ? labelWords(l).replace(/\\s*\\(.*\\)\\s*$/, '').trim() : f; }
  function drawFromStart(){
    var bits = [['Video type', pickedName('video_type') + (radio('scope') === 'feature' ? ', one feature' : '')], ['What it covers', $('#f-cover').value.trim()], ['For', purposeChips().concat($('#f-purpose_text').value.trim() ? [$('#f-purpose_text').value.trim()] : []).join(', ')]];
    var box = $('#fromstart'); box.innerHTML = '';
    bits.forEach(function(b){ if (!b[1]) return; var sp = document.createElement('span'); sp.appendChild(document.createTextNode(b[0] + ': ')); var bb = document.createElement('b'); bb.textContent = b[1].length > 90 ? b[1].slice(0, 88) + '…' : b[1]; sp.appendChild(bb); box.appendChild(sp); });
    var ch = document.createElement('button'); ch.type = 'button'; ch.textContent = 'Change on Start'; ch.addEventListener('click', function(){ go(1); }); box.appendChild(ch);
  }
  // ---- the summary of every choice
  var RAIL = [
    [1, 'Product', 'url', function(){ return [val('product'), val('url')].filter(Boolean).join(' · '); }],
    [1, 'Video type', 'video_type', function(){ var t = pickedName('video_type'); return t ? t + (radio('scope') === 'feature' ? ', one feature' : ', the whole product') : ''; }],
    [1, 'What it covers', 'cover', function(){ return val('cover'); }],
    [1, 'What it is for', 'purpose', function(){ return purposeChips().concat(val('purpose_text') ? [val('purpose_text')] : []).join(', '); }],
    [1, 'Anything else', 'notes', function(){ return val('notes'); }],
    [2, 'What it is', 'claim', function(){ return val('claim'); }],
    [2, 'Who it is for', 'viewer', function(){ return val('viewer'); }],
    [2, 'The problem', 'pain_point', function(){ return val('pain_point'); }],
    [2, 'The aha moment', 'proof_moment', function(){ return val('proof_moment'); }],
    [2, 'Call to action', 'cta', function(){ return val('cta'); }],
    [2, 'Length', 'length_s', function(){ return val('length_s') ? val('length_s') + ' s' : ''; }],
    [3, 'Screens', 'screens', function(){ return $$('input[name="screens"]:checked').map(function(c){ return c.closest('label').querySelector('b').textContent; }).join(', '); }],
    [3, 'Target surface', 'product_type', function(){ return surfaceWords(); }],
    [3, 'Footage', 'footage', function(){ return pickedName('footage'); }],
    [3, 'Sign-in', 'sign_in', function(){ return pickedName('sign_in'); }],
    [4, 'Narration', 'narration', function(){ return pickedName('narration'); }],
    [4, 'Voice', 'voice_id', function(){ return radio('narration') === 'music-only' ? '' : pickedName('voice_id'); }],
    [4, 'Music', 'music', function(){ return pickedName('music'); }],
    [4, 'Captions', 'caption_style', function(){ return radio('narration') === 'music-only' ? '' : pickedName('caption_style'); }],
    [5, 'Look', 'look', function(){ return val('look'); }],
    [5, 'Effects', 'effects', function(){ return pickedName('effects'); }],
    [5, 'Format', 'formats', function(){ return pickedName('formats'); }],
    [5, 'Name', 'project_name', function(){ return val('project_name'); }],
  ];
  var STEP_NAMES = ['', 'Start', 'Overview', 'Screens and footage', 'Sound', 'Look and finish'];
  function drawRail(){
    var list = $('#rail-list'); if (!list) return;
    var checks = 0, last = 0; list.innerHTML = '';
    var perStep = {};
    RAIL.forEach(function(r){
      if (r[0] > 1 && !drafted) return;
      var w = wrapOf(r[2]), from = w ? (w.getAttribute('data-from') || '') : '', v = '';
      try { v = r[3]() || ''; } catch (e) {}
      if (!v && from !== 'check') return;
      var gone = FIELD_MARK[r[2]] && markedAtDraft.indexOf(FIELD_MARK[r[2]]) >= 0 && !$('#overview mark[data-field="' + FIELD_MARK[r[2]] + '"]');
      if (from === 'check') { checks++; perStep[r[0]] = (perStep[r[0]] || 0) + 1; }
      if (r[0] !== last) { var g = document.createElement('li'); g.className = 'gap'; g.textContent = STEP_NAMES[r[0]]; list.appendChild(g); last = r[0]; }
      var li = document.createElement('li'); li.className = from;
      var b = document.createElement('button'); b.type = 'button';
      var k = document.createElement('span'); k.className = 'k'; k.textContent = r[1];
      var vv = document.createElement('span'); vv.className = 'v'; vv.textContent = gone ? 'Not in the paragraph' : (v || '—');
      var st = document.createElement('span'); st.className = 'st'; st.textContent = FROM_WORDS[from] || '';
      b.appendChild(k); b.appendChild(vv); b.appendChild(st);
      b.addEventListener('click', function(){ goToField(r[2]); });
      li.appendChild(b); list.appendChild(li);
    });
    $('#rsub').innerHTML = !drafted ? 'Fills in as you go. After Start, Ultrademo drafts the rest for you to check.' : checks ? '<b>' + checks + ' to check</b>; everything else is filled in. Click a line to change it.' : 'Nothing left to check. Click a line to change it.';
    $$('#bsub li').forEach(function(li){ var n = perStep[Number(li.dataset.step)]; li.querySelector('.cnt').textContent = n ? '● ' + n : ''; });
  }
  // a choice leads to where it is set: its words in the overview when it has some, else its field (the paragraph when
  // its words were deleted, with the way to put them back)
  function goToField(f){
    var k = FIELD_MARK[f], m = k && $('#overview mark[data-field="' + k + '"]');
    if (k && drafted && markedAtDraft.indexOf(k) >= 0) {
      go(2);
      setTimeout(function(){
        if (m) { m.classList.add('flash'); var r = document.createRange(); r.selectNodeContents(m); var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); m.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function(){ m.classList.remove('flash'); }, 1400); }
        else { var ov = $('#overview'); ov.scrollIntoView({ block: 'center', behavior: 'smooth' }); ov.focus(); drawMissing(k); }
      }, 80);
      return;
    }
    var w = wrapOf(f); if (!w) return;
    go(stepOfEl(w));
    setTimeout(function(){ w.scrollIntoView({ block: 'center', behavior: 'smooth' }); var i = w.querySelector('input:not([type=hidden]),textarea,select'); if (i) i.focus({ preventScroll: true }); }, 80);
  }
  // kept for the parts of the page that still call it: the rail is the summary now
  function surfaceWords(){ var names = { 'website': 'public website', 'web-app': 'web app', 'mobile-app': 'mobile app' }; var l = $$('input[name="surfaces"]:checked').map(function(c){ return names[c.value]; }); return l.length ? l.join(' → ') : ''; }
  function refreshSummaries(){ drawRail(); }

  // ---- the brand: read in a real browser after the text read; the user's own edits always win
  var brandTouched = {};
  function setLogo(path, which){ $('#f-logo').value = path || ''; $('#logo-prev').innerHTML = path ? '<img alt="Your logo" src="/brand/logo?which=' + which + '&t=' + Date.now() + '">' : '<span class="muted small">No logo found. Upload one: the video shows it in the opening and the close.</span>'; refreshSummaries(); }
  function setCol(k, v){ if (!v || brandTouched['col-' + k]) return; $('#f-col-' + k).value = v; $('#hex-' + k).textContent = v; }
  ['brand','accent','ground','ink'].forEach(function(k){ var el = $('#f-col-' + k); el.addEventListener('input', function(){ brandTouched['col-' + k] = true; $('#hex-' + k).textContent = el.value; }); });
  // the font pickers: the site's own font first, then the open fonts the video can use, each in its own face
  var OPEN_FONTS = ${JSON.stringify(fonts.map((f) => f.family))};
  var siteFont = { display: '', body: '' };
  function isOpen(name){ return OPEN_FONTS.some(function(f){ return f.toLowerCase() === String(name || '').toLowerCase(); }); }
  function closest(name){ var n = String(name || '').toLowerCase(); if (/serif|georgia|times|garamond|baskerville/.test(n) && !/sans/.test(n)) return isOpen('Source Serif 4') ? 'Source Serif 4' : 'Inter'; if (/mono|code|courier/.test(n)) return isOpen('JetBrains Mono') ? 'JetBrains Mono' : 'Inter'; return 'Inter'; }
  function fontSet(k, v, touched){
    var input = $('#f-font-' + k), pick = $('.fpick[data-font="' + k + '"]'); if (!input || !pick) return;
    input.value = v || '';
    if (touched) brandTouched['font-' + k] = true;
    var name = pick.querySelector('.fpname'); name.textContent = v || 'Pick a font';
    name.style.fontFamily = v && isOpen(v) ? '"fp-' + v + '", system-ui, sans-serif' : '';
    pick.querySelector('.fpnote').textContent = v && !isOpen(v) ? v + ' is not an open font, so the video uses ' + closest(v) + ', the closest one.' : '';
    refreshSummaries();
  }
  $$('.fpick').forEach(function(pick){
    var k = pick.getAttribute('data-font'), btn = pick.querySelector('.fpbtn'), panel = pick.querySelector('.fppanel'), list = pick.querySelector('.fplist'), q = pick.querySelector('.fpsearch');
    function draw(){
      var term = q.value.trim().toLowerCase(), cur = $('#f-font-' + k).value, rows = [];
      if (siteFont[k] && (!term || siteFont[k].toLowerCase().indexOf(term) >= 0)) rows.push({ f: siteFont[k], tag: 'From your site' });
      if (cur && cur !== siteFont[k] && !isOpen(cur) && (!term || cur.toLowerCase().indexOf(term) >= 0)) rows.unshift({ f: cur, tag: 'Current' });
      OPEN_FONTS.forEach(function(f){ if (f !== siteFont[k] && (!term || f.toLowerCase().indexOf(term) >= 0)) rows.push({ f: f, tag: '' }); });
      list.innerHTML = '';
      rows.forEach(function(r){ var b = document.createElement('button'); b.type = 'button'; b.className = 'fpopt' + (r.f === cur ? ' on' : ''); b.setAttribute('role', 'option'); b.setAttribute('aria-selected', r.f === cur ? 'true' : 'false');
        var s = document.createElement('span'); s.textContent = r.f; if (isOpen(r.f)) s.style.fontFamily = '"fp-' + r.f + '", system-ui, sans-serif'; b.appendChild(s);
        if (r.tag) { var t = document.createElement('small'); t.textContent = r.tag; b.appendChild(t); }
        b.addEventListener('click', function(){ fontSet(k, r.f, true); close(); btn.focus(); }); list.appendChild(b); });
      if (!rows.length) list.innerHTML = '<div class="small muted" style="padding:8px">No font by that name. The video uses open fonts only.</div>';
    }
    function open(){ panel.hidden = false; btn.setAttribute('aria-expanded', 'true'); q.value = ''; draw(); q.focus(); }
    function close(){ panel.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
    btn.addEventListener('click', function(){ panel.hidden ? open() : close(); });
    q.addEventListener('input', draw);
    pick.addEventListener('keydown', function(ev){ if (ev.key === 'Escape') { close(); btn.focus(); } });
    document.addEventListener('click', function(ev){ if (!pick.contains(ev.target)) close(); });
  });
  // D-113: the pictures from the site (collected by the brand read), ticked to use as product UI
  var PIC_KIND = { ui: 'Product UI', illustration: 'Illustration', picture: 'Picture' };
  function loadPics(){
    if (window.__SAMPLE__ || location.protocol !== 'http:') return;
    fetch('/api/pictures', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){
      var list = (j && j.pictures) || [], grid = $('#pic-grid'), box = $('#site-pics'); if (!grid) return;
      box.hidden = !list.length; grid.innerHTML = '';
      var boxes = [];
      function save(k, on){ var p = list[k]; p.use = on; boxes[k].checked = on; boxes[k].closest('.ptile').classList.toggle('on', on); fetch('/api/pictures', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: p.id, use: on }) }); }
      function view(k){ if (window.udPicView) window.udPicView.open(list.map(function(p){ return { src: '/site-picture/' + p.id + '.png', label: PIC_KIND[p.kind] || 'Picture', alt: p.alt || '', use: !!p.use }; }), k, save); }
      list.forEach(function(p, k){
        var l = document.createElement('div'); l.className = 'ptile' + (p.use ? ' on' : '');
        var v = document.createElement('button'); v.type = 'button'; v.className = 'pview'; v.title = 'See it large'; v.setAttribute('aria-label', 'See ' + (PIC_KIND[p.kind] || 'the picture') + ' large');
        var i = document.createElement('img'); i.src = '/site-picture/' + p.id + '.png'; i.alt = p.alt || PIC_KIND[p.kind] || 'Picture'; i.loading = 'lazy';
        v.appendChild(i); v.addEventListener('click', function(){ view(k); });
        var lab = document.createElement('label'); lab.className = 'pcheck';
        var c = document.createElement('input'); c.type = 'checkbox'; c.checked = !!p.use; boxes.push(c);
        c.addEventListener('change', function(){ save(k, c.checked); });
        var t = document.createElement('span'); t.textContent = PIC_KIND[p.kind] || 'Picture';
        lab.appendChild(c); lab.appendChild(t); l.appendChild(v); l.appendChild(lab); grid.appendChild(l);
      });
      // more of your own: the Screenshots option and its upload field (the file picker opens at once)
      var more = document.createElement('button'); more.type = 'button'; more.className = 'ptile padd'; more.innerHTML = '<b>+</b><span>More screenshots</span>';
      more.addEventListener('click', function(){
        var sc = document.querySelector('input[name="screens"][value="screenshots"]');
        if (sc && !sc.checked) { sc.checked = true; sc.dispatchEvent(new Event('change', { bubbles: true })); }
        var up = $('#screens-upload'); if (up) { up.hidden = false; up.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
        var f = $('#f-screen-files'); if (f) f.click();
      });
      grid.appendChild(more);
    }).catch(function(){});
  }
  loadPics();
  function readBrand(url){
    if (window.__SAMPLE__) return;
    var st = $('#brand-status'); st.innerHTML = '<span class="spin-sm" aria-hidden="true"></span> Reading your logo, colours and fonts… (about 20 seconds)';
    fetch('/api/brand-read', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify({ url: url }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j.ok) { st.textContent = (j.error || 'Could not read the brand.') + ' Upload your logo and set the colours by hand.'; return; }
        var b = j.brand;
        if (!savedBrandUsed && (!$('#f-logo').value || $('#f-logo').value.indexOf('-own') < 0)) setLogo(b.logo, 'site');
        Object.keys(b.colors || {}).forEach(function(k){ setCol(k, b.colors[k]); });
        ['display','body'].forEach(function(k){ if (b.fonts && b.fonts[k]) siteFont[k] = b.fonts[k]; if (!brandTouched['font-' + k] && b.fonts && b.fonts[k]) fontSet(k, b.fonts[k]); });
        st.textContent = b.logo ? 'Found your logo, colours and fonts. Check them; change anything that is off.' : 'Found your colours and fonts, but no logo on the home page. Upload your logo below.';
        loadPics();
        refreshSummaries();
      })
      .catch(function(){ st.textContent = 'Could not reach the page server.'; });
  }
  var logoFile = $('#f-logo-file');
  logoFile.addEventListener('change', function(){
    var file = logoFile.files && logoFile.files[0]; if (!file) return; var st = $('#logo-status');
    if (location.protocol === 'file:') { st.textContent = 'Static preview: nothing is uploaded.'; return; }
    st.textContent = 'Uploading ' + file.name + '…';
    fetch('/api/logo-upload?name=' + encodeURIComponent(file.name), { method: 'POST', body: file }).then(function(r){ return r.json(); })
      .then(function(j){ if (j.ok) { setLogo(j.path, 'own'); st.textContent = 'Using your logo.'; } else st.textContent = j.error || 'That file could not be used.'; })
      .catch(function(){ st.textContent = 'The upload did not reach the page server.'; });
  });

  // ---- gather the brief
  function gather(){
    var unsure = {};
    function mark(field, hint){ unsure[field] = hint || ''; }
    function tx(field){ var el = $('#f-'+field); var v = el ? el.value.trim() : ''; if (isUnsure(field)) { mark(field, v); return ''; } return v; }
    var b = {
      url: $('#f-url').value.trim(),
      product: tx('product'), viewer: tx('viewer'), claim: tx('claim'), pain_point: tx('pain_point'), proof_moment: tx('proof_moment'), cta: tx('cta'),
      video_type: radio('video_type') || 'unsure', scope: radio('scope') || 'product', feature: $('#f-feature').value.trim(),
      tutorial: radio('video_type') === 'tutorial' ? { kind: radio('tut_kind') || '', area: $('#f-tut-area').value.trim(), goal: $('#f-tut-goal').value.trim(), start: $('#f-tut-start').value.trim(), end: $('#f-tut-end').value.trim(), prerequisites: $('#f-tut-pre').value.trim(), understand: $('#f-tut-understand').value.trim(), steps: $('#f-tut-steps').value, leave_out: $('#f-tut-leave').value.trim(), docs: $('#f-tut-docs').value.trim(), opening: radio('tut_opening') || '', closing: radio('tut_closing') || '' } : null,
      motion_between: radio('video_type') === 'tutorial' || radio('video_type') === 'explainer' ? (radio('motion_between') || 'minimal') : '',
      template: radio('video_type') && radio('video_type') !== 'unsure' ? '' : 'unsure',
      exact: { tagline: $('#f-tagline').value.trim(), lines: $('#f-exact_lines').value },
      effects: radio('effects') || 'lively',
      notes: $('#f-notes').value.trim(),
      cover: $('#f-cover').value.trim(),
      purpose: { chips: purposeChips(), text: $('#f-purpose_text').value.trim() },
      overview: (function(){
        var segs = [];
        Array.prototype.forEach.call($('#overview').childNodes, function(n){ var t = n.textContent; if (!t) return; segs.push({ text: t, field: n.nodeType === 1 && n.tagName === 'MARK' ? n.getAttribute('data-field') : null }); });
        var sources = {}; $$('.field[data-from]').forEach(function(w){ sources[w.getAttribute('data-field')] = w.getAttribute('data-from'); });
        return { segments: segs, sources: sources, drafted: drafted };
      })(),
      queue: queueIdeas(),
      saved_brand: radio('saved_brand') || '',
      length_fit: radio('length_fit') || 'about',
      formats: radio('formats') || '',
      caption_style: radio('narration') === 'music-only' ? 'none' : (radio('caption_style') || 'none'),
      cut: radio('cut') || '',
      brand: { logo: $('#f-logo').value, colors: { brand: $('#f-col-brand').value, accent: $('#f-col-accent').value, ground: $('#f-col-ground').value, ink: $('#f-col-ink').value }, fonts: { display: $('#f-font-display').value.trim(), body: $('#f-font-body').value.trim() } },
      length_s: isUnsure('length_s') ? null : (lengthEl.value === '' ? null : Number(lengthEl.value)),
      narration: radio('narration') || 'unsure',
      voice: (function(){ var r = $('#voice-cards input[name="voice_id"]:checked'); return { preference: radio('voice') || 'none', id: r ? r.value : '', source: r && r.getAttribute('data-paid') === '1' ? 'own-account' : 'built-in' }; })(),
      music: radio('music') === 'own' ? { file: null, own: { path: $('#f-own-path').value, title: $('#f-own-title').value, licensed: $('#f-own-licence').checked } } : { file: radio('music') && radio('music') !== 'auto' ? radio('music') : null },
      tone: radio('tone') || 'unsure',
      autonomy: radio('autonomy') || 'unsure',
      look: { words: look.value.trim(), chips: $$('#look-chips .chip.on').map(function(c){ return c.getAttribute('data-chip'); }) },
      footage: { have: radio('footage') || 'none', files: $('textarea[name="footage_files"]').value, links: [$('input[name="footage_link_1"]').value.trim(), $('input[name="footage_link_2"]').value.trim()].filter(Boolean).join('\\n'), youtube: radio('footage_yt') || 'own-file', downloaded: $('textarea[name="footage_downloaded"]').value },
      screens: { from: $$('input[name="screens"]:checked').map(function(c){ return c.value; }), uploads: screenUploads, figma_url: $('#f-figma').value.trim() },
      local: { on: localOn() || codeOn(), folder: $('#f-local-folder').value.trim(), command: localOn() ? $('#f-local-command').value.trim() : '', address: localOn() ? localAddr() : '', wants: localOn() ? $('#f-local-wants').value.trim() : '' },
      site_mode: radio('site_mode') || 'public',
      sign_in: { path: radio('sign_in') || 'unsure', token_note: $('input[name="token_note"]').value.trim(), browser: browser },
      reference: $('#f-reference').value.trim(),
      product_type: radio('product_type') || 'unsure',
      surfaces: surfaces(),
      started_from: startedFrom,
      title: $('#f-title') ? $('#f-title').value.trim() : '',
      project_name: tx('project_name'),
      site: siteRead ? { title: siteRead.title, description: siteRead.description, headings: siteRead.headings } : null,
      unsure: unsure
    };
    if (isUnsure('length_s')) mark('length_s', lengthEl.value);
    if (isUnsure('look')) mark('look', look.value.trim());
    if (b.video_type === 'unsure') mark('template');
    if (b.narration === 'unsure') mark('narration');
    if (b.tone === 'unsure') mark('register');
    if (b.autonomy === 'unsure') mark('autonomy');
    if (b.footage.have === 'unsure') mark('footage');
    if (b.sign_in.path === 'unsure') mark('sign_in');
    if (b.product_type === 'unsure') mark('product_type');
    return b;
  }

  // ---- a saved brand: fills the kit and the story (never the video's own choices: type, length, sound)
  var savedBrandUsed = false;
  function applyBrand(b){
    savedBrandUsed = true;
    function set(id, v){ var el = $('#f-' + id); if (el && v) { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); } }
    set('url', b.url); set('product', b.product);
    ['viewer', 'claim', 'pain_point', 'proof_moment', 'cta'].forEach(function(k){ set(k, b[k]); });
    if (b.exact) { if (b.exact.tagline) $('#f-tagline').value = b.exact.tagline; if ((b.exact.lines || []).length) $('#f-exact_lines').value = b.exact.lines.join('\\n'); }
    if (b.product_type) setRadio('product_type', b.product_type);
    if (b.tone) setRadio('tone', b.tone);
    if (b.voice) { if (b.voice.preference) setRadio('voice', b.voice.preference); if (b.voice.id) setRadio('voice_id', b.voice.id); }
    var k = b.brand || {};
    if (k.logo) setLogo(k.logo, k.logo.indexOf('-own') >= 0 ? 'own' : 'site');
    Object.keys(k.colors || {}).forEach(function(c){ var el = $('#f-col-' + c); if (!el) return; el.value = k.colors[c]; $('#hex-' + c).textContent = k.colors[c]; brandTouched['col-' + c] = true; });
    ['display', 'body'].forEach(function(f){ if (k.fonts && k.fonts[f]) fontSet(f, k.fonts[f], true); });
    $('#brand-status').textContent = 'From your saved brand ' + b.name + '. Change anything for this video; saving the brief asks before it updates the brand.';
    updateClaim(); proposeName(); refreshSummaries();
  }
  var brandPick = $('#brand-pick');
  function useBrand(slug){
      var st = $('#saved-brand-status');
      if (!slug) { st.textContent = savedBrandUsed ? 'A new brand: the fields filled from the saved one stay until you change them; Read my site fills the brand from the address.' : ''; return; }
      st.textContent = 'Filling the brief…';
      fetch('/api/brand-use', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: slug }) })
        .then(function(r){ return r.json(); })
        .then(function(j){ if (!j.ok) { st.textContent = j.error || 'Could not use that brand.'; return; } applyBrand(j.brand); st.textContent = 'Filled from ' + j.brand.name + ': the brand and the story. Everything stays editable.'; })
        .catch(function(){ st.textContent = 'Could not reach the page server.'; });
  }
  if (brandPick) {
    $$('input[name="saved_brand"]', brandPick).forEach(function(r){ r.addEventListener('change', function(ev){ if (ev.isTrusted && r.checked) useBrand(r.value); }); });
    // a new video started from the Delivery card arrives with its brand (?brand=slug) and starts from it
    var qb = new URLSearchParams(location.search).get('brand');
    var qr = qb && $('input[name="saved_brand"][value="' + qb.replace(/[^a-z0-9-]/gi, '') + '"]', brandPick);
    if (qr && !window.__PREFILL__) { qr.checked = true; useBrand(qb); }
    // typing the address of a saved brand points at it (it is not applied until picked)
    $('#f-url').addEventListener('change', function(){
      if (savedBrandUsed) return;
      var d = ''; try { d = new URL($('#f-url').value).hostname.replace(/^www\\./, ''); } catch (err) {}
      var r = d && $$('input[name="saved_brand"]', brandPick).find(function(o){ return o.getAttribute('data-domain') === d; });
      if (r) $('#saved-brand-status').innerHTML = 'You have <b>' + r.getAttribute('data-name').replace(/</g, '&lt;') + '</b> saved for this address. Pick it above to start from it.';
    });
  }

  // ---- prefill from an existing plan
  function prefill(v){
    if (!v) return;
    var unsure = (v.intake && v.intake.unsure) || {};
    // a field the user left empty comes back empty, not ticked: only a field they ticked Unsure comes back ticked
    function put(field, value){ var el = $('#f-'+field); if (!el) return; if (value != null && value !== '') el.value = value; var b = $('[data-unsure="'+field+'"]'); var note = unsure[field]; if (b && note != null && !/^Left empty/.test(note)) { b.checked = true; b.dispatchEvent(new Event('change')); b.dataset.fromPlan = '1'; var m = /Hint: (.*?)(?: Proposed by the direction step.*)?$/.exec(note); if (m && el) el.value = m[1]; } }
    put('url', v.url); put('product', v.product); put('viewer', v.viewer); put('claim', v.claim); put('pain_point', v.pain_point); put('proof_moment', v.proof_moment); put('cta', v.cta);
    var itp = v.intake || {};
    setRadio('video_type', itp.video_type || ({ launch: 'launch', ad: 'ad', explainer: 'explainer', 'product-tour': 'explainer', 'feature-focus': 'explainer', 'feature-showcase': 'spotlight' })[v.template] || 'unsure');
    setRadio('scope', itp.scope || (v.template === 'feature-focus' ? 'feature' : 'product'));
    if (itp.feature) $('#f-feature').value = itp.feature;
    if (itp.tutorial) {
      var tu = itp.tutorial;
      setRadio('tut_kind', tu.kind || '');
      [['area', tu.area], ['goal', tu.goal], ['start', tu.start], ['end', tu.end], ['pre', tu.prerequisites], ['understand', tu.understand], ['leave', tu.leave_out], ['docs', tu.docs]].forEach(function(p){ if (p[1]) $('#f-tut-' + p[0]).value = p[1]; });
      if (tu.steps && tu.steps.length) $('#f-tut-steps').value = tu.steps.join('\\n');
      if (tu.opening) { setRadio('tut_opening', tu.opening); tutTouched.opening = true; }
      if (tu.closing) { setRadio('tut_closing', tu.closing); tutTouched.closing = true; }
    }
    if (itp.motion_between) setRadio('motion_between', itp.motion_between);
    if (itp.caption_style) { setRadio('caption_style', itp.caption_style); capTouched = true; }
    if (itp.exact) { $('#f-tagline').value = itp.exact.tagline || ''; $('#f-exact_lines').value = (itp.exact.lines || []).join('\\n'); }
    if (itp.effects) setRadio('effects', itp.effects);
    if (itp.notes) $('#f-notes').value = itp.notes;
    if (itp.cover) $('#f-cover').value = itp.cover;
    if (itp.purpose) { (itp.purpose.chips || []).forEach(function(p){ var c = $('#purpose .chip[data-purpose="' + String(p).replace(/"/g, '') + '"]'); if (c) { c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); } }); if (itp.purpose.text) $('#f-purpose_text').value = itp.purpose.text; }
    // a saved brief opens every step, with or without an overview (the empty paragraph offers the draft)
    if (itp.submitted_at) drafted = true;
    if (itp.overview && Array.isArray(itp.overview.segments) && itp.overview.segments.length) {
      renderOverview(itp.overview.segments); drafted = true;
      Object.keys(itp.overview.sources || {}).forEach(function(f){ setFrom(f, itp.overview.sources[f]); });
      Object.keys(MARK_FIELD).forEach(function(k){ var w = wrapOf(MARK_FIELD[k]), m = $('#overview mark[data-field="' + k + '"]'); if (m && w && w.getAttribute('data-from') === 'check') m.classList.add('check'); });
    }
    if (itp.length_fit) setRadio('length_fit', itp.length_fit);
    if (itp.formats) setRadio('formats', itp.formats.length > 1 ? 'both' : itp.formats[0]);
    if (itp.cut) setRadio('cut', String(itp.cut));
    if (itp.brand) {
      if (itp.brand.logo) setLogo(itp.brand.logo, itp.brand.logo.indexOf('-own') >= 0 ? 'own' : 'site');
      Object.keys(itp.brand.colors || {}).forEach(function(k){ $('#f-col-' + k).value = itp.brand.colors[k]; $('#hex-' + k).textContent = itp.brand.colors[k]; brandTouched['col-' + k] = true; });
      ['display','body'].forEach(function(k){ if (itp.brand.fonts && itp.brand.fonts[k]) fontSet(k, itp.brand.fonts[k], true); });
      $('#brand-status').textContent = 'Saved with the brief. Change anything that is off.';
    }
    if (v.length_s != null) { lengthEl.value = v.length_s; lengthTouched = true; } put('length_s', null);
    var nar = { voice: 'narrated', 'music-only': 'music-only', hybrid: 'both' }; setRadio('narration', nar[v.narration] || 'unsure'); if (nar[v.narration]) narTouched = true;
    if (v.intake && v.intake.voice) { setRadio('voice', v.intake.voice.preference || 'none'); if (v.intake.voice.id) setRadio('voice_id', v.intake.voice.id); }
    var mu = (v.intake && v.intake.music) || {};
    if (mu.own) { setRadio('music', 'own'); $('#f-own-path').value = mu.own.path || ''; $('#f-own-title').value = mu.own.title || ''; $('#f-own-licence').checked = !!mu.own.licensed; $('#own-status').textContent = mu.own.path ? 'Using ' + (mu.own.title || mu.own.path) + '.' : ''; }
    else setRadio('music', mu.file || 'auto');
    setRadio('tone', (v.copy && v.copy.register) || 'unsure');
    setRadio('autonomy', { review: 'user-reviewed', director: 'auto' }[v.autonomy] || 'unsure');
    var it = v.intake || {};
    if (it.site_read === 'none') { setRadio('site_mode', 'none'); if ($('#f-url').value === ((it.local && it.local.address) || '')) $('#f-url').value = ''; siteModeShow(); }
    if (it.local) { $('#f-local-folder').value = it.local.folder || ''; $('#f-local-command').value = it.local.command || ''; $('#f-local-address').value = it.local.address || ''; $('#f-local-wants').value = it.local.wants || ''; }
    setTimeout(localShow, 0);
    if (it.screens) {
      $$('input[name="screens"]').forEach(function(c){ c.checked = (it.screens.from || []).indexOf(c.value) >= 0; });
      screenUploads = (it.screens.uploads || []).slice(); drawScreens();
      if (it.screens.figma_url) $('#f-figma').value = it.screens.figma_url;
      screensBranch();
    }
    if (it.look) { lookFromSaved = true; look.value = it.look.words || ''; (it.look.chips || []).forEach(function(w){ var c = $('#look-chips .chip[data-chip="'+w+'"]'); if (c) c.classList.add('on'); }); } put('look', null);
    if (it.footage) { var fr = $('input[name="footage"][value="' + (it.footage.have || 'none') + '"]'); setRadio('footage', fr && !fr.disabled ? it.footage.have : 'none'); $('textarea[name="footage_files"]').value = (it.footage.files || []).join('\\n'); var fl = it.footage.links || []; $('input[name="footage_link_1"]').value = fl[0] || ''; $('input[name="footage_link_2"]').value = fl[1] || ''; $('textarea[name="footage_downloaded"]').value = (it.footage.downloaded || []).join('\\n'); if (it.footage.youtube) setRadio('footage_yt', it.footage.youtube); }
    if (it.sign_in) { setRadio('sign_in', it.sign_in.path || 'public'); signInTouched = true; $('input[name="token_note"]').value = it.sign_in.token_note || ''; } else if (unsure.sign_in != null) setRadio('sign_in', 'unsure');
    if (v.reference) $('#f-reference').value = v.reference;
    // product type; an older plan that only knew "mobile" maps across
    var pt = it.product_type || (it.mobile === true ? 'mobile-app' : it.mobile === false ? 'web-app' : '');
    setRadio('product_type', pt || (unsure.product_type != null || unsure.mobile != null ? 'unsure' : ''));
    if (Array.isArray(it.surfaces)) setSurfaces(it.surfaces);
    if (it.title && $('#f-title')) $('#f-title').value = it.title;
    // a saved name that is exactly the one Ultrademo proposed keeps following the title; a name the user typed stays
    if (it.project_name) {
      nameEl.value = it.project_name;
      var nm = /^(.*)-(\\d{4}-\\d{2}-\\d{2})$/.exec(it.project_name);
      nameTouched = !(nm && nm[1] === autoName(v.product, it.title || '', it.video_type || v.template));
      if (nm) nameDate = nm[2];
    }
    put('project_name', null);
    if (it.site) showSite(it.site);
    updateClaim();
  }
  prefill(window.__PREFILL__);
  // where this brief started: a Claude chat request, the queue, or the dashboard (saved with the brief)
  var startedFrom = (window.__PREFILL__ && window.__PREFILL__.intake && window.__PREFILL__.intake.started_from) || 'dashboard', startedFromVideo = '';
  // what the user already said in the chat (brief-seed.json, written by the agent): filled in, never marked Unsure
  (function seed(s){
    if (!s || typeof s !== 'object') return;
    ['url', 'product', 'claim', 'viewer', 'pain_point', 'proof_moment', 'cta', 'feature', 'notes'].forEach(function(k){ var el = $('#f-'+k); if (el && typeof s[k] === 'string' && s[k].trim()) el.value = s[k].trim(); });
    ['video_type', 'scope', 'product_type', 'narration'].forEach(function(k){ if (typeof s[k] === 'string' && s[k]) setRadio(k, s[k]); });
    if (typeof s.length_s === 'number' && s.length_s > 0) { lengthEl.value = s.length_s; lengthTouched = true; }
    // D-96/D-97: Start's own fields, and a saved brand to start from
    if (typeof s.cover === 'string') $('#f-cover').value = s.cover.trim();
    if (typeof s.purpose_text === 'string') $('#f-purpose_text').value = s.purpose_text.trim();
    (Array.isArray(s.purpose) ? s.purpose : []).forEach(function(p){ var c = $('#purpose .chip[data-purpose="' + String(p).replace(/"/g, '') + '"]'); if (c) { c.classList.add('on'); c.setAttribute('aria-pressed', 'true'); } });
    if (s.brand) { var br = $('input[name="saved_brand"][value="' + String(s.brand).replace(/[^a-z0-9-]/gi, '') + '"]'); if (br) { br.checked = true; useBrand(br.value); } }
    // an unsaved brand from the brief this video was queued from
    else if (s.brand_data && typeof s.brand_data === 'object') { applyBrand(s.brand_data); $('#brand-status').textContent = 'From the brief this video was queued from (' + (s.brand_data.name || 'this product') + '). Change anything for this video.'; }
    seededFromChat = s.from !== 'queue';
    startedFrom = s.from === 'queue' ? 'queue' : 'chat'; startedFromVideo = s.brand_from || '';
  })(window.__SEED__);
  if (!radio('tone')) setRadio('tone', 'balanced');
  if (!radio('music')) setRadio('music', 'auto');
  if (!radio('autonomy')) setRadio('autonomy', 'user-reviewed');
  if (!radio('narration')) setRadio('narration', 'narrated');
  (function(){ var el = $('#started-from'); if (!el) return; var w = { chat: 'Started from an AI session request', queue: 'Started from the queue' + (startedFromVideo ? ' (after ' + startedFromVideo + ')' : ''), dashboard: 'Started from the dashboard' }[startedFrom]; if (w) { el.textContent = w; el.hidden = false; } })();
  if (!radio('product_type')) setRadio('product_type', 'website');
  typeToSurf();
  if (!radio('footage')) setRadio('footage', 'none');
  if (!radio('formats')) setRadio('formats', 'landscape');
  // Styles and effects start on kinetic type, 3D elements, cinematic and playful (2026-11-13); a saved brief keeps its own
  if (!lookFromSaved && !look.value.trim() && !$$('#look-chips .chip.on').length) ['kinetic type', '3D elements', 'cinematic', 'playful'].forEach(function(w){ var c = $('#look-chips .chip[data-chip="' + w + '"]'); if (c) c.click(); });
  if (!radio('sign_in')) setRadio('sign_in', 'public');
  suggestLength(); proposeName(); footageBranch(); signInBranch(); voiceBranch(); ownBranch(); productTypeBranch(); scopeBranch(); tutorialBranch(); updateClaim();
  buildSteps();

  // ---- save
  var saveBtn = $('#save'), saveStatus = $('#save-status');
  function showProblems(list){
    var box = $('#problems'), ul = $('#problem-list'); ul.innerHTML = '';
    list.forEach(function(p){ var li = document.createElement('li'); li.textContent = (p.what || p) + (p.fix ? ' — ' + p.fix : ''); ul.appendChild(li); });
    box.classList.toggle('on', list.length > 0);
    // open the section that holds the first problem
    var first = list.find(function(p){ return p.field; });
    var wrap = first && $('.field[data-field="' + first.field + '"]');
    if (wrap && wrap.closest('.bstep')) go(stepOfEl(wrap));
    if (list.length) box.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  function submit(keep){
    var b = gather(); if (keep) b.keep_outline = true;
    var local = [];
    if (!b.url && b.site_mode !== 'none') local.push({ what: 'The product address is empty', fix: 'give it, or pick No site to read on Start', field: 'url' });
    if (b.local && b.local.on && !b.local.folder) local.push({ what: 'The code folder is empty', fix: 'give the folder your product\\'s code is in', field: 'screens' });
    if (local.length) { showProblems(local); return; }
    if (window.__SAMPLE__) { showProblems([]); saveStatus.textContent = 'Static preview: nothing is saved. The brief would be: ' + JSON.stringify(b).slice(0, 200) + '…'; return; }
    var keepBtn = $('#save-keep');
    saveBtn.disabled = true; if (keepBtn) keepBtn.disabled = true; saveStatus.textContent = keep ? 'Saving; opening the outline…' : 'Saving…'; saveStatus.classList.remove('bad');
    fetch('/api/submit', { method: 'POST', headers: {'content-type':'application/json'}, body: JSON.stringify(b) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        saveBtn.disabled = false; if (keepBtn) keepBtn.disabled = false;
        if (j.ok) { showProblems([]); window.location.href = j.next || '/saved'; return; }
        saveStatus.textContent = j.error || 'Not saved yet.'; saveStatus.classList.add('bad');
        showProblems(j.problems || [{ what: j.error || 'Not saved' }]);
      })
      .catch(function(){ saveBtn.disabled = false; if (keepBtn) keepBtn.disabled = false; saveStatus.textContent = 'Could not reach the page server.'; saveStatus.classList.add('bad'); });
  }
  saveBtn.addEventListener('click', function(){ submit(false); });
  if ($('#save-keep')) $('#save-keep').addEventListener('click', function(){ submit(true); });
})();
</script>
${PICVIEW}${notesUi('brief')}</body></html>`;
}

// ---------------------------------------------------------------------------
// The confirmation page
// ---------------------------------------------------------------------------

export function renderSavedPage(opts = {}) {
  const { plan, planPath = '', projectDir = '', notes = [], missing = false, brand = null } = opts;
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON}<title>Brief saved · Ultrademo</title><link rel="stylesheet" href="/ui/ui.css"><style>${CSS}</style></head><body><main>`;
  if (missing || !plan?.video) {
    return `${head}<div class="ud-pin">${UD_HEAD}${progressBar('brief')}</div><h1>No brief yet</h1><p class="lead">Nothing has been saved to <span class="mono">${e(folderOrNone(projectDir))}</span>. <a href="/">Back to the brief</a>.</p></main></body></html>`;
  }
  const v = plan.video;
  const it = v.intake ?? {};
  const unsure = it.unsure ?? {};
  const pill = (field) => (field in unsure ? `<span class="pill unsure">${/^Left empty/.test(unsure[field] || '') ? 'Left empty' : 'Unsure'} · the direction step proposes it</span>` : '');
  const val = (field, text) => (field in unsure ? `<span class="muted">—</span>${pill(field)}${hintOf(unsure[field])}` : text);
  const hintOf = (note) => { const m = /Hint: (.*)$/.exec(note || ''); return m ? ` <span class="muted small">your hint: ${e(m[1])}</span>` : ''; };
  const tmpl = TEMPLATE_META.find((t) => t.id === v.template);
  const rows = [
    [LABELS.product, val('product', e(v.product))],
    [LABELS.url, `<a href="${e(v.url)}">${e(v.url)}</a>`],
    ...(it.screens ? [[LABELS.screens, e([
      ...(it.screens.from || []).map((x) => ({ live: 'the live site or app', local: 'the app on this computer', code: 'your product\'s code (read only)', mockups: 'HTML mockups', screenshots: 'screenshots', figma: 'a Figma file' })[x] || x),
    ].join(', ')) + (it.screens.uploads?.length ? `<ul class="small" style="margin:6px 0 0;padding-left:18px">${it.screens.uploads.map((u) => `<li>${u.kind === 'mockup' ? 'Mockup' : 'Screenshot'}: ${e(u.title)}</li>`).join('')}</ul>` : '')]] : []),
    [LABELS.product_type, val('product_type', it.product_type ? e(PRODUCT_TYPE_WORDS[it.product_type] ?? it.product_type) : '<span class="muted">—</span>')],
    [LABELS.viewer, val('viewer', e(v.viewer))],
    [LABELS.claim, val('claim', e(v.claim))],
    [LABELS.pain_point, val('pain_point', e(v.pain_point))],
    [LABELS.proof_moment, val('proof_moment', e(v.proof_moment))],
    [LABELS.cta, val('cta', e(v.cta))],
    [LABELS.video_type, it.video_type ? `${e(VIDEO_TYPE_META.find((t) => t.id === it.video_type)?.name ?? it.video_type)} · ${it.scope === 'feature' ? `one feature${it.feature ? `: ${e(it.feature)}` : ''}` : 'the whole product'}` : val('template', e(tmpl?.name ?? v.template))],
    ...(it.exact && (it.exact.tagline || it.exact.lines?.length) ? [['Exact wording', e([it.exact.tagline, ...(it.exact.lines || [])].filter(Boolean).join(' · '))]] : []),
    ['Effects', e(it.effects || 'lively')],
    [LABELS.length_s, val('length_s', v.length_s != null ? `${e(v.length_s)} seconds` : '<span class="muted">the length of the footage</span>')],
    [LABELS.narration, val('narration', e(NARRATION_WORDS[v.narration] ?? v.narration))],
    ...(it.voice ? [[LABELS.voice, findVoice(it.voice.id) ? `${e(findVoice(it.voice.id).name)} · ${e(VOICE_SOURCE_WORDS[it.voice.source] ?? it.voice.source)}` : `${e(VOICE_WORDS[it.voice.preference] ?? it.voice.preference)} · ${e(VOICE_SOURCE_WORDS[it.voice.source] ?? it.voice.source)}`]] : []),
    ['Music', it.music?.file ? e((musicTracks().find((t) => t.file === it.music.file) || { title: it.music.file }).title) : 'the direction chooses'],
    [LABELS.register, val('register', e(v.copy?.register ?? ''))],
    [LABELS.autonomy, val('autonomy', e(AUTONOMY_WORDS[v.autonomy] ?? v.autonomy))],
    [LABELS.look, val('look', it.look ? `${e(it.look.words || '')}${it.look.chips?.length ? ` <span class="muted small">(${e(it.look.chips.join(', '))})</span>` : ''}` || '<span class="muted">nothing yet</span>' : '')],
    [LABELS.footage, val('footage', it.footage ? `${e(FOOTAGE_WORDS[it.footage.have] ?? it.footage.have)}${it.footage.files?.length ? `<br><span class="small mono">${it.footage.files.map(e).join('<br>')}</span>` : ''}${it.footage.downloaded?.length ? `<br><span class="small mono">${it.footage.downloaded.map(e).join('<br>')}</span>` : ''}${it.footage.links?.length ? `<br><span class="small">${it.footage.links.map(e).join('<br>')}</span>` : ''}` : '')],
    [LABELS.sign_in, val('sign_in', it.sign_in ? `${e(SIGN_IN_WORDS[it.sign_in.path] ?? it.sign_in.path)}${it.sign_in.token_note ? ` <span class="muted small">(${e(it.sign_in.token_note)})</span>` : ''}${it.sign_in.note ? ` <span class="muted small">· ${e(it.sign_in.note)}</span>` : ''}${it.sign_in.browser?.label ? ` <span class="muted small">· filled in from ${e(it.sign_in.browser.label)}</span>` : ''}` : '')],
    [LABELS.reference, val('reference', v.reference ? e(v.reference) : '<span class="muted">none</span>')],
    ...(it.title ? [['Video title', e(it.title)]] : []),
    ...(it.cut ? [['Social cut', `${e(it.cut)} seconds, after the video`]] : []),
    ...(it.formats ? [['Format', e(it.formats.length > 1 ? 'Landscape and vertical' : it.formats[0] === 'vertical' ? 'Vertical (9:16)' : 'Landscape (16:9)')]] : []),
    [LABELS.project_name, val('project_name', `<span class="mono">${e(it.project_name ?? '')}</span>`)],
  ];
  const unsureCount = Object.keys(unsure).length;
  const kept = [];
  if (plan.direction) kept.push('the direction already in the plan');
  if (Array.isArray(plan.scenes) && plan.scenes.length) kept.push(`${plan.scenes.length} scene${plan.scenes.length === 1 ? '' : 's'}`);
  if (v.sources?.length) kept.push(`${v.sources.length} source asset${v.sources.length === 1 ? '' : 's'}`);
  if (v.claims?.length) kept.push(`${v.claims.length} claim${v.claims.length === 1 ? '' : 's'}`);
  const noteRows = notes.map((n) => `<li>${e(n.scene)}: ${e(n.what)} <span class="muted small">${e(n.fix)}</span></li>`).join('');
  return `${head}
<div class="ud-pin">${UD_HEAD}
${progressBar('outline')}</div>
<h1>Brief saved</h1>
${kept.length ? `<p class="lead">Kept untouched: ${e(kept.join(', '))}.</p>` : ''}
<section class="card hero working" id="next-step" aria-live="polite">
  <div class="work-head"><span class="spin" id="spin" aria-hidden="true"></span><div><h2 id="work-title">Ultrademo is writing your outline</h2>
  <p id="next-status">Nothing to do here. The outline page opens in your browser by itself when it is ready, usually in a minute or two.</p></div></div>
  <ol class="work-steps">
    <li data-step="started">Ultrademo picks up the brief</li>
    <li data-step="outline">Writes the outline: the scene moments of your video, in order</li>
    <li data-step="reach">Checks it can reach the screens each scene moment needs</li>
    <li data-step="ready">Opens the outline page</li>
  </ol>
  <div class="nudge" id="nudge" hidden>
    <p><b>Ultrademo has not started yet.</b> Paste this into your AI session:</p>
    <div class="copyrow"><code id="nudge-text">the brief is saved${projectDir ? ` for projects/${e(path.basename(projectDir))}` : ''}</code><button type="button" id="nudge-copy">Copy</button></div>
  </div>
</section>
${brandAsk(brand)}
<details class="card saved-sum"><summary><b>What you saved</b> <span class="muted small">${rows.length} items${unsureCount ? ` · ${unsureCount} left for the direction step to propose` : ''} · ${e(planPath)}</span></summary>
${rows.map(([k, x]) => `<div class="kv"><span>${e(k)}</span><div>${x}</div></div>`).join('')}
<p style="margin-top:14px"><a href="/">Back to the brief</a> to change anything; saving again merges into the same file.</p></details>
${noteRows ? `<details class="card saved-sum"><summary><b>Notes from the full plan check</b> <span class="muted small">these do not block the brief</span></summary><ul>${noteRows}</ul></details>` : ''}
<aside class="info" aria-label="About the next steps"><h3>About the next steps</h3>
<ul>
  <li><b>The outline, next.</b> The scene moments of your video in order: what each one shows, where its screen comes from and about how long it runs. You rename, reorder, add or remove moments, then confirm. If a moment would create or change anything in your product, it is listed there and only done with your say-so.</li>
  <li><b>Then the directions.</b> Ultrademo reads your site and pulls the claims it can cite, marking each as seen in the product, stated on your site, or needing your confirmation.</li>
  ${v.reference ? '<li>It measures the reference video you gave: its pace, cuts and energy become one of the directions.</li>' : ''}
  ${unsureCount ? '<li>It proposes what you left empty or Unsure, with your hints, for you to edit.</li>' : ''}
  <li>The direction page shows two or three directions that differ in idea: a sketch storyboard each, type and colour, pace, music${v.narration === 'music-only' ? '' : ', voice'} and rendered frames, so you pick by eye.</li>
  <li>There you pick one and can edit anything before production: the words, the motion, the type.</li>
</ul></aside>
</main>
<script>
// the loader follows the outline step from the files it writes (/api/progress); the outline page runs on port 4325 (or
// the next free one, from pages.json) once it is ready, and opens on its own. After three minutes with no sign of
// Claude, the copy box shows.
(function(){
  var OUTLINE = 'http://127.0.0.1:4325/', NUDGE_MS = 3 * 60 * 1000, ORDER = ['started', 'outline', 'reach', 'ready'];
  var title = document.getElementById('work-title'), st = document.getElementById('next-status'), nudge = document.getElementById('nudge'), spin = document.getElementById('spin');
  var done = false;
  function mark(state){
    var current = ORDER.findIndex(function(k){ return !state[k]; });
    document.querySelectorAll('.work-steps li').forEach(function(li, i){
      li.className = state[ORDER[i]] ? 'done' : i === current ? 'now' : '';
    });
  }
  function ready(){
    done = true; mark({ started: 1, outline: 1, reach: 1, ready: 1 });
    spin.classList.add('stop'); nudge.hidden = true;
    title.textContent = 'Your outline is ready';
    st.innerHTML = 'Opening the outline page… If nothing happens, <a href="' + OUTLINE + '">open it here</a>.';
    setTimeout(function(){ location.href = OUTLINE; }, 1200);
  }
  function poll(){
    if (done) return;
    fetch('/api/progress', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(p){
      mark(p);
      var waited = Date.now() - (p.saved_at || Date.now());
      nudge.hidden = !!p.started || waited < NUDGE_MS;
      if (p.started) st.textContent = 'Ultrademo is on it. Nothing to do here; the outline page opens by itself when it is ready.';
      if (!p.outline_url) return;
      OUTLINE = p.outline_url;
      return fetch(OUTLINE, { mode: 'no-cors', cache: 'no-store' }).then(ready, function(){});
    }).catch(function(){}).then(function(){ if (!done) setTimeout(poll, 3000); });
  }
  document.getElementById('nudge-copy').addEventListener('click', function(ev){
    var b = ev.currentTarget, t = document.getElementById('nudge-text').textContent;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function(){ b.textContent = 'Copied'; }, function(){ b.textContent = 'Select and copy'; });
    setTimeout(function(){ b.textContent = 'Copy'; }, 2000);
  });
  mark({});
  poll();
})();
// the brand card: save (or update) the brand under the name typed here, or leave it
(function(){
  var card = document.getElementById('brand-ask'); if (!card) return;
  var status = document.getElementById('brand-ask-status'), name = document.getElementById('brand-name');
  var saveBtn = card.querySelector('[data-act="save"]'), skipBtn = card.querySelector('[data-act="skip"]'), saveWord = saveBtn.textContent, skipWord = skipBtn.textContent, clash = null, ct = null;
  // once answered, the card settles: the name as text, one button to change the answer (Edit, or Save it after all)
  var editBtn = document.createElement('button'); editBtn.type = 'button'; editBtn.className = 'quiet'; editBtn.hidden = true; card.insertBefore(editBtn, status);
  var saved = null;  // { name, text } once the brand is saved
  function settle(text, ok){ status.className = 'small bstat ' + (ok ? 'good' : 'bad'); status.textContent = text; }
  function done(text, cls, editWord){
    status.className = 'small ' + cls; status.textContent = text;
    saveBtn.hidden = true; skipBtn.hidden = true; if (name) name.readOnly = true;
    card.classList.add('br-done'); editBtn.textContent = editWord; editBtn.hidden = false;
  }
  function open(word, cancelWord){
    saveBtn.hidden = false; skipBtn.hidden = false; saveBtn.disabled = false; saveWord = word; saveBtn.textContent = word; skipBtn.textContent = cancelWord;
    editBtn.hidden = true; card.classList.remove('br-done'); status.className = 'small muted'; status.textContent = '';
    if (name) { name.readOnly = false; name.focus(); name.select(); }
  }
  editBtn.addEventListener('click', function(){ if (saved) open('Update', 'Cancel'); else open(saveWord, skipWord); });
  skipBtn.addEventListener('click', function(ev){
    // while editing a saved brand, Cancel puts the card back as it was saved
    if (saved) { if (name) name.value = saved.name; clash = null; done(saved.text, 'bstat good', 'Edit'); return; }
    done(ev.currentTarget.getAttribute('data-done'), 'muted', 'Save it after all');
  });
  // a name another saved brand already has: say so, and offer to update that brand (or change the name for a new one)
  function check(){
    clearTimeout(ct);
    ct = setTimeout(function(){
      var n = name ? name.value.trim() : ''; if (!n) return;
      fetch('/api/brand-name?name=' + encodeURIComponent(n), { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){
        if (saveBtn.disabled || saveBtn.hidden) return; // saved (or saving) already: the answer is late
        clash = j.exists ? j : null;
        saveBtn.textContent = clash ? 'Update ' + clash.name : saveWord;
        status.className = clash ? 'small bstat bad' : 'small muted';
        status.textContent = clash ? 'A saved brand named ' + clash.name + ' already exists. Update it with this brief, or change the name to save a new brand.' : '';
      }).catch(function(){});
    }, 250);
  }
  if (name) { name.addEventListener('input', check); check(); }
  card.querySelector('[data-act="save"]').addEventListener('click', function(ev){
    var b = ev.currentTarget, n = name ? name.value.trim() : '';
    if (name && !n) { settle('Give the brand a name first.', false); name.focus(); return; }
    b.disabled = true; b.textContent = 'Saving…';
    fetch('/api/brand-save', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: n, update: Boolean(clash) }) })
      .then(function(r){ return r.json(); })
      .then(function(j){
        if (!j.ok) { b.disabled = false; b.textContent = j.exists ? 'Update ' + j.name : 'Try again'; if (j.exists) clash = j; settle(j.error || 'The brand could not be saved.', false); return; }
        b.disabled = false; clash = null;
        if (name) name.value = j.name;
        saved = { name: j.name, text: '✓ ' + (j.updated ? 'Updated' : 'Saved') + ' as ' + j.name + '. The next brief can start from it.' };
        done(saved.text, 'bstat good', 'Edit');
      })
      .catch(function(){ b.disabled = false; b.textContent = 'Try again'; settle('Could not reach the page server.', false); });
  });
})();
</script>
${notesUi('brief')}</body></html>`;
}

function folderOrNone(p) { return p || '(no project folder)'; }

/** The saved page's brand card: save a new brand, or update the saved one with what this brief changed. */
function brandAsk(b) {
  if (!b || !b.name) return '';
  if (b.status === 'same') return `<p class="small muted">Uses your saved brand ${e(b.name)}, unchanged.</p>`;
  const changed = b.status === 'changed';
  const list = (b.changes || []).join(', ');
  // one compact row: the question, the name, Save and Not now
  return `<section class="card brandrow" id="brand-ask"><div class="br-q"><b>${changed ? `Update your saved brand?` : `Save this brand for the next video?`}</b><span class="small muted">${changed ? `This brief changes ${e(list)}.` : 'Logo, colours, fonts and story; editable per video.'}</span></div>
<label class="br-name"><span class="small muted">Name</span><input type="text" id="brand-name" maxlength="80" value="${e(b.name)}" autocomplete="off" aria-label="Brand name"></label>
<button type="button" data-act="save">${changed ? 'Update' : 'Save'}</button><button type="button" class="quiet" data-act="skip" data-done="${changed ? 'Kept the saved brand as it was.' : 'Not saved. You can save it from the next brief.'}">${changed ? 'Keep it' : 'Not now'}</button>
<p class="small muted" id="brand-ask-status" aria-live="polite"></p></section>`;
}
