import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';

const deathSchema = z.object({
  deceasedName: z.string().min(1, 'Deceased name is required'),
  deceasedId: z.string().optional(),
  deathDate: z.string().min(1, 'Death date is required'),
  placeOfDeath: z.string().optional(),
  causeOfDeath: z.string().optional(),
  mahallId: z.string().optional(),
  familyId: z.string().optional(),
  informantName: z.string().optional(),
  informantRelation: z.string().optional(),
  informantPhone: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  remarks: z.string().optional(),
});

type DeathFormData = z.infer<typeof deathSchema>;

export default function EditDeathRegistration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<DeathFormData>({
    resolver: zodResolver(deathSchema),
  });

  const selectedMemberId = watch('deceasedId') || '';

  useEffect(() => {
    const fetchRegistration = async () => {
      try {
        setLoading(true);
        const data = await registrationService.getDeathById(id!);
        // Extract string IDs from potentially populated objects
        const rawDeceasedId = data.deceasedId;
        const deceasedIdStr = typeof rawDeceasedId === 'object' && rawDeceasedId !== null
          ? (rawDeceasedId as any).id || (rawDeceasedId as any)._id || ''
          : rawDeceasedId || '';
        const rawFamilyId = data.familyId;
        const familyIdStr = typeof rawFamilyId === 'object' && rawFamilyId !== null
          ? (rawFamilyId as any).id || (rawFamilyId as any)._id || ''
          : rawFamilyId || '';

        reset({
          deceasedName: data.deceasedName || '',
          deceasedId: deceasedIdStr,
          deathDate: data.deathDate ? new Date(data.deathDate).toISOString().split('T')[0] : '',
          placeOfDeath: data.placeOfDeath || '',
          causeOfDeath: data.causeOfDeath || '',
          mahallId: data.mahallId || '',
          familyId: familyIdStr,
          informantName: data.informantName || '',
          informantRelation: data.informantRelation || '',
          informantPhone: data.informantPhone || '',
          status: data.status || 'pending',
          remarks: data.remarks || '',
        });
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load death registration');
      } finally {
        setLoading(false);
      }
    };
    if (id) fetchRegistration();
  }, [id, reset]);

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const result = await memberService.getAll({
          limit: 1000,
        });
        setMembers(result.data || []);
      } catch (err) {
        console.error('Error fetching members:', err);
        setMembers([]);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    if (!selectedMemberId) return;
    const selectedMember = members.find((m) => m.id === selectedMemberId);
    if (!selectedMember) return;
    setValue('deceasedName', selectedMember.name);
    // Extract string ID from potentially populated familyId object
    const fid = selectedMember.familyId;
    const familyIdStr = typeof fid === 'object' && fid !== null
      ? (fid as any).id || (fid as any)._id
      : fid;
    setValue('familyId', familyIdStr);
    if (selectedMember.mahallId) {
      setValue('mahallId', selectedMember.mahallId);
    }
  }, [selectedMemberId, members, setValue]);

  const onSubmit = async (data: DeathFormData) => {
    try {
      setError(null);
      await registrationService.updateDeath(id!, {
        deceasedName: data.deceasedName,
        deceasedId: data.deceasedId || undefined,
        deathDate: data.deathDate,
        placeOfDeath: data.placeOfDeath || undefined,
        causeOfDeath: data.causeOfDeath || undefined,
        mahallId: data.mahallId || undefined,
        familyId: data.familyId || undefined,
        informantName: data.informantName || undefined,
        informantRelation: data.informantRelation || undefined,
        informantPhone: data.informantPhone || undefined,
        status: data.status,
        remarks: data.remarks || undefined,
      });
      navigate(ROUTES.REGISTRATIONS.DEATH);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to update death registration. Please try again.');
      console.error('Error updating registration:', err);
    }
  };

  if (loading) {
    return (
      <PageSkeleton variant="section" />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Edit Death Registration</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Update death registration details</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Death Registrations', path: ROUTES.REGISTRATIONS.DEATH },
            { label: 'Edit' },
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

          {Object.keys(errors).length > 0 && (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-700 text-sm dark:bg-yellow-900 dark:border-yellow-700 dark:text-yellow-200">
              Please fix the highlighted errors before submitting.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <h3 className="md:col-span-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Member Selection
            </h3>
            <Select
              label="Select Member"
              options={[
                { value: '', label: 'Select member...' },
                ...members.map((member) => ({
                  value: member.id,
                  label: `${member.name} (${member.familyName})`,
                })),
              ]}
              {...register('deceasedId')}
              className="md:col-span-2"
            />
            <Input
              label="Deceased Name"
              {...register('deceasedName')}
              error={errors.deceasedName?.message}
              required
              placeholder="Deceased Name"
              className="md:col-span-2"
            />
            <Input
              label="Death Date"
              type="date"
              {...register('deathDate')}
              error={errors.deathDate?.message}
              required
            />
            <Input label="Place of Death" {...register('placeOfDeath')} placeholder="Place of Death" />
            <Input label="Cause of Death" {...register('causeOfDeath')} placeholder="Cause of Death" />
            <Input label="Mahall ID" {...register('mahallId')} placeholder="Mahall ID" />
            <h3 className="md:col-span-2 text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4">Informant Information</h3>
            <Input label="Informant Name" {...register('informantName')} placeholder="Informant Name" />
            <Input label="Relation" {...register('informantRelation')} placeholder="Relation to Deceased" />
            <Input label="Informant Phone" type="tel" {...register('informantPhone')} placeholder="Phone Number" />
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
            <Input
              label="Remarks"
              {...register('remarks')}
              placeholder="Remarks"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.REGISTRATIONS.DEATH)}>
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
