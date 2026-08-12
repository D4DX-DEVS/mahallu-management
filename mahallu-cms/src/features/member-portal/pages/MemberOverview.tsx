import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/ui/Card';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { memberPortalService, MemberOverviewResponse } from '@/services/memberPortalService';
import { ROUTES } from '@/constants/routes';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });

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
        setError(err.response?.data?.message || 'Failed to load member overview');
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
      <div className="flex flex-col items-center justify-center h-[calc(100vh-140px)] gap-4">
        <p className="text-red-600 dark:text-red-400">{error || 'Unable to load overview'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">My Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mahallu Users</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{overview.mahalluStatistics.users}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mahallu Families</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{overview.mahalluStatistics.families}</p>
        </Card>
        <Card>
          <p className="text-sm text-gray-500 dark:text-gray-400">Mahallu Members</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">{overview.mahalluStatistics.members}</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">My Details</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500 dark:text-gray-400">Name:</span> <span className="text-gray-900 dark:text-gray-100">{overview.member.name}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Phone:</span> <span className="text-gray-900 dark:text-gray-100">{overview.member.phone || '-'}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Member ID:</span> <span className="text-gray-900 dark:text-gray-100">{overview.varusankhyaDetails.memberMahallId || '-'}</span></p>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Family Details</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500 dark:text-gray-400">House Name:</span> <span className="text-gray-900 dark:text-gray-100">{overview.family.details?.houseName || '-'}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Family ID:</span> <span className="text-gray-900 dark:text-gray-100">{overview.varusankhyaDetails.familyMahallId || '-'}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Varisangya Grade:</span> <span className="text-gray-900 dark:text-gray-100">{overview.varusankhyaDetails.varisangyaGrade || '-'}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Contact:</span> <span className="text-gray-900 dark:text-gray-100">{overview.family.details?.contactNo || '-'}</span></p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Family Financial Summary</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500 dark:text-gray-400">Varisangya Total:</span> <span className="text-gray-900 dark:text-gray-100">{currency.format(overview.family.financialSummary.varisangyaTotal || 0)}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Varisangya Count:</span> <span className="text-gray-900 dark:text-gray-100">{overview.family.financialSummary.varisangyaCount}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Zakat Total:</span> <span className="text-gray-900 dark:text-gray-100">{currency.format(overview.family.financialSummary.zakatTotal || 0)}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Zakat Count:</span> <span className="text-gray-900 dark:text-gray-100">{overview.family.financialSummary.zakatCount}</span></p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800">
            <Link
              to={ROUTES.MEMBER.VARISANGYA}
              className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              View All Varisangya →
            </Link>
          </div>
        </Card>

        <Card>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-500 dark:text-gray-400">Latest Varisangya Receipt:</span> <span className="text-gray-900 dark:text-gray-100">{overview.varusankhyaDetails.latestVarisangyaReceiptNo || '-'}</span></p>
            <p><span className="text-gray-500 dark:text-gray-400">Latest Zakat Receipt:</span> <span className="text-gray-900 dark:text-gray-100">{overview.varusankhyaDetails.latestZakatReceiptNo || '-'}</span></p>
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Family Members</h2>
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
                <tr key={member.id} className="border-b border-gray-100 dark:border-gray-900 text-gray-900 dark:text-gray-100">
                  <td className="py-2 pr-3">{member.name}</td>
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
