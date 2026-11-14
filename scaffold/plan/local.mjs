// local.mjs — a product running on this computer (D-117): the code folder, the command that starts it, its local
// address, and what Ultrademo learns from the code.
//
// Security: nothing here runs a command. The brief only records the start command; the user's AI session runs it in
// the code folder (Claude Code shows the command and asks first) and stops it when the video is done. The folder must
// be inside the user's home folder; here only its package.json and the names of a few known files are read. The
// code read itself is done by the AI session with its own file tools, read only, and never opens env files or keys.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFile, execFileSync } from 'node:child_process';
import { z } from 'zod';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1', '0.0.0.0']);

/** A local address (http://localhost:3000, http://127.0.0.1:5173/app), normalised; null for anything else. */
export function localAddress(s) {
  let u;
  try { u = new URL(String(s || '').trim()); } catch { return null; }
  if (!/^https?:$/.test(u.protocol) || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (!LOCAL_HOSTS.has(h) && !h.endsWith('.localhost')) return null;
  return `${u.protocol}//${h === '0.0.0.0' ? 'localhost' : u.host.toLowerCase()}${u.pathname === '/' ? '/' : u.pathname}${u.search}`;
}

/** The start command as written: one line, at most 300 characters; null when empty or not one line. */
export function startCommand(s) {
  const c = String(s ?? '').trim();
  if (!c || c.length > 300 || /[\r\n\0]/.test(c)) return null;
  return c;
}

// the framework a folder uses, from package.json's dependencies or a known file; and its usual address
const NODE_KINDS = [
  ['next', 'Next.js', 3000], ['nuxt', 'Nuxt', 3000], ['@remix-run/dev', 'Remix', 3000], ['@sveltejs/kit', 'SvelteKit', 5173], ['astro', 'Astro', 4321],
  ['@angular/core', 'Angular', 4200], ['react-scripts', 'Create React App', 3000], ['vite', 'Vite', 5173], ['gatsby', 'Gatsby', 8000], ['express', 'Express', 3000],
];
const FILE_KINDS = [['manage.py', 'Django', 8000, 'python manage.py runserver'], ['Gemfile', 'Rails', 3000, 'bin/rails server'], ['mix.exs', 'Phoenix', 4000, 'mix phx.server'], ['artisan', 'Laravel', 8000, 'php artisan serve']];

// what marks a folder as holding an app's codebase (any one is enough); the framework is read from the first ones
const CODEBASE_FILES = ['package.json', 'manage.py', 'Gemfile', 'mix.exs', 'artisan', 'go.mod', 'Cargo.toml', 'pyproject.toml', 'requirements.txt', 'composer.json', 'pom.xml', 'build.gradle', 'deno.json', 'index.html'];
const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', 'out', 'target', 'coverage', 'tmp', 'Library', 'Applications', 'Pictures', 'Music', 'Movies']);
const hasCodebase = (dir) => CODEBASE_FILES.some((f) => fs.existsSync(path.join(dir, f)));

/** Folders one and two levels below `dir` that hold a codebase (a monorepo's apps, a repo inside a projects folder).
 * Hidden folders, dependency and build folders are skipped, symbolic links are not followed, and the look is capped. */
export function codebasesBelow(dir, { max = 6, cap = 400 } = {}) {
  const out = [];
  let seen = 0;
  const list = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory() && !x.name.startsWith('.') && !SKIP_DIRS.has(x.name)).map((x) => x.name).sort(); } catch { return []; } };
  const level1 = list(dir);
  for (const a of level1) { if (++seen > cap || out.length >= max) break; const d = path.join(dir, a); if (hasCodebase(d)) out.push(d); }
  if (out.length < max) for (const a of level1) {
    const d1 = path.join(dir, a);
    if (out.includes(d1)) continue;
    for (const b of list(d1)) { if (++seen > cap || out.length >= max) break; const d = path.join(d1, b); if (hasCodebase(d)) out.push(d); }
  }
  return out.map((folder) => ({ folder, rel: path.relative(dir, folder) + '/', kind: kindOf(folder) }));
}
function kindOf(dir) {
  try { const f = path.join(dir, 'package.json'); if (fs.statSync(f).size > 300_000) throw 0; const pkg = JSON.parse(fs.readFileSync(f, 'utf8')); const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) }; const k = NODE_KINDS.find(([d]) => deps[d]); return k ? k[1] : null; } catch {}
  const k = FILE_KINDS.find(([f]) => fs.existsSync(path.join(dir, f)));
  return k ? k[1] : null;
}

/**
 * Check the folder the user gave: absolute, inside the home folder (not the home folder itself), a folder that holds an
 * app's codebase. When it does not, the codebases one and two folders down are offered (`candidates`).
 * Returns what the brief shows and suggests: its name, the framework, the start command and the usual address.
 */
