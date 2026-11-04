import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import TableCard from '@/components/ui/TableCard';
import TableToolbar from '@/components/ui/TableToolbar';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import StatCard from '@/components/ui/StatCard';
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

export default function VacanciesList() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [summary, setSummary] = useState<EmploymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalItems, setTotalItems] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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
      const [vacRes, sumRes] = await Promise.all([
        employmentService.getVacancies({
          page: currentPage,
          limit: itemsPerPage,
          search: debouncedSearch,
          status: statusFilter || undefined,
        }),
        employmentService.getSummary(),
      ]);
      setVacancies(vacRes.data);
      setSummary(sumRes);
      setTotalPages(vacRes.pagination?.totalPages || 1);
      setTotalItems(vacRes.pagination?.total ?? vacRes.data.length);
    } catch (err) {
      setError(loadErrorMessage(err, 'vacancies'));
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
      await employmentService.deleteVacancy(deleteId);
      setVacancies((prev) => prev.filter((v) => v.id !== deleteId));
      toast.success('Vacancy deleted');
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (error) {
      toast.error("Couldn't delete job vacancy. Please try again.");
      console.error("Couldn't delete vacancy:", error);
    } finally {
      setDeleting(false);
    }
  }, [deleteId]);

  const employerName = (vacancy: JobVacancy): string => {
    if (vacancy.employerId && typeof vacancy.employerId === 'object') {
      return vacancy.employerId.name;
    }
    return vacancy.employerName || 'One-off post';
  };

  const columns: TableColumn<JobVacancy>[] = [
    {
      key: 'title',
      label: 'Job title',
      sortable: true,
      width: '16rem',
      render: (_v, vacancy) => (
        <div className="min-w-0">
          <div className="truncate font-medium text-foreground">{toTitleCase(vacancy.title)}</div>
          <div className="truncate text-xs text-muted-foreground">
            {vacancy.location ? toTitleCase(vacancy.location) : '—'}
          </div>
        </div>
      ),
    },
    { key: 'employer', label: 'Employer', sortable: false, priority: 'secondary', width: '14rem', render: (_v, vacancy) => toTitleCase(employerName(vacancy)) },
    { key: 'status', label: 'Status', sortable: true, width: '8rem', render: (_v, vacancy) => <StatusBadge status={vacancy.status} /> },
    {
      key: 'actions',
      label: '',
      align: 'right',
      sortable: false,
      width: '6.5rem',
      render: (_v, vacancy) => (
        <ActionsMenu
          label={'Actions for ' + vacancy.title}
          items={[
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => navigate(`/employment/vacancies/${vacancy.id}`),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => handleDeleteClick(vacancy.id),
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
        title="Vacancies"
        description="Open positions shared with job seekers."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate('/employment/vacancies/create')}>
            New vacancy
          </Button>
        }
      />

      {summary && (
        <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Open vacancies" value={summary.openVacancies} tone="info" />
          <StatCard title="Employers" value={summary.employersCount} tone="success" />
          <StatCard title="Trainings" value={summary.trainingsCount} tone="info" />
          <StatCard title="Job seekers" value={summary.registeredJobSeekers} tone="warning" />
        </div>
      )}

      <TableCard>
        <TableToolbar
          tabs={
            <Tabs
              variant="segmented"
              ariaLabel="Vacancy status"
              value={statusFilter}
              onChange={(value) => {
                setStatusFilter(value);
                setCurrentPage(1);
              }}
              items={[
                { value: '', label: 'All' },
                { value: 'open', label: 'Open', count: summary?.openVacancies },
                { value: 'filled', label: 'Filled' },
                { value: 'closed', label: 'Closed' },
              ]}
            />
          }
          searchQuery={search}
          onSearchChange={(value) => {
            setSearch(value);
            setCurrentPage(1);
          }}
          searchEntity="vacancies"
          onRefresh={fetchData}
        />

        {error ? (
          <EmptyState variant="error" entity="vacancies" description={error} action={{ label: 'Try again', onClick: fetchData }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={vacancies}
              isLoading={loading}
              entity="vacancies"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearch(''); setStatusFilter(''); setCurrentPage(1); } }
                  : { label: 'Add vacancy', onClick: () => navigate('/employment/vacancies/create') }
              }
              rowKey={(vacancy) => vacancy.id}
              onRowClick={(vacancy) => navigate(`/employment/vacancies/${vacancy.id}`)}
            />

            <div className="mt-4">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                itemsPerPage={itemsPerPage}
                entity="vacancies"
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
        title="Delete Job Vacancy"
        message="Are you sure you want to delete this job vacancy?"
        consequence="The vacancy posting will be permanently removed and no longer visible to job seekers."
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
    </>
  );
}
