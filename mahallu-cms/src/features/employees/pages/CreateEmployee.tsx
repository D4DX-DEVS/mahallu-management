import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import QuickAddInstitute from '@/components/quick-add/QuickAddInstitute';
import { ROUTES } from '@/constants/routes';
import { employeeService } from '@/services/employeeService';
import { instituteService } from '@/services/instituteService';
import { useAuthStore } from '@/store/authStore';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const employeeSchema = z.object({
  instituteId: z.string().max(200, 'Please keep the institute to 200 characters or less.').min(1, 'Institute is required'),
  name: z.string().max(200, 'Please keep the name to 200 characters or less.').min(1, 'Name is required'),
  nameMl: z.string().max(200, 'Please keep the name to 200 characters or less.').optional(),
  phone: z.string().max(200, 'Please keep the phone to 200 characters or less.').optional(),
  email: z.string().max(254, 'Please keep the email to 254 characters or less.').email('Invalid email').optional().or(z.literal('')),
  designation: z.string().max(200, 'Please keep the designation to 200 characters or less.').min(1, 'Designation is required'),
  designationMl: z.string().max(200, 'Please keep the designation to 200 characters or less.').optional(),
  department: z.string().max(200, 'Please keep the department to 200 characters or less.').optional(),
  joinDate: z.string().max(200, 'Please keep the join date to 200 characters or less.').min(1, 'Join Date is required'),
  salary: z.string().max(200, 'Please keep the salary to 200 characters or less.').optional(),
  qualifications: z.string().max(200, 'Please keep the qualifications to 200 characters or less.').optional(),
  // An account number keeps its leading zeros, so it stays text.
  'bankAccount.accountNumber': z.string().max(34, 'Please enter a shorter account number.').optional(),
  'bankAccount.bankName': z.string().max(200, 'Please keep the bank name to 200 characters or less.').optional(),
  'bankAccount.ifscCode': z.string().max(11, 'Please enter a valid IFSC code.').optional(),
  status: z.enum(['active', 'on_leave', 'resigned', 'terminated']).optional(),
});

type EmployeeFormData = z.infer<typeof employeeSchema>;

export default function CreateEmployee() {
  const navigate = useNavigate();
  const { currentInstituteId: userInstituteId } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [institutes, setInstitutes] = useState<{ id: string; name: string }[]>([]);
  const [addInstituteOpen, setAddInstituteOpen] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeSchema),
    defaultValues: {
      instituteId: userInstituteId || '',
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    if (!userInstituteId) {
      fetchInstitutes();
    }
  }, []);

  const fetchInstitutes = async () => {
    try {
      const result = await instituteService.getAll({ limit: 1000 });
      setInstitutes(result.data.map((i: any) => ({ id: i.id, name: i.name })));
    } catch (err) {
      console.error('Error fetching institutes:', err);
    }
  };

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

      if (data['bankAccount.accountNumber'] || data['bankAccount.bankName']) {
        employeeData.bankAccount = {
          accountNumber: data['bankAccount.accountNumber'],
          bankName: data['bankAccount.bankName'],
          ifscCode: data['bankAccount.ifscCode'],
        };
      }

      await employeeService.create(employeeData);
      navigate(ROUTES.EMPLOYEES.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create employee. please try again' }));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Create Employee"
        description="Add a new employee"
        breadcrumbs={[{ label: 'Employees', path: ROUTES.EMPLOYEES.LIST }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!userInstituteId ? (
              <Select
                label="Institute"
                options={[
                  { value: '', label: 'Select Institute...' },
                  ...institutes.map((i) => ({ value: i.id, label: i.name })),
                ]}
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
            <Input
              label="Name"
              {...register('name')}
              error={errors.name?.message}
              required
              placeholder="Full Name"
              className={userInstituteId ? 'md:col-span-2' : ''}
            />
            <div className="hidden">
              <Input
                label="Name (Malayalam)"
                {...register('nameMl')}
                placeholder="പേര്"
                className="font-malayalam"
              />
            </div>
            <Input
              label="Designation"
              {...register('designation')}
              error={errors.designation?.message}
              required
              placeholder="e.g. Teacher, Manager"
            />
            <div className="hidden">
              <Input
                label="Designation (Malayalam)"
                {...register('designationMl')}
                placeholder="സ്ഥാനപ്പേര്"
                className="font-malayalam"
              />
            </div>
            <Input label="Department" {...register('department')} placeholder="e.g. Education, Admin" />
            <Input label="Phone" type="tel" {...register('phone')} placeholder="Phone Number" />
            <Input
              label="Email"
              type="email"
              {...register('email')}
              error={errors.email?.message}
              placeholder="Email (Optional)"
            />
            <Input
              label="Join Date"
              type="date"
              {...register('joinDate')}
              error={errors.joinDate?.message}
              required
            />
            <Input label="Monthly Salary (₹)" type="number" {...register('salary')} placeholder="0" />
            <Input
              label="Qualifications"
              {...register('qualifications')}
              placeholder="e.g. B.Ed, MBA"
              className="md:col-span-2"
            />
            <Select
              label="Status"
              options={[
                { value: 'active', label: 'Active' },
                { value: 'on_leave', label: 'On Leave' },
                { value: 'resigned', label: 'Resigned' },
                { value: 'terminated', label: 'Terminated' },
              ]}
              {...register('status')}
              className="md:col-span-2"
            />
          </div>

          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pt-4 border-t border-gray-200 dark:border-gray-700">
            Bank Account (Optional)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input
              label="Account Number"
              {...register('bankAccount.accountNumber')}
              placeholder="Account Number"
            />
            <Input label="Bank Name" {...register('bankAccount.bankName')} placeholder="Bank Name" />
            <Input label="IFSC Code" {...register('bankAccount.ifscCode')} placeholder="IFSC Code" />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.EMPLOYEES.LIST)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Employee
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
