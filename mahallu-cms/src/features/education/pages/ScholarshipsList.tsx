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
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn } from '@/types';
import {
  scholarshipService,
  Scholarship,
  SCHOLARSHIP_STATUS_OPTIONS,
  scholarshipStatusLabel,
} from '@/services/scholarshipService';

export default function ScholarshipsList() {
  const navigate = useNavigate();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchScholarships = useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await scholarshipService.getScholarships({
        page: currentPage,
        limit: 10,
        search: search || undefined,
        status: status || undefined,
      });
      setScholarships(data);
      setPagination(pagination);
    } catch (error) {
      console.error('Failed to fetch scholarships:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  useEffect(() => {
    fetchScholarships();
  }, [fetchScholarships]);

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      await scholarshipService.deleteScholarship(deleteConfirm.id);
      setDeleteConfirm(null);
      toast.success(`"${deleteConfirm.name}" deleted`);
      await fetchScholarships();
    } catch (error: any) {
      toast.error(getFriendlyError(error, "Couldn't delete scholarship. Try again in a moment."));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Scholarship>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_, s) => (
        <button
          onClick={() => navigate(`/education/scholarships/${s.id}`)}
          className="text-left font-semibold text-primary-700 hover:underline dark:text-brand-lime"
        >
          <PersonCell name={s.name} />
        </button>
      ),
    },
    { key: 'academicYear', label: 'Year' },
    { key: 'amount', label: 'Amount', render: (v) => `₹${v}` },
    { key: 'criteria', label: 'Criteria', render: (v) => <span className="text-xs">{v || '—'}</span> },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} label={scholarshipStatusLabel(v)} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, s) => (
        <RowActions
          onView={() => navigate(`/education/scholarships/${s.id}`)}
          viewLabel="View"
          onDelete={() => setDeleteConfirm({ id: s.id, name: s.name })}
          deleteLabel="Delete"
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Scholarships"
        description="Scholarship schemes and their awards"
        actions={<Button onClick={() => navigate('/education/scholarships/create')}>+ New scholarship</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: search, onChange: setSearch, placeholder: 'Search scholarships' }}
          actions={
            <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={() => fetchScholarships()}>
              <FiRefreshCw className="h-3.5 w-3.5" />
            </Button>
          }
        >
          <div className="w-44">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              options={[{ value: '', label: 'All statuses' }, ...SCHOLARSHIP_STATUS_OPTIONS]}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : scholarships.length === 0 ? (
            <EmptyState
              title="No scholarships found"
              description={search || status ? "Try adjusting your search or filters" : "Create your first scholarship to get started"}
              action={!search && !status ? { label: 'New Scholarship', onClick: () => navigate('/education/scholarships/create') } : undefined}
            />
          ) : (
            <>
              <Table columns={columns} data={scholarships} showExport={false} />

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
        title="Delete scholarship?"
        message={deleteConfirm ? `Delete "${deleteConfirm.name}"?` : ''}
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
