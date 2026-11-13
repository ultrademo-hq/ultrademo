#!/usr/bin/env node
// run.mjs — the outline step (D-91), after the brief and before the directions.
//   node plan/outline/run.mjs <project> [--again] [--no-test] [--no-serve]
// 1. writes the outline (in agent mode a task for the agent: tasks/outline.task.md; run again once the answer is there)
// 2. tests the sign-in against the screens it needs (--no-test skips it)
// 3. in director mode, confirms it by itself unless a step changes data (that always waits for the user)
// 4. serves the outline page (port 4325 or the next free one) until the user confirms; `node plan/wait.mjs <project>
//    outline` exits then. --no-serve stops after 3.
// Exit codes: 0 done, 3 waiting for the agent's answer, 1 a problem.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readPlan, writePlan } from '../intake/serve.mjs';
import { callModel, DEFAULT_MODEL, loadKey } from '../direction/propose.mjs';
import { agentMode, agentFetch, useProjectTasks, exitIfAwaiting } from '../agent.mjs';
import { openPage } from '../pages.mjs';
import { outlineSystem, outlinePrompt, OutlineAnswerSchema, applyOutline, confirmOutline, autoConfirmable, dataChanges } from './outline.mjs';
import { testReach } from './signin.mjs';
import { readCodeRead, writeCodeRead, codeReadPrompt, codeReadBlock, CodeReadSchema } from '../local.mjs';
import { startOutlineServer } from './serve.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

export async function writeOutline(projectDir, { again = false, fetchImpl, key, model = DEFAULT_MODEL, log = console.log } = {}) {
  const { plan } = readPlan(projectDir);
  if (!plan?.video) throw new Error('No brief saved yet: the outline is written from it.');
  if (plan.video.intake?.outline && !again) return plan.video.intake.outline;
  if (!fetchImpl) {
    if (agentMode()) { fetchImpl = agentFetch(useProjectTasks(projectDir)); key = 'agent'; }
    else { key = loadKey(ROOT); if (!key) throw new Error('API mode (ULTRADEMO_MODE=api) needs OPENROUTER_API_KEY; without it, leave the mode unset and your AI session writes this.'); fetchImpl = globalThis.fetch; }
  }
  // D-117: the product's code, read once by the AI session (read only) before the outline, when the brief gives a folder
  const local = plan.video.intake?.local;
  if (local?.folder && !readCodeRead(projectDir)) {
    if (key === 'agent') {
      const { data: read } = await callModel({ name: 'code-read', model, key, system: 'You read a product\'s code to learn what a product video can show. You only read; you never run or change anything.', prompt: codeReadPrompt(local), schema: CodeReadSchema, fetchImpl, log: () => {} });
      writeCodeRead(projectDir, read);
      log(`Code read: ${read.screens.length} screens, ${read.flows.length} flows (${path.join(projectDir, 'code', 'read.json')}).`);
    } else log('The code folder is read by your AI session; in API mode the outline goes on without it.');
  }
  const { data } = await callModel({ name: 'outline', model, key, system: outlineSystem(), prompt: outlinePrompt(plan.video) + codeReadBlock(readCodeRead(projectDir)) + (await import('../notes.mjs')).notesBlock(projectDir), schema: OutlineAnswerSchema, fetchImpl, log: () => {} });
  const outline = applyOutline(plan, data);
  writePlan(projectDir, plan);
  log(`Outline written: ${outline.moments.length} moments, about ${Math.round(outline.moments.reduce((a, m) => a + m.seconds, 0))} s.`);
  return outline;
}

async function main() {
  const argv = process.argv.slice(2);
  const projectDir = argv.find((a) => !a.startsWith('--'));
  if (!projectDir) { console.error('usage: node plan/outline/run.mjs <project> [--again] [--no-test] [--no-serve]'); process.exit(1); }
  const dir = path.resolve(projectDir);
  try { await writeOutline(dir, { again: argv.includes('--again') }); }
  catch (err) { exitIfAwaiting(err); console.error(`Stopped: ${err.message}`); process.exit(1); }

  let { plan } = readPlan(dir);
  if (!argv.includes('--no-test')) {
    plan.video.intake.outline.signin = await testReach(plan, dir);
    writePlan(dir, plan);
    const s = plan.video.intake.outline.signin;
    const rs = Object.values(s.results);
    const n = (st) => rs.filter((r) => r.state === st).length;
    const checked = n('reached') + n('not-reached');
    console.log(s.signed_in === false ? `Sign-in test: did not sign in (${s.why}).`
      : !checked ? `Sign-in test: nothing to check before capture${n('at-capture') ? ` (${n('at-capture')} screen(s) are checked when capturing, in ${s.path === 'own-browser' ? 'your own browser' : 'the sign-in session'})` : ''}.`
      : `Sign-in test: ${n('reached')} of ${checked} screen(s) reached${n('not-reached') ? `; ${n('not-reached')} not reached` : ''}${n('at-capture') ? `; ${n('at-capture')} checked at capture` : ''}.`);
  }
  ({ plan } = readPlan(dir));
  const o = plan.video.intake.outline;
  if (plan.video.autonomy === 'director' && o.status !== 'confirmed') {
    if (autoConfirmable(o)) {
      confirmOutline(plan, {});
      writePlan(dir, plan);
      fs.mkdirSync(path.join(dir, 'outline'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'outline', 'confirmed.json'), JSON.stringify({ at: new Date().toISOString(), moments: o.moments.length, data_ok: null, by: 'director' }, null, 1) + '\n');
      console.log('Director mode: no step changes data, so the outline is confirmed. Go on with the directions.');
      if (argv.includes('--no-serve')) return;
    } else console.log(`Director mode: ${dataChanges(o).length} step(s) change data, so the user confirms the outline on the page.`);
  }
  if (argv.includes('--no-serve')) return;
  const srv = await startOutlineServer({ projectDir: dir });
  const how = process.env.ULTRADEMO_NO_OPEN ? '' : await openPage(dir, 'outline', srv.url);
  console.log(`Outline page: ${srv.url}${how ? `  (${how})` : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
