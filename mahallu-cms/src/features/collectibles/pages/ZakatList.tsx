import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiCheckCircle, FiCreditCard, FiDollarSign, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import { rowActionClass } from '@/components/ui/rowAction';
import Button from '@/components/ui/Button';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import EmptyState from '@/components/ui/EmptyState';
import Pagination from '@/components/ui/Pagination';
import TableToolbar from '@/components/ui/TableToolbar';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { TableColumn, Pagination as PaginationType } from '@/types';
import {
  collectibleService,
  Zakat,
  CollectionSummary,
  EMPTY_COLLECTION_SUMMARY,
} from '@/services/collectibleService';
import { fetchAllPages } from '@/services/api';
import { useDebounce } from '@/hooks/useDebounce';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON } from '@/utils/exportUtils';
import { exportInvoicesToPdf, InvoiceDetails } from '@/utils/invoiceUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, isConflict, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';

export default function ZakatList() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [zakats, setZakats] = useState<Zakat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  /* Totals for the whole filtered set (every page), from the server. */
  const [summary, setSummary] = useState<CollectionSummary>(EMPTY_COLLECTION_SUMMARY);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedZakat, setSelectedZakat] = useState<Zakat | null>(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [verifyConfirm, setVerifyConfirm] = useState<Zakat | null>(null);
  const [verifying, setVerifying] = useState(false);

  const debouncedSearch = useDebounce(searchQuery, 500);

  // A page number that only made sense for the previous search must not
  // survive into the new one - reset it once the debounce settles.
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchZakats();
  }, [debouncedSearch, currentPage, itemsPerPage]);

  const fetchZakats = async () => {
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
      const result = await collectibleService.getAllZakats(params);
      setZakats(result.data);
      setSummary(result.summary);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'zakats'));
      console.error('Error fetching zakats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);

      const filters: any = {};
      if (debouncedSearch) filters.search = debouncedSearch;

      // The endpoint caps limit at 100 and 400s above it, so a single
      // limit:10000 request always failed - page through instead.
      const dataToExport = await fetchAllPages<Zakat>((p) => collectibleService.getAllZakats({ ...filters, ...p }));

      if (dataToExport.length === 0) {
        toast.info('No zakat data to export');
        return;
      }

      const filename = 'zakat-payments';
      const title = 'Zakat Payments';

      switch (type) {
        case 'csv':
          exportToCSV(columns, dataToExport, filename);
          break;
        case 'json':
          exportToJSON(columns, dataToExport, filename);
          break;
        case 'pdf':
          {
            const invoices: InvoiceDetails[] = dataToExport.map((entry) => ({
              title: title,
              receiptNo: entry.receiptNo,
              payerLabel: 'Payer',
              payerName: entry.payerName ? toTitleCase(entry.payerName) : '-',
              amount: entry.amount,
              paymentDate: entry.paymentDate,
              paymentMethod: entry.paymentMethod,
              remarks: entry.remarks,
            }));
            await exportInvoicesToPdf(invoices, `zakat-invoices-${new Date().toISOString().split('T')[0]}`);
          }
          break;
      }
    } catch (error: any) {
      toast.error(errorMessage(error, { action: 'export zakat data' }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleVerify = async () => {
    if (!verifyConfirm) return;
    try {
      setVerifying(true);
      await collectibleService.verifyZakat(verifyConfirm.id);
      toast.success('Zakat verified');
      setVerifyConfirm(null);
      await fetchZakats();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'verify zakat' }));
      if (isConflict(err)) {
        // Already processed elsewhere: close the dialog and show the row as it is now.
        setVerifyConfirm(null);
        await fetchZakats();
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedZakat) return;
    try {
      setDeleting(true);
      await collectibleService.deleteZakat(selectedZakat.id);
      await fetchZakats();
      setShowDeleteModal(false);
      setSelectedZakat(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete zakat payment' }));
    } finally {
      setDeleting(false);
    }
  };

  const columns: TableColumn<Zakat>[] = [
    {
      key: 'payerName',
      label: 'Payer name',
      width: '14rem',
      sortable: true,
      render: (v) => <span className="font-medium text-foreground">{toTitleCase(v)}</span>,
    },
    {
      key: 'amount',
      label: 'Amount',
      width: '9rem',
      align: 'right',
      sortable: true,
      render: (amount) => `₹${amount?.toLocaleString('en-IN') || 0}`,
    },
    {
      key: 'paymentDate',
      label: 'Payment date',
      sortable: true,
      width: '9rem',
      render: (date) => formatDate(date),
    },
    { key: 'category', label: 'Category', sortable: true, priority: 'secondary', width: '9rem', render: (v) => (v ? toTitleCase(v) : '—') },
    {
      key: 'receiptNo',
      label: 'Receipt no.',
      sortable: true,
      priority: 'secondary',
      width: '9rem',
      render: (receiptNo) => receiptNo || '—',
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: '8rem',
      render: (status) => <StatusBadge status={status === 'pending' ? 'pending' : 'verified'} />,
    },
    {
      key: 'actions',
      label: '',
      width: '6.5rem',
      align: 'right',
      sortable: false,
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {row.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setVerifyConfirm(row);
              }}
              className={rowActionClass()}
              title="Verify payment"
              aria-label="Verify payment"
            >
              <FiCheckCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  const stats = [
    {
      title: 'Total Payments',
      value: summary.count,
      icon: <FiCreditCard className="h-5 w-5" />,
    },
    {
      title: 'Total Amount',
      value: `₹${summary.totalAmount.toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  const isFiltered = Boolean(debouncedSearch);

  return (
    <>
      <PageHeader
        title="Zakat"
        description="Manage zakat payments."
        actions={
          <Link to="/collectibles/zakat/create">
            <Button icon={<FiPlus />} collapseLabel>New payment</Button>
          </Link>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3">
        {stats.map((stat, index) => (
          <StatCard key={index} {...stat} />
        ))}
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="zakat payments"
          onRefresh={fetchZakats}
          onExport={handleExport}
          isExporting={isExporting}
        />

        {error ? (
          <EmptyState
            variant="error"
            entity="zakat payments"
            description={error}
            action={{ label: 'Try again', onClick: fetchZakats }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={zakats}
              isLoading={loading}
              entity="zakat payments"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'New payment', onClick: () => navigate('/collectibles/zakat/create') }
              }
              onRowClick={(row) => {
                setSelectedZakat(row);
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
                  entity="zakat payments"
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
          setSelectedZakat(null);
        }}
        title="Zakat Payment Details"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowViewModal(false);
                setSelectedZakat(null);
              }}
            >
              Close
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
        {selectedZakat && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payer Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">{toTitleCase(selectedZakat.payerName)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Amount</p>
              <p className="text-gray-900 dark:text-gray-100">₹{selectedZakat.amount?.toLocaleString() || 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payment Date</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedZakat.paymentDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Category</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedZakat.category ? toTitleCase(selectedZakat.category) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Payment Method</p>
              <p className="text-gray-900 dark:text-gray-100">
                {selectedZakat.paymentMethod ? toTitleCase(selectedZakat.paymentMethod) : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Receipt No.</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedZakat.receiptNo || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">{selectedZakat.status || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Remarks</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedZakat.remarks || '—'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedZakat.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={showDeleteModal}
        title={`Delete payment from ${toTitleCase(selectedZakat?.payerName) || 'this payer'}?`}
        message="This permanently removes the zakat payment and cannot be undone."
        confirmLabel="Delete payment"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteModal(false);
          setSelectedZakat(null);
        }}
      />

      <ConfirmDialog
        isOpen={!!verifyConfirm}
        title="Verify this payment?"
        message={`This will mark the zakat payment from ${toTitleCase(verifyConfirm?.payerName || 'this payer')} as verified.`}
        confirmLabel="Verify payment"
        variant="primary"
        isLoading={verifying}
        onConfirm={handleVerify}
        onCancel={() => setVerifyConfirm(null)}
      />
    </>
  );
}
