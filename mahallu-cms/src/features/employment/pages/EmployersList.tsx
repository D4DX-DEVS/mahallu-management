import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { toTitleCase } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';

export default function EmployersList() {
  const navigate = useNavigate();
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await employmentService.getEmployers({
        page: currentPage,
        limit: itemsPerPage,
        search: debouncedSearch,
        status: statusFilter || undefined,
      });
      setEmployers(result.data);
      setTotalPages(result.pagination?.totalPages || 1);
      setTotalItems(result.pagination?.total ?? result.data.length);
    } catch (err) {
      setError(loadErrorMessage(err, 'employers'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDeleteClick = (id: string) => {
    setDeleteId(id);
    setShowDeleteConfirm(true);
  };

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      setDeleting(true);
      await employmentService.deleteEmployer(deleteId);
      setEmployers((prev) => prev.filter((e) => e.id !== deleteId));
      toast.success('Employer deleted');
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (error) {
      toast.error("Couldn't delete employer. Please try again.");
      console.error("Couldn't delete employer:", error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const columns: TableColumn<Employer>[] = [
    {
      key: 'name',
      label: 'Employer',
      sortable: true,
      width: '16rem',
      render: (_v, employer) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(employer.name)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {employer.businessType ? toTitleCase(employer.businessType) : '—'}
          </div>
        </div>
      ),
    },
    { key: 'contactPerson', label: 'Contact', sortable: true, priority: 'secondary', width: '12rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'location', label: 'Location', sortable: true, priority: 'secondary', width: '12rem', render: (v) => (v ? toTitleCase(v) : '—') },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (_v, employer) => <StatusBadge status={employer.status} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
      render: (_v, employer) => (
        <ActionsMenu
          label={'Actions for ' + employer.name}
          items={[
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => navigate(`/employment/employers/${employer.id}`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => handleDeleteClick(employer.id),
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  const isFiltered = Boolean(debouncedSearch || statusFilter);

  return (
    <>
      <PageHeader
        title="Employers"
        description="Local employers registered with the mahallu."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/employment/employers/create')}>
            New employer
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Employer status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ]}
            />
          }
          searchQuery={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchEntity="employers"
          onRefresh={fetchData}
        />

        {error ? (
          <EmptyState variant="error" entity="employers" description={error} action={{ label: 'Try again', onClick: fetchData }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={employers}
              isLoading={loading}
              entity="employers"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); setCurrentPage(1); } }
                  : { label: 'Add employer', onClick: () => navigate('/employment/employers/create') }
              }
              rowKey={(employer) => employer.id}
              onRowClick={(employer) => navigate(`/employment/employers/${employer.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="employers"
                onPageChange={setCurrentPage}
                onItemsPerPageChange={(size) => {
                  setItemsPerPage(size);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </TableCard>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete this employer?"
        message="This permanently removes the employer and cannot be undone."
        consequence="Its job vacancies will be removed too."
        confirmLabel="Delete employer"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteId(null);
        }}
      />
    </>
  );
}
