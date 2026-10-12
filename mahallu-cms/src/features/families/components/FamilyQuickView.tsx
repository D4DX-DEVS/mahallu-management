import { useEffect, useState } from 'react';
import { FiAward, FiHome, FiUsers, FiRepeat } from 'react-icons/fi';
import { TransferMemberDialog } from './FamilyLifecycleDialogs';
import { toast } from '@/store/toastStore';
import DetailModal, { DetailField, DetailList, DetailSection, DetailStats, humanize } from '@/components/ui/DetailModal';
import Avatar from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import GradeChip from '@/components/ui/GradeChip';
import RoleChip from '@/components/ui/RoleChip';
import StatusBadge from '@/components/ui/StatusBadge';
import { DetailModalController } from '@/hooks/useDetailModal';
import { useDetailRecord } from '@/hooks/useDetailRecord';
import { familyService } from '@/services/familyService';
import { memberService } from '@/services/memberService';
import { ROUTES } from '@/constants/routes';
import { gradeLevel } from '@/utils/statSeries';
import { Family, Member } from '@/types';

interface FamilyBundle {
  family: Family;
  members: Member[];
}

/** One request pair per family: the record plus its members (members failing must not break the view). */
const fetchFamily = async (id: string, signal?: AbortSignal): Promise<FamilyBundle> => {
  const [family, members] = await Promise.all([
    familyService.getById(id, signal),
    memberService.getByFamily(id, signal).catch((e) => {
      if (e?.code === 'ERR_CANCELED') throw e;
      return [] as Member[];
    }),
  ]);
  return { family, members };
};

export interface FamilyQuickViewProps {
  detail: DetailModalController;
  /** The list's current rows: used to paint the header instantly while the full record loads. */
  rows?: Family[];
  /** Show the Edit button (same permission the list's edit icon uses). */
  canEdit?: boolean;
  /** Called after a member moved to another family so the list can reload. */
  onChanged?: () => void;
}

