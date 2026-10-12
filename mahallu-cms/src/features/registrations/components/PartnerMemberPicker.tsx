import { useCallback, useState } from 'react';
import SearchableSelect, { SearchableSelectOption } from '@/components/ui/SearchableSelect';
import { memberService } from '@/services/memberService';
import type { Member } from '@/types';

/** Optional second member search for a nikah where both the groom and the bride belong to this mahallu. */
export default function PartnerMemberPicker({
  role,
  value,
  onChange,
}: {
  role: 'groom' | 'bride';
  value: string;
  onChange: (memberId: string, member?: Member) => void;
}) {
  const [options, setOptions] = useState<SearchableSelectOption[]>([]);
  const [rows, setRows] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        const res = await memberService.getAll({ gender: role === 'groom' ? 'male' : 'female', search: q || undefined, limit: 50 });
        setRows(res.data || []);
        setOptions((res.data || []).map((m: Member) => ({ value: m.id, label: m.name, sublabel: m.familyName ? `Family: ${m.familyName}` : undefined })));
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    },
    [role]
  );

  return (
    <SearchableSelect
      label={`Is the ${role} also a member of this mahallu? (optional)`}
      placeholder={`Type a name to find the ${role}...`}
      options={options}
      value={value}
      onChange={(id) => onChange(id, rows.find((m) => m.id === id))}
      onSearch={search}
      isLoading={loading}
      helperText="Linking both lets us mark them married and, if you choose, move the bride to the groom's family."
    />
  );
}
