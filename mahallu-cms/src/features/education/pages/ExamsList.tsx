import { useState, useEffect, useCallback } from 'react';
import { FiArrowLeft, FiPlus } from 'react-icons/fi';
import { useParams, useNavigate } from 'react-router-dom';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import EmptyState from '@/components/ui/EmptyState';
import Select from '@/components/ui/Select';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { formatDate, toTitleCase } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';
import { examService, Exam, ExamStatus } from '@/services/attendanceService';
import { madrasaService } from '@/services/madrasaService';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

export default function ExamsList() {
  const { classId } = useParams<{ classId: string }>();
  const navigate = useNavigate();
  const [exams, setExams] = useState<Exam[]>([]);
  const [cls, setCls] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const fetchExams = useCallback(async () => {
    if (!classId) return;
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { classId, page: currentPage, limit: itemsPerPage };
      if (statusFilter) params.status = statusFilter;
      const result = await examService.listExams(params);
      setExams(result.data);
      setPagination(result.pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'exams'));
    } finally {
      setLoading(false);
    }
  }, [classId, currentPage, itemsPerPage, statusFilter]);

  useEffect(() => {
    if (!classId) return;
    madrasaService
      .getClass(classId)
      .then(setCls)
      .catch((err) => console.error("Couldn't load class", err));
  }, [classId]);

  useEffect(() => {
    fetchExams();
  }, [fetchExams]);

  const columns: TableColumn<Exam>[] = [
    {
      key: 'name',
      label: 'Exam',
      sortable: true,
      width: '16rem',
      render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span>,
    },
    { key: 'examDate', label: 'Date', sortable: true, width: '10rem', render: (v) => formatDate(v) },
    { key: 'maxMarks', label: 'Max marks', align: 'center', sortable: true, priority: 'secondary', width: '9rem', render: (v) => <span className="tabular-nums">{v}</span> },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (v: ExamStatus) => <StatusBadge status={v} /> },
  ];

  return (
    <>
      <PageHeader
        title="Exams"
        description={cls?.name ? toTitleCase(cls.name) : undefined}
        actions={
          <>
            <Button variant="outline" icon={<FiArrowLeft />} collapseLabel onClick={() => navigate(`/education/classes/${classId}`)}>
              Back to class
            </Button>
            <Button icon={<FiPlus />} collapseLabel onClick={() => navigate(`/education/exams/create?classId=${classId}`)}>
              New exam
            </Button>
          </>
        }
      />

      <TableCard>
        <TableToolbar
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={statusFilter ? 1 : 0}
          onRefresh={fetchExams}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                options={STATUS_OPTIONS}
              />
            </div>
            {statusFilter && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStatusFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="exams" description={error} action={{ label: 'Try again', onClick: fetchExams }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={exams}
              isLoading={loading}
              entity="exams"
              emptyVariant={statusFilter ? 'no-results' : 'empty'}
              emptyAction={
                statusFilter
                  ? { label: 'Clear filters', onClick: () => setStatusFilter('') }
                  : { label: 'Add exam', onClick: () => navigate(`/education/exams/create?classId=${classId}`) }
              }
              onRowClick={(row) => navigate(`/education/exams/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="exams"
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
    </>
  );
}
