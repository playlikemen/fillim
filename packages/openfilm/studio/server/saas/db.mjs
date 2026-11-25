// @ts-check
/**
 * Lakebase Postgres (Neon) persistence for Fillim SaaS:
 * users, project ownership & workspace metadata, and usage events.
 * Uses @neondatabase/serverless over HTTPS (port 443). Active only when DATABASE_URL is configured.
 */
import dns from 'node:dns';
import net from 'node:net';
import { neon } from '@neondatabase/serverless';

dns.setDefaultResultOrder('ipv4first');
net.setDefaultAutoSelectFamilyAttemptTimeout(5000);

/** @type {ReturnType<typeof neon> | null} */
let sqlClient = null;
/** @type {Promise<void> | null} */
let schemaReady = null;

export const dbConfigured = () => Boolean(process.env.DATABASE_URL?.trim());

function getSql() {
  if (!sqlClient) {
    const connectionString = process.env.DATABASE_URL?.trim();
    if (!connectionString) throw new Error('DATABASE_URL is not configured');
    sqlClient = neon(connectionString);
  }
  return sqlClient;
}

/**
 * Execute a parameterized SQL query over Neon's serverless HTTPS driver.
 * @param {string} text
 * @param {unknown[]} [params]
 * @returns {Promise<Record<string, any>[]>}
 */
export async function query(text, params = []) {
  const rows = await getSql().query(text, params);
  return /** @type {Record<string, any>[]} */ (rows);
}

/** Close/reset cached Neon client cleanly on server shutdown. */
export async function closeDb() {
  sqlClient = null;
  schemaReady = null;
}

/**
 * Idempotent schema bootstrap for Fillim SaaS tables.
 * Uses DATABASE_URL_UNPOOLED when present so DDL runs directly against Neon.
 */
