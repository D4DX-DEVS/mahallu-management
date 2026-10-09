import { useState, useEffect, useCallback } from 'react';
import { FiPlus, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { getHealthResources, deleteHealthResource, IHealthResource } from '@/services/healthService';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import Button from '@/components/ui/Button';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

export default function DoctorsDirectory() {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState<IHealthResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleting, setDeleting] = useState<IHealthResource | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  const fetchDoctors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getHealthResources(currentPage, itemsPerPage, 'doctor', 'active', '', debouncedSearch);
      setDoctors(response.data);
      setTotalPages(response.pagination.totalPages);
      setTotalItems(response.pagination.total);
    } catch (err) {
      setError(loadErrorMessage(err, 'doctors'));
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch]);

  useEffect(() => {
    fetchDoctors();
  }, [fetchDoctors]);

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setIsDeleting(true);
      await deleteHealthResource(deleting.id);
      toast.success('Doctor deleted');
      setDeleting(null);
      fetchDoctors();
    } catch (err) {
      toast.error(errorMessage(err, { action: 'delete this doctor' }));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: TableColumn<IHealthResource>[] = [
    {
      key: 'name',
      label: 'Doctor',
      sortable: true,
      width: '16rem',
      render: (name, row) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(name)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.specialty ? toTitleCase(row.specialty) : 'No specialty added'}
          </div>
        </div>
      ),
    },
    { key: 'contactNo', label: 'Phone', width: '9rem', render: (v) => <span className="tabular-nums">{v || '—'}</span> },
    { key: 'availability', label: 'Availability', priority: 'secondary', width: '14rem', render: (v) => v || '—' },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_v, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => navigate(`/health/doctors/${row.id}/edit`) },
            { label: 'Delete', icon: <FiTrash2 className="h-4 w-4" />, variant: 'danger', onClick: () => setDeleting(row) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Doctors directory"
        description="Doctors the community can reach for advice and appointments."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/health/doctors/create')}>
            Add doctor
          </Button>
        }
      />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={(value) => {
            setSearchQuery(value);
            setCurrentPage(1);
          }}
          searchEntity="doctors"
          onRefresh={fetchDoctors}
        />

        {error ? (
          <EmptyState variant="error" entity="doctors" description={error} action={{ label: 'Try again', onClick: fetchDoctors }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={doctors}
              isLoading={loading}
              entity="doctors"
              emptyVariant={debouncedSearch ? 'no-results' : 'empty'}
              emptyAction={
                debouncedSearch
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add doctor', onClick: () => navigate('/health/doctors/create') }
              }
              onRowClick={(row) => navigate(`/health/doctors/${row.id}/edit`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="doctors"
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
        isOpen={Boolean(deleting)}
        title={`Delete ${deleting?.name ? toTitleCase(deleting.name) : 'this doctor'}?`}
        message="This permanently removes the doctor from the directory and cannot be undone."
        confirmLabel="Delete doctor"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