export function checkFolder(input, { home = os.homedir() } = {}) {
  const raw = String(input ?? '').trim().replace(/^~(?=$|\/)/, home);
  if (!raw) return { ok: false, error: 'Give the folder containing your app\'s codebase, or use Choose folder.' };
  if (!path.isAbsolute(raw)) return { ok: false, error: 'Give the whole path to the folder containing your codebase, for example ~/code/my-app, or use Choose folder.' };
  let real;
  try { real = fs.realpathSync(raw); } catch { return { ok: false, error: 'Nothing at that path. Use Choose folder to pick the folder containing your codebase.' }; }
  let homeReal = home; try { homeReal = fs.realpathSync(home); } catch {}
  if (real === homeReal || !real.startsWith(homeReal + path.sep)) return { ok: false, error: 'The folder containing your codebase must be inside your home folder (and not the home folder itself).' };
  if (!fs.statSync(real).isDirectory()) return { ok: false, error: 'That is a file. Give the folder containing your codebase.' };
  if (!hasCodebase(real)) {
    const candidates = codebasesBelow(real);
    const k = (c) => `${c.rel}${c.kind ? ` (${c.kind})` : ''}`;
    if (candidates.length === 1) return { ok: false, folder: real, candidates, error: `Your app's codebase looks like it's in ${k(candidates[0])}. Use that folder?` };
    if (candidates.length > 1) return { ok: false, folder: real, candidates, error: `This folder holds ${candidates.length} codebases. Pick the one for your app.` };
    return { ok: false, folder: real, candidates: [], error: 'This folder doesn\'t contain a codebase: no package.json, manage.py, Gemfile, go.mod or similar in it or in the two folders below. Choose the folder containing your app\'s codebase. It does not need to be a git repository.' };
  }
  const has = (f) => fs.existsSync(path.join(real, f));
  let pkg = null;
  try { const f = path.join(real, 'package.json'); if (fs.statSync(f).size < 300_000) pkg = JSON.parse(fs.readFileSync(f, 'utf8')); } catch {}
  const scripts = pkg && pkg.scripts && typeof pkg.scripts === 'object' ? pkg.scripts : {};
  const deps = pkg ? { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) } : {};
  let kind = null, port = null, command = null;
  if (pkg) {
    const k = NODE_KINDS.find(([d]) => deps[d]);
    if (k) { kind = k[1]; port = k[2]; }
    const runner = has('pnpm-lock.yaml') ? 'pnpm' : has('yarn.lock') ? 'yarn' : has('bun.lockb') || has('bun.lock') ? 'bun' : 'npm';
    const script = ['dev', 'start', 'serve'].find((s) => typeof scripts[s] === 'string');
    if (script) {
      command = runner === 'npm' ? (script === 'start' ? 'npm start' : `npm run ${script}`) : `${runner} ${script}`;
      const m = /(?:--port[ =]|-p\s+|PORT=)(\d{2,5})\b/.exec(scripts[script]);
      if (m) port = Number(m[1]);
    }
  } else {
    const k = FILE_KINDS.find(([f]) => has(f));
    if (k) { kind = k[1]; port = k[2]; command = k[3]; }
  }
  return {
    ok: true, folder: real, name: (pkg && typeof pkg.name === 'string' && pkg.name.slice(0, 80)) || path.basename(real),
    kind, scripts: Object.keys(scripts).slice(0, 12), command, address: port ? `http://localhost:${port}/` : null,
    git: has('.git'), installed: pkg ? has('node_modules') : null,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// the folder picker: a browser never gives a page the full path of a folder, so the brief's own server (on this
// computer) opens the system's folder dialog. Fixed arguments only: nothing from the page reaches the command.

const PICK_PROMPT = 'Choose the folder containing your app\'s codebase';
let picking = false;
/** The command that opens a folder dialog here, or null (Linux without zenity, or another system). */
export function pickerCommand(platform = process.platform, { which = (c) => { try { return execFileSync('which', [c], { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return ''; } } } = {}) {
  if (platform === 'darwin') return ['osascript', ['-e', 'tell me to activate', '-e', `POSIX path of (choose folder with prompt "${PICK_PROMPT}" default location (path to home folder))`]];
  if (platform === 'win32') return ['powershell.exe', ['-NoProfile', '-STA', '-Command', `Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.Description = '${PICK_PROMPT.replace(/'/g, "''")}'; if ($f.ShowDialog() -eq 'OK') { $f.SelectedPath }`]];
  if (platform === 'linux' && which('zenity')) return ['zenity', ['--file-selection', '--directory', `--title=${PICK_PROMPT}`]];
  return null;
}
/** Open the folder dialog and wait for the choice. { ok, folder } | { ok: false, cancelled } | { ok: false, unavailable } |
 * { ok: false, busy }. The chosen folder is checked like a typed one. */
export async function pickFolder({ platform = process.platform, run = null, timeoutMs = 300_000 } = {}) {
  const cmd = pickerCommand(platform);
  if (!cmd) return { ok: false, unavailable: true };
  if (picking) return { ok: false, busy: true, error: 'The folder picker is already open on your computer.' };
  picking = true;
  try {
    const out = await (run ? run(cmd[0], cmd[1]) : new Promise((resolve) => execFile(cmd[0], cmd[1], { timeout: timeoutMs, windowsHide: false }, (err, stdout) => resolve(err ? null : String(stdout)))));
    const folder = String(out || '').trim().replace(/\/+$/, '');
    if (!folder) return { ok: false, cancelled: true };
    return { ok: true, folder };
  } finally { picking = false; }
}

/** Does the local address answer? (Only local addresses are tried.) */
export async function answers(address, { timeoutMs = 2500, fetchImpl = globalThis.fetch } = {}) {
  const a = localAddress(address);
  if (!a) return { up: false, why: 'not a local address' };
  // "localhost" may resolve to ::1 or 127.0.0.1, and a dev server may listen on only one of them: try each
  const u = new URL(a);
  const tries = u.hostname === 'localhost' ? [a, a.replace('//localhost', '//127.0.0.1'), a.replace('//localhost', '//[::1]')] : [a];
  let why = 'nothing is answering there yet';
  for (const t of tries) {
    try {
      const r = await fetchImpl(t, { redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      return { up: true, status: r.status, reached: t };
    } catch (err) { if (err?.name === 'TimeoutError') why = 'no answer in time'; }
  }
  return { up: false, why };
}

// ---- starting the app: a task for the AI session (the page server never runs it) ----

const TASK = 'local-start';
const taskFile = (projectDir) => path.join(projectDir, 'tasks', `${TASK}.task.md`);
const answerFile = (projectDir) => path.join(projectDir, 'tasks', `${TASK}.answer.json`);

/** Ask the AI session to start the app: a task it picks up with `wait.mjs <project> task`. */
export function writeStartTask(projectDir, { folder, command, address }) {
  const f = checkFolder(folder);
  if (!f.ok) return { ok: false, error: f.error };
  const cmd = startCommand(command);
  if (!cmd) return { ok: false, error: 'Give the command that starts your app, on one line.' };
  const addr = localAddress(address);
  if (!addr) return { ok: false, error: 'The address must be on this computer, for example http://localhost:3000.' };
  fs.mkdirSync(path.dirname(taskFile(projectDir)), { recursive: true });
  try { fs.rmSync(answerFile(projectDir), { force: true }); } catch {}
  fs.writeFileSync(taskFile(projectDir), `# Start the user's app on this computer (D-117)

The user asked Ultrademo to start their product so it can be read and captured.

- Folder: \`${f.folder}\`
- Command, exactly as the user wrote it: \`${cmd}\`
- It should answer at: ${addr}

1. If ${addr} already answers, do not start anything: write the answer with \`"started": false\`.
2. Otherwise run the command in that folder **in the background** (it keeps running), exactly as written. If it needs its
   dependencies installed first (no node_modules), ask the user before installing anything. Never change, add or delete a
   file in that folder.
3. Wait until ${addr} answers (up to two minutes), then write the answer.
4. Keep it running while the video is made; stop it when the review is approved, or when the user asks, and say so.

Answer in \`${answerFile(projectDir)}\`:
\`\`\`json
{ "ok": true, "started": true, "note": "" }
\`\`\`
or \`{ "ok": false, "why": "what went wrong, in plain words" }\`. The brief page shows the answer and carries on by itself.
`);
  return { ok: true, folder: f.folder, command: cmd, address: addr };
}

/** Where the start task is: none, waiting for the AI session, done or failed. */
export function startState(projectDir) {
  if (!fs.existsSync(taskFile(projectDir))) return { state: 'none' };
  let a = null;
  try { if (fs.statSync(answerFile(projectDir)).mtimeMs >= fs.statSync(taskFile(projectDir)).mtimeMs) a = JSON.parse(fs.readFileSync(answerFile(projectDir), 'utf8')); } catch {}
  if (!a) return { state: 'waiting' };
  return a.ok ? { state: 'done', started: a.started !== false, note: String(a.note || '').slice(0, 300) } : { state: 'failed', why: String(a.why || 'it did not start').slice(0, 300) };
}

// ---- the code read: done by the AI session with its own file tools, read only ----

const list = (shape) => z.array(shape).default([]);
export const CodeReadSchema = z.object({
  summary: z.string().describe('what the product is and does, from its code, in two or three sentences'),
  framework: z.string().default(''),
  screens: list(z.object({ route: z.string(), name: z.string(), what: z.string() })).describe('the app\'s pages or screens: route, name, what it shows'),
  flows: list(z.object({ name: z.string(), steps: z.array(z.string()) })).describe('the main things a user does, step by step, with the real button and field labels'),
  not_live: list(z.string()).describe('features in the code that the public site does not show yet'),
  wording: list(z.object({ where: z.string(), text: z.string() })).describe('real labels, headings, empty states and messages, as written in the code'),
  sample_data: list(z.object({ what: z.string(), values: z.array(z.string()) })).describe('seed or fixture data the screens can show (made-up records, never real customers)'),
  tokens: z.object({
    colors: list(z.object({ name: z.string(), value: z.string() })), fonts: list(z.string()), radius: z.string().default(''), spacing: z.string().default(''),
  }).default({ colors: [], fonts: [], radius: '', spacing: '' }).describe('the design tokens: colours with their names, font families, corner radius, spacing scale'),
  components: list(z.object({ name: z.string(), file: z.string(), what: z.string() })).describe('the UI components that matter for the video (buttons, cards, tables, the app shell), with their file paths'),
  sign_in: z.object({
    how: z.string().default(''), dev_bypass: z.string().default(''), seed_user: z.string().default(''),
    env_names: list(z.string()),
  }).default({ how: '', dev_bypass: '', seed_user: '', env_names: [] }).describe('how sign-in works locally: the provider, any development bypass, a seed or test user (never a password), the names (never the values) of the env variables it needs'),
});

/** The task text for the code read: what to read, what never to open, what to write. */
export function codeReadPrompt(local) {
  return `# Read the product's code (D-117)

The product's code is in \`${local.folder}\`. Read it with your own file tools to learn what the video can show. Read only:
never change, add, delete, build, install or run anything in that folder.

Never open: \`.env\` files of any kind, keys or certificates (\`*.pem\`, \`*.key\`, \`*.p12\`), anything named secret or
credentials, \`.git/\` internals, \`node_modules/\`, build output (\`.next/\`, \`dist/\`, \`build/\`, \`out/\`). Env variables
are reported by name only, never their values. Sample data is made-up records from seeds and fixtures, never real
customers.

Look at: the routes or pages, the main flows with their real labels, the wording on screen, the seed and fixture data,
the design tokens (CSS variables, Tailwind config, theme files), the main UI components, and how sign-in works when the
app runs locally (a development bypass, a seed user).${local.address ? ` The app runs at ${local.address} when started.` : ''}${local.wants ? `

The user asked for these pages or parts; find them in the code first: "${local.wants}"` : ''}

Answer with the JSON this schema describes. Keep it to what helps make a product video: at most 30 screens, 8 flows,
40 wording lines, 10 sample sets, 20 colours, 15 components.`;
}

/** The code read, when the AI session has done it. */
export function readCodeRead(projectDir) {
  try { return CodeReadSchema.parse(JSON.parse(fs.readFileSync(path.join(projectDir, 'code', 'read.json'), 'utf8'))); } catch { return null; }
}
export function writeCodeRead(projectDir, data) {
  fs.mkdirSync(path.join(projectDir, 'code'), { recursive: true });
  fs.writeFileSync(path.join(projectDir, 'code', 'read.json'), JSON.stringify(data, null, 1) + '\n');
}

/** The code read, short, for the outline and the directions prompts. */
export function codeReadBlock(read) {
  if (!read) return '';
  const cap = (a, n) => (a || []).slice(0, n);
  return `

# The product's code, as read (D-117)
${read.summary}${read.framework ? ` (${read.framework})` : ''}
Screens: ${cap(read.screens, 30).map((s) => `${s.name} (${s.route}): ${s.what}`).join('; ') || 'none listed'}
Flows: ${cap(read.flows, 8).map((f) => `${f.name}: ${f.steps.join(' → ')}`).join(' | ') || 'none listed'}
${read.not_live.length ? `In the code, not on the public site yet: ${read.not_live.join('; ')}\n` : ''}Wording on screen: ${cap(read.wording, 40).map((w) => `"${w.text}" (${w.where})`).join('; ') || 'none listed'}
Sample data: ${cap(read.sample_data, 10).map((s) => `${s.what}: ${s.values.slice(0, 6).join(', ')}`).join('; ') || 'none listed'}
Design tokens: colours ${cap(read.tokens.colors, 20).map((c) => `${c.name} ${c.value}`).join(', ') || 'none'}; fonts ${read.tokens.fonts.join(', ') || 'none'}${read.tokens.radius ? `; radius ${read.tokens.radius}` : ''}
Use the code's own labels and sample data on screen; never show a local address (localhost) anywhere in the video.`;
}
