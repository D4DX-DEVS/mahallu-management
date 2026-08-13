import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { reportService, type AnnualReport as AnnualReportData } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

const money = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="text-xs sm:text-sm text-gray-600">{label}</div>
      <div className="text-base sm:text-xl font-bold">{value}</div>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">{title}</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">{children}</div>
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
    <div className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-2xl font-bold">State of the Mahallu</h1>
        <div className="flex items-center gap-2">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="border rounded-md px-3 py-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <Button onClick={downloadPdf} disabled={!data}>
            Download PDF
          </Button>
        </div>
      </div>

      {loading && <div>Loading...</div>}
      {!loading && !data && <div>Failed to load report</div>}

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
            <Stat label="Expense" value={money(data.finance.expense)} />
            <Stat label="Balance" value={money(data.finance.balance)} />
          </Section>

          <Section title="Welfare & Zakat">
            <Stat label="Applications" value={data.welfare.applications} />
            <Stat label="Welfare disbursed" value={money(data.welfare.disbursedAmount)} />
            <Stat label="Zakat collected" value={money(data.zakat.collected)} />
            <Stat label="Zakat distributed" value={money(data.zakat.distributed)} />
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
            <Stat label="Employed outcomes" value={data.employment.employedOutcomes} />
          </Section>

          <Section title="Programs & Projects">
            <Stat label="Programs" value={data.programs.total} />
            <Stat label="Projects" value={data.projects.total} />
            <Stat label="Completed" value={data.projects.completed} />
            <Stat label="In progress" value={data.projects.inProgress} />
            <Stat label="Estimated cost" value={money(data.projects.totalEstimatedCost)} />
          </Section>
        </>
      )}
    </div>
  );
}
