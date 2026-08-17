import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { demographicsReportService, DemographicsReport as ReportData } from '@/services/reportService';

const Section = ({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) => (
  <Card className="p-3 sm:p-4">
    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    {data.length === 0 ? (
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No data</p>
    ) : (
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </Card>
);

export default function DemographicsReport() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demographicsReportService
      .get()
      .then(setReport)
      .catch((err) => setError(err.response?.data?.message || 'Failed to load report'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <PageSkeleton variant="section" />
    );
  }

  if (error || !report) {
    return (
      <Card>
        <p className="text-red-600 dark:text-red-400">{error || 'No report data'}</p>
      </Card>
    );
  }

  const totals = [
    { label: 'Men', value: report.gender.male },
    { label: 'Women', value: report.gender.female },
    { label: 'Total', value: report.gender.male + report.gender.female },
    {
      label: 'Age 60+',
      value: report.ageGroups.find((group) => group.label === '60+')?.count ?? 0,
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">Demographics Report</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Age, education, employment and welfare breakdown
          </p>
        </div>
        <Breadcrumb
          items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Reports' }, { label: 'Demographics' }]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {totals.map((item) => (
          <Card key={item.label} className="p-3 sm:p-4">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{item.label}</p>
            <p className="mt-1 text-base font-bold text-gray-900 dark:text-gray-100 sm:text-xl">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Age Groups" data={report.ageGroups} />
        <Section title="Employment" data={report.employment} />
        <Section title="Education" data={report.education} />
        <Section title="Welfare Status" data={report.welfare} />
      </div>
    </div>
  );
}
