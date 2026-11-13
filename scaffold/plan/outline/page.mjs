// page.mjs — the outline page (D-91): the moments in order, editable; what each needs and whether its screen was
// reached; chapters for a long video (D-93); and, when a step changes data, the two confirmations. Confirm sends the
// edited moments and the ticks to /api/confirm.
import { UD_HEAD, progressBar, WORK_CSS } from '../intake/page.mjs';
import { BEATS } from '../schema.mjs';
import { SOURCES, dataChanges, chaptersOf } from './outline.mjs';
import { FAVICON } from '../ui/favicon.mjs';
import { notesUi } from '../notes-ui.mjs';

const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SOURCE_WORDS = { live: 'The product, signed in', mockup: 'An HTML mockup', figma: 'Figma', screenshot: 'A screenshot', site: 'The public site', rebuilt: 'Drawn, no screen' };
const BEAT_WORDS = { hook: 'Opening', step: 'Step', close: 'Closing', cta: 'Call to action', problem: 'Problem', reveal: 'Reveal', proof: 'Proof', breadth: 'Breadth', feature: 'Feature', lifecycle: 'Lifecycle', comparison: 'Comparison', punchline: 'Punchline' };
const STATE = { reached: ['ok', 'Screen reached'], 'not-reached': ['bad', 'Screen not reached'], 'at-capture': ['wait', 'Checked when capturing'], 'not-placed': ['wait', 'Found when capturing'], 'not-needed': ['quiet', 'No screen needed'] };
const SIGN_PATH_WORDS = { 'own-browser': ['Sign-in: through your own browser', 'The screens behind the sign-in are checked when the steps are captured.'], 'dedicated-profile': ['Sign-in: a dedicated profile', 'The screens behind the sign-in are checked when the steps are captured.'], token: ['Sign-in: a token or link', 'The screens behind the sign-in are checked when the steps are captured.'], public: ['Public pages only', 'No sign-in is needed.'] };
const NOFILL = 'autocomplete="off" data-lpignore="true" data-1p-ignore="true" data-bwignore="true" data-form-type="other"';
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

