// @ts-check
/**
 * Neon Auth proxy and session verification for Fillim SaaS.
 * Proxies /api/auth/* same-origin to NEON_AUTH_BASE_URL and verifies
 * Neon Auth EdDSA JWTs against NEON_AUTH_JWKS_URL.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import dns from 'node:dns';
import net from 'node:net';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { dbConfigured, ensureUser } from './db.mjs';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

const SAAS_COOKIE = 'fillim_saas';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_AUTH_BODY = 1024 * 1024;

/** @type {ReturnType<typeof createRemoteJWKSet> | null} */
let jwks = null;
/** @type {string} */
let jwksUrlCached = '';

export const authConfigured = () => Boolean(
  process.env.NEON_AUTH_BASE_URL?.trim() && process.env.NEON_AUTH_JWKS_URL?.trim()
);

export const saasEnabled = () => dbConfigured() && authConfigured();

function getJwks() {
  const url = process.env.NEON_AUTH_JWKS_URL?.trim() ?? '';
  if (!url) throw new Error('NEON_AUTH_JWKS_URL is not configured');
  if (!jwks || jwksUrlCached !== url) {
    jwks = createRemoteJWKSet(new URL(url));
    jwksUrlCached = url;
  }
  return jwks;
}

/** @param {string} cookieHeader @param {string} name */
export function readCookie(cookieHeader, name) {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq).trim() === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

/**
 * Verify a Neon Auth JWT issued by NEON_AUTH_BASE_URL using NEON_AUTH_JWKS_URL.
 * @param {string} token
 * @returns {Promise<{ id: string, email: string, name: string } | null>}
 */
export async function verifyNeonJwt(token) {
  const rawBase = process.env.NEON_AUTH_BASE_URL?.trim();
  if (!token || !rawBase || !authConfigured()) return null;
  try {
    const baseUrl = new URL(rawBase);
    const { payload } = await jwtVerify(token, getJwks(), { issuer: baseUrl.origin });
    const id = typeof payload.sub === 'string' ? payload.sub : '';
    const email = typeof payload.email === 'string' ? payload.email : '';
    const name = typeof payload.name === 'string' ? payload.name : '';
    if (!id) return null;
    return { id, email, name };
  } catch {
    return null;
  }
}

/**
 * Fetch active Neon Auth session directly from NEON_AUTH_BASE_URL using incoming cookies.
 * @param {string} cookieHeader
 * @returns {Promise<{ id: string, email: string, name: string } | null>}
 */
export async function fetchUpstreamSession(cookieHeader) {
  const rawBase = process.env.NEON_AUTH_BASE_URL?.trim();
  if (!rawBase || !authConfigured() || !cookieHeader.includes('neon-auth.session_token')) return null;
  const baseUrl = rawBase.replace(/\/+$/, '');
  const upstreamOrigin = process.env.NEON_AUTH_UPSTREAM_ORIGIN?.trim() || 'http://localhost:4848';
  try {
    const res = await fetch(`${baseUrl}/get-session`, {
      method: 'GET',
      headers: {
        cookie: cookieHeader,
        origin: upstreamOrigin,
        'x-neon-auth-proxy': 'openfilm',
      },
    });
    if (!res.ok) return null;
    const data = /** @type {any} */ (await res.json().catch(() => null));
    const u = data?.user;
    if (!u?.id || typeof u.id !== 'string') return null;
    return { id: u.id, email: String(u.email ?? ''), name: String(u.name ?? '') };
  } catch {
    return null;
  }
}

/**
 * Mint an HMAC-signed HttpOnly session cookie value for Fillim SaaS.
 * @param {{ id: string, email: string, name: string }} user
 * @param {string} secret
 */
export function signSaasCookieValue(user, secret) {
  const payload = Buffer.from(JSON.stringify({
    id: user.id,
    email: user.email,
    name: user.name,
    exp: Date.now() + SESSION_TTL_MS,
  })).toString('base64url');
  const sig = createHmac('sha256', secret).update(`fillim-saas\0${payload}`).digest('base64url');
  return `${payload}.${sig}`;
}

/**
 * Verify and decode the fillim_saas HttpOnly cookie.
 * @param {string | undefined} rawCookieHeader
 * @param {string} secret
 * @returns {{ id: string, email: string, name: string } | null}
 */