export async function ensureSchema() {
  if (!dbConfigured()) return;
  if (schemaReady) return schemaReady;
  schemaReady = (async () => {
    const ddlUrl = process.env.DATABASE_URL_UNPOOLED?.trim() || process.env.DATABASE_URL?.trim();
    if (!ddlUrl) return;
    const ddl = neon(ddlUrl);
    const statements = [
      `CREATE TABLE IF NOT EXISTS saas_users (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL,
        name TEXT NOT NULL DEFAULT '',
        plan TEXT NOT NULL DEFAULT 'free',
        credits_remaining INTEGER NOT NULL DEFAULT 100,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE TABLE IF NOT EXISTS saas_projects (
        id TEXT PRIMARY KEY,
        owner_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        disk_path TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_saas_projects_owner ON saas_projects (owner_id, last_opened_at DESC)`,
      `CREATE TABLE IF NOT EXISTS saas_usage_events (
        id BIGSERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES saas_users(id) ON DELETE CASCADE,
        project_id TEXT,
        event_type TEXT NOT NULL,
        credits_delta INTEGER NOT NULL DEFAULT 0,
        meta JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
      `CREATE INDEX IF NOT EXISTS idx_saas_usage_user ON saas_usage_events (user_id, created_at DESC)`,
    ];
    for (const stmt of statements) {
      await ddl.query(stmt, []);
    }
  })().catch((err) => {
    schemaReady = null;
    throw err;
  });
  return schemaReady;
}

/**
 * Upsert a Neon Auth user into saas_users and return their SaaS profile.
 * @param {{ id: string, email: string, name?: string | null }} user
 */
export async function ensureUser(user) {
  await ensureSchema();
  const rows = await query(
    `INSERT INTO saas_users (id, email, name)
     VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET
       email = EXCLUDED.email,
       name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE saas_users.name END,
       updated_at = NOW()
     RETURNING id, email, name, plan, credits_remaining, created_at, updated_at`,
    [user.id, user.email, (user.name ?? '').trim()]
  );
  return rows[0];
}

/**
 * Fetch a user's profile, project count, and recent usage events.
 * @param {string} userId
 */
export async function getUserProfile(userId) {
  await ensureSchema();
  const userRows = await query(
    `SELECT u.id, u.email, u.name, u.plan, u.credits_remaining, u.created_at, u.updated_at,
            (SELECT COUNT(*)::int FROM saas_projects p WHERE p.owner_id = u.id) AS project_count
       FROM saas_users u
      WHERE u.id = $1`,
    [userId]
  );
  if (!userRows[0]) return null;
  const events = await query(
    `SELECT id, project_id, event_type, credits_delta, meta, created_at
       FROM saas_usage_events
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
    [userId]
  );
  return { ...userRows[0], recent_events: events };
}

/**
 * List project IDs owned by a user, most recently opened first.
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, owner_id: string, name: string, disk_path: string, last_opened_at: string }>>}
 */
export async function listOwnedProjects(userId) {
  await ensureSchema();
  return /** @type {any} */ (await query(
    `SELECT id, owner_id, name, disk_path, last_opened_at
       FROM saas_projects
      WHERE owner_id = $1
      ORDER BY last_opened_at DESC`,
    [userId]
  ));
}

/**
 * Look up who owns a given project ID.
 * @param {string} projectId
 * @returns {Promise<{ id: string, owner_id: string, name: string, disk_path: string } | null>}
 */
export async function getProjectOwner(projectId) {
  await ensureSchema();
  const rows = await query(
    `SELECT id, owner_id, name, disk_path FROM saas_projects WHERE id = $1`,
    [projectId]
  );
  return /** @type {any} */ (rows[0] ?? null);
}

/**
 * Register or update ownership of a project in Postgres.
 * @param {string} userId
 * @param {{ id: string, name: string, path: string }} project
 */
export async function upsertOwnedProject(userId, project) {
  await ensureSchema();
  await query(
    `INSERT INTO saas_projects (id, owner_id, name, disk_path)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       owner_id = EXCLUDED.owner_id,
       name = EXCLUDED.name,
       disk_path = EXCLUDED.disk_path,
       last_opened_at = NOW(),
       updated_at = NOW()`,
    [project.id, userId, project.name, project.path]
  );
}

/**
 * Update project name/path after a rename.
 * @param {string} userId
 * @param {string} projectId
 * @param {string} name
 * @param {string} diskPath
 */
export async function renameOwnedProject(userId, projectId, name, diskPath) {
  await ensureSchema();
  await query(
    `UPDATE saas_projects
        SET name = $3, disk_path = $4, updated_at = NOW()
      WHERE id = $1 AND owner_id = $2`,
    [projectId, userId, name, diskPath]
  );
}

/**
 * Update last_opened_at when a user opens a project.
 * @param {string} userId
 * @param {string} projectId
 */
export async function touchOwnedProject(userId, projectId) {
  await ensureSchema();
  await query(
    `UPDATE saas_projects SET last_opened_at = NOW() WHERE id = $1 AND owner_id = $2`,
    [projectId, userId]
  );
}

/**
 * Remove a deleted project from saas_projects.
 * @param {string} userId
 * @param {string} projectId
 */
export async function deleteOwnedProject(userId, projectId) {
  await ensureSchema();
  await query(
    `DELETE FROM saas_projects WHERE id = $1 AND owner_id = $2`,
    [projectId, userId]
  );
}

/**
 * Record a SaaS usage event and optionally adjust credits_remaining.
 * @param {string} userId
 * @param {string} eventType
 * @param {string | null} [projectId]
 * @param {number} [creditsDelta]
 * @param {Record<string, unknown>} [meta]
 */
export async function recordUsage(userId, eventType, projectId = null, creditsDelta = 0, meta = {}) {
  await ensureSchema();
  await query(
    `INSERT INTO saas_usage_events (user_id, project_id, event_type, credits_delta, meta)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [userId, projectId, eventType, creditsDelta, JSON.stringify(meta)]
  );
  if (creditsDelta !== 0) {
    await query(
      `UPDATE saas_users
          SET credits_remaining = GREATEST(0, credits_remaining + $2), updated_at = NOW()
        WHERE id = $1`,
      [userId, creditsDelta]
    );
  }
}
