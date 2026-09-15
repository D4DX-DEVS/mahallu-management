import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { ROUTES } from '@/constants/routes';
import { memberService } from '@/services/memberService';
import { instituteService } from '@/services/instituteService';
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
    instituteService
      .getAll()
      .then((res) => setInstitutes(res.data || []))
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

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            description="Member Details"
            title={toTitleCase(member.name)}
            breadcrumbs={[{ label: 'Members', path: ROUTES.MEMBERS.LIST }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.MEMBERS.EDIT(member.id)}>
              <Button variant="outline" icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Name</span>
              <p className="text-gray-900 dark:text-gray-100">{toTitleCase(member.name)}</p>
            </div>
            {member.nameMl && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Name (Malayalam)</span>
                <p className="text-gray-900 dark:text-gray-100 font-malayalam">{member.nameMl}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Family</span>
              <Link
                to={ROUTES.FAMILIES.DETAIL(member.familyId)}
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
              >
                {toTitleCase(member.familyName)}
              </Link>
            </div>
            {member.isFamilyHead && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Family Head</span>
                <p className="text-gray-900 dark:text-gray-100">Yes</p>
              </div>
            )}
            {member.relationship && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Relationship to Head</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {member.relationship === 'other'
                    ? member.relationshipOther || 'Other'
                    : RELATIONSHIP_LABELS[member.relationship] || member.relationship}
                </p>
              </div>
            )}
            {member.mahallId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Mahall ID</span>
                <p className="text-gray-900 dark:text-gray-100">{member.mahallId}</p>
              </div>
            )}
            {member.dateOfBirth && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Date of Birth</span>
                <p className="text-gray-900 dark:text-gray-100">{formatDate(member.dateOfBirth)}</p>
              </div>
            )}
            {member.age && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Age</span>
                <p className="text-gray-900 dark:text-gray-100">{member.age}</p>
              </div>
            )}
            {member.gender && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Gender</span>
                <p className="text-gray-900 dark:text-gray-100 capitalize">{member.gender}</p>
              </div>
            )}
            {member.bloodGroup && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Blood Group</span>
                <p className="text-gray-900 dark:text-gray-100">{member.bloodGroup}</p>
              </div>
            )}
            {member.maritalStatus && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Marital Status</span>
                <p className="text-gray-900 dark:text-gray-100 capitalize">{member.maritalStatus}</p>
              </div>
            )}
            {typeof member.marriageCount === 'number' && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Number of Marriages</span>
                <p className="text-gray-900 dark:text-gray-100">{member.marriageCount}</p>
              </div>
            )}
            {member.isOrphan && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Orphan</span>
                <p className="text-gray-900 dark:text-gray-100">Yes</p>
              </div>
            )}
            {member.isDead && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Deceased</span>
                <p className="text-gray-900 dark:text-gray-100">Yes</p>
              </div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">
            Additional Information
          </h2>
          <div className="space-y-3">
            {member.phone && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Phone</span>
                <p className="text-gray-900 dark:text-gray-100">{member.phone}</p>
              </div>
            )}
            {member.healthStatus && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Health Status</span>
                <p className="text-gray-900 dark:text-gray-100">{member.healthStatus}</p>
              </div>
            )}
            {member.healthNotes && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Health Details</span>
                <p className="text-gray-900 dark:text-gray-100">{member.healthNotes}</p>
              </div>
            )}
            {member.education && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Education</span>
                <p className="text-gray-900 dark:text-gray-100">{member.education}</p>
              </div>
            )}
            {member.educationInstitutionId && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Institute</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {toTitleCase(
                    institutes.find((inst) => (inst.id || inst._id) === member.educationInstitutionId)?.name ||
                      member.educationInstitutionId
                  )}
                </p>
              </div>
            )}
            {member.externalInstitution && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">School or College</span>
                <p className="text-gray-900 dark:text-gray-100">{member.externalInstitution}</p>
              </div>
            )}
            <div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Created At</span>
              <p className="text-gray-900 dark:text-gray-100">{formatDate(member.createdAt)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Socio-economic Details</h2>
          <div className="space-y-3">
            {(member as any).occupation && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Occupation</span>
                <p className="text-gray-900 dark:text-gray-100">{(member as any).occupation}</p>
              </div>
            )}
            {(member as any).occupationSector && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Occupation Sector</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {OCCUPATION_SECTOR_LABELS[(member as any).occupationSector] || (member as any).occupationSector}
                </p>
              </div>
            )}
            {(member as any).monthlyIncomeRange && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Monthly Income</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {INCOME_RANGE_LABELS[(member as any).monthlyIncomeRange] || (member as any).monthlyIncomeRange}
                </p>
              </div>
            )}
            {Boolean((member as any).skills?.length) && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Skills</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {Array.isArray((member as any).skills) ? (member as any).skills.join(', ') : (member as any).skills}
                </p>
              </div>
            )}
            {Boolean((member as any).volunteerSkills?.length) && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Volunteer Skills</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {Array.isArray((member as any).volunteerSkills)
                    ? (member as any).volunteerSkills.join(', ')
                    : (member as any).volunteerSkills}
                </p>
              </div>
            )}
            {((member as any).isJobSeeker ||
              (member as any).isZakatPayer ||
              (member as any).isZakatEligible ||
              (member as any).isWidow ||
              (member as any).isVolunteer) && (
              <div>
                <span className="text-sm text-gray-500 dark:text-gray-400">Flags</span>
                <p className="text-gray-900 dark:text-gray-100">
                  {[
                    (member as any).isJobSeeker && 'Job seeker',
                    (member as any).isZakatPayer && 'Zakat payer',
                    (member as any).isZakatEligible && 'Zakat eligible',
                    (member as any).isWidow && 'Widow',
                    (member as any).isVolunteer && 'Volunteer',
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              </div>
            )}
          </div>
        </Card>
      </div>

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
