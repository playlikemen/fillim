import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Clapperboard, Loader2, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { FillimMark } from './FillimBrand';
import './saas.css';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  changedFiles?: string[];
  createdAt?: string;
}

interface StudioChatDrawerProps {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onFilmUpdated: () => void;
}

const STARTER_PROMPTS = [
  'Create a crisp 3-scene kinetic launch title in film.html',
  'Make the opening title bolder with three-strip motion bars',
  'Check pacing and tighten all cuts cleanly under 12s',
];

export function StudioChatDrawer({ projectId, open, onClose, onFilmUpdated }: StudioChatDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-chat`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((data: { enabled?: boolean; messages?: ChatMessage[] }) => {
        if (!alive) return;
        setEnabled(data.enabled !== false);
        setMessages(Array.isArray(data.messages) ? data.messages : []);
        setError(null);
      })
      .catch(() => {
        if (!alive) return;
        setError('Could not load AI Director history.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [projectId, open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending, open]);

  if (!open) return null;

  const sendPrompt = async (text: string) => {
    const clean = text.trim();
    if (!clean || sending) return;
    setError(null);
    setSending(true);
    setInput('');
    const optimistic: ChatMessage = { id: `tmp_${Date.now()}`, role: 'user', content: clean };
    setMessages((prev) => [...prev, optimistic]);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: clean }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        messages?: ChatMessage[];
        changedFiles?: string[];
      };
      if (!res.ok) {
        setError(data.error || 'AI Director could not complete that turn.');
        return;
      }
      if (Array.isArray(data.messages)) setMessages(data.messages);
      if (Array.isArray(data.changedFiles) && data.changedFiles.length > 0) {
        onFilmUpdated();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed.');
    } finally {
      setSending(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendPrompt(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendPrompt(input);
    }
  };

  const resetChat = async () => {
    if (sending) return;
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(projectId)}/ai-chat`, { method: 'DELETE' });
      if (res.ok) {
        setMessages([]);
        setError(null);
      }
    } catch { /* ignore */ }
  };

  return (
    <aside
      data-studio-host-panel
      aria-label="Fillim AI Film Director"
      className="fillim-saas flex h-full w-[330px] shrink-0 flex-col border-l border-[#191918] bg-[#f6eae6] text-[#191918] sm:w-[368px]"
    >
      {/* Cute Director Header */}
      <div className="flex items-center justify-between border-b border-[#191918] bg-[#fbf4f1] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <FillimMark size={20} />
          <div>
            <div className="flex items-center gap-1.5 text-[13.5px] font-bold leading-tight text-[#191918]">
              <span>AI Director</span>
              <span className="inline-flex h-2 w-2 rounded-full bg-[#087774]" />
            </div>
            <div className="fillim-mono text-[11.5px] text-[#4a4744]">Edits film.html live</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => void resetChat()}
            title="Start fresh thread"
            aria-label="Clear chat history"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#191918]/30 bg-[#f6eae6] text-[#4a4744] transition-colors hover:border-[#191918] hover:text-[#191918]"
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Hide AI Director"
            aria-label="Close AI Director"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#191918]/30 bg-[#f6eae6] text-[#4a4744] transition-colors hover:border-[#191918] hover:text-[#191918]"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 space-y-3 overflow-y-auto px-3.5 py-3.5">
        {loading ? (
          <div className="flex items-center gap-2 py-8 text-[13px] text-[#4a4744]">
            <Loader2 size={15} className="animate-spin text-[#ca281b]" />
            Loading director notes...
          </div>
        ) : messages.length === 0 ? (
          <div className="rounded-xl border border-[#191918] bg-[#fbf4f1] p-4">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[#191918]">
              <Clapperboard size={16} className="text-[#ca281b]" />
              Ready on set
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-[#4a4744]">
              Describe a shot, title card, timing tweak, or color shift. Changes land straight into your timeline while manual cuts stay protected.
            </p>
            <div className="mt-3 space-y-1.5">
              {STARTER_PROMPTS.map((chip) => (
                <button
                  key={chip}
                  type="button"
                  onClick={() => void sendPrompt(chip)}
                  className="flex w-full items-center gap-2 rounded-lg border border-[#191918] bg-[#f6eae6] px-2.5 py-2 text-left text-[12.5px] font-medium text-[#191918] transition-all hover:-translate-y-0.5 hover:bg-[#eee0db] hover:shadow-[2px_2px_0_#191918]"
                >
                  <Sparkles size={13} className="shrink-0 text-[#087774]" />
                  <span>{chip}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={`rounded-xl border border-[#191918] px-3.5 py-2.5 text-[13.5px] leading-relaxed ${
                msg.role === 'user'
                  ? 'ml-6 bg-[#191918] text-[#f6eae6]'
                  : 'mr-2 bg-[#fbf4f1] text-[#191918] shadow-[2px_2px_0_#191918]'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
              {msg.changedFiles && msg.changedFiles.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5 border-t border-[#191918]/15 pt-2">
                  {msg.changedFiles.map((f) => (
                    <span
                      key={f}
                      className="fillim-mono rounded border border-[#087774] bg-[#087774]/10 px-1.5 py-0.5 text-[11.5px] font-medium text-[#075d5b]"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}

        {sending && (
          <div className="mr-2 flex items-center gap-2 rounded-xl border border-[#191918] bg-[#fbf4f1] px-3.5 py-2.5 text-[13px] font-medium text-[#4a4744]">
            <Loader2 size={14} className="animate-spin text-[#ca281b]" />
            Directing your cut...
          </div>
        )}

        {!enabled && (
          <div className="rounded-xl border border-[#ca281b] bg-[#ca281b]/10 px-3 py-2 text-[12.5px] font-medium text-[#8f180e]">
            Add ANTHROPIC_API_KEY in `.env` on the server to activate AI Director replies.
          </div>
        )}

        {error && (
          <div role="alert" className="rounded-xl border border-[#ca281b] bg-[#ca281b]/10 px-3 py-2 text-[12.5px] font-medium text-[#8f180e]">
            {error}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <form onSubmit={handleSubmit} className="border-t border-[#191918] bg-[#fbf4f1] p-3">
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask AI Director to build or revise a shot..."
            disabled={sending}
            className="min-h-[58px] flex-1 resize-none rounded-lg border border-[#191918] bg-[#f6eae6] px-3 py-2 text-[13.5px] text-[#191918] placeholder-[#4a4744] disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            aria-label="Send message to AI Director"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#191918] bg-[#ca281b] text-[#fffaf8] shadow-[2px_2px_0_#191918] transition-all hover:bg-[#a61f14] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          </button>
        </div>
      </form>
    </aside>
  );
}
