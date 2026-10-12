import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import { registerService, RegisterSummaryRow } from '@/services/registerService';

/** Community registers snapshot. Survey / committee warnings live in the Needs attention card. */
export default function PhaseAInsights() {
  const [registers, setRegisters] = useState<RegisterSummaryRow[]>([]);

  useEffect(() => {
    registerService.getSummary().then(setRegisters).catch(() => setRegisters([]));
  }, []);

  const topRegisters = registers.filter((row) => row.count > 0).slice(0, 8);

  return (
    <div className="space-y-3">
      {topRegisters.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-primary-700 dark:text-surface-text">Community Registers</h2>
            <Link to="/registers" className="inline-flex items-center max-sm:min-h-10 max-sm:px-1 text-xs font-bold text-primary-600 hover:underline dark:text-brand-lime">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {topRegisters.map((row) => (
              <Link key={row.key} to={`/registers/${row.key}`}>
                <Card hoverEffect padding="none" className="h-full px-3.5 py-3">
                  <p className="text-[12px] font-semibold leading-tight text-[#6A7771] dark:text-surface-muted">
                    {row.label}
                  </p>
                  <p className="mt-1 text-xl font-extrabold leading-tight text-primary-700 dark:text-surface-text">
                    {row.count}
                  </p>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
