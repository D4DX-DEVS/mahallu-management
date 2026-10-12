import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { reportService } from '@/services/reportService';
import { pct } from '@/utils/statSeries';

interface WelfareReportData {
  welfare: {
    applications: {
      total: number;
      byStatus: Record<string, number>;
    };
    requested: number;
    approved: number;
    disbursed: number;
  };
  zakat: {
    beneficiaries: {
      total: number;
      verified: number;
    };
    distributions: {
      total: number;
      totalAmount: number;
    };
  };
  relief: {
    cases: {
      total: number;
      byStatus: Record<string, number>;
    };
  };
}

export default function WelfareReport() {
  const [data, setData] = useState<WelfareReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const response = await reportService.getWelfareReport();
      setData(response);
    } catch (error) {
      console.error('Failed to load welfare report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!data) return <Alert tone="danger">Failed to load report</Alert>;

  return (
    <div className="space-y-6">
      <PageHeader title="Welfare Report" description="Welfare applications, zakat distribution and emergency relief" />

      {/* Welfare Stats */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">Welfare Applications</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard variant="inline" title="Total Applications" value={data.welfare.applications.total} />
          <StatCard variant="inline" title="Requested" value={`₹${(data.welfare.requested || 0).toLocaleString()}`} />
          <StatCard variant="inline" title="Approved" value={`₹${(data.welfare.approved || 0).toLocaleString()}`} viz={(data.welfare.requested || 0) > 0 ? { type: 'bullet', percent: pct(data.welfare.approved || 0, data.welfare.requested), target: 100 } : undefined} summary={`Approved ₹${(data.welfare.approved || 0).toLocaleString()} of ₹${(data.welfare.requested || 0).toLocaleString()} requested`} />
          <StatCard variant="inline" title="Disbursed" value={`₹${(data.welfare.disbursed || 0).toLocaleString()}`} viz={(data.welfare.approved || 0) > 0 ? { type: 'ring', percent: pct(data.welfare.disbursed || 0, data.welfare.approved) } : undefined} summary={`Disbursed ₹${(data.welfare.disbursed || 0).toLocaleString()} of ₹${(data.welfare.approved || 0).toLocaleString()} approved`} />
        </div>

        <Card padding="lg">
          <h3 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Applications by Status</h3>
          <div className="space-y-3">
            {Object.entries(data.welfare.applications.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <StatusBadge status={status} />
                <span className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Zakat Stats */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">Zakat</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard variant="inline" title="Total Beneficiaries" value={data.zakat.beneficiaries.total} />
          <StatCard variant="inline" title="Verified" value={data.zakat.beneficiaries.verified} viz={data.zakat.beneficiaries.total > 0 ? { type: 'ring', percent: pct(data.zakat.beneficiaries.verified, data.zakat.beneficiaries.total) } : undefined} summary={`${data.zakat.beneficiaries.verified} of ${data.zakat.beneficiaries.total} beneficiaries verified`} />
          <StatCard variant="inline" title="Distributions" value={data.zakat.distributions.total} />
          <StatCard variant="inline" title="Total Distributed" value={`₹${(data.zakat.distributions.totalAmount || 0).toLocaleString()}`} />
        </div>
      </div>

      {/* Relief Stats */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">Emergency Relief</h2>
        <Card padding="lg">
          <h3 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Relief Cases by Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(data.relief.cases.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-[#F4F7F5] px-3.5 py-3 dark:bg-surface-raised">
                <div className="text-[12px] font-bold uppercase capitalize tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{status}</div>
                <div className="text-xl font-extrabold text-primary-700 dark:text-surface-text">{count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
