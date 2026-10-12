import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiPlus, FiTool } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import StatusBadge from '@/components/ui/StatusBadge';
import RowActions from '@/components/ui/RowActions';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import Badge from '@/components/ui/Badge';
import Tabs from '@/components/ui/Tabs';
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
import { getFriendlyError } from '@/utils/apiMessages';
import {
  categoryLabels,
  statusLabels,
  statusTones,
  maintenanceStatusLabels,
  maintenanceStatusTones,
} from '../assetLabels';
import { controlClasses, labelClasses } from '@/components/ui/Input';
import DateInput from '@/components/ui/DateInput';


export default function AssetDetail() {
  const { id } = useParams<{ id: string }>();
  const [asset, setAsset] = useState<Asset | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('overview');
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
      setError(getFriendlyError(err, "Couldn't load asset. Refresh the page or try again."));
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
      toast.error(getFriendlyError(err, "Couldn't save maintenance record. Check the details and try again."));
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
      toast.error(getFriendlyError(err, "Couldn't delete maintenance record. Try again in a moment."));
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
    { key: 'performedBy', label: 'Performed By', render: (val) => (val ? <PersonCell name={val} size={24} /> : '-') },
    {
      key: 'status',
      label: 'Status',
      render: (status) => (
        <StatusBadge status={status} tone={maintenanceStatusTones[status] ?? 'neutral'} label={maintenanceStatusLabels[status] || status} />
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
        <RowActions
          onEdit={() => openEditMaintenance(row)}
          onDelete={() => {
            setSelectedMaintenance(row);
            setShowDeleteMaintenanceModal(true);
          }}
          deleteLabel="Delete"
          ariaLabels={{ edit: 'Edit maintenance record', delete: 'Delete maintenance record' }}
        />
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
          <Button variant="secondary">Back to Assets</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <PageHeader
        title={asset.name}
        leading={<Avatar size={56} name={asset.name} />}
        description="Asset Details"
        actions={
          <>
            <Link to={ROUTES.ASSETS.LIST}>
              <Button variant="secondary">
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
            <Link to={ROUTES.ASSETS.EDIT(asset.id)}>
              <Button>
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <Tabs
        aria-label="Asset sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'maintenance', label: 'Maintenance records', count: maintenanceRecords.length },
        ]}
      />

      {/* Asset Info */}
      {tab === 'overview' && (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Name</label>
              <div className="mt-0.5"><PersonCell name={asset.name} size={24} /></div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Category</label>
              <p className="mt-1 text-[#18231E] dark:text-surface-text">{categoryLabels[asset.category] || asset.category}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Status</label>
              <p className="mt-1">
                <StatusBadge status={asset.status} tone={statusTones[asset.status] ?? 'neutral'} label={statusLabels[asset.status] || asset.status} />
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Purchase Date</label>
              <p className="mt-1 text-[#18231E] dark:text-surface-text">{formatDate(asset.purchaseDate)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Value & Location</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Estimated Value</label>
              <p className="mt-1 text-[#18231E] dark:text-surface-text text-lg font-semibold">
                ₹{asset.estimatedValue?.toLocaleString('en-IN') || '0'}
              </p>
            </div>
            {asset.location && (
              <div>
                <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Location</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">{asset.location}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Created At</label>
              <p className="mt-1 text-[#18231E] dark:text-surface-text">{formatDate(asset.createdAt)}</p>
            </div>
            {asset.updatedAt && (
              <div>
                <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Last Updated</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">{formatDate(asset.updatedAt)}</p>
              </div>
            )}
          </div>
        </Card>

        {asset.description && (
          <Card className="md:col-span-2">
            <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Description</h2>
            <p className="text-[#3A4741] dark:text-surface-text">{asset.description}</p>
          </Card>
        )}
      </div>
      )}

      {/* Maintenance Records Section */}
      {tab === 'maintenance' && (
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FiTool className="h-4 w-4 text-[#5B6963] dark:text-surface-muted" />
            <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">Maintenance Records</h2>
            <Badge variant="neutral" size="sm">
              {maintenanceRecords.length}
            </Badge>
          </div>
          <Button onClick={openAddMaintenance}>
            <FiPlus className="h-3.5 w-3.5" />
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
      )}

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
              variant="secondary"
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
            <label className={labelClasses}>
              Maintenance Date <span className="text-red-500">*</span>
            </label>
            <DateInput
              value={maintenanceForm.maintenanceDate}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, maintenanceDate: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClasses}>
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, description: e.target.value })}
              rows={3}
              className={`${controlClasses} py-2`}
              placeholder="Describe the maintenance work..."
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClasses}>Cost (₹)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={maintenanceForm.cost}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, cost: e.target.value })}
                className={`${controlClasses} h-9`}
                placeholder="0"
              />
            </div>
            <div>
              <label className={labelClasses}>Performed By</label>
              <input
                type="text"
                value={maintenanceForm.performedBy}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, performedBy: e.target.value })}
                className={`${controlClasses} h-9`}
                placeholder="Service provider name"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClasses}>Status</label>
              <select
                value={maintenanceForm.status}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, status: e.target.value })}
                className={`${controlClasses} h-9`}
              >
                <option value="scheduled">Scheduled</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            <div>
              <label className={labelClasses}>Next Maintenance Date</label>
              <DateInput
                value={maintenanceForm.nextMaintenanceDate}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, nextMaintenanceDate: e.target.value })}
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
        title="Delete maintenance record?"
        footer={
          <>
            <Button
              variant="secondary"
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
        <p className="text-[#5B6963] dark:text-surface-muted">
          Delete this maintenance record? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
