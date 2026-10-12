import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import QuickAddInstitute from '@/components/quick-add/QuickAddInstitute';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import AmountInput from '@/components/ui/AmountInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const MONTHS = [
  { value: '1', label: 'January' }, { value: '2', label: 'February' }, { value: '3', label: 'March' },
  { value: '4', label: 'April' }, { value: '5', label: 'May' }, { value: '6', label: 'June' },
  { value: '7', label: 'July' }, { value: '8', label: 'August' }, { value: '9', label: 'September' },
  { value: '10', label: 'October' }, { value: '11', label: 'November' }, { value: '12', label: 'December' },
];

const salarySchema = z.object({
  instituteId: z.string().min(1, 'Institute is required'),
  employeeId: z.string().min(1, 'Employee is required'),
  month: z.string().min(1, 'Month is required'),
  year: z.string().min(1, 'Year is required'),
  baseSalary: z.string().optional(),
  allowances: z.string().optional(),
  deductions: z.string().optional(),
  paymentDate: z.string().optional(),
  paymentMethod: z.string().optional(),
  referenceNo: z.string().optional(),
  status: z.enum(['paid', 'pending', 'cancelled']).optional(),
  remarks: z.string().optional(),
});

type SalaryFormData = z.infer<typeof salarySchema>;

export default function CreateSalaryPayment() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [employees, setEmployees] = useState<{ id: string; name: string; salary: number }[]>([]);
  const [addInstituteOpen, setAddInstituteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<SalaryFormData>({
    mode: 'onTouched',
    resolver: zodResolver(salarySchema),
    defaultValues: {
      instituteId: userInstituteId || '',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
      status: 'pending',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const selectedInstituteId = watch('instituteId');
  const selectedEmployeeId = watch('employeeId');

  useEffect(() => {
    if (!userInstituteId) fetchInstitutes();
    else fetchEmployees(userInstituteId);
  }, []);

  useEffect(() => {
    if (selectedInstituteId && selectedInstituteId !== userInstituteId) {
      fetchEmployees(selectedInstituteId);
    }
  }, [selectedInstituteId]);

  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp && emp.salary) {
        setValue('baseSalary', String(emp.salary));
      }
    }
  }, [selectedEmployeeId, employees]);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) { console.error('Error fetching institutes:', err); }
  };

  const fetchEmployees = async (instId: string) => {
    try {
      const result = await employeeService.getAll({ instituteId: instId, status: 'active', limit: 1000 });
      setEmployees(result.data.map((e: any) => ({ id: e.id, name: e.name, salary: e.salary || 0 })));
    } catch (err) { console.error('Error fetching employees:', err); }
  };

  const onSubmit = async (data: SalaryFormData) => {
    try {
      setError(null);
      const base = Number(data.baseSalary || 0);
      const allow = Number(data.allowances || 0);
      const deduct = Number(data.deductions || 0);
      await salaryService.create({
        instituteId: data.instituteId,
        employeeId: data.employeeId,
        month: Number(data.month),
        year: Number(data.year),
        baseSalary: base,
        allowances: allow,
        deductions: deduct,
        netAmount: base + allow - deduct,
        paymentDate: data.paymentDate,
        paymentMethod: data.paymentMethod as 'cash' | 'bank' | 'upi' | 'cheque',
        referenceNo: data.referenceNo,
        status: data.status as any || 'pending',
        remarks: data.remarks,
      });
      navigate(ROUTES.SALARY.LIST);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create salary payment. Check the details and try again."));
    }
  };

  const baseSalary = Number(watch('baseSalary') || 0);
  const allowances = Number(watch('allowances') || 0);
  const deductions = Number(watch('deductions') || 0);
  const netAmount = baseSalary + allowances - deductions;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  return (
    <div className="space-y-4">
      <PageHeader title="Create Salary Payment" description="Record a new salary payment" />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && <Alert tone="danger">{error}</Alert>}

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Payment details</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Who is being paid and for which period</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!userInstituteId ? (
              <Select
                label="Institute"
                options={[{ value: '', label: 'Select Institute...' }, ...institutes.map(i => ({ value: i.id, label: i.name }))]}
                value={watch('instituteId') || ''}
                onAddNew={() => setAddInstituteOpen(true)}
                addNewLabel="Add Institute"
                {...register('instituteId')}
                error={errors.instituteId?.message}
                required
              />
            ) : (
              <input type="hidden" {...register('instituteId')} />
            )}
            <Select
              label="Employee"
              options={[{ value: '', label: 'Select Employee...' }, ...employees.map(e => ({ value: e.id, label: `${e.name} (₹${e.salary.toLocaleString()})` }))]}
              {...register('employeeId')}
              error={errors.employeeId?.message}
              required
              className={userInstituteId ? '' : ''}
            />
            <Select label="Month" options={MONTHS} {...register('month')} error={errors.month?.message} required />
            <Select label="Year" options={years} {...register('year')} error={errors.year?.message} required />
          </div>

          </Card>

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Amount breakdown</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Base salary, allowances and deductions</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <AmountInput label="Base Salary (₹)" {...register('baseSalary')} placeholder="0" />
            <Input label="Allowances (₹)" type="number" {...register('allowances')} placeholder="0" />
            <Input label="Deductions (₹)" type="number" {...register('deductions')} placeholder="0" />
          </div>
          <div className="mt-3.5 rounded-xl bg-mint p-3.5 dark:bg-brand-lime/10">
            <p className="text-[13px] font-bold text-primary-700 dark:text-brand-lime">
              Net Amount: <span className="text-xl font-extrabold">₹{netAmount.toLocaleString()}</span>
            </p>
            <p className="mt-1 text-xs text-[#5B6963] dark:text-surface-muted">
              Base ({baseSalary.toLocaleString()}) + Allowances ({allowances.toLocaleString()}) - Deductions ({deductions.toLocaleString()})
            </p>
          </div>

          </Card>

          <Card padding="lg">
          <h3 className="text-sm font-bold text-primary-700 dark:text-surface-text">Payment info</h3>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Date, method and reference</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Payment Date" type="date" {...register('paymentDate')} />
            <Select
              label="Payment Method"
              options={[
                { value: '', label: 'Select...' },
                { value: 'cash', label: 'Cash' },
                { value: 'bank_transfer', label: 'Bank Transfer' },
                { value: 'cheque', label: 'Cheque' },
                { value: 'upi', label: 'UPI' },
              ]}
              {...register('paymentMethod')}
            />
            <Input label="Reference No." {...register('referenceNo')} placeholder="Transaction/Cheque No." />
            <Select
              label="Status"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'paid', label: 'Paid' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              {...register('status')}
            />
            <Input label="Remarks" {...register('remarks')} placeholder="Additional notes" className="md:col-span-2" />
          </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none rounded-b-card border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="outline" onClick={() => guard.guardedNavigate(ROUTES.SALARY.LIST)}>
              <FiX className="h-3.5 w-3.5" />Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />Create Payment
            </Button>
          </div>
        </div>
      </form>

      {!userInstituteId && (
        <QuickAddInstitute
          open={addInstituteOpen}
          onClose={() => setAddInstituteOpen(false)}
          onCreated={(newInstitute) => {
            setInstitutes((prev) => [...prev, { id: newInstitute.id, name: newInstitute.label }]);
            setValue('instituteId', newInstitute.id, { shouldValidate: true });
          }}
        />
      )}
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}
