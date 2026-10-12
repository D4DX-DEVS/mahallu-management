import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { surveyService, SurveySnapshot, SurveyStats } from '@/services/surveyService';
import { getFriendlyError } from '@/utils/apiMessages';

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
      .catch((err) => setError(getFriendlyError(err, "Couldn't load survey. Refresh the page or try again.")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !snapshot) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">{error || 'Survey not found'}</p>
        <Link to="/survey">
          <Button variant="secondary" className="mt-4">
            Back to surveys
          </Button>
        </Link>
      </Card>
    );
  }

  const isOverdue = new Date(snapshot.nextReviewDate).getTime() < Date.now();

  return (
    <div className="space-y-4">
      <PageHeader
        title={snapshot.type === 'comprehensive' ? 'Comprehensive Survey' : 'Annual Survey'}
        description={
          <>
            Taken {formatDate(snapshot.surveyDate)} &middot; next review {formatDate(snapshot.nextReviewDate)}
            {isOverdue ? ' (overdue)' : ''}
          </>
        }
        actions={
          <Link to="/survey">
            <Button variant="secondary">Back to surveys</Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {STAT_LABELS.map(({ key, label }) => {
          const value = snapshot.stats?.[key] ?? 0;
          const before = previous?.stats?.[key];
          const delta = typeof before === 'number' ? value - before : null;

          return (
            <StatCard
              key={key}
              title={label}
              value={value}
              viz={typeof before === 'number' && (before > 0 || value > 0) ? { type: 'pair', a: before, b: value } : undefined}
              summary={typeof before === 'number' ? `${label}: ${value}, previously ${before}` : undefined}
              pills={delta !== null && delta !== 0 ? [`${delta > 0 ? '+' : ''}${delta} vs previous`] : undefined}
            />
          );
        })}
      </div>

      {snapshot.notes && (
        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Notes</h2>
          <p className="mt-1 text-sm text-[#5B6963] dark:text-surface-muted">{snapshot.notes}</p>
        </Card>
      )}

      {previous && (
        <p className="text-xs text-[#7B8983] dark:text-surface-muted">
          Compared against the snapshot from {formatDate(previous.surveyDate)}.
        </p>
      )}
    </div>
  );
}
