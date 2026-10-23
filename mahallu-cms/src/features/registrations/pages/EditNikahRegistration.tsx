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
import Textarea from '@/components/ui/Textarea';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PersonPhotoField from '../components/PersonPhotoField';
import { EMPTY_PHOTO, PhotoUploadError, discardUploads, uploadPendingPhotos, type PhotoProgress, type PhotoValues } from '../nikahPhotos';
import { MAHR_TYPE_OPTIONS, nikahDetailShape, requireMahrOther } from '../nikahFields';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { formatCurrency, toTitleCase } from '@/utils/format';
import { useMemberAutofill } from '@/hooks/useMemberAutofill';
import { nikahPartyFill } from '@/utils/memberAutofill';

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
  mahrDescription: z.string().max(3000, 'Please keep the mahr description to 3000 characters or less.').optional(),
  status: z.enum(['pending', 'correction_required', 'approved', 'rejected']).optional(),
  remarks: z.string().max(2000, 'Please keep the remarks to 2000 characters or less.').optional(),
  ...nikahDetailShape,
}).superRefine(requireMahrOther);

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
  // Photos already stored on the registration, the change the person has made to each, and any
  // amount recorded before mahr types existed (kept as it is).
  const [storedPhotos, setStoredPhotos] = useState<{ groom?: string; bride?: string }>({});
  const [photos, setPhotos] = useState<PhotoValues>({ groom: EMPTY_PHOTO, bride: EMPTY_PHOTO });
  const [photoProgress, setPhotoProgress] = useState<PhotoProgress>({});
  const [legacyMahrAmount, setLegacyMahrAmount] = useState<number | undefined>();
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NikahFormData>({
    resolver: zodResolver(nikahSchema),
  });

  const selectedMahallMemberType = watch('mahallMemberType') || '';
  const selectedMahallMemberId = watch('mahallMemberId') || '';
  const autofill = useMemberAutofill({ setValue, getValues });
  const selectedMahrType = watch('mahrType') || '';

  // The description only applies to "Other": leaving that option clears it.
  useEffect(() => {
    if (selectedMahrType !== 'other') setValue('mahrTypeOther', '');
  }, [selectedMahrType, setValue]);

  useEffect(() => {
    const fetchRegistration = async () => {
      try {
        setLoading(true);
        const data = await registrationService.getNikahById(id!);
        setStoredPhotos({ groom: data.groomPhotoId || undefined, bride: data.bridePhotoId || undefined });
        setLegacyMahrAmount(data.mahrAmount && !data.mahrType ? data.mahrAmount : undefined);
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
          groomAddress: data.groomAddress || '',
          brideAddress: data.brideAddress || '',
          witness1Phone: data.witness1Phone || '',
          witness1Address: data.witness1Address || '',
          witness2Phone: data.witness2Phone || '',
          witness2Address: data.witness2Address || '',
          mahrType: data.mahrType || '',
          mahrTypeOther: data.mahrTypeOther || '',
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
            label: toTitleCase(member.name),
            sublabel: member.familyName ? `Family: ${toTitleCase(member.familyName)}` : undefined,
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

  // Handle member selection - fills that side's name, Malayalam name, age and address (from the member's
  // family) and the member id. Picking someone else replaces what the previous member filled in.
  const handleMemberSelect = useCallback(
    (memberId: string) => {
      setValue('mahallMemberId', memberId);
      if (selectedMahallMemberType !== 'groom' && selectedMahallMemberType !== 'bride') return;
      const side = selectedMahallMemberType;
      const selectedMember = memberId ? members.find((m) => m.id === memberId) : undefined;
      void autofill(selectedMember ?? null, (member, family) => nikahPartyFill(side, member, family), { withFamily: true });
    },
    [members, selectedMahallMemberType, setValue, autofill]
  );

  const onSubmit = async (data: NikahFormData) => {
    let uploaded: string[] = [];
    try {
      setError(null);
      // Only photos the person replaced or removed are part of the request; the others are left alone.
      const upload = await uploadPendingPhotos(photos, (progress) => setPhotoProgress((previous) => ({ ...previous, ...progress })));
      uploaded = upload.uploaded;
      await registrationService.updateNikah(id!, {
        ...upload.fields,
        groomAddress: data.groomAddress ?? '',
        brideAddress: data.brideAddress ?? '',
        witness1Phone: data.witness1Phone?.trim() ?? '',
        witness1Address: data.witness1Address ?? '',
        witness2Phone: data.witness2Phone?.trim() ?? '',
        witness2Address: data.witness2Address ?? '',
        // The previously recorded mahr amount is not part of this request, so it stays as it was.
        mahrType: data.mahrType || undefined,
        mahrTypeOther: data.mahrType === 'other' ? data.mahrTypeOther?.trim() : undefined,
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
        mahrDescription: data.mahrDescription,
        status: data.status,
        remarks: data.remarks,
      });
      navigate(ROUTES.REGISTRATIONS.NIKAH);
    } catch (err: any) {
      // The edit was not saved: photos uploaded for it would be orphans, so take them back out.
      await discardUploads(uploaded);
      setError(err instanceof PhotoUploadError ? err.message : errorMessage(err, { action: 'update nikah registration. please try again' }));
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
            <Textarea
              label="Groom Address"
              {...register('groomAddress')}
              error={errors.groomAddress?.message}
              placeholder="House name, place, post office, district, PIN code"
              wrapperClassName="md:col-span-2"
            />
            <div className="md:col-span-2">
              <PersonPhotoField
                person="Groom"
                storedId={storedPhotos.groom}
                value={photos.groom}
                onChange={(value) => setPhotos((previous) => ({ ...previous, groom: value }))}
                uploadPercent={photoProgress.groom}
                disabled={isSubmitting}
              />
            </div>
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
            <Textarea
              label="Bride Address"
              {...register('brideAddress')}
              error={errors.brideAddress?.message}
              placeholder="House name, place, post office, district, PIN code"
              wrapperClassName="md:col-span-2"
            />
            <div className="md:col-span-2">
              <PersonPhotoField
                person="Bride"
                storedId={storedPhotos.bride}
                value={photos.bride}
                onChange={(value) => setPhotos((previous) => ({ ...previous, bride: value }))}
                uploadPercent={photoProgress.bride}
                disabled={isSubmitting}
              />
            </div>
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
            <h4 className="md:col-span-2 text-base font-semibold mt-2 text-foreground">Witness 1</h4>
            <Input label="Witness 1 Name" {...register('witness1')} placeholder="Witness 1 Name" />
            <Input
              label="Witness 1 Phone Number"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              {...register('witness1Phone')}
              error={errors.witness1Phone?.message}
              placeholder="e.g. 9876543210 or +971 50 123 4567"
            />
            <Textarea
              label="Witness 1 Address"
              {...register('witness1Address')}
              error={errors.witness1Address?.message}
              placeholder="Witness 1 Address"
              wrapperClassName="md:col-span-2"
            />
            <h4 className="md:col-span-2 text-base font-semibold mt-2 text-foreground">Witness 2</h4>
            <Input label="Witness 2 Name" {...register('witness2')} placeholder="Witness 2 Name" />
            <Input
              label="Witness 2 Phone Number"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              {...register('witness2Phone')}
              error={errors.witness2Phone?.message}
              placeholder="e.g. 9876543210 or +971 50 123 4567"
            />
            <Textarea
              label="Witness 2 Address"
              {...register('witness2Address')}
              error={errors.witness2Address?.message}
              placeholder="Witness 2 Address"
              wrapperClassName="md:col-span-2"
            />
            <Select
              label="Mahr Type"
              options={[{ value: '', label: 'Select mahr type' }, ...MAHR_TYPE_OPTIONS]}
              {...register('mahrType')}
              error={errors.mahrType?.message as string | undefined}
              helperText={
                legacyMahrAmount !== undefined
                  ? `Recorded before mahr types existed: ${formatCurrency(legacyMahrAmount)}. That amount is kept.`
                  : undefined
              }
            />
            {selectedMahrType === 'other' && (
              <Input
                label="Specify Mahr Type"
                {...register('mahrTypeOther')}
                error={errors.mahrTypeOther?.message}
                placeholder="Describe the mahr type"
                required
              />
            )}
            <Textarea
              label="Mahr Description"
              rows={4}
              {...register('mahrDescription')}
              error={errors.mahrDescription?.message}
              placeholder="Mahr Description"
              wrapperClassName="md:col-span-2"
            />
            <Select
              label="Status"
              options={[
                { value: 'pending', label: 'Pending' },
                { value: 'correction_required', label: 'Correction Required' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
              ]}
              {...register('status')}
              error={errors.status?.message as string | undefined}
            />
            <Textarea
              label="Remarks"
              rows={4}
              {...register('remarks')}
              error={errors.remarks?.message}
              placeholder="Remarks"
              wrapperClassName="md:col-span-2"
            />
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
