import { useEffect, useState } from 'react';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts';
import Card from '@/components/ui/Card';
import PageHeader from '@/components/ui/PageHeader';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { reportService, type DevelopmentIndex as IndexData } from '@/services/reportService';

const scoreColor = (n: number) =>
  n >= 70 ? 'text-primary-600 dark:text-brand-lime' : n >= 40 ? 'text-amber-600' : 'text-red-600';

const barColor = (n: number) => (n >= 70 ? 'bg-primary-500' : n >= 40 ? 'bg-secondary-500' : 'bg-red-500');

/** Lowest indicator on a dimension — the hint for what to fix first. */
function weakestIndicator(indicators: Record<string, number>): string {
  const entries = Object.entries(indicators || {});
  if (entries.length === 0) return '—';
  const [key, value] = entries.reduce((lo, cur) => (cur[1] < lo[1] ? cur : lo));
  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  return `${label}: ${value}`;
}

export default function DevelopmentIndex() {
  const [data, setData] = useState<IndexData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    reportService
      .getDevelopmentIndex()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((error) => {
        console.error('Failed to load development index:', error);
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>;
  if (!data) return <Alert tone="danger">Failed to load development index</Alert>;

  const chartData = data.dimensions.map((d) => ({ label: d.label, score: d.score }));

  return (
    <div className="space-y-4">
      <PageHeader
        title="Development Index"
        description="Composite score across community development dimensions"
        actions={
          <div className="text-right">
            <div className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Overall score</div>
            <div className={`text-2xl font-extrabold ${scoreColor(data.totalScore)}`}>{data.totalScore}/100</div>
          </div>
        }
      />

      <Card padding="lg">
        <div className="h-72 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Radar name="Score" dataKey="score" stroke="#04563A" fill="#04563A" fillOpacity={0.4} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {data.dimensions.map((d) => (
          <Card key={d.key} padding="md">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">{d.label}</div>
              <div className={`text-xl font-extrabold ${scoreColor(d.score)}`}>{d.score}</div>
            </div>
            <div className="mt-2 h-1.5 w-full rounded-md bg-[#E7EEEA] dark:bg-surface-raised">
              <div className={`h-1.5 rounded ${barColor(d.score)}`} style={{ width: `${d.score}%` }} />
            </div>
            <div className="mt-2 break-words text-[12px] text-[#7B8983] dark:text-surface-muted">
              {weakestIndicator(d.indicators)}
            </div>
            {data.weakest.includes(d.key) && (
              <div className="mt-1 text-[12px] font-semibold text-[#B3261E] dark:text-red-300">Needs attention</div>
            )}
          </Card>
        ))}
      </div>

      <p className="text-xs text-[#7B8983] dark:text-surface-muted">
        Generated {new Date(data.generatedAt).toLocaleString()}. Scores are computed live from current
        records; formula constants live in the API config.
      </p>
    </div>
  );
}
