import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiCreditCard, FiDollarSign, FiEdit2, FiTrash2 } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, InstituteAccount } from '@/services/masterAccountService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { toast } from '@/store/toastStore';

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
  const [deleting, setDeleting] = useState(false);
  const [editForm, setEditForm] = useState({ accountName: '', accountNumber: '', bankName: '', ifscCode: '', balance: 0, status: 'active' as 'active' | 'inactive' });

  useEffect(() => {
    if (!userInstituteId) {
      instituteService.getAll({ limit: 1000 }).then(r => setInstitutes(r.data.map((i: any) => ({ id: i.id, name: i.name })))).catch(() => {});
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
      setError(err.response?.data?.message || 'Failed to fetch institute accounts');
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
      if (dataToExport.length === 0) { toast.info('No institute accounts to export'); return; }
      const filename = 'institute-accounts';
      const title = 'Institute Accounts';
      switch (type) {
        case 'csv': exportToCSV(columns, dataToExport, filename); break;
        case 'json': exportToJSON(columns, dataToExport, filename); break;
        case 'pdf': exportToPDF(columns, dataToExport, filename, title); break;
      }
    } catch (error: any) {
      console.error('Export error:', error);
      toast.error(error?.message || 'Failed to export institute accounts');
    } finally {
      setIsExporting(false);
    }
  };

  const columns: TableColumn<InstituteAccount>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'bankName', label: 'Bank Name' },
    { key: 'ifscCode', label: 'IFSC Code' },
    {
      key: 'balance',
      label: 'Balance',
      render: (balance) => `₹${balance?.toLocaleString() || 0}`,
    },
    {
      key: 'createdAt',
      label: 'Created',
      render: (date) => formatDate(date),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => openEditModal(row)} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400" title="Edit">
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button onClick={() => { setSelectedAccount(row); setShowDeleteModal(true); }} className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400" title="Delete">
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
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
      setError(err.response?.data?.message || 'Failed to update account');
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
      setError(err.response?.data?.message || 'Failed to delete account');
    } finally {
      setDeleting(false);
    }
  };

  const stats = [
    { title: 'Total Accounts', value: pagination?.total || accounts.length, icon: <FiCreditCard className="h-5 w-5" /> },
    {
      title: 'Total Balance',
      value: `₹${accounts.reduce((sum, a) => sum + (a.balance || 0), 0).toLocaleString()}`,
      icon: <FiDollarSign className="h-5 w-5" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">Institute Accounts</h1>
            <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">Manage institute bank accounts</p>
          </div>
          <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Institute Accounts' }]} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onFilterClick={() => setIsFilterVisible(!isFilterVisible)}
          isFilterVisible={isFilterVisible}
          hasFilters={!userInstituteId}
          onRefresh={fetchAccounts}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={<Link to="/master-accounts/institute/create"><Button size="md">+ New Account</Button></Link>}
        />
        {isFilterVisible && !userInstituteId && (
          <div className="flex flex-wrap items-center gap-4 mb-6 p-4 border border-gray-200 rounded-lg bg-white dark:bg-gray-800 dark:border-gray-700">
            <div className="w-64">
              <Select
                label="Institute"
                options={[{ value: 'all', label: 'All Institutes' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                value={instituteFilter}
                onChange={(e) => setInstituteFilter(e.target.value)}
              />
            </div>
          </div>
        )}
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-red-600 dark:text-red-400">{error}</p>
            <Button onClick={fetchAccounts} className="mt-4" variant="outline">
              Retry
            </Button>
          </div>
        ) : (
          <>
            <Table columns={columns} data={accounts} emptyMessage="No institute accounts found" showExport={false} />
            {pagination && pagination.totalPages > 1 && (
              <div className="mt-6">
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
      </Card>

      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setSelectedAccount(null); }}
        title="Edit Institute Account"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowEditModal(false); setSelectedAccount(null); }}>Cancel</Button>
            <Button onClick={handleEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input label="Account Name" value={editForm.accountName} onChange={(e) => setEditForm({ ...editForm, accountName: e.target.value })} />
          <Input label="Account Number" value={editForm.accountNumber} onChange={(e) => setEditForm({ ...editForm, accountNumber: e.target.value })} />
          <Input label="Bank Name" value={editForm.bankName} onChange={(e) => setEditForm({ ...editForm, bankName: e.target.value })} />
          <Input label="IFSC Code" value={editForm.ifscCode} onChange={(e) => setEditForm({ ...editForm, ifscCode: e.target.value })} />
          <Input label="Balance" type="number" value={editForm.balance} onChange={(e) => setEditForm({ ...editForm, balance: parseFloat(e.target.value) || 0 })} />
          <Select label="Status" value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as 'active' | 'inactive' })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setSelectedAccount(null); }}
        title="Delete Institute Account"
        footer={
          <>
            <Button variant="outline" onClick={() => { setShowDeleteModal(false); setSelectedAccount(null); }}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>Delete</Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{(selectedAccount as any)?.accountName || selectedAccount?.accountNumber}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}

