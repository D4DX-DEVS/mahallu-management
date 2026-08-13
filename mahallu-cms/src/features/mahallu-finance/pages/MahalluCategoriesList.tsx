import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiList } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Category } from '@/services/masterAccountService';
import { formatDate } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';

export default function MahalluCategoriesList() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [deleting, setDeleting] = useState(false);
  const itemsPerPage = 10;

  useEffect(() => { fetchCategories(); }, [currentPage]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await masterAccountService.getAllCategories({ page: currentPage, limit: itemsPerPage, scope: 'mahallu' });
      setCategories(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch categories');
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    try {
      setDeleting(true);
      await masterAccountService.deleteCategory(selected.id);
      setShowDeleteModal(false);
      fetchCategories();
      toast.success('Category deleted');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete category');
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const result = await masterAccountService.getAllCategories({ limit: 10000, scope: 'mahallu' });
      const data = Array.isArray(result.data) ? result.data : [];
      if (!data.length) { toast.info('No categories to export'); return; }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-categories');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-categories');
      else exportToPDF(columns, data, 'mahallu-categories', 'Mahallu Categories');
    } catch (err: any) { toast.error(err?.message || 'Failed to export categories'); }
    finally { setIsExporting(false); }
  };

  const filtered = categories.filter(c => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase()));

  const columns: TableColumn<Category>[] = [
    { key: 'id', label: 'No.', render: (_, __, i) => i + 1 },
    { key: 'name', label: 'Name' },
    { key: 'type', label: 'Type', render: (t) => (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${t === 'income' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{t}</span>
    )},
    { key: 'description', label: 'Description' },
    { key: 'createdAt', label: 'Created', render: (d) => formatDate(d) },
    { key: 'actions', label: 'Actions', render: (_, row) => (
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES_EDIT(row.id), { state: { category: row } })} className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600"><FiEdit2 className="h-4 w-4" /></button>
        <button onClick={() => { setSelected(row); setShowDeleteModal(true); }} className="p-1.5 rounded-md hover:bg-red-50 text-red-600"><FiTrash2 className="h-4 w-4" /></button>
      </div>
    )},
  ];


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Mahallu Categories</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Income and expense categories for the Mahallu</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Mahallu Finance', path: '/mahallu-finance/accounts' }, { label: 'Categories' }]} />
      </div>

      <Card>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onExport={handleExport}
          isExporting={isExporting}
          actionButtons={<Button onClick={() => navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES_CREATE)} size="sm"><FiList className="h-4 w-4 mr-2" />Add Category</Button>}
        />
        {loading ? <div className="flex justify-center py-12"><LoadingSpinner /></div>
          : error ? <p className="text-center py-8 text-red-600">{error}</p>
          : <>
            <Table columns={columns} data={filtered} emptyMessage="No categories found" />
            {pagination && <Pagination currentPage={currentPage} totalPages={pagination.totalPages || 1} totalItems={pagination.total || 0} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />}
          </>}
      </Card>

      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Delete Category">
        <p className="text-gray-600 dark:text-gray-400 mb-6">Delete category <strong>{selected?.name}</strong>?</p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>{deleting ? 'Deleting...' : 'Delete'}</Button>
        </div>
      </Modal>
    </div>
  );
}
