import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FiSave, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { Family, Member } from '@/types';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const memberSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  familyId: z.string().min(1, 'Family is required'),
  gender: z.enum(['male', 'female']).optional().or(z.literal('')),
});

type MemberFormData = z.infer<typeof memberSchema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (member: Member) => void;
}

export default function QuickAddMember({ open, onClose, onCreated }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [families, setFamilies] = useState<Family[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<MemberFormData>({
    resolver: zodResolver(memberSchema),
  });

  useEffect(() => {
    if (open) {
      reset();
      fetchFamilies();
    }
  }, [open, reset]);

  const fetchFamilies = async () => {
    try {
      const result = await familyService.getAll();
      setFamilies(result.data || []);
    } catch (err) {
      console.error('Failed to fetch families:', err);
      setFamilies([]);
    }
  };

  const onSubmit = async (data: MemberFormData) => {
    try {
      setError(null);
      const selectedFamily = families.find((f) => f.id === data.familyId);

      const cleanedData = Object.fromEntries(
        Object.entries({
          name: data.name,
          familyId: data.familyId,
          familyName: selectedFamily?.houseName,
          gender: data.gender === '' ? undefined : data.gender,
        }).filter(([_, v]) => v !== '' && v !== undefined)
      );

      const created = await memberService.create(cleanedData);
      onCreated(created);
      onClose();
      reset();
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create member. Check the details and try again."));
    }
  };

  const genderOptions = [
    { value: '', label: 'Select gender (optional)' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];

  const familyOptions = [
    { value: '', label: 'Select family...' },
    ...families.map((family) => ({
      value: family.id,
      label: `${family.houseName}${family.familyHead ? ` - ${family.familyHead}` : ''}`,
    })),
  ];

  return (
    <Modal isOpen={open} onClose={onClose} title="Add New Member" size="md">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {error && <Alert tone="danger">{error}</Alert>}

        <div className="space-y-4">
          <Input
            label="Member Name"
            {...register('name')}
            error={errors.name?.message}
            required
            placeholder="Full Name"
          />

          <Select
            label="Family"
            options={familyOptions}
            {...register('familyId')}
            error={errors.familyId?.message}
            required
          />

          <Select
            label="Gender"
            options={genderOptions}
            {...register('gender')}
            error={errors.gender?.message}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-line-soft pt-4 dark:border-surface-border">
          <Button type="button" variant="secondary" onClick={onClose}>
            <FiX className="h-3.5 w-3.5" />
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FiSave className="h-3.5 w-3.5" />
            Create Member
          </Button>
        </div>
      </form>
    </Modal>
  );
}
