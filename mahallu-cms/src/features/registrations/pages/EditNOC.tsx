import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const nocSchema = z.object({
  applicantName: z.string().max(200, 'Please keep the applicant name to 200 characters or less.').min(1, 'Applicant name is required'),
  applicantPhone: z.string().max(200, 'Please keep the applicant phone to 200 characters or less.').optional(),
  purposeTitle: z.string().max(2000, 'Please keep the purpose title to 2000 characters or less.').min(1, 'Purpose title is required'),
  purposeDescription: z.string().max(3000, 'Please keep the purpose description to 3000 characters or less.').min(1, 'Purpose description is required'),
  type: z.enum(['common', 'nikah']),
  status: z.enum(['pending', 'correction_required', 'approved', 'rejected']).optional(),
  remarks: z.string().max(2000, 'Please keep the remarks to 2000 characters or less.').optional(),
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
    formState: { errors, isSubmitting },
  } = useForm<NOCFormData>({
    resolver: zodResolver(nocSchema),
  });

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
      setError(loadErrorMessage(err, 'noc'));
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
      setError(errorMessage(err, { action: 'update noc. please try again' }));
      console.error('Error updating NOC:', err);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        description="Update No Objection Certificate"
        title="Edit"
        breadcrumbs={[{ label: 'NOC', path: ROUTES.REGISTRATIONS.NOC.COMMON }]}
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Applicant Name"
              {...register('applicantName')}
              error={errors.applicantName?.message}
              required
              placeholder="Applicant Name"
            />
            <Input
              label="Applicant Phone"
              type="tel"
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
                { value: 'correction_required', label: 'Correction Required' },
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
                onChange={(val) => setValue('purposeDescription', val)}
                error={errors.purposeDescription?.message}
              />
            </div>
            <Input label="Remarks" {...register('remarks')} placeholder="Remarks" className="md:col-span-2" />
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.REGISTRATIONS.NOC.COMMON)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Update NOC
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
