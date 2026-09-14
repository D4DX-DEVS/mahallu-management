import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCalendar, FiPlus, FiUsers } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Select from '@/components/ui/Select';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
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
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
      setError(loadErrorMessage(err, 'classes'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        description="Madrasa classes and the students enrolled in them."
        title="Education"
        breadcrumbs={[{ label: 'Services' }]}
      />

      <div className="mb-4 flex items-center justify-between gap-3">
        <Button onClick={() => navigate('/education/classes/create')} icon={<FiPlus />} collapseLabel>New class</Button>
      </div>

      {summary && (
        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard title="Classes" value={summary.totalClasses} />
          <StatCard title="Active students" value={summary.activeStudents} />
          <StatCard title="Completed" value={summary.completedStudents} />
          <StatCard title="Dropped" value={summary.droppedStudents} />
        </div>
      )}

      <Card className="mb-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto_auto] sm:items-end">
          <ExpandableSearch
            value={searchQuery}
            onChange={(value) => {
              setSearchQuery(value);
              setCurrentPage(1);
            }}
            entity="classes"
            placeholder="Search by class name"
          />
          <Select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={TYPE_FILTER}
          />
          <Select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setCurrentPage(1);
            }}
            options={STATUS_FILTER}
          />
        </div>
      </Card>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <PageSkeleton variant="section" />
      ) : rows.length === 0 ? (
        <Card>
          <EmptyState title="No classes yet" description="Create a class to start enrolling students." />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((cls) => (
            <Card
              key={cls.id}
              className="cursor-pointer transition-shadow duration-200 hover:shadow-lg"
              onClick={() => navigate(`/education/classes/${cls.id}`)}
            >
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-semibold text-foreground">{toTitleCase(cls.name)}</h3>
                {cls.status === 'inactive' && (
                  <span className="whitespace-nowrap rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                    inactive
                  </span>
                )}
              </div>

              {cls.nameMl && <p className="mb-1 text-xs text-gray-500 dark:text-gray-400">{cls.nameMl}</p>}

              <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">{classTypeLabel(cls.classType)}</p>

              <div className="space-y-1 text-xs text-gray-600 dark:text-gray-300">
                <p className="truncate">{toTitleCase(teacherName(cls))}</p>
                <p className="flex items-center gap-1">
                  <FiCalendar className="h-3 w-3 shrink-0" />
                  {cls.academicYear}
                </p>
                <p className="flex items-center gap-1 font-medium text-gray-900 dark:text-gray-100">
                  <FiUsers className="h-3 w-3 shrink-0" />
                  {cls.studentCount ?? 0} student{(cls.studentCount ?? 0) === 1 ? '' : 's'}
                </p>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Card className="mt-4">
          <Pagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            itemsPerPage={pagination.limit}
            onPageChange={setCurrentPage}
          />
        </Card>
      )}
    </div>
  );
}
