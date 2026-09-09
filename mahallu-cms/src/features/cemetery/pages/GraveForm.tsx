import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import cemeteryService, { GraveRecord, Cemetery } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import SearchableSelect from '../../../components/ui/SearchableSelect';
import { PageSkeleton } from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';
import { FiArrowLeft } from 'react-icons/fi';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const graveSchema = z.object({
  graveNo: z.string().max(200, 'Please keep the grave no to 200 characters or less.').min(1, 'Grave number is required'),
  deceasedName: z.string().max(200, 'Please keep the deceased name to 200 characters or less.').min(1, 'Deceased name is required'),
  dateOfDeath: z.string().max(200, 'Please keep the date of death to 200 characters or less.').optional(),
  burialDate: z.string().max(200, 'Please keep the burial date to 200 characters or less.').optional(),
  rowLabel: z.string().max(200, 'Please keep the row label to 200 characters or less.').optional(),
  notes: z.string().max(2000, 'Please keep the notes to 2000 characters or less.').optional(),
  deceasedMemberId: z.string().max(200, 'Please keep the deceased member to 200 characters or less.').optional(),
  familyId: z.string().max(200, 'Please keep the family to 200 characters or less.').optional(),
});

type GraveFormData = z.infer<typeof graveSchema>;

export function GraveForm() {
  const { cemeteryId, graveId } = useParams<{ cemeteryId: string; graveId?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cemetery, setCemetery] = useState<Cemetery | null>(null);
  const [loadingCemetery, setLoadingCemetery] = useState(true);
  const [grave, setGrave] = useState<GraveRecord | null>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(true);
  const [families, setFamilies] = useState<any[]>([]);
  const [loadingFamilies, setLoadingFamilies] = useState(true);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GraveFormData>({
    resolver: zodResolver(graveSchema),
  });

  useEffect(() => {
    memberService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setMembers(result.data || []))
      .catch(() => setMembers([]))
      .finally(() => setLoadingMembers(false));

    familyService
      .getAll({ page: 1, limit: 200 } as any)
      .then((result: any) => setFamilies(result.data || []))
      .catch(() => setFamilies([]))
      .finally(() => setLoadingFamilies(false));
  }, []);

  // Load cemetery and grave if editing
  useEffect(() => {
    const loadData = async () => {
      try {
        const cemeteryData = await cemeteryService.getCemeteryById(cemeteryId!);
        setCemetery(cemeteryData);

        if (graveId) {
          const graveData = await cemeteryService.getGraveRecordById(graveId);
          setGrave(graveData);
          reset({
            graveNo: graveData.graveNo,
            deceasedName: graveData.deceasedName,
            dateOfDeath: graveData.dateOfDeath
              ? new Date(graveData.dateOfDeath).toISOString().split('T')[0]
              : '',
            burialDate: graveData.burialDate
              ? new Date(graveData.burialDate).toISOString().split('T')[0]
              : '',
            rowLabel: graveData.rowLabel,
            notes: graveData.notes,
            deceasedMemberId: graveData.deceasedMemberId,
            familyId: graveData.familyId,
          });
        }
      } catch (err: any) {
        setError(loadErrorMessage(err, 'this cemetery'));
      } finally {
        setLoadingCemetery(false);
      }
    };

    if (cemeteryId) loadData();
    else setLoadingCemetery(false);
  }, [cemeteryId, graveId, reset]);

  const onSubmit = async (data: GraveFormData) => {
    try {
      setLoading(true);
      setError(null);

      const graveData = {
        tenantId: '',
        cemeteryId: cemeteryId!,
        ...data,
        deceasedMemberId: data.deceasedMemberId || undefined,
        familyId: data.familyId || undefined,
      } as GraveRecord;

      if (graveId) {
        await cemeteryService.updateGraveRecord(graveId, graveData);
      } else {
        await cemeteryService.createGraveRecord(graveData);
      }

      navigate(`/cemetery/${cemeteryId}`);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'save grave record' }));
    } finally {
      setLoading(false);
    }
  };

  if (loadingCemetery) {
    return <PageSkeleton />;
  }

  /*
   * The skeleton used to be the only thing this screen could show without a
   * cemetery, so a deleted or mistyped cemetery left it shimmering forever —
   * the error was set but never reached, because the early return ran first.
   */
  if (!cemetery) {
    return (
      <div className="space-y-4">
        <PageHeader title={graveId ? 'Edit grave' : 'Add grave'} />
        <EmptyState
          variant="error"
          title="This cemetery couldn’t be opened"
          description={error ?? 'It may have been removed. Pick a cemetery from the list and try again.'}
          action={{ label: 'Back to cemeteries', onClick: () => navigate('/cemetery') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          onClick={() => navigate(`/cemetery/${cemeteryId}`)}
          className="flex items-center gap-2"
        >
          <FiArrowLeft /> Back
        </Button>
        <PageHeader title={graveId ? 'Edit grave' : 'Add grave'} description={cemetery.name} />
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
      )}

      <Card padding="lg">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Grave Number *</label>
            <Input
              {...register('graveNo')}
              placeholder="e.g., A-001, B-045"
              className={errors.graveNo ? 'border-red-500' : ''}
            />
            {errors.graveNo && <p className="mt-1 text-sm text-red-600">{errors.graveNo.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Deceased Name *</label>
            <Input
              {...register('deceasedName')}
              placeholder="Enter full name"
              className={errors.deceasedName ? 'border-red-500' : ''}
            />
            {errors.deceasedName && (
              <p className="mt-1 text-sm text-red-600">{errors.deceasedName.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date of Death</label>
              <Input {...register('dateOfDeath')} type="date" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Burial Date</label>
              <Input {...register('burialDate')} type="date" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Row Label</label>
            <Input {...register('rowLabel')} placeholder="e.g., Row 1, Section A" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              aria-label="Notes"
              {...register('notes')}
              placeholder="Enter any additional notes"
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-gray-600 mb-4">Optional: Link to member or family (if available)</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Controller
                  name="deceasedMemberId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      label="Member (if family member)"
                      value={field.value}
                      onChange={field.onChange}
                      options={members.map((member: any) => ({
                        value: member._id || member.id,
                        label: `${member.name}${member.familyName ? ` - ${member.familyName}` : ''}`,
                      }))}
                      placeholder="Search members..."
                      isLoading={loadingMembers}
                    />
                  )}
                />
              </div>

              <div>
                <Controller
                  name="familyId"
                  control={control}
                  render={({ field }) => (
                    <SearchableSelect
                      label="Family"
                      value={field.value}
                      onChange={field.onChange}
                      options={families.map((family: any) => ({
                        value: family._id || family.id,
                        label: `${family.houseName}${family.mahallId ? ` - ${family.mahallId}` : ''}`,
                      }))}
                      placeholder="Search families..."
                      isLoading={loadingFamilies}
                    />
                  )}
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? 'Saving...' : 'Save Grave'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(`/cemetery/${cemeteryId}`)}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
