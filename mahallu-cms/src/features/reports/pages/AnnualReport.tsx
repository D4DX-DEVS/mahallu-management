import { useEffect, useState } from 'react';
import PageHeader from '@/components/ui/PageHeader';
import StatCard, { type StatViz } from '@/components/ui/StatCard';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Button from '@/components/ui/Button';
import { reportService, type AnnualReport as AnnualReportData } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { pct } from '@/utils/statSeries';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

function Stat({ label, value, viz, summary }: { label: string; value: string | number; viz?: StatViz; summary?: string }) {
  return <StatCard variant="inline" title={label} value={value} viz={viz} summary={summary} />;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h2 className="text-sm font-bold text-primary-700 dark:text-surface-text">{title}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{children}</div>
    </div>
  );
}

export default function AnnualReport() {
  const [year, setYear] = useState(currentYear);
  const [data, setData] = useState<AnnualReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    reportService
      .getAnnualReport(year)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((error) => {
        console.error('Failed to load annual report:', error);
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  // ponytail: flat metric/value rows through the existing exportToPDF helper.
  // No bespoke PDF layout until someone asks for one.
  const downloadPdf = () => {
    if (!data) return;
    const rows = [
      { metric: 'Total families', value: String(data.demographics.totalFamilies) },
      { metric: 'Total members', value: String(data.demographics.totalMembers) },
      { metric: 'Income', value: money(data.finance.income) },
      { metric: 'Expense', value: money(data.finance.expense) },
      { metric: 'Balance', value: money(data.finance.balance) },
      { metric: 'Welfare applications', value: String(data.welfare.applications) },
      { metric: 'Welfare disbursed', value: money(data.welfare.disbursedAmount) },
      { metric: 'Zakat collected', value: money(data.zakat.collected) },
      { metric: 'Zakat distributed', value: money(data.zakat.distributed) },
      { metric: 'Active classes', value: String(data.education.activeClasses) },
      { metric: 'Active students', value: String(data.education.activeStudents) },
      { metric: 'Exams held', value: String(data.education.exams) },
      { metric: 'Vacancies posted', value: String(data.employment.vacanciesPosted) },
      { metric: 'Trainings', value: String(data.employment.trainings) },
      { metric: 'Trained participants', value: String(data.employment.trainedParticipants) },
      { metric: 'Employment outcomes', value: String(data.employment.employedOutcomes) },
      { metric: 'Programs', value: String(data.programs.total) },
      { metric: 'Projects', value: String(data.projects.total) },
      { metric: 'Projects completed', value: String(data.projects.completed) },
      { metric: 'Project estimated cost', value: money(data.projects.totalEstimatedCost) },
    ];
    exportToPDF(
      [
        { key: 'metric', label: 'Metric' },
        { key: 'value', label: 'Value' },
      ],
      rows,
      `state-of-the-mahallu-${data.year}`,
      `State of the Mahallu - ${data.year}`
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="State of the Mahallu"
        description="Annual summary across demographics, finance, welfare and education"
        actions={
          <>
            <div className="w-28">
              <Select
                options={years.map((y) => ({ value: String(y), label: String(y) }))}
                value={String(year)}
                onChange={(e) => setYear(Number(e.target.value))}
              />
            </div>
            <Button onClick={downloadPdf} disabled={!data}>
              Download PDF
            </Button>
          </>
        }
      />

      {loading && <div className="flex justify-center py-12"><LoadingSpinner /></div>}
      {!loading && !data && <Alert tone="danger">Failed to load report</Alert>}

      {!loading && data && (
        <>
          <Section title="Demographics">
            <Stat label="Families" value={data.demographics.totalFamilies} />
            <Stat label="Members" value={data.demographics.totalMembers} />
            <Stat
              label="Latest survey"
              value={
                data.demographics.latestSurvey
                  ? new Date(data.demographics.latestSurvey.surveyDate).toLocaleDateString()
                  : '—'
              }
            />
            <Stat
              label="Survey population"
              value={data.demographics.latestSurvey?.stats?.totalPopulation ?? '—'}
            />
          </Section>

          <Section title="Finance">
            <Stat label="Income" value={money(data.finance.income)} />
            <Stat label="Expense" value={money(data.finance.expense)} viz={data.finance.income > 0 ? { type: 'bullet', percent: pct(data.finance.expense, data.finance.income), target: 100, color: data.finance.expense > data.finance.income ? '#B3261E' : '#04563A' } : undefined} summary={`Expense ${money(data.finance.expense)}, ${pct(data.finance.expense, data.finance.income)} percent of income`} />
            <Stat label="Balance" value={money(data.finance.balance)} viz={data.finance.income + data.finance.expense > 0 ? { type: 'pair', a: data.finance.income, b: data.finance.expense, colorB: '#E0B400' } : undefined} summary={`Balance ${money(data.finance.balance)}: income ${money(data.finance.income)} compared with expense ${money(data.finance.expense)}`} />
          </Section>

          <Section title="Welfare & Zakat">
            <Stat label="Applications" value={data.welfare.applications} />
            <Stat label="Welfare disbursed" value={money(data.welfare.disbursedAmount)} />
            <Stat label="Zakat collected" value={money(data.zakat.collected)} />
            <Stat label="Zakat distributed" value={money(data.zakat.distributed)} viz={data.zakat.collected > 0 ? { type: 'ring', percent: pct(data.zakat.distributed, data.zakat.collected), color: '#8EC13E' } : undefined} summary={`Zakat distributed ${money(data.zakat.distributed)} of ${money(data.zakat.collected)} collected, ${pct(data.zakat.distributed, data.zakat.collected)} percent`} />
          </Section>

          <Section title="Education">
            <Stat label="Active classes" value={data.education.activeClasses} />
            <Stat label="Active students" value={data.education.activeStudents} />
            <Stat label="Exams held" value={data.education.exams} />
          </Section>

          <Section title="Employment">
            <Stat label="Vacancies posted" value={data.employment.vacanciesPosted} />
            <Stat label="Trainings" value={data.employment.trainings} />
            <Stat label="Participants" value={data.employment.trainedParticipants} />
            <Stat label="Employed outcomes" value={data.employment.employedOutcomes} viz={data.employment.trainedParticipants > 0 ? { type: 'ring', percent: pct(data.employment.employedOutcomes, data.employment.trainedParticipants) } : undefined} summary={`${data.employment.employedOutcomes} of ${data.employment.trainedParticipants} participants employed, ${pct(data.employment.employedOutcomes, data.employment.trainedParticipants)} percent`} />
          </Section>

          <Section title="Programs & Projects">
            <Stat label="Programs" value={data.programs.total} />
            <Stat label="Projects" value={data.projects.total} />
            <Stat label="Completed" value={data.projects.completed} viz={data.projects.total > 0 ? { type: 'ring', percent: pct(data.projects.completed, data.projects.total) } : undefined} summary={`${data.projects.completed} of ${data.projects.total} projects completed, ${pct(data.projects.completed, data.projects.total)} percent`} />
            <Stat label="In progress" value={data.projects.inProgress} />
            <Stat label="Estimated cost" value={money(data.projects.totalEstimatedCost)} />
          </Section>
        </>
      )}
    </div>
  );
}
