import { useEffect, useRef, useState } from 'react';
import { FiSend, FiMessageCircle, FiPlus, FiClock, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import { controlClasses } from '@/components/ui/Input';
import { assistantService, type AssistantTurn } from '@/services/assistantService';
import { useAuthStore } from '@/store/authStore';

/**
 * Task C4 — AI assistant chat panel.
 *
 * Fonts: `font-body` is Poppins with a Noto Sans Malayalam fallback, so an
 * answer that mixes English and Malayalam renders each script in its own face.
 * Titles use Anek Malayalam (`font-title`).
 */

/** Friendly source labels — raw tool names are internal. */
const TOOL_LABELS: Record<string, string> = {
  get_community_summary: 'Community',
  get_finance_summary: 'Finance',
  get_welfare_summary: 'Welfare',
  get_zakat_summary: 'Zakat',
  get_education_summary: 'Education',
  get_employment_summary: 'Employment',
  get_programs_and_projects_summary: 'Programs & Projects',
  get_annual_report: 'Annual Report',
  get_development_index: 'Development Index',
};

const SUGGESTIONS = [
  'ഈ വർഷം എത്ര സകാത്ത് ശേഖരിച്ചു?',
  'How many welfare applications are still pending?',
  'എത്ര കുടുംബങ്ങളും അംഗങ്ങളും ഉണ്ട്?',
  'Show this year’s income and expense.',
];

/** ponytail: `**bold**` only — the prompt asks for short answers, not documents. */
function renderMarkup(text: string) {
  return text.split('\n').map((line, i) => (
    <p key={i} className={line.trim() ? 'mb-1 last:mb-0' : 'h-2'}>
      {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={j} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        )
      )}
    </p>
  ));
}

interface ChatTurn extends AssistantTurn {
  toolsUsed?: string[];
}

interface StoredChat {
  id: string;
  title: string;
  turns: ChatTurn[];
  updatedAt: number;
}

const MAX_CHATS = 20;

