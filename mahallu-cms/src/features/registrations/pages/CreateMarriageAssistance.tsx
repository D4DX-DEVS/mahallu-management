import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { marriageAssistanceService } from '@/services/marriageAssistanceService';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { Member } from '@/types/index';

const schema = z.object({
  type: z.enum(['proposal_support', 'financial_assistance', 'premarital_counselling']),
  personType: z.enum(['member', 'family']),
  memberId: z.string().optional(),
  familyId: z.string().optional(),
  amount: z.preprocess(
    (val) => (val === '' || val === undefined ? undefined : Number(val)),
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
      setError(err.response?.data?.message || 'Failed to create record. Please try again.');
      console.error('Error creating record:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Create Marriage Assistance Request</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Register a new marriage assistance request</p>
        </div>
        <Breadcrumb
          items={[
            { label: 'Dashboard', path: '/dashboard' },
            { label: 'Marriage Assistance', path: '/registrations/marriage-assistance' },
            { label: 'Create' },
          ]}
        />
      </div>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card className="space-y-6">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <h3 className="md:col-span-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Request Details
            </h3>

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
              <Input
                type="number"
                label="Amount (₹)"
                placeholder="Enter amount"
                {...register('amount')}
                error={errors.amount?.message as string | undefined}
                min="0"
              />
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes
              </label>
              <textarea
                {...register('notes')}
                placeholder="Add any additional notes..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
              {errors.notes && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notes.message}</p>
              )}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/registrations/marriage-assistance')}
            >
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting}>
              Create Request
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}
