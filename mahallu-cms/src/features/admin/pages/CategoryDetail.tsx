import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2, FiPlus, FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { TableColumn } from '@/types';
import { categoryService, Category, CategoryValue } from '@/services/categoryService';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
export default function CategoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [category, setCategory] = useState<Category | null>(null);
  const [values, setValues] = useState<CategoryValue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedValue, setSelectedValue] = useState<CategoryValue | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [addForm, setAddForm] = useState({ code: '', label: '', amount: '' });
  const [editForm, setEditForm] = useState({
    label: '',
    amount: '',
    status: 'active' as 'active' | 'inactive',
  });
  useEffect(() => {
    if (id) fetchData();
  }, [id]);
  const fetchData = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const [categoryData, valuesData] = await Promise.all([
        categoryService.getById(id),
        categoryService.getValues(id),
      ]);
      setCategory(categoryData);
      setValues(valuesData);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'category'));
    } finally {
      setLoading(false);
    }
  }; /** Only this category's values carry a money amount (see MasterCategory.amount). */
  const usesAmount = category?.key === 'varisangya_grade';
  const openEditModal = (value: CategoryValue) => {
    setSelectedValue(value);
    setEditForm({
      label: value.label,
      amount: value.amount == null ? '' : String(value.amount),
      status: value.status,
    });
    setFormError(null);
    setShowEditModal(true);
  };
  const handleAdd = async () => {
    if (!id) return;
    if (!addForm.code.trim() || !addForm.label.trim()) {
      setFormError('Code and label are required');
      return;
    }
    try {
      setSaving(true);
      setFormError(null);
      await categoryService.createValue(id, {
        code: addForm.code.trim(),
        label: addForm.label.trim(),
        ...(usesAmount && addForm.amount !== '' ? { amount: Number(addForm.amount) } : {}),
      });
      toast.success('Value added');
      setShowAddModal(false);
      setAddForm({ code: '', label: '', amount: '' });
      fetchData();
    } catch (err: any) {
      setFormError(errorMessage(err, { action: 'add value' }));
    } finally {
      setSaving(false);
    }
  };
  const handleEdit = async () => {
    if (!id || !selectedValue) return;
    try {
      setSaving(true);
      setFormError(null);
      const { amount, ...rest } = editForm;
      await categoryService.updateValue(id, selectedValue.id, {
        ...rest,
        ...(usesAmount && amount !== '' ? { amount: Number(amount) } : {}),
      });
      toast.success('Value updated');
      setShowEditModal(false);
      setSelectedValue(null);
      fetchData();
    } catch (err: any) {
      setFormError(errorMessage(err, { action: 'update value' }));
    } finally {
      setSaving(false);
    }
  };
  const handleToggleStatus = async (value: CategoryValue) => {
    if (!id) return;
    try {
      await categoryService.updateValue(id, value.id, {
        status: value.status === 'active' ? 'inactive' : 'active',
      });
      toast.success(value.status === 'active' ? 'Value deactivated' : 'Value activated');
      fetchData();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update value' }));
    }
  };
  const handleDelete = async () => {
    if (!id || !selectedValue) return;
    try {
      setDeleting(true);
      await categoryService.deleteValue(id, selectedValue.id);
      toast.success('Value deleted');
      setShowDeleteDialog(false);
      setSelectedValue(null);
      fetchData();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete value' }));
    } finally {
      setDeleting(false);
    }
  };
  const columns: TableColumn<CategoryValue>[] = [
    { key: 'label', label: 'Label', sortable: true },
    {
      key: 'code',
      label: 'Code',
      render: (v) => <code className="text-xs text-gray-500 dark:text-gray-400">{v}</code>,
    },
    ...(usesAmount
      ? [{ key: 'amount', label: 'Amount', render: (v: any) => (v == null ? '-' : `₹${v}`) }]
      : []),
    {
      key: 'status',
      label: 'Status',
      render: (v) => (
        <Badge variant={v === 'active' ? 'success' : 'secondary'} size="sm">
          {v}
        </Badge>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEditModal(row)}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            title="Edit"
            aria-label="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <Button variant="outline" size="sm" onClick={() => handleToggleStatus(row)}>
            {row.status === 'active' ? 'Deactivate' : 'Activate'}
          </Button>
          <button
            onClick={() => {
              setSelectedValue(row);
              setShowDeleteDialog(true);
            }}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
            title="Delete"
            aria-label="Delete"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];
  if (loading) {
    return <PageSkeleton />;
  }
  if (error || !category) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Category not found'}</p>
        <Button onClick={() => navigate('/admin/categories')} className="mt-4" variant="outline">
          <FiArrowLeft className="mr-2 h-4 w-4" /> Back to Categories
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <PageHeader
        title={category.name}
        description={category.description || `Manage values for the "${category.key}" category`}
        breadcrumbs={[{ label: 'Categories', path: '/admin/categories' }]}
      />
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant={category.status === 'active' ? 'success' : 'secondary'} size="sm">
              {category.status}
            </Badge>
            {category.isSystem && (
              <Badge variant="info" size="sm">
                Built-in
              </Badge>
            )}
          </div>
          <Button
            size="md"
            onClick={() => {
              setAddForm({ code: '', label: '', amount: '' });
              setFormError(null);
              setShowAddModal(true);
            }}
          >
            <FiPlus className="mr-1.5 h-4 w-4" /> Add Value
          </Button>
        </div>
        <Table columns={columns} data={values} emptyMessage="No values yet" showExport={false} />
      </Card>
      {/* Add Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={`Add ${category.name} Value`}
        footer={
          <>
            <Button variant="outline" onClick={() => setShowAddModal(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleAdd} isLoading={saving}>
              Add
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
            label="Label"
            value={addForm.label}
            onChange={(e) => setAddForm({ ...addForm, label: e.target.value })}
            placeholder="e.g. Diploma"
            required
          />
          <Input
            label="Code"
            value={addForm.code}
            onChange={(e) => setAddForm({ ...addForm, code: e.target.value })}
            placeholder="e.g. diploma"
            helperText="The stable value stored on records. Cannot be changed later."
            required
          />
          {usesAmount && (
            <Input
              label="Amount (₹)"
              type="number"
              min={0}
              value={addForm.amount}
              onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
              placeholder="e.g. 100"
              helperText="Monthly varisangya billed for this grade. Shared by every Mahallu."
            />
          )}
        </div>
      </Modal>
      {/* Edit Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setSelectedValue(null);
        }}
        title="Edit Value"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditModal(false);
                setSelectedValue(null);
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
            label="Label"
            value={editForm.label}
            onChange={(e) => setEditForm({ ...editForm, label: e.target.value })}
            required
          />
          {usesAmount && (
            <Input
              label="Amount (₹)"
              type="number"
              min={0}
              value={editForm.amount}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
              helperText="Monthly varisangya billed for this grade. Shared by every Mahallu."
            />
          )}
          <Input
            label="Code"
            value={selectedValue?.code || ''}
            disabled
            helperText="Code cannot be changed once created."
          />
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={showDeleteDialog}
        title="Delete Value"
        message={`Are you sure you want to delete "${selectedValue?.label}"?`}
        consequence="If this value is already used by existing records, deletion will be blocked — deactivate it instead."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setSelectedValue(null);
        }}
      />
    </div>
  );
}
