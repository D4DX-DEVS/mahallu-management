import { useEffect, useState, useCallback } from 'react';
import { FiEdit2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import ActionBar from '@/components/ui/ActionBar';
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

export default function VacanciesList() {
  const navigate = useNavigate();
  const [vacancies, setVacancies] = useState<JobVacancy[]>([]);
  const [summary, setSummary] = useState<EmploymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
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

  // Fetch vacancies
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
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
      } catch (error) {
        console.error("Couldn't load vacancies:", error);
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
      label: 'Job Title',
      render: (_v, vacancy) => (
        <div>
          <div className="font-medium text-foreground">{toTitleCase(vacancy.title)}</div>
          <div className="text-xs text-muted-foreground">
            {vacancy.location ? toTitleCase(vacancy.location) : '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'employer',
      label: 'Employer',
      priority: 'secondary',
      render: (_v, vacancy) => toTitleCase(employerName(vacancy)),
    },
    {
      key: 'status',
      label: 'Status',
      priority: 'secondary',
      sortable: true,
      render: (_v, vacancy) => <StatusBadge status={vacancy.status} />,
    },
    {
      key: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
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

  return (
    <div className="space-y-4">
      <PageHeader
        title="Vacancies"
        description="Open positions shared with job seekers."
        breadcrumbs={[{ label: 'Employment' }]}
      />
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Open Vacancies" value={summary.openVacancies} tone="info" />
          <StatCard title="Employers" value={summary.employersCount} tone="success" />
          <StatCard title="Trainings" value={summary.trainingsCount} tone="info" />
          <StatCard title="Job Seekers" value={summary.registeredJobSeekers} tone="warning" />
        </div>
      )}

      <div className="space-y-2">
        <ActionBar className="mb-0">
          <ExpandableSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            entity="vacancies"
            placeholder="Search by job title"
          />
          <Button onClick={() => navigate('/employment/vacancies/create')} icon={<FiPlus />} collapseLabel>
            New Vacancy
          </Button>
        </ActionBar>
        <div className="flex gap-2 flex-wrap">
          {['', 'open', 'filled', 'closed'].map((status) => (
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
              {status || 'All'} {status === 'open' && `(${summary?.openVacancies || 0})`}
            </button>
          ))}
        </div>
      </div>

      <Table
        columns={columns}
        data={vacancies}
        isLoading={loading}
        entity="job vacancies"
        rowKey={(vacancy) => vacancy.id}
      />

      {!loading && vacancies.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={vacancies.length * totalPages}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      )}

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
    </div>
  );
}
