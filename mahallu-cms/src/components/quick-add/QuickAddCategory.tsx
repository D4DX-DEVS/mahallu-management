import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { masterAccountService, Category } from '@/services/masterAccountService';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const categorySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  nameMl: z.string().optional(),
  type: z.enum(['income', 'expense'], { required_error: 'Type is required' }),
  description: z.string().optional(),
});

type CategoryFormData = z.infer<typeof categorySchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  defaultType?: 'income' | 'expense';
  onCreated: (category: { id: string; label: string; type: string }) => void;
}

export default function QuickAddCategory({ open, onClose, defaultType = 'income', onCreated }: Props) {
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormData>({
    resolver: zodResolver(categorySchema),
    defaultValues: { type: defaultType },
  });

  const onSubmit = async (data: CategoryFormData) => {
    try {
      setError(null);
      const created: Category = await masterAccountService.createCategory({
        name: data.name,
        nameMl: data.nameMl,
        type: data.type,
        description: data.description,
      });
      onCreated({ id: created.id, label: created.name, type: created.type || data.type });
      onClose();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create category. Check the details and try again."));
    }
  };

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Category" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Input
              label="Category Name"
              {...register('name')}
              error={errors.name?.message}
              placeholder="e.g., Donations, Salaries"
              required
            />
          </div>
          <div className="md:col-span-2 hidden">
            <Input
              label="Category Name (Malayalam)"
              {...register('nameMl')}
              placeholder="വിഭാഗം നാമം"
              className="font-malayalam"
            />
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
            <Input
              label="Description"
              {...register('description')}
              placeholder="Optional description"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-line-soft pt-4 dark:border-surface-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            <FiX className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-3.5 w-3.5" />
            Create Category
          </Button>
        </div>
      </form>
    </Modal>
  );
}