const CSS = `
body{margin:0;background:var(--surface-soft);color:var(--text);font-family:var(--ud-body)}
h1{font-family:var(--ud-display);font-weight:800;font-size:clamp(26px,3.4vw,34px);letter-spacing:-.035em;line-height:1.05;margin:18px 0 6px}
h2{font-family:var(--ud-display);font-weight:800;letter-spacing:-.02em;font-size:20px}
main{max-width:1060px;margin:0 auto;padding:0 20px 120px}
button.primary{font:600 16px var(--ud-body);padding:12px 22px;border-radius:999px;background:var(--action);color:var(--on-action);border:1px solid var(--ink);cursor:pointer;white-space:nowrap;flex:none}
code{font-size:.92em}
.lead{color:var(--muted);max-width:none}
.sum{display:flex;flex-wrap:wrap;gap:10px 22px;margin:14px 0 20px;font-size:14px}
.sum b{font-weight:600}
.signin .si-row{display:flex;gap:16px;align-items:center;justify-content:space-between;width:100%}
.si-fix{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px solid color-mix(in srgb,#d33 25%,transparent)}
#si-msg:empty{display:none}#si-msg{margin-top:8px;font-weight:600}
.signin{display:flex;flex-direction:column;align-items:stretch;gap:0;border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin:0 0 20px;background:var(--surface)}
.signin.bad{border-color:#d33;background:color-mix(in srgb,#d33 6%,var(--surface))}
.signin .si-t b{display:block;font-size:15px;margin-bottom:2px}.signin .si-t span{font-size:14px;color:var(--muted)}
.signin .si-m{display:flex;gap:12px;align-items:center;flex:none;font-size:13px;color:var(--muted);white-space:nowrap}
.chap{margin:26px 0 8px;font-size:13px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);display:flex;justify-content:space-between}
.mom{display:grid;gap:12px;border:1px solid var(--line);border-radius:16px;padding:18px 22px;margin:18px 0;background:var(--surface)}
.mom .mbody{gap:10px}
.mom textarea.what{min-height:64px;resize:vertical}
.chg>summary{cursor:pointer;font-size:13px;color:var(--muted);list-style:none}.chg>summary::before{content:'+ '}.chg[open]>summary::before{content:'– '}.chg[open]>summary{color:var(--text);font-weight:600;margin-bottom:6px}
.mom ::placeholder{font-size:.9em}
.owait{margin:8px 0 18px;background:var(--surface);border:1.5px solid var(--text);border-radius:18px;padding:22px 24px;box-shadow:0 6px 0 var(--text)}.owait h2{font-size:26px;margin:0 0 4px}
.mom.skel{display:grid;gap:10px;padding:20px 22px}.sk{height:14px;border-radius:7px;background:linear-gradient(90deg,var(--line) 0%,color-mix(in srgb,var(--line) 35%,transparent) 50%,var(--line) 100%);background-size:200% 100%;animation:skel 1.4s ease-in-out infinite}.sk-h{height:22px;width:40%}
@keyframes skel{from{background-position:100% 0}to{background-position:-100% 0}}
@media (prefers-reduced-motion:reduce){.sk{animation:none}}
details.notes{border-left:3px solid var(--line);padding:4px 12px;margin:14px 0;font-size:14px;color:var(--muted)}details.notes summary{cursor:pointer;font-weight:600;color:var(--text)}details.notes ul{margin:8px 0 0;padding-left:18px}details.notes li{margin:4px 0}
.mom.change{border-color:#e0a100;box-shadow:inset 4px 0 0 #e0a100}
.mom input[type=text],.mom textarea,.mom select{font:inherit;font-size:14px;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:var(--surface-soft);color:inherit;min-width:0;width:100%;box-sizing:border-box}
.mhead{display:flex;gap:10px;align-items:flex-end}
.mom .f{display:flex;flex-direction:column;gap:4px;min-width:0}.mom .fname{flex:1 1 auto}.mom .fbeat{flex:none;width:150px}
.mom .cap{display:inline-flex;align-items:center;font-size:11.5px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted)}
.hinfo{position:relative;display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;margin-left:6px;border-radius:50%;border:1.5px solid var(--muted,var(--text-muted,#8a8d84));color:var(--muted,var(--text-muted,#8a8d84));font:700 10px/1 Georgia,serif;font-style:italic;letter-spacing:0;text-transform:none;cursor:help;flex:none}
.hinfo:hover,.hinfo:focus-visible{border-color:var(--text,#0c0e09);color:var(--text,#0c0e09);outline:none}
.hinfo .tip{display:none;position:absolute;left:-10px;top:24px;z-index:40;width:max-content;max-width:300px;padding:9px 12px;border-radius:10px;background:var(--text,#0c0e09);color:var(--surface,#fff);font:400 13px/1.45 var(--ud-body,system-ui);font-style:normal;text-align:left;text-transform:none;letter-spacing:0;white-space:normal;box-shadow:0 12px 30px rgba(0,0,0,.18)}
.hinfo:hover .tip,.hinfo:focus .tip{display:block}
.mhead .n{margin-bottom:6px}.mhead .tools{padding-bottom:4px}
.mom .n{flex:none;width:28px;height:28px;border-radius:50%;border:1px solid var(--line);display:grid;place-items:center;font-weight:700;font-size:13px}
.mom input.name{flex:1 1 auto;font-weight:600;font-size:15px;background:transparent}
.mom select.beat{flex:none;width:150px}
.secw{flex:none;position:relative;display:flex;align-items:center;font-size:13px;color:var(--muted)}.mom input.secs{width:86px;padding-right:38px;text-align:right;font-variant-numeric:tabular-nums}.secw .unit{position:absolute;right:11px;pointer-events:none}
.tools{flex:none;display:flex;gap:4px;margin-left:4px}
.mbody{display:grid;gap:14px;padding-left:38px}
.fld{display:grid;gap:6px}
.lbl{font-size:13px;font-weight:500}.lbl i{font-style:normal;font-weight:400;color:var(--muted)}
.mom textarea{min-height:64px;resize:vertical;line-height:1.45}
.srcrow{display:grid;grid-template-columns:220px minmax(0,1fr) auto;gap:10px;align-items:end}.srcrow .chk{padding-bottom:10px}
.chk{display:flex;gap:6px;align-items:center;font-size:13px;white-space:nowrap}
.hint{font-size:12px;color:var(--muted)}
.mfoot{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-left:38px;padding-top:12px;border-top:1px dashed var(--line)}
.mom .shot{width:180px;aspect-ratio:16/10;object-fit:cover;object-position:top;border-radius:8px;border:1px solid var(--line)}
.badge{font-size:12px;padding:3px 10px;border-radius:999px;border:1px solid var(--line);white-space:nowrap}
.badge.ok{border-color:#2f8f4e;color:#2f8f4e}.badge.bad{border-color:#d33;color:#d33}.badge.wait{color:var(--muted)}.badge.quiet{opacity:.6}
.why{font-size:13px;color:var(--muted)}
.tools button,.add{font:inherit;font-size:13px;border:1px solid var(--line);background:transparent;border-radius:8px;padding:5px 10px;cursor:pointer;color:inherit}
.changebox{border:2px solid #e0a100;border-radius:14px;padding:18px 20px;margin:26px 0;background:color-mix(in srgb,#e0a100 7%,var(--surface-soft))}
.changebox ul{margin:10px 0 14px 18px;line-height:1.6}
.changebox.flash{animation:none;box-shadow:0 0 0 6px color-mix(in srgb,#e0a100 35%,transparent);transition:box-shadow .3s}
.changebox{transition:box-shadow .6s}
.changebox label{display:flex;gap:10px;align-items:flex-start;margin:8px 0}
.bar #msg{flex:1 1 auto;min-width:0}
.addrow{display:block;width:100%;margin:4px 0 16px;padding:14px;border:1.5px dashed var(--muted);border-radius:14px;background:var(--surface);font:inherit;font-size:14px;font-weight:600;color:inherit;cursor:pointer}.addrow:hover{border-color:var(--text);border-style:solid}
#olist.locked #moments,#olist.locked .addrow,#olist.locked #changebox{opacity:.5;filter:grayscale(1);pointer-events:none;user-select:none}#olist.locked .bar{display:none}
#next-step .work-head{grid-template-columns:auto 1fr auto}#next-step #unlock{white-space:nowrap}#next-step #unlock[hidden]{display:none}
.bar{position:sticky;bottom:0;display:flex;gap:14px;align-items:center;justify-content:flex-end;padding:14px 0;background:var(--surface-soft);border-top:1px solid var(--line)}
@media (max-width:700px){
  .signin{flex-direction:column;align-items:flex-start}
  .mhead{flex-wrap:wrap}.mom .fname{flex:1 1 100%;order:2}.mom .n{order:1}.mom .fbeat{order:3;flex:1 1 auto;width:auto}.mhead>.f:not(.fname):not(.fbeat){order:4}.tools{order:5;margin-left:auto}
  .mbody,.mfoot{padding-left:0;margin-left:0}
  .srcrow{grid-template-columns:1fr}
  .bar{flex-wrap:wrap}
}
.notes{font-size:14px;border-left:3px solid var(--line);padding:4px 12px;color:var(--muted);margin:12px 0}
.workcard{scroll-margin-top:150px;--fg:var(--text);--muted:var(--text-muted);--card:var(--surface);--pale:var(--surface-highlight);background:var(--surface);border:1.5px solid var(--text);border-radius:var(--radius-flow,22px);padding:20px 22px;margin:16px 0}
${WORK_CSS}
`;

