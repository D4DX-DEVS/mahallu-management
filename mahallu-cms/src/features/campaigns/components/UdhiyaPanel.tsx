import { useState } from 'react';
import { FiPlus, FiTrash2 } from 'react-icons/fi';
import { PersonCell } from '@/components/ui/Avatar';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import DateInput from '@/components/ui/DateInput';
import AmountInput from '@/components/ui/AmountInput';
import Badge from '@/components/ui/Badge';
import Alert from '@/components/ui/Alert';
import EmptyState from '@/components/ui/EmptyState';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';
import formatINR from '@/utils/formatINR';
import { campaignService, UdhiyaBooking } from '@/services/campaignService';

const ANIMALS = [
  { value: 'cow', label: 'Cow (up to 7 shares)' },
  { value: 'buffalo', label: 'Buffalo (up to 7 shares)' },
  { value: 'camel', label: 'Camel (up to 7 shares)' },
  { value: 'goat', label: 'Goat (1 share)' },
  { value: 'sheep', label: 'Sheep (1 share)' },
];

interface Props { campaignId: string; bookings: UdhiyaBooking[]; canEdit: boolean; onChanged: () => void }

export default function UdhiyaPanel({ campaignId, bookings, canEdit, onChanged }: Props) {
  const [open, setOpen] = useState(false);
  const [animal, setAnimal] = useState('cow');
  const [perShare, setPerShare] = useState('');
  const [collectionDay, setCollectionDay] = useState('');
  const [people, setPeople] = useState<{ name: string; shares: string }[]>([{ name: '', shares: '1' }]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const small = animal === 'goat' || animal === 'sheep';
  const shareCount = small ? 1 : 7;
  const booked = people.reduce((a, p) => a + (parseInt(p.shares, 10) || 0), 0);

  const create = async () => {
    if (!(Number(perShare) >= 0) || perShare === '') return setError('Enter the price per share');
    const participants = people.filter((p) => p.name.trim()).map((p) => ({ name: p.name.trim(), shares: parseInt(p.shares, 10) || 1 }));
    if (booked > shareCount) return setError(`Only ${shareCount} share${shareCount === 1 ? '' : 's'} are available on this animal`);
    try {
      await campaignService.createUdhiya(campaignId, { animal, shareCount, perSharePrice: Number(perShare), collectionDay: collectionDay || undefined, participants });
      setOpen(false); setPeople([{ name: '', shares: '1' }]); setPerShare(''); setError('');
      onChanged();
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't save the booking. Try again in a moment."));
    }
  };

  const pay = async (b: UdhiyaBooking, pid: string) => {
    try {
      setBusy(pid);
      const r = await campaignService.payUdhiyaParticipant(campaignId, b.id, pid, { method: 'cash' });
      toast.success(`Receipt ${r.contribution.receiptNo} recorded`);
      onChanged();
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't record the payment. Try again in a moment."));
    } finally { setBusy(''); }
  };

  const remove = async (b: UdhiyaBooking) => {
    try { await campaignService.deleteUdhiya(campaignId, b.id); onChanged(); } catch (e: any) { toast.error(getFriendlyError(e, "Couldn't delete the booking. Try again in a moment.")); }
  };

  return (
    <div className="space-y-3">
      {canEdit && <div className="flex justify-end"><Button onClick={() => setOpen(true)}><FiPlus className="h-3.5 w-3.5" />New animal</Button></div>}
      {bookings.length === 0 ? <Card><EmptyState title="No animals booked yet" description="Add an animal, then list who shares it." /></Card> : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {bookings.map((b) => (
            <Card key={b.id} padding="lg">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-extrabold capitalize text-[#18231E] dark:text-surface-text">{b.animal}</h3>
                  <p className="text-xs text-[#7B8983] dark:text-surface-muted">{formatINR(b.perSharePrice)} per share · total {formatINR(b.total)}{b.collectionDay && <> · collect {new Date(b.collectionDay).toLocaleDateString('en-IN')}</>}</p>
                </div>
                <Badge variant={b.openShares === 0 ? 'success' : 'warning'}>{b.bookedShares}/{b.shareCount} shares booked</Badge>
              </div>
              <ul className="mt-3 divide-y divide-line text-[13px] dark:divide-surface-border">
                {b.participants.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                    <PersonCell size={24} name={p.name} subtitle={`${p.shares} share${p.shares === 1 ? '' : 's'} · ${formatINR(p.shares * b.perSharePrice)}`} />
                    {p.paid ? <Badge variant="success" dot>Paid</Badge> : canEdit ? <Button size="sm" isLoading={busy === p.id} onClick={() => pay(b, p.id)}>Mark paid</Button> : <Badge variant="warning">Not paid</Badge>}
                  </li>
                ))}
                {b.participants.length === 0 && <li className="py-2 text-xs text-[#7B8983]">Nobody has booked a share yet.</li>}
              </ul>
              {canEdit && !b.participants.some((p) => p.paid) && (
                <div className="mt-2 text-right"><Button size="sm" variant="ghost" onClick={() => remove(b)}><FiTrash2 className="h-3.5 w-3.5" />Delete booking</Button></div>
              )}
            </Card>
          ))}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title="New animal" description="Who is sharing it and what each share costs"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={create}>Save</Button></>}>
        <div className="space-y-3">
          {error && <Alert tone="danger">{error}</Alert>}
          <div>
            <label className={labelClasses}>Animal</label>
            <select className={`${controlClasses} h-9`} value={animal} onChange={(e) => setAnimal(e.target.value)}>
              {ANIMALS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AmountInput label="Price per share (Rs)" required value={perShare} onChange={(e) => setPerShare(e.target.value)} />
            <DateInput showHijri label="Collection day" value={collectionDay} onChange={(e) => setCollectionDay(e.target.value)} />
          </div>
          <div>
            <label className={labelClasses}>Participants ({booked}/{shareCount} shares)</label>
            {people.map((p, i) => (
              <div key={i} className="mb-2 grid grid-cols-[1fr_80px] gap-2">
                <Input aria-label="Name" placeholder="Name" value={p.name} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
                <Input aria-label="Shares" type="number" min={1} max={shareCount} value={p.shares} onChange={(e) => setPeople(people.map((x, j) => (j === i ? { ...x, shares: e.target.value } : x)))} />
              </div>
            ))}
            {!small && booked < shareCount && <Button size="sm" variant="secondary" onClick={() => setPeople([...people, { name: '', shares: '1' }])}>Add participant</Button>}
          </div>
        </div>
      </Modal>
    </div>
  );
}
