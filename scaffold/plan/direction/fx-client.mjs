// fx-client.mjs: the Refine page's effects and sounds (D-115): each scene's list, the picker with live previews of the
// effects (the effects gallery's own player and samples), and the video's setting. Plain browser JS, run inside the
// page script, where R (the screen) and save(path, value) exist.
export const FX_JS = String.raw`
(function(){
var FX=new Map(FXCAT.map(function(x){return [x.name,x]}));
var audio=new Audio();
function play(id){var f=SFXFILE[id];if(!f)return;try{audio.pause();audio.src=SFXBASE+f;audio.currentTime=0;audio.play();}catch(e){}}
function esc(t){return String(t==null?'':t).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
// the effects player: gsap and effects.js load once, when a preview first plays
var loading=null,uid=0;
function withFx(cb){if(window.gsap&&window.UDFX)return cb();if(!loading){loading=[];var a=document.createElement('script');a.src=FXBASE+'gsap.min.js';a.onload=function(){var b=document.createElement('script');b.src=FXBASE+'effects.js';b.onload=function(){var l=loading;loading=null;l.forEach(function(f){try{f()}catch(e){}});};document.head.appendChild(b);};document.head.appendChild(a);}if(loading)loading.push(cb);}
function stage(name){var st=document.createElement('div');st.className='fxstage';var k='x'+(++uid);st.innerHTML=(FXSAMPLE[name]||'<div class="chip">Sample</div>').replace('id="T"','id="T'+k+'"');st.dataset.k=k;st.dataset.name=name;return st;}
function run(st){if(st._tl)return;withFx(function(){if(st._tl||!document.body.contains(st))return;var S=st.firstElementChild;var tl=gsap.timeline({repeat:-1,repeatDelay:.7});var o;try{o=(new Function('S','k','return '+(FXCALL[st.dataset.name]||'{ target: S }')))(S,st.dataset.k);}catch(e){o={target:S};}o.in=st;o.at=.3;o.level=FXSET.level==='subtle'?'subtle':'lively';try{UDFX.play(tl,st.dataset.name,o);}catch(e){}tl.to({},{duration:.1},2.4);st._tl=tl;});}
function stop(st){if(st._tl){st._tl.kill();st._tl=null;var n=st.dataset.name,k=st.dataset.k;st.innerHTML=(FXSAMPLE[n]||'<div class="chip">Sample</div>').replace('id="T"','id="T'+k+'"');}}
// a scene's list
function draw(row){var j=Number(row.dataset.fxj),list=FXLISTS[j];row.innerHTML='';
 if(FXSET.level==='none'){row.innerHTML='<div class="fxnote">Effects are off for this video (Music, voice and effects). '+(FXSET.interface?'Interface sounds still play.':'')+'</div>';return;}
 if(list===null){var n=document.createElement('div');n.className='fxnote';n.textContent='Ultrademo picks these while building this scene.';row.appendChild(n);}
 else if(!list.length){var n2=document.createElement('div');n2.className='fxnote';n2.textContent='None: nothing happens here that needs one.';row.appendChild(n2);}
 (list||[]).forEach(function(it,k){var x=it.effect?FX.get(it.effect):null;var el=document.createElement('div');el.className='fxitem';
  var th=document.createElement('button');th.type='button';th.className='fxthumb'+(x?'':' snd');th.title=x?'See it':'Hear it';th.setAttribute('aria-label',(x?'See ':'Hear ')+(x?x.label:it.sound));
  if(x){var st=stage(x.name);th.appendChild(st);th.addEventListener('mouseenter',function(){run(st)});th.addEventListener('mouseleave',function(){stop(st)});th.addEventListener('focus',function(){run(st)});th.addEventListener('blur',function(){stop(st)});th.addEventListener('click',function(){openShelf(j,x.name)});}
  else{th.textContent='♪';th.addEventListener('click',function(){play(it.sound)});}
  var nm=document.createElement('div');nm.className='fxname';var b=document.createElement('b');b.textContent=x?x.label:it.sound.replace(/-/g,' ');var pb=document.createElement('button');pb.type='button';pb.textContent='▶ '+(x?x.sound:'sound on its own');pb.addEventListener('click',function(){play(x?x.sound:it.sound)});nm.appendChild(b);nm.appendChild(pb);
  var w=document.createElement('input');w.type='text';w.className='fxwhen';w.value=it.when||'';w.placeholder='When it lands, e.g. '+(x&&x.event?x.event.split(',')[0]:'when the number appears');w.setAttribute('aria-label','When it lands');w.addEventListener('input',function(){list[k].when=w.value;saveRow(j);});
  var del=document.createElement('button');del.type='button';del.className='fxdel';del.textContent='×';del.setAttribute('aria-label','Remove '+b.textContent);del.addEventListener('click',function(){list.splice(k,1);saveRow(j);draw(row);});
  el.appendChild(th);el.appendChild(nm);el.appendChild(w);el.appendChild(del);row.appendChild(el);});
 var add=document.createElement('button');add.type='button';add.className='fxadd';add.textContent='+ Add an effect or sound';add.addEventListener('click',function(){openShelf(j,null)});row.appendChild(add);}
function saveRow(j){var row=R.querySelector('.fxrow[data-fxj="'+j+'"]');if(row)save(row.dataset.fxpath,FXLISTS[j]);}
// the picker
var shelf=R.querySelector('#fxshelf'),cur=null,stages=[];
function addItem(item){if(cur===null)return;if(!FXLISTS[cur])FXLISTS[cur]=[];FXLISTS[cur].push(item);saveRow(cur);var row=R.querySelector('.fxrow[data-fxj="'+cur+'"]');var j=cur;closeShelf();if(row){draw(row);var ins=row.querySelectorAll('.fxwhen');if(ins.length)ins[ins.length-1].focus();row.scrollIntoView({block:'center',behavior:'smooth'});}}
function openShelf(j,focus){cur=j;var groups=[];FXCAT.forEach(function(x){if(groups.indexOf(x.group)<0)groups.push(x.group)});var gbox=R.querySelector('#fxgroups');gbox.innerHTML='';stages=[];
 R.querySelector('#fxshelftitle').textContent='Add an effect or sound to scene '+(j+1<10?'0':'')+(j+1);
 groups.forEach(function(g){var h=document.createElement('h3');h.textContent=g;gbox.appendChild(h);var grid=document.createElement('div');grid.className='fxgrid';
  FXCAT.filter(function(x){return x.group===g}).forEach(function(x){var o=document.createElement('div');o.className='fxopt'+(focus===x.name?' focus':'');o.dataset.name=x.name;var win=document.createElement('div');win.className='fxwin';var st=stage(x.name);win.appendChild(st);stages.push(st);
   var m=document.createElement('div');m.className='fxmeta';m.innerHTML='<b>'+esc(x.label)+'</b><small>'+esc(x.event)+'</small>';var acts=document.createElement('div');acts.className='fxacts';
   var hb=document.createElement('button');hb.type='button';hb.textContent='▶ '+x.sound;hb.addEventListener('click',function(){play(x.sound)});
   var ab=document.createElement('button');ab.type='button';ab.className='dark';ab.textContent='Add';ab.setAttribute('aria-label','Add '+x.label);ab.addEventListener('click',function(){addItem({effect:x.name,when:''})});
   acts.appendChild(hb);acts.appendChild(ab);m.appendChild(acts);o.appendChild(win);o.appendChild(m);grid.appendChild(o);});
  gbox.appendChild(grid);});
 var sbox=R.querySelector('#fxsnds');sbox.innerHTML='';FXSOUNDS.forEach(function(s){var r=document.createElement('div');r.className='fxsnd';var hb=document.createElement('button');hb.type='button';hb.textContent='▶';hb.setAttribute('aria-label','Hear '+s.id);hb.addEventListener('click',function(){play(s.id)});var b=document.createElement('b');b.textContent=s.id.replace(/-/g,' ');var sp=document.createElement('span');sp.textContent=(s.situations||[]).join('; ');var ab=document.createElement('button');ab.type='button';ab.className='dark';ab.textContent='Add';ab.addEventListener('click',function(){addItem({sound:s.id,when:''})});r.appendChild(hb);r.appendChild(b);r.appendChild(sp);r.appendChild(ab);sbox.appendChild(r);});
 shelf.hidden=false;document.body.style.overflow='hidden';stages.forEach(run);
 var f=focus&&gbox.querySelector('.fxopt.focus');if(f)setTimeout(function(){f.scrollIntoView({block:'center'})},50);else shelf.querySelector('.sheet').scrollTop=0;
 R.querySelector('#fxshelfclose').focus();}
function closeShelf(){shelf.hidden=true;document.body.style.overflow='';stages.forEach(stop);stages=[];try{audio.pause()}catch(e){}cur=null;}
if(shelf){R.querySelector('#fxshelfclose').addEventListener('click',closeShelf);shelf.addEventListener('click',function(ev){if(ev.target===shelf)closeShelf();});document.addEventListener('keydown',function(ev){if(ev.key==='Escape'&&!shelf.hidden)closeShelf();});}
function drawAll(){R.querySelectorAll('.fxrow').forEach(draw);}
drawAll();
// the video's setting: the level and the interface sounds
function saveSet(){save(FXPATH,{level:FXSET.level,interface:FXSET.interface});}
R.querySelectorAll('input[name="fxlevel"]').forEach(function(r){r.addEventListener('change',function(){if(!r.checked)return;FXSET.level=r.value;R.querySelectorAll('.fxlevels label').forEach(function(l){l.classList.toggle('on',l.querySelector('input').checked)});saveSet();drawAll();});});
var fi=R.querySelector('#fxiface');if(fi)fi.addEventListener('change',function(){FXSET.interface=fi.checked;saveSet();drawAll();});
})();
`;
