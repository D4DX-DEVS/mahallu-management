import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import { FiHeart, FiAlertCircle, FiClipboard, FiFileText, FiUser, FiUsers } from 'react-icons/fi';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { memberPortalService, MemberOverviewResponse } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

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
        setError(loadErrorMessage(err, 'member overview'));
      } finally {
        setLoading(false);
      }
    };

    fetchOverview();
  }, []);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !overview) {
    return (
      <div className="flex flex-col items-center justify-center h-screen-content gap-4">
        <p className="text-red-600 dark:text-red-400">{error || 'Unable to load overview'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="My Dashboard" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard title="Mahallu Users" value={overview.mahalluStatistics.users} />
        <StatCard title="Mahallu Families" value={overview.mahalluStatistics.families} />
        <StatCard title="Mahallu Members" value={overview.mahalluStatistics.members} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        <Link to={ROUTES.MEMBER.PROFILE}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                My Details
              </h2>
              <span className="text-primary-600 dark:text-primary-400 text-sm">→</span>
            </div>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-500 dark:text-gray-400">Name:</span>
                <span className="text-gray-900 dark:text-gray-100">{toTitleCase(overview.member.name)}</span>
              </p>
              {overview.member.phone && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Phone:</span>
                  <span className="text-gray-900 dark:text-gray-100">{overview.member.phone}</span>
                </p>
              )}
              {overview.varusankhyaDetails.memberMahallId && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Member ID:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {overview.varusankhyaDetails.memberMahallId}
                  </span>
                </p>
              )}
            </div>
          </Card>
        </Link>

        <Link to={ROUTES.MEMBER.FAMILY}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base sm:text-lg font-semibold text-foreground">
                Family Details
              </h2>
              <span className="text-primary-600 dark:text-primary-400 text-sm">→</span>
            </div>
            <div className="space-y-2 text-sm">
              {overview.family.details?.houseName && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">House Name:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {toTitleCase(overview.family.details.houseName)}
                  </span>
                </p>
              )}
              {overview.varusankhyaDetails.familyMahallId && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Family ID:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {overview.varusankhyaDetails.familyMahallId}
                  </span>
                </p>
              )}
              {overview.varusankhyaDetails.varisangyaGrade && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Varisangya Grade:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {overview.varusankhyaDetails.varisangyaGrade}
                  </span>
                </p>
              )}
              {overview.family.details?.contactNo && (
                <p>
                  <span className="text-gray-500 dark:text-gray-400">Contact:</span>
                  <span className="text-gray-900 dark:text-gray-100">
                    {overview.family.details.contactNo}
                  </span>
                </p>
              )}
            </div>
          </Card>
        </Link>
      </div>

      <Link to={ROUTES.MEMBER.VARISANGYA} className="block">
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold text-foreground">
              Family Financial Summary
            </h2>
            <span className="text-primary-600 dark:text-primary-400 text-sm">→</span>
          </div>
          <div className="grid grid-cols-1 gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
            <p>
              <span className="text-gray-500 dark:text-gray-400">Varisangya Total:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {currency.format(overview.family.financialSummary.varisangyaTotal || 0)}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Varisangya Count:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {overview.family.financialSummary.varisangyaCount}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Zakat Total:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {currency.format(overview.family.financialSummary.zakatTotal || 0)}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Zakat Count:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {overview.family.financialSummary.zakatCount}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Latest Varisangya Receipt:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {overview.varusankhyaDetails.latestVarisangyaReceiptNo || '-'}
              </span>
            </p>
            <p>
              <span className="text-gray-500 dark:text-gray-400">Latest Zakat Receipt:</span>
              <span className="text-gray-900 dark:text-gray-100">
                {overview.varusankhyaDetails.latestZakatReceiptNo || '-'}
              </span>
            </p>
          </div>
        </Card>
      </Link>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
        <Link to={ROUTES.MEMBER.NIKAH_REQUEST}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <FiHeart className="h-5 w-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Nikah Registration
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Register a marriage</p>
          </Card>
        </Link>

        <Link to={ROUTES.MEMBER.DEATH_REQUEST}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <FiAlertCircle className="h-5 w-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Report Death
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Report a death in family</p>
          </Card>
        </Link>

        <Link to={ROUTES.MEMBER.REQUESTS}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <FiClipboard className="h-5 w-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              My Requests
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">View all registrations</p>
          </Card>
        </Link>

        <Link to={ROUTES.MEMBER.CERTIFICATES}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <FiFileText className="h-5 w-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              Certificates
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Approved certificates</p>
          </Card>
        </Link>

        <Link to={ROUTES.MEMBER.PROFILE}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <FiUser className="h-5 w-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">
              My Profile
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Edit your details</p>
          </Card>
        </Link>

        <Link to={ROUTES.MEMBER.FAMILY}>
          <Card className="h-full cursor-pointer hover:shadow-md transition-shadow">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/10 dark:text-primary-300">
              <FiUsers className="h-5 w-5" />
            </div>
            <h3 className="text-sm sm:text-base font-semibold text-foreground">My Family</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Family details</p>
          </Card>
        </Link>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-3 text-foreground">Family Members</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Phone</th>
                <th className="py-2 pr-3">Gender</th>
                <th className="py-2 pr-3">Member ID</th>
              </tr>
            </thead>
            <tbody>
              {overview.family.members.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <td className="py-2 pr-3">{toTitleCase(member.name)}</td>
                  <td className="py-2 pr-3">{member.phone || '-'}</td>
                  <td className="py-2 pr-3">{member.gender || '-'}</td>
                  <td className="py-2 pr-3">{member.mahallId || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
