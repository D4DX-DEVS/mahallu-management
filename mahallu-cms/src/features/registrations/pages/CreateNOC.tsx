import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FiSave, FiX } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import RichTextEditor from '@/components/ui/RichTextEditor';
import { ROUTES } from '@/constants/routes';
import { registrationService } from '@/services/registrationService';
import { memberService } from '@/services/memberService';
import { fetchAllPages } from '@/services/api';
import { Member } from '@/types';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

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
  applicantId: z.string().max(200, 'Please keep the applicant to 200 characters or less.').optional(),
  applicantName: z.string().max(200, 'Please keep the applicant name to 200 characters or less.').min(1, 'Applicant name is required'),
  applicantNameMl: z.string().max(200, 'Please keep the applicant name to 200 characters or less.').optional(),
  applicantPhone: z.string().max(200, 'Please keep the applicant phone to 200 characters or less.').optional(),
  purposeTitle: z.string().max(2000, 'Please keep the purpose title to 2000 characters or less.').min(1, 'Purpose title is required'),
  purposeTitleMl: z.string().max(2000, 'Please keep the purpose title to 2000 characters or less.').optional(),
  purposeDescription: z.string().max(3000, 'Please keep the purpose description to 3000 characters or less.').min(1, 'Purpose description is required'),
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
    formState: { errors, isSubmitting },
  } = useForm<NOCFormData>({
    resolver: zodResolver(nocSchema),
    defaultValues: {
      type: nocType as 'common' | 'nikah',
      purposeDescription: DEFAULT_NOC_DESCRIPTION,
    },
  });

  const selectedApplicantId = watch('applicantId');
  const purposeDescription = watch('purposeDescription');

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
      setError(errorMessage(err, { action: 'create noc. please try again' }));
      console.error('Error creating NOC:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create NOC"
        description="Create a new No Objection Certificate"
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
            <Select
              label="Applicant"
              options={[
                { value: '', label: 'Select applicant...' },
                ...members.map((member) => ({
                  value: member.id,
                  label: `${toTitleCase(member.name)} (${toTitleCase(member.familyName)})`,
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
            <Input
              label="Applicant Phone"
              type="tel"
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
                onChange={(val) => setValue('purposeDescription', val)}
                error={errors.purposeDescription?.message}
              />
            </div>
          </div>

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button type="button" variant="outline" onClick={() => navigate(ROUTES.REGISTRATIONS.NOC.COMMON)}>
              <FiX className="h-4 w-4 mr-2" />
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              <FiSave className="h-4 w-4 mr-2" />
              Create NOC
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
