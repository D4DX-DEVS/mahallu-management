import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiEdit2, FiEye, FiLayers, FiPlus, FiTrash2, FiXCircle } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import FilterPanel from '@/components/ui/FilterPanel';
import Select from '@/components/ui/Select';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
import { useServerCounts } from '@/hooks/useServerCounts';
import ActionsMenu from '@/components/ui/ActionsMenu';
import StatusBadge from '@/components/ui/StatusBadge';
import { logError } from '@/utils/safeLog';

export default function ProgramsList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [programs, setPrograms] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedProgram, setSelectedProgram] = useState<Institute | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState<string>('');
  const [selectedProgramType, setSelectedProgramType] = useState<string>('');

  const debouncedSearch = useDebounce(searchQuery, 500);

  useEffect(() => {
    fetchPrograms();
  }, [debouncedSearch, currentPage, itemsPerPage, selectedAudience, selectedProgramType]);

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
      logError('Error fetching programs', err);
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
          await exportToPDF(columns, dataToExport, filename, title);
          break;
      }
    } catch (error: any) {
      logError('Export error', error);
      toast.error(error?.message || "Couldn't export programs");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedProgram) return;
    try {
      setDeleting(true);
      await programService.delete(selectedProgram.id);
      toast.success('Program deleted');
      setShowDeleteModal(false);
      setSelectedProgram(null);
      await fetchPrograms();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete program' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Institute>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '16rem',
      sortable: true,
      render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span>,
    },
    { key: 'place', label: 'Place', width: '10rem', priority: 'secondary', render: (place) => (place ? toTitleCase(place) : '—') },
    {
      key: 'audience',
      label: 'Audience',
      width: '8rem',
      priority: 'secondary',
      render: (audience) => (
        <span className="text-sm">
          {audience ? audience.charAt(0).toUpperCase() + audience.slice(1) : '—'}
        </span>
      ),
    },
    {
      key: 'programType',
      label: 'Type',
      width: '9rem',
      priority: 'secondary',
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
      label: 'Join date',
      width: '8rem',
      priority: 'tertiary',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      width: '7rem',
      render: (status) => <StatusBadge status={status || 'active'} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.name)}`}
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                navigate(ROUTES.PROGRAMS.DETAIL(row.id));
              },
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => {
                navigate(`/programs/${row.id}/edit`);
              },
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedProgram(row);
                setShowDeleteModal(true);
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  // Whole-list counts from the server: these cards used to count only the rows on this page.
  const countBase: { search?: string; audience?: string; programType?: string } = {};
  if (debouncedSearch) countBase.search = debouncedSearch;
  if (selectedAudience) countBase.audience = selectedAudience;
  if (selectedProgramType) countBase.programType = selectedProgramType;
  const statusCounts = useServerCounts(
    {
      active: () => programService.getAll({ ...countBase, status: 'active', page: 1, limit: 1 }),
      inactive: () => programService.getAll({ ...countBase, status: 'inactive', page: 1, limit: 1 }),
    },
    [programs]
  );

  const stats = [
    {
      title: 'Total Programs',
      value: pagination?.total || programs.length,
      icon: <FiLayers className="h-5 w-5" />,
    },
    {
      title: 'Active',
      value: statusCounts.active ?? programs.filter((p) => p.status === 'active' || !p.status).length,
      icon: <FiCheckCircle className="h-5 w-5" />,
    },
    {
      title: 'Inactive',
      value: statusCounts.inactive ?? programs.filter((p) => p.status === 'inactive').length,
      icon: <FiXCircle className="h-5 w-5" />,
    },
  ];

  const activeFilterCount = (selectedAudience ? 1 : 0) + (selectedProgramType ? 1 : 0);
  const isFiltered = Boolean(debouncedSearch) || activeFilterCount > 0;
  const titleCase = (value: string) =>
    value
      .replace(/_/g, ' ')
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  const clearFilters = () => {
    setSelectedAudience('');
    setSelectedProgramType('');
    setCurrentPage(1);
  };

  return (
    <>
      <PageHeader
        title="Programs"
        description="Manage programs."
        actions={
          <Link to={ROUTES.PROGRAMS.CREATE}>
            <Button icon={<FiPlus />} collapseLabel>New program</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="programs"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchPrograms}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Audience"
                options={[
                  { value: '', label: 'All audiences' },
                  ...['all', 'men', 'women', 'youth', 'children', 'families'].map((audience) => ({
                    value: audience,
                    label: titleCase(audience),
                  })),
                ]}
                value={selectedAudience}
                onChange={(e) => {
                  setSelectedAudience(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="w-full sm:w-52">
              <Select
                label="Type"
                options={[
                  { value: '', label: 'All types' },
                  ...['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other'].map((type) => ({
                    value: type,
                    label: titleCase(type),
                  })),
                ]}
                value={selectedProgramType}
                onChange={(e) => {
                  setSelectedProgramType(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearFilters}>
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}

        {error ? (
          <EmptyState variant="error" entity="programs" description={error} action={{ label: 'Try again', onClick: fetchPrograms }} />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={programs}
              isLoading={loading}
              entity="programs"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); clearFilters(); } }
                  : { label: 'Add program', onClick: () => navigate(ROUTES.PROGRAMS.CREATE) }
              }
              onRowClick={(row) => navigate(`/programs/${row.id}`)}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="programs"
                  onPageChange={setCurrentPage}
                  onItemsPerPageChange={(size) => {
                    setItemsPerPage(size);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
          </>
        )}
      </TableCard>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete ${selectedProgram?.name ? toTitleCase(selectedProgram.name) : 'this program'}?`}
        message="This permanently removes the program and cannot be undone."
        confirmLabel="Delete program"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedProgram(null);
        }}
      />
    </>
  );
}
