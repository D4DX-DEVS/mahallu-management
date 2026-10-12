import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import PageHeader from '@/components/ui/PageHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input, { controlClasses, labelClasses } from '@/components/ui/Input';
import DateInput from '@/components/ui/DateInput';
import Stepper from '@/components/ui/Stepper';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import AmountInput from '@/components/ui/AmountInput';
import HijriDate from '@/components/HijriDate';
import { toast } from '@/store/toastStore';
import formatINR from '@/utils/formatINR';
import { campaignService, CAMPAIGN_TYPE_OPTIONS, CampaignType, campaignTypeLabel, IslamicSuggestion } from '@/services/campaignService';
import { masterAccountService } from '@/services/masterAccountService';
import { getFriendlyError } from '@/utils/apiMessages';

const STEPS = [
  { id: 'type', label: 'Type' },
  { id: 'details', label: 'Details' },
  { id: 'money', label: 'Target and books' },
  { id: 'review', label: 'Review' },
];

interface FormState {
  type: CampaignType;
  name: string;
  nameMl: string;
  description: string;
  startDate: string;
  endDate: string;
  targetAmount: string;
  perHeadAmount: string;
  ledgerId: string;
}

const EMPTY: FormState = { type: 'custom', name: '', nameMl: '', description: '', startDate: '', endDate: '', targetAmount: '', perHeadAmount: '', ledgerId: '' };

