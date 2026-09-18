import { useState, useEffect } from 'react';
import { FiUsers, FiBook, FiPercent, FiFileText, FiGift } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Alert from '@/components/ui/Alert';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService } from '@/services/reportService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await reportService.getEducationReport();
      setData(response);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'report'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader title="Education Report" />
        <Alert variant="error" title="Couldn't load report" action={{ label: 'Try again', onClick: fetchReport }}>
          {error || 'No report data'}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Education Report" />
      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        <StatCard title="Active Students" value={data.studentsCount} icon={<FiUsers />} />
        <StatCard title="Active Classes" value={data.activeClassesCount} icon={<FiBook />} />
        <StatCard title="Attendance %" value={`${data.attendancePercentThisMonth}%`} icon={<FiPercent />} />
        <StatCard title="Exams" value={data.examsCount} icon={<FiFileText />} />
      </div>

      {/* Scholarships Section */}
      <Card>
        <div>
          <h2 className="text-lg font-semibold mb-3">Scholarships & Awards</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              title="Active Scholarships"
              value={data.scholarships.activeScholarships}
              icon={<FiGift />}
            />
            <StatCard title="Total Awards" value={data.scholarships.totalAwards} icon={<FiGift />} />
            <StatCard
              title="Awarded Amount"
              value={`₹${data.scholarships.totalAwardedAmount.toLocaleString()}`}
              icon={<FiFileText />}
            />
            {/* Award Status Breakdown */}
            {data.scholarships.awardsByStatus && (
              <div className="col-span-2 sm:col-span-4">
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                  {Object.entries(data.scholarships.awardsByStatus).map(([status, count]) => (
                    <div key={status} className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                      <div className="font-medium capitalize">{status}</div>
                      <div className="text-lg font-semibold">{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Support Cases Section */}
      <Card>
        <div>
          <h2 className="text-lg font-semibold mb-3">Academic Support Cases</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* By Type */}
            <div>
              <h3 className="font-semibold mb-3">By Type</h3>
              <div className="space-y-2">
                {Object.entries(data.supportCases.byType).map(([type, count]) => (
                  <div
                    key={type}
                    className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Status */}
            <div>
              <h3 className="font-semibold mb-3">By Status</h3>
              <div className="space-y-2">
                {Object.entries(data.supportCases.byStatus).map(([status, count]) => (
                  <div
                    key={status}
                    className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded"
                  >
                    <span className="capitalize">{status}</span>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
