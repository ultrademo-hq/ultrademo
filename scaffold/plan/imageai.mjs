// imageai.mjs — the image AI service for a generated thumbnail picture: which service, its API address and its key,
// kept in the project's own env file beside the demo account (D-93). The pages learn only which service is named and
// whether the address and the key are filled in; the key never leaves the file.
import fs from 'node:fs';
import path from 'node:path';

export const IMAGE_AI_SERVICES = [
  { id: 'openai', name: 'OpenAI (gpt-image)', url: 'https://api.openai.com/v1' },
  { id: 'google', name: 'Google (Gemini, Imagen)', url: 'https://generativelanguage.googleapis.com' },
  { id: 'fal', name: 'fal.ai', url: 'https://fal.run' },
  { id: 'replicate', name: 'Replicate', url: 'https://api.replicate.com/v1' },
  { id: 'other', name: 'Another service (its API address)', url: '' },
];
const KEYS = ['IMAGE_AI_SERVICE', 'IMAGE_AI_URL', 'IMAGE_AI_KEY'];
const envFile = (projectDir) => path.join(projectDir, '.env');
const read = (file) => { try { return fs.readFileSync(file, 'utf8'); } catch { return ''; } };
const lineValue = (text, k) => (text.match(new RegExp(`^${k}=[ \\t]*(.*)$`, 'm'))?.[1] || '').trim();

/** What the page may know: the service named, and whether the address and the key are filled in. */
export function imageAiState(projectDir) {
  const file = envFile(projectDir), text = read(file);
  const service = lineValue(text, 'IMAGE_AI_SERVICE');
  return {
    path: file,
    exists: Boolean(text),
    service: IMAGE_AI_SERVICES.some((s) => s.id === service) ? service : service ? 'other' : '',
    url: Boolean(lineValue(text, 'IMAGE_AI_URL')),
    key: Boolean(lineValue(text, 'IMAGE_AI_KEY')),
  };
}

/** Add the three lines to the env file when missing (a known service's address filled in), readable by the user only.
 * A service already named, an address or a key already typed, are never overwritten. */
export function ensureImageAiEnv(projectDir, serviceId = '') {
  const file = envFile(projectDir);
  let text = read(file);
  const svc = IMAGE_AI_SERVICES.find((s) => s.id === serviceId) || null;
  const missing = KEYS.filter((k) => !new RegExp(`^${k}=`, 'm').test(text));
  if (missing.length) {
    const head = text ? (text.endsWith('\n') ? '' : '\n') : '# This video\'s own keys. Never paste them into the chat or the brief.\n';
    const notes = { IMAGE_AI_SERVICE: '# The image AI service for a generated thumbnail picture: openai, google, fal, replicate or other', IMAGE_AI_URL: '# its API address', IMAGE_AI_KEY: '# its API key' };
    const vals = { IMAGE_AI_SERVICE: svc ? svc.id : '', IMAGE_AI_URL: svc ? svc.url : '', IMAGE_AI_KEY: '' };
    text = text + head + missing.map((k) => `${notes[k]}\n${k}=${vals[k]}`).join('\n') + '\n';
  }
  // a service picked on the page fills the service and the address only while they are still empty
  if (svc) {
    if (!lineValue(text, 'IMAGE_AI_SERVICE')) text = text.replace(/^IMAGE_AI_SERVICE=[ \t]*$/m, `IMAGE_AI_SERVICE=${svc.id}`);
    if (svc.url && !lineValue(text, 'IMAGE_AI_URL')) text = text.replace(/^IMAGE_AI_URL=[ \t]*$/m, `IMAGE_AI_URL=${svc.url}`);
  }
  fs.writeFileSync(file, text, { mode: 0o600 });
  try { fs.chmodSync(file, 0o600); } catch {}
  return file;
}
