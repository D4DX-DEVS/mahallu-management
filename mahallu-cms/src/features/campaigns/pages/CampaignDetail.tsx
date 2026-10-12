import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { FiEdit2, FiPlus } from 'react-icons/fi';
import RowActions from '@/components/ui/RowActions';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Tabs from '@/components/ui/Tabs';
import Table from '@/components/ui/Table';
import StatusBadge from '@/components/ui/StatusBadge';
import StatCard from '@/components/ui/StatCard';
import EmptyState from '@/components/ui/EmptyState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Modal from '@/components/ui/Modal';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import Ring from '@/components/ui/stat-viz/Ring';
import Bullet from '@/components/ui/stat-viz/Bullet';
import HijriDate from '@/components/HijriDate';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import formatINR from '@/utils/formatINR';
import {
  campaignService, Campaign, CampaignProgress, Contribution, FitrChecklist, UdhiyaBooking, campaignTypeLabel,
} from '@/services/campaignService';
import AddContributionDialog from '../components/AddContributionDialog';
import UdhiyaPanel from '../components/UdhiyaPanel';

type Tab = 'overview' | 'receipts' | 'fitr' | 'udhiya';
const dateText = (v?: string) => (v ? new Date(v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '-');

export default function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [receipts, setReceipts] = useState<Contribution[]>([]);
  const [fitr, setFitr] = useState<FitrChecklist | null>(null);
  const [fitrFilter, setFitrFilter] = useState<'all' | 'unpaid' | 'paid' | 'partial'>('all');
  const [udhiya, setUdhiya] = useState<UdhiyaBooking[]>([]);
  const [tab, setTab] = useState<Tab>('overview');
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Contribution | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busyFamily, setBusyFamily] = useState('');
  const [confirmStatus, setConfirmStatus] = useState<null | 'active' | 'closed'>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const c = await campaignService.get(id);
      setCampaign(c);
      const [p, r] = await Promise.all([campaignService.progress(id), campaignService.contributions(id, { limit: 100 })]);
      setProgress(p);
      setReceipts(r.data);
      if (c.type === 'fitr') setFitr(await campaignService.fitr(id));
      if (c.type === 'udhiya') setUdhiya(await campaignService.udhiya(id));
    } catch (e: any) {
      setError(getFriendlyError(e, "Couldn't load this campaign. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!campaign || !id) return <Card><EmptyState title="Campaign not found" description={error || 'It may have been deleted.'} /></Card>;

  const markPaid = async (familyId: string) => {
    try {
      setBusyFamily(familyId);
      const c = await campaignService.fitrMarkPaid(id, familyId, { method: 'cash' });
      toast.success(`Receipt ${c.receiptNo} recorded`);
      await load();
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't record the payment. Try again in a moment."));
    } finally {
      setBusyFamily('');
    }
  };

  const changeStatus = async () => {
    if (!confirmStatus) return;
    try {
      await campaignService.setStatus(id, confirmStatus);
      toast.success(confirmStatus === 'active' ? 'Campaign is now collecting' : 'Campaign closed');
      setConfirmStatus(null);
      await load();
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't change the status. Try again in a moment."));
    }
  };

  const doCancel = async () => {
    if (!cancelTarget) return;
    if (!cancelReason.trim()) return toast.error('Add a reason for cancelling the receipt');
    try {
      await campaignService.cancelContribution(cancelTarget.id, cancelReason.trim());
      toast.success('Receipt cancelled. The number stays on record.');
      setCancelTarget(null); setCancelReason('');
      await load();
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't cancel the receipt. Try again in a moment."));
    }
  };

  const tabs: { value: Tab; label: string; count?: number }[] = [
    { value: 'overview' as Tab, label: 'Overview' },
    { value: 'receipts' as Tab, label: 'Receipts', count: campaign.contributionCount },
    ...(campaign.type === 'fitr' ? [{ value: 'fitr' as Tab, label: 'Family checklist', count: fitr?.summary.unpaidFamilies }] : []),
    ...(campaign.type === 'udhiya' ? [{ value: 'udhiya' as Tab, label: 'Shares', count: udhiya.length }] : []),
  ];

  const fitrRows = (fitr?.families || []).filter((f) => fitrFilter === 'all' || f.status === fitrFilter);
  const canCollect = campaign.status !== 'closed';

  return (
    <div className="space-y-4">
      <PageHeader
        eyebrow={<Link to="/campaigns" className="hover:underline">Campaigns</Link>}
        leading={<Avatar size={56} name={campaign.name} />}
        title={<span className="flex flex-wrap items-center gap-2">{campaign.name}<StatusBadge status={campaign.status} /></span>}
        description={<>{campaignTypeLabel(campaign.type)}{campaign.startDate && <> · {dateText(campaign.startDate)} (<HijriDate date={campaign.startDate} short />)</>}{campaign.endDate && <> to {dateText(campaign.endDate)}</>}</>}
        actions={<>
          <Button variant="secondary" onClick={() => navigate(`/campaigns/${id}/edit`)}><FiEdit2 className="h-3.5 w-3.5" />Edit</Button>
          {campaign.status === 'draft' && <Button variant="secondary" onClick={() => setConfirmStatus('active')}>Start collecting</Button>}
          {campaign.status === 'active' && <Button variant="secondary" onClick={() => setConfirmStatus('closed')}>Close campaign</Button>}
          {campaign.status === 'closed' && <Button variant="secondary" onClick={() => setConfirmStatus('active')}>Re-open</Button>}
          {canCollect && <Button onClick={() => setAddOpen(true)}><FiPlus className="h-3.5 w-3.5" />Add contribution</Button>}
        </>}
      />
      {campaign.status === 'draft' && <Alert tone="info">This campaign is a draft. Start collecting when you are ready; you can still record receipts meanwhile.</Alert>}

      <Tabs<Tab> tabs={tabs} value={tab} onChange={setTab} aria-label="Campaign sections" />

      {tab === 'overview' && progress && (
        <div className="space-y-4">
          <Card padding="lg">
            <div className="flex flex-wrap items-center gap-6">
              {progress.target > 0 && <Ring percent={progress.percent || 0} scale={3} />}
              <div className="min-w-[200px] flex-1">
                <p className="text-[28px] font-extrabold leading-none text-primary-700 dark:text-surface-text">{formatINR(progress.raised)}</p>
                <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">
                  {progress.target > 0 ? `raised of ${formatINR(progress.target)} (${progress.percent}%). ${formatINR(progress.remaining || 0)} to go.` : 'raised so far. No target is set.'}
                </p>
                {progress.target > 0 && <div className="mt-3"><Bullet percent={progress.percent || 0} scale={5} /></div>}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard variant="tile" title="Receipts" value={progress.contributionCount} />
            <StatCard variant="tile" title="Cash" value={formatINR(progress.byMethod.find((m) => m.method === 'cash')?.amount || 0)} />
            <StatCard variant="tile" title="Other methods" value={formatINR(progress.raised - (progress.byMethod.find((m) => m.method === 'cash')?.amount || 0))} />
            {fitr && <StatCard variant="tile" title="Families paid" value={`${fitr.summary.paidFamilies} / ${fitr.summary.families}`} />}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card padding="lg">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">By day</h2>
              {progress.byDay.length === 0 ? <p className="mt-2 text-xs text-[#7B8983]">No receipts yet.</p> : (
                <ul className="mt-2 divide-y divide-line text-[13px] dark:divide-surface-border">
                  {progress.byDay.slice().reverse().slice(0, 10).map((d) => (
                    <li key={d.date} className="flex justify-between py-1.5">
                      <span>{dateText(d.date)} <span className="text-xs text-[#7B8983]">· {d.count} receipt{d.count === 1 ? '' : 's'}</span></span>
                      <span className="font-semibold">{formatINR(d.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card padding="lg">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Top contributors</h2>
              <p className="text-xs text-[#7B8983]">Donors who asked for privacy appear as Anonymous.</p>
              {progress.topContributors.length === 0 ? <p className="mt-2 text-xs text-[#7B8983]">No receipts yet.</p> : (
                <ol className="mt-2 divide-y divide-line text-[13px] dark:divide-surface-border">
                  {progress.topContributors.map((t) => (
                    <li key={t.rank} className="flex items-center justify-between py-1.5"><span className="flex items-center gap-2"><span className="w-4 text-[#7B8983]">{t.rank}.</span><Avatar size={24} name={t.name} />{t.name}</span><span className="font-semibold">{formatINR(t.amount)}</span></li>
                  ))}
                </ol>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === 'receipts' && (
        <Table<Contribution>
          data={receipts}
          exportFilename={`${campaign.name}-receipts`}
          columns={[
            { key: 'receiptNo', label: 'Receipt' },
            { key: 'paymentDate', label: 'Date', render: (v) => dateText(v) },
            { key: 'donorName', label: 'Donor', render: (v, r) => <PersonCell name={v} subtitle={r.anonymous ? 'Private' : undefined} /> },
            { key: 'method', label: 'Paid by', render: (v) => (v ? <StatusBadge status={v} tone="neutral" dot={false} /> : '-') },
            { key: 'amount', label: 'Amount', align: 'right', render: (v) => formatINR(v) },
            { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v} /> },
            { key: 'actions', label: '', hideable: false, render: (_v, r) => r.status === 'approved' ? <RowActions onDelete={() => setCancelTarget(r)} deleteLabel="Cancel receipt" /> : <span className="text-[12px] text-[#7B8983]">{r.cancelReason}</span> },
          ]}
          emptyMessage="No receipts yet"
        />
      )}

      {tab === 'fitr' && fitr && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard variant="tile" title="Per person" value={formatINR(fitr.perHeadAmount)} />
            <StatCard variant="tile" title="Expected" value={formatINR(fitr.summary.expectedTotal)} pills={[`${fitr.summary.members} living members`]} />
            <StatCard variant="tile" title="Collected" value={formatINR(fitr.summary.paidTotal)} progress={{ value: fitr.summary.expectedTotal ? Math.min(100, (fitr.summary.paidTotal / fitr.summary.expectedTotal) * 100) : 0 }} />
            <StatCard variant="tile" title="Not paid yet" value={`${fitr.summary.unpaidFamilies} families`} />
          </div>
          <div className="flex flex-wrap gap-2">
            {(['all', 'unpaid', 'partial', 'paid'] as const).map((f) => (
              <Button key={f} size="sm" variant={fitrFilter === f ? 'primary' : 'secondary'} onClick={() => setFitrFilter(f)}>{f[0].toUpperCase() + f.slice(1)}</Button>
            ))}
          </div>
          <Table
            data={fitrRows}
            getRowId={(r: any) => r.familyId}
            exportFilename={`${campaign.name}-fitr`}
            columns={[
              { key: 'houseName', label: 'Family', render: (v, r: any) => <PersonCell name={v} subtitle={r.familyHead} /> },
              { key: 'members', label: 'Members', align: 'right' },
              { key: 'expected', label: 'Expected', align: 'right', render: (v) => formatINR(v) },
              { key: 'paid', label: 'Paid', align: 'right', render: (v) => formatINR(v) },
              { key: 'status', label: 'Status', render: (v) => <StatusBadge status={v === 'unpaid' ? 'due' : v} label={v === 'unpaid' ? 'Not paid' : undefined} /> },
              { key: 'action', label: '', hideable: false, render: (_v, r: any) => r.balance > 0 && r.expected > 0 && canCollect
                ? <Button size="sm" isLoading={busyFamily === r.familyId} onClick={() => markPaid(r.familyId)}>Mark paid</Button>
                : r.receiptNo ? <span className="text-[12px] text-[#7B8983]">{r.receiptNo}</span> : null },
            ]}
            emptyMessage="No families match"
          />
          <p className="text-xs text-[#7B8983] dark:text-surface-muted">"Mark paid" records the family's remaining amount as a cash receipt. Use "Add contribution" for another amount or method. Only living, active members are counted.</p>
        </div>
      )}

      {tab === 'udhiya' && <UdhiyaPanel campaignId={id} bookings={udhiya} canEdit={canCollect} onChanged={load} />}

      <AddContributionDialog campaignId={id} isOpen={addOpen} onClose={() => setAddOpen(false)} onSaved={() => { toast.success('Receipt recorded'); load(); }} />

      <Modal isOpen={!!cancelTarget} onClose={() => setCancelTarget(null)} title={`Cancel receipt ${cancelTarget?.receiptNo || ''}`} description="The receipt stays on record as cancelled. It is removed from the totals and the ledger."
        footer={<><Button variant="secondary" onClick={() => setCancelTarget(null)}>Keep receipt</Button><Button variant="danger-solid" onClick={doCancel}>Cancel receipt</Button></>}>
        <Input label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} required />
      </Modal>

      <ConfirmDialog
        isOpen={!!confirmStatus}
        title={confirmStatus === 'closed' ? 'Close this campaign?' : 'Start collecting?'}
        message={confirmStatus === 'closed' ? 'No new receipts can be added after closing. You can re-open it later.' : 'The campaign becomes active.'}
        confirmLabel={confirmStatus === 'closed' ? 'Close campaign' : 'Start'}
        cancelLabel="Not now"
        onConfirm={changeStatus}
        onCancel={() => setConfirmStatus(null)}
      />
    </div>
  );
}
