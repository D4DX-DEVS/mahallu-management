import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiArrowRight } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { collectibleService } from '@/services/collectibleService';
import { ROUTES } from '@/constants/routes';
import PageHeader from '@/components/layout/PageHeader';

export default function CollectionsOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    varisangya: { total: 0, amount: 0 },
    zakat: { total: 0, amount: 0 },
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);

      // Fetch varisangya stats
      const varisangyaResult = await collectibleService.getAllVarisangyas({ page: 1, limit: 1 });
      const varisangyaTotal = varisangyaResult.pagination?.total || 0;
      const varisangyaAmount = varisangyaResult.data.reduce((sum, v) => sum + (v.amount || 0), 0);

      // Fetch zakat stats
      const zakatResult = await collectibleService.getAllZakats({ page: 1, limit: 1 });
      const zakatTotal = zakatResult.pagination?.total || 0;
      const zakatAmount = zakatResult.data.reduce((sum, z) => sum + (z.amount || 0), 0);

      setStats({
        varisangya: { total: varisangyaTotal, amount: varisangyaAmount },
        zakat: { total: zakatTotal, amount: zakatAmount },
      });
    } catch (err) {
      console.error('Error fetching collections stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const collectibleTypes = [
    {
      id: 'varisangya',
      title: 'Varisangyas',
      description: 'Manage varisangya payments',
      path: ROUTES.COLLECTIBLES.VARISANGYA,
      stats: {
        total: stats.varisangya.total,
        amount: stats.varisangya.amount,
      },
    },
    {
      id: 'zakat',
      title: 'Zakat',
      description: 'Manage zakat payments',
      path: ROUTES.COLLECTIBLES.ZAKAT,
      stats: {
        total: stats.zakat.total,
        amount: stats.zakat.amount,
      },
    },
  ];

  const totalAmount = stats.varisangya.amount + stats.zakat.amount;
  const totalPayments = stats.varisangya.total + stats.zakat.total;

  return (
    <div className="space-y-4">
      <PageHeader description="Overview of all collectible types" title="Collections" />

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
        <StatCard title="Total Payments" value={totalPayments} />
        <StatCard title="Total Amount" value={`₹${totalAmount.toLocaleString()}`} />
      </div>

      {loading ? (
        <PageSkeleton variant="section" />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {collectibleTypes.map((type) => (
            <Card key={type.id} className="hover:shadow-lg transition-shadow">
              <div>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <FiDollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground">{type.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{type.description}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Payments</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      {type.stats.total}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Amount</p>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      ₹{type.stats.amount.toLocaleString()}
                    </p>
                  </div>
                </div>

                <Link
                  to={type.path}
                  className="flex items-center justify-center w-full px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                >
                  View Details
                  <FiArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
