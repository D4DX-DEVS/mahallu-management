import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiLayers, FiPlus, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import { toast } from '@/store/toastStore';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function ProgramsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [programs, setPrograms] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState<string>('');
  const [selectedProgramType, setSelectedProgramType] = useState<string>('');

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchPrograms();
  }, [debouncedSearch, currentPage, selectedAudience, selectedProgramType]);

  const fetchPrograms = async () => {
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
      if (selectedAudience) {
        params.audience = selectedAudience;
      }
      if (selectedProgramType) {
        params.programType = selectedProgramType;
      }
      const result = await programService.getAll(params);
      setPrograms(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'programs'));
      console.error('Error fetching programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params: any = {};
      if (debouncedSearch) params.search = debouncedSearch;
      if (selectedAudience) params.audience = selectedAudience;
      if (selectedProgramType) params.programType = selectedProgramType;

      const dataToExport = await fetchAllPages((pageParams) =>
        programService.getAll({ ...params, ...pageParams })
      );

      if (dataToExport.length === 0) {
        toast.info('No programs to export');
        return;
      }

      const filename = 'programs';
      const title = 'All Programs';

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
      toast.error(error?.message || "Couldn't export programs");
    } finally {
      setIsExporting(false);
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
    { key: 'place', label: 'Place', width: '6.5rem', render: (place) => toTitleCase(place) },
    {
      key: 'audience',
      label: 'Audience',
      width: '8rem',
      render: (audience) => (
        <span className="text-sm">
          {audience ? audience.charAt(0).toUpperCase() + audience.slice(1) : '—'}
        </span>
      ),
    },
    {
      key: 'programType',
      label: 'Type',
      width: '6.25rem',
      render: (type) => (
        <span className="text-sm">
          {type
            ? type
                .replace(/_/g, ' ')
                .split(' ')
                .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(' ')
            : '—'}
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
  ];

  const stats = [
    {
      title: 'Total Programs',
      value: pagination?.total || programs.length,
      icon: <FiLayers className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: programs.filter((p) => p.status === 'active' || !p.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive',
      value: programs.filter((p) => p.status === 'inactive').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Programs" description="Manage programs" />

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
          hasFilters={!!selectedAudience || !!selectedProgramType}
          onRefresh={fetchPrograms}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to={ROUTES.PROGRAMS.CREATE}>
              <Button size="md" icon={<FiPlus />} collapseLabel>New Program</Button>
            </Link>
          }
        />

        {isFilterVisible && (
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
            <div className="flex flex-wrap gap-2">
              {['all', 'men', 'women', 'youth', 'children', 'families'].map((audience) => (
                <button
                  key={audience}
                  onClick={() => {
                    setSelectedAudience(selectedAudience === audience ? '' : audience);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedAudience === audience
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {audience.charAt(0).toUpperCase() + audience.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other'].map((type) => (
                <button
                  key={type}
                  onClick={() => {
                    setSelectedProgramType(selectedProgramType === type ? '' : type);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedProgramType === type
                      ? 'bg-green-600 text-white dark:bg-green-500'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                  }`}
                >
                  {type
                    .replace(/_/g, ' ')
                    .split(' ')
                    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ')}
                </button>
              ))}
            </div>
          </div>
        )}

        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <div className="text-center py-10">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchPrograms} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            fixedLayout
            striped
            columns={columns}
            data={programs}
            emptyMessage="No programs found"
            showExport={false}
            onRowClick={(row) => navigate(`/programs/${row.id}`)}
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
    </div>
  );
}
