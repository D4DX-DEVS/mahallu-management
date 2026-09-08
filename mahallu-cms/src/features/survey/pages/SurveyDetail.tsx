import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { surveyService, SurveySnapshot, SurveyStats } from '@/services/surveyService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const STAT_LABELS: Array<{ key: keyof SurveyStats; label: string }> = [
  { key: 'totalHouseholds', label: 'Households' },
  { key: 'totalPopulation', label: 'Population' },
  { key: 'men', label: 'Men' },
  { key: 'women', label: 'Women' },
  { key: 'children', label: 'Children' },
  { key: 'youth', label: 'Youth' },
  { key: 'seniorCitizens', label: 'Senior Citizens' },
  { key: 'students', label: 'Students' },
  { key: 'married', label: 'Married' },
  { key: 'unmarried', label: 'Unmarried' },
  { key: 'employed', label: 'Employed' },
  { key: 'unemployed', label: 'Unemployed' },
  { key: 'widows', label: 'Widows' },
  { key: 'orphans', label: 'Orphans' },
  { key: 'disabled', label: 'With Disability' },
  { key: 'familiesNeedingAssistance', label: 'Need Assistance' },
];

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '-');

export default function SurveyDetail() {
  const { id } = useParams<{ id: string }>();
  const [snapshot, setSnapshot] = useState<SurveySnapshot | null>(null);
  const [previous, setPrevious] = useState<SurveySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    surveyService
      .getById(id)
      .then((data) => {
        setSnapshot(data.snapshot);
        setPrevious(data.previous);
      })
      .catch((err) => setError(loadErrorMessage(err, 'survey')))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (error || !snapshot) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">{error || 'Survey not found'}</p>
        <Link to="/survey">
          <Button variant="outline" className="mt-4">
            Back to surveys
          </Button>
        </Link>
      </Card>
    );
  }

  const isOverdue = new Date(snapshot.nextReviewDate).getTime() < Date.now();

  return (
    <div className="space-y-3">
      <PageHeader
        title={snapshot.type === 'comprehensive' ? 'Comprehensive Survey' : 'Annual Survey'}
        description={`Taken ${formatDate(snapshot.surveyDate)} · next review ${formatDate(snapshot.nextReviewDate)}${isOverdue ? ' (overdue)' : ''}`}
        breadcrumbs={[{ label: 'Survey', path: '/survey' }]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {STAT_LABELS.map(({ key, label }) => {
          const value = snapshot.stats?.[key] ?? 0;
          const before = previous?.stats?.[key];
          const delta = typeof before === 'number' ? value - before : null;

          return (
            <Card key={key}>
              <p className="text-xs font-medium leading-tight text-gray-500 dark:text-gray-400 sm:text-sm">
                {label}
              </p>
              <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">{value}</p>
              {delta !== null && delta !== 0 && (
                <p
                  className={[
                    'mt-0.5 text-xs sm:text-xs',
                    delta > 0 ? 'text-emerald-600' : 'text-red-600',
                  ].join(' ')}
                >
                  {delta > 0 ? '+' : ''}
                  {delta} vs previous
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {snapshot.notes && (
        <Card>
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notes</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{snapshot.notes}</p>
        </Card>
      )}

      {previous && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Compared against the snapshot from {formatDate(previous.surveyDate)}.
        </p>
      )}
    </div>
  );
}
