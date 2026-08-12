import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import { registerService, RegisterSummaryRow } from '@/services/registerService';
import { surveyService } from '@/services/surveyService';
import { committeeService } from '@/services/committeeService';

/** Registers snapshot plus the survey / committee-term warnings (spec 5.3, 29). */
export default function PhaseAInsights() {
  const [registers, setRegisters] = useState<RegisterSummaryRow[]>([]);
  const [surveyOverdue, setSurveyOverdue] = useState(false);
  const [expiringCommittees, setExpiringCommittees] = useState(0);

  useEffect(() => {
    registerService.getSummary().then(setRegisters).catch(() => setRegisters([]));
    surveyService
      .getStatus()
      .then((status) => setSurveyOverdue(status.isOverdue))
      .catch(() => setSurveyOverdue(false));
    committeeService
      .getAll({ expiring: 'true', limit: 1 })
      .then((result) => setExpiringCommittees(result?.pagination?.total ?? 0))
      .catch(() => setExpiringCommittees(0));
  }, []);

  const topRegisters = registers.filter((row) => row.count > 0).slice(0, 8);

  return (
    <div className="space-y-3">
      {(surveyOverdue || expiringCommittees > 0) && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {surveyOverdue && (
            <Link to="/survey">
              <Card className="border-l-4 border-amber-500 p-3">
                <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                  Survey renewal overdue
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                  Generate a fresh demographic snapshot
                </p>
              </Card>
            </Link>
          )}
          {expiringCommittees > 0 && (
            <Link to="/committees">
              <Card className="border-l-4 border-red-500 p-3">
                <p className="text-sm font-semibold text-red-700 dark:text-red-400">
                  {expiringCommittees} committee term(s) ending soon
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                  Schedule re-election within the next 60 days
                </p>
              </Card>
            </Link>
          )}
        </div>
      )}

      {topRegisters.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Community Registers</h2>
            <Link to="/registers" className="text-xs text-primary-600 hover:underline">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {topRegisters.map((row) => (
              <Link key={row.key} to={`/registers/${row.key}`}>
                <Card className="h-full p-3 transition-shadow hover:shadow-md sm:p-4">
                  <p className="text-xs font-medium leading-tight text-gray-500 dark:text-gray-400 sm:text-sm">
                    {row.label}
                  </p>
                  <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
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
