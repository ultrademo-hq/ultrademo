// fx.mjs — effects and sounds planned per scene on the Refine page (D-115).
// A scene's list holds what plays when something happens on screen: an effect from the effects library (a visual and
// its sound, plan/production/effects/catalogue.json) or a sound on its own (sfx/library.json), each with "when" in
// plain words tied to the move it lands on. Interface sounds (keys, clicks, presses, typing, pops, ticks, whooshes) are
// not listed: production adds them wherever they happen, behind one switch for the video.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCAFFOLD = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const readJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fb; } };

export const FX_LEVELS = ['lively', 'subtle', 'none'];
/** Effects drawn and sounded wherever the cursor clicks or a field fills: automatic, never listed. */
export const AUTO_EFFECTS = new Set(['click', 'typing']);
/** Interface and motion sounds: automatic, never listed. */
export const AUTO_SOUNDS = new Set(['key-1', 'key-2', 'key-3', 'click', 'press', 'mouse-click', 'typing', 'pop', 'pop-high', 'tick', 'whoosh']);
/** How many the direction proposes per scene at each level (the user may add more on the Refine page). */
export const FX_PER_SCENE = { lively: 2, subtle: 1, none: 0 };

let cat = null, lib = null;
/** The effects library: [{ name, group, event, label, sound, when }]. */
export function effectsCatalogue() {
  if (!cat) cat = readJson(path.join(SCAFFOLD, 'plan', 'production', 'effects', 'catalogue.json'), { effects: [] }).effects || [];
  return cat;
}
/** The sound library: [{ id, file, situations, length_s, background? }]. */
export function soundLibrary() {
  if (!lib) lib = readJson(path.join(SCAFFOLD, 'sfx', 'library.json'), { sounds: [] }).sounds || [];
  return lib;
}
/** The effects a scene may list (the automatic ones left out). */
export const listedEffects = () => effectsCatalogue().filter((e) => !AUTO_EFFECTS.has(e.name));
/** The sounds a scene may list on their own: the library's sounds no effect uses, the interface ones left out. */
export function looseSounds() {
  const used = new Set(effectsCatalogue().map((e) => e.sound));
  return soundLibrary().filter((s) => !used.has(s.id) && !AUTO_SOUNDS.has(s.id));
}

/** The video's effects setting: the level (from the brief unless changed on Refine) and the interface sounds switch. */
export function effectsSetting(d, video) {
  const level = FX_LEVELS.includes(d?.effects?.level) ? d.effects.level : FX_LEVELS.includes(video?.intake?.effects) ? video.intake.effects : 'lively';
  return { level, interface: d?.effects?.interface !== false };
}

/**
 * A scene's list, cleaned: known effects and sounds only, "when" as a short plain line, no repeats, at most `cap`.
 * An item naming an effect plays the effect and its own sound; an item naming only a sound is a cue on its own.
 * Any sound in the library may be listed on its own (the user may want a whoosh on one move); the direction's
 * proposals leave the interface ones out (`proposal: true`).
 */
export function cleanFx(list, { cap = Infinity, proposal = false } = {}) {
  if (!Array.isArray(list)) return [];
  const effects = new Map(effectsCatalogue().map((e) => [e.name, e]));
  const sounds = new Set(soundLibrary().map((s) => s.id));
  const out = [];
  const seen = new Set();
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    const when = String(it.when ?? '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const eff = typeof it.effect === 'string' ? it.effect.trim() : '';
    const snd = typeof it.sound === 'string' ? it.sound.trim() : '';
    let item = null;
    if (eff && effects.has(eff) && !(proposal && AUTO_EFFECTS.has(eff))) item = { effect: eff, when };
    else if (snd && sounds.has(snd) && !(proposal && AUTO_SOUNDS.has(snd))) item = { sound: snd, when };
    if (!item) continue;
    const key = `${item.effect || ''}|${item.sound || ''}|${when.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= cap) break;
  }
  return out;
}

/** The directions prompt's section: the effects and the sounds a moment may list. */
export function fxPromptSection() {
  return `# Effects library (name · group · the event it marks · its sound)
${listedEffects().map((e) => `${e.name} · ${e.group} · ${e.event} · ${e.sound}`).join('\n')}

# Sounds on their own (id · when it fits)
${looseSounds().map((s) => `${s.id} · ${(s.situations || []).join('; ')}`).join('\n')}`;
}

/** One plain line for a scene's list (plan views, the storyboard). */
export function fxLine(list) {
  const effects = new Map(effectsCatalogue().map((e) => [e.name, e]));
  return (list || []).map((x) => (x.effect ? `${effects.get(x.effect)?.label || x.effect} (${effects.get(x.effect)?.sound || 'its sound'})` : `${x.sound} sound`) + (x.when ? ` ${x.when}` : '')).join('; ');
}
