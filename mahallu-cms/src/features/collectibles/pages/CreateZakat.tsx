import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import PageHeader from '@/components/ui/PageHeader';
import { collectibleService } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { InvoiceDetails } from '@/utils/invoiceUtils';
import { printReceipt } from '../receiptPrint';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import AmountInput from '@/components/ui/AmountInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const zakatSchema = z.object({
  payerIds: z.array(z.string()).min(1, 'Payer name is required'),
  amount: z.number().min(0.01, 'Amount is required'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.string().optional(),
  category: z.string().optional(),
  remarks: z.string().optional(),
  remarksMl: z.string().optional(),
});

type ZakatFormData = z.infer<typeof zakatSchema>;

export default function CreateZakat() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [createdInvoices, setCreatedInvoices] = useState<InvoiceDetails[]>([]);
  const [nextReceiptNo, setNextReceiptNo] = useState<string>('Loading...');
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ZakatFormData>({
    mode: 'onTouched',
    resolver: zodResolver(zakatSchema),
    defaultValues: {
      payerIds: [],
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    fetchMembers();
    fetchNextReceiptNo();
  }, []);

  const fetchMembers = async () => {
    try {
      const result = await memberService.getAll({ limit: 10000 });
      setMembers(result.data || []);
    } catch (err) {
      console.error('Error fetching members:', err);
    }
  };

  const fetchNextReceiptNo = async () => {
    try {
      const receiptNo = await collectibleService.getNextReceiptNo('zakat');
      setNextReceiptNo(receiptNo);
    } catch (err) {
      console.error('Error fetching receipt number:', err);
      setNextReceiptNo('Auto-generated');
    }
  };

  const onSubmit = async (data: ZakatFormData) => {
    try {
      setSubmitError(null);
      setCreatedInvoices([]);

      const payloadBase = {
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        category: data.category,
        remarks: data.remarks,
        remarksMl: data.remarksMl,
      };

      const memberMap = new Map(members.map((member) => [member.id, member]));

      const payloads = (data.payerIds || []).map((payerId) => {
        const member = memberMap.get(payerId);
        return {
          ...payloadBase,
          payerId,
          payerName: member?.name || 'Unknown',
        };
      });

      const results = [];
      for (const payload of payloads) {
        results.push(await collectibleService.createZakat(payload));
      }
      const invoices: InvoiceDetails[] = results.map((entry) => {
        const member = entry.payerId ? memberMap.get(entry.payerId) : undefined;
        return {
          title: 'Zakat Invoice',
          receiptNo: entry.receiptNo,
          receiptRef: { type: 'zakat', id: entry.id },
          payerLabel: 'Payer',
          payerName: member?.name || entry.payerName || 'Unknown',
          amount: entry.amount,
          paymentDate: entry.paymentDate,
          paymentMethod: entry.paymentMethod,
          remarks: entry.remarks,
        };
      });

      setCreatedInvoices(invoices);
      fetchNextReceiptNo();
      reset({
        payerIds: [],
        amount: undefined as unknown as number,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        category: '',
        remarks: '',
        remarksMl: '',
      });
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create zakat payment. Check the details and try again."));
      console.error('Error creating zakat:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Zakat Payment"
        description="Record a new zakat payment"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {submitError && (
            <Alert tone="danger">{submitError}</Alert>
          )}

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Payment details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Payers, amount and payment method</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                control={control}
                name="payerIds"
                render={({ field }) => (
                  <MultiSelect
                    label="Payer Name"
                    options={members.map((member) => ({
                      value: member.id,
                      label: `${member.name} (${member.familyName})`,
                    }))}
                    value={field.value || []}
                    onChange={field.onChange}
                    error={errors.payerIds?.message}
                    placeholder="Select payer(s)"
                    showSelectAll
                  />
                )}
              />
              <AmountInput
                label="Amount"
                {...register('amount', { valueAsNumber: true })}
                error={errors.amount?.message}
                required
                placeholder="Amount"
              />
              <Input
                label="Payment Date"
                type="date"
                {...register('paymentDate')}
                error={errors.paymentDate?.message}
                required
              />
              <Select
                label="Payment Method"
                options={[
                  { value: '', label: 'Select Method' },
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank', label: 'Bank Transfer' },
                  { value: 'cheque', label: 'Cheque' },
                  { value: 'online', label: 'Online' },
                ]}
                {...register('paymentMethod')}
              />
              <Input
                label="Next Receipt No."
                value={nextReceiptNo}
                disabled
                helperText="Each payment will increment this number."
              />
              <Input label="Category" {...register('category')} placeholder="Category" />
              <Input
                label="Remarks"
                {...register('remarks')}
                placeholder="Remarks"
                className="md:col-span-2"
              />
              <div className="hidden">
              <Input
                label="Remarks (Malayalam)"
                {...register('remarksMl')}
                placeholder="കുറിപ്പ്"
                className="md:col-span-2 font-malayalam"
              />
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate('/collectibles/zakat')}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Payment
            </Button>
          </div>
        </div>
      </form>

      {createdInvoices.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Created Invoices</h2>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Download receipts for the new payments</p>
            </div>
            <Button variant="secondary" onClick={() => guard.guardedNavigate('/collectibles/zakat')}>
              Go to Zakat
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {createdInvoices.map((invoice, index) => (
              <div
                key={`${invoice.receiptNo || 'invoice'}-${index}`}
                className="flex items-center justify-between rounded-xl border border-line dark:border-surface-border px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-[#18231E] dark:text-surface-text">
                    {invoice.payerName}
                  </div>
                  <div className="text-xs text-[#7B8983] dark:text-surface-muted">
                    Receipt: {invoice.receiptNo || 'Auto-generated'}
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => printReceipt(invoice)}
                >
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

