import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { surveyService, SurveySnapshot } from '@/services/surveyService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';

const formatDate = (value?: string) => (value ? new Date(value).toLocaleDateString() : '—');

export default function SurveyList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<SurveySnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isGenerateOpen, setGenerateOpen] = useState(false);
  const [generateType, setGenerateType] = useState<'comprehensive' | 'annual'>('annual');
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ isOverdue: boolean } | null>(null);

  useEffect(() => {
    fetchRows();
  }, [currentPage]);

  useEffect(() => {
    surveyService.getStatus().then(setStatus).catch(() => setStatus(null));
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await surveyService.getAll({ page: currentPage, limit: 10 });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load surveys. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const snapshot = await surveyService.generate({ type: generateType });
      setGenerateOpen(false);
      toast.success('Survey generated');
      navigate(`/survey/${snapshot.id}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't generate survey. Try again in a moment."));
    } finally {
      setGenerating(false);
    }
  };

  const columns: TableColumn<SurveySnapshot>[] = [
    { key: 'surveyDate', label: 'Survey Date', render: (v) => formatDate(v) },
    { key: 'type', label: 'Type', render: (v) => <StatusBadge status={v} label={v === 'comprehensive' ? 'Comprehensive' : 'Annual'} tone={v === 'comprehensive' ? 'info' : 'neutral'} dot={false} /> },
    { key: 'stats', label: 'Households', render: (stats) => stats?.totalHouseholds ?? 0 },
    { key: 'population', label: 'Population', render: (_v, row) => row.stats?.totalPopulation ?? 0 },
    { key: 'nextReviewDate', label: 'Next Review', render: (v) => (v && new Date(v).getTime() < Date.now() ? <StatusBadge status="overdue" label={formatDate(v)} /> : formatDate(v)) },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_v, row) => (
        <RowActions
          onView={() => navigate(`/survey/${row.id}`)}
          ariaLabels={{ view: 'View survey' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Survey &amp; Demographics"
        description="Point-in-time snapshots of the Mahallu population"
        actions={<Button onClick={() => setGenerateOpen(true)}>+ Generate survey</Button>}
      />

      {status?.isOverdue && (
        <Alert tone="warning" title="Survey renewal overdue">
          The review date for the latest snapshot has passed. Generate a fresh survey to keep the data current.
        </Alert>
      )}

      <Card padding="none" className="overflow-visible">
        <div className="flex items-center gap-2.5 border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
          <p className="text-xs font-semibold text-[#7B8983] dark:text-surface-muted">
            {pagination?.total ?? 0} snapshot(s)
          </p>
        </div>

        <div className="p-3.5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="py-12 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            title="No survey snapshots yet"
            description="Generate a survey snapshot to capture the current state of the Mahallu population"
            action={{
              label: 'Generate First Survey',
              onClick: () => setGenerateOpen(true),
            }}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table
              columns={columns}
              data={rows}
              emptyMessage="No survey snapshots yet"
              showExport={false}
              onRowClick={(row) => navigate(`/survey/${row.id}`)}
            />
          </div>
        )}

        {pagination && (
          <div className="mt-3.5">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
        </div>
      </Card>

      <Modal isOpen={isGenerateOpen} onClose={() => setGenerateOpen(false)} title="Generate Survey Snapshot">
        <div className="space-y-3">
          <p className="text-sm text-[#5B6963] dark:text-surface-muted">
            This reads every current family and member record and stores the totals as a snapshot.
          </p>
          <Select
            label="Survey Type"
            value={generateType}
            onChange={(e) => setGenerateType(e.target.value as 'comprehensive' | 'annual')}
            options={[
              { value: 'annual', label: 'Annual update (next review in 1 year)' },
              { value: 'comprehensive', label: 'Comprehensive (next review in 4 years)' },
            ]}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={() => setGenerateOpen(false)} disabled={generating}>
              Cancel
            </Button>
            <Button onClick={handleGenerate} disabled={generating}>
              {generating ? 'Generating...' : 'Generate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
