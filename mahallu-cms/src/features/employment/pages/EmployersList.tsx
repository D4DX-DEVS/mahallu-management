import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import Table from '@/components/ui/Table';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

export default function EmployersList() {
  const navigate = useNavigate();
  const [employers, setEmployers] = useState<Employer[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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

  // Fetch employers
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const result = await employmentService.getEmployers({
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearch,
          status: statusFilter || undefined,
        });
        setEmployers(result.data);
        setTotalPages(result.pagination?.totalPages || 1);
      } catch (error) {
        console.error('Failed to fetch employers:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [currentPage, itemsPerPage, debouncedSearch, statusFilter]);

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
      toast.error(getFriendlyError(error, "Couldn't delete employer. Try again in a moment."));
      console.error('Failed to delete employer:', error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const columns: TableColumn<Employer>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_, employer) => (
        <PersonCell name={employer.name} subtitle={employer.businessType || '—'} />
      ),
    },
    { key: 'contactPerson', label: 'Contact', render: (v) => v || '—' },
    { key: 'location', label: 'Location', render: (v) => v || '—' },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, employer) => (
        <RowActions
          onEdit={() => navigate(`/employment/employers/${employer.id}`)}
          onDelete={() => handleDeleteClick(employer.id)}
          ariaLabels={{ edit: 'Edit employer', delete: 'Delete employer' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employers"
        description="Manage employers who post job vacancies"
        actions={<Button onClick={() => navigate('/employment/employers/create')}>+ New employer</Button>}
      />

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: search,
            onChange: (v) => {
              setSearch(v);
              setCurrentPage(1);
            },
            placeholder: 'Search by employer name',
          }}
        >
          <Segmented
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </FilterBar>

        <div className="p-3.5">
          <Table
            columns={columns}
            data={employers}
            isLoading={loading}
            emptyMessage="No employers found"
            showExport={false}
          />
          {!loading && employers.length > 0 && (
            <div className="mt-3.5">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={employers.length * totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete employer?"
        message="This employer will be deleted. This cannot be undone."
        consequence="The employer record and associated job vacancies will be removed."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteId(null);
        }}
      />
    </div>
  );
}
