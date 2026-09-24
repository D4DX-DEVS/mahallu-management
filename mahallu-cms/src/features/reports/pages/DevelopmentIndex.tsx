import { useEffect, useState } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import Card from '@/components/ui/Card';
import { reportService, type DevelopmentIndex as IndexData } from '@/services/reportService';
import PageHeader from '@/components/layout/PageHeader';
import { useChartTheme } from '@/utils/chartTheme';

const scoreColor = (n: number) => (n >= 70 ? 'text-green-600' : n >= 40 ? 'text-amber-600' : 'text-red-600');

const barColor = (n: number) => (n >= 70 ? 'bg-green-500' : n >= 40 ? 'bg-amber-500' : 'bg-red-500');

/** Lowest indicator on a dimension — the hint for what to fix first. */
function weakestIndicator(indicators: Record<string, number>): string {
  const entries = Object.entries(indicators || {});
  if (entries.length === 0) return '—';
  const [key, value] = entries.reduce((lo, cur) => (cur[1] < lo[1] ? cur : lo));
  const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
  return `${label}: ${value}`;
}

export default function DevelopmentIndex() {
  const chart = useChartTheme();
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
        console.error("Couldn't load development index:", error);
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!data) return <div className="p-4">Couldn't load development index</div>;

  const chartData = data.dimensions.map((d) => ({ label: d.label, score: d.score }));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <PageHeader title="Development Index" />
        <div className="text-right">
          <div className="text-xs sm:text-sm text-gray-600">Overall score</div>
          <div className={`text-2xl font-semibold tabular-nums ${scoreColor(data.totalScore)}`}>{data.totalScore}/100</div>
        </div>
      </div>

      <Card className="mb-4">
        <div className="h-72 sm:h-96">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={chartData} outerRadius="75%">
              <PolarGrid />
              <PolarAngleAxis dataKey="label" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar
                name="Score"
                dataKey="score"
                stroke={chart.primary}
                fill={chart.primary}
                fillOpacity={0.4}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid grid-cols-1 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        {data.dimensions.map((d) => (
          <Card key={d.key}>
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xs sm:text-sm text-gray-600">{d.label}</div>
              <div className={`text-base sm:text-lg font-semibold tabular-nums ${scoreColor(d.score)}`}>{d.score}</div>
            </div>
            <div className="mt-2 h-1.5 w-full rounded bg-gray-200">
              <div className={`h-1.5 rounded ${barColor(d.score)}`} style={{ width: `${d.score}%` }} />
            </div>
            <div className="mt-2 text-xs sm:text-xs text-gray-500 break-words">
              {weakestIndicator(d.indicators)}
            </div>
            {data.weakest.includes(d.key) && (
              <div className="mt-1 text-xs sm:text-xs font-medium text-red-600">Needs attention</div>
            )}
          </Card>
        ))}
      </div>

      <p className="mt-4 text-xs text-gray-500">
        Generated {new Date(data.generatedAt).toLocaleString()}. Scores are computed live from current
        records; formula constants live in the API config.
      </p>
    </div>
  );
}
