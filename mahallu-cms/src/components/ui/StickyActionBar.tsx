import { FiArrowLeft, FiArrowRight, FiSave, FiX } from 'react-icons/fi';
import Button from './Button';
import { cn } from '@/utils/cn';
import { useModalPage } from '@/hooks/useModalContext';

export interface StickyActionBarProps {
  /** e.g. "Step 1 of 4" */
  stepText?: string;
  dirty?: boolean;
  onCancel?: () => void;
  onSaveDraft?: () => void;
  draftSaved?: boolean;
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  /** Last step: shows the submit button (type=submit) instead of Next */
  isLast?: boolean;
  submitLabel: string;
  isSubmitting?: boolean;
  className?: string;
}

/** Sticky footer for forms: step text + unsaved indicator on the left, Cancel / Save draft / Back / Next|Submit on the right. */
export default function StickyActionBar({
  stepText,
  dirty,
  onCancel,
  onSaveDraft,
  draftSaved,
  onBack,
  onNext,
  nextLabel = 'Next',
  isLast = true,
  submitLabel,
  isSubmitting,
  className,
}: StickyActionBarProps) {
  const { isInModal } = useModalPage();
  const m = stepText?.match(/(\d+)\D+(\d+)/);
  const pct = m && +m[2] > 0 ? Math.min(100, Math.round((+m[1] / +m[2]) * 100)) : null;
  return (
    <div
      className={cn(
        'sticky bottom-0 z-10 flex flex-wrap items-center gap-x-3 gap-y-2 bg-white/95 px-4 py-3 backdrop-blur dark:bg-surface-card/95 max-sm:gap-y-2.5',
        isInModal
          ? '-mx-5 -mb-4 mt-4 border-t border-line-soft px-5 dark:border-surface-border'
          : '-mx-1 mt-2 rounded-card border border-line shadow-card dark:border-surface-border',
        className
      )}
    >
      <span className="flex items-center gap-2 text-xs text-[#7B8983] dark:text-surface-muted max-sm:w-full" aria-live="polite">
        {stepText && <span className="whitespace-nowrap font-semibold max-sm:text-[#3A4741] max-sm:dark:text-surface-text">{stepText}</span>}
        {pct !== null && (
          <span className="hidden h-1 flex-1 overflow-hidden rounded-full bg-[#E7EEEA] dark:bg-surface-raised max-sm:block" aria-hidden="true">
            <span className="block h-full rounded-full bg-progress-brand" style={{ width: `${pct}%` }} />
          </span>
        )}
        {dirty && (
          <>
            {stepText && <span aria-hidden="true" className="max-sm:hidden">·</span>}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold text-[#7A5B00] dark:text-secondary-300">
              <span className="h-1.5 w-1.5 rounded-full bg-secondary-500" aria-hidden="true" />
              <span className="max-sm:hidden">Unsaved changes</span>
              <span className="sm:hidden">Unsaved</span>
            </span>
          </>
        )}
        {draftSaved && !dirty && <span className="whitespace-nowrap font-semibold text-primary-700 dark:text-brand-lime">Draft saved</span>}
      </span>
      <span className="ml-auto flex flex-wrap items-center gap-2 max-sm:w-full max-sm:flex-nowrap">
        {onCancel && (
          <Button type="button" variant="secondary" onClick={onCancel} className="max-sm:px-3">
            <FiX className="h-3.5 w-3.5" />
            Cancel
          </Button>
        )}
        {onSaveDraft && (
          <Button type="button" variant="soft" onClick={onSaveDraft} aria-label="Save draft" className="max-sm:w-11 max-sm:flex-none max-sm:px-0">
            <FiSave className="h-3.5 w-3.5" />
            <span className="max-sm:hidden">Save draft</span>
          </Button>
        )}
        {onBack && (
          <Button type="button" variant="secondary" onClick={onBack} className="max-sm:px-3">
            <FiArrowLeft className="h-3.5 w-3.5" />
            Back
          </Button>
        )}
        {isLast ? (
          <Button key="submit" type="submit" isLoading={isSubmitting} disabled={isSubmitting} className="max-sm:min-w-0 max-sm:flex-1">
            {submitLabel}
          </Button>
        ) : (
          <Button key="next" type="button" onClick={onNext} className="max-sm:min-w-0 max-sm:flex-1">
            {nextLabel}
            <FiArrowRight className="h-3.5 w-3.5" />
          </Button>
        )}
      </span>
    </div>
  );
}
