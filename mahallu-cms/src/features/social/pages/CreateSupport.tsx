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
import { socialService } from '@/services/socialService';

const supportSchema = z.object({
  subject: z.string().min(2, 'Subject must be between 2 and 200 characters').max(200, 'Subject must be between 2 and 200 characters'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
  priority: z.enum(['low', 'medium', 'high']),
});

type SupportFormData = z.infer<typeof supportSchema>;

export default function CreateSupport() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SupportFormData>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      priority: 'medium',
    },
  });

  const onSubmit = async (data: SupportFormData) => {
    try {
      setError(null);
      await socialService.createSupport(data);
      navigate(ROUTES.SOCIAL.SUPPORT);
    } catch (err: unknown) {
      const apiMessage = (err as any)?.response?.data?.message;
      setError(apiMessage || 'Failed to create support ticket. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">New Support Ticket</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Log a support request</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Support', path: ROUTES.SOCIAL.SUPPORT },
            { label: 'Create' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Subject"
              {...register('subject')}
              error={errors.subject?.message}
              required
              placeholder="Brief summary of the issue"
              className="md:col-span-2"
            />

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Message <span className="text-red-500">*</span>
              </label>
              <textarea
                {...register('message')}
                placeholder="Describe the issue in detail..."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.message && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.message.message}</p>
              )}
            </div>

            <Select
              label="Priority"
              options={[
                { value: 'low', label: 'Low' },
                { value: 'medium', label: 'Medium' },
                { value: 'high', label: 'High' },
              ]}
              {...register('priority')}
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.SOCIAL.SUPPORT)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Ticket
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
