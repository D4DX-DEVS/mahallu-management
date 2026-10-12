import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FiDollarSign, FiArrowRight } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import { collectibleService } from '@/services/collectibleService';
import { ROUTES } from '@/constants/routes';

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
      
      // Server-side totals (approved records only) instead of summing a single paged row
      const summary = await collectibleService.getCollectionsSummary();
      setStats({
        varisangya: { total: summary.varisangya.count, amount: summary.varisangya.amount },
        zakat: { total: summary.zakat.count, amount: summary.zakat.amount },
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
      <PageHeader title="Collections" description="Overview of all collectible types" />

      {/* Summary Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard variant="inline" title="Total Payments" value={totalPayments} viz={totalPayments > 0 ? { type: 'pair', a: stats.varisangya.total, b: stats.zakat.total, colorB: '#E0B400' } : undefined} summary={`${stats.varisangya.total} varisangya payments compared with ${stats.zakat.total} zakat payments`} icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
        <StatCard variant="inline" tone="lime" title="Total Amount" value={`₹${totalAmount.toLocaleString()}`} viz={totalAmount > 0 ? { type: 'segments', segments: [{ value: stats.varisangya.amount }, { value: stats.zakat.amount, color: '#E0B400' }] } : undefined} summary={`Total ₹${totalAmount.toLocaleString()}: varisangya ₹${stats.varisangya.amount.toLocaleString()}, zakat ₹${stats.zakat.amount.toLocaleString()}`} icon={<FiDollarSign className="h-[17px] w-[17px]" />} />
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-12">
          <LoadingSpinner />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {collectibleTypes.map((type) => (
            <Card key={type.id} hoverEffect>
              <div className="mb-4 flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint text-primary-700 dark:bg-brand-lime/15 dark:text-brand-lime">
                  <FiDollarSign className="h-[17px] w-[17px]" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#18231E] dark:text-surface-text">{type.title}</h3>
                  <p className="text-xs text-[#7B8983] dark:text-surface-muted">{type.description}</p>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-[#7B8983] dark:text-surface-muted">Total Payments</p>
                  <p className="text-lg font-extrabold text-[#18231E] dark:text-surface-text">{type.stats.total}</p>
                </div>
                <div>
                  <p className="mb-1 text-[12px] font-bold uppercase tracking-wider text-[#7B8983] dark:text-surface-muted">Total Amount</p>
                  <p className="text-lg font-extrabold text-[#18231E] dark:text-surface-text">
                    ₹{type.stats.amount.toLocaleString()}
                  </p>
                </div>
              </div>

              <Link
                to={type.path}
                className="flex w-full items-center justify-center rounded-[10px] px-4 py-2 max-sm:min-h-10 text-xs font-bold text-primary-700 transition-colors hover:bg-mint focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-lime/[.28] dark:text-brand-lime dark:hover:bg-brand-lime/10"
              >
                View Details
                <FiArrowRight className="ml-2 h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
