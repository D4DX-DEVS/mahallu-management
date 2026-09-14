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
import QuickAddLedger from '@/components/quick-add/QuickAddLedger';
import QuickAddCategory from '@/components/quick-add/QuickAddCategory';
import { ROUTES } from '@/constants/routes';
import { masterAccountService, Ledger, Category } from '@/services/masterAccountService';
import { errorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
import PageHeader from '@/components/layout/PageHeader';

const ledgerItemSchema = z.object({
  ledgerId: z.string().max(200, 'Please keep the ledger to 200 characters or less.').min(1, 'Ledger is required'),
  categoryId: z.string().max(200, 'Please keep the category to 200 characters or less.').optional(),
  date: z.string().max(200, 'Please keep the date to 200 characters or less.').min(1, 'Date is required'),
  amount: z.number().min(0.01, 'Amount must be greater than 0'),
  type: z.enum(['income', 'expense'], { required_error: 'Type is required' }),
  description: z.string().max(3000, 'Please keep the description to 3000 characters or less.').min(1, 'Description is required'),
  paymentMethod: z.string().max(200, 'Please keep the payment method to 200 characters or less.').optional(),
  referenceNo: z.string().max(200, 'Please keep the reference no to 200 characters or less.').optional(),
});

type LedgerItemFormData = z.infer<typeof ledgerItemSchema>;

export default function CreateLedgerItem() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [addLedgerOpen, setAddLedgerOpen] = useState(false);
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LedgerItemFormData>({
    resolver: zodResolver(ledgerItemSchema),
    defaultValues: {
      date: new Date().toISOString().split('T')[0],
      type: 'income',
    },
  });

  const selectedLedgerId = watch('ledgerId');
  const selectedType = watch('type');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (selectedLedgerId) {
      const selectedLedger = ledgers.find((l) => l.id === selectedLedgerId);
      if (selectedLedger) {
        // Auto-set type based on ledger type
        // Note: This would require updating the form value, but for now we'll just filter categories
      }
    }
  }, [selectedLedgerId, ledgers]);

  const fetchData = async () => {
    try {
      setLoadingData(true);
      // Fetch all data for dropdowns (use high limit to get all)
      const [ledgersResult, categoriesResult] = await Promise.all([
        masterAccountService.getAllLedgers({ limit: 1000 }),
        masterAccountService.getAllCategories({ limit: 1000 }),
      ]);
      setLedgers(Array.isArray(ledgersResult.data) ? ledgersResult.data : []);
      setCategories(Array.isArray(categoriesResult.data) ? categoriesResult.data : []);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const filteredCategories = categories.filter((cat) => cat.type === selectedType);

  const onSubmit = async (data: LedgerItemFormData) => {
    try {
      setError(null);
      await masterAccountService.createLedgerItem({
        ledgerId: data.ledgerId,
        categoryId: data.categoryId || undefined,
        date: data.date,
        amount: data.amount,
        type: data.type,
        description: data.description,
        paymentMethod: data.paymentMethod,
        referenceNo: data.referenceNo,
      });
      navigate(ROUTES.MASTER_ACCOUNTS.LEDGER_ITEMS);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create ledger item. please try again' }));
      console.error('Error creating ledger item:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        description="Add a new income or expense entry"
        title="Create"
        breadcrumbs={[{ label: 'Ledger Items', path: ROUTES.MASTER_ACCOUNTS.LEDGER_ITEMS }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Ledger"
              {...register('ledgerId')}
              value={watch('ledgerId') || ''}
              onAddNew={() => setAddLedgerOpen(true)}
              addNewLabel="Add Ledger"
              error={errors.ledgerId?.message}
              disabled={loadingData}
              options={[
                { value: '', label: 'Select a ledger' },
                ...ledgers.map((ledger) => ({
                  value: ledger.id,
                  label: `${toTitleCase(ledger.name)} (${ledger.type})`,
                })),
              ]}
            />

            <Select
              label="Type"
              {...register('type')}
              error={errors.type?.message}
              options={[
                { value: 'income', label: 'Income' },
                { value: 'expense', label: 'Expense' },
              ]}
            />

            <Select
              label="Category (Optional)"
              {...register('categoryId')}
              value={watch('categoryId') || ''}
              onAddNew={() => setAddCategoryOpen(true)}
              addNewLabel="Add Category"
              error={errors.categoryId?.message}
              options={[
                { value: '', label: 'Select a category' },
                ...filteredCategories.map((category) => ({
                  value: category.id,
                  label: toTitleCase(category.name),
                })),
              ]}
            />

            <Input label="Date" type="date" {...register('date')} error={errors.date?.message} />

            <Input
              label="Amount"
              type="number"
              step="0.01"
              {...register('amount', { valueAsNumber: true })}
              error={errors.amount?.message}
              placeholder="0.00"
            />

            <Input
              label="Payment Method (Optional)"
              {...register('paymentMethod')}
              error={errors.paymentMethod?.message}
              placeholder="e.g., Cash, Bank Transfer"
            />

            <div className="md:col-span-2">
              <Input
                label="Description"
                {...register('description')}
                error={errors.description?.message}
                placeholder="Enter description"
              />
            </div>

            <div className="md:col-span-2">
              <Input
                label="Reference Number (Optional)"
                {...register('referenceNo')}
                error={errors.referenceNo?.message}
                placeholder="Enter reference number"
              />
            </div>
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(ROUTES.MASTER_ACCOUNTS.LEDGER_ITEMS)}
            >
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              {isSubmitting ? 'Creating...' : 'Create Item'}
            </Button>
          </div>
        </Card>
      </form>

      <QuickAddLedger
        open={addLedgerOpen}
        onClose={() => setAddLedgerOpen(false)}
        onCreated={(newLedger) => {
          setLedgers((prev) => [
            ...prev,
            { id: newLedger.id, name: newLedger.label, type: newLedger.type, createdAt: '' } as Ledger,
          ]);
          setValue('ledgerId', newLedger.id, { shouldValidate: true });
        }}
      />

      <QuickAddCategory
        open={addCategoryOpen}
        onClose={() => setAddCategoryOpen(false)}
        defaultType={selectedType}
        onCreated={(newCategory) => {
          setCategories((prev) => [
            ...prev,
            {
              id: newCategory.id,
              name: newCategory.label,
              type: newCategory.type,
              createdAt: '',
            } as Category,
          ]);
          setValue('categoryId', newCategory.id);
        }}
      />
    </div>
  );
}
