import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy, type EmploymentSummary } from '@/services/employmentService';
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
import StatCard from '@/components/ui/StatCard';
import { FiBriefcase, FiHome, FiBookOpen, FiUsers } from 'react-icons/fi';
import { TableColumn } from '@/types';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
        console.error('Failed to fetch vacancies:', error);
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
      toast.success('Job vacancy deleted');
      setShowDeleteConfirm(false);
      setDeleteId(null);
    } catch (error) {
      toast.error(getFriendlyError(error, "Couldn't delete job vacancy. Try again in a moment."));
      console.error('Failed to delete vacancy:', error);
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
      render: (_, vacancy) => (
        <PersonCell name={vacancy.title} subtitle={vacancy.location || '—'} />
      ),
    },
    { key: 'employer', label: 'Employer', render: (_, vacancy) => { const n = employerName(vacancy); return n && n !== '-' ? <PersonCell name={n} size={24} /> : '-'; } },
    { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, vacancy) => (
        <RowActions
          onEdit={() => navigate(`/employment/vacancies/${vacancy.id}`)}
          onDelete={() => handleDeleteClick(vacancy.id)}
          ariaLabels={{ edit: 'Edit vacancy', delete: 'Delete vacancy' }}
        />
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Job vacancies"
        description="Post and manage job openings for the community"
        actions={<Button onClick={() => navigate('/employment/vacancies/create')}>+ New vacancy</Button>}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="inline" title="Open Vacancies" value={summary.openVacancies} icon={<FiBriefcase className="h-[17px] w-[17px]" />} tone="green" />
          <StatCard variant="inline" title="Employers" value={summary.employersCount} icon={<FiHome className="h-[17px] w-[17px]" />} tone="lime" />
          <StatCard variant="inline" title="Trainings" value={summary.trainingsCount} icon={<FiBookOpen className="h-[17px] w-[17px]" />} tone="neutral" />
          <StatCard variant="inline" title="Job Seekers" value={summary.registeredJobSeekers} icon={<FiUsers className="h-[17px] w-[17px]" />} tone="gold" />
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: search,
            onChange: (v) => {
              setSearch(v);
              setCurrentPage(1);
            },
            placeholder: 'Search by job title',
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
              { value: 'open', label: 'Open', count: summary?.openVacancies || 0 },
              { value: 'filled', label: 'Filled' },
              { value: 'closed', label: 'Closed' },
            ]}
          />
        </FilterBar>

        <div className="p-3.5">
          <Table
            columns={columns}
            data={vacancies}
            isLoading={loading}
            emptyMessage="No job vacancies found"
            showExport={false}
          />
          {!loading && vacancies.length > 0 && (
            <div className="mt-3.5">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={vacancies.length * totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>

      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete job vacancy?"
        message="This job vacancy will be deleted. This cannot be undone."
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
