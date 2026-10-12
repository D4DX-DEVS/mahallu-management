import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import cemeteryService, { GraveRecord, Cemetery } from '../../../services/cemeteryService';
import Button from '../../../components/ui/Button';
import Card from '../../../components/ui/Card';
import Input, { controlClasses, labelClasses } from '../../../components/ui/Input';
import PageHeader from '../../../components/ui/PageHeader';
import Alert from '../../../components/ui/Alert';
import LoadingSpinner from '../../../components/ui/LoadingSpinner';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const graveSchema = z.object({
  graveNo: z.string().min(1, 'Grave number is required'),
  deceasedName: z.string().min(1, 'Deceased name is required'),
  dateOfDeath: z.string().optional(),
  burialDate: z.string().optional(),
  rowLabel: z.string().optional(),
  notes: z.string().optional(),
  deceasedMemberId: z.string().optional(),
  familyId: z.string().optional(),
});

type GraveFormData = z.infer<typeof graveSchema>;

export function GraveForm() {
  const { cemeteryId, graveId } = useParams<{ cemeteryId: string; graveId?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cemetery, setCemetery] = useState<Cemetery | null>(null);
  const [grave, setGrave] = useState<GraveRecord | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<GraveFormData>({
    resolver: zodResolver(graveSchema),
  });

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
        setError(getFriendlyError(err, "Couldn't load data. Refresh the page or try again."));
      }
    };

    if (cemeteryId) loadData();
  }, [cemeteryId, graveId, reset]);

  const onSubmit = async (data: GraveFormData) => {
    try {
      setLoading(true);
      setError(null);

      const graveData = {
        tenantId: '',
        cemeteryId: cemeteryId!,
        ...data,
      } as GraveRecord;

      if (graveId) {
        await cemeteryService.updateGraveRecord(graveId, graveData);
      } else {
        await cemeteryService.createGraveRecord(graveData);
      }

      navigate(`/cemetery/${cemeteryId}`);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't save grave record. Check the details and try again."));
    } finally {
      setLoading(false);
    }
  };

  if (!cemetery) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={`${graveId ? 'Edit grave' : 'Add grave'} - ${cemetery.name}`}
        description="Grave record and burial details"
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Grave details</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Grave number, deceased and burial dates</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Grave Number *"
              {...register('graveNo')}
              placeholder="e.g., A-001, B-045"
              error={errors.graveNo?.message}
            />

            <Input
              label="Deceased Name *"
              {...register('deceasedName')}
              placeholder="Enter full name"
              error={errors.deceasedName?.message}
            />

            <Input label="Date of Death" {...register('dateOfDeath')} type="date" />

            <Input label="Burial Date" {...register('burialDate')} type="date" />

            <Input label="Row Label" {...register('rowLabel')} placeholder="e.g., Row 1, Section A" />

            <div className="sm:col-span-2">
              <label htmlFor="grave-notes" className={labelClasses}>Notes</label>
              <textarea
                id="grave-notes"
                {...register('notes')}
                placeholder="Enter any additional notes"
                rows={4}
                className={`${controlClasses} py-2`}
              />
            </div>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Links</h2>
          <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">
            Optional: Link to member or family (if available)
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label="Member ID (if family member)"
              {...register('deceasedMemberId')}
              placeholder="Member ID (optional)"
            />

            <Input label="Family ID" {...register('familyId')} placeholder="Family ID (optional)" />
          </div>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => navigate(`/cemetery/${cemeteryId}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Grave'}
          </Button>
        </div>
      </form>
    </div>
  );
}
