import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const nikahSchema = z.object({
  groomName: z.string().max(200, 'Please keep the groom name to 200 characters or less.').min(1, 'Groom name is required'),
  groomAge: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).max(150).optional()
  ),
  brideName: z.string().max(200, 'Please keep the bride name to 200 characters or less.').min(1, 'Bride name is required'),
  brideAge: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).max(150).optional()
  ),
  mahallMemberType: z.enum(['groom', 'bride']).optional().or(z.literal('')),
  mahallMemberId: z.string().max(200, 'Please keep the mahall member to 200 characters or less.').optional(),
  nikahDate: z.string().max(200, 'Please keep the nikah date to 200 characters or less.').min(1, 'Nikah date is required'),
  mahallId: z.string().max(200, 'Please keep the mahall to 200 characters or less.').optional(),
  waliName: z.string().max(200, 'Please keep the wali name to 200 characters or less.').optional(),
  witness1: z.string().max(200, 'Please keep the witness1 to 200 characters or less.').optional(),
  witness2: z.string().max(200, 'Please keep the witness2 to 200 characters or less.').optional(),
  mahrAmount: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).optional()
  ),
  mahrDescription: z.string().max(3000, 'Please keep the mahr description to 3000 characters or less.').optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  remarks: z.string().max(2000, 'Please keep the remarks to 2000 characters or less.').optional(),
});

type NikahFormData = z.infer<typeof nikahSchema>;

