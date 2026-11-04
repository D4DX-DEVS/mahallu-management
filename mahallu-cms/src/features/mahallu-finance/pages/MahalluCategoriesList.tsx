import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import ActionsMenu from '@/components/ui/ActionsMenu';
import Button from '@/components/ui/Button';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import Badge from '@/components/ui/Badge';
import EmptyState from '@/components/ui/EmptyState';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { masterAccountService, Category } from '@/services/masterAccountService';
import { formatDate, toTitleCase } from '@/utils/format';
import { exportToCSV, exportToJSON, exportToPDF } from '@/utils/exportUtils';
import { ROUTES } from '@/constants/routes';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { fetchAllPages } from '@/services/api';

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
  const [itemsPerPage, setItemsPerPage] = useState(25);

  useEffect(() => {
    fetchCategories();
  }, [currentPage, itemsPerPage]);

  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await masterAccountService.getAllCategories({
        page: currentPage,
        limit: itemsPerPage,
        scope: 'mahallu',
      });
      setCategories(Array.isArray(result.data) ? result.data : []);
      if (result.pagination) setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'categories'));
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
      toast.error(errorMessage(err, { action: 'delete category' }));
    } finally {
      setDeleting(false);
    }
  };

  const handleExport = async (type: 'csv' | 'json' | 'pdf') => {
    try {
      setIsExporting(true);
      const allRows = await fetchAllPages((page) => masterAccountService.getAllCategories({ ...page, scope: 'mahallu' }));
      const data = Array.isArray(allRows) ? allRows : [];
      if (!data.length) {
        toast.info('No categories to export');
        return;
      }
      if (type === 'csv') exportToCSV(columns, data, 'mahallu-categories');
      else if (type === 'json') exportToJSON(columns, data, 'mahallu-categories');
      else await exportToPDF(columns, data, 'mahallu-categories', 'Mahallu Categories');
    } catch (err: any) {
      toast.error(err?.message || "Couldn't export categories");
    } finally {
      setIsExporting(false);
    }
  };

  const filtered = categories.filter(
    (c) => !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const columns: TableColumn<Category>[] = [
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
                navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES_EDIT(row.id), { state: { category: row } }),
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

  const openEditPage = (row: Category) =>
    navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES_EDIT(row.id), { state: { category: row } });

  const isFiltered = Boolean(searchQuery);

  return (
    <>
      <PageHeader
        title="Mahallu categories"
        description="Income and expense categories for the mahallu."
        actions={
          <Button icon={<FiPlus />} collapseLabel onClick={() => navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES_CREATE)}>
            Add category
          </Button>
        }
      />


      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="categories"
          onRefresh={fetchCategories}
          onExport={handleExport}
          isExporting={isExporting}
        />
        {error ? (
          <EmptyState
            variant="error"
            entity="categories"
            description={error}
            action={{ label: 'Try again', onClick: fetchCategories }}
          />
        ) : (
          <>
            <Table
              fixedLayout
              columns={columns}
              data={filtered}
              isLoading={loading}
              entity="categories"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); setCurrentPage(1); } }
                  : { label: 'Add category', onClick: () => navigate(ROUTES.MAHALLU_FINANCE.CATEGORIES_CREATE) }
              }
              onRowClick={openEditPage}
            />

            {pagination && (
              <div className="mt-4">
                <Pagination
                  currentPage={pagination.page}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.total}
                  itemsPerPage={pagination.limit}
                  entity="categories"
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
        title={`Delete ${toTitleCase(selected?.name) || 'this category'}?`}
        message="This permanently removes the category and cannot be undone."
        confirmLabel="Delete category"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteModal(false)}
      />
    </>
  );
}
