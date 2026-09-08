import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import ExpandableSearch from '@/components/ui/ExpandableSearch';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import StatusBadge from '@/components/ui/StatusBadge';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

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

  /* Employer shows a resolved name, so the column sorts on that name. */
  const {
    rows: sortedVacancies,
    sort,
    toggleSort,
  } = useSortableRows(vacancies, null, {
    employer: (row) => employerName(row),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Vacancies" description="Open positions shared with job seekers." breadcrumbs={[{ label: 'Employment' }]} />
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.openVacancies}</div>
              <div className="text-xs sm:text-sm text-gray-600">Open Vacancies</div>
            </div>
          </Card>
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.employersCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Employers</div>
            </div>
          </Card>
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.trainingsCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Trainings</div>
            </div>
          </Card>
          <Card>
            <div className="py-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.registeredJobSeekers}</div>
              <div className="text-xs sm:text-sm text-gray-600">Job Seekers</div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <ExpandableSearch
            value={search}
            onChange={(value) => {
              setSearch(value);
              setCurrentPage(1);
            }}
            entity="vacancies"
            placeholder="Search by job title"
          />
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
        <Button onClick={() => navigate('/employment/vacancies/create')} className="w-full sm:w-auto">
          + New Vacancy
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="py-8 text-center">Loading vacancies...</div>
        </Card>
      ) : vacancies.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-gray-500">
            <p>No job vacancies found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <SortableTh sortKey="title" sort={sort} onSort={toggleSort}>
                    Job Title
                  </SortableTh>
                  <SortableTh
                    sortKey="employer"
                    sort={sort}
                    onSort={toggleSort}
                    responsiveClassName="hidden sm:table-cell"
                  >
                    Employer
                  </SortableTh>
                  <SortableTh
                    sortKey="status"
                    sort={sort}
                    onSort={toggleSort}
                    responsiveClassName="hidden md:table-cell"
                  >
                    Status
                  </SortableTh>
                  <th className="px-4 py-3 text-right text-label font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedVacancies.map((vacancy) => (
                  <tr key={vacancy.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{vacancy.title}</div>
                      <div className="text-xs text-gray-500 hidden sm:block">{vacancy.location || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell text-gray-700">
                      {employerName(vacancy)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <StatusBadge status={vacancy.status} />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/employment/vacancies/${vacancy.id}`)}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs hover:bg-blue-50 rounded"
                        title="View"
                        aria-label="View"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(vacancy.id)}
                        className="text-red-600 hover:text-red-900 px-2 py-1 text-xs hover:bg-red-50 rounded"
                        title="Delete"
                        aria-label="Delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={vacancies.length * totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
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
