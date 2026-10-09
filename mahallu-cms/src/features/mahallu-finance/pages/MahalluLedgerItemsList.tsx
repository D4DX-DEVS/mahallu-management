import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiTrash2, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import FilterPanel from '@/components/ui/FilterPanel';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, LedgerItem, Ledger, LedgerItemsSummary } from '@/services/masterAccountService';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { fetchAllPages } from '@/services/api';

export default function MahalluLedgerItemsList() {
  const navigate = useNavigate();
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Income / expense across every entry matching the filter (all pages), from the server. */
  const [summary, setSummary] = useState<LedgerItemsSummary>({ totalIncome: 0, totalExpense: 0, net: 0, count: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<LedgerItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    // Fetch mahallu-level ledgers (no instituteId) for the dropdown
    fetchAllPages((page) => masterAccountService.getAllLedgers({ ...page, scope: 'mahallu' }))
      .then((r) => setLedgers(r))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchItems();
  }, [ledgerFilter, currentPage, itemsPerPage]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: itemsPerPage, scope: 'mahallu' };
      if (ledgerFilter !== 'all') params.ledgerId = ledgerFilter;
      const result = await masterAccountService.getLedgerItems(params);
      setItems(Array.isArray(result.data) ? result.data : []);
      setSummary({
        totalIncome: Number(result.summary?.totalIncome) || 0,
        totalExpense: Number(result.summary?.totalExpense) || 0,
        net: Number(result.summary?.net) || 0,
        count: Number(result.summary?.count) || 0,
      });
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'ledger items'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedgerItem(selected.id);
      setShowDeleteModal(false);
      fetchItems();
      toast.success('Ledger entry deleted');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete ledger entry' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      // Same ledger filter as the visible list (it used to export every ledger whatever was selected).
      const exportFilters: { scope: string; ledgerId?: string } = { scope: 'mahallu' };
      if (ledgerFilter !== 'all') exportFilters.ledgerId = ledgerFilter;
      const allRows = await fetchAllPages((page) => masterAccountService.getLedgerItems({ ...exportFilters, ...page }));
      const data = Array.isArray(allRows) ? allRows : [];
      if (!data.length) {
        toast.info('No ledger entries to export');
        return;
      }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-ledger-items');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-ledger-items');
      else await exportToPDF(columns, data, 'mahallu-ledger-items', 'Mahallu Ledger Items');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't export ledger entries");
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = items.filter(
    (i) => !searchQuery || (i.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: TableColumn<LedgerItem>[] = [
    { key: 'date', label: 'Date', sortable: true, width: '9rem', render: (d) => formatDate(d) },
    {
      key: 'ledgerId' as any,
      label: 'Ledger',
      sortable: false,
      width: '12rem',
      render: (ledgerId: string) => toTitleCase(ledgers.find((l) => l.id === ledgerId)?.name) || '—',
    },
    { key: 'description', label: 'Description', priority: 'secondary', width: '16rem', render: (v) => v || '—' },
    { key: 'type', label: 'Type', sortable: true, width: '8rem', render: (t) => <Badge variant={t === 'income' ? 'success' : 'danger'} className="capitalize">{t}</Badge> },
    { key: 'amount', label: 'Amount', align: 'right', sortable: true, width: '9rem', render: (a) => `₹${(a || 0).toLocaleString('en-IN')}` },
    { key: 'paymentMethod', label: 'Method', sortable: true, priority: 'tertiary', width: '8rem' },
    { key: 'referenceNo', label: 'Reference no.', priority: 'tertiary', width: '9rem', render: (r) => r || '—' },
    { key: 'source', label: 'Source', priority: 'tertiary', width: '8rem', render: (s) => (s ? toTitleCase(s) : 'Manual') },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) =>
        row.source === 'manual' ? (
          <ActionsMenu
            label={`Actions for ${row.description || 'entry'}`}
            items={[
              {
                label: 'Delete',
                icon: <FiTrash2 className="h-4 w-4" />,
                variant: 'danger',
                onClick: () => {
                  setSelected(row);
                  setShowDeleteModal(true);
                },
              },
            ]}
          />
        ) : null,
    },
  ];

  const openRow = (row: LedgerItem) => {
    if (row.source === 'manual') {
      setSelected(row);
      setShowDeleteModal(true);
    }
  };

  const activeFilterCount = ledgerFilter !== 'all' ? 1 : 0;
  const isFiltered = Boolean(searchQuery) || ledgerFilter !== 'all';

  return (
    <>
      <PageHeader
        title="Mahallu ledger items"
        description="Manual journal entries for the mahallu."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS_CREATE)}>
            Add entry
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard title="Total Income" value={<>₹{summary.totalIncome.toLocaleString()}</>} tone="success" />
        <StatCard title="Total Expense" value={<>₹{summary.totalExpense.toLocaleString()}</>} tone="destructive" />
        <StatCard
          title="Net Balance"
          value={<>₹{summary.net.toLocaleString()}</>}
          tone="info"
        />
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="ledger items"
          onFilterClick={() => setIsFilterVisible((open) => !open)}
          isFilterVisible={isFilterVisible}
          hasFilters
          activeFilterCount={activeFilterCount}
          onRefresh={fetchItems}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {isFilterVisible && (
          <FilterPanel onClose={() => setIsFilterVisible(false)}>
            <div className="w-full sm:w-52">
              <Select
                label="Ledger"
                options={[
                  { value: 'all', label: 'All ledgers' },
                  ...ledgers.map((l) => ({ value: l.id, label: toTitleCase(l.name) })),
                ]}
                value={ledgerFilter}
                onChange={(e) => {
                  setLedgerFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            {ledgerFilter !== 'all' && (
              <Button
                variant="ghost"
                onClick={() => {
                  setLedgerFilter('all');
                  setCurrentPage(1);
                }}
              >
                Clear filters
              </Button>
            )}
          </FilterPanel>
        )}
        {error ? (
          <EmptyState
            variant="error"
            entity="ledger items"
            description={error}
            action={{ label: 'Try again', onClick: fetchItems }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={filtered}
              isLoading={loading}
              entity="ledger items"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setLedgerFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add entry', onClick: () => navigate(ROUTES.MAHALLU_FINANCE.LEDGER_ITEMS_CREATE) }
              }
              onRowClick={openRow}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="ledger items"
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
        title={`Delete ${toTitleCase(selected?.description) || 'this entry'}?`}
        message="This permanently removes the entry and cannot be undone."
        confirmLabel="Delete entry"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
