// @ts-check
/**
 * Fillim AI Film Director backend for browser Studio chat.
 * Reads and edits the active project's film.html and deterministic HTML shots
 * using Claude (ANTHROPIC_API_KEY with automatic Neon AI Gateway fallback).
 */
import dns from 'node:dns';
import net from 'node:net';
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

const CHAT_DIR = '.film/chat';
const CHAT_FILE = 'director.json';
const DEFAULT_MODEL = 'claude-sonnet-4-5';
const MAX_TOOL_TURNS = 6;
const MAX_HISTORY_MESSAGES = 20;
const MAX_READ_BYTES = 120_000;
const MAX_WRITE_BYTES = 200_000;

/** Load missing env keys from repo .env.local or .env once when run outside systemd.
 * @param {string} name
 */
function readEnvVar(name) {
  const direct = process.env[name]?.trim();
  if (direct) return direct;
  const candidates = [
    resolve(process.cwd(), '../../.env.local'),
    resolve(process.cwd(), '../../.env'),
    resolve(process.cwd(), '.env.local'),
    resolve(process.cwd(), '.env'),
  ];
  for (const file of candidates) {
    if (!existsSync(file)) continue;
    try {
      const txt = readFileSync(file, 'utf8');
      const m = txt.match(new RegExp(`^${name}=(.+)$`, 'm'));
      if (m?.[1]) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* ignore */ }
  }
  return '';
}

export function aiChatConfigured() {
  return Boolean(
    readEnvVar('ANTHROPIC_API_KEY')
    || (readEnvVar('NEON_AI_GATEWAY_BASE_URL') && readEnvVar('NEON_AI_GATEWAY_TOKEN')),
  );
}

const DIRECTOR_SYSTEM_PROMPT = `You are Fillim AI Director, a film engineering assistant inside Fillim Studio.
Every project is an OpenFilm folder containing:
- \`film.html\`: root timeline (<meta name="viewport" content="width=1920, height=1080"> with <section> tracks containing <iframe>, <video>, <img>, <audio> clips using attributes src="file.html#t=0,4", at="0", volume, speed).
- Standalone HTML shot pages (e.g. \`title.html\`, \`shots/scene.html\`) defining:
  <script type="module">
  window.film = {
    duration: 4,
    frame(t) { /* render exact visual state at t seconds (0..duration) deterministically */ }
  };
  </script>

Strict OpenFilm rules:
1. A shot page MUST depend only on \`t\` passed into \`window.film.frame(t)\`. Never use setInterval, requestAnimationFrame loops, or CSS autoplay animations inside a page clip's internal script; drive DOM/style changes cleanly from \`t\`.
2. Inspect the project files first with \`list_project_files\` / \`read_project_file\` before overwriting existing cuts so you preserve the user's \`overrides\` and manual edits unless asked to replace them.
3. Keep styles crisp, legible at 1920x1080, with zero external CDN dependencies so headless Chromium MP4 exports match live Studio playback pixel-for-pixel. Unless the user requests another style, prefer clean high-contrast print aesthetics (#f6eae6 rag paper, #161615 booth black, #ca281b crimson, #087774 teal, #193885 cobalt) instead of generic purple gradients.
4. Keep responses concise and report exact file changes and timestamps.`;

const DIRECTOR_TOOLS = [
  {
    name: 'list_project_files',
    description: 'List files in this film project directory (film.html, HTML shots, assets).',
    input_schema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: 'read_project_file',
    description: 'Read a text file inside this film project (e.g. film.html or a shot .html file).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside project folder, e.g. film.html' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
  {
    name: 'write_project_file',
    description: 'Create or update a file inside this film project (film.html, shots/*.html, CSS, SVG).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path inside project folder' },
        content: { type: 'string', description: 'Full file content' },
      },
      required: ['path', 'content'],
      additionalProperties: false,
    },
  },
  {
    name: 'delete_project_file',
    description: 'Remove an unused file inside the project folder (never deletes .film metadata).',
    input_schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Relative path to delete' },
      },
      required: ['path'],
      additionalProperties: false,
    },
  },
];

/** @param {string} root @param {string} rel */
function resolveSafePath(root, rel) {
  const clean = String(rel ?? '').trim().replace(/^[/\\]+/, '');
  if (!clean || clean.includes('\0')) throw new Error('Invalid file path.');
  const base = resolve(root);
  const full = resolve(base, clean);
  if (full !== base && !full.startsWith(base + sep)) throw new Error('Path escapes project directory.');
  const relOut = relative(base, full);
  const firstSeg = relOut.split(sep)[0];
  if (firstSeg === '.film' || firstSeg === '.git' || firstSeg === 'node_modules') {
    throw new Error('Cannot access internal dot/module directory.');
  }
  return { full, rel: relOut.replace(/\\/g, '/') };
}

