import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import Tabs from '@/components/ui/Tabs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';
import Table from '@/components/ui/Table';
import Checkbox from '@/components/ui/Checkbox';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Pagination from '@/components/ui/Pagination';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import RowActions from '@/components/ui/RowActions';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
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
      toast.success('Families assigned');
      await reloadFamilies();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't assign families. Try again in a moment."));
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
      toast.error(getFriendlyError(err, "Couldn't remove family. Try again in a moment."));
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
      toast.error(getFriendlyError(err, "Couldn't record visit. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  const familyColumns: TableColumn<any>[] = [
    { key: 'houseName', label: 'House Name', render: (v) => <PersonCell name={v} /> },
    { key: 'familyHead', label: 'Family Head', render: (v) => (v ? <PersonCell name={v} size={24} /> : '-') },
    { key: 'contactNo', label: 'Contact', render: (v) => v || '-' },
    {
      key: 'actions',
      label: '',
      render: (_v, row) => (
        <RowActions
          onDelete={() => {
            setUnassignFamilyId(row.id);
            setConfirmUnassign(true);
          }}
          deleteLabel="Remove"
          ariaLabels={{ delete: 'Remove family from cluster' }}
        />
      ),
    },
  ];

  const visitColumns: TableColumn<ClusterVisit>[] = [
    { key: 'visitDate', label: 'Date', render: (v) => (v ? new Date(v).toLocaleDateString() : '-') },
    {
      key: 'familyId',
      label: 'Family',
      render: (v) => (typeof v === 'object' && v ? <PersonCell name={v.houseName} size={24} /> : '-'),
    },
    { key: 'visitedBy', label: 'Visited By', render: (v) => v || '-' },
    { key: 'issuesFound', label: 'Issues', render: (v) => v || '-' },
    { key: 'followUpNeeded', label: 'Follow-up', render: (v) => (v ? 'Yes' : 'No') },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!cluster) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">Cluster not found</p>
        <Link to="/clusters">
          <Button variant="secondary" className="mt-4">
            Back to clusters
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={cluster.name}
        leading={<Avatar size={56} name={cluster.name} />}
        description={`${cluster.familyCount ?? 0} families${cluster.code ? ` - ${cluster.code}` : ''}`}
        actions={
          <Link to="/clusters">
            <Button variant="secondary">Back to clusters</Button>
          </Link>
        }
      />

      <Tabs<Tab>
        aria-label="Cluster sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'families', label: 'Families', count: familyPagination?.total ?? 0 },
          { value: 'visits', label: 'Visits', count: visitPagination?.total ?? 0 },
        ]}
      />

      {tab === 'families' ? (
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
            <p className="text-xs font-semibold text-[#7B8983] dark:text-surface-muted">
              {familyPagination?.total ?? 0} assigned
            </p>
            <Button onClick={() => setAssignOpen(true)}>+ Assign families</Button>
          </div>
          <div className="p-3.5">
            <Table
              columns={familyColumns}
              data={families}
              emptyMessage="No families assigned yet"
              showExport={false}
            />
            {familyPagination && (
              <div className="mt-3.5">
                <Pagination
                  currentPage={familyPagination.page}
                  totalPages={familyPagination.totalPages}
                  totalItems={familyPagination.total}
                  itemsPerPage={familyPagination.limit}
                  onPageChange={setFamilyPage}
                />
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line-soft px-3.5 py-3 dark:border-surface-border">
            <p className="text-xs font-semibold text-[#7B8983] dark:text-surface-muted">
              {visitPagination?.total ?? 0} visit(s)
            </p>
            <Button onClick={() => setVisitOpen(true)}>+ Record visit</Button>
          </div>
          <div className="p-3.5">
            <Table columns={visitColumns} data={visits} emptyMessage="No visits recorded" showExport={false} />
            {visitPagination && (
              <div className="mt-3.5">
                <Pagination
                  currentPage={visitPagination.page}
                  totalPages={visitPagination.totalPages}
                  totalItems={visitPagination.total}
                  itemsPerPage={visitPagination.limit}
                  onPageChange={setVisitPage}
                />
              </div>
            )}
          </div>
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
            const familyId = family.id;
            return (
              <label
                key={familyId}
                className="flex items-center gap-2 rounded-xl border border-line px-2 py-2 dark:border-surface-border"
              >
                <Checkbox
                  checked={selectedIds.includes(familyId)}
                  onChange={(e) =>
                    setSelectedIds((prev) =>
                      e.target.checked ? [...prev, familyId] : prev.filter((x) => x !== familyId)
                    )
                  }
                />
                <Avatar size={32} name={family.houseName} />
                <span className="min-w-0 flex-1 text-xs sm:text-sm">
                  <span className="block truncate font-semibold text-[#18231E] dark:text-surface-text">{family.houseName}</span>
                  <span className="block truncate text-[#7B8983] dark:text-surface-muted">{family.familyHead || '-'}</span>
                </span>
              </label>
            );
          })}
          {assignCandidates.length === 0 && (
            <p className="py-4 text-center text-sm text-[#7B8983] dark:text-surface-muted">No families found</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setAssignOpen(false)} disabled={saving}>
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
            <span className="text-[13px] font-semibold text-[#3A4741] dark:text-surface-text">Follow-up needed</span>
          </label>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => setVisitOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleCreateVisit} disabled={saving}>
            {saving ? 'Saving...' : 'Save Visit'}
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmUnassign}
        title="Remove family?"
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
