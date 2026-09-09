import { useState, useEffect } from 'react';
import { FiSend, FiUsers } from 'react-icons/fi';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import {
  zakatDistributionService,
  ZakatSummary as SummaryData,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const currentYear = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => {
  const year = currentYear - i;
  return { value: String(year), label: String(year) };
});

export default function ZakatSummary() {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [year, setYear] = useState(String(currentYear));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // `error` was never cleared, so one failed year left the red panel on screen
    // for every year picked afterwards - even the ones that loaded fine. The
    // flag drops a slow reply that lands after the year has already moved on.
    let current = true;
    setLoading(true);
    setError(null);
    zakatDistributionService
      .getSummary(Number(year))
      .then((data) => {
        if (current) setSummary(data);
      })
      .catch((err) => {
        if (current) setError(loadErrorMessage(err, 'summary'));
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [year]);

  const cards = [
    { label: 'Collected', value: `Rs ${summary?.collected ?? 0}` },
    { label: 'Distributed', value: `Rs ${summary?.distributed ?? 0}` },
    { label: 'Balance', value: `Rs ${summary?.balance ?? 0}` },
    { label: 'Verified Beneficiaries', value: summary?.verifiedBeneficiaries ?? 0 },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Zakat Summary"
        description="Collections against distributions for the selected year"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-40">
          <Select options={YEAR_OPTIONS} value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Link to="/zakat/beneficiaries">
            <Button variant="outline" size="md" icon={<FiUsers />} collapseLabel>
              Beneficiaries
            </Button>
          </Link>
          <Link to="/zakat/distributions">
            <Button size="md" icon={<FiSend />} collapseLabel>
              Distributions
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <PageSkeleton variant="section" />
      ) : error ? (
        <Card>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((card) => (
              <Card key={card.label}>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                  {card.label}
                </p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                  {card.value}
                </p>
              </Card>
            ))}
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-foreground">Distribution by Type</h2>
            {(summary?.byType || []).length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No distributions recorded for {year}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {summary?.byType.map((row) => (
                  <div
                    key={row.type}
                    className="rounded-xl border border-gray-200 p-2.5 dark:border-gray-700"
                  >
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {DISTRIBUTION_TYPE_OPTIONS.find((o) => o.value === row.type)?.label || row.type}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-gray-100 sm:text-base">
                      Rs {row.total}
                    </p>
                    <p className="text-xs text-gray-400">{row.count} payment(s)</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {(summary?.pendingBeneficiaries ?? 0) > 0 && (
            <Link to="/zakat/beneficiaries">
              <Card className="border-l-4 border-amber-500 p-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  {summary?.pendingBeneficiaries} beneficiary application(s) awaiting verification
                </p>
              </Card>
            </Link>
          )}
        </>
      )}
    </div>
  );
}
