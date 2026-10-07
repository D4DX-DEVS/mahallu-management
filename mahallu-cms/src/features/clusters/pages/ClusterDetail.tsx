import { useState, useEffect } from 'react';
import ActionsMenu from '@/components/ui/ActionsMenu';
import { FiUserMinus, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Checkbox from '@/components/ui/Checkbox';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { Pagination as PaginationType, TableColumn } from '@/types';
import { clusterService, clusterVisitService, Cluster, ClusterVisit } from '@/services/clusterService';
import { familyService } from '@/services/familyService';
import { useDebounce } from '@/hooks/useDebounce';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import { ROUTES } from '@/constants/routes';

type Tab = 'families' | 'visits';

const emptyVisit = {
  familyId: '',
  visitDate: '',
  visitedBy: '',
  notes: '',
  issuesFound: '',
  followUpNeeded: false,
};

export default function ClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [tab, setTab] = useState<Tab>('families');
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', nameMl: '', code: '', notes: '' });
  const [editNameError, setEditNameError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const [families, setFamilies] = useState<any[]>([]);
  const [familyPage, setFamilyPage] = useState(1);
  const [familyPagination, setFamilyPagination] = useState<PaginationType | null>(null);

  const [visits, setVisits] = useState<ClusterVisit[]>([]);
  const [visitPage, setVisitPage] = useState(1);
  const [visitPagination, setVisitPagination] = useState<PaginationType | null>(null);

  const [isAssignOpen, setAssignOpen] = useState(false);
  const [assignSearch, setAssignSearch] = useState('');
  const [assignCandidates, setAssignCandidates] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [isVisitOpen, setVisitOpen] = useState(false);
  const [visitForm, setVisitForm] = useState(emptyVisit);
  const [confirmUnassign, setConfirmUnassign] = useState(false);
  const [unassignFamilyId, setUnassignFamilyId] = useState<string | null>(null);

  const debouncedAssignSearch = useDebounce(assignSearch, 500);

  useEffect(() => {
    if (!id) return;
    clusterService
      .getById(id)
      .then(setCluster)
      .catch(() => setCluster(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    clusterService
      .getFamilies(id, { page: familyPage, limit: 10 })
      .then((result) => {
        setFamilies(result.data);
        setFamilyPagination(result.pagination);
      })
      .catch(() => setFamilies([]));
  }, [id, familyPage]);

  useEffect(() => {
    if (!id) return;
    clusterVisitService
      .getAll({ clusterId: id, page: visitPage, limit: 10 })
      .then((result) => {
        setVisits(result.data);
        setVisitPagination(result.pagination);
      })
      .catch(() => setVisits([]));
  }, [id, visitPage]);

  useEffect(() => {
    if (!isAssignOpen) return;
    familyService
      .getAll({ page: 1, limit: 20, search: debouncedAssignSearch || undefined })
      .then((result) => setAssignCandidates(result.data))
      .catch(() => setAssignCandidates([]));
  }, [isAssignOpen, debouncedAssignSearch]);

  const reloadFamilies = async () => {
    if (!id) return;
    const result = await clusterService.getFamilies(id, { page: familyPage, limit: 10 });
    setFamilies(result.data);
    setFamilyPagination(result.pagination);
    const fresh = await clusterService.getById(id);
    setCluster(fresh);
  };

  const handleAssign = async () => {
    if (!id || selectedIds.length === 0) return;
    try {
      setSaving(true);
      await clusterService.assignFamilies(id, selectedIds);
      setAssignOpen(false);
      setSelectedIds([]);
      toast.success('Families assigned');
      await reloadFamilies();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'assign families' }));
    } finally {
      setSaving(false);
    }
  };

  const handleUnassign = async () => {
    if (!id || !unassignFamilyId) return;
    try {
      await clusterService.unassignFamily(id, unassignFamilyId);
      toast.success('Family removed from cluster');
      setConfirmUnassign(false);
      setUnassignFamilyId(null);
      await reloadFamilies();
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'remove family' }));
      setConfirmUnassign(false);
      setUnassignFamilyId(null);
    }
  };

  const handleCreateVisit = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await clusterVisitService.create({
        clusterId: id,
        familyId: visitForm.familyId || undefined,
        visitDate: visitForm.visitDate || new Date().toISOString(),
        visitedBy: visitForm.visitedBy,
        notes: visitForm.notes,
        issuesFound: visitForm.issuesFound,
        followUpNeeded: visitForm.followUpNeeded,
      });
      setVisitOpen(false);
      setVisitForm(emptyVisit);
      const result = await clusterVisitService.getAll({ clusterId: id, page: 1, limit: 10 });
      setVisits(result.data);
      setVisitPagination(result.pagination);
      setVisitPage(1);
      toast.success('Visit recorded');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'record visit' }));
    } finally {
      setSaving(false);
    }
  };

  const openEdit = () => {
    if (!cluster) return;
    setEditForm({
      name: cluster.name || '',
      nameMl: (cluster as any).nameMl || '',
      code: cluster.code || '',
      notes: (cluster as any).notes || '',
    });
    setEditNameError(null);
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!id) return;
    if (!editForm.name.trim()) {
      setEditNameError('Cluster name is required');
      return;
    }
    try {
      setEditSaving(true);
      const updated = await clusterService.update(id, editForm);
      setCluster(updated);
      setEditOpen(false);
      toast.success('Cluster updated');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update cluster' }));
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await clusterService.remove(id);
      navigate('/clusters');
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'delete cluster' }));
      setDeleting(false);
    }
  };

  const familyColumns: TableColumn<any>[] = [
    {
      key: 'houseName',
      label: 'House Name',
      width: '9.75rem',
      render: (v) => <span>{toTitleCase(v)}</span>,
    },
    {
      key: 'familyHead',
      label: 'Family Head',
      width: '9.75rem',
      render: (v) => <span>{v ? toTitleCase(v) : '-'}</span>,
    },
    { key: 'contactNo', label: 'Contact', width: '7.75rem', render: (v) => v || '-' },
    {
      key: 'actions',
      label: 'Actions',
      width: '8rem',
      align: 'center',
      render: (_v, row) => (
        <ActionsMenu
          items={[
            {
              label: 'Remove from cluster',
              icon: <FiUserMinus className="h-4 w-4" />,
              onClick: () => {
                setUnassignFamilyId(row._id || row.id);
                setConfirmUnassign(true);
              },
              variant: 'danger' as const,
            },
          ]}
        />
      ),
    },
  ];

  const visitColumns: TableColumn<ClusterVisit>[] = [
    { key: 'visitDate', label: 'Date', width: '6.25rem', render: (v) => (v ? new Date(v).toLocaleDateString() : '-') },
    {
      key: 'familyId',
      label: 'Family',
      width: '7.25rem',
      render: (v) => <span>{typeof v === 'object' && v ? toTitleCase(v.houseName) : '-'}</span>,
    },
    {
      key: 'visitedBy',
      label: 'Visited By',
      width: '9rem',
      render: (v) => <span>{v ? toTitleCase(v) : '-'}</span>,
    },
    { key: 'issuesFound', label: 'Issues', width: '7.25rem', render: (v) => v || '-' },
    { key: 'followUpNeeded', label: 'Follow-up', width: '8.75rem', render: (v) => (v ? 'Yes' : 'No') },
  ];

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (!cluster) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">Cluster not found</p>
        <Link to="/clusters">
          <Button variant="outline" className="mt-4">
            Back to clusters
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            title={toTitleCase(cluster.name)}
            description={`${cluster.familyCount ?? 0} families${cluster.code ? ` · ${cluster.code}` : ''}`}
            breadcrumbs={[{ label: 'Clusters', path: '/clusters' }]}
          />
          <div className="flex gap-2 items-center">
            <Button variant="outline" onClick={openEdit} icon={<FiEdit2 />} collapseLabel>
              Edit
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>
              Delete
            </Button>
          </div>
        </div>
      </div>

      {((cluster as any).nameMl || (cluster as any).notes) && (
        <Card>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {(cluster as any).nameMl && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Name (Malayalam)</span>
                <p className="text-gray-900 dark:text-gray-100 font-malayalam">{(cluster as any).nameMl}</p>
              </div>
            )}
            {(cluster as any).notes && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Notes</span>
                <p className="text-gray-900 dark:text-gray-100">{(cluster as any).notes}</p>
              </div>
            )}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setTab('families')}
          className={[
            'rounded-xl border px-3 py-2 text-xs font-medium sm:text-sm',
            tab === 'families'
              ? 'border-primary-300 bg-primary-50 text-primary-900'
              : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
          ].join(' ')}
        >
          Families
        </button>
        <button
          onClick={() => setTab('visits')}
          className={[
            'rounded-xl border px-3 py-2 text-xs font-medium sm:text-sm',
            tab === 'visits'
              ? 'border-primary-300 bg-primary-50 text-primary-900'
              : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
          ].join(' ')}
        >
          Visits
        </button>
      </div>

      {tab === 'families' ? (
        <TableCard>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {familyPagination?.total ?? 0} assigned
            </p>
            <Button size="md" onClick={() => setAssignOpen(true)}>
              + Assign Families
            </Button>
          </div>
          <Table
            fixedLayout
            striped
            columns={familyColumns}
            data={families}
            emptyMessage="No families assigned yet"
            showExport={false}
            onRowClick={(row) => navigate(ROUTES.FAMILIES.DETAIL(row._id || row.id))}
          />
          {familyPagination && (
            <div className="mt-4">
              <Pagination
                currentPage={familyPagination.page}
                totalPages={familyPagination.totalPages}
                totalItems={familyPagination.total}
                itemsPerPage={familyPagination.limit}
                onPageChange={setFamilyPage}
              />
            </div>
          )}
        </TableCard>
      ) : (
        <TableCard>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">{visitPagination?.total ?? 0} visit(s)</p>
            <Button size="md" onClick={() => setVisitOpen(true)}>
              + Record Visit
            </Button>
          </div>
          <Table
            fixedLayout
            striped
            columns={visitColumns}
            data={visits}
            emptyMessage="No visits recorded"
            showExport={false}
          />
          {visitPagination && (
            <div className="mt-4">
              <Pagination
                currentPage={visitPagination.page}
                totalPages={visitPagination.totalPages}
                totalItems={visitPagination.total}
                itemsPerPage={visitPagination.limit}
                onPageChange={setVisitPage}
              />
            </div>
          )}
        </TableCard>
      )}

      <Modal isOpen={isAssignOpen} onClose={() => setAssignOpen(false)} title="Assign Families">
        <Input
          label="Search families"
          value={assignSearch}
          onChange={(e) => setAssignSearch(e.target.value)}
          placeholder="House name or family head"
        />
        <div className="mt-3 max-h-72 space-y-1 overflow-y-auto">
          {assignCandidates.map((family: any) => {
            const familyId = family._id || family.id;
            return (
              <label
                key={familyId}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 dark:border-gray-700"
              >
                <div className="shrink-0">
                  <Checkbox
                    checked={selectedIds.includes(familyId)}
                    onChange={(e) =>
                      setSelectedIds((prev) =>
                        e.target.checked ? [...prev, familyId] : prev.filter((x) => x !== familyId)
                      )
                    }
                  />
                </div>
                <span className="min-w-0 flex-1 text-xs sm:text-sm">
                  <span className="block truncate font-medium">{toTitleCase(family.houseName)}</span>
                  <span className="block truncate text-gray-500">{toTitleCase(family.familyHead) || '-'}</span>
                </span>
              </label>
            );
          })}
          {assignCandidates.length === 0 && (
            <p className="py-4 text-center text-sm text-gray-500">No families found</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setAssignOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={saving || selectedIds.length === 0}>
            {saving ? 'Assigning...' : `Assign ${selectedIds.length || ''}`}
          </Button>
        </div>
      </Modal>

      <Modal isOpen={isVisitOpen} onClose={() => setVisitOpen(false)} title="Record Visit">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Visit Date"
            type="date"
            value={visitForm.visitDate}
            onChange={(e) => setVisitForm({ ...visitForm, visitDate: e.target.value })}
          />
          <Input
            label="Visited By"
            value={visitForm.visitedBy}
            onChange={(e) => setVisitForm({ ...visitForm, visitedBy: e.target.value })}
          />
          <div className="md:col-span-2">
            <Input
              label="Notes"
              value={visitForm.notes}
              onChange={(e) => setVisitForm({ ...visitForm, notes: e.target.value })}
            />
          </div>
          <div className="md:col-span-2">
            <Input
              label="Issues Found"
              value={visitForm.issuesFound}
              onChange={(e) => setVisitForm({ ...visitForm, issuesFound: e.target.value })}
            />
          </div>
          <label className="flex flex-wrap items-center gap-2 md:col-span-2">
            <Checkbox
              checked={visitForm.followUpNeeded}
              onChange={(e) => setVisitForm({ ...visitForm, followUpNeeded: e.target.checked })}
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">Follow-up needed</span>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setVisitOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreateVisit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Visit'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isLoading={saving}
        isOpen={confirmUnassign}
        title="Remove Family"
        message="Remove this family from the cluster?"
        confirmLabel="Remove"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleUnassign}
        onCancel={() => {
          setConfirmUnassign(false);
          setUnassignFamilyId(null);
        }}
      />

      <Modal isOpen={isEditOpen} onClose={() => setEditOpen(false)} title="Edit Cluster">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input
            label="Cluster Name"
            value={editForm.name}
            onChange={(e) => {
              setEditForm({ ...editForm, name: e.target.value });
              if (editNameError) setEditNameError(null);
            }}
            error={editNameError ?? undefined}
            required
          />
          <Input
            label="Name (Malayalam)"
            value={editForm.nameMl}
            onChange={(e) => setEditForm({ ...editForm, nameMl: e.target.value })}
            className="font-malayalam"
          />
          <Input
            label="Code"
            value={editForm.code}
            onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
            placeholder="CL-01"
          />
          <Input
            label="Notes"
            value={editForm.notes}
            onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
          />
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => setEditOpen(false)} disabled={editSaving}>
            Cancel
          </Button>
          <Button onClick={handleEdit} disabled={editSaving}>
            {editSaving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Cluster"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(cluster.name)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
