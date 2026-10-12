import { useState, useEffect, useMemo } from 'react';
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
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { tenantService } from '@/services/tenantService';
import { Family, Member } from '@/types';
import { Tenant } from '@/types/tenant';
import { InvoiceDetails } from '@/utils/invoiceUtils';
import { printReceipt } from '../receiptPrint';
import { useAuthStore } from '@/store/authStore';
import { getTenantId as extractTenantId } from '@/utils/tenantHelper';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import AmountInput from '@/components/ui/AmountInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const varisangyaSchema = z.object({
  familyIds: z.array(z.string()).optional(),
  memberIds: z.array(z.string()).optional(),
  amount: z.number().min(0.01, 'Amount is required'),
  paymentDate: z.string().min(1, 'Payment date is required'),
  paymentMethod: z.string().optional(),
  remarks: z.string().optional(),
  remarksMl: z.string().optional(),
});

type VarisangyaFormData = z.infer<typeof varisangyaSchema>;

export default function CreateVarisangya() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [createdInvoices, setCreatedInvoices] = useState<InvoiceDetails[]>([]);
  const [nextReceiptNo, setNextReceiptNo] = useState<string>('Loading...');
  const [tenantData, setTenantData] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const {
    register,
    handleSubmit,
    watch,
    control,
    reset,
    setError,
    clearErrors,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<VarisangyaFormData>({
    mode: 'onTouched',
    resolver: zodResolver(varisangyaSchema),
    defaultValues: {
      familyIds: [],
      memberIds: [],
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const selectedFamilyIds = watch('familyIds') || [];
  const selectedMemberIds = watch('memberIds') || [];

  useEffect(() => {
    fetchTenantData();
    fetchFamilies();
    fetchMembers();
    fetchNextReceiptNo();
  }, []);

  useEffect(() => {
    if ((selectedFamilyIds.length > 0 || selectedMemberIds.length > 0) && !loadingTenant && tenantData && families.length > 0) {
      clearErrors('familyIds');
      setSuggestedAmount();
    }
  }, [selectedFamilyIds, selectedMemberIds, tenantData, loadingTenant, families, members]);

  const fetchTenantData = async () => {
    try {
      setLoadingTenant(true);
      const { currentTenantId, user } = useAuthStore.getState();
      const tenantId = extractTenantId(user, currentTenantId);
      if (tenantId) {
        const tenant = await tenantService.getById(tenantId);
        setTenantData(tenant);
      }
    } catch (err) {
      console.error('Error fetching tenant data:', err);
    } finally {
      setLoadingTenant(false);
    }
  };

  const fetchFamilies = async () => {
    try {
      const result = await familyService.getAll({ limit: 1000 });
      setFamilies(result.data || []);
    } catch (err) {
      console.error('Error fetching families:', err);
      setFamilies([]);
    }
  };

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
      const receiptNo = await collectibleService.getNextReceiptNo('varisangya');
      setNextReceiptNo(receiptNo);
    } catch (err) {
      console.error('Error fetching receipt number:', err);
      setNextReceiptNo('Auto-generated');
    }
  };

  const setSuggestedAmount = () => {
    if (!tenantData || loadingTenant) return;
    if (!families.length && !members.length) return;

    console.log('Setting suggested amount...', {
      selectedFamilyIds,
      selectedMemberIds,
      tenantData: tenantData.settings,
    });

    // Suggest amount based on first selected entity
    let suggestedAmount = 0;

    // If family is selected, use the first family's grade amount
    if (selectedFamilyIds.length > 0) {
      const firstFamily = families.find((f) => f.id === selectedFamilyIds[0]);
      console.log('First family:', firstFamily);
      if (firstFamily?.varisangyaGrade && tenantData.settings?.varisangyaGrades) {
        const gradeConfig = tenantData.settings.varisangyaGrades.find(
          (grade) => grade.name === firstFamily.varisangyaGrade
        );
        console.log('Grade config:', gradeConfig);
        if (gradeConfig) {
          suggestedAmount = gradeConfig.amount;
        }
      }
    }

    // If no amount found from family, and members are selected, use default member amount
    if (suggestedAmount === 0 && selectedMemberIds.length > 0) {
      suggestedAmount = tenantData.settings?.varisangyaAmount || 0;
      console.log('Using member amount:', suggestedAmount);
    }

    // Set the suggested amount
    console.log('Final suggested amount:', suggestedAmount);
    if (suggestedAmount > 0) {
      setValue('amount', suggestedAmount);
    }
  };

  const onSubmit = async (data: VarisangyaFormData) => {
    const familyIds = data.familyIds?.filter(Boolean) || [];
    const memberIds = data.memberIds?.filter(Boolean) || [];

    if (familyIds.length === 0 && memberIds.length === 0) {
      setError('familyIds', { type: 'manual', message: 'Select at least one family or member.' });
      return;
    }

    const { currentTenantId, user } = useAuthStore.getState();
    const tenantId = extractTenantId(user, currentTenantId);
    if (!tenantId) {
      setSubmitError("We couldn't tell which mahallu this belongs to. Sign in again or choose a mahallu first.");
      return;
    }

    try {
      setSubmitError(null);
      clearErrors('familyIds');
      setCreatedInvoices([]);

      const payloadBase = {
        tenantId,
        amount: data.amount,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod,
        remarks: data.remarks,
        remarksMl: data.remarksMl,
      };

      const payloads = [
        ...familyIds.map((familyId) => ({ ...payloadBase, familyId })),
        ...memberIds.map((memberId) => ({ ...payloadBase, memberId })),
      ];

      const results = [];
      for (const payload of payloads) {
        results.push(await collectibleService.createVarisangya(payload));
      }

      const familyMap = new Map(families.map((f) => [f.id, f]));
      const memberMap = new Map(members.map((m) => [m.id, m]));

      const invoices: InvoiceDetails[] = results.map((entry) => {
        const member = entry.memberId ? memberMap.get(entry.memberId) : undefined;
        const family = entry.familyId ? familyMap.get(entry.familyId) : undefined;
        return {
          title: 'Varisangya Invoice',
          receiptNo: entry.receiptNo,
          receiptRef: { type: 'varisangya', id: entry.id },
          payerLabel: member ? 'Member' : 'Family',
          payerName: member?.name || family?.houseName || 'Unknown',
          amount: entry.amount,
          paymentDate: entry.paymentDate,
          paymentMethod: entry.paymentMethod,
          remarks: entry.remarks,
        };
      });

      setCreatedInvoices(invoices);
      fetchNextReceiptNo();
      reset({
        familyIds: [],
        memberIds: [],
        amount: undefined as unknown as number,
        paymentDate: new Date().toISOString().split('T')[0],
        paymentMethod: '',
        remarks: '',
        remarksMl: '',
      });
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create varisangya payment. Check the details and try again."));
      console.error('Error creating varisangya:', err);
    }
  };

  const getMemberFamilyId = (member: Member): string => {
    const f = member.familyId;
    if (typeof f === 'string') return f;
    if (f && typeof f === 'object') return (f as { id?: string }).id ?? String((f as { _id?: unknown })._id ?? '');
    return '';
  };

  const filteredMembers = useMemo(() => {
    if (selectedFamilyIds.length === 0) return members;
    return members.filter((member) => selectedFamilyIds.includes(getMemberFamilyId(member)));
  }, [members, selectedFamilyIds]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Varisangya Payment"
        description="Record a new varisangya payment"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {submitError && (
            <Alert tone="danger">{submitError}</Alert>
          )}

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Payment details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Families or members, amount and payment method</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Controller
                control={control}
                name="familyIds"
                render={({ field }) => (
                  <MultiSelect
                    label="Families (Optional)"
                    options={families.map((family) => {
                      let amountInfo = '';
                      if (family.varisangyaGrade && tenantData?.settings?.varisangyaGrades) {
                        const gradeConfig = tenantData.settings.varisangyaGrades.find(
                          (grade) => grade.name === family.varisangyaGrade
                        );
                        if (gradeConfig) {
                          amountInfo = ` - ₹${gradeConfig.amount}`;
                        }
                      }
                      return {
                        value: family.id,
                        label: `${family.houseName}${amountInfo}`,
                      };
                    })}
                    value={field.value || []}
                    onChange={field.onChange}
                    error={errors.familyIds?.message}
                    placeholder="Select families"
                    showSelectAll
                    disabled={loadingTenant}
                  />
                )}
              />
              <Controller
                control={control}
                name="memberIds"
                render={({ field }) => {
                  const memberAmount = tenantData?.settings?.varisangyaAmount || 0;
                  return (
                    <MultiSelect
                      label={`Members (Optional)${memberAmount > 0 ? ` - ₹${memberAmount} each` : ''}`}
                      options={filteredMembers.map((member) => ({
                        value: member.id,
                        label: `${member.name} (${member.familyName})`,
                      }))}
                      value={field.value || []}
                      onChange={field.onChange}
                      placeholder="Select members"
                      showSelectAll
                      disabled={loadingTenant}
                    />
                  );
                }}
              />
              <AmountInput
                label="Amount (per invoice)"
                {...register('amount', { valueAsNumber: true })}
                error={errors.amount?.message}
                required
                placeholder="Amount"
                helperText="This amount will be used for each selected family/member"
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => guard.guardedNavigate('/collectibles/varisangya')}
            >
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
            <Button variant="secondary" onClick={() => guard.guardedNavigate('/collectibles/varisangya')}>
              Go to Varisangyas
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

