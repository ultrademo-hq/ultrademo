#!/usr/bin/env node
// wait.mjs — the agent's way to wait for the user's pages without watching a log: run it in the background and it exits
// (which the agent's harness reports) the moment the thing it waits for is there. Nothing is read or sent anywhere.
//   node plan/wait.mjs <project> brief     exits when the brief is saved (brief-saved.json newer than the start)
//   node plan/wait.mjs <project> outline   exits when the user confirms the outline (outline/confirmed.json): write the directions
//   node plan/wait.mjs <project> confirmed exits when the user confirms a direction (direction/confirmed.json): start production
//   node plan/wait.mjs <project> comments  exits when the user sends the open comments from the review page to fix: the
//                                          video's, or the thumbnail's (its own button; pending until each one is done)
//   node plan/wait.mjs <project> approved  exits when the user approves the video on the review page (review/approved.json)
//   node plan/wait.mjs <project> next      exits when the user presses Start a new video on the Delivery card (review/next.json);
//                                          with the projects folder in place of a project, on the dashboard (projects/.next-video.json)
//   node plan/wait.mjs <project> task      exits when a page started a model step that waits for the agent: a
//                                          tasks/<name>.task.md with no answer newer than it; prints both paths
//   [--timeout <minutes>] (default 60): exits with code 2 when nothing came
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch { return 0; } };

/** A vertical version asked for from Delivery that is not set up yet (no vertical/plan.json, no vertical video). */
export function formatRequestPending(project) {
  let req = null;
  try { req = JSON.parse(fs.readFileSync(path.join(project, 'review', 'format-request.json'), 'utf8')); } catch { return false; }
  if (req?.format !== 'vertical') return false;
  return !fs.existsSync(path.join(project, 'vertical', 'plan.json')) && !fs.existsSync(path.join(project, 'out', 'video-vertical.mp4'));
}
/** A new-video note from the last ten minutes that no wait has reported yet. */
export function unreported(f) {
  try { return Date.now() - fs.statSync(f).mtimeMs < 600_000 && !JSON.parse(fs.readFileSync(f, 'utf8')).reported_at; } catch { return false; }
}

/** An earlier step the user redid after the next one was written, from the files themselves (not from when the wait
 * started, so a change made while the agent was busy still counts):
 *   'brief'   the brief was saved again after the outline was written (or the save dropped the outline)
 *   'outline' the outline was confirmed again after the directions were written
 *   'direction' a direction was confirmed again after production started (production/started.json) */
export function staleStep(project) {
  let o = null;
  try { o = JSON.parse(fs.readFileSync(path.join(project, 'plan.json'), 'utf8')).video?.intake?.outline ?? null; } catch {}
  const saved = mtime(path.join(project, 'brief-saved.json'));
  if (saved && (!o || saved > (Date.parse(o.proposed_at || '') || 0) + 1000)) return 'brief';
  const proposals = mtime(path.join(project, 'direction', 'proposals.json'));
  const confirmed = Date.parse(o?.confirmed_at || '') || 0;
  if (proposals && confirmed > proposals + 1000) return 'outline';
  let started = null;
  try { started = JSON.parse(fs.readFileSync(path.join(project, 'production', 'started.json'), 'utf8')); } catch {}
  const dirConfirmed = mtime(path.join(project, 'direction', 'confirmed.json'));
  if (started && dirConfirmed && dirConfirmed > (Number(started.confirmed_mtime) || 0) + 1000) return 'direction';
  return null;
}

