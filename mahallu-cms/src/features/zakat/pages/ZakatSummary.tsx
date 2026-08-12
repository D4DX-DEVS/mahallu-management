import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  zakatDistributionService,
  ZakatSummary as SummaryData,
  DISTRIBUTION_TYPE_OPTIONS,
} from '@/services/zakatDistributionService';

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
    setLoading(true);
    zakatDistributionService
      .getSummary(Number(year))
      .then(setSummary)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load summary'))
      .finally(() => setLoading(false));
  }, [year]);

  const cards = [
    { label: 'Collected', value: `Rs ${summary?.collected ?? 0}` },
    { label: 'Distributed', value: `Rs ${summary?.distributed ?? 0}` },
    { label: 'Balance', value: `Rs ${summary?.balance ?? 0}` },
    { label: 'Verified Beneficiaries', value: summary?.verifiedBeneficiaries ?? 0 },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Zakat Summary</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Collections against distributions for the selected year
          </p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Zakat' }]} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full sm:w-40">
          <Select options={YEAR_OPTIONS} value={year} onChange={(e) => setYear(e.target.value)} />
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link to="/zakat/beneficiaries">
            <Button variant="outline" size="md" className="w-full sm:w-auto">
              Beneficiaries
            </Button>
          </Link>
          <Link to="/zakat/distributions">
            <Button size="md" className="w-full sm:w-auto">
              Distributions
            </Button>
          </Link>
        </div>
      </div>

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
            {cards.map((card) => (
              <Card key={card.label} className="p-3 sm:p-4">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">
                  {card.label}
                </p>
                <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
                  {card.value}
                </p>
              </Card>
            ))}
          </div>

          <Card className="p-3 sm:p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Distribution by Type</h2>
            {(summary?.byType || []).length === 0 ? (
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                No distributions recorded for {year}
              </p>
            ) : (
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
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
                    <p className="text-[0.65rem] text-gray-400">{row.count} payment(s)</p>
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
