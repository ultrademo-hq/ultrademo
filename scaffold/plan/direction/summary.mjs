// summary.mjs — the words the Directions page shows for each direction, in plain language (2026-11-13).
// A separate step AFTER the directions are written: it reads the finished directions and writes only for the page
// (direction/summary.json). It never changes a direction, a scene or anything production reads, so the video comes out
// exactly as it would without it. Missing or failed, the page falls back to the directions' own text.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { callModel } from './propose.mjs';
import { LETTERS } from './schema.mjs';

const Beat = z.object({
  short: z.string().min(1).max(70).describe('about eight words, fits on one line'),
  full: z.string().min(1).max(260).describe('one plain sentence'),
});
export const SummarySchema = z.object({
  directions: z.array(z.object({
    letter: z.string().min(1).max(1),
    title: z.string().min(1).max(48).describe('two to five plain words a founder would say, not a codename'),
    opens: Beat, then: Beat, ends: Beat,
    between: z.string().min(1).max(160).describe('how one scene leads into the next, in plain words'),
    feels: z.array(z.string().min(1).max(18)).min(2).max(4),
    builds_to: z.object({ words: z.string().min(1).max(140).describe('the actual words or thing on screen at the moment the video builds to'), how: z.string().min(1).max(120) }),
    why: z.string().min(1).max(220).describe('one honest sentence: why pick this one, or what it trades away'),
    flag: z.string().max(90).nullable().describe('a few words when the direction does not do what the brief asked (for example light when dark was asked for); else null'),
  })).min(1).max(6),
});

const dirOf = (projectDir) => path.join(projectDir, 'direction');

/** What the summary depends on: the directions as written (a new style or new directions get a new summary). */
export function summaryKey(P) {
  const core = (P.directions || []).map((d) => ({ name: d.name, idea: d.idea, signature: d.signature, hook: d.hook, close: d.closing_shot, music: d.music?.file, energy: d.energy, canvas: d.canvas, moments: (d.moments || []).map((m) => [m.name, m.copy, m.motion, m.transition_in]) }));
  return crypto.createHash('sha1').update(JSON.stringify(core)).digest('hex').slice(0, 16);
}

/** The summary for these directions, by letter ({ A: {...}, B: {...} }), or null when there is none (or it is stale). */
export function readSummary(projectDir, P) {
  let s = null;
  try { s = JSON.parse(fs.readFileSync(path.join(dirOf(projectDir), 'summary.json'), 'utf8')); } catch { return null; }
  if (!s || s.key !== summaryKey(P) || !s.directions) return null;
  return s.directions;
}

export function summaryPrompt(P) {
  const v = P.video || {};
  const it = v.intake || {};
  const brief = { product: v.product, video_type: it.video_type || v.template, length_s: v.length_s, narration: v.narration, look_words: it.look?.words || null, look_chips: it.look?.chips || [] };
  const dirs = (P.directions || []).map((d, i) => ({
    letter: LETTERS[i], codename: d.name, mood: d.mood, canvas: d.canvas, idea: d.idea, signature: d.signature?.what, energy: d.energy,
    hook: d.hook?.line, closing_shot: d.closing_shot, music_why: d.music?.why,
    scenes: (d.moments || []).map((m) => ({ name: m.name, headline: m.copy?.headline || null, kicker: m.copy?.kicker || null, motion: m.motion, comes_in_by: m.transition_in })),
  }));
  const system = `You write the words a founder reads on the page where they pick a direction for their product video. They are not a motion designer: write the way you would describe the video to them across a table, plainly and warmly.

Rules:
- Describe only what the viewer sees and hears, from each direction exactly as written. Never invent a scene, a word on screen, a feature or a claim; quote on-screen words exactly.
- No design jargon: not "kinetic", "beat-synced", "ground", "palette", "accent", "glow edge", "cadence", "blueprint", "match cut", "lockup", "hero". Say what it looks like instead.
- No hype, no exclamation marks, no "seamless", "stunning", "elevate", "showcase", "dive into", "unlock". Short sentences that sound like a person talking.
- title: two to five plain words that say what makes this direction different (not its codename).
- opens / then / ends: how the video opens, what it builds through, how it ends. short is about eight words and fits on one line; full is one sentence.
- between: how one scene leads into the next, in plain words.
- feels: two to four everyday words.
- builds_to: the moment the video builds to: the actual words or thing on screen, and how it arrives.
- why: one honest sentence: what this direction is best at, or what it trades away.
- flag: a few words only when the direction does not do what the brief asked (for example a light look when dark was asked for); otherwise null.
Return one entry per direction, in the order given, with its letter.`;
  const prompt = `The brief:\n${JSON.stringify(brief, null, 1)}\n\nThe directions, as written:\n${JSON.stringify(dirs, null, 1)}`;
  return { system, prompt };
}

/**
 * Write direction/summary.json for these directions. Throws AwaitingAgent in agent mode until the task is answered.
 * opts: { model, key, fetchImpl, ledger, log }
 */
export async function writeSummary(projectDir, P, opts = {}) {
  const { system, prompt } = summaryPrompt(P);
  const r = await callModel({ name: 'direction-summary', model: opts.model, key: opts.key, system, prompt, schema: SummarySchema, ledger: opts.ledger, maxOutputTokens: 3000, fetchImpl: opts.fetchImpl, log: opts.log || (() => {}) });
  const want = (P.directions || []).map((_, i) => LETTERS[i]);
  const byLetter = {};
  (r.data.directions || []).forEach((x, i) => { const L = want.includes(String(x.letter).toUpperCase()) ? String(x.letter).toUpperCase() : want[i]; if (L && !byLetter[L]) byLetter[L] = { ...x, letter: L }; });
  const out = { key: summaryKey(P), at: new Date().toISOString(), directions: byLetter };
  fs.mkdirSync(dirOf(projectDir), { recursive: true });
  fs.writeFileSync(path.join(dirOf(projectDir), 'summary.json'), JSON.stringify(out, null, 1) + '\n');
  return byLetter;
}
