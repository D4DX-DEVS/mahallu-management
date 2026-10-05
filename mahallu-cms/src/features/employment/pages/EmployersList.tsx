import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import ActionBar from '@/components/ui/ActionBar';
import Table from '@/components/ui/Table';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import { TableColumn } from '@/types';
import { toTitleCase } from '@/utils/format';

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
        console.error("Couldn't load employers:", error);
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
      toast.error("Couldn't delete employer. Please try again.");
      console.error("Couldn't delete employer:", error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const columns: TableColumn<Employer>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (_v, employer) => (
        <div>
          <div className="font-medium text-foreground">{toTitleCase(employer.name)}</div>
          <div className="text-xs text-muted-foreground">
            {employer.businessType ? toTitleCase(employer.businessType) : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'contactPerson',
      label: 'Contact',
      priority: 'secondary',
      render: (v) => (v ? toTitleCase(v) : '—'),
    },
    {
      key: 'location',
      label: 'Location',
      priority: 'secondary',
      render: (v) => (v ? toTitleCase(v) : '—'),
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (_v, employer) => <StatusBadge status={employer.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employers"
        description="Local employers registered with the mahallu."
        breadcrumbs={[{ label: 'Employment' }]}
      />
      <div className="space-y-2">
        <ActionBar className="mb-0">
          <ExpandableSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            entity="employers"
            placeholder="Search by employer name"
          />
          <Button onClick={() => navigate('/employment/employers/create')} icon={<FiPlus />} collapseLabel>
            New Employer
          </Button>
        </ActionBar>
        <div className="flex gap-2 flex-wrap">
          {['', 'active', 'inactive'].map((status) => (
            <button
              key={status}
              onClick={() => {
                setStatusFilter(status);
                setCurrentPage(1);
              }}
              className={`px-3 py-1 text-xs rounded-full ${
                statusFilter === status
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {status || 'All'}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={employers}
        isLoading={loading}
        entity="employers"
        rowKey={(employer) => employer.id}
      />

      {!loading && employers.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={employers.length * totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Employer"
        message="Are you sure you want to delete this employer?"
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
