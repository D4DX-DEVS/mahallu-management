import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
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

type Tab = 'families' | 'visits';

const emptyVisit = { familyId: '', visitDate: '', visitedBy: '', notes: '', issuesFound: '', followUpNeeded: false };

export default function ClusterDetail() {
  const { id } = useParams<{ id: string }>();
  const [cluster, setCluster] = useState<Cluster | null>(null);
  const [tab, setTab] = useState<Tab>('families');
  const [loading, setLoading] = useState(true);

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
      toast.success('Families assigned successfully');
      await reloadFamilies();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to assign families');
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
      toast.error(err.response?.data?.message || 'Failed to remove family');
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
      toast.success('Visit recorded successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to record visit');
    } finally {
      setSaving(false);
    }
  };

  const familyColumns: TableColumn<any>[] = [
    { key: 'houseName', label: 'House Name' },
    { key: 'familyHead', label: 'Family Head', render: (v) => v || '-' },
    { key: 'contactNo', label: 'Contact', render: (v) => v || '-' },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <button
          className="text-red-600 hover:underline"
          onClick={() => {
            setUnassignFamilyId(row._id || row.id);
            setConfirmUnassign(true);
          }}
        >
          Remove
        </button>
      ),
    },
  ];

  const visitColumns: TableColumn<ClusterVisit>[] = [
    { key: 'visitDate', label: 'Date', render: (v) => (v ? new Date(v).toLocaleDateString() : '-') },
    {
      key: 'familyId',
      label: 'Family',
      render: (v) => (typeof v === 'object' && v ? v.houseName : '-'),
    },
    { key: 'visitedBy', label: 'Visited By', render: (v) => v || '-' },
    { key: 'issuesFound', label: 'Issues', render: (v) => v || '-' },
    { key: 'followUpNeeded', label: 'Follow-up', render: (v) => (v ? 'Yes' : 'No') },
  ];

  if (loading) {
    return (
      <PageSkeleton variant="section" />
    );
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{cluster.name}</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {cluster.familyCount ?? 0} families
            {cluster.code ? ` - ${cluster.code}` : ''}
          </p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Clusters', path: '/clusters' },
            { label: cluster.name },
          ]}
        />
      </div>

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
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {familyPagination?.total ?? 0} assigned
            </p>
            <Button size="md" onClick={() => setAssignOpen(true)}>
              + Assign Families
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table
              columns={familyColumns}
              data={families}
              emptyMessage="No families assigned yet"
              showExport={false}
            />
          </div>
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
        </Card>
      ) : (
        <Card>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {visitPagination?.total ?? 0} visit(s)
            </p>
            <Button size="md" onClick={() => setVisitOpen(true)}>
              + Record Visit
            </Button>
          </div>
          <div className="overflow-x-auto">
            <Table columns={visitColumns} data={visits} emptyMessage="No visits recorded" showExport={false} />
          </div>
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
        </Card>
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
                <Checkbox
                  checked={selectedIds.includes(familyId)}
                  onChange={(e) =>
                    setSelectedIds((prev) =>
                      e.target.checked ? [...prev, familyId] : prev.filter((x) => x !== familyId)
                    )
                  }
                />
                <span className="min-w-0 flex-1 text-xs sm:text-sm">
                  <span className="block truncate font-medium">{family.houseName}</span>
                  <span className="block truncate text-gray-500">{family.familyHead || '-'}</span>
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
          <label className="flex items-center gap-2 md:col-span-2">
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
    </div>
  );
}
