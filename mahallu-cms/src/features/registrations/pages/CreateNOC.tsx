import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RichTextEditor from '@/components/ui/RichTextEditor';
import PageHeader from '@/components/ui/PageHeader';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { Member } from '@/types';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import UnsavedChangesDialog from '@/components/ui/UnsavedChangesDialog';
import PhoneInput from '@/components/ui/PhoneInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const DEFAULT_NOC_DESCRIPTION = `
<p>To Whom It May Concern,</p>
<p><strong>Subject: No Objection Certificate for Nikah</strong></p>
<p>
  This is to certify that <strong>Mr. [Groom's Full Name]</strong>, son of Mr. [Groom's Father's Name], and
  <strong>Ms. [Bride's Full Name]</strong>, daughter of Mr. [Bride's Father's Name], have approached our Mahall
  for the purpose of solemnizing their marriage through the Islamic Nikah ceremony.
</p>
<p>
  We, the undersigned members of the Mahall committee, hereby declare that we have no objections to the
  aforementioned union, and we consider it in compliance with Islamic customs and teachings. We have
  conducted the necessary due diligence, reviewed the documentation, and ensured that both parties meet
  the requirements for marriage in accordance with Islamic law.
</p>
<p>
  Furthermore, we have performed all required religious and legal checks and verifications, and it is our
  firm belief that the union between <strong>Mr. [Groom's Full Name]</strong> and <strong>Ms. [Bride's Full Name]</strong>
  is permissible under Islamic law.
</p>
<p>The current marital status of the parties is as follows:</p>
<ul>
  <li><strong>Mr. [Groom's Full Name]</strong> - [Current Marital Status] - [Number of Marriages]</li>
  <li><strong>Ms. [Bride's Full Name]</strong> - [Current Marital Status] - [Number of Marriages]</li>
</ul>
<p>
  This No Objection Certificate is issued to facilitate the Nikah ceremony and to confirm that the Mahall
  does not raise any objections to this marriage. We wish the couple a blessed and harmonious marital life.
</p>
<p>
  For any further inquiries or information, please feel free to contact our Mahall office at
  [Contact Information].
</p>
<p>Yours faithfully,</p>
<p>[Signature of the Mahall Committee Member]</p>
<p>[Printed Name of the Mahall Committee Member]</p>
`.trim();

const nocSchema = z.object({
  applicantId: z.string().optional(),
  applicantName: z.string().min(1, 'Applicant name is required'),
  applicantNameMl: z.string().optional(),
  applicantPhone: z.string().optional(),
  purposeTitle: z.string().min(1, 'Purpose title is required'),
  purposeTitleMl: z.string().optional(),
  purposeDescription: z.string().min(1, 'Purpose description is required'),
  type: z.enum(['common', 'nikah']),
});

type NOCFormData = z.infer<typeof nocSchema>;

export default function CreateNOC() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const nocType = searchParams.get('type') || 'common';
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<NOCFormData>({
    mode: 'onTouched',
    resolver: zodResolver(nocSchema),
    defaultValues: {
      type: nocType as 'common' | 'nikah',
      purposeDescription: DEFAULT_NOC_DESCRIPTION,
    },
  });
  const guard = useUnsavedChangesGuard(isDirty);

  const selectedApplicantId = watch('applicantId');
  const purposeDescription = watch('purposeDescription');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        const result = await memberService.getAll({ limit: 1000 });
        setMembers(result.data || []);
      } catch (err) {
        console.error('Error fetching members:', err);
        setMembers([]);
      }
    };
    fetchMembers();
  }, []);

  useEffect(() => {
    if (!selectedApplicantId) return;
    const selectedMember = members.find((m) => m.id === selectedApplicantId);
    if (!selectedMember) return;
    setValue('applicantName', selectedMember.name);
    setValue('applicantPhone', selectedMember.phone || '');
  }, [selectedApplicantId, members, setValue]);

  const onSubmit = async (data: NOCFormData) => {
    try {
      setError(null);
      await registrationService.createNOC({
        applicantId: data.applicantId,
        applicantName: data.applicantName,
        applicantNameMl: data.applicantNameMl,
        applicantPhone: data.applicantPhone,
        purposeTitle: data.purposeTitle,
        purposeTitleMl: data.purposeTitleMl,
        purposeDescription: data.purposeDescription,
        type: data.type,
      });
      navigate(ROUTES.REGISTRATIONS.NOC.COMMON);
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create NOC. Check the details and try again."));
      console.error('Error creating NOC:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create NOC"
        description="Create a new No Objection Certificate"
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
              <Select
                label="Applicant"
                options={[
                  { value: '', label: 'Select applicant...' },
                  ...members.map((member) => ({
                    value: member.id,
                    label: `${member.name} (${member.familyName})`,
                  })),
                ]}
                {...register('applicantId')}
                className="md:col-span-2"
              />
              <Input
                label="Applicant Name"
                {...register('applicantName')}
                error={errors.applicantName?.message}
                required
                placeholder="Applicant Name"
              />
              <div className="hidden">
              <Input
                label="Applicant Name (Malayalam)"
                {...register('applicantNameMl')}
                placeholder="അപേക്ഷകന്റെ പേര്"
                className="font-malayalam"
              />
              </div>
              <PhoneInput
                label="Applicant Phone"
                {...register('applicantPhone')}
                placeholder="Phone Number"
              />
              <Input
                label="Purpose Title"
                {...register('purposeTitle')}
                error={errors.purposeTitle?.message}
                required
                placeholder="Purpose Title"
                className="md:col-span-2"
              />
              <div className="hidden">
              <Input
                label="Purpose Title (Malayalam)"
                {...register('purposeTitleMl')}
                placeholder="ഉദ്ദേശ്യം"
                className="md:col-span-2 font-malayalam"
              />
              </div>
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
              <div className="md:col-span-2">
                <RichTextEditor
                  label="Purpose Description"
                  value={purposeDescription || DEFAULT_NOC_DESCRIPTION}
                  onChange={(val) => setValue('purposeDescription', val, { shouldDirty: true })}
                  error={errors.purposeDescription?.message}
                />
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button type="button" variant="secondary" onClick={() => guard.guardedNavigate(ROUTES.REGISTRATIONS.NOC.COMMON)}>
              <FiX className="h-3.5 w-3.5" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-3.5 w-3.5" />
              Create NOC
            </Button>
          </div>
        </div>
      </form>
      <UnsavedChangesDialog guard={guard} />
    </div>
  );
}

