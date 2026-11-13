// effects/samples.mjs — a neutral sample for each effect, from Ultrademo itself (D-73), and how each sample calls it.
// Shared by the effects gallery (gallery.mjs) and the effect previews on the Refine page (D-115).

export const SAMPLE = {
  money: '<div class="chip ok">Paid · $49</div>', confetti: '<div class="chip ok">Approved</div>', cannon: '<div class="title">Launch day</div>',
  check: '<div class="row">Voice picked</div>', stamp: '<div class="row">Review · Scene 3</div>', sparkle: '<div class="btn">Video ready</div>',
  bigstar: '<div class="chip">Scene approved</div>', stars: '<div class="row" style="margin-top:110px">Rated by the team</div>', thumbsup: '<div class="chip ok">Looks good</div>',
  hearts: '<div class="chip">Loved it</div>', highfive: '<div class="chip ok" style="margin-top:160px">Video shipped</div>', smiley: '<div class="row" style="margin-top:150px">Viewers stayed to the end</div>',
  click: '<div class="btn" id="T">Render video</div>', typing: '<div class="row fld" id="T"></div>',
  wave: '<div class="row" style="position:relative;z-index:1;display:flex;gap:14px;align-items:center"><b>John Carter</b><span style="color:#667085">Sample call · 00:04</span></div>', shield: '<div class="row" style="margin-top:150px">Keys stay on your machine</div>', erase: '<div class="row" id="T">old-take.mp4</div>',
  speed: '<div class="title">Rendered in 99 s</div>', growth: '<div class="num">+38%</div>', drop: '<div class="num bad" id="T">−12%</div>',
  bell: '<div class="row" style="margin-top:100px">New comment</div>', pulse: '<div class="pair"><span>Plan</span><span>Video</span></div>', send: '<div class="btn">Share link</div>',
  clock: '<div class="row" style="margin-top:150px">Hours of editing saved</div>', glint: '<div class="title" id="T">ultrademo</div>',
};
// how each sample calls the effect (in = the stage; target = the sample)
export const CALL = {
  pulse: "{ x: 95, y: 120, to: { x: 305, y: 120 } }", send: "{ target: S, to: { x: 360, y: 20 } }", erase: "{ target: document.getElementById('T' + k), hide: true }",
  drop: "{ target: document.getElementById('T' + k) }", glint: "{ target: document.getElementById('T' + k) }", stars: "{ x: 200, y: 70 }",
  shield: "{ x: 200, y: 75 }", sparkle: "{ target: S, size: 0.5 }", smiley: "{ x: 200, y: 58, size: 0.8 }", highfive: "{ x: 200, y: 92 }",
  click: "{ target: document.getElementById('T' + k), cursor: true }", wave: "{ x: 200, y: 120, w: 380, h: 210, dur: 1.9, behind: true }", stamp: "{ target: S, size: 0.7 }", typing: "{ target: document.getElementById('T' + k), text: 'Launch video for Ultrademo' }", bell: "{ x: 200, y: 80 }", clock: "{ x: 200, y: 75 }", cannon: "{ target: S, w: 280 }",
};
