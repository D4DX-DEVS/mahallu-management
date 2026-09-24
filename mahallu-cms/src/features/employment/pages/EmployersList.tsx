import { useEffect, useState, useCallback } from 'react';
import { FiPlus } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import { employmentService, type Employer } from '@/services/employmentService';
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

  const { rows: sortedEmployers, sort, toggleSort } = useSortableRows(employers);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Employers"
        description="Local employers registered with the mahallu."
        breadcrumbs={[{ label: 'Employment' }]}
      />
      <div className="space-y-2">
        <div className="flex items-center gap-2">
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
        </div>
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

      {loading ? (
        <Card>
          <div className="py-8 text-center">Loading employers...</div>
        </Card>
      ) : employers.length === 0 ? (
        <Card>
          <div className="py-8 text-center text-gray-500">
            <p>No employers found</p>
          </div>
        </Card>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                    Name
                  </SortableTh>
                  <SortableTh
                    sortKey="contactPerson"
                    sort={sort}
                    onSort={toggleSort}
                    responsiveClassName="hidden sm:table-cell"
                  >
                    Contact
                  </SortableTh>
                  <SortableTh
                    sortKey="location"
                    sort={sort}
                    onSort={toggleSort}
                    responsiveClassName="hidden md:table-cell"
                  >
                    Location
                  </SortableTh>
                  <SortableTh sortKey="status" sort={sort} onSort={toggleSort}>
                    Status
                  </SortableTh>
                  <th className="px-4 py-3 text-right text-label font-semibold text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedEmployers.map((employer) => (
                  <tr key={employer.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">
                      <div className="font-medium text-gray-900">{toTitleCase(employer.name)}</div>
                      <div className="text-xs text-gray-500">{employer.businessType ? toTitleCase(employer.businessType) : '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm hidden sm:table-cell text-gray-700">
                      {employer.contactPerson ? toTitleCase(employer.contactPerson) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm hidden md:table-cell text-gray-700">
                      {employer.location ? toTitleCase(employer.location) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={employer.status} />
                    </td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => navigate(`/employment/employers/${employer.id}`)}
                        className="text-blue-600 hover:text-blue-900 px-2 py-1 text-xs hover:bg-blue-50 rounded"
                        title="Edit"
                        aria-label="Edit"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteClick(employer.id)}
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
            totalItems={employers.length * totalPages}
            itemsPerPage={itemsPerPage}
            onPageChange={setCurrentPage}
          />
        </>
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
