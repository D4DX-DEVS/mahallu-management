import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import PageHeader from '@/components/ui/PageHeader';
import { marriageAssistanceService } from '@/services/marriageAssistanceService';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { Member } from '@/types/index';
import AmountInput from '@/components/ui/AmountInput';
import { toast } from '@/store/toastStore';
import { getFriendlyError } from '@/utils/apiMessages';

const schema = z.object({
  type: z.enum(['proposal_support', 'financial_assistance', 'premarital_counselling']),
  personType: z.enum(['member', 'family']),
  memberId: z.string().optional(),
  familyId: z.string().optional(),
  amount: z.preprocess(
    (val) => (val === '' || Number.isNaN(val) ? undefined : val),
    z.number().min(0).optional()
  ),
  notes: z.string().optional(),
}).refine(
  (data) => data.memberId || data.familyId,
  { message: 'Either member or family must be selected', path: ['memberId'] }
);

type FormData = z.infer<typeof schema>;

export default function CreateMarriageAssistance() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [familyOptions, setFamilyOptions] = useState<{ value: string; label: string; sublabel?: string }[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'proposal_support',
      personType: 'member',
    },
  });

  const assistanceType = watch('type');
  const personType = watch('personType');
  const selectedMemberId = watch('memberId');
  const selectedFamilyId = watch('familyId');

  // Reset selections when person type changes
  useEffect(() => {
    setValue('memberId', '');
    setValue('familyId', '');
    setMembers([]);
    setFamilies([]);
    setMemberOptions([]);
    setFamilyOptions([]);
  }, [personType, setValue]);

  const handleMemberSearch = useCallback(
    async (query: string) => {
      setIsSearching(true);
      try {
        const result = await memberService.getAll({
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
        setIsSearching(false);
      }
    },
    []
  );

  const handleFamilySearch = useCallback(
    async (query: string) => {
      setIsSearching(true);
      try {
        const result = await familyService.getAll({
          search: query || undefined,
          limit: 50,
        });
        const fetchedFamilies = result.data || [];
        setFamilies(fetchedFamilies);
        setFamilyOptions(
          fetchedFamilies.map((family: any) => ({
            value: family.id,
            label: family.houseName || family.familyHead,
            sublabel: family.area ? `Area: ${family.area}` : undefined,
          }))
        );
      } catch (err) {
        console.error('Error searching families:', err);
        setFamilies([]);
        setFamilyOptions([]);
      } finally {
        setIsSearching(false);
      }
    },
    []
  );

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await marriageAssistanceService.create({
        type: data.type,
        memberId: data.personType === 'member' ? data.memberId : undefined,
        familyId: data.personType === 'family' ? data.familyId : undefined,
        amount: data.amount,
        notes: data.notes,
      });
      navigate('/registrations/marriage-assistance');
    } catch (err: any) {
      toast.error(getFriendlyError(err, "Couldn't create record. Check the details and try again."));
      console.error('Error creating record:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Marriage Assistance Request"
        description="Register a new marriage assistance request"
      />

      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-4">
          {error && (
            <Alert tone="danger">{error}</Alert>
          )}

          <Card>
            <div className="mb-3.5">
              <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Request Details</h2>
              <p className="mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Who the request is for and the type of assistance</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label="Assistance Type"
                options={[
                  { value: 'proposal_support', label: 'Proposal Support' },
                  { value: 'financial_assistance', label: 'Financial Assistance' },
                  { value: 'premarital_counselling', label: 'Premarital Counselling' },
                ]}
                {...register('type')}
                error={errors.type?.message as string | undefined}
              />

              <Select
                label="For Member or Family"
                options={[
                  { value: 'member', label: 'Member' },
                  { value: 'family', label: 'Family' },
                ]}
                {...register('personType')}
                error={errors.personType?.message as string | undefined}
              />

              {personType === 'member' && (
                <SearchableSelect
                  label="Select Member"
                  placeholder="Type a name to search members..."
                  options={memberOptions}
                  value={selectedMemberId || ''}
                  onChange={(id) => setValue('memberId', id)}
                  onSearch={handleMemberSearch}
                  isLoading={isSearching}
                />
              )}

              {personType === 'family' && (
                <SearchableSelect
                  label="Select Family"
                  placeholder="Type family name to search..."
                  options={familyOptions}
                  value={selectedFamilyId || ''}
                  onChange={(id) => setValue('familyId', id)}
                  onSearch={handleFamilySearch}
                  isLoading={isSearching}
                />
              )}

              {assistanceType === 'financial_assistance' && (
                <AmountInput
                  label="Amount (₹)"
                  placeholder="Enter amount"
                  {...register('amount')}
                  error={errors.amount?.message as string | undefined}
                />
              )}

              <div className="md:col-span-2">
                <label className="mb-1.5 block text-xs font-semibold text-[#3A4741] dark:text-surface-text">
                  Notes
                </label>
                <textarea
                  {...register('notes')}
                  placeholder="Add any additional notes..."
                  rows={4}
                  className="w-full rounded-[10px] border border-line-strong bg-white px-3 py-2 text-[13px] text-[#18231E] transition-[border-color,box-shadow] placeholder:text-[#98A59F] focus:border-primary-600 focus:shadow-focus focus:outline-none dark:border-surface-border-strong dark:bg-surface-raised dark:text-surface-text dark:focus:border-brand-lime"
                />
                {errors.notes && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notes.message}</p>
                )}
              </div>
            </div>
          </Card>

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap justify-end gap-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] [&>button]:flex-1 sm:[&>button]:flex-none border-t border-line bg-white/90 px-4 py-3 backdrop-blur dark:border-surface-border dark:bg-surface-card/90">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/registrations/marriage-assistance')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Request
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
