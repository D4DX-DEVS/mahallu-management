import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { surveyService, SurveySnapshot } from '@/services/surveyService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
    surveyService
      .getStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await surveyService.getAll({ page: currentPage, limit: 10 });
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'surveys'));
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
      toast.error(errorMessage(err, { action: 'generate survey' }));
    } finally {
      setGenerating(false);
    }
  };

  const columns: TableColumn<SurveySnapshot>[] = [
    { key: 'surveyDate', label: 'Survey Date', width: '10rem', render: (v) => formatDate(v) },
    { key: 'type', label: 'Type', width: '6.25rem', render: (v) => (v === 'comprehensive' ? 'Comprehensive' : 'Annual') },
    { key: 'stats', label: 'Households', width: '9rem', align: 'center', render: (stats) => stats?.totalHouseholds ?? 0 },
    { key: 'population', label: 'Population', width: '8.75rem', align: 'center', render: (_v, row) => row.stats?.totalPopulation ?? 0 },
    { key: 'nextReviewDate', label: 'Next Review', width: '10rem', render: (v) => formatDate(v) },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Survey &amp; Demographics"
        description="Point-in-time snapshots of the Mahallu population"
      />

      {status?.isOverdue && (
        <Card className="border-l-4 border-amber-500 p-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Survey renewal overdue</p>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            The review date for the latest snapshot has passed. Generate a fresh survey to keep the data
            current.
          </p>
        </Card>
      )}

      <TableCard>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-gray-500 dark:text-gray-400">{pagination?.total ?? 0} snapshot(s)</p>
          <Button size="md" onClick={() => setGenerateOpen(true)}>
            + Generate Survey
          </Button>
        </div>

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchRows} className="mt-4" variant="outline">
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
          <Table
            fixedLayout
            striped
            columns={columns}
            data={rows}
            emptyMessage="No survey snapshots yet"
            showExport={false}
            onRowClick={(row) => navigate(`/survey/${row.id}`)}
          />
        )}

        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </TableCard>

      <Modal isOpen={isGenerateOpen} onClose={() => setGenerateOpen(false)} title="Generate Survey Snapshot">
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
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
            <Button variant="outline" onClick={() => setGenerateOpen(false)} disabled={generating}>
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
