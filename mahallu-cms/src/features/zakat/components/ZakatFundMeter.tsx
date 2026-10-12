import { ZakatFund } from '@/services/zakatDistributionService';
import { formatINR } from '@/utils/formatINR';
import Card from '@/components/ui/Card';

/**
 * Where the zakat collected is today: paid out, waiting for approval, still available.
 * Plain data only; the bar is split in the same three parts as the numbers beside it.
 */
export default function ZakatFundMeter({ fund, className }: { fund: ZakatFund | null; className?: string }) {
  if (!fund) return null;
  const total = Math.max(fund.collected, fund.approved + fund.proposed, 1);
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / total) * 100))}%`;
  const available = Math.max(fund.available, 0);

  return (
    <Card className={className}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[12px] font-bold uppercase tracking-[0.05em] text-[#6A7771] dark:text-surface-muted">
            Zakat fund available
          </p>
          <p className="mt-0.5 text-2xl font-bold text-[#18231E] dark:text-surface-text">{formatINR(available)}</p>
        </div>
        <p className="text-xs text-[#5B6963] dark:text-surface-muted">
          {formatINR(fund.collected)} collected, {formatINR(fund.approved)} paid out
          {fund.proposed > 0 ? `, ${formatINR(fund.proposed)} waiting for approval` : ''}
        </p>
      </div>
      <div
        role="img"
        aria-label={`Of ${formatINR(fund.collected)} collected: ${formatINR(fund.approved)} paid out, ${formatINR(fund.proposed)} waiting for approval, ${formatINR(available)} available`}
        className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full bg-[#E7EEEA] dark:bg-[#2B342F]"
      >
        <span className="h-full bg-primary-700 dark:bg-brand-lime" style={{ width: pct(fund.approved) }} />
        <span className="h-full bg-secondary-500" style={{ width: pct(fund.proposed) }} />
        <span className="h-full bg-[#8EC13E]/60" style={{ width: pct(available) }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[#5B6963] dark:text-surface-muted">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary-700 dark:bg-brand-lime" />Paid out</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-secondary-500" />Waiting for approval</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-[#8EC13E]/60" />Available</span>
      </div>
    </Card>
  );
}
