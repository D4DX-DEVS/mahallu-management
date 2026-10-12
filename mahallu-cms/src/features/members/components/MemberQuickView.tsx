import { useState } from 'react';
import { Link } from 'react-router-dom';
import { FiRepeat } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { toast } from '@/store/toastStore';
import { TransferMemberDialog } from '@/features/families/components/FamilyLifecycleDialogs';
import DetailModal, { DetailField, DetailSection, humanize } from '@/components/ui/DetailModal';
import Badge from '@/components/ui/Badge';
import Avatar from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import GenderChip from '@/components/ui/GenderChip';
import RoleChip from '@/components/ui/RoleChip';
import { DetailModalController } from '@/hooks/useDetailModal';
import { useDetailRecord } from '@/hooks/useDetailRecord';
import { memberService } from '@/services/memberService';
import { ROUTES } from '@/constants/routes';
import { Member } from '@/types';
import StatusBadge from '@/components/ui/StatusBadge';

/** The API populates familyId on GET /members/:id ({ id/_id, houseName, mahallId }); list rows carry a plain id. */
type PopulatedFamily = { id?: string; _id?: string; houseName?: string; mahallId?: string };

function familyRef(m: Member): { id: string; name?: string; mahallId?: string } {
  const raw = m.familyId as unknown as string | PopulatedFamily | undefined;
  if (raw && typeof raw === 'object') return { id: String(raw.id ?? raw._id ?? ''), name: raw.houseName, mahallId: raw.mahallId };
  return { id: raw ? String(raw) : '' };
}

/** Community flags: only the true ones are shown. [flag, label, badge tone] */
const FLAGS: Array<[keyof Member, string, 'primary' | 'warning' | 'danger' | 'info' | 'neutral']> = [
  ['isFamilyHead', 'Family head', 'primary'],
  ['isZakatPayer', 'Zakat payer', 'primary'],
  ['isZakatEligible', 'Zakat eligible', 'warning'],
  ['isVolunteer', 'Volunteer', 'info'],
  ['isJobSeeker', 'Job seeker', 'info'],
  ['isMarriageable', 'Marriageable', 'neutral'],
  ['isWidow', 'Widow', 'neutral'],
  ['isOrphan', 'Orphan', 'warning'],
  ['hasDisability', 'Disability', 'warning'],
  ['isDead', 'Deceased', 'danger'],
];

export interface MemberQuickViewProps {
  detail: DetailModalController;
  /** The list's current rows: used to paint the header instantly while the full record loads. */
  rows?: Member[];
  /** Show the Edit button (same permission the list's edit icon uses). */
  canEdit?: boolean;
  /** Called after the member moved to another family so the list can reload. */
  onChanged?: () => void;
}

