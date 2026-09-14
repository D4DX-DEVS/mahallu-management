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
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { fetchAllPages } from '@/services/api';
import { Member } from '@/types';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const deathSchema = z.object({
  deceasedName: z.string().max(200, 'Please keep the deceased name to 200 characters or less.').min(1, 'Deceased name is required'),
  deceasedNameMl: z.string().max(200, 'Please keep the deceased name to 200 characters or less.').optional(),
  deceasedId: z.string().max(200, 'Please keep the deceased to 200 characters or less.').optional(),
  deathDate: z.string().max(200, 'Please keep the death date to 200 characters or less.').min(1, 'Death date is required'),
  placeOfDeath: z.string().max(300, 'Please keep the place of death to 300 characters or less.').optional(),
  causeOfDeath: z.string().max(200, 'Please keep the cause of death to 200 characters or less.').optional(),
  mahallId: z.string().max(200, 'Please keep the mahall to 200 characters or less.').optional(),
  familyId: z.string().max(200, 'Please keep the family to 200 characters or less.').optional(),
  informantName: z.string().max(200, 'Please keep the informant name to 200 characters or less.').optional(),
  informantRelation: z.string().max(200, 'Please keep the informant relation to 200 characters or less.').optional(),
  informantPhone: z.string().max(200, 'Please keep the informant phone to 200 characters or less.').optional(),
  remarks: z.string().max(2000, 'Please keep the remarks to 2000 characters or less.').optional(),
});

type DeathFormData = z.infer<typeof deathSchema>;

export default function CreateDeathRegistration() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<DeathFormData>({
    resolver: zodResolver(deathSchema),
    defaultValues: {
      deathDate: new Date().toISOString().split('T')[0],
    },
  });

  const selectedMemberId = watch('deceasedId') || '';

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        // The list endpoint caps a page at 100 and answers 400 above it, so the
        // old single `limit: 1000` call failed and left this dropdown empty.
        const all = await fetchAllPages<Member>((params) => memberService.getAll(params), 10);
        setMembers(all);
      } catch (err) {
        setMembers([]);
        toast.error(loadErrorMessage(err, 'members'));
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
    const familyIdStr = typeof fid === 'object' && fid !== null ? (fid as any).id || (fid as any)._id : fid;
    setValue('familyId', familyIdStr);
    if (selectedMember.mahallId) {
      setValue('mahallId', selectedMember.mahallId);
    }
  }, [selectedMemberId, members, setValue]);

  const onSubmit = async (data: DeathFormData) => {
    try {
      setError(null);
      await registrationService.createDeath({
        deceasedName: data.deceasedName,
        deceasedNameMl: data.deceasedNameMl || undefined,
        deceasedId: data.deceasedId || undefined,
        deathDate: data.deathDate,
        placeOfDeath: data.placeOfDeath || undefined,
        causeOfDeath: data.causeOfDeath || undefined,
        mahallId: data.mahallId || undefined,
        familyId: data.familyId || undefined,
        informantName: data.informantName || undefined,
        informantRelation: data.informantRelation || undefined,
        informantPhone: data.informantPhone || undefined,
        remarks: data.remarks || undefined,
      });
      navigate(ROUTES.REGISTRATIONS.DEATH);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create death registration. please try again' }));
      console.error('Error creating registration:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Death Registration"
        description="Register a death"
        breadcrumbs={[{ label: 'Death Registrations', path: ROUTES.REGISTRATIONS.DEATH }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
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
            <h3 className="md:col-span-2 text-lg font-semibold text-foreground">
              Member Selection
            </h3>
            <Select
              label="Select Member"
              options={[
                { value: '', label: 'Select member...' },
                ...members.map((member) => ({
                  value: member.id,
                  label: `${toTitleCase(member.name)} (${toTitleCase(member.familyName)})`,
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
            <div className="hidden">
              <Input
                label="Deceased Name (Malayalam)"
                {...register('deceasedNameMl')}
                placeholder="മരിച്ചവരുടെ പേര്"
                className="md:col-span-2 font-malayalam"
              />
            </div>
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
            <h3 className="md:col-span-2 text-lg font-semibold mt-4 text-foreground">
              Informant Information
            </h3>
            <Input label="Informant Name" {...register('informantName')} placeholder="Informant Name" />
            <Input label="Relation" {...register('informantRelation')} placeholder="Relation to Deceased" />
            <Input
              label="Informant Phone"
              type="tel"
              {...register('informantPhone')}
              placeholder="Phone Number"
            />
            <Input label="Remarks" {...register('remarks')} placeholder="Remarks" className="md:col-span-2" />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.REGISTRATIONS.DEATH)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create Registration
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
