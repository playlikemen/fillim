/**
 * Fillim / OpenFilm Studio root router:
 * - In SaaS mode (Neon Postgres + Neon Auth active, without a local CLI ?key=):
 *   `/`             -> Fillim SaaS Landing Page
 *   `/auth`         -> Neon Auth Sign-In / Sign-Up
 *   `/projects`     -> Authenticated Cloud Workspace Dashboard
 *   `/projects/:id` -> Authenticated Studio Editor
 * - In local CLI / Desktop mode (?key=... or studioHost or non-SaaS):
 *   Preserves OpenFilm Studio's original single-user behavior.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { api, listen, studioConnection } from './api';
import { useT } from './i18n';
import { ProjectPage } from './components/ProjectPage';
import { BrandLoadingScreen } from './components/BrandLoadingScreen';
import { ProjectsPopover } from './components/ProjectsLibrary';
import { Launcher } from './components/Launcher';
import { studioHost } from './lib/host';
import { go, openProject } from './lib/navigate';
import { WhatsNew } from './components/WhatsNew';
import { sourcesApi } from './lib/project-sources';
import { LIST_WAIT_MS, within } from './lib/projects-page';
import { afterPaintIdle } from './lib/after-paint-idle';
import { loadCanvas } from './components/canvas/load';
import { fetchSaasConfig, fetchSaasMe, saasSignOut, type SaasConfig, type SaasUser } from './saas/auth-client';
import { LandingPage } from './saas/LandingPage';
import { AuthPage } from './saas/AuthPage';
import { WorkspaceDashboard } from './saas/WorkspaceDashboard';

const projectIn = (path: string) => /^\/projects\/([\w-]+)/.exec(path)?.[1] ?? null;
const hasLocalAuth = () => Boolean(studioHost || new URLSearchParams(location.search).has('key'));

export function App() {
  const tabs = studioHost?.tabs ?? null;
  const [path, setPath] = useState(location.pathname);
  const [search, setSearch] = useState(location.search);
  const localMode = hasLocalAuth();

  const [saasConfig, setSaasConfig] = useState<SaasConfig>({
    enabled: !localMode,
    authProxyPath: '/api/auth',
    repoUrl: 'https://github.com/playlikemen/fillim',
  });
  const [saasUser, setSaasUser] = useState<SaasUser | null>(null);
  const [saasResolved, setSaasResolved] = useState(localMode);

  useEffect(() => {
    const onPop = () => {
      setPath(location.pathname);
      setSearch(location.search);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    if (localMode) return;
    let alive = true;
    void Promise.all([fetchSaasConfig(), fetchSaasMe()]).then(([cfg, me]) => {
      if (!alive) return;
      setSaasConfig(cfg);
      setSaasUser(me.user);
      setSaasResolved(true);
    });
    return () => { alive = false; };
  }, [localMode]);

  const saasMode = !localMode && saasConfig.enabled;
  const studioAuthenticated = localMode || (saasResolved && (!saasConfig.enabled || saasUser !== null));

  useEffect(() => {
    if (!studioAuthenticated) return;
    sourcesApi.preload();
  }, [studioAuthenticated]);

  const id = projectIn(path);
  const home = id == null;
  useEffect(() => (studioAuthenticated && home ? afterPaintIdle(() => { void loadCanvas().catch(() => {}); }) : undefined), [studioAuthenticated, home]);

  useEffect(() => {
    if (!studioAuthenticated) return;
    const stop = listen('events', (event) => {
      if (event.type !== 'open') return;
      if (tabs) tabs.openRequest(event.to); else go(event.to);
    }, { watch: true });
    return () => stop();
  }, [studioAuthenticated, tabs]);

  const [none, setNone] = useState(false);
  useEffect(() => {
    if (saasMode || !studioAuthenticated || id || tabs) return;
    let alive = true;
    void within(api.projects(), LIST_WAIT_MS).then((projects) => {
      if (!alive) return;
      const last = projects.find((p) => !p.missing);
      if (last) go(`/projects/${last.id}`, true);
      else setNone(true);
    }, () => { if (alive) setNone(true); });
    return () => { alive = false; setNone(false); };
  }, [saasMode, studioAuthenticated, id, tabs]);

  const handleSignOut = () => {
    void saasSignOut().then(() => {
      setSaasUser(null);
      go('/', true);
    });
  };

  if (saasMode) {
    const params = new URLSearchParams(search);
    const authMode = params.get('mode') === 'sign-up' || path === '/auth/sign-up' ? 'sign-up' : 'sign-in';
    const nextPath = params.get('next');

    if (path === '/' || path === '') {
      return (
        <LandingPage
          user={saasUser}
          repoUrl={saasConfig.repoUrl}
          onLaunchAuth={(mode) => go(`/auth?mode=${mode}`)}
          onOpenWorkspace={() => go('/projects')}
        />
      );
    }

    if (path === '/auth' || path === '/auth/sign-in' || path === '/auth/sign-up') {
      if (saasUser) {
        return (
          <WorkspaceDashboard
            user={saasUser}
            onUserUpdated={setSaasUser}
            onOpenProject={(nextId) => go(`/projects/${nextId}`)}
            onHome={() => go('/')}
            onSignOut={handleSignOut}
          />
        );
      }
      return (
        <AuthPage
          initialMode={authMode}
          onBackHome={() => go('/')}
          onSuccess={(u) => {
            setSaasUser(u);
            const safeNext = nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/projects';
            go(safeNext, true);
          }}
        />
      );
    }

    if (!saasResolved) return <BrandLoadingScreen labelKey="projects.opening" />;

    if (!saasUser) {
      return (
        <AuthPage
          initialMode="sign-in"
          onBackHome={() => go('/')}
          onSuccess={(u) => {
            setSaasUser(u);
          }}
        />
      );
    }

    if (id) {
      return <><ProjectPage key={id} projectId={id} /><ConnectionNotice /></>;
    }

    return (
      <WorkspaceDashboard
        user={saasUser}
        onUserUpdated={setSaasUser}
        onOpenProject={(nextId) => go(`/projects/${nextId}`)}
        onHome={() => go('/')}
        onSignOut={handleSignOut}
      />
    );
  }

  const page = id ? <ProjectPage key={id} projectId={id} />
    : tabs ? <Launcher onOpen={openProject} />
    : !none ? <BrandLoadingScreen labelKey="projects.opening" />
      : (
        <div className="workspace-shell bg-[var(--bg-app)]">
          <ProjectsPopover open currentProjectId="" onOpen={(next) => go(`/projects/${next}`)} onCurrentRemoved={() => {}} />
        </div>
      );
  return <>{page}<ConnectionNotice /><WhatsNew /></>;
}

/**
 * Studio answers, but not this browser: it was opened at Studio's address without the key (pasted, typed, an agent's
 * browser given the bare address). Nothing to wait for: the page is covered and says which address lets it in.
 */
