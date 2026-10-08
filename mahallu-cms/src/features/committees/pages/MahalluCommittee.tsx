import { useEffect, useMemo, useState } from 'react';
import { FiAward, FiPlus, FiSave, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import DatePicker from '@/components/ui/DatePicker';
import SearchableSelect from '@/components/ui/SearchableSelect';
import Alert from '@/components/ui/Alert';
import { PageSkeleton } from '@/components/ui/Skeleton';
import PageHeader from '@/components/layout/PageHeader';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { memberService } from '@/services/memberService';
import { fetchAllPages } from '@/services/api';
import { Member } from '@/types';
import { toast } from '@/store/toastStore';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

const ROLE_OPTIONS = [
  'President',
  'Vice President',
  'Secretary',
  'Joint Secretary',
  'Treasurer',
  'Executive Member',
  'Advisor',
].map((role) => ({ value: role, label: role }));

/** Roles one person at a time can hold; the API enforces the same rule. */
const SINGLE_HOLDER_ROLES = ['President', 'Secretary', 'Treasurer'];

interface BearerRow {
  key: number;
  role: string;
  member: string;
}

let rowKey = 0;
const newRow = (role = '', member = ''): BearerRow => ({ key: ++rowKey, role, member });

const toDateInput = (value?: string) => (value ? value.slice(0, 10) : '');

/**
 * The Mahallu's own governing committee: one per Mahallu, with its office
 * bearers (President, Secretary, Treasurer, ...). Other committees stay on the
 * Committees list.
 */
export default function MahalluCommittee() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isNew, setIsNew] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [name, setName] = useState('Mahallu Committee');
  const [nameMl, setNameMl] = useState('');
  const [termStartDate, setTermStartDate] = useState('');
  const [termEndDate, setTermEndDate] = useState('');
  const [rows, setRows] = useState<BearerRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [committee, allMembers] = await Promise.all([
          committeeService.getMahallu(),
          fetchAllPages((params) => memberService.getAll(params)),
        ]);
        if (cancelled) return;
        setMembers(allMembers);
        if (committee) {
          setIsNew(false);
          setName(committee.name || 'Mahallu Committee');
          setNameMl(committee.nameMl || '');
          setTermStartDate(toDateInput(committee.termStartDate));
          setTermEndDate(toDateInput(committee.termEndDate));
          setRows(
            (committee.officeBearers ?? []).map((bearer) =>
              newRow(bearer.role, typeof bearer.member === 'string' ? bearer.member : bearer.member?.id ?? '')
            )
          );
        } else {
          setRows([newRow('President'), newRow('Secretary'), newRow('Treasurer')]);
        }
      } catch (err) {
        if (!cancelled) setLoadError(loadErrorMessage(err, 'Mahallu committee'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const memberOptions = useMemo(
    () =>
      members.map((member) => ({
        value: member.id,
        label: toTitleCase(member.name),
        sublabel: [member.familyName && toTitleCase(member.familyName), member.phone].filter(Boolean).join(' · '),
      })),
    [members]
  );

  const updateRow = (key: number, patch: Partial<BearerRow>) =>
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const removeRow = (key: number) => setRows((current) => current.filter((row) => row.key !== key));

  const duplicateRole = SINGLE_HOLDER_ROLES.find((role) => rows.filter((row) => row.role === role).length > 1);

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const filled = rows.filter((row) => row.role || row.member);
    if (filled.some((row) => !row.role || !row.member)) {
      toast.error('Please choose both a role and a member for every office bearer, or remove the empty row.');
      return;
    }
    if (duplicateRole) {
      toast.error(`Only one person can be ${duplicateRole}.`);
      return;
    }
    if (termStartDate && termEndDate && termEndDate < termStartDate) {
      toast.error('The term end date must be after the start date.');
      return;
    }
    try {
      setSaving(true);
      const saved = await committeeService.saveMahallu({
        name: name.trim() || 'Mahallu Committee',
        nameMl: nameMl.trim(),
        termStartDate: termStartDate || undefined,
        termEndDate: termEndDate || undefined,
        officeBearers: filled.map((row) => ({ role: row.role, member: row.member })),
      });
      setIsNew(false);
      setRows((current) => current.filter((row) => row.role || row.member));
      toast.success(`${saved?.name || 'Mahallu committee'} saved`);
    } catch (err) {
      toast.error(errorMessage(err, { action: 'save the Mahallu committee' }));
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <PageHeader
      title="Mahallu committee"
      description="The governing body of this Mahallu and its office bearers."
      icon={FiAward}
      breadcrumbs={[{ label: 'Committees', path: ROUTES.COMMITTEES.LIST }]}
    />
  );

  if (loading) return <PageSkeleton />;

  if (loadError) {
    return (
      <div className="space-y-4">
        {header}
        <Alert variant="error">{loadError}</Alert>
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {header}

      {isNew && (
        <Alert variant="info">
          This Mahallu has no committee set up yet. Fill in the office bearers below and save to create it.
        </Alert>
      )}

      <Card padding="lg">
        <h2 className="text-base font-semibold text-foreground">Committee details</h2>
        <p className="mb-4 mt-0.5 text-sm text-muted-foreground">Name and current term of the committee.</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Committee name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
          <Input
            label="Name in Malayalam"
            value={nameMl}
            onChange={(e) => setNameMl(e.target.value)}
            maxLength={200}
            className="font-malayalam"
          />
          <DatePicker label="Term starts" value={termStartDate} onChange={setTermStartDate} />
          <DatePicker label="Term ends" value={termEndDate} onChange={setTermEndDate} />
        </div>
      </Card>

      <Card padding="lg">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Office bearers</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              President, Secretary and Treasurer can each be held by one member.
            </p>
          </div>
          <Button type="button" variant="outline" icon={<FiPlus />} onClick={() => setRows((r) => [...r, newRow()])}>
            Add office bearer
          </Button>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No office bearers yet. Use “Add office bearer” to assign roles.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row) => (
              <li
                key={row.key}
                className="grid grid-cols-1 items-end gap-3 rounded-lg border border-border bg-subtle/40 p-3 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto]"
              >
                <Select
                  label="Role"
                  value={row.role}
                  options={[{ value: '', label: 'Choose a role' }, ...ROLE_OPTIONS]}
                  onChange={(e) => updateRow(row.key, { role: e.target.value })}
                  error={duplicateRole && row.role === duplicateRole ? `Only one ${duplicateRole}` : undefined}
                />
                <SearchableSelect
                  label="Member"
                  placeholder="Search members"
                  value={row.member}
                  options={memberOptions}
                  onChange={(value) => updateRow(row.key, { member: value })}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${row.role || 'office bearer'}`}
                  title="Remove"
                  onClick={() => removeRow(row.key)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <FiTrash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex justify-end">
        <Button type="submit" isLoading={saving} loadingText="Saving" icon={<FiSave />}>
          {isNew ? 'Create committee' : 'Save changes'}
        </Button>
      </div>
    </form>
  );
}
