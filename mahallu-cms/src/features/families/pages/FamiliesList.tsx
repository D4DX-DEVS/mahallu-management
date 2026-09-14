import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEdit2, FiTrash2, FiHome, FiUsers, FiUpload, FiPlus, FiFileText, FiFile } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Alert from '@/components/ui/Alert';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import ActionsMenu from '@/components/ui/ActionsMenu';
import PageHeader from '@/components/layout/PageHeader';
import BulkImportCsv, { ColumnSpec } from '@/components/BulkImportCsv';
import { TableColumn, Pagination as PaginationType, SortState } from '@/types';
import { Family } from '@/types';
import { ROUTES } from '@/constants/routes';
import { familyService } from '@/services/familyService';
import { useDebounce } from '@/hooks/useDebounce';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { toTitleCase } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage, pluralise } from '@/utils/errors';

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

const FAMILY_TEMPLATE =
  'houseName,houseNameMl,familyHead,familyHeadMl,contactNo,area,areaMl,place,placeMl,varisangyaGrade\nAl-Hamd House,അൽ-ഹാമ്ദ് വീട്,Ahmed Ali,അഹമ്മദ് അലി,9876543210,Area A,ഏരിയ എ,Calicut,കാലിക്കറ്റ്,Grade A\n';

/**
 * Family delete is a hard delete on the API and does not cascade, so members
 * keep a familyId pointing at a record that is gone. The dialog says so.
 */
const deleteConsequence = (family: Family | null) => {
  const count = family?.members?.length ?? 0;
  if (count === 0) return undefined;
  return `${pluralise(count, 'member')} will be left without a family. Move them first if you need them kept intact.`;
};