export function verifySaasCookie(rawCookieHeader, secret) {
  const value = readCookie(rawCookieHeader ?? '', SAAS_COOKIE);
  if (!value) return null;
  const dot = value.indexOf('.');
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = createHmac('sha256', secret).update(`fillim-saas\0${payload}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data?.id || typeof data.exp !== 'number' || data.exp < Date.now()) return null;
    return { id: String(data.id), email: String(data.email ?? ''), name: String(data.name ?? '') };
  } catch {
    return null;
  }
}

/**
 * Format Set-Cookie header for fillim_saas.
 * @param {string} value
 * @param {{ secure: boolean, clear?: boolean }} opts
 */
export function saasSetCookieHeader(value, { secure, clear = false }) {
  const flags = [
    `${SAAS_COOKIE}=${clear ? '' : encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    ...(secure ? ['Secure'] : []),
    ...(clear ? ['Max-Age=0'] : [`Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`]),
  ];
  return flags.join('; ');
}

/**
 * Resolve the authenticated SaaS user from cookie, Bearer JWT, or Neon Auth session cookie.
 * @param {import('node:http').IncomingMessage} req
 * @param {string} secret
 * @returns {Promise<{ id: string, email: string, name: string } | null>}
 */
export async function resolveSaasUser(req, secret) {
  if (!saasEnabled()) return null;
  const fromCookie = verifySaasCookie(req.headers.cookie, secret);
  if (fromCookie) return fromCookie;

  const authHeader = String(req.headers.authorization ?? '');
  if (authHeader.startsWith('Bearer ')) {
    const jwtUser = await verifyNeonJwt(authHeader.slice(7).trim());
    if (jwtUser) {
      await ensureUser(jwtUser).catch(() => {});
      return jwtUser;
    }
  }

  const upstreamUser = await fetchUpstreamSession(String(req.headers.cookie ?? ''));
  if (upstreamUser) {
    await ensureUser(upstreamUser).catch(() => {});
    return upstreamUser;
  }
  return null;
}

/** Sanitize user ID for safe filesystem directory scoping. @param {string} userId */
export const safeUserDir = (userId) => String(userId).replace(/[^a-zA-Z0-9_-]/g, '_');

/**
 * Read request body up to MAX_AUTH_BODY bytes.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<Buffer | undefined>}
 */
async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  /** @type {Buffer[]} */
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > MAX_AUTH_BODY) throw Object.assign(new Error('Auth request body too large'), { status: 413 });
    chunks.push(buf);
  }
  return Buffer.concat(chunks);
}

/**
 * Proxy /api/auth/* same-origin requests to Neon Auth (NEON_AUTH_BASE_URL).
 * Also syncs saas_users + fillim_saas cookie when sign-in / sign-up / sign-out completes.
 * @param {import('node:http').IncomingMessage} req
 * @param {import('node:http').ServerResponse} res
 * @param {string} subpath
 * @param {URL} url
 * @param {{ secret: string, secure: boolean, isAllowedOrigin: (o: string | undefined) => boolean }} opts
 */
export async function proxyNeonAuth(req, res, subpath, url, { secret, secure, isAllowedOrigin }) {
  const rawBase = process.env.NEON_AUTH_BASE_URL?.trim();
  if (!rawBase || !authConfigured()) {
    res.writeHead(404, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Neon Auth is not configured' }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers.origin && !isAllowedOrigin(req.headers.origin)) {
    res.writeHead(403, { 'content-type': 'application/json' }).end(JSON.stringify({ error: 'Invalid origin' }));
    return;
  }

  const baseUrl = rawBase.replace(/\/+$/, '');
  const upstreamOrigin = process.env.NEON_AUTH_UPSTREAM_ORIGIN?.trim() || 'http://localhost:4848';
  const target = `${baseUrl}/${subpath}${url.search}`;

  const body = await readBody(req).catch((e) => {
    res.writeHead(e?.status ?? 400, { 'content-type': 'application/json' }).end(JSON.stringify({ error: e.message }));
    return null;
  });
  if (body === null) return;

  /** @type {Record<string, string>} */
  const headers = {
    origin: upstreamOrigin,
    'x-neon-auth-proxy': 'openfilm',
  };
  for (const key of ['content-type', 'accept', 'authorization', 'user-agent', 'cookie']) {
    const val = req.headers[key];
    if (typeof val === 'string' && val) headers[key] = val;
  }

  let upstream;
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers,
      body: body && body.length > 0 ? new Uint8Array(body) : undefined,
    });
  } catch (err) {
    res.writeHead(502, { 'content-type': 'application/json' }).end(JSON.stringify({ error: String(/** @type {Error} */ (err)?.message ?? 'Auth upstream error') }));
    return;
  }

  const rawBody = Buffer.from(await upstream.arrayBuffer());
  /** @type {string[]} */
  const setCookies = [];
  const rawSetCookies = typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : [];
  for (const raw of rawSetCookies) {
    const cleaned = raw
      .replace(/;\s*Domain=[^;]*/gi, '')
      .replace(/;\s*Partitioned/gi, '')
      .replace(/;\s*SameSite=[^;]*/gi, '; SameSite=Lax')
      .replace(/;\s*Secure/gi, secure ? '; Secure' : '');
    setCookies.push(cleaned);
  }

  if (subpath === 'sign-out' && upstream.ok) {
    setCookies.push(saasSetCookieHeader('', { secure, clear: true }));
  } else if (upstream.ok && (subpath === 'sign-in/email' || subpath === 'sign-up/email' || subpath === 'get-session')) {
    try {
      const parsed = JSON.parse(rawBody.toString('utf8'));
      const u = parsed?.user;
      if (u?.id) {
        const user = { id: String(u.id), email: String(u.email ?? ''), name: String(u.name ?? '') };
        await ensureUser(user).catch(() => {});
        setCookies.push(saasSetCookieHeader(signSaasCookieValue(user, secret), { secure }));
      }
    } catch { /* non-JSON or no user */ }
  }

  /** @type {Record<string, string | string[]>} */
  const outHeaders = { 'cache-control': 'no-store' };
  const ct = upstream.headers.get('content-type');
  if (ct) outHeaders['content-type'] = ct;
  const setJwt = upstream.headers.get('set-auth-jwt');
  if (setJwt) outHeaders['set-auth-jwt'] = setJwt;
  if (setCookies.length) outHeaders['set-cookie'] = setCookies;

  res.writeHead(upstream.status, outHeaders).end(rawBody);
}
