import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Card from '@/components/ui/Card';
import Alert from '@/components/ui/Alert';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { demographicsReportService, DemographicsReport as ReportData } from '@/services/reportService';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

const Section = ({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) => {
  // A report that comes back without one of its sections is a report with an
  // empty section, not a broken page.
  const rows = Array.isArray(data) ? data : [];
  return (
  <Card padding="sm">
    <h2 className="text-label font-semibold text-foreground">{title}</h2>
    {rows.length === 0 ? (
      <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">No data</p>
    ) : (
      <div className="mt-1.5 h-40 w-full sm:h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 4, right: 4, left: -24, bottom: 0 }} barCategoryGap="30%">
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={36}
            />
            <YAxis
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={28}
            />
            <Tooltip
              cursor={{ fill: 'hsl(var(--accent))' }}
              contentStyle={{
                fontSize: '0.75rem',
                borderRadius: '0.375rem',
                border: '1px solid hsl(var(--border))',
                backgroundColor: 'hsl(var(--popover))',
              }}
            />
            <Bar dataKey="count" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} maxBarSize={28} />
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
  const [error, setError] = useState<LoadErrorInfo | null>(null);

  const loadReport = () => {
    setLoading(true);
    setError(null);
    demographicsReportService
      .get()
      .then(setReport)
      .catch((err) => setError(loadErrorInfo(err, 'report')))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadReport();
  }, []);

  if (loading) {
    return <PageSkeleton variant="section" />;
  }

  if (error || !report) {
    return (
      <div className="space-y-4">
        <PageHeader title="Demographics Report" breadcrumbs={[{ label: 'Reports' }]} />
        <Alert
          variant={error?.variant ?? 'error'}
          title={error?.title ?? "Couldn't load report"}
          action={error?.variant === 'info' ? undefined : { label: 'Try again', onClick: loadReport }}
        >
          {error?.message ?? 'No report data'}
        </Alert>
      </div>
    );
  }

  const ageGroups = Array.isArray(report.ageGroups) ? report.ageGroups : [];
  const education = Array.isArray(report.education) ? report.education : [];
  const employment = Array.isArray(report.employment) ? report.employment : [];
  const welfare = Array.isArray(report.welfare) ? report.welfare : [];
  const gender = report.gender ?? { male: 0, female: 0 };

  const totals = [
    { label: 'Men', value: gender.male ?? 0 },
    { label: 'Women', value: gender.female ?? 0 },
    { label: 'Total', value: (gender.male ?? 0) + (gender.female ?? 0) },
    {
      label: 'Age 60+',
      value: ageGroups.find((group) => group.label === '60+')?.count ?? 0,
    },
  ];

  return (
    <div className="space-y-3">
      <PageHeader
        title="Demographics Report"
        description="Age, education, employment and welfare breakdown"
        breadcrumbs={[{ label: 'Reports' }]}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {totals.map((item) => (
          <Card key={item.label}>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 sm:text-sm">{item.label}</p>
            <p className="mt-1 text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-xl">
              {item.value}
            </p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        <Section title="Age Groups" data={ageGroups} />
        <Section title="Employment" data={employment} />
        <Section title="Education" data={education} />
        <Section title="Welfare Status" data={welfare} />
      </div>
    </div>
  );
}
