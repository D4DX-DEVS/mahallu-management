import { useState, useEffect } from 'react';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { Link, useNavigate } from 'react-router-dom';
import { FiLayers, FiCheckCircle, FiXCircle, FiRefreshCw, FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Dropdown from '@/components/ui/Dropdown';
import { useUndoableAction } from '@/hooks/useUndoableAction';
import { shareViz } from '@/utils/statSeries';

export default function ProgramsList() {
  const undo = useUndoableAction('program');
  const navigate = useNavigate();
  const filters = useUrlFilters({ audience: '', type: '' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const [programs, setPrograms] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const selectedAudience = filters.values.audience;
  const selectedProgramType = filters.values.type;
  const setSelectedAudience = (v: string) => filters.setFilter('audience', v);
  const setSelectedProgramType = (v: string) => filters.setFilter('type', v);


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
      setError(getFriendlyError(err, "Couldn't load programs. Refresh the page or try again."));
      console.error('Error fetching programs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      
      const params: any = { limit: 10000 };
      if (debouncedSearch) params.search = debouncedSearch;
      
      const result = await programService.getAll(params);
      const dataToExport = result.data;

      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export programs. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = (target: Institute) => {
    undo.run({
      id: target.id,
      label: `${target.name || 'Program'} deleted`,
      commit: () => programService.delete(target.id),
      onCommitted: fetchPrograms,
      errorMessage: "Couldn't delete the program. Try again in a moment.",
    });
  };

  const columns: TableColumn<Institute>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', sortable: true, render: (name) => <PersonCell name={name} /> },
    { key: 'place', label: 'Place' },
    {
      key: 'audience',
      label: 'Audience',
      render: (audience) => (
        audience ? <StatusBadge status={audience} tone="neutral" dot={false} /> : '—'
      ),
    },
    {
      key: 'programType',
      label: 'Type',
      render: (type) => (
        <span className="text-sm">{type ? type.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : '—'}</span>
      ),
    },
    {
      key: 'joinDate',
      label: 'Join Date',
      render: (date) => formatDate(date),
    },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <StatusBadge status={status || 'active'} />
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => navigate(ROUTES.PROGRAMS.DETAIL(row.id))}
          onEdit={() => navigate(`/programs/${row.id}/edit`)}
          onDelete={() => handleDelete(row)}
          deleteLabel="Delete"
          ariaLabels={{ view: 'View program', edit: 'Edit program', delete: 'Delete program' }}
        />
      ),
    },
  ];

  const view = useTableView('programs', columns);

  const stats = [
    { title: 'Total Programs', value: pagination?.total || programs.length, icon: <FiLayers className="h-[17px] w-[17px]" />,
      tone: 'green' as const },
    {
      title: 'Active',
      value: programs.filter((p) => p.status === 'active' || !p.status).length, viz: shareViz(programs.filter((p) => p.status === 'active' || !p.status).length, programs.length), summary: `Active: ${programs.filter((p) => p.status === 'active' || !p.status).length} of ${programs.length}`,
      icon: <FiCheckCircle className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
    },
    {
      title: 'Inactive',
      value: programs.filter((p) => p.status === 'inactive').length, viz: shareViz(programs.filter((p) => p.status === 'inactive').length, programs.length, '#E0B400'), summary: `Inactive: ${programs.filter((p) => p.status === 'inactive').length} of ${programs.length}`,
      icon: <FiXCircle className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Programs"
        description="Manage programs"
        actions={
          <Link to={ROUTES.PROGRAMS.CREATE}>
            <Button>+ New Program</Button>
          </Link>
        }
      />

<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {stats.map((stat, index) => (
            <StatCard key={index} variant="inline" {...stat} />
          ))}
        </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search programs' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchPrograms}>
                <FiRefreshCw className="h-3.5 w-3.5" />
              </Button>
              <TableColumnMenu {...view.menuProps} />
              <Dropdown
                trigger={
                  <Button variant="secondary" isLoading={isExporting}>
                    {!isExporting && <FiDownload className="h-3.5 w-3.5" />}
                    Export
                  </Button>
                }
                items={[
                  { label: 'Export CSV', icon: <FiFileText />, onClick: () => handleExport('csv'), disabled: isExporting },
                  { label: 'Export JSON', icon: <FiFile />, onClick: () => handleExport('json'), disabled: isExporting },
                  { label: 'Export PDF', icon: <FiDownload />, onClick: () => handleExport('pdf'), disabled: isExporting },
                ]}
              />
            </>
          }
        >
          <div className="flex w-full flex-wrap gap-1.5">
            {['all', 'men', 'women', 'youth', 'children', 'families'].map((audience) => (
              <button
                key={audience}
                type="button"
                aria-pressed={selectedAudience === audience}
                onClick={() => setSelectedAudience(selectedAudience === audience ? '' : audience)}
                className={`rounded-full px-3 py-1 max-sm:min-h-10 text-[12px] font-semibold transition-colors ${
                  selectedAudience === audience
                    ? 'bg-primary-700 text-white dark:bg-brand-lime dark:text-primary-950'
                    : 'bg-[#EEF3F0] text-[#5B6963] hover:bg-mint dark:bg-surface-raised dark:text-surface-muted dark:hover:bg-surface-hover'
                }`}
              >
                {audience.charAt(0).toUpperCase() + audience.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex w-full flex-wrap gap-1.5">
            {['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other'].map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={selectedProgramType === type}
                onClick={() => setSelectedProgramType(selectedProgramType === type ? '' : type)}
                className={`rounded-full px-3 py-1 max-sm:min-h-10 text-[12px] font-semibold transition-colors ${
                  selectedProgramType === type
                    ? 'bg-primary-700 text-white dark:bg-brand-lime dark:text-primary-950'
                    : 'bg-[#EEF3F0] text-[#5B6963] hover:bg-mint dark:bg-surface-raised dark:text-surface-muted dark:hover:bg-surface-hover'
                }`}
              >
                {type.replace(/_/g, ' ').split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
              </button>
            ))}
          </div>
          <SavedViews pageKey="programs" filters={filters} />
        </FilterBar>
        <AppliedFilters filters={filters} config={{audience: { label: 'Audience' }, type: { label: 'Type', format: (v) => v.replace(/_/g, ' ') }}} />

        <div className="p-3.5">

        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchPrograms} className="mt-4" variant="secondary">
              Retry
            </Button>
          </div>
        ) : (
          <Table
            columns={view.columns}
            density={view.density}
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            data={undo.filterHidden(programs, (p) => p.id)}
            emptyMessage="No programs found"
            showExport={false}
            onRowClick={(row) => navigate(`/programs/${row.id}`)}
          />
        )}

        {/* Pagination */}
        {pagination && (
          <div className="mt-3.5">
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
        </div>
      </Card>
    </div>
  );
}

