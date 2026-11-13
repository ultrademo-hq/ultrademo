// picview.mjs — a viewer for the pictures from the product's site (D-113): one picture large, its words, its tick, the
// arrows to the others. Shared by the brief (screens step) and the Refine page (Your screens). Plain DOM, textContent
// only. window.udPicView.open(items, index, onTick): items are { src, label, alt, use }; onTick(index, use) saves a tick.
export const PICVIEW = `<style>
.pv{position:fixed;inset:0;z-index:90;display:grid;place-items:center;background:rgba(10,12,8,.82);padding:24px}.pv[hidden]{display:none}
.pv figure{margin:0;display:flex;flex-direction:column;gap:12px;max-width:min(1200px,92vw)}
.pv img{max-width:100%;max-height:74vh;object-fit:contain;border-radius:10px;box-shadow:0 20px 60px rgba(0,0,0,.45)}
.pv figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;color:#f4f4ef;font:14px/1.45 var(--ud-body,system-ui)}
.pv figcaption b{font-weight:700}.pv figcaption span{opacity:.8;flex:1 1 320px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pv label[hidden]{display:none}.pv label{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(255,255,255,.12);cursor:pointer;font-weight:600}
.pv label input{width:18px;height:18px;margin:0;accent-color:#dffe02}
.pv button{position:fixed;border:0;border-radius:50%;width:44px;height:44px;background:rgba(255,255,255,.14);color:#fff;font:600 22px/1 system-ui;cursor:pointer}
.pv button:hover{background:rgba(255,255,255,.26)}.pv .pvx{top:18px;right:18px}.pv .pvp{left:18px;top:50%}.pv .pvn{right:18px;top:50%}
</style>
<div class="pv" id="udpv" hidden role="dialog" aria-modal="true" aria-label="Picture from your site">
<figure><img id="udpv-img" alt=""><figcaption><b id="udpv-kind"></b><span id="udpv-alt"></span><label><input type="checkbox" id="udpv-use"> Use in the video</label></figcaption></figure>
<button type="button" class="pvx" aria-label="Close">×</button><button type="button" class="pvp" aria-label="Previous picture">‹</button><button type="button" class="pvn" aria-label="Next picture">›</button>
</div>
<script>
(function(){
  var box = document.getElementById('udpv'), img = document.getElementById('udpv-img'), use = document.getElementById('udpv-use');
  var items = [], at = 0, tick = null;
  function show(){
    var it = items[at]; if (!it) return;
    img.src = it.src; img.alt = it.alt || it.label || '';
    document.getElementById('udpv-kind').textContent = it.label || '';
    document.getElementById('udpv-alt').textContent = it.alt || '';
    use.checked = !!it.use; use.parentNode.hidden = typeof it.use !== 'boolean';
    box.querySelector('.pvp').hidden = box.querySelector('.pvn').hidden = items.length < 2;
  }
  function step(d){ at = (at + d + items.length) % items.length; show(); }
  function close(){ box.hidden = true; document.body.style.overflow = ''; }
  use.addEventListener('change', function(){ items[at].use = use.checked; if (tick) tick(at, use.checked); });
  box.querySelector('.pvx').addEventListener('click', close);
  box.querySelector('.pvp').addEventListener('click', function(){ step(-1); });
  box.querySelector('.pvn').addEventListener('click', function(){ step(1); });
  box.addEventListener('click', function(ev){ if (ev.target === box) close(); });
  document.addEventListener('keydown', function(ev){ if (box.hidden) return; if (ev.key === 'Escape') close(); if (ev.key === 'ArrowRight') step(1); if (ev.key === 'ArrowLeft') step(-1); });
  window.udPicView = { open: function(list, i, onTick){ items = list; at = i || 0; tick = onTick || null; show(); box.hidden = false; document.body.style.overflow = 'hidden'; box.querySelector('.pvx').focus(); } };
})();
</script>`;
