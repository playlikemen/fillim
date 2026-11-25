import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export interface SaasUsageEvent {
  id: number;
  project_id: string | null;
  event_type: string;
  credits_delta: number;
  meta: Record<string, unknown>;
  created_at: string;
}

export interface SaasUser {
  id: string;
  email: string;
  name: string;
  plan: string;
  credits_remaining: number;
  project_count: number;
  created_at: string;
  updated_at: string;
  recent_events?: SaasUsageEvent[];
}

export interface SaasConfig {
  enabled: boolean;
  authProxyPath: string;
  repoUrl: string;
}

const authBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/auth` : 'http://127.0.0.1:4848/api/auth';

export const authClient = createAuthClient(authBaseUrl, {
  adapter: BetterAuthReactAdapter(),
});

export async function fetchSaasConfig(): Promise<SaasConfig> {
  try {
    const res = await fetch('/api/saas/config', { cache: 'no-store' });
    if (!res.ok) return { enabled: false, authProxyPath: '/api/auth', repoUrl: 'https://github.com/playlikemen/fillim' };
    return (await res.json()) as SaasConfig;
  } catch {
    return { enabled: false, authProxyPath: '/api/auth', repoUrl: 'https://github.com/playlikemen/fillim' };
  }
}

export async function fetchSaasMe(): Promise<{ enabled: boolean; user: SaasUser | null }> {
  try {
    const res = await fetch('/api/saas/me', { cache: 'no-store' });
    if (!res.ok) return { enabled: false, user: null };
    return (await res.json()) as { enabled: boolean; user: SaasUser | null };
  } catch {
    return { enabled: false, user: null };
  }
}

export async function syncSaasSession(): Promise<SaasUser | null> {
  let token = '';
  try {
    const jwt = await authClient.token();
    token = jwt?.data?.token ?? '';
  } catch { /* fall back to cookie verification */ }

  const res = await fetch('/api/saas/session', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(token ? { token } : {}),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { user?: SaasUser };
  return data.user ?? null;
}

export async function saasSignOut(): Promise<void> {
  await Promise.allSettled([
    authClient.signOut(),
    fetch('/api/saas/logout', { method: 'POST' }),
  ]);
}
