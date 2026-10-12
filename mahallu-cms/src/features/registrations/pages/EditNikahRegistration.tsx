import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import AmountInput from '@/components/ui/AmountInput';
import SideEffectsSummary, { ApprovalConfirmDialog, useSideEffectsPreview } from '../components/SideEffectsSummary';
import PartnerMemberPicker from '../components/PartnerMemberPicker';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const nikahSchema = z.object({
  groomName: z.string().min(1, 'Groom name is required'),
  groomAge: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().min(0).max(150).optional()),
  brideName: z.string().min(1, 'Bride name is required'),
  brideAge: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().min(0).max(150).optional()),
  brideFamilyAction: z.enum(['stay', 'move', 'newFamily']).optional(),
  newFamilyHouseName: z.string().optional(),
  mahallMemberType: z.enum(['groom', 'bride']).optional().or(z.literal('')),
  mahallMemberId: z.string().optional(),
  nikahDate: z.string().min(1, 'Nikah date is required'),
  mahallId: z.string().optional(),
  waliName: z.string().optional(),
  witness1: z.string().optional(),
  witness2: z.string().optional(),
  mahrAmount: z.preprocess((val) => (val === '' || Number.isNaN(val) ? undefined : val), z.number().min(0).optional()),
  mahrDescription: z.string().optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  remarks: z.string().optional(),
});

type NikahFormData = z.infer<typeof nikahSchema>;

export default function EditNikahRegistration() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [isMemberSearching, setIsMemberSearching] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NikahFormData>({
    mode: 'onTouched',
    resolver: zodResolver(nikahSchema),
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const selectedMahallMemberType = watch('mahallMemberType') || '';
  const selectedMahallMemberId = watch('mahallMemberId') || '';
  const [partnerId, setPartnerId] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingData, setPendingData] = useState<NikahFormData | null>(null);
  const brideFamilyAction = watch('brideFamilyAction') || 'stay';
  const newFamilyHouseName = watch('newFamilyHouseName') || '';
  const statusVal = watch('status');
  const willApprove = statusVal === 'approved';
  // The member picked above is the groom or the bride; the optional partner is the other one
  const groomMemberId = selectedMahallMemberType === 'groom' ? selectedMahallMemberId : selectedMahallMemberType === 'bride' ? partnerId : '';
  const brideMemberId = selectedMahallMemberType === 'bride' ? selectedMahallMemberId : selectedMahallMemberType === 'groom' ? partnerId : '';
  const { preview, loading: previewLoading } = useSideEffectsPreview(
    'nikah',
    {
      groomId: groomMemberId || undefined,
      brideId: brideMemberId || undefined,
      groomName: watch('groomName'),
      brideName: watch('brideName'),
      brideFamilyAction,
      newFamilyHouseName: newFamilyHouseName || undefined,
    },
    willApprove
  );

  useEffect(() => {
    const fetchRegistration = async () => {
      try {
        setLoading(true);
        const data = await registrationService.getNikahById(id!);
        const idOf = (v: any) => (v && typeof v === 'object' ? v.id || v._id || '' : v || '');
        setPartnerId(data.mahallMemberType === 'groom' ? idOf(data.brideId) : idOf(data.groomId));
        reset({
          brideFamilyAction: (data.brideFamilyAction as any) || 'stay',
          newFamilyHouseName: data.newFamilyHouseName || '',
          groomName: data.groomName || '',
          groomAge: (data.groomAge || '') as any,
          brideName: data.brideName || '',
          brideAge: (data.brideAge || '') as any,
          mahallMemberType: data.mahallMemberType || '',
          mahallMemberId: data.mahallMemberType === 'bride' ? idOf(data.brideId) : data.mahallMemberType === 'groom' ? idOf(data.groomId) : idOf(data.groomId) || idOf(data.brideId) || '',
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
        setError(getFriendlyError(err, "Couldn't load nikah registration. Refresh the page or try again."));
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
      setValue('mahallMemberId', memberId, { shouldDirty: true });
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

  // Ask for confirmation first when approving will change member records
  const onSubmit = async (data: NikahFormData) => {
    if (willApprove && preview && preview.effects.some((e) => e.kind !== 'no_move')) {
      setPendingData(data);
      setConfirmOpen(true);
      return;
    }
    await save(data);
  };

  const save = async (data: NikahFormData) => {
    setConfirmOpen(false);
    try {
      setError(null);
      await registrationService.updateNikah(id!, {
        groomName: data.groomName,
        groomAge: data.groomAge || undefined,
        brideName: data.brideName,
        brideAge: data.brideAge || undefined,
        groomId: groomMemberId || undefined,
        brideId: brideMemberId || undefined,
        brideFamilyAction: groomMemberId && brideMemberId ? data.brideFamilyAction : data.brideFamilyAction === 'newFamily' ? 'newFamily' : 'stay',
        newFamilyHouseName: data.newFamilyHouseName || undefined,
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
      toast.error(getFriendlyError(err, "Couldn't update nikah registration. Try again in a moment."));
      console.error('Error updating registration:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit Nikah Registration"
        description="Update nikah registration details"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Mahall Member Selection</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Pick existing members to pre-fill the couple details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              {selectedMahallMemberType && selectedMahallMemberId && (
                <div className="md:col-span-2">
                  <PartnerMemberPicker
                    role={selectedMahallMemberType === 'groom' ? 'bride' : 'groom'}
                    value={partnerId}
                    onChange={(id, m) => {
                      setPartnerId(id);
                      if (m) {
                        if (selectedMahallMemberType === 'groom') { setValue('brideName', m.name, { shouldDirty: true }); if (m.age) setValue('brideAge', m.age); }
                        else { setValue('groomName', m.name, { shouldDirty: true }); if (m.age) setValue('groomAge', m.age); }
                      }
                    }}
                  />
                </div>
              )}
            </div>
          </Card>

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Groom Information</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Details of the groom</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </div>
          </Card>

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Bride Information</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Details of the bride</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
            </div>
          </Card>

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Nikah Details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Date, wali and other nikah details</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
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
              <AmountInput
                label="Mahr Amount"
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
              <Input
                label="Remarks"
                {...register('remarks')}
                placeholder="Remarks"
              />
            </div>
          </Card>

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Approval and family</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Approving updates the member records of the couple.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Where does the bride live after the nikah?"
                options={[
                  { value: 'stay', label: 'No change (stays in her family)' },
                  { value: 'move', label: "Move her to the groom's family" },
                  { value: 'newFamily', label: 'Create a new family for the couple' },
                ]}
                {...register('brideFamilyAction')}
                helperText="Only used when approved. Nobody moves unless you choose it."
              />
              {brideFamilyAction === 'newFamily' && (
                <Input label="New family house name" {...register('newFamilyHouseName')} placeholder="Leave blank to use the groom's name" />
              )}
            </div>
            <div className="mt-3">
              {willApprove ? (
                <SideEffectsSummary preview={preview} loading={previewLoading} title="Saving as approved will:" />
              ) : (
                <Alert tone="info">Nothing changes on member records while this is pending or rejected.</Alert>
              )}
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.REGISTRATIONS.NIKAH)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Update Registration
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
