import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { toast } from '@/store/toastStore';
import { surveyService, SurveySnapshot, SurveyStats } from '@/services/surveyService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
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
  const navigate = useNavigate();
  const [snapshot, setSnapshot] = useState<SurveySnapshot | null>(null);
  const [previous, setPrevious] = useState<SurveySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await surveyService.remove(id);
      toast.success('Survey deleted');
      navigate('/survey');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete survey' }));
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            title={snapshot.type === 'comprehensive' ? 'Comprehensive Survey' : 'Annual Survey'}
            description={`Taken ${formatDate(snapshot.surveyDate)} · next review ${formatDate(snapshot.nextReviewDate)}${isOverdue ? ' (overdue)' : ''}`}
            breadcrumbs={[{ label: 'Survey', path: '/survey' }]}
          />
          <div className="flex gap-2 items-center">
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>
              Delete
            </Button>
          </div>
        </div>
      </div>

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
              <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">{value}</p>
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
          <h2 className="text-sm font-semibold text-foreground">Notes</h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{snapshot.notes}</p>
        </Card>
      )}

      {previous && (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Compared against the snapshot from {formatDate(previous.surveyDate)}.
        </p>
      )}

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Survey"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this survey snapshot? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
