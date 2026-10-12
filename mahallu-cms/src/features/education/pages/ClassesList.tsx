import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiUsers, FiCalendar } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import EmptyState from '@/components/ui/EmptyState';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import { FiBookOpen, FiCheckCircle, FiUserMinus } from 'react-icons/fi';
import { Pagination as PaginationType } from '@/types';
import { useDebounce } from '@/hooks/useDebounce';
import {
  madrasaService,
  MadrasaClass,
  MadrasaSummary,
  CLASS_TYPE_OPTIONS,
  classTypeLabel,
  teacherName,
} from '@/services/madrasaService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

const TYPE_FILTER = [{ value: '', label: 'All types' }, ...CLASS_TYPE_OPTIONS];
const STATUS_FILTER = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export default function ClassesList() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<MadrasaClass[]>([]);
  const [summary, setSummary] = useState<MadrasaSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchRows();
  }, [typeFilter, statusFilter, debouncedSearch, currentPage]);

  useEffect(() => {
    madrasaService
      .getSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  const fetchRows = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: Record<string, any> = { page: currentPage, limit: 12 };
      if (typeFilter) params.classType = typeFilter;
      if (statusFilter) params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await madrasaService.getClasses(params);
      setRows(result.data);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load classes. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Education"
        description="Madrasa classes and the students enrolled in them."
        actions={<Button onClick={() => navigate('/education/classes/create')}>+ New class</Button>}
      />

      {summary && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="inline" title="Classes" value={summary.totalClasses} icon={<FiBookOpen className="h-[17px] w-[17px]" />} tone="green" />
          <StatCard variant="inline" viz={summary.activeStudents + summary.completedStudents + summary.droppedStudents > 0 ? { type: 'segments', segments: [{ value: summary.activeStudents }, { value: summary.completedStudents, color: '#FDD817' }, { value: summary.droppedStudents, color: '#B3261E' }] } : undefined} summary={`${summary.activeStudents} active, ${summary.completedStudents} completed, ${summary.droppedStudents} dropped students`} title="Active students" value={summary.activeStudents} icon={<FiUsers className="h-[17px] w-[17px]" />} tone="lime" />
          <StatCard variant="inline" viz={summary.activeStudents + summary.completedStudents + summary.droppedStudents > 0 ? { type: 'ring', percent: pct(summary.completedStudents, summary.activeStudents + summary.completedStudents + summary.droppedStudents), color: '#8EC13E' } : undefined} summary={`${summary.completedStudents} students completed`} title="Completed" value={summary.completedStudents} icon={<FiCheckCircle className="h-[17px] w-[17px]" />} tone="neutral" />
          <StatCard variant="inline" viz={summary.activeStudents + summary.completedStudents + summary.droppedStudents > 0 ? { type: 'ring', percent: pct(summary.droppedStudents, summary.activeStudents + summary.completedStudents + summary.droppedStudents), color: '#B3261E' } : undefined} summary={`${summary.droppedStudents} students dropped`} title="Dropped" value={summary.droppedStudents} icon={<FiUserMinus className="h-[17px] w-[17px]" />} tone="red" />
        </div>
      )}

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{
            value: searchQuery,
            onChange: (value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            },
            placeholder: 'Search by class name',
          }}
        >
          <div className="w-44">
            <Select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={TYPE_FILTER}
            />
          </div>
          <div className="w-36">
            <Select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              options={STATUS_FILTER}
            />
          </div>
        </FilterBar>

        <div className="p-3.5">
          {error && (
            <Alert tone="danger" className="mb-3">
              {error}
            </Alert>
          )}

          {loading ? (
            <LoadingSpinner />
          ) : rows.length === 0 ? (
            <EmptyState
              title="No classes yet"
              description="Create a class to start enrolling students."
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((cls) => (
                <Card
                  key={cls.id}
                  hoverEffect
                  className="cursor-pointer"
                  onClick={() => navigate(`/education/classes/${cls.id}`)}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5"><Avatar name={cls.name} size={32} /><h3 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">{cls.name}</h3></div>
                    {cls.status === 'inactive' && <StatusBadge status="inactive" size="sm" />}
                  </div>

                  {cls.nameMl && (
                    <p className="mb-1 text-xs text-[#7B8983] dark:text-surface-muted">{cls.nameMl}</p>
                  )}

                  <p className="mb-2 text-xs text-[#7B8983] dark:text-surface-muted">
                    {classTypeLabel(cls.classType)}
                  </p>

                  <div className="space-y-1 text-xs text-[#5B6963] dark:text-surface-muted">
                    {teacherName(cls) === 'Not assigned' ? (
                      <p className="truncate">{teacherName(cls)}</p>
                    ) : (
                      <PersonCell name={teacherName(cls)} size={24} />
                    )}
                    <p className="flex items-center gap-1">
                      <FiCalendar className="h-3 w-3 shrink-0" />
                      {cls.academicYear}
                    </p>
                    <p className="flex items-center gap-1 font-semibold text-primary-700 dark:text-brand-lime">
                      <FiUsers className="h-3 w-3 shrink-0" />
                      {cls.studentCount ?? 0} student{(cls.studentCount ?? 0) === 1 ? '' : 's'}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-3.5">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                totalItems={pagination.total}
                itemsPerPage={pagination.limit}
                onPageChange={setCurrentPage}
              />
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
