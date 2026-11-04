import { useCallback, useMemo, useRef } from 'react';
import type { FieldValues, Path, PathValue, UseFormReturn } from 'react-hook-form';
import { familyService } from '@/services/familyService';
import type { Family, Member } from '@/types';
import { familyIdOf, planAutofill, type Fill } from '@/utils/memberAutofill';

/**
 * Fill a react-hook-form form from the member the user just picked.
 *
 *   const autofill = useMemberAutofill(form);
 *   autofill(member, (m) => deceasedFill(m));                           // fields the member record has
 *   autofill(member, (m, family) => nikahPartyFill('groom', m, family), { withFamily: true });
 *
 * - It only writes the fields the form's fill lists, and never submits anything.
 * - Selecting someone else replaces what the previous member put there; a field the new member has no
 *   data for is cleared only if it still holds the previous member's value (see planAutofill).
 * - `withFamily` loads the member's family once (for the address) and remembers it, so picking the same
 *   family again does not ask the API again. If that request fails the form is filled without it.
 * - A slow family request that finishes after a newer selection is dropped, so an old answer can never
 *   overwrite the current one.
 * - `autofill.forget()` drops what is remembered (call it when a form is reset or reopened for another record).
 */
export function useMemberAutofill<T extends FieldValues>(form: Pick<UseFormReturn<T>, 'setValue' | 'getValues'>) {
  const previous = useRef<Fill>({});
  const families = useRef(new Map<string, Family | null>());
  const latest = useRef(0);
  const { setValue, getValues } = form;

  const autofill = useCallback(
    async (
      member: Member | null | undefined,
      build: (member: Member, family: Family | null) => Fill,
      options: { withFamily?: boolean } = {}
    ) => {
      const mine = ++latest.current;
      let family: Family | null = null;
      if (member && options.withFamily) {
        const familyId = familyIdOf(member);
        if (familyId) {
          if (!families.current.has(familyId)) {
            try {
              families.current.set(familyId, await familyService.getById(familyId));
            } catch {
              families.current.set(familyId, null);
            }
          }
          family = families.current.get(familyId) ?? null;
        }
      }
      if (mine !== latest.current) return;

      const next = member ? build(member, family) : {};
      const { updates, remembered } = planAutofill(previous.current, next, (field) => getValues(field as Path<T>));
      for (const [field, value] of updates) {
        // Validate what was filled (so an old "required" message clears); an emptied field is not nagged about.
        setValue(field as Path<T>, value as PathValue<T, Path<T>>, { shouldDirty: true, shouldValidate: value !== '' });
      }
      previous.current = remembered;
    },
    [setValue, getValues]
  );
  const forget = useCallback(() => {
    latest.current += 1;
    previous.current = {};
  }, []);
  return useMemo(() => Object.assign(autofill, { forget }), [autofill, forget]);
}