export default function FamiliesList() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [areaFilter, setAreaFilter] = useState('');
  const [sort, setSort] = useState<SortState | null>(null);

  const [families, setFamilies] = useState<Family[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [memberStats, setMemberStats] = useState({ totalMembers: 0, maleCount: 0, femaleCount: 0 });
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Family | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 400);
  const activeFilterCount = areaFilter ? 1 : 0;
  const isFiltered = Boolean(debouncedSearch || areaFilter);

  const queryParams = useCallback(
    (overrides: Record<string, any> = {}) => {
      const params: Record<string, any> = { page: currentPage, limit: itemsPerPage, ...overrides };
      if (debouncedSearch) params.search = debouncedSearch;
      if (areaFilter) params.area = areaFilter;
      if (sort) {
        params.sortBy = sort.key;
        params.sortOrder = sort.direction;
      }
      return params;
    },
    [currentPage, itemsPerPage, debouncedSearch, areaFilter, sort]
  );

  const fetchFamilies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await familyService.getAll(queryParams());
      setFamilies(result.data);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'families'));
    } finally {
      setLoading(false);
    }
  }, [queryParams]);

  // A new search term invalidates the current page offset: searching from page 4
  // kept asking the API for page 4 of the new, much shorter result set and showed
  // an empty table.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchFamilies();
  }, [fetchFamilies]);

  useEffect(() => {
    familyService
      .getStats()
      // A response without its stats object used to replace the zeroed initial
      // state with `undefined`, and the tiles then read through it.
      .then((stats) => stats && setMemberStats(stats))
      .catch(() => undefined);
  }, []);

  // A new query invalidates the selection: those rows may no longer be on screen.
  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, areaFilter, currentPage, sort]);

  const handleExport = async (type: 'csv' | 'pdf') => {
    try {
      setIsExporting(true);
      const rows = await familyService.getAllForExport({
        search: debouncedSearch || undefined,
        area: areaFilter || undefined,
        sortBy: sort?.key,
      });
      if (rows.length === 0) {
        toast.info('Nothing to export');
        return;
      }
      if (type === 'csv') exportToCSV(columns, rows, 'families');
      else exportToPDF(columns, rows, 'families', 'Families');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'export this list' }));
    } finally {
      setIsExporting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setIsDeleting(true);
      await familyService.delete(deleting.id);
      toast.success('Family deleted');
      setDeleting(null);
      fetchFamilies();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete this family' }));
    } finally {
      setIsDeleting(false);
    }
  };

  /* Column priority is declared here and honoured by Table at every breakpoint,
   * so a phone shows the five that matter rather than nine crushed columns. */
  const columns: TableColumn<Family>[] = [
    /* Widths are each column's heading plus a constant, so the gap between one
     * heading and the next is the same all the way across. A column wider than
     * that would park its spare width beside its own heading and open a hole
     * the neighbours do not have. */
    { key: 'mahallId', label: 'Family ID', sortable: true, width: '8.75rem' },
    {
      key: 'houseName',
      label: 'House name',
      sortable: true,
      render: (name) => <span>{toTitleCase(name)}</span>,
      width: '9.75rem',
    },
    {
      key: 'familyHead',
      label: 'Family head',
      render: (head) => (head ? <span>{toTitleCase(head)}</span> : '—'),
      width: '8.125rem',
    },
    /* Heading and digits are both centred, so the count sits under the word
     * that names it. A centred heading carries its slack on both sides, so the
     * two widths either side of it are cut to absorb that and keep the gap
     * between headings the same as everywhere else. */
    {
      key: 'members',
      label: 'Members',
      align: 'center',
      render: (members) => members?.length ?? 0,
      width: '10.25rem',
    },
    {
      key: 'area',
      label: 'Area',
      priority: 'secondary',
      render: (area) => (area ? <span>{toTitleCase(area)}</span> : '—'),
      width: '6.625rem',
    },
    { key: 'houseNo', label: 'House no.', priority: 'tertiary', width: '9.125rem' },
    /* The field on Family is `contactNo`; `phone` read undefined on every
     * row, so the column showed a dash for all of them. */
    { key: 'contactNo', label: 'Phone', priority: 'secondary', width: '7rem' },
    {
      key: 'actions',
      label: 'Actions',
      align: 'center',
      headerAlign: 'left',
      width: '7.5rem',
      render: (_, row) => (
        <ActionsMenu
          label={`Actions for ${toTitleCase(row.houseName)}`}
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => navigate(ROUTES.FAMILIES.DETAIL(row.id)),
            },
            {
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () => navigate(ROUTES.FAMILIES.EDIT(row.id)),
            },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              variant: 'danger',
              onClick: () => setDeleting(row),
            },
          ]}
        />
      ),
    },
  ];

  const areaOptions = [
    { value: '', label: 'All areas' },
    ...Array.from(new Set(families.map((f) => f.area).filter(Boolean))).map((area) => ({
      value: area as string,
      label: toTitleCase(area as string),
    })),
  ];

  return (
    <>
      <PageHeader
        title="Families"
        description="Households registered in this mahallu."
        actions={
          <>
            <Button variant="outline" onClick={() => setIsImportOpen(true)}>
              <FiUpload className="h-4 w-4" aria-hidden="true" />
              Import CSV
            </Button>
            <Link to={ROUTES.FAMILIES.CREATE}>
              <Button>
                <FiPlus className="h-4 w-4" aria-hidden="true" />
                New family
              </Button>
            </Link>
          </>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          title="Families"
          value={pagination?.total ?? families.length}
          icon={<FiHome className="h-4 w-4" />}
        />
        <StatCard title="Members" value={memberStats.totalMembers} icon={<FiUsers className="h-4 w-4" />} />
        {/* Male and female used to share one card as the string "342 - 318",
            which cannot be read at a glance. Two figures, two cards. */}
        <StatCard title="Male" value={memberStats.maleCount} />
        <StatCard title="Female" value={memberStats.femaleCount} />
      </div>

      <TableCard padding="lg">
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="families"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchFamilies}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <div className="mb-4 flex flex-wrap items-end gap-3 rounded-md border border-border bg-muted/40 p-3">
            <div className="w-full sm:w-52">
              <Select
                label="Area"
                options={areaOptions}
                value={areaFilter}
                onChange={(e) => {
                  setAreaFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setAreaFilter('');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </div>
        )}

        {error ? (
          <Alert
            variant="error"
            title="Couldn't load families"
            action={{ label: 'Try again', onClick: fetchFamilies }}
          >
            {error}
          </Alert>
        ) : (
          <>
            <Table
              columns={columns}
              data={families}
              isLoading={loading}
              entity="families"
              /* Every column here declares a width, so the layout can be locked
               * to them: a long family head name now clips to an ellipsis
               * instead of stealing width from the columns beside it. */
              fixedLayout
              striped
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? {
                      label: 'Clear filters',
                      onClick: () => {
                        setSearchQuery('');
                        setAreaFilter('');
                        setCurrentPage(1);
                      },
                    }
                  : { label: 'Add family', onClick: () => navigate(ROUTES.FAMILIES.CREATE) }
              }
              sort={sort}
              onSortChange={(next) => {
                setSort(next);
                setCurrentPage(1);
              }}
              selectable
              selectedKeys={selectedIds}
              onSelectionChange={setSelectedIds}
              bulkActions={
                <Dropdown
                  trigger={
                    <Button variant="outline" size="sm">
                      Export selected
                    </Button>
                  }
                  items={[
                    {
                      label: 'Export as CSV',
                      icon: <FiFileText />,
                      onClick: () =>
                        exportToCSV(
                          columns,
                          families.filter((f) => selectedIds.includes(f.id)),
                          'families'
                        ),
                    },
                    {
                      label: 'Export as PDF',
                      icon: <FiFile />,
                      onClick: () =>
                        exportToPDF(
                          columns,
                          families.filter((f) => selectedIds.includes(f.id)),
                          'families',
                          'Families'
                        ),
                    },
                  ] as DropdownItem[]}
                />
              }
              onRowClick={(row) => navigate(ROUTES.FAMILIES.DETAIL(row.id))}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="families"
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

      <BulkImportCsv
        title="Import families from CSV"
        columnSpec={FAMILY_COLUMNS}
        templateCsv={FAMILY_TEMPLATE}
        onImport={(rows) => familyService.bulkImportFamilies(rows)}
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImported={fetchFamilies}
      />

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        title={`Delete ${deleting?.houseName ? toTitleCase(deleting.houseName) : 'this family'}?`}
        message="This permanently removes the family record and cannot be undone."
        consequence={deleteConsequence(deleting)}
        confirmLabel="Delete family"
        variant="danger"
        isLoading={isDeleting}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}