export default function EditNikahRegistration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string; sublabel?: string }[]>(
    []
  );
  const [isMemberSearching, setIsMemberSearching] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NikahFormData>({
    resolver: zodResolver(nikahSchema),
  });

  const selectedMahallMemberType = watch('mahallMemberType') || '';
  const selectedMahallMemberId = watch('mahallMemberId') || '';

  useEffect(() => {
    const fetchRegistration = async () => {
      try {
        setLoading(true);
        const data = await registrationService.getNikahById(id!);
        reset({
          groomName: data.groomName || '',
          groomAge: (data.groomAge || '') as any,
          brideName: data.brideName || '',
          brideAge: (data.brideAge || '') as any,
          mahallMemberType: data.mahallMemberType || '',
          mahallMemberId: data.groomId || data.brideId || '',
          nikahDate: data.nikahDate ? new Date(data.nikahDate).toISOString().split('T')[0] : '',
          mahallId: data.mahallId || '',
          waliName: data.waliName || '',
          witness1: data.witness1 || '',
          witness2: data.witness2 || '',
          mahrAmount: (data.mahrAmount || '') as any,
          mahrDescription: data.mahrDescription || '',
          status: data.status || 'pending',
          remarks: data.remarks || '',
        });
      } catch (err: any) {
        setError(loadErrorMessage(err, 'nikah registration'));
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchRegistration();
  }, [id, reset]);

  // Handle member search with server-side query
  const handleMemberSearch = useCallback(
    async (query: string) => {
      if (!selectedMahallMemberType) return;
      setIsMemberSearching(true);
      try {
        const result = await memberService.getAll({
          gender: selectedMahallMemberType === 'groom' ? 'male' : 'female',
          search: query || undefined,
          limit: 50,
        });
        const fetchedMembers = result.data || [];
        setMembers(fetchedMembers);
        setMemberOptions(
          fetchedMembers.map((member: Member) => ({
            value: member.id,
            label: member.name,
            sublabel: member.familyName ? `Family: ${member.familyName}` : undefined,
          }))
        );
      } catch (err) {
        console.error('Error searching members:', err);
        setMembers([]);
        setMemberOptions([]);
      } finally {
        setIsMemberSearching(false);
      }
    },
    [selectedMahallMemberType]
  );

  // Handle member selection - auto-fill name and age
  const handleMemberSelect = useCallback(
    (memberId: string) => {
      setValue('mahallMemberId', memberId);
      if (!memberId) return;
      const selectedMember = members.find((m) => m.id === memberId);
      if (!selectedMember) return;
      if (selectedMahallMemberType === 'groom') {
        setValue('groomName', selectedMember.name);
        if (selectedMember.age) setValue('groomAge', selectedMember.age);
      } else if (selectedMahallMemberType === 'bride') {
        setValue('brideName', selectedMember.name);
        if (selectedMember.age) setValue('brideAge', selectedMember.age);
      }
    },
    [members, selectedMahallMemberType, setValue]
  );

  const onSubmit = async (data: NikahFormData) => {
    try {
      setError(null);
      await registrationService.updateNikah(id!, {
        groomName: data.groomName,
        groomAge: data.groomAge || undefined,
        brideName: data.brideName,
        brideAge: data.brideAge || undefined,
        groomId: data.mahallMemberType === 'groom' ? data.mahallMemberId : undefined,
        brideId: data.mahallMemberType === 'bride' ? data.mahallMemberId : undefined,
        mahallMemberType: data.mahallMemberType || undefined,
        nikahDate: data.nikahDate,
        mahallId: data.mahallId,
        waliName: data.waliName,
        witness1: data.witness1,
        witness2: data.witness2,
        mahrAmount: data.mahrAmount || undefined,
        mahrDescription: data.mahrDescription,
        status: data.status,
        remarks: data.remarks,
      });
      navigate(ROUTES.REGISTRATIONS.NIKAH);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'update nikah registration. please try again' }));
      console.error('Error updating registration:', err);
    }
  };

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Nikah Registration"
        description="Update nikah registration details"
        breadcrumbs={[{ label: 'Nikah Registrations', path: ROUTES.REGISTRATIONS.NIKAH }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <h3 className="md:col-span-2 text-lg font-semibold text-foreground">
              Mahall Member Selection
            </h3>
            <Select
              label="Mahall Member"
              options={[
                { value: '', label: 'Select who is Mahall member' },
                { value: 'groom', label: 'Groom' },
                { value: 'bride', label: 'Bride' },
              ]}
              {...register('mahallMemberType')}
              error={errors.mahallMemberType?.message as string | undefined}
              className="md:col-span-2"
            />
            {selectedMahallMemberType && (
              <SearchableSelect
                label="Search and select member"
                placeholder="Type a name to search members..."
                options={memberOptions}
                value={selectedMahallMemberId}
                onChange={handleMemberSelect}
                onSearch={handleMemberSearch}
                isLoading={isMemberSearching}
                className="md:col-span-2"
              />
            )}
            <h3 className="md:col-span-2 text-lg font-semibold text-foreground">
              Groom Information
            </h3>
            <Input
              label="Groom Name"
              {...register('groomName')}
              error={errors.groomName?.message}
              required
              placeholder="Groom Name"
            />
            <Input
              label="Groom Age"
              type="number"
              {...register('groomAge', { valueAsNumber: true })}
              error={errors.groomAge?.message}
              placeholder="Age"
            />
            <h3 className="md:col-span-2 text-lg font-semibold mt-4 text-foreground">
              Bride Information
            </h3>
            <Input
              label="Bride Name"
              {...register('brideName')}
              error={errors.brideName?.message}
              required
              placeholder="Bride Name"
            />
            <Input
              label="Bride Age"
              type="number"
              {...register('brideAge', { valueAsNumber: true })}
              error={errors.brideAge?.message}
              placeholder="Age"
            />
            <h3 className="md:col-span-2 text-lg font-semibold mt-4 text-foreground">
              Nikah Details
            </h3>
            <Input
              label="Nikah Date"
              type="date"
              {...register('nikahDate')}
              error={errors.nikahDate?.message}
              required
            />
            <Input label="Mahall ID" {...register('mahallId')} placeholder="Mahall ID" />
            <Input label="Wali Name" {...register('waliName')} placeholder="Wali Name" />
            <Input label="Witness 1" {...register('witness1')} placeholder="Witness 1" />
            <Input label="Witness 2" {...register('witness2')} placeholder="Witness 2" />
            <Input
              label="Mahr Amount"
              type="number"
              {...register('mahrAmount', { valueAsNumber: true })}
              error={errors.mahrAmount?.message}
              placeholder="Amount"
            />
            <Input
              label="Mahr Description"
              {...register('mahrDescription')}
              placeholder="Mahr Description"
              className="md:col-span-2"
            />
            <Select
              label="Status"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              {...register('status')}
              error={errors.status?.message as string | undefined}
            />
            <Input label="Remarks" {...register('remarks')} placeholder="Remarks" />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.REGISTRATIONS.NIKAH)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Update Registration
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