/** What the agent does about a redone step (the same words in wait.mjs and scene.mjs). */
export function redoMessage(st, projectArg, { director = false } = {}) {
  if (st === 'brief') return `The brief was saved again after the outline was written: write the outline again (node plan/outline/run.mjs ${projectArg}); the directions and production follow from it.`;
  if (st === 'outline') return `The outline was changed and confirmed again after the directions were written: write the directions again (${director ? `node --env-file-if-exists=.env plan/direction/run.mjs ${projectArg} --style auto --frames playwright --no-serve` : `node --env-file-if-exists=.env plan/direction/run.mjs ${projectArg} --frames playwright: it starts the direction step over from the new outline; the user picks the video style on the page, so keep it running and watch with wait.mjs task, as in step 2`}).`;
  if (st === 'direction') return `A direction was confirmed again after production started: run node plan/production/scene.mjs prepare ${projectArg} (it sets the earlier kit and scenes aside), then build every scene again.`;
  return '';
}

/** Thumbnail comments sent to Claude and not all marked done yet (review/thumb-submitted.json against comments.json). */
export function pendingThumbnail(project) {
  let sub = null, all = {};
  try { sub = JSON.parse(fs.readFileSync(path.join(project, 'review', 'thumb-submitted.json'), 'utf8')); } catch { return null; }
  try { all = JSON.parse(fs.readFileSync(path.join(project, 'review', 'comments.json'), 'utf8')); } catch {}
  const open = new Set((all.thumbnail?.comments || []).filter((n) => n.status !== 'done').map((n) => n.id));
  const left = (sub.ids || []).filter((id) => open.has(id));
  return left.length ? { ...sub, left: left.length } : null;
}

/** A task with no answer, or an answer older than the task (the page asked again). */
export function pendingTask(dir) {
  let names = [];
  try { names = fs.readdirSync(dir).filter((f) => f.endsWith('.task.md')); } catch { return null; }
  for (const f of names.sort((a, b) => mtime(path.join(dir, b)) - mtime(path.join(dir, a)))) {
    const base = f.replace(/\.task\.md$/, '');
    const task = path.join(dir, f);
    const answer = ['json', 'txt'].map((x) => path.join(dir, `${base}.answer.${x}`)).find((a) => fs.existsSync(a));
    if (!answer || mtime(answer) < mtime(task)) return { task, answer: answer || path.join(dir, `${base}.answer.json`) };
  }
  return null;
}

