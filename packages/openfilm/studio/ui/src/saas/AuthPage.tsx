import { useState, type FormEvent } from 'react';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { authClient, syncSaasSession, type SaasUser } from './auth-client';

interface AuthPageProps {
  initialMode?: 'sign-in' | 'sign-up';
  onBackHome: () => void;
  onSuccess: (user: SaasUser) => void;
}

export function AuthPage({ initialMode = 'sign-in', onBackHome, onSuccess }: AuthPageProps) {
  const [mode, setMode] = useState<'sign-in' | 'sign-up'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
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
        setError('Signed in, but could not establish workspace session. Check email verification or try again.');
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
    <div className="min-h-screen bg-[#06070a] text-[#f3f5f7] antialiased">
      <div className="mx-auto grid min-h-screen max-w-[1160px] px-5 py-8 sm:px-8 lg:grid-cols-12 lg:items-center lg:gap-12">
        {/* Left brand panel */}
        <div className="mb-10 lg:col-span-6 lg:mb-0">
          <button
            type="button"
            onClick={onBackHome}
            className="inline-flex items-center gap-2 text-[13px] text-[#8d96a5] transition hover:text-white"
          >
            <ArrowLeft size={14} />
            Back to Fillim
          </button>

          <div className="mt-8 flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/12 bg-[#0e1117] text-[#00a3ae]">
              <BrandLogo size={22} />
            </span>
            <div>
              <div className="text-[18px] font-semibold tracking-[-0.02em] text-white">Fillim Cloud Studio</div>
              <div className="font-mono text-[11.5px] text-[#7a8494]">Neon Auth · Lakebase Postgres</div>
            </div>
          </div>

          <h1 className="mt-8 text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[40px]">
            {mode === 'sign-up' ? 'Create your cloud film workspace.' : 'Welcome back to the cutting room.'}
          </h1>
          <p className="mt-4 max-w-[44ch] text-[15px] leading-relaxed text-[#9aa4b2]">
            {mode === 'sign-up'
              ? 'Get 100 cloud render credits, isolated project storage, multi-track timeline editing, and color grading.'
              : 'Sign in to access your film projects, timeline edits, canvas boards, and exports.'}
          </p>

          <div className="mt-8 inline-flex items-center gap-2.5 rounded-xl border border-white/10 bg-[#0e1117] px-4 py-3 text-[13px] text-[#b4becb]">
            <ShieldCheck size={16} className="shrink-0 text-[#00a3ae]" />
            <span>Authenticated via Neon Auth with EdDSA session verification</span>
          </div>
        </div>

        {/* Right auth card */}
        <div className="lg:col-span-6">
          <div className="mx-auto w-full max-w-[440px] rounded-2xl border border-white/12 bg-[#0e1117] p-6 shadow-[0_24px_60px_rgba(0,0,0,0.55)] sm:p-8">
            <div className="grid grid-cols-2 gap-1 rounded-xl border border-white/10 bg-[#080a0f] p-1">
              <button
                type="button"
                onClick={() => { setMode('sign-in'); setError(null); }}
                className={`rounded-lg py-2 text-[13px] font-medium transition ${
                  mode === 'sign-in' ? 'bg-[#19202b] text-white' : 'text-[#8d96a5] hover:text-white'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => { setMode('sign-up'); setError(null); }}
                className={`rounded-lg py-2 text-[13px] font-medium transition ${
                  mode === 'sign-up' ? 'bg-[#19202b] text-white' : 'text-[#8d96a5] hover:text-white'
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={submit} className="mt-6 space-y-4">
              {mode === 'sign-up' && (
                <div>
                  <label htmlFor="fillim-name" className="block text-[12.5px] font-medium text-[#b4becb]">
                    Full name
                  </label>
                  <input
                    id="fillim-name"
                    type="text"
                    autoComplete="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ada Lovelace"
                    className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#080a0f] px-3 text-[14px] text-white placeholder-[#5c6574] outline-none transition focus:border-[#00a3ae]"
                  />
                </div>
              )}

              <div>
                <label htmlFor="fillim-email" className="block text-[12.5px] font-medium text-[#b4becb]">
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
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#080a0f] px-3 text-[14px] text-white placeholder-[#5c6574] outline-none transition focus:border-[#00a3ae]"
                />
              </div>

              <div>
                <label htmlFor="fillim-password" className="block text-[12.5px] font-medium text-[#b4becb]">
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
                  className="mt-1.5 h-10 w-full rounded-lg border border-white/12 bg-[#080a0f] px-3 text-[14px] text-white placeholder-[#5c6574] outline-none transition focus:border-[#00a3ae]"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-lg border border-[#d1342f]/50 bg-[#d1342f]/10 px-3 py-2.5 text-[13px] text-[#ff9f9b]">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#00a3ae] text-[14px] font-semibold text-[#041416] transition hover:bg-[#19b9c4] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                {mode === 'sign-up' ? 'Create workspace' : 'Sign in to Fillim'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
