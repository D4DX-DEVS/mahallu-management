import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import QuickAddInstitute from '@/components/quick-add/QuickAddInstitute';
import { ROUTES } from '@/constants/routes';
import { salaryService } from '@/services/salaryService';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';

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
    formState: { errors, isSubmitting },
  } = useForm<SalaryFormData>({
    resolver: zodResolver(salarySchema),
    defaultValues: {
      instituteId: userInstituteId || '',
      month: String(new Date().getMonth() + 1),
      year: String(new Date().getFullYear()),
      status: 'pending',
      paymentDate: new Date().toISOString().split('T')[0],
    },
  });

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
      setError(err.response?.data?.message || 'Failed to create salary payment.');
    }
  };

  const baseSalary = Number(watch('baseSalary') || 0);
  const allowances = Number(watch('allowances') || 0);
  const deductions = Number(watch('deductions') || 0);
  const netAmount = baseSalary + allowances - deductions;

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => ({ value: String(currentYear - i), label: String(currentYear - i) }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Salary Payment</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Record a new salary payment</p>
        </div>
        <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Salary', path: ROUTES.SALARY.LIST }, { label: 'Create' }]} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">{error}</div>
          )}

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Payment Details</h3>
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

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pt-4 border-t border-gray-200 dark:border-gray-700">Amount Breakdown</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Base Salary (₹)" type="number" {...register('baseSalary')} placeholder="0" />
            <Input label="Allowances (₹)" type="number" {...register('allowances')} placeholder="0" />
            <Input label="Deductions (₹)" type="number" {...register('deductions')} placeholder="0" />
          </div>
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-lg font-semibold text-blue-900 dark:text-blue-200">
              Net Amount: <span className="text-2xl">₹{netAmount.toLocaleString()}</span>
            </p>
            <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
              Base ({baseSalary.toLocaleString()}) + Allowances ({allowances.toLocaleString()}) - Deductions ({deductions.toLocaleString()})
            </p>
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pt-4 border-t border-gray-200 dark:border-gray-700">Payment Info</h3>
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

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.SALARY.LIST)}>
              <FiX className="h-4 w-4 mr-2" />Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />Create Payment
            </Button>
          </div>
        </Card>
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
    </div>
  );
}
