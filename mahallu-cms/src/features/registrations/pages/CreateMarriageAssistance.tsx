import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { marriageAssistanceService } from '@/services/marriageAssistanceService';
import { memberService } from '@/services/memberService';
import { familyService } from '@/services/familyService';
import { Member } from '@/types/index';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import {
  MARRIAGE_ASSISTANCE_TYPE_OPTIONS,
  buildMarriageAssistancePayload,
  marriageAssistanceSchema,
  requiresAmount,
  type MarriageAssistanceFormData as FormData,
} from '../marriageAssistanceForm';

export default function CreateMarriageAssistance() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [memberOptions, setMemberOptions] = useState<{ value: string; label: string; sublabel?: string }[]>(
    []
  );
  const [familyOptions, setFamilyOptions] = useState<{ value: string; label: string; sublabel?: string }[]>(
    []
  );
  const [isSearching, setIsSearching] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    clearErrors,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(marriageAssistanceSchema),
    defaultValues: {
      type: 'proposal_support',
      personType: 'member',
      amount: '',
    },
  });

  const assistanceType = watch('type');
  const personType = watch('personType');
  const selectedMemberId = watch('memberId');
  const selectedFamilyId = watch('familyId');
  const needsAmount = requiresAmount(assistanceType);

  // Only Financial Assistance has an amount: leaving it drops what was typed and any message about it.
  useEffect(() => {
    if (!needsAmount) {
      setValue('amount', '');
      clearErrors('amount');
    }
  }, [needsAmount, setValue, clearErrors]);

  // Reset selections when person type changes
  useEffect(() => {
    setValue('memberId', '');
    setValue('familyId', '');
    setMembers([]);
    setFamilies([]);
    setMemberOptions([]);
    setFamilyOptions([]);
  }, [personType, setValue]);

  const handleMemberSearch = useCallback(async (query: string) => {
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
          label: toTitleCase(member.name),
          sublabel: member.familyName ? `Family: ${toTitleCase(member.familyName)}` : undefined,
        }))
      );
    } catch (err) {
      console.error('Error searching members:', err);
      setMembers([]);
      setMemberOptions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleFamilySearch = useCallback(async (query: string) => {
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
          label: toTitleCase(family.houseName || family.familyHead),
          sublabel: family.area ? `Area: ${toTitleCase(family.area)}` : undefined,
        }))
      );
    } catch (err) {
      console.error('Error searching families:', err);
      setFamilies([]);
      setFamilyOptions([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const onSubmit = async (data: FormData) => {
    try {
      setError(null);
      await marriageAssistanceService.create(buildMarriageAssistancePayload(data));
      navigate('/registrations/marriage-assistance');
    } catch (err: any) {
      setError(errorMessage(err, { action: 'create record. please try again' }));
      console.error('Error creating record:', err);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Create Marriage Assistance Request"
        description="Register a new marriage assistance request"
        breadcrumbs={[{ label: 'Marriage Assistance', path: '/registrations/marriage-assistance' }]}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <Card className="space-y-4">
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900 dark:border-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <h3 className="md:col-span-2 text-lg font-semibold text-foreground">
              Request Details
            </h3>

            <Select
              label="Assistance Type"
              options={MARRIAGE_ASSISTANCE_TYPE_OPTIONS}
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
                error={errors.memberId?.message as string | undefined}
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
                error={errors.familyId?.message as string | undefined}
              />
            )}

            {needsAmount && (
              <Input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                label="Amount (₹)"
                placeholder="Enter amount"
                helperText="Required for financial assistance."
                required
                {...register('amount')}
                error={errors.amount?.message as string | undefined}
              />
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes</label>
              <textarea
                aria-label="Notes"
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

          <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
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
