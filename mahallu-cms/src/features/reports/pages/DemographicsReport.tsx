import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Card from '@/components/ui/Card';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { demographicsReportService, DemographicsReport as ReportData } from '@/services/reportService';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const Section = ({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) => {
  // A report that comes back without one of its sections is a report with an
  // empty section, not a broken page.
  const rows = Array.isArray(data) ? data : [];
  return (
  <Card>
    <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
    {rows.length === 0 ? (
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No data</p>
    ) : (
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10 }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={50}
            />
            <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    )}
  </Card>
  );
};

export default function DemographicsReport() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    demographicsReportService
      .get()
      .then(setReport)
      .catch((err) => setError(loadErrorMessage(err, 'report')))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <PageSkeleton variant="section" />;
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
      <PageHeader
        title="Demographics Report"
        description="Age, education, employment and welfare breakdown"
        breadcrumbs={[{ label: 'Reports' }]}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((item) => (
          <Card key={item.label}>
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
