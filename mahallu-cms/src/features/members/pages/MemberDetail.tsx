import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import DetailSection from '@/components/ui/DetailSection';
import { RiBriefcaseLine, RiHeartPulseLine, RiUser3Line } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { ROUTES } from '@/constants/routes';
import { memberService } from '@/services/memberService';
import { instituteService } from '@/services/instituteService';
import { fetchAllPages } from '@/services/api';
import { Member } from '@/types';
import { formatDate, toTitleCase } from '@/utils/format';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const RELATIONSHIP_LABELS: Record<string, string> = {
  head: 'Head',
  spouse: 'Spouse',
  son: 'Son',
  daughter: 'Daughter',
  father: 'Father',
  mother: 'Mother',
  other: 'Other',
};

const OCCUPATION_SECTOR_LABELS: Record<string, string> = {
  government: 'Government',
  private: 'Private',
  self_employed: 'Self employed',
  abroad: 'Abroad',
  unemployed: 'Unemployed',
  student: 'Student',
  homemaker: 'Homemaker',
  retired: 'Retired',
  none: 'None',
};

const INCOME_RANGE_LABELS: Record<string, string> = {
  none: 'No income',
  below_10k: 'Below 10,000',
  '10k_25k': '10,000 - 25,000',
  '25k_50k': '25,000 - 50,000',
  above_50k: 'Above 50,000',
};

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [member, setMember] = useState<Member | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [institutes, setInstitutes] = useState<any[]>([]);

  useEffect(() => {
    if (id) {
      fetchMember();
    }
    fetchAllPages((p) => instituteService.getAll(p))
      .then((all) => setInstitutes(all))
      .catch(() => setInstitutes([]));
  }, [id]);

  const fetchMember = async () => {
    try {
      setLoading(true);
      const data = await memberService.getById(id!);
      setMember(data);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'member'));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await memberService.delete(id);
      navigate(ROUTES.MEMBERS.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete member' }));
      setDeleting(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !member) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Member not found'}</p>
        <Button onClick={() => navigate(ROUTES.MEMBERS.LIST)} className="mt-4" variant="outline">
          Back to Members
        </Button>
      </div>
    );
  }

  const extra = member as Member & {
    occupation?: string;
    occupationSector?: string;
    monthlyIncomeRange?: string;
    skills?: string[] | string;
    volunteerSkills?: string[] | string;
    isJobSeeker?: boolean;
    isZakatPayer?: boolean;
    isZakatEligible?: boolean;
    isWidow?: boolean;
    isVolunteer?: boolean;
  };
  const listText = (value?: string[] | string) => (Array.isArray(value) ? value.join(', ') : value) || undefined;

  return (
    <div className="space-y-4">
      <PageHeader
        description="Member Details"
        title={toTitleCase(member.name)}
        breadcrumbs={[{ label: 'Members', path: ROUTES.MEMBERS.LIST }]}
        actions={
          <>
            <Link to={ROUTES.MEMBERS.EDIT(member.id)}>
              <Button variant="outline" icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
          </>
        }
      />

      {/* One compact record panel; empty fields are left out. */}
      <Card padding="none" className="divide-y divide-border">
        <DetailSection
          title="Personal"
          icon={RiUser3Line}
          items={[
            { label: 'Name', value: toTitleCase(member.name) },
            { label: 'Name (Malayalam)', value: member.nameMl, malayalam: true },
            {
              label: 'Family',
              value: member.familyId && (
                <Link to={ROUTES.FAMILIES.DETAIL(member.familyId)} className="text-primary hover:underline">
                  {toTitleCase(member.familyName)}
                </Link>
              ),
            },
            { label: 'Mahall ID', value: member.mahallId },
            { label: 'Family head', value: member.isFamilyHead ? 'Yes' : undefined },
            {
              label: 'Relationship to head',
              value:
                member.relationship &&
                (member.relationship === 'other'
                  ? member.relationshipOther || 'Other'
                  : RELATIONSHIP_LABELS[member.relationship] || member.relationship),
            },
            { label: 'Date of birth', value: member.dateOfBirth && formatDate(member.dateOfBirth) },
            { label: 'Age', value: member.age },
            { label: 'Gender', value: member.gender && toTitleCase(member.gender) },
            { label: 'Blood group', value: member.bloodGroup },
            { label: 'Marital status', value: member.maritalStatus && toTitleCase(member.maritalStatus) },
            { label: 'Number of marriages', value: typeof member.marriageCount === 'number' ? member.marriageCount : undefined },
            { label: 'Phone', value: member.phone },
            { label: 'Orphan', value: member.isOrphan ? 'Yes' : undefined },
            { label: 'Deceased', value: member.isDead ? 'Yes' : undefined },
            { label: 'Added on', value: formatDate(member.createdAt) },
          ]}
        />
        <DetailSection
          title="Health & education"
          icon={RiHeartPulseLine}
          items={[
            { label: 'Health status', value: member.healthStatus && toTitleCase(String(member.healthStatus).replace(/_/g, ' ')) },
            { label: 'Education', value: member.education },
            {
              label: 'Institute',
              value:
                member.educationInstitutionId &&
                toTitleCase(
                  institutes.find((inst) => (inst.id || inst._id) === member.educationInstitutionId)?.name ||
                    member.educationInstitutionId
                ),
            },
            { label: 'School or college', value: member.externalInstitution },
            { label: 'Health details', value: member.healthNotes, wide: true },
          ]}
        />
        <DetailSection
          title="Socio-economic"
          icon={RiBriefcaseLine}
          emptyText="No socio-economic details recorded."
          items={[
            { label: 'Occupation', value: extra.occupation },
            {
              label: 'Occupation sector',
              value: extra.occupationSector && (OCCUPATION_SECTOR_LABELS[extra.occupationSector] || extra.occupationSector),
            },
            {
              label: 'Monthly income',
              value: extra.monthlyIncomeRange && (INCOME_RANGE_LABELS[extra.monthlyIncomeRange] || extra.monthlyIncomeRange),
            },
            { label: 'Skills', value: listText(extra.skills), wide: true },
            { label: 'Volunteer skills', value: listText(extra.volunteerSkills), wide: true },
            {
              label: 'Flags',
              wide: true,
              value:
                [
                  extra.isJobSeeker && 'Job seeker',
                  extra.isZakatPayer && 'Zakat payer',
                  extra.isZakatEligible && 'Zakat eligible',
                  extra.isWidow && 'Widow',
                  extra.isVolunteer && 'Volunteer',
                ]
                  .filter(Boolean)
                  .join(', ') || undefined,
            },
          ]}
        />
      </Card>

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Member"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(member.name)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
