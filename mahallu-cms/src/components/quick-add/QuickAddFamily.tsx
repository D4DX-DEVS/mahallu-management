import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { familyService } from '@/services/familyService';
import { tenantService } from '@/services/tenantService';

const familySchema = z.object({
  varisangyaGrade: z.string().optional(),
  houseName: z.string().min(1, 'House Name is required'),
  houseNameMl: z.string().optional(),
  familyHead: z.string().optional(),
  familyHeadMl: z.string().optional(),
  contactNo: z.string().optional().refine(
    (val) => !val || /^\d{10}$/.test(val),
    { message: 'Contact number must be exactly 10 digits' }
  ),
  wardNumber: z.string().optional().refine(
    (val) => !val || /^\d+$/.test(val),
    { message: 'Ward number must contain only digits' }
  ),
  houseNo: z.string().optional(),
  area: z.string().optional(),
  areaMl: z.string().optional(),
  place: z.string().optional(),
  placeMl: z.string().optional(),
});

type FamilyFormData = z.infer<typeof familySchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (family: { id: string; label: string }) => void;
  tenantId?: string | null;
}

export default function QuickAddFamily({ open, onClose, onCreated, tenantId }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [grades, setGrades] = useState<Array<{ name: string; amount: number }>>([]);
  const [areaOptions, setAreaOptions] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FamilyFormData>({
    resolver: zodResolver(familySchema),
  });

  useEffect(() => {
    if (open && tenantId) {
      tenantService.getById(tenantId)
        .then((tenant) => {
          setGrades(tenant.settings?.varisangyaGrades || []);
          setAreaOptions(tenant.settings?.areaOptions || []);
        })
        .catch(console.error);
    }
  }, [open, tenantId]);

  const onSubmit = async (data: FamilyFormData) => {
    try {
      setError(null);
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, v]) => v !== '' && v !== undefined)
      );
      const created = await familyService.create(cleanedData);
      onCreated({ id: created.id, label: created.houseName });
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create family. Please try again.');
    }
  };

  const gradeOptions = [
    { value: '', label: 'Select grade...' },
    ...grades.map((g) => ({ value: g.name, label: `${g.name} - ₹${g.amount}` })),
  ];

  const areaSelectOptions = [
    { value: '', label: 'Select area...' },
    ...areaOptions.map((a) => ({ value: a, label: a })),
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Family" size="xl">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Varisangya Grade"
            options={gradeOptions}
            {...register('varisangyaGrade')}
          />
          <Input
            label="House Name"
            {...register('houseName')}
            error={errors.houseName?.message}
            required
            placeholder="House Name"
          />
          <div className="hidden">
          <Input
            label="House Name (Malayalam)"
            {...register('houseNameMl')}
            placeholder="വീട് പേര്"
            className="font-malayalam"
          />
          </div>
          <Input
            label="Family Head"
            {...register('familyHead')}
            placeholder="Family Head Name"
          />
          <div className="hidden">
          <Input
            label="Family Head (Malayalam)"
            {...register('familyHeadMl')}
            placeholder="കുടുംബ നാഥൻ"
            className="font-malayalam"
          />
          </div>
          <Input
            label="Contact No."
            type="tel"
            {...register('contactNo')}
            error={errors.contactNo?.message}
            placeholder="Contact No. (10 digits)"
            maxLength={10}
          />
          <Input
            label="Ward Number"
            {...register('wardNumber')}
            error={errors.wardNumber?.message}
            placeholder="Ward Number"
          />
          <Input
            label="House No."
            {...register('houseNo')}
            placeholder="House No."
          />
          <Select
            label="Area"
            options={areaSelectOptions}
            {...register('area')}
          />
          <div className="hidden">
          <Input
            label="Area (Malayalam)"
            {...register('areaMl')}
            placeholder="പ്രദേശം"
            className="font-malayalam"
          />
          </div>
          <Input
            label="Place"
            {...register('place')}
            placeholder="Place"
          />
          <div className="hidden">
          <Input
            label="Place (Malayalam)"
            {...register('placeMl')}
            placeholder="സ്ഥലം"
            className="font-malayalam"
          />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={onClose}>
            <FiX className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-4 w-4 mr-2" />
            Create Family
          </Button>
        </div>
      </form>
    </Modal>
  );
}
