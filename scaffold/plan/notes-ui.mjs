// notes-ui.mjs — the Notes tab and drawer every page shows (D-101), and, on a page of an earlier step, the banner that
// says where the video really is. Also makes the step bar reopen an earlier step whose page is not running.
//   notesUi(stage, { api }) → HTML (style, markup, script) to put at the end of <body>.
//   stage: the page's step ('brief' … 'delivery'), or null on the dashboard; api: the notes address (the dashboard
//   passes /api/notes?project=<name>; it opens the drawer itself through window.udNotes.open()).
const STAGE_NAMES = { brief: 'brief', outline: 'outline', direction: 'direction', production: 'production', review: 'review', delivery: 'delivery' };
const ORDER = ['brief', 'outline', 'direction', 'production', 'review', 'delivery'];

export function notesUi(stage = null, { api = '/api/notes', tab = true, banner = true } = {}) {
  const cfg = JSON.stringify({ stage, api, order: ORDER, names: STAGE_NAMES, tab, banner });
  return `<style>
.udn-tab{position:fixed;right:0;top:44%;z-index:60;writing-mode:vertical-rl;transform:rotate(180deg);display:flex;align-items:center;gap:8px;padding:16px 10px;border:0;border-radius:0 12px 12px 0;background:var(--text,#0c0e09);color:var(--surface,#fff);font:600 14px var(--ud-body,system-ui);cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.18);transition:right .25s ease}
.udn-tab b{display:inline-grid;place-items:center;min-width:22px;height:22px;padding:0 4px;border-radius:999px;background:var(--action,#dffe02);color:#0c0e09;font-size:12px;writing-mode:horizontal-tb;transform:rotate(180deg)}
.udn-open .udn-tab{right:min(420px,92vw)}
.udn-tab[hidden]{display:none}
.udn-drawer{position:fixed;right:0;top:0;bottom:0;z-index:61;width:min(420px,92vw);display:flex;flex-direction:column;background:var(--surface,#fff);color:var(--text,#0c0e09);border-left:1px solid var(--line,#ddd);box-shadow:-18px 0 50px rgba(0,0,0,.14);transform:translateX(105%);transition:transform .25s ease;font-family:var(--ud-body,system-ui)}
.udn-open .udn-drawer{transform:none}
/* on a wide screen the page makes room for the open drawer instead of sliding under it */
@media (min-width:1200px){body.udn-open main{margin-right:440px;margin-left:max(20px,calc((100vw - 440px - 1060px) / 2));transition:margin .25s ease}}
.udn-head{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:20px 22px 12px;border-bottom:1px solid var(--line,#ddd)}
.udn-head h2{margin:0;font:800 22px var(--ud-display,system-ui);letter-spacing:-.02em}.udn-head p{margin:4px 0 0;font-size:13.5px;color:var(--text-muted,#555)}
.udn-x{all:unset;cursor:pointer;width:34px;height:34px;min-height:0 !important;max-height:34px;aspect-ratio:1/1;flex:none;box-sizing:border-box;padding:0 !important;display:grid;place-items:center;border:1px solid var(--line,#ddd);border-radius:50%;font-size:16px}
.udn-list{flex:1;overflow:auto;padding:12px 22px;display:flex;flex-direction:column;gap:10px}
.udn-empty{color:var(--text-muted,#555);font-size:14px;padding:6px 0}
.udn-note{border:1px solid var(--line,#ddd);border-radius:12px;padding:10px 12px;background:var(--surface-soft,#f6f6f2)}
.udn-meta{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px}
.udn-from{font:600 11px var(--font-mono,ui-monospace);text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted,#555)}
.udn-from.u{color:#b4004e}
.udn-rm{all:unset;cursor:pointer;font-size:12.5px;color:var(--text-muted,#555);padding:2px 6px;border-radius:6px}.udn-rm:hover{background:var(--surface,#fff)}
.udn-t{font-size:15px;line-height:1.45;outline:none;border-radius:6px;padding:2px 4px;margin:0 -4px;white-space:pre-wrap;word-break:break-word}.udn-t:focus{background:var(--surface,#fff);box-shadow:0 0 0 2px var(--line,#ddd)}
.udn-keep{display:flex;align-items:center;gap:6px;margin-top:6px;font-size:12.5px;color:var(--text-muted,#555);cursor:pointer}
.udn-kst{display:block;margin:3px 0 0 22px;font-size:12.5px;color:var(--text-muted,#555)}.udn-kst[hidden]{display:none}.udn-kst.ok{color:#0f6a40;font-weight:600}.udn-kst.ok::before{content:'✓';display:inline-grid;place-items:center;width:15px;height:15px;margin-right:5px;border-radius:50%;background:#12a150;color:#fff;font-size:10px;line-height:1;vertical-align:-2px}
.udn-add{border-top:1px solid var(--line,#ddd);padding:14px 22px 18px;display:flex;flex-direction:column;gap:8px}
.udn-add textarea{width:100%;box-sizing:border-box;min-height:64px;font:15px/1.4 var(--ud-body,system-ui);padding:10px 12px;border:1px solid var(--line,#ddd);border-radius:10px;background:var(--surface-soft,#f6f6f2);color:inherit;resize:vertical}
.udn-row{display:flex;justify-content:space-between;align-items:center;gap:8px}.udn-row small{color:var(--text-muted,#555)}
.udn-btn{all:unset;cursor:pointer;padding:9px 18px;border-radius:999px;background:var(--text,#0c0e09);color:var(--surface,#fff);font:600 14px var(--ud-body,system-ui)}
.udn-banner{display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;justify-content:space-between;border:1.5px solid var(--text,#0c0e09);background:var(--surface-highlight,#f1ffc5);border-radius:14px;padding:12px 16px;margin:0 0 16px;font-size:14.5px}
.udn-banner b{display:block;font-size:15px}.udn-banner a,.udn-banner button{all:unset;cursor:pointer;padding:8px 16px;border-radius:999px;border:1px solid var(--text,#0c0e09);background:var(--surface,#fff);font:600 14px var(--ud-body,system-ui);white-space:nowrap}
.ud-progress li.udn-reopen{cursor:pointer}.ud-progress li.udn-reopen:hover{border-color:var(--text,#0c0e09)}
.ud-progress li.udn-ahead{color:var(--text,#0c0e09);border-color:var(--text,#0c0e09);cursor:pointer}.ud-progress li.udn-ahead span{background:var(--surface-soft,#eceee6);color:var(--text-muted,#8a8d84)}
.ud-progress li.udn-going{border-color:var(--text,#0c0e09);color:var(--text,#0c0e09)}
.ud-progress li.udn-going span{color:transparent!important;background:transparent!important;border:2px solid var(--text,#0c0e09);border-right-color:transparent;box-sizing:border-box;animation:udnspin .7s linear infinite}
@keyframes udnspin{to{transform:rotate(360deg)}}
.udn-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:70;display:flex;align-items:center;gap:10px;padding:10px 18px;border-radius:999px;background:var(--text,#0c0e09);color:var(--surface,#fff);font:500 14px var(--ud-body,system-ui);box-shadow:0 8px 24px rgba(0,0,0,.2)}
.udn-toast[hidden]{display:none}.udn-toast i{width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;animation:udnspin .7s linear infinite}
@media (prefers-reduced-motion:reduce){.ud-progress li.udn-going span,.udn-toast i{animation:none}}
@media print{.udn-tab,.udn-drawer{display:none}}
</style>
<button type="button" class="udn-tab" id="udn-tab" aria-controls="udn-drawer" aria-expanded="false"${tab ? '' : ' hidden'}>Notes <b id="udn-count">0</b></button>
<div class="udn-toast" id="udn-toast" role="status" aria-live="polite" hidden><i aria-hidden="true"></i><span></span></div>
<aside class="udn-drawer" id="udn-drawer" aria-label="Notes for this video" aria-hidden="true">
 <div class="udn-head"><div><h2>Notes for this video</h2><p id="udn-sub">Ideas from every step, in one place. Edit or remove any; Ultrademo reads them before each step.</p></div><button type="button" class="udn-x" id="udn-x" aria-label="Close the notes">✕</button></div>
 <div class="udn-list" id="udn-list"></div>
 <div class="udn-add"><textarea id="udn-new" placeholder="Add a note: an idea, a must-have, something to avoid"></textarea><div class="udn-row"><small id="udn-state">Saved with this video</small><button type="button" class="udn-btn" id="udn-add">Add</button></div></div>
</aside>
<script>
(function(){
  var C = ${cfg};
  var body = document.body, list = document.getElementById('udn-list'), count = document.getElementById('udn-count'), state = document.getElementById('udn-state');
  var notes = [], timer = null, api = C.api, brand = null, kst = [];
  var FROM = { brief: 'Your brief', outline: 'The outline', direction: 'The direction', production: 'Production', review: 'The review', delivery: 'Delivery', dashboard: 'The dashboard', you: 'You', ultrademo: 'Ultrademo', brand: 'Kept for the brand' };
  function el(tag, cls, text){ var x = document.createElement(tag); if (cls) x.className = cls; if (text != null) x.textContent = text; return x; }
  function open(on){ body.classList.toggle('udn-open', on); document.getElementById('udn-tab').setAttribute('aria-expanded', on ? 'true' : 'false'); document.getElementById('udn-drawer').setAttribute('aria-hidden', on ? 'false' : 'true'); }
  function save(){
    clearTimeout(timer); state.textContent = 'Saving…';
    timer = setTimeout(function(){
      fetch(api, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ notes: notes }) })
        .then(function(r){ return r.json(); }).then(function(j){
          state.textContent = j.ok ? 'Saved with this video' : (j.error || 'Could not save');
          if (j.ok) { brand = j.brand || null; kept(); }
          // keep the same note objects (the drawer's boxes are tied to them); take only the ids the server gave
          if (j.ok) { (j.notes || []).forEach(function(x, i){ if (notes[i] && notes[i].text.trim() === x.text) notes[i].id = x.id; }); count.textContent = notes.length; }
        })
        .catch(function(){ state.textContent = 'Could not reach the page server'; });
    }, 500);
  }
  function draw(){
    list.innerHTML = ''; kst = []; count.textContent = notes.length;
    if (!notes.length) list.appendChild(el('div', 'udn-empty', 'No notes yet. Anything you add here follows the video through every step.'));
    notes.forEach(function(n, i){
      var box = el('div', 'udn-note'), meta = el('div', 'udn-meta');
      meta.appendChild(el('span', 'udn-from' + (n.from === 'ultrademo' ? ' u' : ''), FROM[n.from] || 'You'));
      var rm = el('button', 'udn-rm', 'Remove'); rm.type = 'button'; rm.setAttribute('aria-label', 'Remove this note');
      rm.addEventListener('click', function(){ notes.splice(i, 1); draw(); save(); }); meta.appendChild(rm); box.appendChild(meta);
      var t = el('div', 'udn-t', n.text); t.contentEditable = 'true'; t.spellcheck = true; t.setAttribute('role', 'textbox'); t.setAttribute('aria-label', 'Note');
      t.addEventListener('input', function(){ n.text = t.textContent; save(); }); box.appendChild(t);
      var keep = el('label', 'udn-keep'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!n.brand;
      var st = el('span', 'udn-kst'); st.setAttribute('aria-live', 'polite'); kst[i] = st;
      cb.addEventListener('change', function(){ n.brand = cb.checked; st.className = 'udn-kst'; st.textContent = cb.checked ? 'Saving\\u2026' : ''; st.hidden = !cb.checked; save(); }); keep.appendChild(cb); keep.appendChild(document.createTextNode('Keep for the brand\\u2019s future videos'));
      box.appendChild(keep); box.appendChild(st); list.appendChild(box);
    });
    kept();
  }
  // a ticked note says where it went: a green check once the saved brand has it, a plain line when no brand is saved yet
  function kept(){
    notes.forEach(function(n, i){ var st = kst[i]; if (!st) return; st.hidden = !n.brand; if (!n.brand) { st.textContent = ''; return; }
      if (brand) { st.className = 'udn-kst ok'; st.textContent = 'Saved to ' + brand.name + '\\u2019s memory'; }
      else { st.className = 'udn-kst'; st.textContent = 'Kept for this brand once you save it'; } });
  }
  document.getElementById('udn-tab').addEventListener('click', function(){ open(!body.classList.contains('udn-open')); });
  document.getElementById('udn-x').addEventListener('click', function(){ open(false); });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && body.classList.contains('udn-open')) open(false); });
  document.getElementById('udn-add').addEventListener('click', function(){
    var ta = document.getElementById('udn-new'), t = ta.value.trim(); if (!t) return;
    notes.push({ text: t, from: C.stage || 'dashboard' }); ta.value = ''; draw(); save(); list.scrollTop = list.scrollHeight;
  });
  // the step bar reopens an earlier step whose page is not running; an earlier step's page says where the video is
  // where the video was when this page opened: only a page opened on an earlier step is a reopened one. A video that
  // moves on while its page is open (the user confirmed here and the next step is being written) is progress, not a
  // reopen, so the banner never appears on a tab the user comes back to (2026-11-14, batch test)
  var openedAt = null;
  function wire(j){
    if (!C.stage) return;
    var at = C.order.indexOf(j.furthest), me = C.order.indexOf(C.stage);
    if (openedAt === null) openedAt = at;
    // drawn afresh each time (a refresh may find a step done, or undone by a re-saved brief)
    document.querySelectorAll('.ud-progress li.udn-ahead, .ud-progress li.udn-reopen').forEach(function(li){ li.classList.remove('udn-ahead', 'udn-reopen'); if (li.title === 'Reopen this step') li.title = C.names[li.getAttribute('data-stage')] || ''; });
    document.querySelectorAll('.ud-progress li[data-stage]').forEach(function(li){
      var k = li.getAttribute('data-stage'), i = C.order.indexOf(k);
      // on a reopened earlier step, the later steps the video has reached stay readable and clickable (outlined, the
      // number greyed), unlike the steps it has not reached
      if (i > me && i <= at && me >= 0) li.classList.add('udn-ahead');
      if (i < 0 || i > at || li.getAttribute('aria-current') || li.querySelector('a')) return;
      li.classList.add('udn-reopen'); li.title = 'Reopen this step';
    });
    ready = j;
    if (pending) { var p = pending; pending = null; go(p); }
    var oldBar = document.querySelector('.udn-banner'); if (oldBar) oldBar.remove();
    if (me >= 0 && me < at && me < openedAt && C.banner !== false) {
      var bar = el('div', 'udn-banner'), txt = el('div');
      txt.appendChild(el('b', '', 'You reopened the ' + C.names[C.stage] + '.'));
      txt.appendChild(el('span', '', 'This video is at the ' + C.names[j.furthest] + ' step. Change anything and save: Ultrademo tells you which later steps it redoes before it does anything.'));
      bar.appendChild(txt);
      var back = el('button', '', 'Back to the ' + C.names[j.furthest]); back.type = 'button';
      back.addEventListener('click', function(){ if (j.links && j.links[j.furthest]) location.href = j.links[j.furthest]; else reopen(j.furthest, back); });
      bar.appendChild(back);
      var pin = document.querySelector('.ud-pin'); if (pin && pin.parentNode) pin.parentNode.insertBefore(bar, pin.nextSibling); else document.body.insertBefore(bar, document.body.firstChild);
    }
  }
  // a step in the bar: one click is enough. The pressed step spins and a line says what is opening, straight away; a
  // click before the page has loaded what it needs waits for it; more clicks while one is opening do nothing
  var ready = null, pending = null, busy = false, toast = document.getElementById('udn-toast'), slow = null;
  function going(li, on){
    busy = on; clearTimeout(slow);
    document.querySelectorAll('.ud-progress li.udn-going').forEach(function(x){ x.classList.remove('udn-going'); });
    toast.hidden = !on;
    if (!on) return;
    if (li && li.classList) li.classList.add('udn-going');
    var k = li && li.getAttribute ? li.getAttribute('data-stage') : '', name = (C.names[k] || 'the step');
    toast.lastChild.textContent = 'Opening the ' + name + '…';
    slow = setTimeout(function(){ toast.lastChild.textContent = 'Starting the ' + name + ' page; a few seconds more…'; }, 4000);
  }
  function go(li){
    var k = li.getAttribute('data-stage');
    var a = li.querySelector('a[href]');
    if (a) location.href = a.href;  // it became a link while the page was loading
    else if (li.classList.contains('udn-reopen')) reopen(k, li);
    else going(null, false);        // a step the video has not reached
  }
  document.addEventListener('click', function(ev){
    var li = ev.target && ev.target.closest ? ev.target.closest('.ud-progress li[data-stage]') : null;
    if (!li || li.getAttribute('aria-current')) return;
    if (busy) { ev.preventDefault(); return; }
    // a step whose page is running is a link. A click on the pill's edge is outside the link itself, so go there from
    // here; Cmd/Ctrl-click (a new tab) is left to the browser. If the page does not answer, the loader clears
    var a = li.querySelector('a[href]');
    if (a) {
      if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey || ev.button) return;
      going(li, true);
      if (!a.contains(ev.target)) { ev.preventDefault(); location.href = a.href; }
      setTimeout(function(){ if (busy) going(null, false); }, 15000);
      return;
    }
    if (!C.stage) return;
    if (ready && !li.classList.contains('udn-reopen')) {
      // what this page knew may be old (the next step finished in another tab): ask again, then go or do nothing
      going(li, true);
      load().then(function(j){ if (j) wire(j); go(li); }).catch(function(){ going(null, false); });
      return;
    }
    going(li, true);
    if (!ready) { pending = li; return; }
    go(li);
  });
  // coming back with the browser's Back button shows this page as it was left: clear the loader
  window.addEventListener('pageshow', function(){ going(null, false); });
  // coming back to this tab: the step bar catches up with where the video is now (a step may have finished elsewhere)
  document.addEventListener('visibilitychange', function(){ if (!document.hidden && ready && !busy) load().then(function(j){ if (j) wire(j); }).catch(function(){}); });
  function reopen(stage, node){
    going(node, true);
    fetch('/api/reopen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ stage: stage }) })
      .then(function(r){ return r.json(); }).then(function(j){ if (j.ok && j.url) location.href = j.url; else { going(null, false); alert(j.error || 'That step could not be opened.'); } })
      .catch(function(){ going(null, false); });
  }
  function load(newApi){
    if (newApi) api = newApi;
    return fetch(api, { cache: 'no-store' }).then(function(r){ return r.json(); }).then(function(j){ if (!j.ok) return; notes = j.notes || []; brand = j.brand || null; draw(); return j; });
  }
  // a page of one video loads its notes now; the dashboard has no video of its own until a card's Notes is pressed
  ${tab ? "if (location.protocol === 'http:') load().then(function(j){ if (j) wire(j); else throw 0; }).catch(function(){ ready = {}; if (pending) { var p = pending; pending = null; reopen(p.getAttribute('data-stage'), p); } });" : ''}
  // the dashboard opens the drawer for one video at a time
  window.udNotes = { open: function(apiFor, title){ load(apiFor).then(function(){ document.getElementById('udn-sub').textContent = (title ? title + ': ' : '') + 'ideas from every step, in one place. Edit or remove any; Ultrademo reads them before each step.'; open(true); }); } };
})();
</script>`;
}
