import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Clapperboard, Clock, Copy, Film, Loader2, LogOut, Plus, Sparkles, Trash2 } from 'lucide-react';
import { api, type Project } from '@/api';
import { posterUrl } from '@/components/ProjectCover';
import { CalibrationStrip, FillimMark } from './FillimBrand';
import { fetchSaasMe, type SaasUser } from './auth-client';
import './saas.css';

interface WorkspaceDashboardProps {
  user: SaasUser;
  onUserUpdated: (user: SaasUser) => void;
  onOpenProject: (projectId: string) => void;
  onHome: () => void;
  onSignOut: () => void;
}

const QUICK_STARTERS = [
  { label: 'Launch Video', title: 'Product Launch Film' },
  { label: 'Kinetic Typography', title: 'Kinetic Type Opener' },
  { label: 'Feature Walkthrough', title: '60s Explainer Cut' },
];

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function WorkspaceDashboard({
  user,
  onUserUpdated,
  onOpenProject,
  onHome,
  onSignOut,
}: WorkspaceDashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [list, me] = await Promise.all([api.projects(), fetchSaasMe()]);
      setProjects(list);
      if (me.user) onUserUpdated(me.user);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [onUserUpdated]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const createFilm = async (title: string) => {
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.newProject(title.trim() || 'Untitled Film');
      setNewName('');
      onOpenProject(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project.');
      setCreating(false);
    }
  };

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await createFilm(newName);
  };

  const handleDuplicate = async (project: Project) => {
    setBusyId(project.id);
    try {
      await api.duplicateProject(project.id, `${project.name} Copy`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not duplicate project.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (project: Project) => {
    setBusyId(project.id);
    try {
      await api.forget(project.id);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete project.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="fillim-saas min-h-screen bg-[#f6eae6] text-[#191918] antialiased">
      <CalibrationStrip />

      {/* Top Workspace Bar */}
      <header className="border-b border-[#191918] bg-[#f6eae6]">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button type="button" onClick={onHome} className="flex items-center gap-2 text-[#191918]">
              <FillimMark size={24} />
              <span className="fillim-display text-[26px] leading-none">FILLIM</span>
            </button>
            <span aria-hidden className="text-[#4a4744]">/</span>
            <span className="text-[14px] font-medium text-[#4a4744]">Studio Workspace</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="fillim-mono hidden items-center gap-2 rounded-lg border border-[#191918] bg-[#fbf4f1] px-3 py-1.5 text-[12.5px] sm:flex">
              <span className="font-semibold uppercase text-[#087774]">{user.plan}</span>
              <span aria-hidden className="text-[#4a4744]">·</span>
              <span className="font-semibold text-[#193885]">{user.credits_remaining} credits</span>
            </div>
            <span className="hidden text-[13.5px] font-medium text-[#4a4744] md:inline">
              {user.name || user.email}
            </span>
            <button
              type="button"
              onClick={onSignOut}
              className="fillim-btn-press inline-flex items-center gap-1.5 rounded-lg border border-[#191918] bg-[#fbf4f1] px-3 py-1.5 text-[13px] font-semibold text-[#191918] hover:bg-[#191918] hover:text-[#f6eae6]"
            >
              <LogOut size={14} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1360px] px-4 py-8 sm:px-6 lg:px-8">
        {/* Create New Film Bar */}
        <div className="flex flex-col justify-between gap-6 rounded-xl border-2 border-[#191918] bg-[#fbf4f1] p-6 lg:flex-row lg:items-center">
          <div>
            <h1 className="fillim-display text-[36px] leading-none text-[#191918]">YOUR FILM PROJECTS</h1>
            <p className="mt-2 text-[14.5px] text-[#4a4744]">
              Signed in as <span className="font-semibold text-[#191918]">{user.email}</span> · Open any cut to launch the timeline, grading scopes, and AI Director.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex w-full max-w-[440px] items-center gap-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New film title..."
              maxLength={80}
              className="h-10 flex-1 rounded-lg border border-[#191918] bg-[#f6eae6] px-3 text-[14px] text-[#191918] placeholder-[#4a4744]"
            />
            <button
              type="submit"
              disabled={creating}
              className="fillim-btn-press inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[#191918] bg-[#ca281b] px-4 text-[14px] font-semibold text-[#fffaf8] hover:bg-[#a61f14] disabled:opacity-60"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              New film
            </button>
          </form>
        </div>

        {error && (
          <div
            role="alert"
            className="mt-5 rounded-lg border-2 border-[#ca281b] bg-[#ca281b]/10 px-4 py-3 text-[14px] font-medium text-[#8f180e]"
          >
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-xl border-2 border-[#191918] bg-[#fbf4f1] text-[#4a4744]">
                <Loader2 size={18} className="mr-2 animate-spin text-[#ca281b]" /> Loading films...
              </div>
            ) : projects.length === 0 ? (
              <div className="rounded-xl border-2 border-[#191918] bg-[#fbf4f1] px-6 py-12">
                <div className="inline-flex items-center gap-2 text-[14px] font-bold text-[#087774]">
                  <Clapperboard size={18} />
                  <span>Lights ready</span>
                </div>
                <h2 className="fillim-display mt-2 text-[34px] leading-none text-[#191918]">
                  PICK A STARTER OR ROLL BLANK
                </h2>
                <p className="mt-3 max-w-[50ch] text-[14.5px] leading-relaxed text-[#4a4744]">
                  Every new project opens directly inside Studio with our interactive AI Director docked beside your multi-track timeline.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  {QUICK_STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      disabled={creating}
                      onClick={() => void createFilm(starter.title)}
                      className="fillim-btn-press inline-flex items-center gap-2 rounded-lg border border-[#191918] bg-[#f6eae6] px-4 py-2.5 text-[13.5px] font-semibold text-[#191918] hover:bg-[#eee0db] disabled:opacity-60"
                    >
                      <Sparkles size={14} className="text-[#ca281b]" />
                      {starter.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2">
                {projects.map((p) => (
                  <div
                    key={p.id}
                    className="group flex flex-col overflow-hidden rounded-xl border-2 border-[#191918] bg-[#fbf4f1] shadow-[4px_4px_0_#191918] transition-transform hover:-translate-y-0.5"
                  >
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      className="relative aspect-video w-full overflow-hidden border-b border-[#191918] bg-[#161615] text-left"
                    >
                      {!p.missing ? (
                        <img
                          src={posterUrl(p)}
                          alt=""
                          className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center bg-[#161615]/50">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[#f6eae6] bg-[#161615] px-3 py-1.5 text-[13px] font-semibold text-[#f6eae6]">
                          <Film size={14} className="text-[#ca281b]" /> Open Studio &amp; AI Chat
                        </span>
                      </div>
                      <span className="fillim-mono absolute bottom-2.5 right-2.5 rounded bg-[#f6eae6] px-2 py-0.5 text-[12px] font-medium text-[#191918]">
                        {formatDuration((p as Project & { duration?: number }).duration)}
                      </span>
                    </button>

                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-bold text-[#191918]">{p.name}</div>
                        <div className="fillim-mono mt-0.5 text-[12px] text-[#4a4744]">
                          {new Date(p.openedAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleDuplicate(p)}
                          title="Duplicate film"
                          aria-label={`Duplicate ${p.name}`}
                          className="rounded-md border border-transparent p-1.5 text-[#4a4744] transition-colors hover:border-[#191918] hover:bg-[#eee0db] hover:text-[#191918] disabled:opacity-40"
                        >
                          <Copy size={15} />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleDelete(p)}
                          title="Delete film"
                          aria-label={`Delete ${p.name}`}
                          className="rounded-md border border-transparent p-1.5 text-[#4a4744] transition-colors hover:border-[#ca281b] hover:bg-[#ca281b]/10 hover:text-[#ca281b] disabled:opacity-40"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity Ledger */}
          <aside className="lg:col-span-4">
            <div className="rounded-xl border-2 border-[#191918] bg-[#fbf4f1] p-5">
              <div className="flex items-center justify-between border-b border-[#191918] pb-3">
                <h2 className="fillim-display text-[22px] leading-none text-[#191918]">RECENT ACTIVITY</h2>
                <span className="fillim-mono text-[12px] font-semibold uppercase text-[#087774]">CLOUD LOG</span>
              </div>
              <div className="mt-4 divide-y divide-[#191918]/20">
                {user.recent_events && user.recent_events.length > 0 ? (
                  user.recent_events.map((ev) => (
                    <div key={ev.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                      <div className="min-w-0">
                        <div className="fillim-mono truncate text-[12.5px] font-medium text-[#191918]">
                          {ev.event_type}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-[#4a4744]">
                          <Clock size={12} />
                          {new Date(ev.created_at).toLocaleString()}
                        </div>
                      </div>
                      {ev.credits_delta !== 0 && (
                        <span className="fillim-mono shrink-0 text-[12.5px] font-semibold text-[#193885]">
                          {ev.credits_delta > 0 ? `+${ev.credits_delta}` : ev.credits_delta}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[13.5px] leading-relaxed text-[#4a4744]">
                    No renders or AI sessions logged yet. Create a film to start directing.
                  </p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
