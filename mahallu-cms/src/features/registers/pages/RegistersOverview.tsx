import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { REGISTER_CONFIGS } from '../registerConfigs';
import PageHeader from '@/components/layout/PageHeader';
import { loadErrorMessage } from '@/utils/errors';

/** Count cards for every register - 2-up on mobile, wider on desktop. */
export default function RegistersOverview() {
  const [rows, setRows] = useState<RegisterSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = () => {
    setLoading(true);
    setError(null);
    registerService
      .getSummary()
      .then(setRows)
      .catch((err) => setError(loadErrorMessage(err, 'register summary')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const countFor = (key: string) => rows.find((row) => row.key === key)?.count ?? 0;

  return (
    <div className="space-y-3">
      <PageHeader
        title="Community Registers"
        description="Live views derived from family and member records"
      />

      {loading ? (
        <PageSkeleton variant="section" />
      ) : error ? (
        <div className="py-10 text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <Button onClick={fetchSummary} className="mt-4" variant="outline">
            Retry
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {REGISTER_CONFIGS.map((config) => (
            <Link key={config.key} to={`/registers/${config.key}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <p className="text-xs font-medium leading-tight text-gray-500 dark:text-gray-400 sm:text-sm">
                  {config.title}
                </p>
                <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
                  {countFor(config.key)}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