/** Quick view of one member. Same pattern as FamilyQuickView. */
export default function MemberQuickView({ detail, rows = [], canEdit = true, onChanged }: MemberQuickViewProps) {
  const { viewId } = detail;
  const [moving, setMoving] = useState(false);
  const { data, loading, error, retry } = useDetailRecord<Member>({
    key: 'member',
    id: viewId,
    fetcher: (id, signal) => memberService.getById(id, signal),
    prefetchIds: [detail.ids[detail.index - 1], detail.ids[detail.index + 1]],
  });

  const m: Member | undefined = data ?? rows.find((r) => String(r.id) === viewId);
  const fam = m ? familyRef(m) : undefined;
  const famName = fam?.name || m?.familyName;
  const flags = m ? FLAGS.filter(([k]) => m[k] === true) : [];
  const list = (v?: string[] | string) => (Array.isArray(v) ? v.join(', ') : v);

  return (
    <DetailModal
      isOpen={viewId !== null}
      onClose={detail.close}
      nav={detail}
      title={m?.name ?? 'Member'}
      avatar={<Avatar name={m?.name} src={m?.photoUrl} size={56} />}
      subtitle={
        m && (
          <>
            <span>{[m.age != null ? `${m.age} yrs` : null, m.gender ? humanize(m.gender) : null].filter(Boolean).join(' / ') || 'Age not set'}</span>
            {m.mahallId && <span> · {m.mahallId}</span>}
            {fam?.id && famName && (
              <>
                {' · '}
                <Link to={`${ROUTES.FAMILIES.LIST}?view=${fam.id}`} className="font-semibold text-primary-600 hover:underline dark:text-brand-lime">
                  {famName}
                </Link>
              </>
            )}
          </>
        )
      }
      badges={
        m && (
          <>
            {m.bloodGroup && <BloodGroupBadge value={m.bloodGroup} />}
            {m.gender && <GenderChip value={m.gender} />}
            {m.maritalStatus && <Badge variant="neutral">{humanize(m.maritalStatus)}</Badge>}
            {m.isFamilyHead && <RoleChip isHead />}
            {m.isDead && <Badge variant="danger">Deceased</Badge>}
          </>
        )
      }
      loading={loading && !data}
      error={error}
      onRetry={retry}
      fullPageHref={viewId ? ROUTES.MEMBERS.DETAIL(viewId) : undefined}
      editHref={canEdit && viewId ? ROUTES.MEMBERS.EDIT(viewId) : undefined}
      primaryAction={
        canEdit && m && !m.isDead ? (
          <Button size="sm" variant="secondary" onClick={() => setMoving(true)}>
            <FiRepeat className="h-3.5 w-3.5" aria-hidden="true" />
            Move to another family
          </Button>
        ) : undefined
      }
    >
      {m && (
        <>
          {flags.length > 0 && (
            <div className="mb-5 flex flex-wrap gap-1.5" aria-label="Community flags">
              {flags.map(([k, label, tone]) => (
                <Badge key={String(k)} variant={tone} dot>
                  {label}
                </Badge>
              ))}
            </div>
          )}
          <DetailSection title="Personal">
            <DetailField label="Name (Malayalam)" value={m.nameMl} ml />
            <DetailField label="Mahall ID" value={m.mahallId} copy />
            <DetailField label="Age" value={m.age} />
            <DetailField label="Gender" value={m.gender ? <GenderChip value={m.gender} /> : undefined} />
            <DetailField label="Marital status" value={m.maritalStatus ? <StatusBadge status={m.maritalStatus} label={humanize(m.maritalStatus)} tone="neutral" dot={false} /> : undefined} />
            <DetailField label="Marriages" value={m.marriageCount} />
          </DetailSection>
          <DetailSection title="Contact">
            <DetailField label="Phone" value={m.phone} kind="tel" copy />
          </DetailSection>
          <DetailSection title="Health">
            <DetailField label="Blood group" value={m.bloodGroup ? <BloodGroupBadge value={m.bloodGroup} size="sm" /> : undefined} />
            <DetailField label="Health status" value={m.healthStatus} />
            {m.hasDisability && <DetailField label="Disability details" value={m.disabilityDetails} wide />}
          </DetailSection>
          <DetailSection title="Education & occupation">
            <DetailField label="Education" value={m.education} />
            <DetailField label="Occupation" value={m.occupation} />
            <DetailField label="Sector" value={humanize(m.occupationSector)} />
            <DetailField label="Monthly income" value={humanize(m.monthlyIncomeRange)} />
            <DetailField label="Skills" value={list(m.skills)} wide />
            {m.isVolunteer && <DetailField label="Volunteer skills" value={list(m.volunteerSkills)} wide />}
          </DetailSection>
          <DetailSection title="Family">
            <DetailField
              label="Family"
              value={fam?.id && famName ? <Link to={`${ROUTES.FAMILIES.LIST}?view=${fam.id}`} className="font-semibold text-primary-600 hover:underline dark:text-brand-lime">{famName}</Link> : famName}
            />
            <DetailField label="Family ID" value={fam?.mahallId} copy />
          </DetailSection>
        </>
      )}
      {m && moving && (
        <TransferMemberDialog
          open
          member={{ id: m.id, name: m.name, isFamilyHead: m.isFamilyHead }}
          currentFamilyId={fam?.id}
          onClose={() => setMoving(false)}
          onDone={(msg) => {
            toast.success(msg || `${m.name} moved to the new family.`);
            setMoving(false);
            retry();
            onChanged?.();
          }}
        />
      )}
    </DetailModal>
  );
}