/** ponytail: localStorage per tenant — no server-side chat storage. DB-backed history if multi-device sync is asked for. */
const loadChats = (key: string): StoredChat[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatWhen = (ts: number) => {
  const d = new Date(ts);
  const today = new Date().toDateString() === d.toDateString();
  return today
    ? d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
};

export default function Assistant() {
  const tenantId = useAuthStore((s) => s.currentTenantId || s.user?.tenantId || 'default');
  const storageKey = `assistant-chats:${tenantId}`;

  const [chats, setChats] = useState<StoredChat[]>(() => loadChats(storageKey));
  const [currentId, setCurrentId] = useState<string | null>(() => loadChats(storageKey)[0]?.id ?? null);
  const [showHistory, setShowHistory] = useState(false);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [remaining, setRemaining] = useState<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const loadedKey = useRef(storageKey);

  const current = chats.find((c) => c.id === currentId);
  const turns = current?.turns ?? [];

  // Persist BEFORE the tenant-switch effect below: on a switch render, loadedKey
  // still holds the old key, so this skips instead of writing old chats to the new key.
  useEffect(() => {
    if (loadedKey.current === storageKey) localStorage.setItem(storageKey, JSON.stringify(chats));
  }, [chats, storageKey]);

  // Super admin switched tenant — swap to that tenant's history.
  useEffect(() => {
    if (loadedKey.current !== storageKey) {
      loadedKey.current = storageKey;
      const next = loadChats(storageKey);
      setChats(next);
      setCurrentId(next[0]?.id ?? null);
      setShowHistory(false);
      setError('');
    }
  }, [storageKey]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns.length, loading]);

  const appendTurn = (id: string, turn: ChatTurn) =>
    setChats((prev) =>
      prev.map((c) => (c.id === id ? { ...c, turns: [...c.turns, turn], updatedAt: Date.now() } : c))
    );

  const newChat = () => {
    setCurrentId(null);
    setShowHistory(false);
    setError('');
  };

  const openChat = (id: string) => {
    setCurrentId(id);
    setShowHistory(false);
    setError('');
  };

  const deleteChat = (id: string) => {
    setChats((prev) => prev.filter((c) => c.id !== id));
    if (id === currentId) setCurrentId(null);
  };

  const send = async (text: string) => {
    const asked = text.trim();
    if (!asked || loading) return;

    let id = currentId;
    if (!id) {
      id = crypto.randomUUID();
      setCurrentId(id);
      setChats((prev) =>
        [{ id, title: asked.slice(0, 60), turns: [], updatedAt: Date.now() }, ...prev].slice(0, MAX_CHATS)
      );
    }

    const history = turns.map(({ role, content }) => ({ role, content }));
    appendTurn(id, { role: 'user', content: asked });
    setQuestion('');
    setError('');
    setLoading(true);
    try {
      const res = await assistantService.ask(asked, history);
      appendTurn(id, { role: 'assistant', content: res.answer, toolsUsed: res.toolsUsed });
      if (typeof res.remaining === 'number') setRemaining(res.remaining);
    } catch (err: any) {
      const data = err?.response?.data;
      setError(
        data?.code === 'not_configured'
          ? 'AI സഹായി ഇതുവരെ ലഭ്യമല്ല — AI assistant is not available yet.'
          : data?.message || "Couldn't reach the assistant. Try again in a moment."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={<span className="font-title">AI സഹായി</span>}
        description={
          <span className="font-body">
            Ask about this Mahallu in Malayalam or English — മലയാളത്തിലോ ഇംഗ്ലീഷിലോ ചോദിക്കാം.
          </span>
        }
        actions={
          <div className="relative flex gap-2">
            {chats.length > 0 && (
              <Button type="button" variant="secondary" onClick={() => setShowHistory((v) => !v)}>
                <FiClock className="h-3.5 w-3.5" />
                History
              </Button>
            )}
            {turns.length > 0 && (
              <Button type="button" variant="secondary" onClick={newChat} disabled={loading}>
                <FiPlus className="h-3.5 w-3.5" />
                New chat
              </Button>
            )}
            {showHistory && (
              <div className="absolute right-0 top-full z-10 mt-1 max-h-80 w-80 overflow-y-auto rounded-xl border border-line bg-white shadow-card-hover dark:border-surface-border dark:bg-surface-card">
                {chats.map((c) => (
                  <div
                    key={c.id}
                    className={`flex items-center gap-2 border-b border-line-soft px-3 py-2 last:border-0 dark:border-surface-border ${
                      c.id === currentId ? 'bg-mint dark:bg-brand-lime/10' : 'hover:bg-[#F4F7F5] dark:hover:bg-surface-hover'
                    }`}
                  >
                    <button type="button" onClick={() => openChat(c.id)} className="flex-1 overflow-hidden text-left">
                      <span className="font-body block truncate text-[13px] text-[#18231E] dark:text-surface-text">{c.title}</span>
                      <span className="font-body text-[12px] text-[#98A59F]">{formatWhen(c.updatedAt)}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteChat(c.id)}
                      className="shrink-0 rounded-lg p-1.5 text-[#98A59F] hover:bg-[#FDECEA] hover:text-[#B3261E] dark:hover:bg-red-500/15"
                      aria-label="Delete chat"
                    >
                      <FiTrash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        }
      />

      <Card padding="lg">
        <div className="h-[55vh] overflow-y-auto pr-1">
          {turns.length === 0 && (
            <div className="py-8 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-mint text-primary-600 dark:bg-brand-lime/10 dark:text-brand-lime">
                <FiMessageCircle className="h-6 w-6" aria-hidden="true" />
              </span>
              <p className="font-body mt-2 text-[13px] text-[#7B8983] dark:text-surface-muted">Try one of these:</p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => send(s)}
                    className="font-body rounded-full border border-line px-3 py-1.5 text-xs text-[#3A4741] transition-colors hover:border-primary-600 hover:bg-mint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:border-surface-border dark:text-surface-text dark:hover:bg-surface-hover"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-3">
            {turns.map((turn, i) => (
              <div key={i} className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
                <div
                  className={`font-body max-w-[85%] rounded-2xl px-3.5 py-2 text-[13px] leading-relaxed ${
                    turn.role === 'user'
                      ? 'bg-primary-700 text-white dark:bg-brand-lime dark:text-primary-950'
                      : 'bg-[#F4F7F5] text-[#18231E] dark:bg-surface-raised dark:text-surface-text'
                  }`}
                >
                  {renderMarkup(turn.content)}
                  {turn.toolsUsed && turn.toolsUsed.length > 0 && (
                    <div className="mt-1 text-[12px] opacity-60">
                      Source: {Array.from(new Set(turn.toolsUsed.map((t) => TOOL_LABELS[t] || 'ERP data'))).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && <div className="font-body text-[13px] text-[#7B8983] dark:text-surface-muted">ആലോചിക്കുന്നു…</div>}
          </div>
          <div ref={endRef} />
        </div>

        {error && <Alert tone="danger" className="mt-2">{error}</Alert>}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(question);
          }}
          className="mt-3 flex gap-2"
        >
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={1000}
            placeholder="ചോദ്യം ടൈപ്പ് ചെയ്യുക…"
            className={`font-body flex-1 ${controlClasses} h-9`}
          />
          <Button type="submit" iconOnly aria-label="Send" disabled={loading || !question.trim() || remaining === 0}>
            <FiSend className="h-4 w-4" />
          </Button>
        </form>
        {remaining !== null && (
          <p className="font-body mt-1.5 text-right text-[12px] text-[#98A59F]">
            ഇന്ന് ബാക്കി {remaining} ചോദ്യങ്ങൾ · {remaining} left today
          </p>
        )}
      </Card>
    </div>
  );
}
