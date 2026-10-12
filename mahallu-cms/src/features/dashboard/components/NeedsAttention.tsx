import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiHome, FiHeart, FiClipboard, FiUsers, FiDollarSign, FiCheckCircle, FiChevronRight } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Skeleton from '@/components/ui/Skeleton';
import { cn } from '@/utils/cn';
import { formatINR } from '@/utils/formatINR';
import { welfareService } from '@/services/welfareService';
import { surveyService } from '@/services/surveyService';
import { committeeService } from '@/services/committeeService';
import { familyService } from '@/services/familyService';
import { collectibleService } from '@/services/collectibleService';
import { useRole } from '../quickActions';
import { useModuleAccess } from '@/hooks/useModuleAccess';
import { canReadCommittees, canReadWelfare } from '@/utils/apiAccess';

interface Row {
  key: string;
  icon: React.ReactNode;
  tone: 'amber' | 'red' | 'green';
  title: string;
  detail: string;
  cta: string;
  to: string;
}

const TONE: Record<Row['tone'], string> = {
  amber: 'bg-[#FFF6CC] text-[#7A5B00] dark:bg-secondary-500/15 dark:text-secondary-300',
  red: 'bg-[#FDECEA] text-[#B3261E] dark:bg-red-500/15 dark:text-red-300',
  green: 'bg-mint text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime',
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Everything that is waiting on a human, with a one-click action into the
 * pre-filtered list. A source that fails or is not permitted for the role is
 * simply omitted - never shown as zero.
 */
export default function NeedsAttention({ pendingFamilies }: { pendingFamilies: number }) {
  const role = useRole();
  const { isModuleEnabled } = useModuleAccess();
  const [rows, setRows] = useState<Row[] | null>(null);
  // Plain booleans as effect inputs: isModuleEnabled changes identity when the tenant features
  // arrive, which used to re-run every request below a second time.
  const welfareOn = isModuleEnabled('welfare') && canReadWelfare(role);
  const surveyOn = isModuleEnabled('survey');
  const committeesOn = isModuleEnabled('committees') && canReadCommittees(role);
  const familiesOn = isModuleEnabled('families');

  useEffect(() => {
    let cancelled = false;
    const isMahall = role === 'super_admin' || role === 'mahall';
    const total = (r: { pagination?: { total?: number } | null }) => r.pagination?.total ?? 0;

    (async () => {
      const [welfarePending, welfareVerified, survey, committees, dues, headless] = await Promise.all([
        welfareOn ? welfareService.getApplications({ status: 'pending', limit: 1 }).then(total).catch(() => null) : null,
        welfareOn ? welfareService.getApplications({ status: 'verified', limit: 1 }).then(total).catch(() => null) : null,
        surveyOn ? surveyService.getStatus().catch(() => null) : null,
        committeesOn ? committeeService.getAll({ expiring: 'true', limit: 1 }).then((r) => r?.pagination?.total ?? 0).catch(() => null) : null,
        isMahall ? collectibleService.getFamilyDues({ onlyPending: true }).catch(() => null) : null,
        isMahall && familiesOn ? familyService.getNeedsAttention().catch(() => null) : null,
      ]);

      const next: Row[] = [];
      if (pendingFamilies > 0 && familiesOn)
        next.push({
          key: 'families',
          icon: <FiHome />,
          tone: 'amber',
          title: `${plural(pendingFamilies, 'family', 'families')} awaiting approval`,
          detail: 'Registered by the survey team, not yet in the register',
          cta: 'Approve',
          to: '/families?status=pending',
        });
      if (headless && headless.counts.needsNewHead > 0) {
        const list = headless.needsNewHead;
        const only = list.length === 1 ? list[0] : null;
        next.push({
          key: 'families-need-head',
          icon: <FiHome />,
          tone: 'amber',
          title: `${plural(headless.counts.needsNewHead, 'family', 'families')} need a new head`,
          detail: only ? `${only.houseName}: ${only.reason || 'the previous head is no longer active'}` : 'The previous head moved, passed away or was archived. Pick a new head so dues reach the right person',
          cta: 'Choose head',
          to: only ? `/families/${only.id}` : '/families?needsHead=true',
        });
      }
      if (welfarePending)
        next.push({
          key: 'welfare-pending',
          icon: <FiHeart />,
          tone: 'amber',
          title: `${plural(welfarePending, 'welfare application')} pending verification`,
          detail: 'Submitted and waiting for a first review',
          cta: 'Review',
          to: '/welfare/applications?status=pending',
        });
      if (welfareVerified)
        next.push({
          key: 'welfare-verified',
          icon: <FiHeart />,
          tone: 'amber',
          title: `${plural(welfareVerified, 'verified application')} awaiting a decision`,
          detail: 'Verified - approve or reject to move forward',
          cta: 'Review',
          to: '/welfare/applications?status=verified',
        });
      if (survey?.isOverdue)
        next.push({
          key: 'survey',
          icon: <FiClipboard />,
          tone: 'red',
          title: 'Community survey is overdue',
          detail: 'Generate a fresh demographic snapshot',
          cta: 'Review',
          to: '/survey',
        });
      if (committees)
        next.push({
          key: 'committees',
          icon: <FiUsers />,
          tone: 'red',
          title: `${plural(committees, 'committee term')} ending soon`,
          detail: 'Schedule re-election within the next 60 days',
          cta: 'Review',
          to: '/committees?expiring=true',
        });
      if (dues && dues.summary.totalDue > 0)
        next.push({
          key: 'dues',
          icon: <FiDollarSign />,
          tone: 'red',
          title: `${formatINR(dues.summary.totalDue)} varisangya outstanding`,
          detail: `${plural(dues.summary.familiesWithDues, 'family', 'families')} with pending dues`,
          cta: 'Review',
          to: '/collectibles/dues',
        });
      if (!cancelled) setRows(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [role, pendingFamilies, welfareOn, surveyOn, committeesOn, familiesOn]);

  return (
    <Card padding="lg" className="h-full">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-extrabold text-primary-700 dark:text-surface-text">Needs attention</h2>
          <p className="text-[12px] text-[#7B8983] dark:text-surface-muted">One click to the filtered list</p>
        </div>
        {rows && rows.length > 0 && (
          <span className="rounded-full bg-[#FFF6CC] px-2.5 py-0.5 text-[12px] font-bold text-[#7A5B00] dark:bg-secondary-500/15 dark:text-secondary-300">
            {rows.length} open
          </span>
        )}
      </div>

      {rows === null ? (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className="flex items-center gap-3 rounded-[10px] bg-mint px-4 py-5 dark:bg-brand-lime/10">
          <FiCheckCircle className="h-5 w-5 text-primary-600 dark:text-brand-lime" />
          <div>
            <p className="text-[13px] font-bold text-primary-700 dark:text-surface-text">You are all caught up</p>
            <p className="text-[12px] text-[#6A7771] dark:text-surface-muted">No approvals, reviews or dues need action right now.</p>
          </div>
        </div>
      ) : (
        <ul className="divide-y divide-line dark:divide-surface-border">
          {rows.map((r) => (
            <li key={r.key} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              <span className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] text-[15px]', TONE[r.tone])}>{r.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="break-words sm:truncate text-[13px] font-bold text-[#18231E] dark:text-surface-text">{r.title}</p>
                <p className="break-words sm:truncate text-[12px] text-[#7B8983] dark:text-surface-muted">{r.detail}</p>
              </div>
              <Link
                to={r.to}
                className="inline-flex h-7 max-sm:h-10 flex-shrink-0 items-center gap-1 rounded-lg bg-btn-primary px-3 text-[12px] font-bold text-white shadow-btn transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:bg-none dark:bg-brand-lime dark:text-primary-950 dark:shadow-none"
              >
                {r.cta} <FiChevronRight className="h-3 w-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
