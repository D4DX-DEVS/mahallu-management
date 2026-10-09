import { useState, useEffect, useCallback } from 'react';
import { FiEye, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { FiPlus } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import EmptyState from '@/components/ui/EmptyState';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import {
  scholarshipService,
  Scholarship,
  SCHOLARSHIP_STATUS_OPTIONS,
  scholarshipStatusLabel,
} from '@/services/scholarshipService';
import { useDebounce } from '@/hooks/useDebounce';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { TableColumn } from '@/types';

export default function ScholarshipsList() {
  const navigate = useNavigate();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const debouncedSearch = useDebounce(search, 500);
  const isFiltered = Boolean(debouncedSearch || status);

  const columns: TableColumn<Scholarship>[] = [
    {
      key: 'name',
      label: 'Scholarship',
      sortable: true,
      width: '16rem',
      render: (_v, s) => <span className="font-medium text-foreground">{toTitleCase(s.name)}</span>,
    },
    { key: 'academicYear', label: 'Year', sortable: true, priority: 'secondary', width: '8rem' },
    {
      key: 'amount',
      label: 'Amount',
      priority: 'secondary',
      align: 'right',
      sortable: true,
      width: '9rem',
      render: (_v, s) => <span className="tabular-nums">₹{Number(s.amount ?? 0).toLocaleString('en-IN')}</span>,
    },
    { key: 'criteria', label: 'Criteria', sortable: false, priority: 'tertiary', width: '16rem', render: (v) => v || '—' },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (_v, s) => <StatusBadge status={s.status} label={scholarshipStatusLabel(s.status)} />,
    },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
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
    setError(null);
    try {
      const { data, pagination } = await scholarshipService.getScholarships({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch || undefined,
        status: status || undefined,
      });
      setScholarships(data);
      setPagination(pagination);
    } catch (err) {
      setError(loadErrorMessage(err, 'scholarships'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, status]);

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
    <>
      <PageHeader
        title="Scholarships"
        description="Scholarship schemes offered to students."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/education/scholarships/create')}>
            New scholarship
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={search}
          onSearchChange={setSearch}
          searchEntity="scholarships"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={status ? 1 : 0}
          onRefresh={fetchScholarships}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Status"
                options={[{ value: '', label: 'All statuses' }, ...SCHOLARSHIP_STATUS_OPTIONS]}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              />
            </div>
            {status && (
              <Button variant="ghost" onClick={() => setStatus('')}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="scholarships" description={error} action={{ label: 'Try again', onClick: fetchScholarships }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={scholarships}
              isLoading={loading}
              entity="scholarships"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatus(''); } }
                  : { label: 'Add scholarship', onClick: () => navigate('/education/scholarships/create') }
              }
              onRowClick={(s) => navigate(`/education/scholarships/${s.id}`)}
              rowKey={(s) => s.id}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="scholarships"
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

      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={deleteConfirm ? `Delete ${toTitleCase(deleteConfirm.name)}?` : 'Delete this scholarship?'}
        message="This permanently removes the scholarship and cannot be undone."
        isLoading={deleting}
        variant="danger"
        confirmLabel="Delete scholarship"
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm(null)}
      />
    </>
  );
}
