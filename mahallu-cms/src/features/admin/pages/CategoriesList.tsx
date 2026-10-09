import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiEdit2, FiLock, FiPlus, FiTag, FiTrash2 } from 'react-icons/fi';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import StatCard from '@/components/ui/StatCard';
import Table from '@/components/ui/Table';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import TableToolbar from '@/components/ui/TableToolbar';
import { TableColumn, Pagination as PaginationType } from '@/types';
import { categoryService, Category } from '@/services/categoryService';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { toTitleCase } from '@/utils/format';
export default function CategoriesList() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [pagination, setPagination] = useState<PaginationType | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ key: '', name: '', description: '' });
  const [editForm, setEditForm] = useState({
    name: '',
    description: '',
    status: 'active' as 'active' | 'inactive',
  });
  const debouncedSearch = useDebounce(searchQuery, 400);
  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);
  useEffect(() => {
    fetchCategories();
  }, [debouncedSearch, currentPage, itemsPerPage]);
  const fetchCategories = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = { page: currentPage, limit: itemsPerPage };
      if (debouncedSearch) params.search = debouncedSearch;
      const result = await categoryService.getAll(params);
      setCategories(result.data || []);
      setPagination(result.pagination);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'categories'));
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };
  const openEditModal = (category: Category) => {
    setSelectedCategory(category);
    setEditForm({ name: category.name, description: category.description || '', status: category.status });
    setFormError(null);
    setShowEditModal(true);
  };
  const handleCreate = async () => {
    if (!createForm.key.trim() || !createForm.name.trim()) {
      setFormError('Key and name are required');
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      await categoryService.create({
        key: createForm.key.trim().toLowerCase().replace(/\s+/g, '_'),
        name: createForm.name.trim(),
        description: createForm.description.trim() || undefined,
      });
      toast.success('Category created');
      setShowCreateModal(false);
      setCreateForm({ key: '', name: '', description: '' });
      fetchCategories();
    } catch (err: any) {
      setFormError(errorMessage(err, { action: 'create category' }));
    } finally {
      setSaving(false);
    }
  };
  const handleEdit = async () => {
    if (!selectedCategory) return;
    try {
      setSaving(true);
      setFormError(null);
      await categoryService.update(selectedCategory.id, editForm);
      toast.success('Category updated');
      setShowEditModal(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (err: any) {
      setFormError(errorMessage(err, { action: 'update category' }));
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async () => {
    if (!selectedCategory) return;
    try {
      setDeleting(true);
      await categoryService.delete(selectedCategory.id);
      toast.success('Category deleted');
      setShowDeleteDialog(false);
      setSelectedCategory(null);
      fetchCategories();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete category' }));
    } finally {
      setDeleting(false);
    }
  };
  const columns: TableColumn<Category>[] = [
    {
      key: 'name',
      label: 'Name',
      width: '16rem',
      sortable: true,
      render: (value) => <span className="font-medium text-foreground">{toTitleCase(value)}</span>,
    },
    {
      key: 'key', priority: 'secondary',
      label: 'Key',
      width: '12rem',
      render: (v) => <code className="text-xs text-gray-500 dark:text-gray-400">{v}</code>,
    },
    { key: 'valueCount', label: 'Values', width: '8rem', render: (v) => v ?? 0 },
    {
      key: 'isSystem',
      label: 'System',
      width: '9rem',
      render: (v) =>
        v ? (
          <Badge variant="info" size="sm">
            <FiLock className="mr-1 h-3 w-3" /> System
          </Badge>
        ) : (
          <Badge variant="secondary" size="sm">
            Custom
          </Badge>
        ),
    },
    {
      key: 'status',
      label: 'Status',
      width: '8rem',
      render: (v) => (
        <Badge variant={v === 'active' ? 'success' : 'secondary'} size="sm">
          {v}
        </Badge>
      ),
    },
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
            { label: 'Edit', icon: <FiEdit2 className="h-4 w-4" />, onClick: () => openEditModal(row) },
            {
              label: 'Delete',
              icon: <FiTrash2 className="h-4 w-4" />,
              onClick: () => {
                setSelectedCategory(row);
                setShowDeleteDialog(true);
              },
              variant: 'danger',
              disabled: row.isSystem,
              disabledReason: 'System categories cannot be deleted',
            },
          ]}
        />
      ),
    },
  ];
  const isFiltered = Boolean(debouncedSearch);

  return (
    <>
      <PageHeader
        title="Categories"
        description="Manage the dropdown and master-data values used across the system."
        actions={
          <Button
             
            onClick={() => {
              setCreateForm({ key: '', name: '', description: '' });
              setFormError(null);
              setShowCreateModal(true);
            }}
            icon={<FiPlus />}
            collapseLabel
          >
            New category
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3">
        <StatCard
          title="Total categories"
          value={pagination?.total ?? categories.length}
          icon={<FiTag className="h-5 w-5" />}
        />
      </div>

      <TableCard>
        <TableToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchEntity="categories"
          onRefresh={fetchCategories}
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
              data={categories}
              isLoading={loading}
              entity="categories"
              emptyVariant={isFiltered ? 'no-results' : 'empty'}
              emptyAction={
                isFiltered
                  ? { label: 'Clear filters', onClick: () => { setSearchQuery(''); } }
                  : { label: 'Add category', onClick: () => { setCreateForm({ key: '', name: '', description: '' }); setFormError(null); setShowCreateModal(true); } }
              }
              onRowClick={(row) => navigate(`/admin/categories/${row.id}`)}
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
      {/* Create Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Category"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowCreateModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleCreate} isLoading={saving}>
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {formError}
            </div>
          )}
          <Input
            label="Name"
            value={createForm.name}
            onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            placeholder="e.g. Vehicle Type"
            required
          />
          <Input
            label="Key"
            value={createForm.key}
            onChange={(e) => setCreateForm({ ...createForm, key: e.target.value })}
            placeholder="e.g. vehicle_type"
            helperText="Lowercase letters, numbers and underscores only. Cannot be changed later."
            required
          />
          <Input
            label="Description"
            value={createForm.description}
            onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
          />
        </div>
      </Modal>
      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedCategory(null);
        }}
        title="Edit Category"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setSelectedCategory(null);
              }}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} isLoading={saving}>
              Save Changes
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {formError}
            </div>
          )}
          <Input
            label="Name"
            value={editForm.name}
            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            required
          />
          <Input
            label="Key"
            value={selectedCategory?.key || ''}
            disabled
            helperText="Key cannot be changed once created."
          />
          <Input
            label="Description"
            value={editForm.description}
            onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
          />
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Category"
        message={`Are you sure you want to delete "${toTitleCase(selectedCategory?.name)}"? All of its values will be deleted too.`}
        consequence="This only applies to custom categories — built-in categories cannot be deleted."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedCategory(null);
        }}
      />
    </>
  );
}
