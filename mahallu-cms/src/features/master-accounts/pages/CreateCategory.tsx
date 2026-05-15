import { useState } from 'react';
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
import { ROUTES } from '@/constants/routes';
import { masterAccountService } from '@/services/masterAccountService';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  type: z.enum(['income', 'expense'], { required_error: 'Type is required' }),
  description: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

export default function CreateCategory() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      type: 'income',
    },
  });

  const onSubmit = async (data: CategoryFormData) => {
    try {
      setError(null);
      await masterAccountService.createCategory({
        name: data.name,
        nameMl: data.nameMl,
        type: data.type,
        description: data.description,
      });
      navigate(ROUTES.MASTER_ACCOUNTS.CATEGORIES);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create category. Please try again.');
      console.error('Error creating category:', err);
    }
  };

  return (
    <div className="space-y-6">
      <Breadcrumb
        items={[
          { label: 'Dashboard', path: '/dashboard' },
          { label: 'Categories', path: ROUTES.MASTER_ACCOUNTS.CATEGORIES },
          { label: 'Create' },
        ]}
      />

      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Category</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Add a new income or expense category</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <Input label="Category Name" {...register('name')} error={errors.name?.message} placeholder="e.g., Donations, Salaries" />
            </div>
            <div className="md:col-span-2 hidden">
              <Input label="Category Name (Malayalam)" {...register('nameMl')} placeholder="വിഭാഗം നാമം" className="font-malayalam" />
            </div>

            <Select
              label="Type"
              {...register('type')}
              error={errors.type?.message}
              options={[
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expense' },
              ]}
            />

            <div className="md:col-span-2">
              <Input label="Description" {...register('description')} error={errors.description?.message} placeholder="Optional description" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.CATEGORIES)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Category'}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

