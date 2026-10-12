import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCheck, FiX, FiArrowRight } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/store/authStore';
import { tenantService } from '@/services/tenantService';
import { instituteService } from '@/services/instituteService';
import { announcementService } from '@/services/announcementService';

interface Props {
  familyCount: number;
  userCount: number;
  /** Total ledger entries; null when unknown (no finance access) */
  ledgerCount: number | null;
}

interface Step {
  key: string;
  label: string;
  hint: string;
  to: string;
  done: boolean;
}

const keyFor = (tenantId: string | null | undefined) => `zaad.onboarding.dismissed.${tenantId || 'default'}`;

function ProgressRing({ value, total }: { value: number; total: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const pct = total ? value / total : 0;
  return (
    <div className="relative h-[68px] w-[68px] flex-shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="32" cy="32" r={r} fill="none" strokeWidth="6" className="stroke-[#E3EAE6] dark:stroke-surface-border" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct)}
          className="stroke-primary-600 transition-[stroke-dashoffset] duration-500 dark:stroke-brand-lime"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[13px] font-extrabold text-primary-700 dark:text-surface-text">
        {value}/{total}
      </span>
    </div>
  );
}

/**
 * "Get started" card for new tenants. Steps tick themselves from real counts;
 * dismissal is remembered per tenant in this browser.
 */
export default function OnboardingChecklist({ familyCount, userCount, ledgerCount }: Props) {
  const tenantId = useAuthStore((s) => s.currentTenantId || s.user?.tenantId);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(keyFor(tenantId)) === '1';
    } catch {
      return false;
    }
  });
  const [gradesSet, setGradesSet] = useState(false);
  const [institutes, setInstitutes] = useState(0);
  const [announcements, setAnnouncements] = useState(0);

  const isNew = familyCount < 3 || ledgerCount === 0;

  useEffect(() => {
    if (dismissed || !isNew) return;
    if (tenantId) {
      tenantService
        .getById(tenantId)
        .then((t) => setGradesSet((t.settings?.varisangyaGrades?.length ?? 0) > 0))
        .catch(() => undefined);
    }
    instituteService.getAll({ limit: 1 }).then((r) => setInstitutes(r.pagination?.total ?? r.data.length)).catch(() => undefined);
    announcementService.getAll({ limit: 1 }).then((r) => setAnnouncements(r.pagination?.total ?? r.data.length)).catch(() => undefined);
  }, [dismissed, isNew, tenantId]);

  if (dismissed || !isNew) return null;

  const steps: Step[] = [
    { key: 'family', label: 'Add your first family', hint: 'Start the register', to: '/families/create', done: familyCount > 0 },
    { key: 'import', label: 'Import families from CSV', hint: 'Ticks at 10+ families', to: '/families', done: familyCount >= 10 },
    { key: 'grades', label: 'Create varisangya grade settings', hint: 'Grades and monthly amounts', to: '/mahall-main', done: gradesSet },
    { key: 'institute', label: 'Add an institute', hint: 'Madrasa, mosque or other', to: '/institutes/create', done: institutes > 0 },
    { key: 'user', label: 'Invite a mahall user', hint: 'Give a colleague access', to: '/users/mahall/create', done: userCount > 1 },
    { key: 'announce', label: 'Send your first announcement', hint: 'Reach every family', to: '/announcements/create', done: announcements > 0 },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  if (doneCount === steps.length) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(keyFor(tenantId), '1');
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <Card padding="lg" tint className="relative">
      <button
        onClick={dismiss}
        aria-label="Dismiss get started"
        className="absolute right-3 top-3 rounded-md p-1 text-[#7B8983] transition-colors hover:bg-[#F1F5F3] dark:hover:bg-surface-hover"
      >
        <FiX className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-4">
        <ProgressRing value={doneCount} total={steps.length} />
        <div>
          <h2 className="text-[15px] font-extrabold text-primary-700 dark:text-surface-text">Get started</h2>
          <p className="text-[12px] text-[#6A7771] dark:text-surface-muted">
            {steps.length - doneCount} step{steps.length - doneCount === 1 ? '' : 's'} left to set up your Mahallu.
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
        {steps.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            className={cn(
              'group flex items-center gap-3 rounded-[10px] border px-3 py-2.5 transition-colors',
              s.done
                ? 'border-transparent bg-mint/60 dark:bg-brand-lime/10'
                : 'border-line bg-white hover:bg-[#F6FAF8] dark:border-surface-border dark:bg-surface-card dark:hover:bg-surface-hover/60'
            )}
          >
            <span
              className={cn(
                'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2',
                s.done
                  ? 'border-primary-600 bg-primary-600 text-white dark:border-brand-lime dark:bg-brand-lime dark:text-primary-950'
                  : 'border-[#C9D5CF] dark:border-surface-border-strong'
              )}
            >
              {s.done && <FiCheck className="h-3.5 w-3.5" strokeWidth={3} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={cn('block break-words sm:truncate text-[12.5px] font-bold', s.done ? 'text-[#7B8983] line-through dark:text-surface-muted' : 'text-[#18231E] dark:text-surface-text')}>
                {s.label}
              </span>
              <span className="block break-words sm:truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{s.hint}</span>
            </span>
            {!s.done && <FiArrowRight className="h-3.5 w-3.5 text-[#9AA7A1] transition-transform group-hover:translate-x-0.5" />}
          </Link>
        ))}
      </div>
    </Card>
  );
}
