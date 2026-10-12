import { useState } from 'react';
import { UseFormRegister } from 'react-hook-form';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';

export const ECONOMIC_STATUS_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'stable', label: 'Stable' },
  { value: 'struggling', label: 'Struggling' },
  { value: 'needs_assistance', label: 'Needs assistance' },
];

export const WELFARE_STATUS_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'none', label: 'None' },
  { value: 'receiving', label: 'Receiving' },
  { value: 'applied', label: 'Applied' },
  { value: 'needs_review', label: 'Needs review' },
];

export const HOUSING_TYPE_OPTIONS = [
  { value: '', label: 'Not specified' },
  { value: 'own', label: 'Own house' },
  { value: 'rented', label: 'Rented' },
  { value: 'shared', label: 'Shared' },
  { value: 'none', label: 'No housing' },
];

interface WelfareSectionProps {
  register: UseFormRegister<any>;
  defaultOpen?: boolean;
}

/** Household welfare profile shared by the family create and edit forms. */
export default function WelfareSection({ register, defaultOpen = false }: WelfareSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span>
          <span className="block text-[13.5px] font-bold text-[#18231E] dark:text-surface-text">
            Socio-economic details
          </span>
          <span className="block text-xs text-[#7B8983] dark:text-surface-muted">
            Drives the welfare register and assistance screening
          </span>
        </span>
        <span className="text-xs font-bold text-primary-600 dark:text-brand-lime">{open ? 'Hide' : 'Show'}</span>
      </button>

      {open && (
        <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
          <Select label="Economic Status" {...register('economicStatus')} options={ECONOMIC_STATUS_OPTIONS} />
          <Select label="Welfare Status" {...register('welfareStatus')} options={WELFARE_STATUS_OPTIONS} />
          <Select label="Housing Type" {...register('housingType')} options={HOUSING_TYPE_OPTIONS} />
          <Input label="Special Requirements" {...register('specialRequirements')} />
        </div>
      )}
    </Card>
  );
}
