import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiHome, FiUsers, FiUser, FiUpload, FiRefreshCw, FiDownload, FiFileText, FiFile, FiCheck, FiArchive, FiRotateCcw, FiCopy } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import PageHeader from '@/components/ui/PageHeader';
import FilterBar from '@/components/ui/FilterBar';
import Segmented from '@/components/ui/Segmented';
import StatusBadge from '@/components/ui/StatusBadge';
import Dropdown from '@/components/ui/Dropdown';
import SavedViews from '@/components/ui/SavedViews';
import AppliedFilters from '@/components/ui/AppliedFilters';
import TableColumnMenu from '@/components/ui/TableColumnMenu';
import BulkBarButton from '@/components/ui/BulkBarButton';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import { ArchiveFamilyDialog } from '../components/FamilyLifecycleDialogs';
import { useUrlFilters } from '@/hooks/useUrlFilters';
import { useTableView } from '@/hooks/useTableView';
import { useDetailModal } from '@/hooks/useDetailModal';
import FamilyQuickView from '../components/FamilyQuickView';
import BulkImportCsv, { ColumnSpec } from '@/components/BulkImportCsv';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { Family } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

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
  const filters = useUrlFilters({ status: '', sort: 'date', archived: '', needsHead: '' });
  const { search: searchQuery, setSearch: setSearchQuery, debouncedSearch, page: currentPage, setPage: setCurrentPage, pageSize: itemsPerPage } = filters;
  const sortBy = filters.values.sort;
  const statusFilter = filters.values.status;
  const archivedView = filters.values.archived === 'true';
  const needsHeadView = filters.values.needsHead === 'true';
  const [archiveTarget, setArchiveTarget] = useState<Family | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<Family | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [families, setFamilies] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [memberStats, setMemberStats] = useState({ totalMembers: 0, maleCount: 0, femaleCount: 0 });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const detail = useDetailModal(families.map((f) => String(f.id)));

  const [bulkApprove, setBulkApprove] = useState<Family[] | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    fetchFamilies();
  }, [debouncedSearch, sortBy, statusFilter, archivedView, needsHeadView, currentPage, itemsPerPage]);

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
      if (statusFilter) params.status = statusFilter;
      if (archivedView) params.archived = true;
      if (needsHeadView) params.needsHead = true;
      const result = await familyService.getAll(params);
      setFamilies(result.data);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load families. Refresh the page or try again."));
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
      if (statusFilter) params.status = statusFilter;
      if (archivedView) params.archived = true;
      if (needsHeadView) params.needsHead = true;
      const result = await familyService.getAll(params);
      const dataToExport = result.data;
      if (dataToExport.length === 0) {
        toast.info('Nothing to export. Change your filters and try again.');
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
      toast.error(getFriendlyError(error, "Couldn't export data. Check your connection and try again."));
    } finally {
      setIsExporting(false);
    }
  };

  const handleBulkImport = async (rows: any[], opts?: { confirmDuplicate?: boolean }) => {
    return familyService.bulkImportFamilies(rows, opts);
  };

  const { totalMembers, maleCount, femaleCount } = memberStats;
  

  const columns: TableColumn<Family>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => (currentPage - 1) * itemsPerPage + index + 1 },
    { key: 'mahallId', label: 'Family ID', render: (id) => id || '-' },
    {
      key: 'houseName',
      label: 'House Name',
      sortable: true,
      render: (name) => <PersonCell name={name} size={32} />,
    },
    {
      key: 'familyHead',
      label: 'Family Head',
      render: (head) => (head ? <PersonCell name={head} size={24} /> : '-'),
    },
    {
      key: 'members',
      label: 'Members',
      align: 'right',
      render: (members, row) => row.memberCount ?? members?.length ?? 0,
    },
    { key: 'houseNo', label: 'House No.', defaultHidden: true },
    { key: 'area', label: 'Area' },
    { key: 'phone', label: 'Phone', defaultHidden: true },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (status ? <StatusBadge status={status} /> : '-'),
    },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_, row) => (
        <RowActions
          onView={() => detail.open(String(row.id))}
          onEdit={() => navigate(ROUTES.FAMILIES.EDIT(row.id))}
          ariaLabels={{ edit: 'Edit family' }}
          onDelete={row.isArchived ? undefined : () => setArchiveTarget(row)}
          deleteLabel="Archive family"
          extra={[{ label: 'Restore family', icon: <FiRotateCcw />, onClick: () => setRestoreTarget(row), show: !!row.isArchived }]}
        />
      ),
    },
  ];

  const view = useTableView('families', columns);

  const selectedFamilies = (ids: string[]) => families.filter((f) => ids.includes(String(f.id)));
  const exportSelected = (ids: string[]) => {
    const rows = selectedFamilies(ids);
    exportToCSV(columns.filter((c) => c.key !== 'actions'), rows, 'families-selected');
    toast.success(`Exported ${rows.length} ${rows.length === 1 ? 'family' : 'families'}`);
  };
  const runBulkApprove = async () => {
    if (!bulkApprove) return;
    setBulkBusy(true);
    const results = await Promise.allSettled(bulkApprove.map((f) => familyService.update(f.id, { status: 'approved' })));
    const ok = results.filter((x) => x.status === 'fulfilled').length;
    const failed = results.length - ok;
    if (ok) toast.success(`Approved ${ok} ${ok === 1 ? 'family' : 'families'}`);
    if (failed) toast.error(`${failed} could not be approved`);
    setBulkBusy(false);
    setBulkApprove(null);
    setSelectionKey((k) => k + 1);
    fetchFamilies();
  };
  const [selectionKey, setSelectionKey] = useState(0);

  const runRestore = async () => {
    if (!restoreTarget) return;
    try {
      setRestoring(true);
      await familyService.restore(restoreTarget.id);
      toast.success(`${restoreTarget.houseName} restored. It now appears in the family list again.`);
      setRestoreTarget(null);
      fetchFamilies();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "We couldn't restore this family. Please try again."));
    } finally {
      setRestoring(false);
    }
  };

  const stats = [
    {
      title: 'Total Families',
      value: pagination?.total || families.length,
      icon: <FiHome className="h-[17px] w-[17px]" />,
      tone: 'green' as const,
      onClick: () => {},
    },
    {
      title: 'Total Members',
      value: totalMembers,
      icon: <FiUsers className="h-[17px] w-[17px]" />,
      tone: 'lime' as const,
      viz: maleCount + femaleCount > 0 ? { type: 'segments' as const, segments: [{ value: maleCount }, { value: femaleCount, color: '#8EC13E' }] } : undefined,
      summary: `Total members ${totalMembers}: ${maleCount} male, ${femaleCount} female`,
      onClick: () => {},
    },
    {
      title: 'Male - Female',
      value: `${maleCount} - ${femaleCount}`,
      icon: <FiUser className="h-[17px] w-[17px]" />,
      tone: 'neutral' as const,
      viz: maleCount + femaleCount > 0 ? { type: 'pair' as const, a: maleCount, b: femaleCount } : undefined,
      summary: `${maleCount} male compared with ${femaleCount} female members`,
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="All families"
        description="Manage families and their members"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsImportOpen(true)}>
              <FiUpload className="h-3.5 w-3.5" />
              Import CSV
            </Button>
            <Link to="/families/duplicates">
              <Button variant="secondary">
                <FiCopy className="h-3.5 w-3.5" />
                Duplicate families
              </Button>
            </Link>
            <Link to={ROUTES.FAMILIES.CREATE}>
              <Button>+ New family</Button>
            </Link>
          </>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((stat, index) => (
          <StatCard key={index} variant="inline" {...stat} />
        ))}
      </div>

      <Card padding="none" className="overflow-visible">
        <FilterBar
          search={{ value: searchQuery, onChange: setSearchQuery, placeholder: 'Search by house, head or ID' }}
          actions={
            <>
              <Button variant="secondary" iconOnly aria-label="Refresh list" onClick={fetchFamilies}>
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
          <Segmented
            aria-label="Sort families by"
            value={sortBy}
            onChange={(v) => filters.setFilter('sort', v)}
            options={[
              { value: 'date', label: 'Newest' },
              { value: 'mahallId', label: 'Mahall ID' },
            ]}
          />
          <Segmented
            aria-label="Filter families by status"
            value={archivedView ? 'archived' : statusFilter}
            onChange={(v) => {
              filters.setFilter('archived', v === 'archived' ? 'true' : '');
              filters.setFilter('status', v === 'archived' ? '' : v);
            }}
            options={[
              { value: '', label: 'All' },
              { value: 'approved', label: 'Approved' },
              { value: 'unapproved', label: 'Unapproved' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
          <SavedViews pageKey="families" filters={filters} />
        </FilterBar>
        <AppliedFilters
          filters={filters}
          config={{
            status: { label: 'Status', format: (v) => (v === 'approved' ? 'Approved' : v === 'unapproved' ? 'Unapproved' : v) },
            archived: { label: 'Showing', format: () => 'Archived families' },
            needsHead: { label: 'Needs attention', format: () => 'Needs a new head' },
            sort: { label: 'Sort', format: (v) => (v === 'mahallId' ? 'Mahall ID' : 'Newest') },
          }}
        />

        <div className="p-3.5">
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
            key={selectionKey}
            columns={view.columns}
            density={view.density}
            selectable
            filtersActive={filters.activeCount > 0}
            onClearFilters={filters.clear}
            bulkActions={(ids) => (
              <>
                {selectedFamilies(ids).some((f) => f.status !== 'approved') && (
                  <BulkBarButton onClick={() => setBulkApprove(selectedFamilies(ids).filter((f) => f.status !== 'approved'))}>
                    <FiCheck className="h-3.5 w-3.5" /> Approve
                  </BulkBarButton>
                )}
                <BulkBarButton onClick={() => exportSelected(ids)}>
                  <FiDownload className="h-3.5 w-3.5" /> Export selected
                </BulkBarButton>
              </>
            )}
            data={families}
            emptyMessage="No families found"
            exportFilename="families"
            exportTitle="All Families"
            showExport={false}
            onRowClick={(row) => detail.open(String(row.id))}
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
              if (statusFilter) params.status = statusFilter;
              if (archivedView) params.archived = true;
              if (needsHeadView) params.needsHead = true;
              const result = await familyService.getAll(params);
              return result.data;
            }}
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

      <FamilyQuickView detail={detail} rows={families} canEdit onChanged={fetchFamilies} />

      {archiveTarget && (
        <ArchiveFamilyDialog
          open
          familyId={archiveTarget.id}
          houseName={archiveTarget.houseName}
          onClose={() => setArchiveTarget(null)}
          onDone={(msg) => {
            toast.success(msg || `${archiveTarget.houseName} archived. You can restore it from the Archived tab.`);
            setArchiveTarget(null);
            fetchFamilies();
          }}
        />
      )}
      <ConfirmDialog
        isOpen={!!restoreTarget}
        title="Restore family?"
        variant="primary"
        message={`Restore ${restoreTarget?.houseName ?? 'this family'}?`}
        consequence="The family and the members archived with it will appear in lists and reports again."
        confirmLabel="Restore"
        isLoading={restoring}
        onConfirm={runRestore}
        onCancel={() => setRestoreTarget(null)}
      />

      <ConfirmDialog
        isOpen={!!bulkApprove}
        title="Approve families?"
        variant="primary"
        message={`Approve ${bulkApprove?.length ?? 0} selected ${bulkApprove?.length === 1 ? 'family' : 'families'}?`}
        consequence="Approved families become active in the register and appear in member and collection lists."
        confirmLabel="Approve"
        isLoading={bulkBusy}
        onConfirm={runBulkApprove}
        onCancel={() => setBulkApprove(null)}
      />

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

