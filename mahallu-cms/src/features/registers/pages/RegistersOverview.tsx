import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { REGISTER_CONFIGS } from '../registerConfigs';
import PageHeader from '@/components/layout/PageHeader';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';

/** Count cards for every register - 2-up on mobile, wider on desktop. */
export default function RegistersOverview() {
  const [rows, setRows] = useState<RegisterSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadErrorInfo | null>(null);

  const fetchSummary = () => {
    setLoading(true);
    setError(null);
    registerService
      .getSummary()
      .then(setRows)
      .catch((err) => setError(loadErrorInfo(err, 'register summary')))
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
        <EmptyState
          variant={error.variant}
          entity="registers"
          title={error.variant === 'info' ? error.title : undefined}
          description={error.message}
          action={error.variant === 'info' ? undefined : { label: 'Retry', onClick: fetchSummary }}
        />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {REGISTER_CONFIGS.map((config) => (
            <Link key={config.key} to={`/registers/${config.key}`}>
              <Card padding="sm" className="h-full transition-shadow hover:shadow-md">
                <p className="text-label font-medium leading-tight text-muted-foreground sm:text-sm">
                  {config.title}
                </p>
                <p className="mt-1 text-base font-semibold text-foreground sm:text-xl">
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
