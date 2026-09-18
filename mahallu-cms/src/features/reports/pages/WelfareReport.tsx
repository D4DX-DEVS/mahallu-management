import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Alert from '@/components/ui/Alert';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService } from '@/services/reportService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await reportService.getWelfareReport();
      setData(response);
    } catch (err) {
      setError(loadErrorMessage(err, 'report'));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <PageSkeleton variant="section" />;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Welfare Report" />
        <Alert variant="error" title="Couldn't load report" action={{ label: 'Try again', onClick: loadReport }}>
          {error || 'No report data'}
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Welfare Report" />
      {/* Welfare Stats */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Welfare Applications</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Applications" value={data.welfare.applications.total} />
          <StatCard title="Requested" value={<>₹{(data.welfare.requested || 0).toLocaleString()}</>} />
          <StatCard title="Approved" value={<>₹{(data.welfare.approved || 0).toLocaleString()}</>} />
          <StatCard title="Disbursed" value={<>₹{(data.welfare.disbursed || 0).toLocaleString()}</>} />
        </div>

        <Card className="mt-4">
          <h3 className="font-semibold mb-3">Applications by Status</h3>
          <div className="space-y-3">
            {Object.entries(data.welfare.applications.byStatus).map(([status, count]) => (
              <div key={status} className="flex justify-between items-center">
                <span className="capitalize">{status}</span>
                <span className="font-semibold">{count}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Zakat Stats */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Zakat</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard title="Total Beneficiaries" value={data.zakat.beneficiaries.total} />
          <StatCard title="Verified" value={data.zakat.beneficiaries.verified} />
          <StatCard title="Distributions" value={data.zakat.distributions.total} />
          <StatCard
            title="Total Distributed"
            value={<>₹{(data.zakat.distributions.totalAmount || 0).toLocaleString()}</>}
          />
        </div>
      </div>

      {/* Relief Stats */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Emergency Relief</h2>
        <Card>
          <h3 className="font-semibold mb-3">Relief Cases by Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(data.relief.cases.byStatus).map(([status, count]) => (
              <StatCard key={status} title={status} value={count} className="capitalize" />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
