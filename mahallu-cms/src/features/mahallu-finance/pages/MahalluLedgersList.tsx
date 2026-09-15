import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiBookOpen } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Ledger } from '@/services/masterAccountService';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
  const itemsPerPage = 10;

  useEffect(() => {
    fetchLedgers();
  }, [currentPage]);

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
      const result = await masterAccountService.getAllLedgers({ limit: 10000, scope: 'mahallu' });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) {
        toast.info('No ledgers to export');
        return;
      }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-ledgers');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-ledgers');
      else exportToPDF(columns, data, 'mahallu-ledgers', 'Mahallu Ledgers');
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
    { key: 'id', label: 'No.', width: '6rem', render: (_, __, i) => i + 1 },
    { key: 'name', label: 'Name', width: '6.75rem', render: (v) => <span>{toTitleCase(v)}</span> },
    {
      key: 'type',
      label: 'Type',
      width: '6.25rem',
      render: (t) => (
        <span
          className={`px-2 py-0.5 rounded-full text-xs font-medium ${t === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
        >
          {t}
        </span>
      ),
    },
    { key: 'description', label: 'Description', width: '9.25rem' },
    { key: 'createdAt', label: 'Created', width: '7.75rem', render: (d) => formatDate(d) },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="Mahallu Ledgers"
        description="Chart of accounts for the Mahallu"
        breadcrumbs={[{ label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }]}
      />

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Button
              onClick={() => navigate(ROUTES.MAHALLU_FINANCE.LEDGERS_CREATE)}
              size="sm"
              icon={<FiBookOpen />}
              collapseLabel
            >
              Add Ledger
            </Button>
          }
        />
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <p className="text-center py-8 text-red-600">{error}</p>
        ) : (
          <>
            <Table
              fixedLayout
              striped
              columns={columns}
              data={filtered}
              emptyMessage="No ledgers found"
              onRowClick={(row) => {
                setSelected(row);
                setShowViewModal(true);
              }}
            />
            {pagination && (
              <Pagination
                currentPage={currentPage}
                totalPages={pagination.totalPages || 1}
                totalItems={pagination.total || 0}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
              />
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

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Ledger">
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Delete ledger <strong>{toTitleCase(selected?.name)}</strong>?
        </p>
        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