/** The outline page. `outline` is plan.video.intake.outline (with signin results once tested). */
export function renderOutlinePage({ video, outline, waiting = false }) {
  const head = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${FAVICON}<title>Outline · Ultrademo</title>
<link rel="stylesheet" href="/ui/ui.css"><style>${CSS}</style></head><body><main><div class="ud-pin">${UD_HEAD}${progressBar('outline')}</div>`;
  if (waiting || !outline) {
    // the waiting state: the working card (as on the Brief saved page) and placeholder moments that shimmer; the page
    // asks for itself in the background and swaps in the outline when it is there (no reload loop)
    return `${head}<h1>The outline</h1>
<section class="card hero working owait" aria-live="polite"><div class="work-head"><span class="spin" aria-hidden="true"></span><div><h2>Ultrademo is writing your outline</h2><p id="w">The moments of your video, in order, and what each one needs. This page fills in by itself, usually within a minute or two.</p></div></div>
<ol class="work-steps"><li class="done">Your brief is saved</li><li class="now">Writing the scene moments, in order</li><li>Checking it can reach the screens each scene moment needs</li><li>Showing them here</li></ol></section>
${[0.92, 0.78, 0.86].map((w) => `<div class="mom skel" aria-hidden="true"><div class="sk sk-h"></div><div class="sk" style="width:${Math.round(w * 100)}%"></div><div class="sk" style="width:${Math.round(w * 62)}%"></div></div>`).join('')}
</main><script>(function(){
  var t0 = Date.now(), w = document.getElementById('w');
  function poll(){
    fetch(location.href, { cache: 'no-store' }).then(function(r){ return r.text(); }).then(function(h){
      if (h.indexOf('class="card hero working owait"') < 0) { location.reload(); return; }
      var s = Math.round((Date.now() - t0) / 1000);
      if (s >= 20) w.textContent = 'Still writing (' + s + ' s). The scene moments appear here by themselves.' + (s > 180 ? ' If your AI session looks idle, tell it: the brief is saved.' : '');
      setTimeout(poll, 3000);
    }).catch(function(){ setTimeout(poll, 5000); });
  }
  setTimeout(poll, 3000);
})();</script>${notesUi('outline')}</body></html>`;
  }
  const ms = outline.moments || [];
  const results = outline.signin?.results || {};
  const total = ms.reduce((a, m) => a + (m.seconds || 0), 0);
  const changes = dataChanges(outline);
  const chapters = chaptersOf(outline);
  const confirmed = outline.status === 'confirmed';
  const signBad = outline.signin && outline.signin.signed_in === false;
  const tutorial = video.template === 'tutorial';
  const opt = (list, words, v) => list.map((x) => `<option value="${x}"${x === v ? ' selected' : ''}>${e(words[x] || x)}</option>`).join('');
  const card = (m, i) => {
    const r = results[i] || null;
    const [cls, word] = r ? (STATE[r.state] || ['wait', r.state]) : ['wait', outline.signin ? '—' : 'Not tested yet'];
    return `<div class="mom${m.data_change ? ' change' : ''}" data-i="${i}">
<div class="mhead"><span class="n">${i + 1}</span><label class="f fname"><span class="cap">Scene moment<span class="hinfo" tabindex="0" role="img" aria-label="What this scene is about.">i<span class="tip" role="tooltip">What this scene is about.</span></span></span><input type="text" class="name" value="${e(m.name)}" aria-label="Title of this scene moment" ${NOFILL}></label><label class="f fbeat"><span class="cap">Scene role<span class="hinfo" tabindex="0" role="img" aria-label="What this scene covers.">i<span class="tip" role="tooltip">What this scene covers.</span></span></span><select class="beat" aria-label="Scene role">${opt(BEATS, BEAT_WORDS, m.beat)}</select></label><div class="f"><span class="cap">Length<span class="hinfo" tabindex="0" role="img" aria-label="The scene duration.">i<span class="tip" role="tooltip">The scene duration.</span></span></span><label class="secw"><input type="text" class="secs" value="${e(m.seconds)}" aria-label="Seconds" ${NOFILL}><span class="unit">sec</span></label></div><div class="tools"><button type="button" data-act="up" title="Move up">↑</button><button type="button" data-act="down" title="Move down">↓</button><button type="button" data-act="del" title="Remove">✕</button></div></div>
<div class="mbody">
  <label class="f"><span class="cap">Scene content<span class="hinfo" tabindex="0" role="img" aria-label="What shows on the screen.">i<span class="tip" role="tooltip">What shows on the screen.</span></span></span><textarea class="what" placeholder="What happens on screen" aria-label="What happens on screen" ${NOFILL}>${e(m.what)}</textarea></label>
  <div class="srcrow"><label class="f"><span class="cap">Visuals/UI from<span class="hinfo" tabindex="0" role="img" aria-label="How you want to show the product UI in this scene.">i<span class="tip" role="tooltip">How you want to show the product UI in this scene.</span></span></span><select class="source" aria-label="Where its screens come from">${opt(SOURCES, SOURCE_WORDS, m.source)}</select></label><label class="f"><span class="cap">Product page URL<span class="hinfo" tabindex="0" role="img" aria-label="Where the product UI for this scene is taken from.">i<span class="tip" role="tooltip">Where the product UI for this scene is taken from.</span></span></span><input type="text" class="url" value="${e(m.url)}" placeholder="Optional; found at capture" aria-label="The page's address in your product" ${NOFILL}></label><label class="chk"><input type="checkbox" class="sign"${m.sign_in ? ' checked' : ''}> Behind your sign-in</label></div>
  <details class="chg"${m.data_change ? ' open' : ''}><summary>${m.data_change ? 'Creates or changes something in your product' : 'Creates or changes something in your product?'}</summary><input type="text" class="change" value="${e(m.data_change)}" placeholder="e.g. creates a referral for Daniel Ortiz; empty when it only looks" aria-label="What it creates or changes" ${NOFILL}></details>
  ${chapters.length || m.chapter ? `<div class="fld"><span class="lbl">Chapter</span><input type="text" class="chapter" value="${e(m.chapter)}" aria-label="Chapter" ${NOFILL}></div>` : '<input type="hidden" class="chapter" value="">'}
</div>
${r && r.state !== 'not-needed' ? `<div class="mfoot"><span class="badge ${cls}">${e(word)}</span>${r.why ? `<span class="why">${e(r.why[0].toUpperCase() + r.why.slice(1))}.</span>` : ''}${r.shot ? `<img class="shot" src="/shot/${e(r.shot)}" alt="">` : ''}</div>` : ''}
</div>`;
  };
  let body = '', lastChap = null;
  ms.forEach((m, i) => {
    if (m.chapter && m.chapter !== lastChap) { const c = chapters.find((x) => x.name === m.chapter); body += `<div class="chap"><span>${e(m.chapter)}</span><span>${c ? clock(c.seconds) : ''}</span></div>`; lastChap = m.chapter; }
    body += card(m, i);
  });
  const tested = new Date(outline.signin?.tested_at || 0);
  const testedWords = outline.signin ? `Tested ${tested.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${String(tested.getHours()).padStart(2, '0')}:${String(tested.getMinutes()).padStart(2, '0')}` : '';
  const [signTitle, signText] = signBad ? ['The sign-in did not work', `${(outline.signin.why || '').replace(/^./, (c) => c.toUpperCase())}.`]
    : outline.signin?.signed_in ? ['Signed in with the demo account', 'Each screen below shows whether it was reached.']
    : SIGN_PATH_WORDS[outline.signin?.path] || ['Sign-in', ''];
  const demoPath = outline.signin?.path === 'demo-account';
  const signFix = signBad ? `<div class="si-fix">${demoPath ? '<button type="button" class="add" id="env-open">Open the env file</button>' : ''}<button type="button" class="add" data-path="own-browser">Sign in through my own browser instead</button><span class="small muted">${demoPath ? 'Fix the address or the details, then Test again. Or sign in yourself: the screens are checked at capture.' : 'You sign in yourself; the screens are checked at capture.'}</span></div>` : '';
  const signLine = !outline.signin ? '' : `<div class="signin${signBad ? ' bad' : ''}"><div class="si-row"><div class="si-t"><b>${e(signTitle)}</b><span>${e(signText)}</span></div><div class="si-m"><span>${e(testedWords)}</span><button type="button" class="add" id="retest">Test again</button></div></div>${signFix}<div class="small" id="si-msg" aria-live="polite"></div></div>`;
  const changeBox = changes.length ? `<section class="changebox" id="changebox">
<h2 style="margin:0 0 4px">${changes.length} step${changes.length === 1 ? '' : 's'} would change data in your product</h2>
<p class="small" style="margin:0">To show these, Ultrademo would create or change the following in the signed-in account:</p>
<ul>${changes.map((c) => `<li><b>Step ${c.index + 1}, ${e(c.name)}:</b> ${e(c.change)}</li>`).join('')}</ul>
<label><input type="checkbox" id="ok-demo"${outline.data_ok?.demo_account ? ' checked' : ''}> <span><b>This sign-in is a demo or test account.</b> Nothing real is affected.</span></label>
<label><input type="checkbox" id="ok-create"${outline.data_ok?.creates_ok ? ' checked' : ''}> <span><b>Creating these records is okay.</b> Only what is listed above; nothing is deleted or sent.</span></label>
<p class="small muted" style="margin:6px 0 0">Click the checkboxes to allow Ultrademo to follow through the action sequence. Otherwise the steps that need to show data inputs will be illustrated (rebuilt) without actually navigating your app.</p>
</section>` : '';
  return `${head}
<h1>The outline</h1>
<p class="lead">The ${tutorial ? 'steps' : 'scene moments'} of your video, in order: what each one shows and where its screens come from. Rename, reorder, add or remove. This is the plan for the pictures; the narration is written on the next page.</p>
<div class="sum"><span><b>${ms.length}</b> ${ms.length === 1 ? 'scene moment' : 'scene moments'}</span><span>about <b>${clock(total)}</b>${video.length_s ? ` against ${clock(video.length_s)}` : ''}</span>${chapters.length ? `<span><b>${chapters.length}</b> chapters</span>` : ''}${changes.length ? `<span><b>${changes.length}</b> change data</span>` : ''}${confirmed ? '<span><b>Confirmed</b></span>' : ''}</div>
${outline.notes ? `<details class="notes"><summary>Notes from Ultrademo (${outline.notes.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean).length})</summary><ul>${outline.notes.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean).map((x) => `<li>${e(x)}</li>`).join('')}</ul></details>` : ''}
${signLine}
<section class="workcard working" id="next-step" aria-live="polite" hidden>
  <div class="work-head"><span class="spin" id="spin" aria-hidden="true"></span><div><h2 id="work-title" style="margin:0 0 4px">Ultrademo is writing your directions</h2>
  <p id="work-status" style="margin:0">Nothing to do here. The direction page opens in your browser by itself when it is ready, usually in a few minutes. The outline below is locked while it does.</p></div><button type="button" class="add" id="unlock">Edit the outline</button></div>
  <ol class="work-steps">
    <li data-step="started">Ultrademo picks up the outline</li>
    <li data-step="site">Reads your site</li>
    <li data-step="brand">Reads the brand: colours, type and the claims it can cite</li>
    <li data-step="ready">Opens the direction page, where you pick a video style</li>
  </ol>
  <div class="nudge" id="nudge" hidden><p><b>Ultrademo has not started yet.</b> Paste this into your AI session:</p><div class="copyrow"><code id="nudge-text">the outline is confirmed</code><button type="button" id="nudge-copy">Copy</button></div></div>
</section>
<div id="olist"${confirmed ? ' class="locked" inert' : ''}>
<div id="moments">${body}</div>
<button type="button" class="addrow" id="add">+ Add a scene moment</button>
${changeBox}
<div class="bar"><span class="small muted" id="msg" aria-live="polite"></span><button type="button" class="primary" id="confirm">${confirmed ? 'Confirm the changes' : 'Confirm the outline'}</button></div>
</div>
</main>
<script>
(function(){
  var $ = function(s, r){ return (r || document).querySelector(s); }, $$ = function(s, r){ return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var box = $('#moments');
  function renumber(){ $$('.mom', box).forEach(function(m, i){ $('.n', m).textContent = i + 1; }); }
  box.addEventListener('click', function(ev){
    var b = ev.target.closest('button[data-act]'); if (!b) return;
    var m = b.closest('.mom'), act = b.getAttribute('data-act');
    if (act === 'up' && m.previousElementSibling && m.previousElementSibling.classList.contains('mom')) box.insertBefore(m, m.previousElementSibling);
    if (act === 'down' && m.nextElementSibling) box.insertBefore(m.nextElementSibling, m);
    if (act === 'del' && $$('.mom', box).length > 1) m.remove();
    renumber();
  });
  $('#add').addEventListener('click', function(){
    var last = $$('.mom', box).pop(); var c = last.cloneNode(true);
    $('.name', c).value = 'New scene moment'; $('.what', c).value = ''; $('.url', c).value = ''; $('.change', c).value = ''; $('.sign', c).checked = false;
    // a new moment has not been tested: no status row (the last card may have none to copy, a drawn one never does)
    var f = $('.mfoot', c); if (f) f.remove();
    var d = $('details.chg', c); if (d) { d.open = false; $('summary', d).textContent = 'Creates or changes something in your product?'; }
    c.classList.remove('change'); box.appendChild(c); renumber();
    c.scrollIntoView({ behavior: 'smooth', block: 'center' }); $('.name', c).focus({ preventScroll: true }); $('.name', c).select();
  });
  box.addEventListener('input', function(ev){ if (ev.target.classList.contains('change')) ev.target.closest('.mom').classList.toggle('change', !!ev.target.value.trim()); });
  function moments(){ return $$('.mom', box).map(function(m){ return { name: $('.name', m).value, beat: $('.beat', m).value, what: $('.what', m).value, source: $('.source', m).value, url: $('.url', m).value, sign_in: $('.sign', m).checked, data_change: $('.change', m).value, seconds: Number($('.secs', m).value), chapter: $('.chapter', m).value }; }); }
  var msg = $('#msg'), warned = false;
  // the ticks change what Confirm does: both ticked, the steps are followed through; otherwise they are rebuilt
  var confirmWord = $('#confirm').textContent;
  function ticksChanged(){
    var both = $('#ok-demo') && $('#ok-demo').checked && $('#ok-create') && $('#ok-create').checked;
    if (both) { warned = false; msg.textContent = ''; $('#confirm').textContent = confirmWord; }
    else if (warned) $('#confirm').textContent = 'Confirm without them';
  }
  ['#ok-demo', '#ok-create'].forEach(function(s){ var c = $(s); if (c) c.addEventListener('change', ticksChanged); });
  $('#confirm').addEventListener('click', function(){
    var body = { moments: moments(), demo_account: $('#ok-demo') ? $('#ok-demo').checked : false, creates_ok: $('#ok-create') ? $('#ok-create').checked : false };
    var changes = body.moments.filter(function(m){ return m.data_change.trim(); }).length;
    // without both ticks, say what happens and ask for a second click (no pop-up)
    if (changes && !(body.demo_account && body.creates_ok) && !warned) {
      warned = true;
      msg.textContent = 'Click the checkboxes to allow Ultrademo to follow through the action sequence. Otherwise the steps that need to show data inputs will be illustrated (rebuilt) without actually navigating your app.';
      $('#confirm').textContent = 'Confirm without them';
      // take them to the checkboxes
      var cb = $('#changebox');
      if (cb) { cb.scrollIntoView({ behavior: 'smooth', block: 'center' }); cb.classList.add('flash'); setTimeout(function(){ cb.classList.remove('flash'); }, 1600); var first = $('#ok-demo'); if (first && !first.checked) setTimeout(function(){ first.focus({ preventScroll: true }); }, 450); }
      return;
    }
    msg.textContent = 'Saving…';
    fetch('/api/confirm', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(function(r){ return r.json(); }).then(function(r){
      msg.textContent = r.ok ? '' : (r.problems || [r.error]).join(' ');
      if (r.ok) { edited = false; lock(true); $('#confirm').textContent = 'Confirm the changes'; restart(); follow(true); }
    }).catch(function(){ msg.textContent = 'Could not save: is the outline page still running?'; });
  });
  // after Confirm: a card at the top follows the direction step from the files it writes (/api/progress) and links the
  // direction page when it is up; after three minutes with no sign of Claude, the copy box shows
  var following = false, edited = false, ORDER = ['started', 'site', 'brand', 'ready'];
  // a confirmed outline is locked (greyed, not editable); Edit the outline opens it again, with Confirm the changes
  function lock(on){ var o = $('#olist'); o.classList.toggle('locked', on); o.inert = on; $('#unlock').hidden = !on; }
  $('#unlock').addEventListener('click', function(){ lock(false); $('#work-status').textContent = 'You are editing the outline. Ultrademo carries on from the outline as it was until you press Confirm the changes; then it writes the directions again.'; $('#moments').scrollIntoView({ behavior: 'smooth', block: 'start' }); var f = $('#moments .name'); if (f) setTimeout(function(){ f.focus({ preventScroll: true }); }, 400); });
  box.addEventListener('input', function(){ if (following) edited = true; });
  // a second Confirm: the directions are written again, so the card starts over (the poll reads the new confirm time)
  var pollGen = 0;
  function restart(){
    if (!following) return;
    following = false; $('#spin').classList.remove('stop'); $('#work-title').textContent = 'Ultrademo is writing your directions';
    $('#work-status').textContent = 'Your changes are confirmed. Ultrademo writes the directions again from this outline; the direction page opens by itself when they are ready.';
    $$('#next-step .work-steps li').forEach(function(li){ li.className = ''; });
  }
  function follow(scroll){
    var card = $('#next-step'); card.hidden = false;
    if (scroll) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (following) return; following = true;
    var my = ++pollGen;  // a second Confirm starts a new poll; the old one stops
    // the tab moves on by itself only when this page saw the directions get written (after Confirm here, or while it
    // was open); an outline opened later, to look at it, stays put with a link
    var watched = !!scroll;
    (function poll(){
      fetch('/api/progress', { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(p){
        if (my !== pollGen) return true;
        var editingNow = !$('#olist').classList.contains('locked');
        var state = { started: p.started, site: p.site, brand: p.brand, ready: !!p.direction_url };
        var cur = ORDER.findIndex(function(k){ return !state[k]; });
        $$('#next-step .work-steps li').forEach(function(li, i){ li.className = state[ORDER[i]] ? 'done' : i === cur ? 'now' : ''; });
        $('#nudge').hidden = !!p.started || Date.now() - (p.confirmed_at || Date.now()) < 3 * 60 * 1000;
        if (p.started && !editingNow) $('#work-status').textContent = 'Ultrademo is on it. Nothing to do here; the direction page opens by itself when it is ready.';
        if (p.direction_url) {
          $('#spin').classList.add('stop'); $('#work-title').textContent = 'The direction page is ready';
          // moves this tab on, unless the outline was changed after Confirm (those edits stay on screen)
          if (!watched) { $('#work-title').textContent = 'The directions are written'; $('#work-status').innerHTML = '<a href="' + p.direction_url + '">Open the direction page</a>'; }
          else if (!edited && !editingNow) { $('#work-status').innerHTML = 'Opening it… If nothing happens, <a href="' + p.direction_url + '">open it here</a>.'; setTimeout(function(){ location.href = p.direction_url; }, 1200); }
          else $('#work-status').innerHTML = '<a href="' + p.direction_url + '">Go to the direction page</a> (you changed the outline: press Confirm the changes first to keep it).';
          return true;
        }
        watched = true;
      }).catch(function(){}).then(function(stop){ if (!stop) setTimeout(poll, 3000); });
    })();
  }
  $('#nudge-copy').addEventListener('click', function(ev){ var b = ev.currentTarget; (navigator.clipboard ? navigator.clipboard.writeText('the outline is confirmed') : Promise.reject()).then(function(){ b.textContent = 'Copied'; }, function(){ b.textContent = 'Select and copy'; }); setTimeout(function(){ b.textContent = 'Copy'; }, 2000); });
  if (${confirmed ? 'true' : 'false'}) follow(false);
  var siMsg = $('#si-msg');
  function siPost(url, body, busy){
    if (siMsg) siMsg.textContent = busy;
    return fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body || {}) }).then(function(r){ return r.json(); }).catch(function(){ return { ok: false, error: 'Could not reach the page server.' }; });
  }
  var rt = $('#retest'); if (rt) rt.addEventListener('click', function(){ rt.disabled = true; siPost('/api/retest', {}, 'Testing the sign-in… (up to a minute)').then(function(r){ if (r.ok) location.reload(); else { rt.disabled = false; siMsg.textContent = r.error || 'The test did not run.'; } }); });
  var eo = $('#env-open'); if (eo) eo.addEventListener('click', function(){ siPost('/api/env-open', {}, 'Opening the env file…').then(function(r){ siMsg.textContent = r.ok ? 'Opened ' + r.path + '. Check DEMO_SIGNIN_URL is the page with the sign-in form, save the file, then press Test again.' : (r.error || 'Could not open the file.'); }); });
  document.querySelectorAll('.si-fix [data-path]').forEach(function(b){ b.addEventListener('click', function(){ b.disabled = true; siPost('/api/sign-in-path', { path: b.getAttribute('data-path') }, 'Switching the sign-in…').then(function(r){ if (r.ok) location.reload(); else { b.disabled = false; siMsg.textContent = r.error || 'Could not switch.'; } }); }); });
})();
</script>${notesUi('outline')}</body></html>`;
}