/** Quick view of one family. Reference implementation of the pattern in ui/DetailModal.tsx. */
export default function FamilyQuickView({ detail, rows = [], canEdit = true, onChanged }: FamilyQuickViewProps) {
  const { viewId } = detail;
  const [moveMember, setMoveMember] = useState<Member | null>(null);
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    if (!viewId) setTab('overview');
  }, [viewId]);
  const { data, loading, error, retry } = useDetailRecord<FamilyBundle>({
    key: 'family',
    id: viewId,
    fetcher: fetchFamily,
    prefetchIds: [detail.ids[detail.index - 1], detail.ids[detail.index + 1]],
  });

  const row = rows.find((r) => String(r.id) === viewId);
  const f: Family | undefined = data?.family ?? row;
  const members = data?.members ?? [];

  const male = members.filter((m) => m.gender === 'male').length;
  const female = members.filter((m) => m.gender === 'female').length;
  const children = members.filter((m) => typeof m.age === 'number' && m.age < 18).length;
  const grade = gradeLevel(f?.varisangyaGrade);

  const stats = data
    ? [
        {
          title: 'Members',
          value: members.length,
          icon: <FiUsers />,
          tone: 'lime' as const,
          pills: male + female > 0 ? [`${male} male`, `${female} female`] : undefined,
          summary: `${members.length} members: ${male} male, ${female} female`,
        },
        ...(f?.varisangyaGrade
          ? [
              {
                title: 'Varisangya grade',
                value: f.varisangyaGrade,
                icon: <FiAward />,
                tone: 'gold' as const,
                viz: grade ? { type: 'meter' as const, level: grade } : undefined,
                summary: `Varisangya grade ${f.varisangyaGrade}${grade ? `, level ${grade} of 5` : ''}`,
              },
            ]
          : []),
        ...(members.some((m) => typeof m.age === 'number')
          ? [{ title: 'Children (under 18)', value: children, icon: <FiHome />, tone: 'neutral' as const }]
          : []),
      ]
    : [];

  return (
    <DetailModal
      isOpen={viewId !== null}
      onClose={detail.close}
      nav={detail}
      title={f?.houseName ?? 'Family'}
      avatar={<Avatar name={f?.houseName} size={56} />}
      subtitle={
        f && (
          <>
            {f.familyHead ? <span>Head: <span className="font-semibold">{f.familyHead}</span></span> : <span>No family head set</span>}
            {f.mahallId && <span> · {f.mahallId}</span>}
          </>
        )
      }
      badges={
        f && (
          <>
            {f.status && <StatusBadge status={f.status} dot />}
            {f.varisangyaGrade && <GradeChip value={f.varisangyaGrade} />}
          </>
        )
      }
      tabs={[
        { value: 'overview', label: 'Overview' },
        { value: 'members', label: 'Members', count: data ? members.length : undefined },
      ]}
      tab={tab}
      onTabChange={setTab}
      loading={loading && !data}
      error={error}
      onRetry={retry}
      fullPageHref={viewId ? ROUTES.FAMILIES.DETAIL(viewId) : undefined}
      editHref={canEdit && viewId ? ROUTES.FAMILIES.EDIT(viewId) : undefined}
    >
      {f && tab === 'overview' && (
        <>
          <DetailStats items={stats} />
          <DetailSection title="Household">
            <DetailField label="Mahall ID" value={f.mahallId} copy />
            <DetailField label="House name (Malayalam)" value={f.houseNameMl} ml />
            <DetailField label="House no." value={f.houseNo} />
            <DetailField label="Ward" value={f.wardNumber} />
            <DetailField label="Area" value={f.area} />
            <DetailField label="Place" value={f.place} />
            <DetailField label="Contact" value={f.contactNo} kind="tel" copy />
            <DetailField label="Housing" value={humanize(f.housingType)} />
            <DetailField label="Economic status" value={humanize(f.economicStatus)} />
            <DetailField label="Welfare status" value={humanize(f.welfareStatus)} />
            <DetailField label="Special requirements" value={f.specialRequirements} wide />
          </DetailSection>
          <DetailSection title="Address">
            <DetailField label="Village" value={f.village} />
            <DetailField label="LSG" value={f.lsgName} />
            <DetailField label="District" value={f.district} />
            <DetailField label="State" value={f.state} />
            <DetailField label="Post office" value={f.postOffice} />
            <DetailField label="Pin code" value={f.pinCode} />
          </DetailSection>
        </>
      )}
      {f && tab === 'members' && (
        <DetailList
          title="Family members"
          emptyText="No members added to this family yet"
          items={members.map((m) => ({
            id: String(m.id),
            leading: <Avatar name={m.name} src={m.photoUrl} size={32} />,
            primary: m.name,
            secondary: [m.age != null ? `${m.age} yrs` : null, m.gender ? humanize(m.gender) : null].filter(Boolean).join(' · ') || undefined,
            meta: (
              <>
                {m.isFamilyHead && <RoleChip isHead />}
                {m.bloodGroup && <BloodGroupBadge value={m.bloodGroup} size="sm" />}
                {canEdit && !f.isArchived && !m.isDead && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMoveMember(m);
                    }}
                    className="rounded-lg p-1.5 text-[#5B6963] transition-colors hover:bg-mint hover:text-primary-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:text-surface-muted dark:hover:bg-surface-hover"
                    title="Move to another family"
                    aria-label={`Move ${m.name} to another family`}
                  >
                    <FiRepeat className="h-3.5 w-3.5" />
                  </button>
                )}
              </>
            ),
            to: `${ROUTES.MEMBERS.LIST}?view=${m.id}`,
          }))}
        />
      )}
      {moveMember && f && (
        <TransferMemberDialog
          open
          member={moveMember}
          currentFamilyId={f.id}
          onClose={() => setMoveMember(null)}
          onDone={(msg) => {
            toast.success(msg || `${moveMember.name} moved to the new family.`);
            setMoveMember(null);
            retry();
            onChanged?.();
          }}
        />
      )}
    </DetailModal>
  );
}
