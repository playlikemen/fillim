import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { Copy, Film, Loader2, LogOut, Plus, Trash2, Sparkles, Clock } from 'lucide-react';
import { api, type Project } from '@/api';
import { BrandLogo } from '@/components/BrandLogo';
import { posterUrl } from '@/components/ProjectCover';
import { fetchSaasMe, type SaasUser } from './auth-client';

interface WorkspaceDashboardProps {
  user: SaasUser;
  onUserUpdated: (user: SaasUser) => void;
  onOpenProject: (projectId: string) => void;
  onHome: () => void;
  onSignOut: () => void;
}

function formatDuration(seconds?: number) {
  if (!seconds || !Number.isFinite(seconds)) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function WorkspaceDashboard({ user, onUserUpdated, onOpenProject, onHome, onSignOut }: WorkspaceDashboardProps) {
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api.newProject(newName.trim() || 'Untitled Film');
      setNewName('');
      onOpenProject(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create project.');
      setCreating(false);
    }
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
    <div className="min-h-screen bg-[#06070a] text-[#f3f5f7] antialiased">
      {/* Top Bar */}
      <header className="border-b border-white/[0.08] bg-[#0a0c11]">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 sm:px-8">
          <div className="flex items-center gap-4">
            <button type="button" onClick={onHome} className="flex items-center gap-2.5 text-white">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/12 bg-[#0e1117] text-[#00a3ae]">
                <BrandLogo size={17} />
              </span>
              <span className="text-[15.5px] font-semibold tracking-[-0.02em]">Fillim</span>
            </button>
            <span className="text-white/20">/</span>
            <span className="text-[13.5px] text-[#9aa4b2]">Cloud Workspace</span>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-lg border border-white/10 bg-[#0e1117] px-3 py-1.5 font-mono text-[12px] sm:flex">
              <span className="uppercase text-[#5ce1ea]">{user.plan}</span>
              <span className="text-white/20">·</span>
              <span className="text-[#e5a93b]">{user.credits_remaining} credits</span>
            </div>
            <span className="hidden text-[13px] text-[#b4becb] md:inline">{user.name || user.email}</span>
            <button
              type="button"
              onClick={onSignOut}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/12 bg-[#0e1117] px-3 py-1.5 text-[12.5px] text-[#c5ccd6] transition hover:border-white/25 hover:text-white"
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 py-10 sm:px-8">
        {/* Create New Project Bar */}
        <div className="flex flex-col justify-between gap-6 rounded-2xl border border-white/10 bg-[#0e1117] p-6 lg:flex-row lg:items-center">
          <div>
            <h1 className="text-[24px] font-semibold tracking-[-0.03em] text-white">Your Film Projects</h1>
            <p className="mt-1 text-[14px] text-[#8d96a5]">
              Signed in as <span className="text-[#dbe1ea]">{user.email}</span> · Projects and usage persisted in Neon Lakebase Postgres.
            </p>
          </div>

          <form onSubmit={handleCreate} className="flex w-full max-w-[440px] items-center gap-2.5">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New film title..."
              maxLength={80}
              className="h-10 flex-1 rounded-lg border border-white/12 bg-[#080a0f] px-3 text-[14px] text-white placeholder-[#5c6574] outline-none transition focus:border-[#00a3ae]"
            />
            <button
              type="submit"
              disabled={creating}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-[#00a3ae] px-4 text-[13.5px] font-semibold text-[#041416] transition hover:bg-[#19b9c4] disabled:opacity-60"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              New film
            </button>
          </form>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-[#d1342f]/50 bg-[#d1342f]/10 px-4 py-3 text-[13.5px] text-[#ff9f9b]">
            {error}
          </div>
        )}

        {/* Projects Grid */}
        <div className="mt-8 grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-8">
            {loading ? (
              <div className="flex h-48 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#0e1117] text-[#8d96a5]">
                <Loader2 size={18} className="mr-2 animate-spin" /> Loading projects...
              </div>
            ) : projects.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#0a0c11] px-6 py-16 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-[#0e1117] text-[#00a3ae]">
                  <Sparkles size={20} />
                </span>
                <h2 className="mt-4 text-[18px] font-medium text-white">No films yet</h2>
                <p className="mt-1.5 max-w-[38ch] text-[14px] text-[#8d96a5]">
                  Create your first cloud film project above to launch the timeline, canvas, and color studio.
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {projects.map((p) => (
                  <div key={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#0e1117] transition hover:border-white/25">
                    <button
                      type="button"
                      onClick={() => onOpenProject(p.id)}
                      className="relative aspect-video w-full overflow-hidden bg-[#080a0f] text-left"
                    >
                      {!p.missing ? (
                        <img
                          src={posterUrl(p)}
                          alt=""
                          className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.02]"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : null}
                      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-black/75 via-transparent to-transparent">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-black/65 px-3 py-1.5 text-[12.5px] font-medium text-white opacity-95 backdrop-blur">
                          <Film size={13} className="text-[#00a3ae]" /> Open in Studio
                        </span>
                      </div>
                      <span className="absolute bottom-2.5 right-2.5 rounded bg-black/75 px-2 py-0.5 font-mono text-[11px] tabular-nums text-[#e5a93b]">
                        {formatDuration((p as Project & { duration?: number }).duration)}
                      </span>
                    </button>

                    <div className="flex items-center justify-between gap-2 px-4 py-3">
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-medium text-white">{p.name}</div>
                        <div className="mt-0.5 font-mono text-[11px] text-[#7a8494]">
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
                          className="rounded-md p-1.5 text-[#8d96a5] transition hover:bg-white/[0.08] hover:text-white disabled:opacity-40"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={busyId === p.id}
                          onClick={() => handleDelete(p)}
                          title="Delete film"
                          aria-label={`Delete ${p.name}`}
                          className="rounded-md p-1.5 text-[#8d96a5] transition hover:bg-[#d1342f]/20 hover:text-[#ff9f9b] disabled:opacity-40"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Neon Postgres Activity Feed */}
          <aside className="lg:col-span-4">
            <div className="rounded-2xl border border-white/10 bg-[#0e1117] p-5">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <h2 className="text-[14.5px] font-medium text-white">Workspace Activity</h2>
                <span className="font-mono text-[11px] text-[#5ce1ea]">Neon DB</span>
              </div>
              <div className="mt-4 space-y-3">
                {user.recent_events && user.recent_events.length > 0 ? (
                  user.recent_events.map((ev) => (
                    <div key={ev.id} className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-[#080a0f] px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="truncate font-mono text-[12px] text-[#dbe1ea]">{ev.event_type}</div>
                        <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#7a8494]">
                          <Clock size={11} />
                          {new Date(ev.created_at).toLocaleString()}
                        </div>
                      </div>
                      {ev.credits_delta !== 0 && (
                        <span className="shrink-0 font-mono text-[11.5px] text-[#e5a93b]">
                          {ev.credits_delta > 0 ? `+${ev.credits_delta}` : ev.credits_delta}
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[13px] text-[#7a8494]">No events recorded yet. Create or export a film to see activity logged here.</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
