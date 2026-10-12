import { useState, useEffect } from 'react';
import { FiUsers, FiBook, FiPercent, FiFileText, FiGift } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import { reportService } from '@/services/reportService';
import { getFriendlyError } from '@/utils/apiMessages';

interface EducationData {
  studentsCount: number;
  activeClassesCount: number;
  attendancePercentThisMonth: number;
  examsCount: number;
  scholarships: {
    activeScholarships: number;
    totalAwardedAmount: number;
    totalAwards: number;
    awardsByStatus: Record<string, number>;
  };
  supportCases: {
    total: number;
    byType: Record<string, number>;
    byStatus: Record<string, number>;
  };
}

export default function EducationReport() {
  const [data, setData] = useState<EducationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetch = async () => {
      try {
        const response = await reportService.getEducationReport();
        setData(response);
      } catch (err: any) {
        setError(getFriendlyError(err, "Couldn't load report. Refresh the page or try again."));
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !data) {
    return <Alert tone="danger">{error || "Couldn't load report. Refresh the page or try again."}</Alert>;
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Education report" description="Students, attendance, scholarships and academic support" />

      {/* Main Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        <StatCard variant="inline" title="Active Students" value={data.studentsCount} icon={<FiUsers />} tone="green" />
        <StatCard variant="inline" title="Active Classes" value={data.activeClassesCount} icon={<FiBook />} tone="lime" />
        <StatCard variant="inline" viz={{ type: 'ring', percent: data.attendancePercentThisMonth }} summary={`Attendance this month ${data.attendancePercentThisMonth} percent`} title="Attendance %" value={`${data.attendancePercentThisMonth}%`} icon={<FiPercent />} tone="neutral" />
        <StatCard variant="inline" title="Exams" value={data.examsCount} icon={<FiFileText />} tone="green" />
      </div>

      {/* Scholarships Section */}
      <Card padding="lg">
        <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Scholarships & Awards</h2>
        <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">Schemes, awards and amounts disbursed</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard variant="inline" title="Active Scholarships" value={data.scholarships.activeScholarships} icon={<FiGift />} tone="green" />
          <StatCard variant="inline" title="Total Awards" value={data.scholarships.totalAwards} icon={<FiGift />} tone="lime" />
          <StatCard
            variant="inline"
            title="Awarded Amount"
            value={`₹${data.scholarships.totalAwardedAmount.toLocaleString()}`}
            icon={<FiFileText />}
            tone="neutral"
          />
          {/* Award Status Breakdown */}
          {data.scholarships.awardsByStatus && (
            <div className="col-span-2 sm:col-span-4">
              <div className="mt-1 grid grid-cols-1 gap-2 text-[13px] sm:grid-cols-3">
                {Object.entries(data.scholarships.awardsByStatus).map(([status, count]) => (
                  <div key={status} className="rounded-[10px] bg-[#F4F7F5] px-3 py-2 dark:bg-surface-raised">
                    <div className="text-[12px] font-bold uppercase capitalize tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{status}</div>
                    <div className="text-lg font-extrabold text-primary-700 dark:text-surface-text">{count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Support Cases Section */}
      <Card padding="lg">
        <h2 className="text-[13px] font-bold text-[#18231E] dark:text-surface-text">Academic Support Cases</h2>
        <p className="mb-3.5 mt-0.5 text-xs text-[#7B8983] dark:text-surface-muted">{data.supportCases.total} cases in total</p>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* By Type */}
          <div>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">By Type</h3>
            <div className="space-y-1.5">
              {Object.entries(data.supportCases.byType).map(([type, count]) => (
                <div key={type} className="flex items-center justify-between rounded-[10px] bg-[#F4F7F5] px-3 py-2 text-[13px] dark:bg-surface-raised">
                  <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                  <Badge variant="primary">{count}</Badge>
                </div>
              ))}
            </div>
          </div>

          {/* By Status */}
          <div>
            <h3 className="mb-2 text-[12px] font-bold uppercase tracking-[0.06em] text-[#7B8983] dark:text-surface-muted">By Status</h3>
            <div className="space-y-1.5">
              {Object.entries(data.supportCases.byStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between rounded-[10px] bg-[#F4F7F5] px-3 py-2 text-[13px] dark:bg-surface-raised">
                  <span className="capitalize">{status}</span>
                  <Badge variant="primary">{count}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
