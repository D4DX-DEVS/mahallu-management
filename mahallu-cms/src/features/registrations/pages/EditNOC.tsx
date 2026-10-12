import { useState, useEffect } from 'react';
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
import RichTextEditor from '@/components/ui/RichTextEditor';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhoneInput from '@/components/ui/PhoneInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const nocSchema = z.object({
  applicantName: z.string().min(1, 'Applicant name is required'),
  applicantPhone: z.string().optional(),
  purposeTitle: z.string().min(1, 'Purpose title is required'),
  purposeDescription: z.string().min(1, 'Purpose description is required'),
  type: z.enum(['common', 'nikah']),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  remarks: z.string().optional(),
});

type NOCFormData = z.infer<typeof nocSchema>;

export default function EditNOC() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NOCFormData>({
    mode: 'onTouched',
    resolver: zodResolver(nocSchema),
  });
  const guard = useUnsavedChangesGuard(isDirty);

  useEffect(() => {
    if (id) {
      fetchNOC();
    }
  }, [id]);

  const fetchNOC = async () => {
    if (!id) return;
    try {
      setLoading(true);
      const noc = await registrationService.getNOCById(id);
      setValue('applicantName', noc.applicantName);
      setValue('applicantPhone', noc.applicantPhone || '');
      setValue('purposeTitle', noc.purposeTitle || noc.purpose || '');
      setValue('purposeDescription', noc.purposeDescription || noc.purpose || '');
      setValue('type', noc.type);
      setValue('status', noc.status || 'pending');
      setValue('remarks', noc.remarks || '');
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load NOC. Refresh the page or try again."));
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: NOCFormData) => {
    if (!id) return;
    try {
      setError(null);
      await registrationService.updateNOC(id, {
        applicantName: data.applicantName,
        applicantPhone: data.applicantPhone,
        purposeTitle: data.purposeTitle,
        purposeDescription: data.purposeDescription,
        type: data.type,
        status: data.status,
        remarks: data.remarks,
      });
      navigate(ROUTES.REGISTRATIONS.NOC.COMMON);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't update NOC. Try again in a moment."));
      console.error('Error updating NOC:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Edit NOC"
        description="Update No Objection Certificate"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">NOC details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Applicant and purpose of the certificate</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Input
                label="Applicant Name"
                {...register('applicantName')}
                error={errors.applicantName?.message}
                required
                placeholder="Applicant Name"
              />
              <PhoneInput
                label="Applicant Phone"
                {...register('applicantPhone')}
                placeholder="Phone Number"
              />
              <Select
                label="NOC Type"
                options={[
                  { value: 'common', label: 'Common' },
                  { value: 'nikah', label: 'Nikah' },
                ]}
                {...register('type')}
                error={errors.type?.message}
                required
              />
              <Select
                label="Status"
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'approved', label: 'Approved' },
                  { value: 'rejected', label: 'Rejected' },
                ]}
                {...register('status')}
                error={errors.status?.message}
              />
              <Input
                label="Purpose Title"
                {...register('purposeTitle')}
                error={errors.purposeTitle?.message}
                required
                placeholder="Purpose Title"
                className="md:col-span-2"
              />
              <div className="md:col-span-2">
                <RichTextEditor
                  label="Purpose Description"
                  value={watch('purposeDescription') || ''}
                  onChange={(val) => setValue('purposeDescription', val, { shouldDirty: true })}
                  error={errors.purposeDescription?.message}
                />
              </div>
              <Input
                label="Remarks"
                {...register('remarks')}
                placeholder="Remarks"
                className="md:col-span-2"
              />
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.REGISTRATIONS.NOC.COMMON)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Update NOC
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

