import { useState, useEffect, useCallback } from 'react';
import { categoryService } from '@/services/categoryService';

export interface CategoryOption {
  value: string;
  label: string;
  /** Present only where the category carries one (e.g. 'varisangya_grade'). */
  amount?: number;
}

export interface UseCategoryOptionsOpts {
  includeBlank?: boolean;
  blankLabel?: string;
}

/**
 * Fetches the active values for a Categories master-data key (e.g.
 * 'gender', 'blood_group', 'education') and exposes them as {value,label}
 * options — a drop-in replacement for the hardcoded const arrays that used
 * to feed Select/RadioCardGroup across the app.
 */
export function useCategoryOptions(categoryKey: string, opts?: UseCategoryOptionsOpts) {
  const [options, setOptions] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const values = await categoryService.getActiveValuesByKey(categoryKey);
      const mapped = values.map((v) => ({ value: v.code, label: v.label, amount: v.amount }));
      setOptions(
        opts?.includeBlank ? [{ value: '', label: opts.blankLabel ?? 'Select...' }, ...mapped] : mapped
      );
    } catch (err) {
      console.error(`Failed to fetch options for category '${categoryKey}':`, err);
      setOptions(opts?.includeBlank ? [{ value: '', label: opts.blankLabel ?? 'Select...' }] : []);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryKey, opts?.includeBlank, opts?.blankLabel]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { options, loading, refresh };
}
