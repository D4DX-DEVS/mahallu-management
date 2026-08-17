import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { REGISTER_CONFIGS } from '../registerConfigs';

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

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Community Registers</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Live views derived from family and member records
          </p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Registers' }]} />
      </div>

      {loading ? (
        <PageSkeleton variant="section" />
      ) : (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4 xl:grid-cols-6">
          {REGISTER_CONFIGS.map((config) => (
            <Link key={config.key} to={`/registers/${config.key}`}>
              <Card className="h-full p-3 transition-shadow hover:shadow-md sm:p-4">
                <p className="text-xs font-medium leading-tight text-gray-500 dark:text-gray-400 sm:text-sm">
                  {config.title}
                </p>
                <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
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
