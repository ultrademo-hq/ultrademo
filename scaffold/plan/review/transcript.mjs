// transcript.mjs — the narration as a transcript for the Delivery page (2026-11-11): what the voice says, in order, with
// the time each line starts. From production/voice/voices.json (written by the voiceover, absolute times); without it,
// from production/narration.json and the scenes' start times. A music-only video has none. The caption files
// (out/captions.srt and .vtt, D-94) are offered beside it when the video has them.
import fs from 'node:fs';
import path from 'node:path';

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** [{ at, text }] in order, or [] for a video with no narration. */
export function transcriptLines(projectDir) {
  const voices = readJson(path.join(projectDir, 'production', 'voice', 'voices.json'));
  if (Array.isArray(voices) && voices.length) {
    return voices.filter((v) => v && typeof v.text === 'string' && v.text.trim()).map((v) => ({ at: Number(v.start_s) || 0, text: v.text.trim() })).sort((a, b) => a.at - b.at);
  }
  const lines = readJson(path.join(projectDir, 'production', 'narration.json'));
  const plan = readJson(path.join(projectDir, 'plan.json'));
  if (!Array.isArray(lines) || !lines.length) return [];
  const starts = {};
  let t = 0;
  for (const s of plan?.scenes || []) { starts[s.id] = t; t += Number(s.duration_s) || 0; }
  return lines.filter((l) => l && typeof l.text === 'string' && l.text.trim()).map((l) => ({ at: (starts[l.scene] ?? 0) + (Number(l.at) || 0), text: l.text.trim() })).sort((a, b) => a.at - b.at);
}

/** The transcript as plain text: a title line, then one "[m:ss] line" per spoken line. */
export function transcriptText(projectDir, title = '') {
  const lines = transcriptLines(projectDir);
  if (!lines.length) return '';
  return `${title ? `${title}\nTranscript\n\n` : ''}${lines.map((l) => `[${clock(l.at)}] ${l.text}`).join('\n')}\n`;
}

/** The caption files that exist for this video: { srt, vtt } (absolute paths or null). */
export function captionFiles(projectDir) {
  const f = (ext) => { const p = path.join(projectDir, 'out', `captions.${ext}`); return fs.existsSync(p) ? p : null; };
  return { srt: f('srt'), vtt: f('vtt') };
}
