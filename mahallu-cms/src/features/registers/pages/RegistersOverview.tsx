import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { REGISTER_CONFIGS } from '../registerConfigs';
import PageHeader from '@/components/ui/PageHeader';

/** Count cards for every register - 2-up on mobile, wider on desktop. */
export default function RegistersOverview() {
  const [rows, setRows] = useState<RegisterSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    registerService
      .getSummary()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const countFor = (key: string) => rows.find((row) => row.key === key)?.count ?? 0;

  const maxCount = Math.max(0, ...rows.map((r) => r.count ?? 0));

  return (
    <div className="space-y-4">
      <PageHeader title="Community Registers" description="Live views derived from family and member records" />

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {REGISTER_CONFIGS.map((config) => (
            <Link key={config.key} to={`/registers/${config.key}`} className="rounded-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28]">
              <StatCard
                variant="inline"
                title={config.title}
                value={countFor(config.key)}
                className="h-full"
                viz={maxCount > 0 ? { type: 'bullet', percent: Math.round((countFor(config.key) / maxCount) * 100), target: 100 } : undefined}
                summary={`${config.title}: ${countFor(config.key)} records, ${maxCount > 0 ? Math.round((countFor(config.key) / maxCount) * 100) : 0} percent of the largest register`}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
