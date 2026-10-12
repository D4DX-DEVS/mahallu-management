import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import PageHeader from '@/components/ui/PageHeader';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhoneInput from '@/components/ui/PhoneInput';
import SideEffectsSummary, { ApprovalConfirmDialog, useSideEffectsPreview } from '../components/SideEffectsSummary';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const deathSchema = z.object({
  deceasedName: z.string().min(1, 'Deceased name is required'),
  deceasedNameMl: z.string().optional(),
  deceasedId: z.string().optional(),
  deathDate: z.string().min(1, 'Death date is required'),
  placeOfDeath: z.string().optional(),
  causeOfDeath: z.string().optional(),
  mahallId: z.string().optional(),
  familyId: z.string().optional(),
  informantName: z.string().optional(),
  informantRelation: z.string().optional(),
  informantPhone: z.string().optional(),
  remarks: z.string().optional(),
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
    formState: { errors, isSubmitting, isDirty },
  } = useForm<DeathFormData>({
    mode: 'onTouched',
    resolver: zodResolver(deathSchema),
    defaultValues: {
      deathDate: new Date().toISOString().split('T')[0],
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const selectedMemberId = watch('deceasedId') || '';
  const [graveId, setGraveId] = useState('');
  const [spouseMemberId, setSpouseMemberId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<DeathFormData | null>(null);
  const deathDateVal = watch('deathDate');
  const willApprove = true;
  const { preview, loading: previewLoading } = useSideEffectsPreview(
    'death',
    { deceasedId: selectedMemberId, deathDate: deathDateVal, graveId: graveId || undefined, spouseMemberId: spouseMemberId || undefined },
    !!selectedMemberId && willApprove
  );

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

  // Ask for confirmation first when approving will change member records
  const onSubmit = async (data: DeathFormData) => {
    if (willApprove && preview && preview.effects.length > 0) {
      setPendingData(data);
      setConfirmOpen(true);
      return;
    }
    await save(data);
  };

  const save = async (data: DeathFormData) => {
    setConfirmOpen(false);
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
        graveId: graveId || undefined,
        spouseMemberId: spouseMemberId || undefined,
      });
      navigate(ROUTES.REGISTRATIONS.DEATH);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create death registration. Check the details and try again."));
      console.error('Error creating registration:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Death Registration"
        description="Register a death"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}

          {Object.keys(errors).length > 0 && (
            <Alert tone="warning">Please fix the highlighted errors before submitting.</Alert>
          )}

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Member Selection</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Select the deceased member and record the details of death</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </div>
          </Card>

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Informant Information</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Person who reported the death</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input label="Informant Name" {...register('informantName')} placeholder="Informant Name" />
              <Input label="Relation" {...register('informantRelation')} placeholder="Relation to Deceased" />
              <PhoneInput label="Informant Phone" {...register('informantPhone')} placeholder="Phone Number" />
              <Input
                label="Remarks"
                {...register('remarks')}
                placeholder="Remarks"
                className="md:col-span-2"
              />
            </div>
          </Card>

          {willApprove ? (
            <SideEffectsSummary
              preview={preview}
              loading={previewLoading}
              title="Saving this death registration will:"
              onPickGrave={setGraveId}
              onPickSpouse={setSpouseMemberId}
              pickedGraveId={graveId}
              pickedSpouseId={spouseMemberId}
            />
          ) : (
            <Alert tone="info">Nothing changes on the member record while this is pending or rejected. If it was approved before, saving undoes what the approval did.</Alert>
          )}

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.REGISTRATIONS.DEATH)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create Registration
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
      <ApprovalConfirmDialog
        open={confirmOpen}
        preview={preview}
        isSaving={isSubmitting}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => pendingData && save(pendingData)}
      />
    </div>
  );
}

