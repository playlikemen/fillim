import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export type OAuthProvider = 'google' | 'microsoft' | 'github';

export const OAUTH_PROVIDER_LABELS: Record<OAuthProvider, string> = {
  google: 'Google',
  microsoft: 'Microsoft',
  github: 'GitHub',
};

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
  oauthProviders?: OAuthProvider[];
  repoUrl: string;
}

const authBaseUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/auth` : 'http://127.0.0.1:4848/api/auth';

export const authClient = createAuthClient(authBaseUrl, {
  adapter: BetterAuthReactAdapter(),
});

export async function fetchSaasConfig(): Promise<SaasConfig> {
  try {
    const res = await fetch('/api/saas/config', { cache: 'no-store' });
    if (!res.ok) {
      return {
        enabled: false,
        authProxyPath: '/api/auth',
        oauthProviders: ['google', 'microsoft', 'github'],
        repoUrl: 'https://github.com/playlikemen/fillim',
      };
    }
    return (await res.json()) as SaasConfig;
  } catch {
    return {
      enabled: false,
      authProxyPath: '/api/auth',
      oauthProviders: ['google', 'microsoft', 'github'],
      repoUrl: 'https://github.com/playlikemen/fillim',
    };
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

function formatSocialAuthError(provider: OAuthProvider, rawCode?: string, rawMessage?: string, status?: number): string {
  const label = OAUTH_PROVIDER_LABELS[provider];
  const code = String(rawCode ?? '').toUpperCase();
  const origin = typeof window !== 'undefined' ? window.location.origin : 'this origin';

  if (code === 'INVALID_CALLBACKURL' || /callbackurl/i.test(String(rawMessage ?? '')) || status === 403) {
    return `${label} sign-in callback (${origin}/auth/callback) requires adding ${origin} to Trusted Domains after claiming your auth project.`;
  }
  if (code === 'PROVIDER_NOT_SUPPORTED' || /provider/i.test(String(rawMessage ?? ''))) {
    return `${label} OAuth is wired in Fillim and ready as soon as ${label} client credentials are added to your claimed auth project.`;
  }
  return rawMessage || `Could not start ${label} sign-in.`;
}

/**
 * Initiates Managed Better Auth OAuth redirect via /api/auth/sign-in/social.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<{ error: string | null }> {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:4848';
  const callbackURL = `${origin}/auth/callback`;

  try {
    const res = await fetch('/api/auth/sign-in/social', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider, callbackURL }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      url?: string;
      code?: string;
      error?: string;
      message?: string;
    };
    if (!res.ok || data.error) {
      return {
        error: formatSocialAuthError(provider, data.code, data.message || data.error, res.status),
      };
    }
    if (data.url && typeof window !== 'undefined') {
      window.location.assign(data.url);
    }
    return { error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : undefined;
    return { error: formatSocialAuthError(provider, undefined, msg) };
  }
}

/**
 * Exchanges Neon Auth OAuth callback verifier (?neon_auth_session_verifier=...)
 * via same-origin /api/auth/get-session proxy and establishes a Fillim SaaS session.
 */
export async function completeOAuthCallback(search: string): Promise<{ user: SaasUser | null; error: string | null }> {
  const params = new URLSearchParams(search);
  const oauthError = params.get('error_description') || params.get('error');
  if (oauthError) {
    return { user: null, error: oauthError };
  }

  try {
    if (params.has('neon_auth_session_verifier')) {
      const verifyRes = await fetch(`/api/auth/get-session${search}`, {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });
      if (!verifyRes.ok) {
        const errBody = await verifyRes.json().catch(() => ({})) as { error?: string; message?: string };
        return {
          user: null,
          error: errBody.message || errBody.error || 'Could not verify OAuth session.',
        };
      }
    }

    const user = await syncSaasSession();
    if (!user) {
      return { user: null, error: 'OAuth completed, but the Fillim workspace session could not be created.' };
    }
    return { user, error: null };
  } catch (err) {
    return { user: null, error: err instanceof Error ? err.message : 'OAuth session exchange failed.' };
  }
}

export async function saasSignOut(): Promise<void> {
  await Promise.allSettled([
    authClient.signOut(),
    fetch('/api/saas/logout', { method: 'POST' }),
  ]);
}
