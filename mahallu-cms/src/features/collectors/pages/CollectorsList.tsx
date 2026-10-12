import { useCallback, useEffect, useState } from 'react';
import { FiPlus } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import RowActions from '@/components/ui/RowActions';
import { PersonCell } from '@/components/ui/Avatar';
import Table from '@/components/ui/Table';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import PhoneInput from '@/components/ui/PhoneInput';
import StatusBadge from '@/components/ui/StatusBadge';
import Alert from '@/components/ui/Alert';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import formatINR from '@/utils/formatINR';
import { collectorService, Collector } from '@/services/collectorService';

interface Draft { id?: string; name: string; phone: string; wards: string; active: boolean }
const EMPTY: Draft = { name: '', phone: '', wards: '', active: true };

export default function CollectorsList() {
  const [rows, setRows] = useState<Collector[]>([]);
  const [today, setToday] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState('');
  const [toDelete, setToDelete] = useState<Collector | null>(null);

  const load = useCallback(async () => {
    try {
      const list = await collectorService.list();
      setRows(list);
      const totals: Record<string, number> = {};
      await Promise.all(list.filter((c) => c.active).map(async (c) => { totals[c.id] = (await collectorService.day(c.id)).expectedCash; }));
      setToday(totals);
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't load collectors. Try again in a moment."));
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) return setError('Enter the collector name');
    const payload = { name: draft.name.trim(), phone: draft.phone, wards: draft.wards.split(',').map((w) => w.trim()).filter(Boolean), active: draft.active };
    try {
      if (draft.id) await collectorService.update(draft.id, payload); else await collectorService.create(payload);
      setDraft(null); setError('');
      toast.success('Collector saved');
      load();
    } catch (e: any) { toast.error(getFriendlyError(e, "Couldn't save. Try again in a moment.")); }
  };

  const remove = async () => {
    if (!toDelete) return;
    try { await collectorService.remove(toDelete.id); toast.success('Collector deleted'); load(); }
    catch (e: any) { toast.error(getFriendlyError(e, "Couldn't delete. Try again in a moment.")); }
    setToDelete(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Collectors" description="People who collect varisangya and campaign money door to door"
        actions={<Button onClick={() => { setError(''); setDraft(EMPTY); }}><FiPlus className="h-3.5 w-3.5" />Add collector</Button>} />
      <Alert tone="info">
        Receipts for varisangya and zakat do not record the collector yet, so a collector's cash for the day only includes campaign receipts tagged to them.
        The day-closing page counts all cash receipts of the mahallu.
      </Alert>
      <Table<Collector>
        data={rows}
        isLoading={loading}
        emptyMessage="No collectors yet"
        exportFilename="collectors"
        columns={[
          { key: 'name', label: 'Name', render: (v) => <PersonCell name={v} /> },
          { key: 'phone', label: 'Phone', render: (v) => v || '-' },
          { key: 'wards', label: 'Wards', render: (v: string[]) => (v?.length ? v.join(', ') : 'All') },
          { key: 'today', label: 'Cash today', align: 'right', render: (_v, r) => (r.active ? formatINR(today[r.id] || 0) : '-') },
          { key: 'active', label: 'Status', render: (v) => <StatusBadge status={v ? 'active' : 'inactive'} /> },
          { key: 'actions', label: '', hideable: false, render: (_v, r) => (
            <RowActions
              onEdit={() => { setError(''); setDraft({ id: r.id, name: r.name, phone: r.phone || '', wards: (r.wards || []).join(', '), active: r.active }); }}
              editLabel="Edit collector"
              onDelete={() => setToDelete(r)}
              deleteLabel="Delete collector"
            />) },
        ]}
      />
      <Modal isOpen={!!draft} onClose={() => setDraft(null)} title={draft?.id ? 'Edit collector' : 'Add collector'}
        footer={<><Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button><Button onClick={save}>Save</Button></>}>
        {draft && (
          <div className="space-y-3">
            {error && <Alert tone="danger">{error}</Alert>}
            <Input label="Name" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            <PhoneInput label="Phone" value={draft.phone} onChange={(e: any) => setDraft({ ...draft, phone: e.target.value })} />
            <Input label="Wards" value={draft.wards} onChange={(e) => setDraft({ ...draft, wards: e.target.value })} helperText="Comma separated, for example 1, 2, 5. Leave empty for all wards." />
            <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={draft.active} onChange={() => setDraft({ ...draft, active: !draft.active })} className="h-4 w-4 accent-primary-700" />Active</label>
          </div>
        )}
      </Modal>
      <ConfirmDialog isOpen={!!toDelete} title="Delete collector?" message={`Delete ${toDelete?.name}? If they have day-closing records, mark them inactive instead.`} confirmLabel="Delete" cancelLabel="Keep" variant="danger" onConfirm={remove} onCancel={() => setToDelete(null)} />
    </div>
  );
}