/** @param {string} root @returns {Array<{ path: string, bytes: number }>} */
function listFilesRecursive(root) {
  const base = resolve(root);
  /** @type {Array<{ path: string, bytes: number }>} */
  const out = [];
  /** @type {(dir: string, depth: number) => void} */
  const walk = (dir, depth) => {
    if (depth > 4 || out.length >= 120) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const ent of entries) {
      if (ent.name.startsWith('.') || ent.name === 'node_modules') continue;
      const abs = join(dir, ent.name);
      if (ent.isDirectory()) walk(abs, depth + 1);
      else if (ent.isFile()) {
        try {
          const st = statSync(abs);
          out.push({ path: relative(base, abs).replace(/\\/g, '/'), bytes: st.size });
        } catch { /* ignore */ }
      }
    }
  };
  walk(base, 0);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

/** @param {string} projectRoot */
export function loadChatHistory(projectRoot) {
  const file = join(projectRoot, CHAT_DIR, CHAT_FILE);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** @param {string} projectRoot @param {unknown[]} messages */
export function saveChatHistory(projectRoot, messages) {
  const dir = join(projectRoot, CHAT_DIR);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, CHAT_FILE), JSON.stringify(messages.slice(-40), null, 2));
}

/**
 * Call Claude Messages API via ANTHROPIC_API_KEY first, falling back seamlessly
 * to NEON_AI_GATEWAY_BASE_URL + NEON_AI_GATEWAY_TOKEN when configured.
 * @param {Record<string, unknown>} payload
 */
