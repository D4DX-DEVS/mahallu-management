import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Select from '@/components/ui/Select';
import StatusBadge from '@/components/ui/StatusBadge';
import Table from '@/components/ui/Table';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { FiRefreshCw } from 'react-icons/fi';
import { TableColumn } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import {
  scholarshipService,
  AcademicSupportCase,
  SUPPORT_CASE_TYPE_OPTIONS,
  SUPPORT_CASE_STATUS_OPTIONS,
  supportCaseTypeLabel,
  supportCaseStatusLabel,
  memberName,
} from '@/services/scholarshipService';

export default function AcademicSupportList() {
  const navigate = useNavigate();
  const [cases, setCases] = useState<AcademicSupportCase[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchCases = useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await scholarshipService.getSupportCases({
        page: currentPage,
        limit: 10,
        type: type || undefined,
        status: status || undefined,
        search: search || undefined,
      });
      setCases(data);
      setPagination(pagination);
    } catch (error) {
      console.error('Failed to fetch:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, type, status, search]);

  useEffect(() => {
    setCurrentPage(1);
  }, [type, status, search]);

  useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteSupportCase(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success('Support case deleted');
      await fetchCases();
    } catch (error: any) {
      toast.error(getFriendlyError(error, 'Failed to delete. Try again in a moment.'));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<AcademicSupportCase>[] = [
    { key: 'memberId', label: 'Student', render: (_, c) => <PersonCell name={memberName(c.memberId)} size={32} /> },
    { key: 'type', label: 'Type', render: (v) => <StatusBadge status={v} label={supportCaseTypeLabel(v)} tone="neutral" dot={false} /> },
    {
      key: 'description',
      label: 'Description',
      render: (_, c) => (
        <button
          onClick={() => navigate(`/education/support/${c.id}`)}
          className="max-w-[260px] truncate text-left text-xs font-semibold text-primary-700 hover:underline dark:text-brand-lime"
        >
          {c.description}
        </button>
      ),
    },
    { key: 'mentorName', label: 'Mentor', render: (v) => <span className="text-xs">{v || '—'}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} label={supportCaseStatusLabel(v)} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, c) => (
        <RowActions
          onView={() => navigate(`/education/support/${c.id}`)}
          viewLabel="View"
          onDelete={() => setDeleteConfirm({ id: c.id, name: memberName(c.memberId) })}
          deleteLabel="Delete"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Academic support cases"
        description="Mentoring and academic help for students"
        actions={<Button onClick={() => navigate('/education/support/create')}>+ New case</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: search, onChange: setSearch, placeholder: 'Search cases' }}
          actions={
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={() => fetchCases()}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <div className="w-44">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value)}
              options={[{ value: '', label: 'All types' }, ...SUPPORT_CASE_TYPE_OPTIONS]}
            />
          </div>
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[{ value: '', label: 'All statuses' }, ...SUPPORT_CASE_STATUS_OPTIONS]}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : cases.length === 0 ? (
            <EmptyState
              title="No support cases found"
              description={search || type || status ? "Try adjusting your search or filters" : "Create your first support case to get started"}
              action={!search && !type && !status ? { label: 'New Case', onClick: () => navigate('/education/support/create') } : undefined}
            />
          ) : (
            <>
              <Table columns={columns} data={cases} showExport={false} />

              {pagination && (
                <div className="mt-3.5">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsPerPage={10}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete support case?"
        message={deleteConfirm ? `Delete the support case for ${deleteConfirm.name}?` : ''}
        consequence="This cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
