import { useEffect, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import AmountInput from '@/components/ui/AmountInput';
import SearchableSelect from '@/components/ui/SearchableSelect';
import Checkbox from '@/components/ui/Checkbox';
import Alert from '@/components/ui/Alert';
import { familyService } from '@/services/familyService';
import { collectorService, Collector } from '@/services/collectorService';
import { campaignService, PAYMENT_METHOD_OPTIONS } from '@/services/campaignService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

interface Props {
  campaignId: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  /** Pre-fill when opened from the Fitr checklist */
  initialFamilyId?: string;
  initialAmount?: number;
}

const today = () => new Date().toISOString().slice(0, 10);

export default function AddContributionDialog({ campaignId, isOpen, onClose, onSaved, initialFamilyId, initialAmount }: Props) {
  const [familyId, setFamilyId] = useState('');
  const [donorName, setDonorName] = useState('');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('cash');
  const [paymentDate, setPaymentDate] = useState(today());
  const [collectorId, setCollectorId] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [familyOptions, setFamilyOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [collectors, setCollectors] = useState<Collector[]>([]);

  const searchFamilies = (q: string) => {
    familyService.getAll({ search: q, limit: 20, status: 'approved' } as any)
      .then((r) => setFamilyOptions(r.data.map((f: any) => ({ value: f.id, label: f.houseName, sublabel: f.familyHead }))))
      .catch(() => undefined);
  };

  useEffect(() => {
    if (!isOpen) return;
    setFamilyId(initialFamilyId || ''); setDonorName(''); setAmount(initialAmount ? String(initialAmount) : '');
    setMethod('cash'); setPaymentDate(today()); setCollectorId(''); setAnonymous(false); setRemarks(''); setError('');
    searchFamilies('');
    collectorService.list({ active: true }).then(setCollectors).catch(() => setCollectors([]));
  }, [isOpen, initialFamilyId, initialAmount]);

  const save = async () => {
    if (!(Number(amount) > 0)) return setError('Enter the amount received');
    if (!familyId && !donorName.trim()) return setError('Pick a family or type the donor name');
    try {
      setSaving(true);
      setError('');
      await campaignService.addContribution(campaignId, {
        familyId: familyId || undefined, donorName: donorName.trim() || undefined, anonymous, amount: Number(amount),
        method, paymentDate, collectorId: collectorId || undefined, remarks: remarks.trim() || undefined,
      });
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't save the receipt. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add contribution" description="A receipt number is created automatically"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} isLoading={saving}>Save receipt</Button></>}>
      <div className="space-y-3">
        {error && <Alert tone="danger">{error}</Alert>}
        <SearchableSelect label="Family" placeholder="Search by house name" value={familyId} onChange={setFamilyId}
          options={familyOptions} onSearch={searchFamilies} />
        <Input label={familyId ? 'Donor name (optional)' : 'Donor name'} value={donorName} onChange={(e) => setDonorName(e.target.value)}
          helperText={familyId ? 'Defaults to the family head.' : 'For donors outside the mahallu.'} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <AmountInput label="Amount (Rs)" required value={amount} onChange={(e) => setAmount(e.target.value)} />
          <div>
            <label className={labelClasses}>Paid by</label>
            <select className={`${controlClasses} h-9`} value={method} onChange={(e) => setMethod(e.target.value)}>
              {PAYMENT_METHOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <Input label="Date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          <div>
            <label className={labelClasses}>Collected by</label>
            <select className={`${controlClasses} h-9`} value={collectorId} onChange={(e) => setCollectorId(e.target.value)}>
              <option value="">Office / not a collector</option>
              {collectors.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <Input label="Remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        <label className="flex items-center gap-2 text-xs text-[#3A4741] dark:text-surface-text">
          <Checkbox checked={anonymous} onChange={() => setAnonymous(!anonymous)} />
          Do not show the donor's name on top-contributor lists
        </label>
      </div>
    </Modal>
  );
}
