import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { CalibrationStrip, FillimMark } from './FillimBrand';
import {
  authClient,
  signInWithProvider,
  syncSaasSession,
  type OAuthProvider,
  type SaasUser,
} from './auth-client';
import './saas.css';

interface AuthPageProps {
  initialMode?: 'sign-in' | 'sign-up';
  initialError?: string | null;
  onBackHome: () => void;
  onSuccess: (user: SaasUser) => void;
}

function ProviderIcon({ provider }: { provider: OAuthProvider }) {
  if (provider === 'google') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <path
          fill="#4285F4"
          d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.3h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.08 3.56-5.15 3.56-8.65z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.87-3a7.17 7.17 0 0 1-10.67-3.76H1.4v3.09A12 12 0 0 0 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.39 14.34a7.2 7.2 0 0 1 0-4.68V6.57H1.4a12 12 0 0 0 0 10.86l3.99-3.09z"
        />
        <path
          fill="#EA4335"
          d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.4 6.57l3.99 3.09A7.17 7.17 0 0 1 12 4.75z"
        />
      </svg>
    );
  }
  if (provider === 'microsoft') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="shrink-0">
        <rect x="2" y="2" width="9.2" height="9.2" fill="#ca281b" />
        <rect x="12.8" y="2" width="9.2" height="9.2" fill="#087774" />
        <rect x="2" y="12.8" width="9.2" height="9.2" fill="#193885" />
        <rect x="12.8" y="12.8" width="9.2" height="9.2" fill="#d97706" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden className="shrink-0">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12.29c0 5.21 3.3 9.63 7.87 11.19.58.11.79-.26.79-.57v-2c-3.2.71-3.88-1.58-3.88-1.58-.52-1.36-1.28-1.72-1.28-1.72-1.05-.74.08-.72.08-.72 1.16.08 1.77 1.22 1.77 1.22 1.03 1.81 2.71 1.29 3.37.98.1-.77.4-1.29.73-1.59-2.55-.3-5.24-1.31-5.24-5.84 0-1.29.45-2.35 1.19-3.18-.12-.3-.52-1.52.11-3.16 0 0 .97-.32 3.18 1.21a10.8 10.8 0 0 1 5.79 0c2.21-1.53 3.18-1.21 3.18-1.21.63 1.64.23 2.86.11 3.16.74.83 1.19 1.89 1.19 3.18 0 4.54-2.7 5.54-5.27 5.83.41.37.78 1.09.78 2.2v3.26c0 .32.21.69.8.57A11.52 11.52 0 0 0 23.5 12.29 11.5 11.5 0 0 0 12 .5z" />
    </svg>
  );
}

const SOCIAL_PROVIDERS: Array<{ id: OAuthProvider; label: string }> = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'microsoft', label: 'Continue with Microsoft' },
  { id: 'github', label: 'Continue with GitHub' },
];

