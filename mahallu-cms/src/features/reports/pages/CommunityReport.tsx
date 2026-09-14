import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import { reportService } from '@/services/reportService';
import PageHeader from '@/components/layout/PageHeader';

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
      console.error("Couldn't load community report:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (!data) return <div className="p-4">Couldn't load report</div>;

  return (
    <div>
      <PageHeader title="Community Report" />
      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <StatCard title="Programs" value={data.programs.total} />
        <StatCard title="Volunteers" value={data.volunteers.total} />
        <StatCard title="Development Projects" value={data.projects.total} />
        <StatCard title="Announcements Sent" value={data.announcements.sent} />
      </div>

      {/* Volunteers */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Volunteers</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(data.volunteers.byWing).map(([wing, count]) => (
            <StatCard key={wing} title={wing} value={count} className="capitalize" />
          ))}
        </div>
      </div>

      {/* Projects */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-3">Development Projects</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard title="Total Projects" value={data.projects.total} />
          <StatCard
            title="Est. Total Cost"
            value={<>₹{(data.projects.totalEstimatedCost || 0).toLocaleString()}</>}
          />
          <StatCard title="Avg. Progress" value={<>{data.projects.averageProgress}%</>} />
        </div>

        <Card>
          <h3 className="font-semibold mb-3">Projects by Status</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {Object.entries(data.projects.byStatus).map(([status, count]) => (
              <StatCard
                key={status}
                title={status.replace('_', ' ')}
                value={count}
                className="capitalize"
              />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
