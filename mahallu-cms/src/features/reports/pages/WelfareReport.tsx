import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { reportService } from '@/services/reportService';

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

  if (loading) return <div className="p-4">Loading...</div>;
  if (!data) return <div className="p-4">Failed to load report</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Welfare Report</h1>

      {/* Welfare Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Welfare Applications</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Applications</div>
            <div className="text-2xl font-bold">{data.welfare.applications.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Requested</div>
            <div className="text-2xl font-bold">₹{(data.welfare.requested || 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Approved</div>
            <div className="text-2xl font-bold">₹{(data.welfare.approved || 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Disbursed</div>
            <div className="text-2xl font-bold">₹{(data.welfare.disbursed || 0).toLocaleString()}</div>
          </Card>
        </div>

        <Card className="mt-4 p-4">
          <h3 className="font-semibold mb-4">Applications by Status</h3>
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
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Zakat</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Beneficiaries</div>
            <div className="text-2xl font-bold">{data.zakat.beneficiaries.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Verified</div>
            <div className="text-2xl font-bold">{data.zakat.beneficiaries.verified}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Distributions</div>
            <div className="text-2xl font-bold">{data.zakat.distributions.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Distributed</div>
            <div className="text-2xl font-bold">₹{(data.zakat.distributions.totalAmount || 0).toLocaleString()}</div>
          </Card>
        </div>
      </div>

      {/* Relief Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Emergency Relief</h2>
        <Card className="p-4">
          <h3 className="font-semibold mb-4">Relief Cases by Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(data.relief.cases.byStatus).map(([status, count]) => (
              <div key={status} className="p-3 bg-gray-50 rounded">
                <div className="text-sm capitalize text-gray-600">{status}</div>
                <div className="text-xl font-bold">{count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
