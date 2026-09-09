import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiCheck, FiHome, FiUsers } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
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
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

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
      setError(loadErrorMessage(err, 'unapproved families'));
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
      toast.error(errorMessage(error, { action: 'export data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await familyService.update(id, { status: 'approved' });
      await fetchFamilies();
    } catch (err: any) {
      setError(errorMessage(err, { action: 'approve family' }));
    }
  };

  const columns: TableColumn<Family>[] = [
    { key: 'mahallId', label: 'Mahall ID', width: '8.75rem', render: (id) => id || '-' },
    { key: 'houseName', label: 'House Name', width: '9.75rem', sortable: true },
    {
      key: 'familyHead',
      label: 'Family Head',
      width: '9.75rem',
      render: (head) => head || '-',
    },
    {
      key: 'members',
      label: 'Members',
      width: '10rem',
      align: 'center',
      render: (members) => members?.length || 0,
    },
    { key: 'area', label: 'Area', width: '6.25rem' },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
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
                navigate(ROUTES.FAMILIES.DETAIL(row.id));
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.FAMILIES.EDIT(row.id));
              },
            },
            {
              label: 'Approve',
              icon: <FiCheck className="h-4 w-4" />,
              onClick: () => {
                handleApprove(row.id);
              },
            },
          ]}
        />
      ),
    },
  ];

  const stats = [
    // ponytail: total from server; the members stat still sums the current page
    {
      title: 'Unapproved Families',
      value: pagination?.total ?? families.length,
      icon: <FiHome className="h-5 w-5" />,
    },
    {
      title: 'Total Members',
      value: families.reduce((sum, f) => sum + (f.members?.length || 0), 0),
      icon: <FiUsers className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader
          title="Unapproved Families"
          description="Review and approve pending family registrations"
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          hasFilters={false}
          onRefresh={fetchFamilies}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFamilies} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table
              fixedLayout
              striped
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
      </TableCard>
    </div>
  );
}
