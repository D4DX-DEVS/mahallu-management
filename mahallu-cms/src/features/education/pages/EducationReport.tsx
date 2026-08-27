import { useState, useEffect } from 'react';
import { FiUsers, FiBook, FiPercent, FiFileText, FiGift } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService } from '@/services/reportService';

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
        setError(err.response?.data?.message || 'Failed to fetch report');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <PageSkeleton variant="section" />
    );
  }

  if (error || !data) {
    return <div className="text-center py-8 text-red-600">{error || 'Failed to load report'}</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl sm:text-3xl font-bold">Education Report</h1>

      {/* Main Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <StatCard
          title="Active Students"
          value={data.studentsCount}
          icon={<FiUsers />}
        />
        <StatCard
          title="Active Classes"
          value={data.activeClassesCount}
          icon={<FiBook />}
        />
        <StatCard
          title="Attendance %"
          value={`${data.attendancePercentThisMonth}%`}
          icon={<FiPercent />}
        />
        <StatCard
          title="Exams"
          value={data.examsCount}
          icon={<FiFileText />}
        />
      </div>

      {/* Scholarships Section */}
      <Card>
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Scholarships & Awards</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard
              title="Active Scholarships"
              value={data.scholarships.activeScholarships}
              icon={<FiGift />}
            />
            <StatCard
              title="Total Awards"
              value={data.scholarships.totalAwards}
              icon={<FiGift />}
            />
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
                      <div className="text-lg font-bold">{count}</div>
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
        <div className="p-6">
          <h2 className="text-xl font-bold mb-4">Academic Support Cases</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* By Type */}
            <div>
              <h3 className="font-medium mb-3">By Type</h3>
              <div className="space-y-2">
                {Object.entries(data.supportCases.byType).map(([type, count]) => (
                  <div key={type} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="capitalize">{type.replace(/_/g, ' ')}</span>
                    <span className="font-bold">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* By Status */}
            <div>
              <h3 className="font-medium mb-3">By Status</h3>
              <div className="space-y-2">
                {Object.entries(data.supportCases.byStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded">
                    <span className="capitalize">{status}</span>
                    <span className="font-bold">{count}</span>
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
