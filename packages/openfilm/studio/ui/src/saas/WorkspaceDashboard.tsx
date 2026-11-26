import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import {
  ArrowUpRight,
  Check,
  Copy,
  Loader2,
  LogOut,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { api, type Project } from '@/api';
import { posterUrl } from '@/components/ProjectCover';
import { CalibrationStrip, DYE_CHANNELS, FillimMark, StageFrameCanvas } from './FillimBrand';
import { fetchSaasMe, type SaasUser } from './auth-client';
import { fetchBillingConfig, formatInr, isPaidPlan, payForPlan, type BillingConfig, type PaidPlanId } from './billing';
import './saas.css';

interface WorkspaceDashboardProps {
  user: SaasUser;
  onUserUpdated: (user: SaasUser) => void;
  onOpenProject: (projectId: string) => void;
  onHome: () => void;
  onSignOut: () => void;
}

type DashboardUser = SaasUser & { plan_expires_at?: string | null };
type SortKey = 'recent' | 'name';
type Notice = { tone: 'success' | 'error' | 'info'; text: string } | null;

const QUICK_STARTERS = [
  { label: 'Launch video', title: 'Product Launch Film' },
  { label: 'Kinetic type opener', title: 'Kinetic Type Opener' },
  { label: '60s explainer', title: '60s Explainer Cut' },
];

/* What each plan's credit meter is measured against */
const PLAN_ALLOWANCE: Record<string, number> = { free: 100, creator: 1000, studio: 5000 };
const PLAN_LABEL: Record<string, string> = { free: 'Free', creator: 'Creator', studio: 'Studio' };

const relativeTime = (ms: number) => {
  const diff = Date.now() - ms;
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
  const mins = Math.round(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return rtf.format(-mins, 'minute');
  const hours = Math.round(mins / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return rtf.format(-days, 'day');
  return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const errorText = (err: unknown, fallback: string) => (err instanceof Error && err.message ? err.message : fallback);

/** Runtime page metadata for the private workspace: titled, and kept out of search indexes. */
function usePrivatePageMeta(title: string) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    return () => {
      document.title = previousTitle;
      meta.remove();
    };
  }, [title]);
}

export function WorkspaceDashboard({ user: rawUser, onUserUpdated, onOpenProject, onHome, onSignOut }: WorkspaceDashboardProps) {
  const user = rawUser as DashboardUser;
  usePrivatePageMeta('Your films — Fillim');

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<SortKey>('recent');
  const [billing, setBilling] = useState<BillingConfig>({ enabled: false, plans: [] });
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [paying, setPaying] = useState<PaidPlanId | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, me] = await Promise.all([api.projects(), fetchSaasMe()]);
      setProjects(list);
      if (me.user) onUserUpdated(me.user);
      setLoadError(null);
    } catch (err) {
      setLoadError(errorText(err, 'Could not load your films.'));
    } finally {
      setLoading(false);
    }
  }, [onUserUpdated]);

  useEffect(() => {
    void refresh();
    void fetchBillingConfig().then(setBilling);
  }, [refresh]);

  /* ?upgrade=creator|studio (or a plan picked on the landing page before sign-in) opens the upgrade sheet once */
  useEffect(() => {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get('upgrade');
    let fromStore: string | null = null;
    try {
      fromStore = sessionStorage.getItem('fillim.upgrade');
      sessionStorage.removeItem('fillim.upgrade');
    } catch {
      /* storage blocked: the URL still works */
    }
    if (fromUrl !== null) {
      url.searchParams.delete('upgrade');
      window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
    }
    if (fromUrl !== null || fromStore) setUpgradeOpen(true);
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? projects.filter((p) => p.name.toLowerCase().includes(q)) : projects.slice();
    list.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : b.openedAt - a.openedAt));
    return list;
  }, [projects, query, sort]);

  const createFilm = async (title: string) => {
    if (creating) return;
    setCreating(true);
    setNotice(null);
    try {
      const created = await api.newProject(title.trim() || 'Untitled Film');
      setNewName('');
      onOpenProject(created.id);
    } catch (err) {
      setNotice({ tone: 'error', text: errorText(err, 'Could not create the film.') });
      setCreating(false);
    }
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    void createFilm(newName);
  };

  const runOnProject = async (project: Project, action: () => Promise<unknown>, failure: string, success?: string) => {
    setBusyId(project.id);
    setNotice(null);
    try {
      await action();
      await refresh();
      if (success) setNotice({ tone: 'success', text: success });
    } catch (err) {
      setNotice({ tone: 'error', text: errorText(err, failure) });
    } finally {
      setBusyId(null);
    }
  };

  const startCheckout = async (plan: PaidPlanId) => {
    setPaying(plan);
    setNotice(null);
    /* Razorpay draws its own overlay: the upgrade sheet must be out of the top layer or it would cover Checkout */
    setUpgradeOpen(false);
    try {
      const result = await payForPlan(plan);
      if (result.status === 'paid') {
        await refresh();
        const name = billing.plans.find((p) => p.id === plan)?.name ?? PLAN_LABEL[plan];
        setNotice({ tone: 'success', text: `Payment received. Your ${name} pass is active and the credits are in your balance.` });
      } else if (result.status === 'failed') {
        setNotice({ tone: 'error', text: result.message });
      } else {
        setNotice({ tone: 'info', text: 'Checkout closed. Nothing was charged.' });
      }
    } catch (err) {
      setNotice({ tone: 'error', text: errorText(err, 'Could not start checkout.') });
    } finally {
      setPaying(null);
    }
  };

  const planId = user.plan in PLAN_LABEL ? user.plan : 'free';
  const allowance = Math.max(PLAN_ALLOWANCE[planId] ?? 100, user.credits_remaining);
  const meter = Math.max(0, Math.min(1, user.credits_remaining / allowance));
  const lowCredits = user.credits_remaining <= Math.max(10, allowance * 0.1);

  return (
    <div className="fillim-saas min-h-screen bg-[#f6eae6] text-[#191918] antialiased">
      <CalibrationStrip />

      <header className="sticky top-0 z-30 border-b border-[#191918] bg-[#f6eae6]">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button type="button" onClick={onHome} aria-label="Fillim home" className="flex items-center gap-2 rounded-md text-[#191918]">
              <FillimMark size={24} />
              <span className="fillim-display text-[26px] leading-none">FILLIM</span>
            </button>
            <span aria-hidden className="hidden text-[#4a4744] sm:inline">/</span>
            <span className="hidden truncate text-[14px] font-medium text-[#4a4744] sm:inline">Your films</span>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="group hidden items-center gap-3 rounded-lg border border-[#191918] bg-[#fbf4f1] px-3 py-1.5 text-left hover:bg-[#eee0db] md:flex"
              aria-label={`${PLAN_LABEL[planId]} plan, ${user.credits_remaining} credits left. View plans`}
            >
              <span className="fillim-mono text-[11.5px] font-semibold uppercase tracking-[0.08em] text-[#075d5b]">{PLAN_LABEL[planId]}</span>
              <span className="flex flex-col gap-1">
                <span className="fillim-mono text-[12.5px] font-semibold tabular-nums text-[#191918]">
                  {user.credits_remaining.toLocaleString()} credits
                </span>
                <span aria-hidden className="block h-1 w-24 overflow-hidden rounded-full bg-[#e2d3cd]">
                  <span
                    className={`block h-full rounded-full ${lowCredits ? 'bg-[#ca281b]' : 'bg-[#193885]'}`}
                    style={{ width: `${Math.round(meter * 100)}%` }}
                  />
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="fillim-btn-press inline-flex items-center gap-1.5 rounded-lg border border-[#191918] bg-[#ca281b] px-3.5 py-1.5 text-[13.5px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12]"
            >
              <Sparkles size={14} />
              {planId === 'free' ? 'Upgrade' : 'Plans'}
            </button>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              title={`Signed in as ${user.email}. Sign out`}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#191918] bg-[#fbf4f1] px-2.5 text-[13px] font-semibold text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]"
            >
              <LogOut size={14} />
              <span className="hidden lg:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 pb-16 pt-8 sm:px-6 lg:px-8">
        {/* Title and new film */}
        <section className="flex flex-col gap-5 border-b border-[#191918] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <h1 className="fillim-display text-[44px] leading-[0.92] text-[#191918] sm:text-[56px]">YOUR FILMS</h1>
            <p className="mt-2 text-[14.5px] text-[#4a4744]">
              {user.name ? `${user.name} · ` : ''}
              <span className="font-medium text-[#191918]">{user.email}</span>
              {!loading && projects.length > 0 && (
                <span className="fillim-mono ml-2 tabular-nums">· {projects.length} {projects.length === 1 ? 'film' : 'films'}</span>
              )}
            </p>
            {/* credits for small screens, where the header meter is hidden */}
            <button
              type="button"
              onClick={() => setUpgradeOpen(true)}
              className="fillim-mono mt-3 inline-flex items-center gap-2 rounded-md border border-[#191918] bg-[#fbf4f1] px-2.5 py-1 text-[12.5px] md:hidden"
            >
              <span className="font-semibold uppercase text-[#075d5b]">{PLAN_LABEL[planId]}</span>
              <span aria-hidden className="text-[#4a4744]">·</span>
              <span className={`font-semibold tabular-nums ${lowCredits ? 'text-[#9e1c12]' : 'text-[#193885]'}`}>
                {user.credits_remaining.toLocaleString()} credits
              </span>
            </button>
          </div>

          <form onSubmit={handleCreate} className="flex w-full items-center gap-2 lg:max-w-[460px]">
            <label htmlFor="new-film-title" className="sr-only">
              New film title
            </label>
            <input
              id="new-film-title"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Name a new film"
              maxLength={80}
              className="h-11 min-w-0 flex-1 rounded-lg border border-[#191918] bg-[#fbf4f1] px-3 text-[15px] text-[#191918] placeholder-[#6b6560]"
            />
            <button
              type="submit"
              disabled={creating}
              className="fillim-btn-press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-lg border border-[#191918] bg-[#191918] px-4 text-[14px] font-semibold text-[#f6eae6] hover:bg-[#9e1c12] disabled:opacity-60"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              {creating ? 'Opening…' : 'New film'}
            </button>
          </form>
        </section>

        {notice && (
          <div
            role={notice.tone === 'error' ? 'alert' : 'status'}
            className={`mt-5 flex items-start justify-between gap-3 rounded-lg border px-4 py-3 text-[14px] font-medium ${
              notice.tone === 'error'
                ? 'border-[#ca281b] bg-[#fbe5e1] text-[#7d150c]'
                : notice.tone === 'success'
                  ? 'border-[#087774] bg-[#e1f0ec] text-[#064f4d]'
                  : 'border-[#191918] bg-[#fbf4f1] text-[#191918]'
            }`}
          >
            <span>{notice.text}</span>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100">
              <X size={15} />
            </button>
          </div>
        )}

        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section aria-labelledby="films-heading" className="min-w-0">
            <h2 id="films-heading" className="sr-only">
              Films
            </h2>

            {projects.length > 0 && (
              <div className="mb-5 flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#4a4744]" />
                  <label htmlFor="film-search" className="sr-only">
                    Search films
                  </label>
                  <input
                    id="film-search"
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search films"
                    className="h-10 w-full rounded-lg border border-[#191918] bg-[#fbf4f1] pl-9 pr-3 text-[14px] text-[#191918] placeholder-[#6b6560]"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <label htmlFor="film-sort" className="text-[13px] font-medium text-[#4a4744]">
                    Sort
                  </label>
                  <select
                    id="film-sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="h-10 rounded-lg border border-[#191918] bg-[#fbf4f1] px-2.5 text-[14px] text-[#191918]"
                  >
                    <option value="recent">Last opened</option>
                    <option value="name">Name A–Z</option>
                  </select>
                </div>
              </div>
            )}

            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3" aria-busy="true" aria-label="Loading films">
                {Array.from({ length: 3 }, (_, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border border-[#191918] bg-[#fbf4f1]">
                    <div className="aspect-video animate-pulse bg-[#e2d3cd]" />
                    <div className="space-y-2 p-4">
                      <div className="h-4 w-2/3 animate-pulse rounded bg-[#e2d3cd]" />
                      <div className="h-3 w-1/3 animate-pulse rounded bg-[#e2d3cd]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : loadError ? (
              <div role="alert" className="rounded-xl border border-[#ca281b] bg-[#fbf4f1] px-6 py-10">
                <h3 className="fillim-display text-[30px] leading-none text-[#191918]">YOUR FILMS DID NOT LOAD</h3>
                <p className="mt-2 max-w-[60ch] text-[14.5px] text-[#4a4744]">{loadError}</p>
                <button
                  type="button"
                  onClick={() => {
                    setLoading(true);
                    void refresh();
                  }}
                  className="fillim-btn-press mt-5 inline-flex items-center gap-1.5 rounded-lg border border-[#191918] bg-[#191918] px-4 py-2 text-[14px] font-semibold text-[#f6eae6] hover:bg-[#9e1c12]"
                >
                  <RefreshCw size={14} /> Try again
                </button>
              </div>
            ) : projects.length === 0 ? (
              <EmptyState creating={creating} onCreate={(t) => void createFilm(t)} />
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-[#191918] bg-[#fbf4f1] px-6 py-10 text-center">
                <p className="text-[15px] text-[#191918]">
                  No film matches <span className="font-semibold">“{query}”</span>.
                </p>
                <button type="button" onClick={() => setQuery('')} className="mt-3 text-[14px] font-semibold text-[#9e1c12] underline underline-offset-4">
                  Clear search
                </button>
              </div>
            ) : (
              <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((p) => (
                  <ProjectCard
                    key={p.id}
                    project={p}
                    busy={busyId === p.id}
                    onOpen={() => onOpenProject(p.id)}
                    onRename={(name) => runOnProject(p, () => api.rename(p.id, name), 'Could not rename the film.')}
                    onDuplicate={() => runOnProject(p, () => api.duplicateProject(p.id, `${p.name} copy`), 'Could not duplicate the film.', `Duplicated “${p.name}”.`)}
                    onDelete={() => runOnProject(p, () => api.forget(p.id), 'Could not delete the film.', `Deleted “${p.name}”.`)}
                  />
                ))}
              </ul>
            )}
          </section>

          <aside className="flex flex-col gap-5">
            <div className="rounded-xl border border-[#191918] bg-[#fbf4f1]">
              <div className="flex items-baseline justify-between border-b border-[#191918] px-5 py-3.5">
                <h2 className="fillim-display text-[24px] leading-none text-[#191918]">CREDITS</h2>
                <span className="fillim-mono text-[12px] font-semibold uppercase text-[#075d5b]">{PLAN_LABEL[planId]} plan</span>
              </div>
              <div className="px-5 py-4">
                <div className="fillim-mono text-[30px] font-semibold tabular-nums leading-none text-[#191918]">
                  {user.credits_remaining.toLocaleString()}
                </div>
                <div aria-hidden className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e2d3cd]">
                  <div className={`h-full rounded-full ${lowCredits ? 'bg-[#ca281b]' : 'bg-[#193885]'}`} style={{ width: `${Math.round(meter * 100)}%` }} />
                </div>
                <p className="mt-2.5 text-[13px] text-[#4a4744]">
                  {planId !== 'free' && user.plan_expires_at
                    ? `Pass active until ${formatDate(user.plan_expires_at)}.`
                    : 'Free workspace. Renders and AI Director turns use credits.'}
                </p>
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="mt-4 inline-flex items-center gap-1 text-[14px] font-semibold text-[#9e1c12] underline underline-offset-4 hover:text-[#191918]"
                >
                  {planId === 'free' ? 'Get more credits' : 'Top up or change pass'} <ArrowUpRight size={14} />
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-[#191918] bg-[#fbf4f1]">
              <div className="border-b border-[#191918] px-5 py-3.5">
                <h2 className="fillim-display text-[24px] leading-none text-[#191918]">ACTIVITY</h2>
              </div>
              {user.recent_events && user.recent_events.length > 0 ? (
                <ol className="divide-y divide-[#191918]/15 px-5">
                  {user.recent_events.map((ev) => (
                    <li key={ev.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13.5px] font-medium text-[#191918]">{eventLabel(ev.event_type)}</div>
                        <div className="fillim-mono mt-0.5 text-[11.5px] text-[#4a4744]">{relativeTime(new Date(ev.created_at).getTime())}</div>
                      </div>
                      {ev.credits_delta !== 0 && (
                        <span className={`fillim-mono shrink-0 text-[12.5px] font-semibold tabular-nums ${ev.credits_delta > 0 ? 'text-[#075d5b]' : 'text-[#193885]'}`}>
                          {ev.credits_delta > 0 ? `+${ev.credits_delta}` : ev.credits_delta}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="px-5 py-4 text-[13.5px] leading-relaxed text-[#4a4744]">Renders, AI Director turns and purchases show up here.</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        billing={billing}
        currentPlan={planId}
        paying={paying}
        onChoose={(plan) => void startCheckout(plan)}
      />
    </div>
  );
}

function eventLabel(type: string) {
  const known: Record<string, string> = {
    'billing.purchase': 'Pass purchased',
    'ai.director': 'AI Director turn',
    'render.export': 'Export rendered',
    'project.create': 'Film created',
  };
  return known[type] ?? type.replace(/[._]/g, ' ');
}

function EmptyState({ creating, onCreate }: { creating: boolean; onCreate: (title: string) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#191918] bg-[#fbf4f1]">
      <div className="grid md:grid-cols-[minmax(0,1fr)_280px]">
        <div className="px-6 py-9 sm:px-8">
          <h3 className="fillim-display text-[40px] leading-[0.94] text-[#191918] sm:text-[48px]">CREATE YOUR FIRST FILM</h3>
          <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[#4a4744]">
            A film opens straight into Studio: ask the AI Director for shots, then trim, caption and grade them on the timeline.
          </p>
          <button
            type="button"
            disabled={creating}
            onClick={() => onCreate('Untitled Film')}
            className="fillim-btn-press mt-6 inline-flex items-center gap-2 rounded-lg border border-[#191918] bg-[#ca281b] px-5 py-2.5 text-[15px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12] disabled:opacity-60"
          >
            {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            Start a blank film
          </button>
          <div className="mt-6">
            <div className="text-[13px] font-semibold text-[#191918]">Or start from a brief</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {QUICK_STARTERS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  disabled={creating}
                  onClick={() => onCreate(s.title)}
                  className="rounded-lg border border-[#191918] bg-[#f6eae6] px-3.5 py-2 text-[13.5px] font-medium text-[#191918] hover:bg-[#eee0db] disabled:opacity-60"
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div aria-hidden className="hidden border-l border-[#191918] bg-[#161615] p-4 md:flex md:flex-col md:justify-center md:gap-3">
          {[0.4, 3.2, 1.6].map((t, i) => (
            <div key={t} className="aspect-video overflow-hidden rounded-md border border-[#4a4744]">
              <StageFrameCanvas t={t} headline="YOUR FILM" activeDye={DYE_CHANNELS[i]!.hex} variant="strip" inverted={i === 1} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface ProjectCardProps {
  project: Project;
  busy: boolean;
  onOpen: () => void;
  onRename: (name: string) => Promise<void>;
  onDuplicate: () => Promise<void>;
  onDelete: () => Promise<void>;
}

function ProjectCard({ project: p, busy, onOpen, onRename, onDuplicate, onDelete }: ProjectCardProps) {
  const [posterFailed, setPosterFailed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dye = DYE_CHANNELS[[...p.id].reduce((n, c) => n + c.charCodeAt(0), 0) % DYE_CHANNELS.length]!.hex;

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const submitRename = async (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim();
    setEditing(false);
    if (name && name !== p.name) await onRename(name);
    else setDraft(p.name);
  };

  return (
    <li className="group flex flex-col overflow-hidden rounded-xl border border-[#191918] bg-[#fbf4f1] transition-colors hover:bg-[#fffaf8]">
      <button
        type="button"
        onClick={onOpen}
        disabled={p.missing}
        aria-label={`Open ${p.name} in Studio`}
        className="relative block aspect-video w-full overflow-hidden border-b border-[#191918] bg-[#161615] text-left disabled:cursor-not-allowed"
      >
        {!p.missing && !posterFailed ? (
          <img
            src={posterUrl(p)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.02]"
            onError={() => setPosterFailed(true)}
          />
        ) : (
          <StageFrameCanvas t={1.6} headline={p.name.toUpperCase().slice(0, 22)} activeDye={dye} variant="strip" />
        )}
        {p.missing ? (
          <span className="absolute inset-x-3 bottom-3 rounded-md bg-[#fbe5e1] px-2.5 py-1.5 text-[12.5px] font-medium text-[#7d150c]">
            {p.missingReason === 'film' ? 'film.html is missing from this folder' : 'This film’s folder is missing'}
          </span>
        ) : (
          <span className="absolute bottom-2.5 left-2.5 rounded-md bg-[#161615]/85 px-2 py-1 text-[12px] font-semibold text-[#f6eae6] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
            Open in Studio
          </span>
        )}
      </button>

      <div className="flex flex-1 flex-col gap-2 px-4 py-3">
        {editing ? (
          <form onSubmit={submitRename} className="flex items-center gap-1.5">
            <label htmlFor={`rename-${p.id}`} className="sr-only">
              Film name
            </label>
            <input
              id={`rename-${p.id}`}
              ref={inputRef}
              value={draft}
              maxLength={80}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDraft(p.name);
                  setEditing(false);
                }
              }}
              className="h-8 min-w-0 flex-1 rounded-md border border-[#191918] bg-[#f6eae6] px-2 text-[14.5px] font-semibold text-[#191918]"
            />
            <button type="submit" aria-label="Save name" className="rounded-md border border-[#191918] p-1.5 text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]">
              <Check size={14} />
            </button>
          </form>
        ) : (
          <div className="min-w-0">
            <div className="truncate text-[15.5px] font-bold text-[#191918]" title={p.name}>
              {p.name}
            </div>
            <div className="fillim-mono mt-0.5 text-[12px] text-[#4a4744]">Opened {relativeTime(p.openedAt)}</div>
          </div>
        )}

        {confirmDelete ? (
          <div role="group" aria-label={`Confirm deleting ${p.name}`} className="mt-auto flex items-center justify-between gap-2 rounded-md border border-[#ca281b] bg-[#fbe5e1] px-2.5 py-1.5">
            <span className="text-[13px] font-medium text-[#7d150c]">Delete this film?</span>
            <span className="flex gap-1.5">
              <button
                type="button"
                disabled={busy}
                onClick={() => void onDelete().finally(() => setConfirmDelete(false))}
                className="rounded-md bg-[#ca281b] px-2.5 py-1 text-[12.5px] font-semibold text-[#fffaf8] hover:bg-[#9e1c12] disabled:opacity-60"
              >
                {busy ? 'Deleting…' : 'Delete'}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md border border-[#191918] px-2.5 py-1 text-[12.5px] font-semibold text-[#191918]">
                Keep
              </button>
            </span>
          </div>
        ) : (
          <div className="mt-auto flex items-center gap-1 pt-1">
            <button
              type="button"
              onClick={onOpen}
              disabled={p.missing}
              className="mr-auto rounded-md px-1 text-[13.5px] font-semibold text-[#9e1c12] underline-offset-4 hover:underline disabled:opacity-40"
            >
              Open
            </button>
            <IconAction label={`Rename ${p.name}`} disabled={busy} onClick={() => { setDraft(p.name); setEditing(true); }}>
              <Pencil size={14} />
            </IconAction>
            <IconAction label={`Duplicate ${p.name}`} disabled={busy || p.missing} onClick={() => void onDuplicate()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
            </IconAction>
            <IconAction label={`Delete ${p.name}`} disabled={busy} danger onClick={() => setConfirmDelete(true)}>
              <Trash2 size={14} />
            </IconAction>
          </div>
        )}
      </div>
    </li>
  );
}

function IconAction({ label, disabled, danger, onClick, children }: { label: string; disabled?: boolean; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-[#4a4744] transition-colors disabled:opacity-40 ${
        danger ? 'hover:border-[#ca281b] hover:bg-[#fbe5e1] hover:text-[#9e1c12]' : 'hover:border-[#191918] hover:bg-[#eee0db] hover:text-[#191918]'
      }`}
    >
      {children}
    </button>
  );
}

interface UpgradeDialogProps {
  open: boolean;
  onClose: () => void;
  billing: BillingConfig;
  currentPlan: string;
  paying: PaidPlanId | null;
  onChoose: (plan: PaidPlanId) => void;
}

function UpgradeDialog({ open, onClose, billing, currentPlan, paying, onChoose }: UpgradeDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const tiers = [
    { id: 'free', name: 'Free', price: formatInr(0), credits: 100, note: 'On sign-up · no card' },
    ...billing.plans.map((p) => ({ id: p.id, name: p.name, price: formatInr(p.amount), credits: p.credits, note: `One-time pass · ${p.days} days` })),
  ];

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-labelledby="upgrade-title"
      className="fillim-saas m-auto w-[min(920px,calc(100vw-24px))] max-h-[calc(100vh-24px)] overflow-auto rounded-xl border-2 border-[#191918] bg-[#f6eae6] p-0 text-[#191918] backdrop:bg-[#161615]/70"
    >
      <CalibrationStrip />
      <div className="flex items-start justify-between gap-4 border-b border-[#191918] px-5 py-4 sm:px-7">
        <div>
          <h2 id="upgrade-title" className="fillim-display text-[34px] leading-none sm:text-[40px]">
            MORE CREDITS, MORE FILM
          </h2>
          <p className="mt-1.5 text-[14px] text-[#4a4744]">One-time passes in INR. Nothing renews automatically. Unused credits stay in your balance.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close plans" className="rounded-md border border-[#191918] p-1.5 hover:bg-[#191918] hover:text-[#f6eae6]">
          <X size={16} />
        </button>
      </div>

      {!billing.enabled ? (
        <p className="px-5 py-8 text-[14.5px] text-[#4a4744] sm:px-7">Paid passes are not available right now. Your free credits keep working.</p>
      ) : (
        <div className="grid divide-y divide-[#191918] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {tiers.map((tier) => {
            const current = tier.id === currentPlan;
            const paid = isPaidPlan(tier.id);
            return (
              <div key={tier.id} className={`flex flex-col px-5 py-6 sm:px-6 ${tier.id === 'creator' ? 'bg-[#fbf4f1]' : ''}`}>
                <div className="flex items-center justify-between">
                  <h3 className="text-[16px] font-bold">{tier.name}</h3>
                  {current && <span className="fillim-mono rounded bg-[#191918] px-1.5 py-0.5 text-[11px] font-semibold uppercase text-[#f6eae6]">Current</span>}
                </div>
                <div className="fillim-display mt-3 text-[46px] leading-none">{tier.price}</div>
                <div className="fillim-mono mt-1 text-[12px] text-[#4a4744]">{tier.note}</div>
                <ul className="mt-4 space-y-1.5 text-[14px]">
                  <li className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-[#087774]" />
                    <span>
                      <span className="font-semibold tabular-nums">{tier.credits.toLocaleString()}</span> render credits
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-[#087774]" /> All four workbenches
                  </li>
                  <li className="flex gap-2">
                    <Check size={15} className="mt-0.5 shrink-0 text-[#087774]" /> AI Director chat
                  </li>
                </ul>
                <div className="mt-6 pt-1 sm:mt-auto">
                  {paid ? (
                    <button
                      type="button"
                      disabled={paying !== null}
                      onClick={() => onChoose(tier.id as PaidPlanId)}
                      className={`fillim-btn-press inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#191918] px-4 py-2.5 text-[14.5px] font-semibold disabled:opacity-60 ${
                        tier.id === 'creator' ? 'bg-[#ca281b] text-[#fffaf8] hover:bg-[#9e1c12]' : 'bg-[#191918] text-[#f6eae6] hover:bg-[#9e1c12]'
                      }`}
                    >
                      {paying === tier.id ? <Loader2 size={15} className="animate-spin" /> : null}
                      {current ? `Add another ${tier.name} pass` : `Get ${tier.name}`}
                    </button>
                  ) : (
                    <div className="text-[13px] text-[#4a4744]">{current ? 'You are on the free workspace.' : 'Included with every account.'}</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="border-t border-[#191918] px-5 py-3 text-[12.5px] text-[#4a4744] sm:px-7">
        Payments are processed by Razorpay. Fillim never sees your card or UPI details.
      </p>
    </dialog>
  );
}