// run only as a command, so pendingTask can be imported (tests, pages)
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [, , projectArg, what = 'task', ...rest] = process.argv;
  if (!projectArg || !['brief', 'task', 'outline', 'confirmed', 'approved', 'comments', 'next'].includes(what)) { console.error('usage: node plan/wait.mjs <project> brief|task|outline|confirmed|approved|comments|next [--timeout <minutes>]'); process.exit(2); }
  const project = path.resolve(projectArg);
  const ti = rest.indexOf('--timeout');
  const deadline = Date.now() + (ti >= 0 ? Number(rest[ti + 1]) : 60) * 60_000;
  const started = Date.now();
  const tick = () => {
    // the user went back and redid an earlier step (a reopened brief saved again, an edited outline confirmed again):
    // the waits on later steps end and say which step to write again; the user's page is waiting for it
    const st = ['outline', 'confirmed', 'comments', 'approved', 'next'].includes(what) ? staleStep(project) : null;
    // the wait for a step ends when that step, or an earlier one, was redone (a direction confirmed again only
    // matters once production has started, so the waits from review on)
    const relevant = st === 'brief' || (st === 'outline' && what !== 'outline') || (st === 'direction' && ['comments', 'approved', 'next'].includes(what));
    if (relevant) {
      let director = false;
      try { director = JSON.parse(fs.readFileSync(path.join(project, 'plan.json'), 'utf8')).video?.autonomy === 'director'; } catch {}
      console.log(redoMessage(st, projectArg, { director }));
      process.exit(0);
    }
    if (what === 'comments') {
      const f = path.join(project, 'review', 'submitted.json');
      if (mtime(f) >= started - 1000) { console.log(`Comments sent to Claude: read ${path.join(project, 'review', 'comments.md')}, fix every open comment on the video by the scene loop, mark each done with a note, re-render the whole video; the review page shows the new version by itself.`); process.exit(0); }
      const th = pendingThumbnail(project);
      if (th) { console.log(`Thumbnail comments sent to Claude (${th.left} open): read the thumbnail section of ${path.join(project, 'review', 'comments.md')}; fix them in the confirmed direction's thumbnail in plan.json or in thumbnail/override.css, run node plan/thumbnail/render.mjs ${projectArg}, then mark each done with a note. Leave the video alone; the review page shows the new thumbnail by itself.`); process.exit(0); }
    } else if (what === 'approved') {
      const f = path.join(project, 'review', 'approved.json');
      if (mtime(f) >= started - 1000) { let a = {}; try { a = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {} console.log(`${a.vertical_at && Date.parse(a.vertical_at) >= started - 1000 ? `Vertical version approved: ${path.join(project, 'out', 'final', a.final_vertical || '')} (the landscape approval stands)` : `Video approved: ${path.join(project, 'out', 'final', a.final || '')}`}${a.open_comments ? ` (${a.open_comments} comment(s) left open)` : ''}. Wrap up: tell the user where the final file is, note it in the loop log, stop the page servers.`); process.exit(0); }
    } else if (what === 'next') {
      // a request made before this wait started counts too, until the vertical version is set up (the Delivery click can
      // come seconds before the agent starts waiting, 2026-11-13)
      if (formatRequestPending(project)) { console.log(`The vertical version was asked for from Delivery: node plan/production/scene.mjs vertical ${projectArg}, build every scene by AGENT.md's Vertical section, then whole on the vertical folder. Then start node plan/wait.mjs ${projectArg} comments and node plan/wait.mjs ${projectArg} approved in the background: the review page opens on the vertical version by itself, the landscape one marked Approved (D-116); comments on either go through the scene loop as usual.`); process.exit(0); }
      // likewise a new video started before this wait began, until a wait has reported it once
      const f = [path.join(project, 'review', 'next.json'), path.join(project, '.next-video.json')].find((x) => mtime(x) >= started - 1000 || unreported(x));
      if (f) { let n = {}; try { n = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {} try { fs.writeFileSync(f, JSON.stringify({ ...n, reported_at: new Date().toISOString() }, null, 1) + '\n'); } catch {} console.log(`New video started: ${n.project}. Its brief page is open in the user's browser (${n.url}). Run in the background node plan/wait.mjs ${n.project} task (it exits when the overview task appears: answer it at once, then run it again) and node plan/wait.mjs ${n.project} brief; when the brief is saved, start step 1b (the outline). Start node plan/wait.mjs projects next again too.`); process.exit(0); }
    } else if (what === 'outline') {
      const f = path.join(project, 'outline', 'confirmed.json');
      if (mtime(f) >= started - 1000) { let c = {}; try { c = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {} console.log(`Outline confirmed (${c.moments || '?'} moments${c.data_ok ? `; data changes ${c.data_ok.allowed ? 'allowed on the demo account' : 'to be rebuilt from screens'}` : ''}). Write the directions now (step 2).`); process.exit(0); }
    } else if (what === 'confirmed') {
      const f = path.join(project, 'direction', 'confirmed.json');
      if (mtime(f) >= started - 1000) { console.log(`Direction confirmed: ${path.join(project, 'plan.json')}. Start production now (step 3); the user's Production page follows your progress.`); process.exit(0); }
    } else if (what === 'brief') {
      const f = path.join(project, 'brief-saved.json');
      if (mtime(f) >= started - 1000) { console.log(`Brief saved: ${path.join(project, 'plan.json')}. Write the outline now (node plan/outline/run.mjs ${projectArg}).`); process.exit(0); }
    } else {
      const t = pendingTask(path.join(project, 'tasks'));
      if (t) { console.log(`Task waiting for Claude: ${t.task} (write the answer to ${t.answer}). The page carries on by itself once it is there.`); process.exit(0); }
    }
    if (Date.now() > deadline) { console.log(`Nothing yet (${what}); run again to keep waiting.`); process.exit(2); }
    setTimeout(tick, 1500);
  };
  tick();
}
