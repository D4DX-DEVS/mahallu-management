import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import Alert from '@/components/ui/Alert';
import AmountInput from '@/components/ui/AmountInput';
import DraftAlert from '@/components/ui/DraftAlert';
import FormSection, { ReviewList } from '@/components/ui/FormSection';
import Input from '@/components/ui/Input';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import PhoneInput from '@/components/ui/PhoneInput';
import Select from '@/components/ui/Select';
import Stepper from '@/components/ui/Stepper';
import StickyActionBar from '@/components/ui/StickyActionBar';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import QuickAddInstitute from '@/components/quick-add/QuickAddInstitute';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { INDIAN_MOBILE_RE, PHONE_ERROR, formatIndianNumber } from '@/utils/formFields';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useFormDraft } from '@/hooks/useFormDraft';
import { useFormWizard, WizardStep } from '@/hooks/useFormWizard';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const employeeSchema = z.object({
  instituteId: z.string().min(1, 'Select an institute'),
  name: z.string().trim().min(1, 'Enter the employee name'),
  nameMl: z.string().optional(),
  phone: z.string().optional().refine((val) => !val || INDIAN_MOBILE_RE.test(val), { message: PHONE_ERROR }),
  email: z.string().email('Enter a valid email address, e.g. name@example.com').optional().or(z.literal('')),
  designation: z.string().trim().min(1, 'Enter the designation'),
  designationMl: z.string().optional(),
  department: z.string().optional(),
  joinDate: z.string().min(1, 'Choose the join date'),
  salary: z
    .string()
    .optional()
    .refine((val) => !val || (Number.isFinite(Number(val)) && Number(val) >= 0), { message: 'Enter a valid amount, for example 12500' }),
  qualifications: z.string().optional(),
  bankAccount: z
    .object({
      accountNumber: z.string().optional(),
      bankName: z.string().optional(),
      ifscCode: z
        .string()
        .optional()
        .refine((val) => !val || /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/.test(val), { message: 'IFSC is 11 characters, e.g. SBIN0001234' }),
    })
    .optional(),
  status: z.enum(['active', 'inactive', 'on_leave', 'resigned', 'terminated']).optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

const STEPS: WizardStep<EmployeeFormData>[] = [
  { id: 'basics', label: 'Basics', fields: ['instituteId', 'name', 'designation', 'phone', 'email'] },
  { id: 'employment', label: 'Employment', fields: ['joinDate', 'salary'] },
  { id: 'bank', label: 'Bank', fields: ['bankAccount.ifscCode'] },
  { id: 'review', label: 'Review', fields: [] },
];

const statusOptions = [
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'resigned', label: 'Resigned' },
  { value: 'terminated', label: 'Terminated' },
];

/** Shared 4-step wizard for creating and editing an employee (Basics > Employment > Bank > Review). */
export default function EmployeeFormWizard({ mode }: { mode: 'create' | 'edit' }) {
  const isEdit = mode === 'edit';
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [addInstituteOpen, setAddInstituteOpen] = useState(false);

  const form = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    mode: 'onTouched',
    defaultValues: {
      instituteId: userInstituteId || '',
      name: '',
      nameMl: '',
      designationMl: '',
      department: '',
      qualifications: '',
      phone: '',
      email: '',
      designation: '',
      salary: '',
      status: 'active',
      joinDate: isEdit ? '' : new Date().toISOString().split('T')[0],
      bankAccount: { accountNumber: '', bankName: '', ifscCode: '' },
    },
  });
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = form;

  const wizard = useFormWizard(form, STEPS);
  const draft = useFormDraft<EmployeeFormData>(isEdit ? `employee:edit:${id}` : 'employee:create', form, {
    ready: !loading,
    onRestore: (s) => typeof s === 'number' && wizard.setStep(Math.min(s, STEPS.length - 1)),
  });
  const guard = useUnsavedChangesGuard(isDirty);
  const listPath = ROUTES.EMPLOYEES.LIST;

  useEffect(() => {
    if (userInstituteId) return;
    instituteService
      .getAll({ limit: 1000 })
      .then((result) => setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name }))))
      .catch((err) => console.error('Error fetching institutes:', err));
  }, [userInstituteId]);

  useEffect(() => {
    if (!isEdit || !id) return;
    (async () => {
      try {
        setLoading(true);
        const employee: any = await employeeService.getById(id);
        reset({
          instituteId: employee.instituteId || '',
          name: employee.name,
          nameMl: employee.nameMl || '',
          phone: employee.phone || '',
          email: employee.email || '',
          designation: employee.designation,
          designationMl: employee.designationMl || '',
          department: employee.department || '',
          joinDate: employee.joinDate ? new Date(employee.joinDate).toISOString().split('T')[0] : '',
          salary: employee.salary ? String(employee.salary) : '',
          qualifications: employee.qualifications || '',
          status: employee.status || 'active',
          bankAccount: {
            accountNumber: employee.bankAccount?.accountNumber || '',
            bankName: employee.bankAccount?.bankName || '',
            ifscCode: employee.bankAccount?.ifscCode || '',
          },
        });
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load employee. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    })();
  }, [id, isEdit, reset]);

  const onSubmit = async (data: EmployeeFormData) => {
    try {
      setError(null);
      const employeeData: any = {
        instituteId: data.instituteId,
        name: data.name,
        nameMl: data.nameMl,
        phone: data.phone,
        email: data.email || undefined,
        designation: data.designation,
        designationMl: data.designationMl,
        department: data.department,
        joinDate: data.joinDate,
        salary: data.salary ? Number(data.salary) : undefined,
        qualifications: data.qualifications,
        status: data.status || 'active',
      };
      if (data.bankAccount?.accountNumber || data.bankAccount?.bankName) {
        employeeData.bankAccount = {
          accountNumber: data.bankAccount.accountNumber,
          bankName: data.bankAccount.bankName,
          ifscCode: data.bankAccount.ifscCode,
        };
      }
      if (isEdit) await employeeService.update(id!, employeeData);
      else await employeeService.create(employeeData);
      draft.clearDraft();
      navigate(listPath);
    } catch (err: any) {
      toast.error(getFriendlyError(err, `Couldn't ${isEdit ? 'update' : 'create'} the employee. Check the details and try again.`));
    }
  };

  const onInvalid = (errs: Record<string, unknown>) => {
    const i = wizard.stepOfFirstError(errs);
    if (i >= 0) wizard.setStep(i);
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  const v = watch();
  const show = (i: number) => (wizard.step === i ? undefined : true);
  const instituteOptions = [{ value: '', label: 'Select Institute...' }, ...institutes.map((i) => ({ value: i.id, label: i.name }))];
  const maskedAccount = v.bankAccount?.accountNumber ? `•••• ${v.bankAccount.accountNumber.slice(-4)}` : undefined;

  return (
    <div className="space-y-4">
      <PageHeader title={isEdit ? 'Edit Employee' : 'Create Employee'} description={isEdit ? 'Update employee information' : 'Add a new employee'} />

      <Stepper steps={STEPS} current={wizard.step} maxVisited={wizard.maxVisited} onStepClick={wizard.goTo} />

      <form
        noValidate
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (wizard.isLast) handleSubmit(onSubmit, onInvalid)(e);
          else wizard.next();
        }}
      >
        {draft.restored && <DraftAlert savedAt={draft.savedAt} onDiscard={draft.discardDraft} />}
        {error && <Alert tone="danger">{error}</Alert>}

        <div hidden={show(0)} className="space-y-4">
          <FormSection title="Basic information" description="Who the employee is and where they work">
            {!userInstituteId ? (
              <Select
                label="Institute"
                options={instituteOptions}
                value={v.instituteId || ''}
                onAddNew={isEdit ? undefined : () => setAddInstituteOpen(true)}
                addNewLabel="Add Institute"
                {...register('instituteId')}
                error={errors.instituteId?.message}
                required
              />
            ) : (
              <input type="hidden" {...register('instituteId')} />
            )}
            <Input label="Name" {...register('name')} error={errors.name?.message} required placeholder="Full name" className={userInstituteId ? 'md:col-span-2' : ''} />
            <div className="hidden">
              <Input label="Name (Malayalam)" {...register('nameMl')} placeholder="പേര്" className="font-malayalam" />
            </div>
            <Input label="Designation" {...register('designation')} error={errors.designation?.message} required placeholder="e.g. Teacher, Manager" />
            <div className="hidden">
              <Input label="Designation (Malayalam)" {...register('designationMl')} placeholder="സ്ഥാനപ്പേര്" className="font-malayalam" />
            </div>
            <Input label="Department" {...register('department')} placeholder="e.g. Education, Admin" />
            <PhoneInput label="Phone" {...register('phone')} error={errors.phone?.message} />
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} placeholder="name@example.com (optional)" />
          </FormSection>
        </div>

        <div hidden={show(1)} className="space-y-4">
          <FormSection title="Employment" description="Joining date, pay and status">
            <Input label="Join date" type="date" {...register('joinDate')} error={errors.joinDate?.message} required />
            <AmountInput
              label="Monthly salary (₹)"
              {...register('salary')}
              error={errors.salary?.message}
              helperText="Shown with lakh grouping, e.g. 1,25,000"
              placeholder="0"
            />
            <Input label="Qualifications" {...register('qualifications')} placeholder="e.g. B.Ed, MBA" className="md:col-span-2" />
            <Select
              label="Status"
              options={isEdit && v.status === 'inactive' ? [...statusOptions, { value: 'inactive', label: 'Inactive' }] : statusOptions}
              value={v.status || 'active'}
              {...register('status')}
              className="md:col-span-2"
            />
          </FormSection>
        </div>

        <div hidden={show(2)} className="space-y-4">
          <FormSection title="Bank account" description="Optional, used for salary transfers" columns={3}>
            <Input label="Account number" {...register('bankAccount.accountNumber')} inputMode="numeric" placeholder="Account number" />
            <Input label="Bank name" {...register('bankAccount.bankName')} placeholder="Bank name" />
            <Input
              label="IFSC code"
              {...register('bankAccount.ifscCode', { setValueAs: (s: string) => (s || '').toUpperCase() })}
              error={errors.bankAccount?.ifscCode?.message}
              placeholder="SBIN0001234"
              maxLength={11}
              className="uppercase"
            />
          </FormSection>
        </div>

        {wizard.isLast && (
          <FormSection title="Review" description="Check everything before saving. Use Back or the steps above to change anything." columns={1}>
            <ReviewList
              items={[
                { label: 'Name', value: v.name },
                { label: 'Institute', value: userInstituteId ? undefined : instituteOptions.find((o) => o.value === v.instituteId)?.label },
                { label: 'Designation', value: v.designation },
                { label: 'Department', value: v.department },
                { label: 'Phone', value: v.phone },
                { label: 'Email', value: v.email },
                { label: 'Join date', value: v.joinDate },
                { label: 'Monthly salary', value: v.salary ? `₹${formatIndianNumber(v.salary)}` : undefined },
                { label: 'Qualifications', value: v.qualifications },
                { label: 'Status', value: statusOptions.find((o) => o.value === v.status)?.label || v.status },
                { label: 'Bank', value: [v.bankAccount?.bankName, maskedAccount, v.bankAccount?.ifscCode].filter(Boolean).join(' · ') },
              ]}
            />
          </FormSection>
        )}

        <StickyActionBar
          stepText={`Step ${wizard.step + 1} of ${STEPS.length}`}
          dirty={isDirty}
          draftSaved={!!draft.savedAt}
          onCancel={() => guard.guardedNavigate(listPath)}
          onSaveDraft={() => draft.saveDraft(wizard.step)}
          onBack={wizard.isFirst ? undefined : wizard.back}
          onNext={wizard.next}
          nextLabel={`Next: ${STEPS[Math.min(wizard.step + 1, STEPS.length - 1)].label}`}
          isLast={wizard.isLast}
          submitLabel={isEdit ? 'Update employee' : 'Create employee'}
          isSubmitting={isSubmitting}
        />
      </form>

      <UnsavedChangesDialog guard={guard} />

      {!userInstituteId && !isEdit && (
        <QuickAddInstitute
          open={addInstituteOpen}
          onClose={() => setAddInstituteOpen(false)}
          onCreated={(newInstitute) => {
            setInstitutes((prev) => [...prev, { id: newInstitute.id, name: newInstitute.label }]);
            setValue('instituteId', newInstitute.id, { shouldValidate: true, shouldDirty: true });
          }}
        />
      )}
    </div>
  );
}
