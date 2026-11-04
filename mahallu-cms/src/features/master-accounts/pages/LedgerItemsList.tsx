import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiEye, FiList, FiPlus, FiTrash2, FiTrendingDown, FiTrendingUp } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import FilterPanel from '@/components/ui/FilterPanel';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Badge from '@/components/ui/Badge';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import {
  masterAccountService,
  LedgerItem,
  Ledger,
  Category,
  LedgerItemsSummary,
} from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { sanitizeAmountInput } from '@/utils/validation';
import { fetchAllPages } from '@/services/api';
import { logError } from '@/utils/safeLog';

export default function LedgerItemsList() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [ledgerFilter, setLedgerFilter] = useState('all');
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Income / expense across every item matching the filters (all pages), from the server. */
  const [summary, setSummary] = useState<LedgerItemsSummary>({ totalIncome: 0, totalExpense: 0, net: 0, count: 0 });
  const [isExporting, setIsExporting] = useState(false);
  const [selectedItem, setSelectedItem] = useState<LedgerItem | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    date: '',
    amount: '',
    type: 'income' as 'income' | 'expense',
    description: '',
    paymentMethod: '',
    referenceNo: '',
  });
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');

  useEffect(() => {
    fetchLedgers();
    fetchCategories();
    if (!userInstituteId) {
      // The API caps `limit` at 100 and answers 400 above it — getAllForExport
      // pages through all institutes instead of failing the dropdown silently.
      instituteService
        .getAllForExport()
        .then((rows) => setInstitutes(rows.map((i: any) => ({ id: i.id, name: i.name }))))
        .catch((err) => toast.error(loadErrorMessage(err, 'institutes')));
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [ledgerFilter, currentPage, instituteFilter, itemsPerPage]);

  const fetchLedgers = async () => {
    try {
      // Fetch all ledgers for dropdown (no pagination needed for filter)
      const allRows = await fetchAllPages((page) => masterAccountService.getAllLedgers(page));
      setLedgers(Array.isArray(allRows) ? allRows : []);
    } catch (err) {
      logError('Error fetching ledgers', err);
      setLedgers([]);
    }
  };

  const fetchCategories = async () => {
    try {
      const allRows = await fetchAllPages((page) => masterAccountService.getAllCategories(page));
      setCategories(Array.isArray(allRows) ? allRows : []);
    } catch (err) {
      logError('Error fetching categories', err);
      setCategories([]);
    }
  };

  const fetchItems = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (ledgerFilter !== 'all') {
        params.ledgerId = ledgerFilter;
      }
      if (instituteFilter !== 'all') {
        params.instituteId = instituteFilter;
      }
      const result = await masterAccountService.getLedgerItems(params);
      setItems(Array.isArray(result.data) ? result.data : []);
      setSummary({
        totalIncome: Number(result.summary?.totalIncome) || 0,
        totalExpense: Number(result.summary?.totalExpense) || 0,
        net: Number(result.summary?.net) || 0,
        count: Number(result.summary?.count) || 0,
      });
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'ledger items'));
      logError('Error fetching items', err);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const params: any = {};
      if (ledgerFilter !== 'all') params.ledgerId = ledgerFilter;
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;

      const dataToExport = await fetchAllPages((page) =>
        masterAccountService.getLedgerItems({ ...params, ...page })
      );

      if (dataToExport.length === 0) {
        toast.info('No ledger items to export');
        return;
      }

      const filename = 'ledger-items';
      const title = 'Ledger Items';

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
      toast.error(error?.message || "Couldn't export ledger items");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<LedgerItem>[] = [
    { key: 'date', label: 'Date', sortable: true, width: '9rem', render: (date) => formatDate(date) },
    { key: 'description', label: 'Description', priority: 'secondary', width: '16rem', render: (v) => v || '—' },
    { key: 'type', label: 'Type', sortable: true, width: '8rem', render: (t) => <Badge variant={t === 'income' ? 'success' : 'danger'} className="capitalize">{t}</Badge> },
    { key: 'amount', label: 'Amount', align: 'right', sortable: true, width: '9rem', render: (amount) => `₹${amount?.toLocaleString('en-IN') || 0}` },
    {
      key: 'source' as any,
      label: 'Source',
      priority: 'tertiary',
      width: '8rem',
      render: (source: string) => (source && source !== 'manual' ? toTitleCase(source) : 'Manual'),
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => {
        const isAuto = row.source && row.source !== 'manual';
        return (
          <ActionsMenu
            label={`Actions for ${row.description || 'entry'}`}
            items={[
              {
                label: 'View',
                icon: <FiEye className="h-4 w-4" />,
                onClick: () => {
                  setSelectedItem(row);
                  setShowViewModal(true);
                },
              },
              {
                label: 'Edit',
                icon: <FiEdit2 className="h-4 w-4" />,
                onClick: () => !isAuto && openEditModal(row),
                disabled: isAuto,
              },
              {
                label: 'Delete',
                icon: <FiTrash2 className="h-4 w-4" />,
                onClick: () => {
                  if (!isAuto) {
                    setSelectedItem(row);
                    setShowDeleteModal(true);
                  }
                },
                variant: 'danger',
                disabled: isAuto,
              },
            ]}
          />
        );
      },
    },
  ];

  const openEditModal = (item: LedgerItem) => {
    setSelectedItem(item);
    setEditForm({
      date: item.date ? new Date(item.date).toISOString().split('T')[0] : '',
      amount: item.amount != null ? String(item.amount) : '',
      type: item.type || 'income',
      description: item.description || '',
      paymentMethod: (item as any).paymentMethod || '',
      referenceNo: (item as any).referenceNo || '',
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedItem) return;
    try {
      await masterAccountService.updateLedgerItem(selectedItem.id, {
        ...editForm,
        amount: Number(editForm.amount) || 0,
      });
      await fetchItems();
      setShowEditModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      // A failed edit must not blank the list behind the still-open modal —
      // that used to happen because this reused the page-level fetch error.
      toast.error(errorMessage(err, { action: 'update ledger item' }));
    }
  };

  const handleDelete = async () => {
    if (!selectedItem) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedgerItem(selectedItem.id);
      await fetchItems();
      setShowDeleteModal(false);
      setSelectedItem(null);
    } catch (err: any) {
      // Same here — e.g. the "auto-posted entry" guard used to replace the
      // whole table with a full-page error instead of a message on the modal.
      toast.error(errorMessage(err, { action: 'delete ledger item' }));
    } finally {
      setDeleting(false);
    }
  };

  // The list endpoint has no `search` query param, so — same as the Mahallu
  // Finance ledger items screen — the search box filters the page already loaded.
  const filteredItems = items.filter(
    (i) => !searchQuery || (i.description || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    { title: 'Total Items', value: pagination?.total || items.length, icon: <FiList className="h-5 w-5" /> },
    {
      title: 'Total Income',
      value: `₹${summary.totalIncome.toLocaleString()}`,
      icon: <FiTrendingUp className="h-5 w-5" />,
    },
    {
      title: 'Total Expense',
      value: `₹${summary.totalExpense.toLocaleString()}`,
      icon: <FiTrendingDown className="h-5 w-5" />,
    },
  ];

  const activeFilterCount = (ledgerFilter !== 'all' ? 1 : 0) + (!userInstituteId && instituteFilter !== 'all' ? 1 : 0);
  const isFiltered = Boolean(searchQuery) || activeFilterCount > 0;

  return (
    <>
      <PageHeader
        title="Ledger items"
        description="Manage ledger transactions."
        actions={
          <Link to="/master-accounts/ledger-items/create">
            <Button icon={<FiPlus />} collapseLabel>New item</Button>
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
            <div className="w-full sm:w-64">
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
            {!userInstituteId && (
              <div className="w-full sm:w-64">
                <Select
                  label="Institute"
                  options={[
                    { value: 'all', label: 'All institutes' },
                    ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
                  ]}
                  value={instituteFilter}
                  onChange={(e) => {
                    setInstituteFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            )}
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                onClick={() => {
                  setLedgerFilter('all');
                  if (!userInstituteId) setInstituteFilter('all');
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
              data={filteredItems}
              isLoading={loading}
              entity="ledger items"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setLedgerFilter('all'); if (!userInstituteId) setInstituteFilter('all'); setCurrentPage(1); } }
                  : { label: 'Add item', onClick: () => navigate('/master-accounts/ledger-items/create') }
              }
              onRowClick={(row) => {
                setSelectedItem(row);
                setShowViewModal(true);
              }}
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

      {/* View Modal */}
      <Modal
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedItem(null);
        }}
        title="Ledger Item Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedItem(null);
              }}
            >
              Close
            </Button>
            {!(selectedItem?.source && selectedItem.source !== 'manual') && (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedItem) openEditModal(selectedItem);
                    setShowViewModal(false);
                  }}
                >
                  Edit
                </Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    setShowViewModal(false);
                    setShowDeleteModal(true);
                  }}
                >
                  Delete
                </Button>
              </>
            )}
          </>
        }
      >
        {selectedItem && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Date</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedItem.date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedItem.type}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                ₹{(selectedItem.amount || 0).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Ledger</p>
              <p className="text-gray-900 dark:text-gray-100">
                {toTitleCase(ledgers.find((l) => l.id === selectedItem.ledgerId)?.name) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
              <p className="text-gray-900 dark:text-gray-100">
                {toTitleCase(categories.find((c) => c.id === selectedItem.categoryId)?.name) || '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedItem.description || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payment Method</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedItem.paymentMethod || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Reference No</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedItem.referenceNo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Source</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedItem.source || 'manual'}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedItem(null);
        }}
        title="Edit Ledger Item"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setSelectedItem(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Date"
            type="date"
            value={editForm.date}
            onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
          />
          <Select
            label="Type"
            value={editForm.type}
            onChange={(e) => setEditForm({ ...editForm, type: e.target.value as 'income' | 'expense' })}
            options={[
              { value: 'income', label: 'Income' },
              { value: 'expense', label: 'Expense' },
            ]}
          />
          <Input
            label="Amount"
            type="number"
            step="0.01"
            inputMode="decimal"
            value={editForm.amount}
            onChange={(e) => setEditForm({ ...editForm, amount: sanitizeAmountInput(e.target.value) })}
            placeholder="0.00"
          />
          <Input
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
          <Input
            label="Payment Method"
            value={editForm.paymentMethod}
            onChange={(e) => setEditForm({ ...editForm, paymentMethod: e.target.value })}
          />
          <Input
            label="Reference No"
            value={editForm.referenceNo}
            onChange={(e) => setEditForm({ ...editForm, referenceNo: e.target.value })}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete ${toTitleCase(selectedItem?.description) || 'this ledger item'}?`}
        message="This permanently removes the ledger item and cannot be undone."
        confirmLabel="Delete ledger item"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedItem(null);
        }}
      />
    </>
  );
}