export function AuthPage({
  initialMode = 'sign-in',
  initialError = null,
  onBackHome,
  onSuccess,
}: AuthPageProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [oauthBusy, setOauthBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(initialError);

  useEffect(() => {
    if (initialError) setError(initialError);
  }, [initialError]);

  const startSocial = async (provider: OAuthProvider) => {
    if (busy || oauthBusy) return;
    setError(null);
    setOauthBusy(provider);
    const res = await signInWithProvider(provider);
    if (res.error) {
      setError(res.error);
      setOauthBusy(null);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy || oauthBusy) return;
    setError(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setError('Enter your email and password.');
      return;
    }
    if (mode === 'sign-up' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setBusy(true);
    try {
      if (mode === 'sign-up') {
        const res = await authClient.signUp.email({
          email: cleanEmail,
          password,
          name: name.trim() || cleanEmail.split('@')[0] || 'Creator',
        });
        if (res.error) {
          setError(res.error.message || 'Could not create your account.');
          return;
        }
      } else {
        const res = await authClient.signIn.email({
          email: cleanEmail,
          password,
        });
        if (res.error) {
          setError(res.error.message || 'Invalid email or password.');
          return;
        }
      }

      const synced = await syncSaasSession();
      if (!synced) {
        setError('Signed in, but could not start your studio session. Please try again.');
        return;
      }
      onSuccess(synced);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fillim-saas min-h-screen bg-[#f6eae6] text-[#191918] antialiased">
      <CalibrationStrip />

      <header className="border-b border-[#191918] bg-[#f6eae6]">
        <div className="mx-auto flex h-14 max-w-[1280px] items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-[14px] font-medium text-[#191918] underline-offset-4 hover:text-[#9e1c12] hover:underline"
          >
            <ArrowLeft size={15} />
            Back to Fillim
          </button>

          <div className="flex items-center gap-2">
            <FillimMark size={22} />
            <span className="fillim-display text-[24px] leading-none">FILLIM</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1280px] gap-10 px-4 py-10 sm:px-6 lg:grid-cols-12 lg:items-start lg:py-16 lg:px-8">
        {/* Left booth overview */}
        <div className="lg:col-span-6">
          <h1 className="fillim-display text-[42px] leading-[0.95] text-[#191918] sm:text-[56px]">
            {mode === 'sign-up' ? 'OPEN YOUR CLOUD CUTTING ROOM.' : 'WELCOME BACK TO FILLIM STUDIO.'}
          </h1>

          <p className="mt-4 max-w-[44ch] text-[15.5px] leading-relaxed text-[#4a4744]">
            {mode === 'sign-up'
              ? 'New workspaces unlock AI Director chat, all four film workbenches, and 100 free render credits on day one.'
              : 'Sign in with Google, Microsoft, GitHub, or email to pick up right where you left your timeline.'}
          </p>

          <dl className="mt-8 grid max-w-[480px] grid-cols-2 overflow-hidden rounded-xl border-2 border-[#191918] bg-[#fbf4f1]">
            <div className="border-r border-[#191918] p-4">
              <dt className="fillim-mono text-[12px] uppercase text-[#4a4744]">Starter Allocation</dt>
              <dd className="fillim-mono mt-1 text-[20px] font-semibold text-[#191918]">100 credits</dd>
            </div>
            <div className="p-4">
              <dt className="fillim-mono text-[12px] uppercase text-[#4a4744]">Included Tools</dt>
              <dd className="fillim-mono mt-1 text-[16px] font-semibold text-[#075d5b]">AI Chat + 4 NLEs</dd>
            </div>
          </dl>

          <div className="mt-6 inline-flex items-center gap-2.5 rounded-lg border border-[#191918] bg-[#eee0db] px-4 py-3 text-[13.5px] font-medium text-[#191918]">
            <ShieldCheck size={16} className="shrink-0 text-[#075d5b]" />
            <span>Private workspaces with instant social or email sign-in</span>
          </div>
        </div>

        {/* Right Optical Sign-In Card */}
        <div className="lg:col-span-6">
          <div className="mx-auto w-full max-w-[460px] rounded-xl border-2 border-[#191918] bg-[#fbf4f1] p-6 sm:p-8">
            <div className="flex border-b border-[#191918]">
              <button
                type="button"
                onClick={() => {
                  setMode('sign-in');
                  setError(null);
                }}
                className={`flex-1 pb-3 text-[14.5px] font-semibold transition-colors ${
                  mode === 'sign-in'
                    ? 'border-b-2 border-[#ca281b] text-[#191918]'
                    : 'text-[#4a4744] hover:text-[#191918]'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('sign-up');
                  setError(null);
                }}
                className={`flex-1 pb-3 text-[14.5px] font-semibold transition-colors ${
                  mode === 'sign-up'
                    ? 'border-b-2 border-[#ca281b] text-[#191918]'
                    : 'text-[#4a4744] hover:text-[#191918]'
                }`}
              >
                Create account
              </button>
            </div>

            {/* Social OAuth Providers: Google, Microsoft, GitHub */}
            <div className="mt-6 space-y-2.5">
              {SOCIAL_PROVIDERS.map(({ id, label }) => {
                const isProviderLoading = oauthBusy === id;
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={busy || oauthBusy !== null}
                    onClick={() => void startSocial(id)}
                    className="fillim-btn-press flex h-11 w-full items-center justify-center gap-2.5 rounded-lg border border-[#191918] bg-[#f6eae6] px-4 text-[14px] font-semibold text-[#191918] hover:bg-[#eee0db] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isProviderLoading ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <ProviderIcon provider={id} />
                    )}
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            <div className="my-6 flex items-center gap-3 text-[12.5px] font-semibold uppercase tracking-[0.04em] text-[#4a4744]">
              <div className="h-px flex-1 bg-[#191918]/30" />
              <span>or continue with email</span>
              <div className="h-px flex-1 bg-[#191918]/30" />
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === 'sign-up' && (
                <div>
                  <label htmlFor="fillim-name" className="block text-[13px] font-semibold text-[#191918]">
                    Full name
                  </label>
                  <input
                    id="fillim-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="mt-1.5 h-10 w-full rounded-md border border-[#191918] bg-[#f6eae6] px-3 text-[14px] text-[#191918] placeholder-[#4a4744]"
                  />
                </div>
              )}

              <div>
                <label htmlFor="fillim-email" className="block text-[13px] font-semibold text-[#191918]">
                  Email address
                </label>
                <input
                  id="fillim-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@studio.dev"
                  className="mt-1.5 h-10 w-full rounded-md border border-[#191918] bg-[#f6eae6] px-3 text-[14px] text-[#191918] placeholder-[#4a4744]"
                />
              </div>

              <div>
                <label htmlFor="fillim-password" className="block text-[13px] font-semibold text-[#191918]">
                  Password
                </label>
                <input
                  id="fillim-password"
                  type="password"
                  required
                  autoComplete={mode === 'sign-up' ? 'new-password' : 'current-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'sign-up' ? 'Minimum 8 characters' : 'Your password'}
                  className="mt-1.5 h-10 w-full rounded-md border border-[#191918] bg-[#f6eae6] px-3 text-[14px] text-[#191918] placeholder-[#4a4744]"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg border-2 border-[#ca281b] bg-[#ca281b]/10 px-3.5 py-2.5 text-[13.5px] font-medium text-[#8f180e]"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy || oauthBusy !== null}
                className="fillim-btn-press flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#191918] bg-[#ca281b] text-[14.5px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {mode === 'sign-up' ? 'Create Workspace' : 'Sign in to Fillim'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}