async function callClaude(payload) {
  const model = readEnvVar('FILLIM_CHAT_MODEL') || readEnvVar('ANTHROPIC_MODEL') || DEFAULT_MODEL;
  const anthropicKey = readEnvVar('ANTHROPIC_API_KEY');
  const anthropicBase = (readEnvVar('ANTHROPIC_BASE_URL') || 'https://api.anthropic.com').replace(/\/+$/, '');
  const gwBase = readEnvVar('NEON_AI_GATEWAY_BASE_URL').replace(/\/+$/, '');
  const gwToken = readEnvVar('NEON_AI_GATEWAY_TOKEN');

  /** @type {Array<{ name: string, url: string, headers: Record<string, string> }>} */
  const targets = [];
  if (anthropicKey) {
    targets.push({
      name: 'anthropic',
      url: `${anthropicBase}/v1/messages`,
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });
  }
  if (gwBase && gwToken) {
    targets.push({
      name: 'gateway',
      url: `${gwBase}/anthropic/v1/messages`,
      headers: {
        'x-api-key': gwToken,
        authorization: `Bearer ${gwToken}`,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
    });
  }

  if (targets.length === 0) {
    throw new Error('AI Director is not configured. Add ANTHROPIC_API_KEY to .env to enable Studio AI chat.');
  }

  /** @type {string[]} */
  const errors = [];
  for (const target of targets) {
    try {
      const res = await fetch(target.url, {
        method: 'POST',
        headers: target.headers,
        body: JSON.stringify({ model, max_tokens: 4096, ...payload }),
      });
      const text = await res.text();
      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(text);
          msg = parsed?.error?.message || parsed?.message || msg;
        } catch { /* keep HTTP status */ }
        errors.push(`${target.name}: ${msg}`);
        continue;
      }
      return { data: JSON.parse(text), provider: target.name, model };
    } catch (err) {
      errors.push(`${target.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  throw new Error(`AI request failed (${errors.join(' | ')})`);
}

/** Execute one tool call safely inside projectRoot.
 * @param {string} projectRoot
 * @param {string} name
 * @param {Record<string, any>} input
 * @param {Set<string>} changedSet
 */
function runTool(projectRoot, name, input, changedSet) {
  if (name === 'list_project_files') {
    return JSON.stringify({ files: listFilesRecursive(projectRoot) });
  }
  if (name === 'read_project_file') {
    const { full, rel } = resolveSafePath(projectRoot, input?.path);
    if (!existsSync(full)) return JSON.stringify({ error: `File not found: ${rel}` });
    const raw = readFileSync(full);
    if (raw.length > MAX_READ_BYTES) {
      return JSON.stringify({ path: rel, truncated: true, content: raw.subarray(0, MAX_READ_BYTES).toString('utf8') });
    }
    return JSON.stringify({ path: rel, content: raw.toString('utf8') });
  }
  if (name === 'write_project_file') {
    const { full, rel } = resolveSafePath(projectRoot, input?.path);
    const content = String(input?.content ?? '');
    if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) {
      throw new Error(`File ${rel} exceeds ${MAX_WRITE_BYTES} byte limit.`);
    }
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content, 'utf8');
    changedSet.add(rel);
    return JSON.stringify({ ok: true, path: rel, bytes: Buffer.byteLength(content, 'utf8') });
  }
  if (name === 'delete_project_file') {
    const { full, rel } = resolveSafePath(projectRoot, input?.path);
    if (rel === 'film.html') throw new Error('Cannot delete film.html directly.');
    if (existsSync(full)) {
      rmSync(full, { force: true });
      changedSet.add(rel);
    }
    return JSON.stringify({ ok: true, deleted: rel });
  }
  throw new Error(`Unknown tool: ${name}`);
}

/**
 * Run a Director AI turn for a project and persist transcript + emit change callbacks.
 * @param {{ project: { id: string, name: string, path: string }, prompt: string, onFilesChanged?: (files: string[]) => void }} opts
 */
export async function runProjectDirectorChat({ project, prompt, onFilesChanged }) {
  const cleanPrompt = String(prompt ?? '').trim();
  if (!cleanPrompt) throw new Error('Enter a prompt for Fillim AI Director.');

  const history = loadChatHistory(project.path);
  /** @type {Array<{ role: 'user' | 'assistant', content: unknown }>} */
  const priorTurns = history
    .slice(-MAX_HISTORY_MESSAGES)
    .map((m) => ({
      role: /** @type {'user' | 'assistant'} */ (m.role === 'assistant' ? 'assistant' : 'user'),
      content: String(m.content ?? ''),
    }))
    .filter((m) => m.content.trim().length > 0);

  const filesSummary = listFilesRecursive(project.path).map((f) => f.path).join(', ') || '(empty)';
  const contextualUserMsg = `[Project: "${project.name}" (${project.id}) | Files: ${filesSummary}]\n\n${cleanPrompt}`;

  /** @type {Array<{ role: 'user' | 'assistant', content: unknown }>} */
  const apiMessages = [...priorTurns, { role: 'user', content: contextualUserMsg }];
  /** @type {Set<string>} */
  const changedSet = new Set();
  let finalReply = '';
  let lastProvider = '';
  let lastModel = '';

  for (let step = 0; step < MAX_TOOL_TURNS; step++) {
    const res = await callClaude({
      system: DIRECTOR_SYSTEM_PROMPT,
      messages: apiMessages,
      tools: DIRECTOR_TOOLS,
    });
    lastProvider = res.provider;
    lastModel = res.model;
    const blocks = /** @type {Array<Record<string, any>>} */ (Array.isArray(res.data?.content) ? res.data.content : []);
    const textParts = blocks.filter((b) => b?.type === 'text' && b.text).map((b) => String(b.text));
    const toolUses = blocks.filter((b) => b?.type === 'tool_use');

    if (toolUses.length === 0) {
      finalReply = textParts.join('\n\n').trim() || 'Updated your project files.';
      break;
    }

    apiMessages.push({ role: 'assistant', content: blocks });
    /** @type {Array<{ type: 'tool_result', tool_use_id: string, content: string, is_error?: boolean }>} */
    const results = [];
    for (const call of toolUses) {
      try {
        const out = runTool(project.path, call.name, call.input, changedSet);
        results.push({ type: 'tool_result', tool_use_id: call.id, content: out });
      } catch (err) {
        results.push({
          type: 'tool_result',
          tool_use_id: call.id,
          is_error: true,
          content: err instanceof Error ? err.message : String(err),
        });
      }
    }
    apiMessages.push({ role: 'user', content: results });

    if (step === MAX_TOOL_TURNS - 1 && textParts.length > 0) {
      finalReply = textParts.join('\n\n').trim();
    }
  }

  if (!finalReply) {
    finalReply = changedSet.size > 0
      ? `Applied edits to ${[...changedSet].join(', ')}.`
      : 'Reviewed project.';
  }

  const changedFiles = [...changedSet];
  if (changedFiles.length > 0 && onFilesChanged) {
    onFilesChanged(changedFiles);
  }

  const now = new Date().toISOString();
  const nextHistory = [
    ...history,
    { id: `u_${Date.now()}`, role: 'user', content: cleanPrompt, createdAt: now },
    { id: `a_${Date.now() + 1}`, role: 'assistant', content: finalReply, changedFiles, createdAt: now },
  ];
  saveChatHistory(project.path, nextHistory);

  return {
    messages: nextHistory,
    reply: finalReply,
    changedFiles,
    provider: lastProvider,
    model: lastModel,
  };
}
