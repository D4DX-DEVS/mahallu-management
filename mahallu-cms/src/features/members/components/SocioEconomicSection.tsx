import { useState } from 'react';
import { UseFormRegister } from 'react-hook-form';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export const OCCUPATION_SECTOR_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'government', label: 'Government' },
  { value: 'private', label: 'Private' },
  { value: 'self_employed', label: 'Self employed' },
  { value: 'abroad', label: 'Abroad' },
  { value: 'unemployed', label: 'Unemployed' },
  { value: 'student', label: 'Student' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'retired', label: 'Retired' },
  { value: 'none', label: 'None' },
];

export const INCOME_RANGE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'none', label: 'No income' },
  { value: 'below_10k', label: 'Below 10,000' },
  { value: '10k_25k', label: '10,000 - 25,000' },
  { value: '25k_50k', label: '25,000 - 50,000' },
  { value: 'above_50k', label: 'Above 50,000' },
];

const FLAGS: Array<{ name: string; label: string }> = [
  { name: 'isJobSeeker', label: 'Job seeker' },
  { name: 'isZakatPayer', label: 'Zakat payer' },
  { name: 'isZakatEligible', label: 'Zakat eligible (candidate)' },
  { name: 'isWidow', label: 'Widow' },
  { name: 'hasDisability', label: 'Has disability' },
  { name: 'isMarriageable', label: 'Open to marriage proposals' },
  { name: 'isVolunteer', label: 'Volunteer' },
];

interface SocioEconomicSectionProps {
  register: UseFormRegister<any>;
  defaultOpen?: boolean;
}

/**
 * Register/welfare flags shared by the member create and edit forms.
 * These are admin-maintained CANDIDATE flags, not verified statuses.
 */
export default function SocioEconomicSection({ register, defaultOpen = false }: SocioEconomicSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span>
          <span className="block text-sm font-semibold text-gray-900 dark:text-gray-100">
            Socio-economic details
          </span>
          <span className="block text-xs text-gray-500 dark:text-gray-400">
            Feeds the community registers and welfare screening
          </span>
        </span>
        <span className="text-xs text-primary-600">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Input label="Occupation" {...register('occupation')} placeholder="e.g. Teacher" />
            <Select
              label="Occupation Sector"
              {...register('occupationSector')}
              options={OCCUPATION_SECTOR_OPTIONS}
            />
            <Select
              label="Monthly Income"
              {...register('monthlyIncomeRange')}
              options={INCOME_RANGE_OPTIONS}
            />
            <Input
              label="Skills"
              {...register('skills')}
              placeholder="Comma separated, e.g. plumbing, driving"
            />
            <div className="md:col-span-2">
              <Input label="Disability Details" {...register('disabilityDetails')} />
            </div>
            <div className="md:col-span-2">
              <Input
                label="Volunteer Skills"
                {...register('volunteerSkills')}
                placeholder="Comma separated"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {FLAGS.map((flag) => (
              <label
                key={flag.name}
                className="flex items-center gap-2 rounded-xl border border-gray-200 px-2.5 py-2 dark:border-gray-700"
              >
                <input
                  aria-label="Select row"
                  type="checkbox"
                  {...register(flag.name)}
                  className="rounded border-gray-300 text-primary-600"
                />
                <span className="text-xs leading-tight text-gray-700 dark:text-gray-200 sm:text-sm">
                  {flag.label}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
