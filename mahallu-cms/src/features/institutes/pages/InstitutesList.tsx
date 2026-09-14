import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiEye, FiInbox, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { instituteService } from '@/services/instituteService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function InstitutesList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search or type filter invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, typeFilter]);

  useEffect(() => {
    fetchInstitutes();
  }, [debouncedSearch, typeFilter, currentPage]);

  const fetchInstitutes = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      if (typeFilter !== 'all') {
        params.type = typeFilter;
      }
      const result = await instituteService.getAll(params);
      setInstitutes(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'institutes'));
      console.error('Error fetching institutes:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      // Gathered a page at a time — the API caps `limit` at 100
      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter && typeFilter !== 'all') params.type = typeFilter;
      const dataToExport = await instituteService.getAllForExport(params);
      if (dataToExport.length === 0) {
        toast.info('No institutes to export');
        return;
      }
      const filename = 'institutes';
      const title = 'All Institutes';
      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(errorMessage(error, { action: 'export the institutes' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedInstitute) return;
    try {
      setDeleting(true);
      await instituteService.delete(selectedInstitute.id);
      setShowDeleteModal(false);
      setSelectedInstitute(null);
      await fetchInstitutes();
    } catch (err: any) {
      // The list keeps its rows; the failure belongs on the dialog the user is in.
      toast.error(errorMessage(err, { action: 'delete this institute' }));
    } finally {
      // Left true on the happy path, the next delete opened onto a spinner that
      // never stopped and a Delete button that could not be pressed again.
      setDeleting(false);
    }
  };

  const columns: TableColumn<Institute>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '6.75rem',
      sortable: true,
      render: (v) => <span>{toTitleCase(v)}</span>,
    },
    { key: 'place', label: 'Place', width: '6.5rem', render: (v) => toTitleCase(v) },
    {
      key: 'type',
      label: 'Type',
      width: '6.25rem',
      render: (type) => (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 capitalize">
          {type}
        </span>
      ),
    },
    {
      key: 'joinDate',
      label: 'Join Date',
      width: '8.75rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7.25rem',
      render: (status) => (
        <span
          className={`px-2 py-1 text-xs font-medium rounded-full ${
            status === 'active'
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
          }`}
        >
          {status || 'active'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.INSTITUTES.DETAIL(row.id));
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(`/institutes/${row.id}/edit`);
              },
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedInstitute(row);
                setShowDeleteModal(true);
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Institutes',
      value: pagination?.total || institutes.length,
      icon: <FiInbox className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: institutes.filter((i) => i.status === 'active' || !i.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive',
      value: institutes.filter((i) => i.status === 'inactive').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Institutes" description="Manage institutes, madrasas, and other institutions" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={true}
          onRefresh={fetchInstitutes}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to={ROUTES.INSTITUTES.CREATE}>
              <Button size="md" icon={<FiPlus />} collapseLabel>New Institute</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-40">
              <Select
                options={[
                  { value: 'all', label: 'All Types' },
                  { value: 'institute', label: 'Institute' },
                  { value: 'madrasa', label: 'Madrasa' },
                  { value: 'orphanage', label: 'Orphanage' },
                  { value: 'hospital', label: 'Hospital' },
                  { value: 'other', label: 'Other' },
                ]}
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
              />
            </div>
          </FilterPanel>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchInstitutes} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={institutes}
            emptyMessage="No institutes found"
            onRowClick={(row) => navigate(ROUTES.INSTITUTES.DETAIL(row.id))}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-4">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              itemsPerPage={pagination.limit}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          </div>
        )}
      </TableCard>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedInstitute(null);
        }}
        title="Delete Institute"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedInstitute(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(selectedInstitute?.name)}</strong>? This action cannot be
          undone.
        </p>
      </Modal>
    </div>
  );
}
