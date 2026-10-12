import { useEffect, useState } from 'react';
import { formatINR } from '@/utils/formatINR';
import { Link } from 'react-router-dom';
import { FiUsers, FiHome, FiUser, FiAward } from 'react-icons/fi';
import { gradeLevel } from '@/utils/statSeries';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import GenderChip from '@/components/ui/GenderChip';
import PageHeader from '@/components/ui/PageHeader';
import Table from '@/components/ui/Table';
import Alert from '@/components/ui/Alert';
import { TableColumn } from '@/types';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { memberPortalService, MemberOverviewResponse } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import { getFriendlyError } from '@/utils/apiMessages';

type FamilyMember = MemberOverviewResponse['family']['members'][number];

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <p className="flex items-baseline justify-between gap-3">
      <span className="text-[#7B8983] dark:text-surface-muted">{label}</span>
      <span className="text-right font-semibold text-[#18231E] dark:text-surface-text">{value}</span>
    </p>
  );
}

const CARD_TITLE = 'mb-3 text-sm font-bold text-[#18231E] dark:text-surface-text';


export default function MemberOverview() {
  const [overview, setOverview] = useState<MemberOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOverview = async () => {
      try {
        setLoading(true);
        const data = await memberPortalService.getOverview();
        setOverview(data);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load member overview. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[calc(100vh-140px)]">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !overview) {
    return (
      <div className="py-6">
        <Alert tone="danger">{error || 'Unable to load overview'}</Alert>
      </div>
    );
  }

  const famMale = overview.family.members.filter((m) => m.gender === 'male').length;
  const famFemale = overview.family.members.filter((m) => m.gender === 'female').length;
  const memberColumns: TableColumn<FamilyMember>[] = [
    { key: 'name', label: 'Name', render: (v, row) => <PersonCell name={v} src={row.photoUrl} /> },
    { key: 'phone', label: 'Phone', render: (v) => v || '-' },
    { key: 'gender', label: 'Gender', render: (v) => <GenderChip value={v} /> },
    { key: 'mahallId', label: 'Member ID', render: (v) => v || '-' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        leading={<Avatar name={overview.member.name} src={overview.member.photoUrl} size={56} badge={overview.member.bloodGroup ? <BloodGroupBadge value={overview.member.bloodGroup} size="xs" /> : undefined} />}
        title="My dashboard"
        description={`Welcome back, ${overview.member.name}. Your membership, family and payment summary`}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <StatCard variant="inline" title="Mahallu Users" value={overview.mahalluStatistics.users} icon={<FiUser className="h-[17px] w-[17px]" />} tone="green" />
        <StatCard variant="inline" title="Mahallu Families" value={overview.mahalluStatistics.families} icon={<FiHome className="h-[17px] w-[17px]" />} tone="lime" />
        <StatCard variant="inline" title="Mahallu Members" value={overview.mahalluStatistics.members} icon={<FiUsers className="h-[17px] w-[17px]" />} tone="neutral" />
        <StatCard
          variant="inline"
          title="My family members"
          value={overview.family.members.length}
          icon={<FiUsers className="h-[17px] w-[17px]" />}
          tone="lime"
          viz={famMale + famFemale > 0 ? { type: 'segments', segments: [{ value: famMale }, { value: famFemale, color: '#8EC13E' }] } : undefined}
          summary={`${overview.family.members.length} family members: ${famMale} male, ${famFemale} female`}
        />
        {overview.family.details?.varisangyaGrade && (
          <StatCard
            variant="inline"
            title="Varisangya grade"
            value={overview.family.details.varisangyaGrade}
            icon={<FiAward className="h-[17px] w-[17px]" />}
            tone="gold"
            viz={gradeLevel(overview.family.details.varisangyaGrade) ? { type: 'meter', level: gradeLevel(overview.family.details.varisangyaGrade) } : undefined}
            summary={`Varisangya grade ${overview.family.details.varisangyaGrade}`}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <h2 className={CARD_TITLE}>My Details</h2>
          <div className="space-y-2 text-[13px]">
            <DetailRow label="Name" value={overview.member.name} />
            <DetailRow label="Phone" value={overview.member.phone || '-'} />
            <DetailRow label="Member ID" value={overview.varusankhyaDetails.memberMahallId || '-'} />
          </div>
        </Card>

        <Card padding="lg">
          <h2 className={CARD_TITLE}>Family Details</h2>
          <div className="space-y-2 text-[13px]">
            <DetailRow label="House Name" value={overview.family.details?.houseName || '-'} />
            <DetailRow label="Family ID" value={overview.varusankhyaDetails.familyMahallId || '-'} />
            <DetailRow label="Varisangya Grade" value={overview.varusankhyaDetails.varisangyaGrade || '-'} />
            <DetailRow label="Contact" value={overview.family.details?.contactNo || '-'} />
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <h2 className={CARD_TITLE}>Family Financial Summary</h2>
          <div className="space-y-2 text-[13px]">
            <DetailRow label="Varisangya Total" value={formatINR(overview.family.financialSummary.varisangyaTotal || 0)} />
            <DetailRow label="Varisangya Count" value={overview.family.financialSummary.varisangyaCount} />
            <DetailRow label="Zakat Total" value={formatINR(overview.family.financialSummary.zakatTotal || 0)} />
            <DetailRow label="Zakat Count" value={overview.family.financialSummary.zakatCount} />
          </div>
          <div className="mt-4 border-t border-line-soft pt-3 dark:border-surface-border">
            <Link
              to={ROUTES.MEMBER.VARISANGYA}
              className="text-[13px] font-semibold text-primary-600 hover:text-primary-700 dark:text-brand-lime dark:hover:text-brand-lime/80"
            >
              View All Varisangya →
            </Link>
          </div>
        </Card>

        <Card padding="lg">
          <h2 className={CARD_TITLE}>Latest Receipts</h2>
          <div className="space-y-2 text-[13px]">
            <DetailRow label="Latest Varisangya Receipt" value={overview.varusankhyaDetails.latestVarisangyaReceiptNo || '-'} />
            <DetailRow label="Latest Zakat Receipt" value={overview.varusankhyaDetails.latestZakatReceiptNo || '-'} />
          </div>
        </Card>
      </div>

      <Card padding="none">
        <div className="px-4 pt-4">
          <h2 className="text-sm font-bold text-[#18231E] dark:text-surface-text">Family Members</h2>
        </div>
        <div className="p-3.5">
          <Table columns={memberColumns} data={overview.family.members} showExport={false} emptyMessage="No family members" />
        </div>
      </Card>
    </div>
  );
}
