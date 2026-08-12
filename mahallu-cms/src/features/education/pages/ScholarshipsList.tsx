import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Pagination from '@/components/ui/Pagination';
import {
  scholarshipService,
  Scholarship,
  SCHOLARSHIP_STATUS_OPTIONS,
  scholarshipStatusLabel,
} from '@/services/scholarshipService';

export default function ScholarshipsList() {
  const navigate = useNavigate();
  const [scholarships, setScholarships] = useState<Scholarship[]>([]);
  const [pagination, setPagination] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchScholarships = useCallback(async () => {
    setLoading(true);
    try {
      const { data, pagination } = await scholarshipService.getScholarships({
        page: currentPage,
        limit: 10,
        search: search || undefined,
        status: status || undefined,
      });
      setScholarships(data);
      setPagination(pagination);
    } catch (error) {
      console.error('Failed to fetch scholarships:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, search, status]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, status]);

  useEffect(() => {
    fetchScholarships();
  }, [fetchScholarships]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      await scholarshipService.deleteScholarship(id);
      await fetchScholarships();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Scholarships</h1>
        <Button onClick={() => navigate('/education/scholarships/create')}>
          New Scholarship
        </Button>
      </div>

      <Card>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
            >
              <option value="">All statuses</option>
              {SCHOLARSHIP_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <Button onClick={() => fetchScholarships()}>Refresh</Button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : scholarships.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No scholarships found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Name</th>
                      <th className="text-left py-2 hidden sm:table-cell">Year</th>
                      <th className="text-left py-2 hidden md:table-cell">Amount</th>
                      <th className="text-left py-2 hidden lg:table-cell">Criteria</th>
                      <th className="text-left py-2">Status</th>
                      <th className="text-left py-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scholarships.map((s) => (
                      <tr key={s._id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800">
                        <td className="py-2 font-medium">
                          <button
                            onClick={() => navigate(`/education/scholarships/${s._id}`)}
                            className="text-blue-600 hover:underline"
                          >
                            {s.name}
                          </button>
                        </td>
                        <td className="py-2 hidden sm:table-cell">{s.academicYear}</td>
                        <td className="py-2 hidden md:table-cell">₹{s.amount}</td>
                        <td className="py-2 hidden lg:table-cell text-xs">{s.criteria || '—'}</td>
                        <td className="py-2">
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 dark:bg-gray-800">
                            {scholarshipStatusLabel(s.status)}
                          </span>
                        </td>
                        <td className="py-2">
                          <div className="flex gap-2">
                            <button
                              onClick={() => navigate(`/education/scholarships/${s._id}`)}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View
                            </button>
                            <button
                              onClick={() => handleDelete(s._id)}
                              className="text-xs text-red-600 hover:underline"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {pagination && (
                <div className="mt-6">
                  <Pagination
                    currentPage={pagination.page}
                    totalPages={pagination.totalPages}
                    totalItems={pagination.total}
                    itemsPerPage={10}
                    onPageChange={setCurrentPage}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
