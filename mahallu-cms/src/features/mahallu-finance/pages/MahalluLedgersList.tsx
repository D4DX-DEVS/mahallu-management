import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { fetchAllPages } from '@/services/api';

export default function MahalluLedgersList() {
  const navigate = useNavigate();
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<Ledger | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    fetchLedgers();
  }, [currentPage, itemsPerPage]);

  const fetchLedgers = async () => {
    try {
      setLoading(true);
      setError(null);
      // instituteId not sent → backend returns mahallu-scope (instituteId: null) ledgers
      const result = await masterAccountService.getAllLedgers({
        page: currentPage,
        limit: itemsPerPage,
        scope: 'mahallu',
      });
      setLedgers(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'ledgers'));
      setLedgers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteLedger(selected.id);
      setShowDeleteModal(false);
      fetchLedgers();
      toast.success('Ledger deleted');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete ledger' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const allRows = await fetchAllPages((page) => masterAccountService.getAllLedgers({ ...page, scope: 'mahallu' }));
      const data = Array.isArray(allRows) ? allRows : [];
      if (!data.length) {
        toast.info('No ledgers to export');
        return;
      }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-ledgers');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-ledgers');
      else await exportToPDF(columns, data, 'mahallu-ledgers', 'Mahallu Ledgers');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't export ledgers");
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = ledgers.filter(
    (l) => !searchQuery || l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: TableColumn<Ledger>[] = [
    { key: 'name', label: 'Name', sortable: true, width: '16rem', render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span> },
    { key: 'type', label: 'Type', sortable: true, width: '9rem', render: (t) => <Badge variant={t === 'income' ? 'success' : 'danger'} className="capitalize">{t}</Badge> },
    { key: 'description', label: 'Description', priority: 'secondary', width: '18rem', render: (v) => v || '—' },
    { key: 'createdAt', label: 'Created', sortable: true, priority: 'tertiary', width: '9rem', render: (d) => formatDate(d) },
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
              label: 'Edit',
              icon: <FiEdit2 className="h-4 w-4" />,
              onClick: () =>
                navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_EDIT(row.id), { state: { ledger: row } }),
            },
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
      ),
    },
  ];

  const isFiltered = Boolean(searchQuery);

  return (
    <>
      <PageHeader
        title="Mahallu ledgers"
        description="Chart of accounts for the mahallu."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_CREATE)}>
            Add ledger
          </Button>
        }
      />


      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="ledgers"
          onRefresh={fetchLedgers}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {error ? (
          <EmptyState
            variant="error"
            entity="ledgers"
            description={error}
            action={{ label: 'Try again', onClick: fetchLedgers }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={filtered}
              isLoading={loading}
              entity="ledgers"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add ledger', onClick: () => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_CREATE) }
              }
              onRowClick={(row) => {
                setSelected(row);
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
                  entity="ledgers"
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
          setSelected(null);
        }}
        title="Ledger Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelected(null);
              }}
            >
              Close
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                if (selected) {
                  navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_EDIT(selected.id), { state: { ledger: selected } });
                }
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
        }
      >
        {selected && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{toTitleCase(selected.name)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Type</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selected.type || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selected.createdAt)}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
              <p className="text-gray-900 dark:text-gray-100">{selected.description || '—'}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete ${toTitleCase(selected?.name) || 'this ledger'}?`}
        message="This permanently removes the ledger and cannot be undone."
        confirmLabel="Delete ledger"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
