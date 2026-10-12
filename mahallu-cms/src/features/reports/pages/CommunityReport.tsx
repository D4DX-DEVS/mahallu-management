import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
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

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!data) return <Alert tone="danger">Failed to load report</Alert>;

  return (
    <div className="space-y-4">
      <PageHeader title="Community Report" description="Programs, volunteers and development projects" />

      {/* Main Stats */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard variant="inline" title="Programs" value={data.programs.total} tone="green" />
        <StatCard variant="inline" title="Volunteers" value={data.volunteers.total} tone="lime" />
        <StatCard variant="inline" title="Development Projects" value={data.projects.total} tone="green" />
        <StatCard variant="inline" title="Announcements Sent" value={data.announcements.sent} tone="neutral" />
      </div>

      {/* Volunteers */}
      <Card padding="lg">
        <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Volunteers</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Object.entries(data.volunteers.byWing).map(([wing, count]) => (
            <div key={wing} className="rounded-xl bg-[#F4F7F5] px-3.5 py-3 dark:bg-surface-raised">
              <div className="text-[12px] font-bold uppercase capitalize tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{wing}</div>
              <div className="text-xl font-extrabold text-primary-700 dark:text-surface-text">{count}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Projects */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">Development Projects</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard variant="inline" title="Total Projects" value={data.projects.total} tone="green" />
          <StatCard variant="inline" title="Est. Total Cost" value={`₹${(data.projects.totalEstimatedCost || 0).toLocaleString()}`} tone="gold" />
          <StatCard variant="inline" title="Avg. Progress" value={`${data.projects.averageProgress}%`} viz={{ type: 'ring', percent: data.projects.averageProgress }} summary={`Average project progress ${data.projects.averageProgress} percent`} tone="lime" />
        </div>

        <Card padding="lg">
          <h3 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Projects by status</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {Object.entries(data.projects.byStatus).map(([status, count]) => (
              <div key={status} className="rounded-xl bg-[#F4F7F5] px-3.5 py-3 dark:bg-surface-raised">
                <div className="text-[12px] font-bold uppercase capitalize tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{status.replace('_', ' ')}</div>
                <div className="text-xl font-extrabold text-primary-700 dark:text-surface-text">{count}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
