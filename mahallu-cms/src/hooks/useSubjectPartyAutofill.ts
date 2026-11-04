import { useEffect, useRef } from 'react';
import { planAutofill, type Fill } from '@/utils/memberAutofill';

interface PartyValues {
  groomName: string;
  groomAge: string;
  brideName: string;
  brideAge: string;
}

interface Args {
  /** The family member the Family Head picked (from the member's own family list). */
  subject: { name: string; age?: number } | undefined;
  /** Which side of the Nikah that person is, as the form's own groom/bride choice says. */
  side: 'groom' | 'bride';
  values: PartyValues;
  setters: { [K in keyof PartyValues]: (value: string) => void };
}

/**
 * Member-portal Nikah and NOC requests keep their fields in plain state (not react-hook-form). When a Family
 * Head picks a family member, that person's name and age go on the groom or the bride side, whichever the
 * form is set to. Changing the person or the side replaces what was filled before; a value the head typed
 * themselves is left alone (see planAutofill). The person's age is only filled when the record has one.
 */
export function useSubjectPartyAutofill({ subject, side, values, setters }: Args) {
  const filled = useRef<Fill>({});
  const latest = useRef({ values, setters });
  latest.current = { values, setters };

  const name = subject?.name;
  const age = subject?.age;
  useEffect(() => {
    const next: Fill = name
      ? { [`${side}Name`]: name, [`${side}Age`]: typeof age === 'number' && age > 0 ? age : undefined }
      : {};
    const { values: current, setters: set } = latest.current;
    const plan = planAutofill(filled.current, next, (field) => current[field as keyof PartyValues]);
    for (const [field, value] of plan.updates) set[field as keyof PartyValues](String(value));
    filled.current = plan.remembered;
  }, [name, age, side]);
}
