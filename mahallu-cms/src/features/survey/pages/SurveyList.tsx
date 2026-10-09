import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import TableToolbar from '@/components/ui/TableToolbar';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import { FiPlus } from 'react-icons/fi';
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
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isGenerateOpen, setGenerateOpen] = useState(false);
  const [generateType, setGenerateType] = useState<'comprehensive' | 'annual'>('annual');
  const [generating, setGenerating] = useState(false);
  const [status, setStatus] = useState<{ isOverdue: boolean } | null>(null);

  useEffect(() => {
    fetchRows();
  }, [currentPage, itemsPerPage]);

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
      const result = await surveyService.getAll({ page: currentPage, limit: itemsPerPage });
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
    { key: 'surveyDate', label: 'Survey date', sortable: true, width: '10rem', render: (v) => formatDate(v) },
    { key: 'type', label: 'Type', sortable: true, width: '9rem', render: (v) => (v === 'comprehensive' ? 'Comprehensive' : 'Annual') },
    { key: 'stats', label: 'Households', align: 'center', sortable: false, width: '8rem', render: (stats) => stats?.totalHouseholds ?? 0 },
    { key: 'population', label: 'Population', align: 'center', sortable: false, width: '8rem', render: (_v, row) => row.stats?.totalPopulation ?? 0 },
    { key: 'nextReviewDate', label: 'Next review', sortable: true, priority: 'secondary', width: '10rem', render: (v) => formatDate(v) },
  ];

  return (
    <>
      <PageHeader
        title="Survey & demographics"
        description="Point-in-time snapshots of the mahallu population."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => setGenerateOpen(true)}>
            Generate survey
          </Button>
        }
      />

      {status?.isOverdue && (
        <Card className="mb-4 border-l-4 border-amber-500 p-3">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">Survey renewal overdue</p>
          <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
            The review date for the latest snapshot has passed. Generate a fresh survey to keep the data
            current.
          </p>
        </Card>
      )}

      <TableCard>
        <TableToolbar onRefresh={fetchRows} />

        {error ? (
          <EmptyState variant="error" entity="survey snapshots" description={error} action={{ label: 'Try again', onClick: fetchRows }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={rows}
              isLoading={loading}
              entity="survey snapshots"
              emptyAction={{ label: 'Generate survey', onClick: () => setGenerateOpen(true) }}
              onRowClick={(row) => navigate(`/survey/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="snapshots"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
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
    </>
  );
}
