import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiEdit2, FiEye, FiPlus, FiTrash2 } from 'react-icons/fi';
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
import { PageSkeleton } from '@/components/ui/Skeleton';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, InstituteAccount } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';

export default function InstituteAccountsList() {
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [accounts, setAccounts] = useState<InstituteAccount[]>([]);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [instituteFilter, setInstituteFilter] = useState(userInstituteId || 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<InstituteAccount | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({
    accountName: '',
    accountNumber: '',
    bankName: '',
    ifscCode: '',
    balance: 0,
    status: 'active' as 'active' | 'inactive',
  });

  useEffect(() => {
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
    fetchAccounts();
  }, [currentPage, instituteFilter]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {
        page: currentPage,
        limit: itemsPerPage,
      };
      if (instituteFilter !== 'all') params.instituteId = instituteFilter;
      const result = await masterAccountService.getAllInstituteAccounts(params);
      setAccounts(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) {
        setPagination(result.pagination);
      }
    } catch (err: any) {
      setError(loadErrorMessage(err, 'institute accounts'));
      console.error('Error fetching accounts:', err);
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const params = { limit: 10000 };
      const result = await masterAccountService.getAllInstituteAccounts(params);
      const dataToExport = Array.isArray(result.data) ? result.data : [];
      if (dataToExport.length === 0) {
        toast.info('No institute accounts to export');
        return;
      }
      const filename = 'institute-accounts';
      const title = 'Institute Accounts';
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
      toast.error(error?.message || "Couldn't export institute accounts");
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<InstituteAccount>[] = [
    { key: 'accountNumber', label: 'Account Number', width: '11.75rem' },
    { key: 'bankName', label: 'Bank Name', width: '9.25rem', render: (v) => toTitleCase(v) },
    { key: 'ifscCode', label: 'IFSC Code', width: '9.25rem' },
    {
      key: 'balance',
      label: 'Balance',
      width: '9.25rem',
      align: 'center',
      render: (balance) => `₹${balance?.toLocaleString() || 0}`,
    },
    {
      key: 'createdAt',
      label: 'Created',
      width: '7.75rem',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_, row) => (
        <ActionsMenu
          items={[
            {
              label: 'View',
              icon: <FiEye className="h-4 w-4" />,
              onClick: () => {
                setSelectedAccount(row);
                setShowViewModal(true);
              },
            },
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => openEditModal(row) },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedAccount(row);
                setShowDeleteModal(true);
              },
              variant: 'danger',
            },
          ]}
        />
      ),
    },
  ];

  const openEditModal = (account: InstituteAccount) => {
    setSelectedAccount(account);
    setEditForm({
      accountName: (account as any).accountName || '',
      accountNumber: account.accountNumber || '',
      bankName: account.bankName || '',
      ifscCode: account.ifscCode || '',
      balance: account.balance || 0,
      status: account.status || 'active',
    });
    setShowEditModal(true);
  };

  const handleEdit = async () => {
    if (!selectedAccount) return;
    try {
      await masterAccountService.updateInstituteAccount(selectedAccount.id, editForm);
      await fetchAccounts();
      setShowEditModal(false);
      setSelectedAccount(null);
    } catch (err: any) {
      // A failed edit must not blank the list behind the still-open modal —
      // that used to happen because this reused the page-level fetch error.
      toast.error(errorMessage(err, { action: 'update account' }));
    }
  };

  const handleDelete = async () => {
    if (!selectedAccount) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteInstituteAccount(selectedAccount.id);
      await fetchAccounts();
      setShowDeleteModal(false);
      setSelectedAccount(null);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete account' }));
    } finally {
      setDeleting(false);
    }
  };

  // The list endpoint has no `search` query param, so — same as the Mahallu
  // Finance accounts screen — the search box filters the page already loaded.
  const filteredAccounts = accounts.filter(
    (a) =>
      !searchQuery ||
      (a.accountName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.bankName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.accountNumber || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const stats = [
    {
      title: 'Total Accounts',
      value: pagination?.total || accounts.length,
      icon: <FiCreditCard className="h-5 w-5" />,
    },
    {
      title: 'Total Balance',
      value: `₹${accounts.reduce((sum, a) => sum + (a.balance || 0), 0).toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <PageHeader title="Institute Accounts" description="Manage institute bank accounts" />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={!userInstituteId}
          onRefresh={fetchAccounts}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={
            <Link to="/master-accounts/institute/create">
              <Button size="md" icon={<FiPlus />} collapseLabel>New Account</Button>
            </Link>
          }
        />
        {isFilterVisible && !userInstituteId && (
          <FilterPanel>
            <div className="w-full sm:w-64">
              <Select
                label="Institute"
                options={[
                  { value: 'all', label: 'All Institutes' },
                  ...institutes.map((i) => ({ value: i.id, label: toTitleCase(i.name) })),
                ]}
                value={instituteFilter}
                onChange={(e) => {
                  setInstituteFilter(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
          </FilterPanel>
        )}
        {loading ? (
          <PageSkeleton variant="section" />
        ) : error ? (
          <EmptyState
            variant="error"
            entity="institute accounts"
            description={error}
            action={{ label: 'Retry', onClick: fetchAccounts }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              striped
              columns={columns}
              data={filteredAccounts}
              emptyMessage="No institute accounts found"
              showExport={false}
            />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-4">
                <Pagination
                  currentPage={currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={itemsPerPage}
                  onPageChange={setCurrentPage}
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
          setSelectedAccount(null);
        }}
        title="Institute Account Details"
        footer={
          <Button
            variant="outline"
            onClick={() => {
              setShowViewModal(false);
              setSelectedAccount(null);
            }}
          >
            Close
          </Button>
        }
      >
        {selectedAccount && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Account Name</p>
              <p className="text-gray-900 dark:text-gray-100 font-medium">
                {toTitleCase((selectedAccount as any).accountName) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Institute</p>
              <p className="text-gray-900 dark:text-gray-100">
                {toTitleCase(
                  typeof selectedAccount.instituteId === 'object'
                    ? (selectedAccount.instituteId as any)?.name
                    : institutes.find((i) => i.id === selectedAccount.instituteId)?.name
                ) || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
              <p className="text-gray-900 dark:text-gray-100 capitalize">
                {selectedAccount.status || 'active'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Account Number</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedAccount.accountNumber || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Bank Name</p>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(selectedAccount.bankName) || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">IFSC Code</p>
              <p className="text-gray-900 dark:text-gray-100">{selectedAccount.ifscCode || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Balance</p>
              <p className="text-gray-900 dark:text-gray-100">
                ₹{(selectedAccount.balance || 0).toLocaleString()}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(selectedAccount.createdAt)}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedAccount(null);
        }}
        title="Edit Institute Account"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setSelectedAccount(null);
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
            label="Account Name"
            value={editForm.accountName}
            onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })}
          />
          <Input
            label="Account Number"
            value={editForm.accountNumber}
            onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })}
          />
          <Input
            label="Bank Name"
            value={editForm.bankName}
            onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })}
          />
          <Input
            label="IFSC Code"
            value={editForm.ifscCode}
            onChange={(e) => setEditForm({ ...editForm, ifscCode: e.target.value })}
          />
          <Input
            label="Balance"
            type="number"
            value={editForm.balance}
            onChange={(e) => setEditForm({ ...editForm, balance: parseFloat(e.target.value) || 0 })}
          />
          <Select
            label="Status"
            value={editForm.status}
            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedAccount(null);
        }}
        title="Delete Institute Account"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedAccount(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete
          <strong>{toTitleCase((selectedAccount as any)?.accountName) || selectedAccount?.accountNumber}</strong>? This
          action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
