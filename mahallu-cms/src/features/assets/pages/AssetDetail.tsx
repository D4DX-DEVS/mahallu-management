import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiPlus, FiTrash2, FiTool } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Table from '@/components/ui/Table';
import { Asset, AssetMaintenance, TableColumn } from '@/types';
import { ROUTES } from '@/constants/routes';
import { assetService } from '@/services/assetService';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';
import {
  categoryLabels,
  statusLabels,
  statusColors,
  maintenanceStatusLabels,
  maintenanceStatusColors,
} from '../assetLabels';


export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Maintenance state
  const [maintenanceRecords, setMaintenanceRecords] = useState<AssetMaintenance[]>([]);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<AssetMaintenance | null>(null);
  const [showDeleteMaintenanceModal, setShowDeleteMaintenanceModal] = useState(false);
  const [selectedMaintenance, setSelectedMaintenance] = useState<AssetMaintenance | null>(null);
  const [maintenanceSubmitting, setMaintenanceSubmitting] = useState(false);
  const [deletingMaintenance, setDeletingMaintenance] = useState(false);

  // Maintenance form
  const [maintenanceForm, setMaintenanceForm] = useState({
    maintenanceDate: new Date().toISOString().split('T')[0],
    description: '',
    cost: '',
    performedBy: '',
    nextMaintenanceDate: '',
    status: 'scheduled' as string,
  });

  useEffect(() => {
    if (id) {
      fetchAsset();
      fetchMaintenanceRecords();
    }
  }, [id]);

  const fetchAsset = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await assetService.getById(id);
      setAsset(data);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to fetch asset');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceRecords = async () => {
    if (!id) return;
    try {
      setMaintenanceLoading(true);
      const result = await assetService.getMaintenanceRecords(id, { limit: 100 });
      setMaintenanceRecords(result.data);
    } catch (err: any) {
      console.error('Error fetching maintenance records:', err);
    } finally {
      setMaintenanceLoading(false);
    }
  };

  const resetMaintenanceForm = () => {
    setMaintenanceForm({
      maintenanceDate: new Date().toISOString().split('T')[0],
      description: '',
      cost: '',
      performedBy: '',
      nextMaintenanceDate: '',
      status: 'scheduled',
    });
    setEditingMaintenance(null);
  };

  const openAddMaintenance = () => {
    resetMaintenanceForm();
    setShowMaintenanceModal(true);
  };

  const openEditMaintenance = (record: AssetMaintenance) => {
    setEditingMaintenance(record);
    setMaintenanceForm({
      maintenanceDate: record.maintenanceDate ? new Date(record.maintenanceDate).toISOString().split('T')[0] : '',
      description: record.description || '',
      cost: record.cost ? String(record.cost) : '',
      performedBy: record.performedBy || '',
      nextMaintenanceDate: record.nextMaintenanceDate ? new Date(record.nextMaintenanceDate).toISOString().split('T')[0] : '',
      status: record.status || 'scheduled',
    });
    setShowMaintenanceModal(true);
  };

  const handleMaintenanceSubmit = async () => {
    if (!id || !maintenanceForm.description || !maintenanceForm.maintenanceDate) return;
    try {
      setMaintenanceSubmitting(true);
      const data: any = {
        maintenanceDate: maintenanceForm.maintenanceDate,
        description: maintenanceForm.description,
        status: maintenanceForm.status,
      };
      if (maintenanceForm.cost) data.cost = parseFloat(maintenanceForm.cost);
      if (maintenanceForm.performedBy) data.performedBy = maintenanceForm.performedBy;
      if (maintenanceForm.nextMaintenanceDate) data.nextMaintenanceDate = maintenanceForm.nextMaintenanceDate;

      if (editingMaintenance) {
        await assetService.updateMaintenance(id, editingMaintenance.id, data);
      } else {
        await assetService.createMaintenance(id, data);
      }
      setShowMaintenanceModal(false);
      resetMaintenanceForm();
      await fetchMaintenanceRecords();
    } catch (err: any) {
      console.error('Error saving maintenance record:', err);
      toast.error(err.response?.data?.message || 'Failed to save maintenance record');
    } finally {
      setMaintenanceSubmitting(false);
    }
  };

  const handleDeleteMaintenance = async () => {
    if (!id || !selectedMaintenance) return;
    try {
      setDeletingMaintenance(true);
      await assetService.deleteMaintenance(id, selectedMaintenance.id);
      toast.success('Maintenance record deleted');
      setShowDeleteMaintenanceModal(false);
      setSelectedMaintenance(null);
      await fetchMaintenanceRecords();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete maintenance record');
    } finally {
      setDeletingMaintenance(false);
    }
  };

  const maintenanceColumns: TableColumn<AssetMaintenance>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    {
      key: 'maintenanceDate',
      label: 'Date',
      render: (date) => formatDate(date),
    },
    { key: 'description', label: 'Description' },
    {
      key: 'cost',
      label: 'Cost (₹)',
      render: (cost) => cost ? cost.toLocaleString('en-IN') : '-',
    },
    { key: 'performedBy', label: 'Performed By', render: (val) => val || '-' },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <span className={`px-2 py-1 text-xs font-medium rounded-full ${maintenanceStatusColors[status] || 'bg-gray-100 text-gray-800'}`}>
          {maintenanceStatusLabels[status] || status}
        </span>
      ),
    },
    {
      key: 'nextMaintenanceDate',
      label: 'Next Due',
      render: (date) => date ? formatDate(date) : '-',
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (_, row) => (
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              openEditMaintenance(row);
            }}
            className="p-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
            title="Edit"
          >
            <FiEdit2 className="h-4 w-4" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSelectedMaintenance(row);
              setShowDeleteMaintenanceModal(true);
            }}
            className="p-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            title="Delete"
          >
            <FiTrash2 className="h-4 w-4" />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !asset) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Asset not found'}</p>
        <Link to={ROUTES.ASSETS.LIST} className="mt-4 inline-block">
          <Button variant="outline">Back to Assets</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{asset.name}</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Asset Details</p>
        </div>
        <div className="flex items-center gap-4">
          <Breadcrumb
            items={[
              { label: 'Dashboard', path: '/dashboard' },
              { label: 'Assets', path: ROUTES.ASSETS.LIST },
              { label: asset.name },
            ]}
          />
          <div className="flex gap-2">
            <Link to={ROUTES.ASSETS.LIST}>
              <Button variant="outline">
                <FiArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link to={ROUTES.ASSETS.EDIT(asset.id)}>
              <Button>
                <FiEdit2 className="h-4 w-4 mr-2" />
                Edit
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Asset Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{asset.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Category</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{categoryLabels[asset.category] || asset.category}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className="mt-1">
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusColors[asset.status] || 'bg-gray-100 text-gray-800'}`}>
                  {statusLabels[asset.status] || asset.status}
                </span>
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Purchase Date</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(asset.purchaseDate)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Value & Location</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Estimated Value</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100 text-lg font-semibold">
                ₹{asset.estimatedValue?.toLocaleString('en-IN') || '0'}
              </p>
            </div>
            {asset.location && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Location</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{asset.location}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Created At</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(asset.createdAt)}</p>
            </div>
            {asset.updatedAt && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Last Updated</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(asset.updatedAt)}</p>
              </div>
            )}
          </div>
        </Card>

        {asset.description && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Description</h2>
            <p className="text-gray-700 dark:text-gray-300">{asset.description}</p>
          </Card>
        )}
      </div>

      {/* Maintenance Records Section */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiTool className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Maintenance Records</h2>
            <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
              {maintenanceRecords.length}
            </span>
          </div>
          <Button size="md" onClick={openAddMaintenance}>
            <FiPlus className="h-4 w-4 mr-2" />
            Add Record
          </Button>
        </div>

        {maintenanceLoading ? (
          <div className="flex justify-center items-center py-8">
            <LoadingSpinner />
          </div>
        ) : (
          <Table
            columns={maintenanceColumns}
            data={maintenanceRecords}
            emptyMessage="No maintenance records found"
            showExport={false}
          />
        )}
      </Card>

      {/* Add/Edit Maintenance Modal */}
      <Modal
        isOpen={showMaintenanceModal}
        onClose={() => {
          setShowMaintenanceModal(false);
          resetMaintenanceForm();
        }}
        title={editingMaintenance ? 'Edit Maintenance Record' : 'Add Maintenance Record'}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowMaintenanceModal(false);
                resetMaintenanceForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleMaintenanceSubmit}
              isLoading={maintenanceSubmitting}
              disabled={!maintenanceForm.description || !maintenanceForm.maintenanceDate}
            >
              {editingMaintenance ? 'Update' : 'Add Record'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Maintenance Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={maintenanceForm.maintenanceDate}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceDate: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Describe the maintenance work..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maintenanceForm.cost}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Performed By</label>
              <input
                type="text"
                value={maintenanceForm.performedBy}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performedBy: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Service provider name"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Status</label>
              <select
                value={maintenanceForm.status}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Maintenance Date</label>
              <input
                type="date"
                value={maintenanceForm.nextMaintenanceDate}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextMaintenanceDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Maintenance Confirmation Modal */}
      <Modal
        isOpen={showDeleteMaintenanceModal}
        onClose={() => {
          setShowDeleteMaintenanceModal(false);
          setSelectedMaintenance(null);
        }}
        title="Delete Maintenance Record"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteMaintenanceModal(false);
                setSelectedMaintenance(null);
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDeleteMaintenance} isLoading={deletingMaintenance}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete this maintenance record? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
