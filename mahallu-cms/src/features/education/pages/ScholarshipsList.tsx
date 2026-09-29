import { useState, useEffect, useCallback } from 'react';
import { FiEye, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import {
  scholarshipService,
  Scholarship,
  SCHOLARSHIP_STATUS_OPTIONS,
  scholarshipStatusLabel,
} from '@/services/scholarshipService';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { TableColumn } from '@/types';

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

  const columns: TableColumn<Scholarship>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_v, s) => (
        <button onClick={() => navigate(`/education/scholarships/${s.id}`)} className="text-primary hover:underline">
          {toTitleCase(s.name)}
        </button>
      ),
    },
    {
      key: 'academicYear',
      label: 'Year',
      priority: 'secondary',
    },
    {
      key: 'amount',
      label: 'Amount',
      priority: 'secondary',
      align: 'right',
      render: (_v, s) => '₹' + s.amount,
    },
    {
      key: 'criteria',
      label: 'Criteria',
      priority: 'tertiary',
      render: (v) => v || '—',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, s) => <span className="rounded bg-muted px-2 py-1 text-xs">{scholarshipStatusLabel(s.status)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      render: (_v, s) => (
        <ActionsMenu
          label={'Actions for ' + toTitleCase(s.name)}
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => navigate(`/education/scholarships/${s.id}`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => setDeleteConfirm({ id: s.id, name: s.name }),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

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
      console.error("Couldn't load scholarships:", error);
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
      toast.success(`"${toTitleCase(deleteConfirm.name)}" deleted`);
      await fetchScholarships();
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'delete scholarship' }));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader title="Scholarships" />
        <Button onClick={() => navigate('/education/scholarships/create')}>New Scholarship</Button>
      </div>

      <Card>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ExpandableSearch
              value={search}
              onChange={(value) => setSearch(value)}
              entity="scholarships"
            />
            <select
              aria-label="Filter"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">All statuses</option>
              {SCHOLARSHIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button onClick={() => fetchScholarships()}>Refresh</Button>
          </div>

          <Table
            columns={columns}
            data={scholarships}
            isLoading={loading}
            entity="scholarships"
            emptyVariant={search || status ? 'no-results' : 'empty'}
            emptyAction={
              !search && !status
                ? { label: 'New Scholarship', onClick: () => navigate('/education/scholarships/create') }
                : undefined
            }
            rowKey={(s) => s.id}
          />

          {!loading && pagination && scholarships.length > 0 && (
            <div className="mt-4">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={10}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title="Delete Scholarship"
        message={deleteConfirm ? `Are you sure you want to delete "${toTitleCase(deleteConfirm.name)}"?` : ''}
        consequence="This action cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  );
}
