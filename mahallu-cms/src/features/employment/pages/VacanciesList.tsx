import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { employmentService, type JobVacancy, type EmploymentSummary } from '@/services/employmentService';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';

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

  const handleDelete = useCallback(async (id: string) => {
    if (confirm('Delete this job vacancy?')) {
      try {
        await employmentService.deleteVacancy(id);
        setVacancies((prev) => prev.filter((v) => v._id !== id));
      } catch (error) {
        console.error('Failed to delete vacancy:', error);
      }
    }
  }, []);

  const employerName = (vacancy: JobVacancy): string => {
    if (vacancy.employerId && typeof vacancy.employerId === 'object') {
      return vacancy.employerId.name;
    }
    return vacancy.employerName || 'One-off post';
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-green-100 text-green-800';
      case 'filled':
        return 'bg-blue-100 text-blue-800';
      case 'closed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">{summary.openVacancies}</div>
              <div className="text-xs sm:text-sm text-gray-600">Open Vacancies</div>
            </div>
          </Card>
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600">{summary.employersCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Employers</div>
            </div>
          </Card>
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">{summary.trainingsCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Trainings</div>
            </div>
          </Card>
          <Card>
            <div className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600">{summary.registeredJobSeekers}</div>
              <div className="text-xs sm:text-sm text-gray-600">Job Seekers</div>
            </div>
          </Card>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex-1 space-y-2">
          <input
            type="text"
            placeholder="Search by job title..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full px-4 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        <Button
          onClick={() => navigate('/employment/vacancies/create')}
          className="w-full sm:w-auto"
        >
          + New Vacancy
        </Button>
      </div>

      {loading ? (
        <Card>
          <div className="p-8 text-center">Loading vacancies...</div>
        </Card>
      ) : vacancies.length === 0 ? (
        <Card>
          <div className="p-8 text-center text-gray-500">
            <p>No job vacancies found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Job Title</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 hidden sm:table-cell">
                    Employer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 hidden md:table-cell">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {vacancies.map((vacancy) => (
                  <tr key={vacancy._id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{vacancy.title}</div>
                      <div className="text-xs text-gray-500 hidden sm:block">{vacancy.location || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell text-gray-700">
                      {employerName(vacancy)}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${statusColor(vacancy.status)}`}>
                        {vacancy.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/employment/vacancies/${vacancy._id}`)}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs hover:bg-blue-50 rounded"
                        title="View"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(vacancy._id)}
                        className="text-red-600 hover:text-red-900 px-2 py-1 text-xs hover:bg-red-50 rounded"
                        title="Delete"
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
    </div>
  );
}
