import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import { reportService } from '@/services/reportService';

interface CommunityReportData {
  programs: {
    total: number;
  };
  volunteers: {
    total: number;
    byWing: Record<string, number>;
  };
  projects: {
    total: number;
    byStatus: Record<string, number>;
    totalEstimatedCost: number;
    averageProgress: number;
  };
  announcements: {
    sent: number;
  };
}

export default function CommunityReport() {
  const [data, setData] = useState<CommunityReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadReport();
  }, []);

  const loadReport = async () => {
    try {
      const response = await reportService.getCommunityReport();
      setData(response);
    } catch (error) {
      console.error('Failed to load community report:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!data) return <div className="p-4">Failed to load report</div>;

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-6">Community Report</h1>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        <Card className="p-4">
          <div className="text-sm text-gray-600">Programs</div>
          <div className="text-2xl font-bold">{data.programs.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Volunteers</div>
          <div className="text-2xl font-bold">{data.volunteers.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Development Projects</div>
          <div className="text-2xl font-bold">{data.projects.total}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-600">Announcements Sent</div>
          <div className="text-2xl font-bold">{data.announcements.sent}</div>
        </Card>
      </div>

      {/* Volunteers */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Volunteers</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Object.entries(data.volunteers.byWing).map(([wing, count]) => (
            <Card key={wing} className="p-4">
              <div className="text-sm capitalize text-gray-600">{wing}</div>
              <div className="text-2xl font-bold">{count}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Development Projects</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-4">
          <Card className="p-4">
            <div className="text-sm text-gray-600">Total Projects</div>
            <div className="text-2xl font-bold">{data.projects.total}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Est. Total Cost</div>
            <div className="text-2xl font-bold">₹{(data.projects.totalEstimatedCost || 0).toLocaleString()}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-600">Avg. Progress</div>
            <div className="text-2xl font-bold">{data.projects.averageProgress}%</div>
          </Card>
        </div>

        <Card className="p-4">
          <h3 className="font-semibold mb-4">Projects by Status</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(data.projects.byStatus).map(([status, count]) => (
              <div key={status} className="p-3 bg-gray-50 rounded">
                <div className="text-sm capitalize text-gray-600">{status.replace('_', ' ')}</div>
                <div className="text-xl font-bold">{count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