function LockedNotice() {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const COMMAND = 'openfilm open';
  return (
    <div role="alert" className="fixed inset-0 z-[10050] flex items-center justify-center bg-[var(--bg-app)] p-6">
      <div className="w-full max-w-[460px] rounded-2xl border border-[var(--border)] bg-[var(--bg-raised)] p-6 shadow-[var(--shadow-lg)]">
        <p className="text-[16px] font-semibold text-[var(--text)]">{t('connection.lockedTitle')}</p>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--text-muted)]">{t('connection.lockedBody')}</p>
        <p className="mt-3 rounded-lg bg-[var(--bg-field)] px-3 py-2 font-mono text-[12px] text-[var(--text-muted)]">{`${location.origin}/open?key=…`}</p>
        {studioHost ? null : (
          <div className="mt-4 flex items-center gap-2 text-[12.5px] text-[var(--text-muted)]">
            <span>{t('connection.lockedHow')}</span>
            <button
              type="button"
              onClick={() => { void navigator.clipboard?.writeText(COMMAND).then(() => setCopied(true), () => {}); }}
              className="rounded-md bg-[var(--bg-field)] px-2 py-0.5 font-mono text-[12px] text-[var(--text)] ring-1 ring-inset ring-[var(--border)] hover:bg-[var(--bg-hover)]"
            >
              {copied ? t('connection.copied') : COMMAND}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The event connection is still down. The page keeps reconnecting and the desktop can copy local diagnostics.
 */
function ConnectionNotice() {
  const t = useT();
  const state = useSyncExternalStore(studioConnection.subscribe, studioConnection.get);
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
  useEffect(() => { if (state === 'up') setCopyState('idle'); }, [state]);
  if (state === 'up') return null;
  if (state === 'locked') return <LockedNotice />;
  const gone = state === 'gone';
  const copyReport = studioHost?.agents?.copyReport;
  const COMMAND = 'openfilm open';
  return (
    <>
      {gone ? <div aria-hidden className="fixed inset-0 z-[10049] bg-black/40 backdrop-blur-[1.5px]" /> : null}
      <div role="alert" className={`fixed inset-x-0 top-0 z-[10050] flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-4 py-2.5 text-[13px] font-medium text-white shadow-lg ${gone ? 'bg-[#b42318]' : 'bg-[#b54708]'}`}>
        <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full bg-white ${gone ? '' : 'animate-pulse'}`} />
        <span>{t(gone ? (studioHost ? 'connection.goneApp' : 'connection.gone') : 'connection.lost')}</span>
        {copyReport ? (
          <button
            type="button"
            disabled={copyState === 'copying'}
            onClick={() => {
              setCopyState('copying');
              void copyReport({ offline: true }).then(({ ok }) => setCopyState(ok ? 'copied' : 'failed'), () => setCopyState('failed'));
            }}
            className="rounded-md bg-white/15 px-2 py-0.5 text-[12.5px] ring-1 ring-inset ring-white/30 hover:bg-white/25"
          >
            {t(copyState === 'copied' ? 'settings.report.copied' : copyState === 'copying' ? 'settings.report.making' : 'settings.report.copy')}
          </button>
        ) : gone && !studioHost ? (
          <button
            type="button"
            onClick={() => { void navigator.clipboard?.writeText(COMMAND).then(() => setCopyState('copied'), () => {}); }}
            className="rounded-md bg-white/15 px-2 py-0.5 font-mono text-[12.5px] ring-1 ring-inset ring-white/30 hover:bg-white/25"
          >
            {copyState === 'copied' ? t('connection.copied') : COMMAND}
          </button>
        ) : null}
        {copyState === 'failed' ? <span>{t('settings.report.failed')}</span> : null}
      </div>
    </>
  );
}