/** Create and edit share this page: /campaigns/new and /campaigns/:id/edit */
export default function CampaignWizard() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const editing = !!id;
  const [step, setStep] = useState(editing ? 1 : 0);
  const [maxVisited, setMaxVisited] = useState(editing ? 3 : 0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [ledgers, setLedgers] = useState<{ value: string; label: string }[]>([]);
  const [suggestions, setSuggestions] = useState<IslamicSuggestion[]>([]);

  useEffect(() => {
    campaignService.suggestions().then(setSuggestions).catch(() => undefined);
    masterAccountService.getAllLedgers({ type: 'income', limit: 100 } as any)
      .then((r: any) => setLedgers((r.data || r || []).filter((l: any) => l.type === 'income').map((l: any) => ({ value: l.id, label: l.name }))))
      .catch(() => setLedgers([]));
  }, []);

  useEffect(() => {
    const type = params.get('type') as CampaignType | null;
    const date = params.get('date');
    if (!editing && type) {
      const label = campaignTypeLabel(type);
      setForm((f) => ({ ...f, type, name: f.name || label, startDate: date || f.startDate }));
      setStep(1);
      setMaxVisited(1);
    }
  }, [editing, params]);

  useEffect(() => {
    if (!id) return;
    campaignService.get(id).then((c) => {
      setForm({
        type: c.type, name: c.name, nameMl: c.nameMl || '', description: c.description || '',
        startDate: c.startDate ? c.startDate.slice(0, 10) : '', endDate: c.endDate ? c.endDate.slice(0, 10) : '',
        targetAmount: c.targetAmount ? String(c.targetAmount) : '', perHeadAmount: c.perHeadAmount ? String(c.perHeadAmount) : '',
        ledgerId: c.ledgerId || '',
      });
    }).catch(() => setError('Could not load this campaign')).finally(() => setLoading(false));
  }, [id]);

  const set = (patch: Partial<FormState>) => setForm((f) => ({ ...f, ...patch }));
  const isFitr = form.type === 'fitr';

  const validate = (s: number): string => {
    if (s === 1 && !form.name.trim()) return 'Give the campaign a name';
    if (s === 1 && form.startDate && form.endDate && form.endDate < form.startDate) return 'The end date is before the start date';
    if (s === 2 && isFitr && !(Number(form.perHeadAmount) > 0)) return 'Enter the Zakat al-Fitr amount per person';
    return '';
  };

  const next = () => {
    const msg = validate(step);
    if (msg) return setError(msg);
    setError('');
    setStep(step + 1);
    setMaxVisited(Math.max(maxVisited, step + 1));
  };

  const save = async () => {
    for (const s of [1, 2]) {
      const msg = validate(s);
      if (msg) { setError(msg); setStep(s); return; }
    }
    const payload: any = {
      type: form.type, name: form.name.trim(), nameMl: form.nameMl.trim() || undefined, description: form.description.trim() || undefined,
      startDate: form.startDate || undefined, endDate: form.endDate || undefined,
      targetAmount: form.targetAmount ? Number(form.targetAmount) : undefined,
      perHeadAmount: isFitr && form.perHeadAmount ? Number(form.perHeadAmount) : undefined,
      ledgerId: form.ledgerId || undefined,
    };
    try {
      setSaving(true);
      const saved = editing ? await campaignService.update(id!, payload) : await campaignService.create(payload);
      toast.success(editing ? 'Campaign updated' : 'Campaign created as a draft. Activate it when you are ready to collect.');
      navigate(`/campaigns/${saved.id}`);
    } catch (e: any) {
      toast.error(getFriendlyError(e, "Couldn't save the campaign. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;

  const ledgerName = ledgers.find((l) => l.value === form.ledgerId)?.label;

  return (
    <div className="space-y-4">
      <PageHeader title={editing ? 'Edit campaign' : 'New campaign'} description="Four short steps. You can change everything later." />
      <Stepper steps={STEPS} current={step} maxVisited={maxVisited} onStepClick={(i) => { setError(''); setStep(i); }} />
      {error && <Alert tone="danger">{error}</Alert>}

      <Card padding="lg">
        {step === 0 && (
          <div className="space-y-3">
            <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">What are you collecting for?</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {CAMPAIGN_TYPE_OPTIONS.map((o) => {
                const sug = suggestions.find((s) => s.suggestedCampaignType === o.value);
                const selected = form.type === o.value;
                return (
                  <button key={o.value} type="button" onClick={() => set({ type: o.value, name: form.name || o.label, startDate: form.startDate || (sug ? sug.date.slice(0, 10) : '') })}
                    className={`rounded-xl border p-3.5 text-left transition-colors ${selected ? 'border-primary-600 bg-mint dark:border-brand-lime dark:bg-brand-lime/10' : 'border-line hover:bg-mint/40 dark:border-surface-border'}`}>
                    <span className="block text-[13px] font-bold text-[#18231E] dark:text-surface-text">{o.label}</span>
                    <span className="mt-0.5 block text-xs text-[#6A7771] dark:text-surface-muted">{o.hint}</span>
                    {sug && <span className="mt-1.5 block text-[12px] font-semibold text-primary-700 dark:text-brand-lime">{sug.label}: <HijriDate date={sug.date} withGregorian /></span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Campaign name" required value={form.name} onChange={(e) => set({ name: e.target.value })} />
            <Input label="Name in Malayalam" value={form.nameMl} onChange={(e) => set({ nameMl: e.target.value })} className="font-malayalam" />
            <div>
              <DateInput showHijri label="Starts on" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} />
              {form.startDate && <p className="mt-1 text-[12px] text-[#7B8983]"><HijriDate date={form.startDate} /></p>}
            </div>
            <div>
              <DateInput showHijri label="Ends on" min={form.startDate || undefined} value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} />
              {form.endDate && <p className="mt-1 text-[12px] text-[#7B8983]"><HijriDate date={form.endDate} /></p>}
            </div>
            <div className="md:col-span-2">
              <label className={labelClasses}>What is it for?</label>
              <textarea rows={3} value={form.description} onChange={(e) => set({ description: e.target.value })} className={`${controlClasses} py-2`} />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {isFitr && (
              <AmountInput label="Zakat al-Fitr per person (Rs)" required value={form.perHeadAmount}
                onChange={(e) => set({ perHeadAmount: e.target.value })} helperText="Each family is asked for this amount times its living members." />
            )}
            <AmountInput label="Target amount (Rs, optional)" value={form.targetAmount} onChange={(e) => set({ targetAmount: e.target.value })}
              helperText="Leave empty if there is no fixed target." />
            <div className="md:col-span-2">
              <label className={labelClasses}>Post receipts to this income ledger (optional)</label>
              <select className={`${controlClasses} h-9`} value={form.ledgerId} onChange={(e) => set({ ledgerId: e.target.value })}>
                <option value="">Do not post to the ledger</option>
                {ledgers.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
              <p className="mt-1 text-xs text-[#7B8983] dark:text-surface-muted">When chosen, every receipt is added to this ledger as income, and removed again if the receipt is cancelled.</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <dl className="grid grid-cols-1 gap-3 text-[13px] sm:grid-cols-2">
            {[
              ['Type', campaignTypeLabel(form.type)],
              ['Name', form.name || '-'],
              ['Dates', form.startDate ? `${form.startDate}${form.endDate ? ' to ' + form.endDate : ''}` : 'Not set'],
              ['Target', form.targetAmount ? formatINR(Number(form.targetAmount)) : 'No target'],
              ...(isFitr ? [['Per person', form.perHeadAmount ? formatINR(Number(form.perHeadAmount)) : '-']] : []),
              ['Ledger', ledgerName || 'Not posted to a ledger'],
            ].map(([k, v]) => (
              <div key={k}><dt className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771]">{k}</dt><dd className="font-semibold text-[#18231E] dark:text-surface-text">{v}</dd></div>
            ))}
          </dl>
        )}
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="secondary" onClick={() => (step === 0 || (editing && step === 1) ? navigate(editing ? `/campaigns/${id}` : '/campaigns') : setStep(step - 1))}>
          {step === 0 || (editing && step === 1) ? 'Cancel' : 'Back'}
        </Button>
        {step < 3 ? <Button onClick={next}>Continue</Button> : <Button onClick={save} isLoading={saving}>{editing ? 'Save changes' : 'Create campaign'}</Button>}
      </div>
    </div>
  );
}
