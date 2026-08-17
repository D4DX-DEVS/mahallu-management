import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiCheck, FiX, FiHome, FiUsers } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Family } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

export default function UnapprovedFamiliesList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A new search invalidates the current page offset
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchFamilies();
  }, [debouncedSearch, currentPage, itemsPerPage]);

  const fetchFamilies = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { status: 'unapproved', page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) {
        params.search = debouncedSearch;
      }
      const result = await familyService.getAll(params);
      setFamilies(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch unapproved families');
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { status: 'unapproved', limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await familyService.getAll(params);
      const dataToExport = result.data || [];
      if (dataToExport.length === 0) {
        toast.info('No unapproved families to export');
        return;
      }
      const filename = 'unapproved-families';
      const title = 'Unapproved Families';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.response?.data?.message || 'Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await familyService.update(id, { status: 'approved' });
      await fetchFamilies();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to approve family');
    }
  };

  const columns: TableColumn<Family>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'mahallId', label: 'Mahall ID', render: (id) => id || '-' },
    { key: 'houseName', label: 'House Name', sortable: true },
    {
      key: 'familyHead',
      label: 'Family Head',
      render: (head) => head || '-',
    },
    {
      key: 'members',
      label: 'Members',
      render: (members) => members?.length || 0,
    },
    { key: 'area', label: 'Area' },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.FAMILIES.DETAIL(row.id));
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="View"
          >
            <FiEye className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              navigate(ROUTES.FAMILIES.EDIT(row.id));
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleApprove(row.id);
            }}
            className="p-1.5 rounded-md hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors"
            title="Approve"
          >
            <FiCheck className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  const stats = [
    // ponytail: total from server; the members stat still sums the current page
    { title: 'Unapproved Families', value: pagination?.total ?? families.length, icon: <FiHome className="h-5 w-5" /> },
    {
      title: 'Total Members',
      value: families.reduce((sum, f) => sum + (f.members?.length || 0), 0),
      icon: <FiUsers className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Unapproved Families</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Review and approve pending family registrations</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Unapproved Families' }]} />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={false}
          onRefresh={fetchFamilies}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFamilies} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table
              columns={columns}
              data={families}
              isLoading={loading}
              emptyMessage="No unapproved families found"
              showExport={false}
              onRowClick={(row) => navigate(ROUTES.FAMILIES.DETAIL(row.id))}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(items) => {
                    setItemsPerPage(items);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

