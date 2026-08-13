import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiX, FiHome, FiUsers, FiUser, FiUpload } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import BulkImportCsv, { ColumnSpec } from '@/components/BulkImportCsv';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Family } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

const FAMILY_COLUMNS: ColumnSpec[] = [
  { key: 'houseName', label: 'House Name', required: true },
  { key: 'houseNameMl', label: 'House Name (Malayalam)' },
  { key: 'familyHead', label: 'Family Head' },
  { key: 'familyHeadMl', label: 'Family Head (Malayalam)' },
  { key: 'contactNo', label: 'Contact Number' },
  { key: 'area', label: 'Area' },
  { key: 'areaMl', label: 'Area (Malayalam)' },
  { key: 'place', label: 'Place' },
  { key: 'placeMl', label: 'Place (Malayalam)' },
  { key: 'varisangyaGrade', label: 'Varisangya Grade' },
];

const FAMILY_TEMPLATE = 'houseName,houseNameMl,familyHead,familyHeadMl,contactNo,area,areaMl,place,placeMl,varisangyaGrade\nAl-Hamd House,അൽ-ഹാമ്ദ് വീട്,Ahmed Ali,അഹമ്മദ് അലി,9876543210,Area A,ഏരിയ എ,Calicut,കാലിക്കറ്റ്,Grade A\n';

export default function FamiliesList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [memberStats, setMemberStats] = useState({ totalMembers: 0, maleCount: 0, femaleCount: 0 });
  const [isImportOpen, setIsImportOpen] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchFamilies();
  }, [debouncedSearch, sortBy, currentPage]);

  useEffect(() => {
    familyService.getStats().then(setMemberStats).catch(console.error);
  }, []);

  const fetchFamilies = async () => {
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
      if (sortBy) {
        params.sortBy = sortBy === 'mahallId' ? 'mahallId' : 'date';
      }
      const result = await familyService.getAll(params);
      setFamilies(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch families');
      console.error('Error fetching families:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      if (sortBy) params.sortBy = sortBy === 'mahallId' ? 'mahallId' : 'date';
      const result = await familyService.getAll(params);
      const dataToExport = result.data;
      if (dataToExport.length === 0) {
        toast.info('No families to export');
        return;
      }
      const filename = 'families';
      const title = 'All Families';
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

  const handleBulkImport = async (rows: any[]) => {
    return familyService.bulkImportFamilies(rows);
  };

  const { totalMembers, maleCount, femaleCount } = memberStats;
  

  const columns: TableColumn<Family>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'mahallId', label: 'Family ID', render: (id) => id || '-' },
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
    { key: 'houseNo', label: 'House No.' },
    { key: 'area', label: 'Area' },
    { key: 'phone', label: 'Phone' },
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
        </div>
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Families',
      value: pagination?.total || families.length,
      icon: <FiHome className="h-5 w-5" />,
      onClick: () => {},
    },
    {
      title: 'Total Members',
      value: totalMembers,
      icon: <FiUsers className="h-5 w-5" />,
      onClick: () => {},
    },
    {
      title: 'Male - Female',
      value: `${maleCount} - ${femaleCount}`,
      icon: <FiUser className="h-5 w-5" />,
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              All Families
            </h1>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Manage families and their members
            </p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'All Families' }]} />
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      {/* Actions and Filters */}
      <Card>
        <div className="mb-4 flex flex-col gap-3">
          <TableToolbar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
            isFilterVisible={isFilterVisible}
            hasFilters={true}
            onRefresh={fetchFamilies}
            onExport={handleExport}
            isExporting={isExporting}
            actionButtons={
              <div className="flex gap-2">
                <Button
                  size="md"
                  variant="outline"
                  onClick={() => setIsImportOpen(true)}
                >
                  <FiUpload className="mr-2 h-4 w-4" />
                  Import CSV
                </Button>
                <Link to={ROUTES.FAMILIES.CREATE}>
                  <Button size="md">+ New Family</Button>
                </Link>
              </div>
            }
          />

          {isFilterVisible && (
            <div className="relative mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
              <button
                onClick={() => setIsFilterVisible(false)}
                className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <FiX className="h-4 w-4" />
              </button>
              <div className="w-40">
                <Select
                  options={[
                    { value: 'date', label: 'Date' },
                    { value: 'mahallId', label: 'Mahall ID' },
                  ]}
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                />
              </div>
            </div>
          )}

        </div>

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchFamilies} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            data={families}
            emptyMessage="No families found"
            exportFilename="families"
            exportTitle="All Families"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.FAMILIES.DETAIL(row.id))}
            onExportAll={async () => {
              const params: any = {
                limit: 10000,
              };
              if (debouncedSearch) {
                params.search = debouncedSearch;
              }
              if (sortBy) {
                params.sortBy = sortBy === 'mahallId' ? 'mahallId' : 'date';
              }
              const result = await familyService.getAll(params);
              return result.data;
            }}
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
      </Card>

      <BulkImportCsv
        title="Import Families from CSV"
        columnSpec={FAMILY_COLUMNS}
        templateCsv={FAMILY_TEMPLATE}
        onImport={handleBulkImport}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchFamilies}
      />
    </div>
  );
}

