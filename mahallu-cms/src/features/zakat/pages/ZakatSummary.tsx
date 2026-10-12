import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ZakatFundMeter from '../components/ZakatFundMeter';
import {
  zakatDistributionService,
  ZakatSummary as SummaryData,
  ZakatFund,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - i;
  return { value: String(year), label: String(year) };
});

export default function ZakatSummary() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [fund, setFund] = useState<ZakatFund | null>(null);
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    zakatDistributionService.getFund().then(setFund).catch(() => setFund(null));
  }, []);

  useEffect(() => {
    setLoading(true);
    zakatDistributionService
      .getSummary(Number(year))
      .then(setSummary)
      .catch((err) => setError(getFriendlyError(err, "Couldn't load summary. Refresh the page or try again.")))
      .finally(() => setLoading(false));
  }, [year]);

  const cards = [
    { label: 'Collected', value: `Rs ${summary?.collected ?? 0}`, viz: summary && summary.collected > 0 ? { type: 'pair' as const, a: summary.collected, b: summary.distributed } : undefined, summary: `Collected Rs ${summary?.collected ?? 0} compared with Rs ${summary?.distributed ?? 0} distributed` },
    { label: 'Distributed', value: `Rs ${summary?.distributed ?? 0}`, viz: summary && summary.collected > 0 ? { type: 'ring' as const, percent: pct(summary.distributed, summary.collected), color: '#8EC13E' } : undefined, summary: `Distributed Rs ${summary?.distributed ?? 0} of Rs ${summary?.collected ?? 0} collected, ${pct(summary?.distributed ?? 0, summary?.collected ?? 0)} percent` },
    { label: 'Balance', value: `Rs ${summary?.balance ?? 0}`, viz: summary && summary.collected > 0 ? { type: 'bullet' as const, percent: pct(summary.balance, summary.collected), target: 100 } : undefined, summary: `Balance Rs ${summary?.balance ?? 0} of Rs ${summary?.collected ?? 0} collected` },
    { label: 'Verified Beneficiaries', value: summary?.verifiedBeneficiaries ?? 0 },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Zakat summary"
        description="Collections against distributions for the selected year"
        actions={
          <>
            <div className="w-32">
              <Select aria-label="Year" options={YEAR_OPTIONS} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
            <Link to="/zakat/beneficiaries">
              <Button variant="secondary">Beneficiaries</Button>
            </Link>
            <Link to="/zakat/distributions">
              <Button>Distributions</Button>
            </Link>
          </>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <Card>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {cards.map((card, i) => (
              <StatCard key={card.label} variant="tile" tone={i === 0 ? 'green' : i === 1 ? 'lime' : 'neutral'} title={card.label} value={card.value} viz={card.viz} summary={card.summary} />
            ))}
          </div>

          <ZakatFundMeter fund={fund} />

          <Card>
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Distribution by Type</h2>
            {(summary?.byType || []).length === 0 ? (
              <p className="mt-2 text-sm text-[#7B8983] dark:text-surface-muted">
                No distributions recorded for {year}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {summary?.byType.map((row) => (
                  <div
                    key={row.type}
                    className="rounded-xl border border-line p-2.5 dark:border-surface-border"
                  >
                    <p className="text-xs text-[#7B8983] dark:text-surface-muted">
                      {DISTRIBUTION_TYPE_OPTIONS.find((o) => o.value === row.type)?.label || row.type}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-[#18231E] dark:text-surface-text sm:text-base">
                      Rs {row.total}
                    </p>
                    <p className="text-[0.65rem] text-[#98A59F]">{row.count} payment(s)</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(summary?.pendingBeneficiaries ?? 0) > 0 && (
            <Link to="/zakat/beneficiaries">
              <Alert tone="warning">
                {summary?.pendingBeneficiaries} beneficiary application(s) awaiting verification
              </Alert>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
