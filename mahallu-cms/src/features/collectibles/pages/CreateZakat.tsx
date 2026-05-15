import { useState, useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import MultiSelect from '@/components/ui/MultiSelect';
import { collectibleService } from '@/services/collectibleService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { downloadInvoicePdf, InvoiceDetails } from '@/utils/invoiceUtils';

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
    formState: { errors, isSubmitting },
  } = useForm<ZakatFormData>({
    resolver: zodResolver(zakatSchema),
    defaultValues: {
      payerIds: [],
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

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
      setSubmitError(err.response?.data?.message || 'Failed to create zakat payment. Please try again.');
      console.error('Error creating zakat:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Zakat Payment</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Record a new zakat payment</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Zakat', path: '/collectibles/zakat' },
            { label: 'Create' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {submitError && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {submitError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <Input
              label="Amount"
              type="number"
              step="0.01"
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

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate('/collectibles/zakat')}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Payment
            </Button>
          </div>
        </Card>
      </form>

      {createdInvoices.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Created Invoices</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">Download receipts for the new payments</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/collectibles/zakat')}>
              Go to Zakat
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {createdInvoices.map((invoice, index) => (
              <div
                key={`${invoice.receiptNo || 'invoice'}-${index}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 dark:border-gray-700 px-4 py-3"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {invoice.payerName}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Receipt: {invoice.receiptNo || 'Auto-generated'}
                  </div>
                </div>
                <Button
                  variant="outline"
                  onClick={() => downloadInvoicePdf(invoice)}
                >
                  Download PDF
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

