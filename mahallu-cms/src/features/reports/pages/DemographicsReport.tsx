import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { demographicsReportService, DemographicsReport as ReportData } from '@/services/reportService';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';

const Section = ({ title, data }: { title: string; data: Array<{ label: string; count: number }> }) => (
  <Card padding="lg">
    <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">{title}</h2>
    {data.length === 0 ? (
      <p className="mt-2 text-[13px] text-[#7B8983] dark:text-surface-muted">No data</p>
    ) : (
      <div className="mt-2 h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} interval="preserveStartEnd" minTickGap={8} angle={-20} textAnchor="end" height={64} />
            <YAxis tick={{ fontSize: 12 }} width={44} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="count" fill="#04563A" radius={[4, 4, 0, 0]} />
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
      .catch((err) => setError(getFriendlyError(err, "Couldn't load report. Refresh the page or try again.")))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !report) {
    return (
      <Alert tone="danger">{error || 'No report data'}</Alert>
    );
  }

  const all = report.gender.male + report.gender.female;
  const seniors = report.ageGroups.find((group) => group.label === '60+')?.count ?? 0;
  const totals = [
    { label: 'Men', value: report.gender.male, viz: all > 0 ? { type: 'ring' as const, percent: pct(report.gender.male, all) } : undefined, summary: `Men ${report.gender.male} of ${all}, ${pct(report.gender.male, all)} percent` },
    { label: 'Women', value: report.gender.female, viz: all > 0 ? { type: 'ring' as const, percent: pct(report.gender.female, all), color: '#8EC13E' } : undefined, summary: `Women ${report.gender.female} of ${all}, ${pct(report.gender.female, all)} percent` },
    { label: 'Total', value: all, viz: all > 0 ? { type: 'segments' as const, segments: [{ value: report.gender.male }, { value: report.gender.female, color: '#8EC13E' }] } : undefined, summary: `Total ${all}: ${report.gender.male} men, ${report.gender.female} women` },
    {
      label: 'Age 60+',
      value: seniors,
      viz: all > 0 ? { type: 'ring' as const, percent: pct(seniors, all), color: '#E0B400' } : undefined,
      summary: `${seniors} members aged 60 and over, ${pct(seniors, all)} percent`,
    },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Demographics Report" description="Age, education, employment and welfare breakdown" />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((item) => (
          <StatCard key={item.label} variant="inline" title={item.label} value={item.value} viz={item.viz} summary={item.summary} />
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
