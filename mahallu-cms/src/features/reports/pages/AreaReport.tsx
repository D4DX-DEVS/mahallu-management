import { useState, useEffect } from 'react';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { PersonCell } from '@/components/ui/Avatar';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { reportService, AreaReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { pct } from '@/utils/statSeries';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function AreaReportPage() {
  const [report, setReport] = useState<AreaReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getAreaReport();
      setReport(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load area report. Refresh the page or try again."));
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csvData = report.families.map(family => ({
      'House Name': family.houseName,
      Area: family.area || '-',
      Members: family.memberCount
    }));
    
    const headers = ['House Name', 'Area', 'Members'];
    const csvRows = [headers.join(',')];
    
    csvData.forEach(row => {
      const values = headers.map(header => {
        const value = row[header as keyof typeof row] ?? '';
        const escaped = String(value).replace(/"/g, '""');
        return escaped.includes(',') ? `"${escaped}"` : escaped;
      });
      csvRows.push(values.join(','));
    });
    
    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `area-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    if (!report) return;
    const columns = [
      { key: 'houseName', label: 'House Name' },
      { key: 'area', label: 'Area' },
      { key: 'memberCount', label: 'Members' }
    ];
    
    const data = report.families.map(family => ({
      houseName: family.houseName,
      area: family.area || '-',
      memberCount: family.memberCount
    }));
    
    exportToPDF(columns, data, `area-report-${new Date().toISOString().split('T')[0]}`, 'Area Report');
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="text-center py-12">
        <p className="text-[#B3261E] dark:text-red-300">{error || 'Report not available'}</p>
        <Button onClick={fetchReport} className="mt-4" variant="secondary">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Area Report"
        description="Area-wise family and member statistics"
        actions={
          <>
            <Button
              onClick={handleExportCSV}
              variant="secondary"
            >
              <FiDownload className="h-3.5 w-3.5" />
              Export CSV
            </Button>
            <Button
              onClick={handlePrintPDF}
              variant="secondary"
            >
              <FiPrinter className="h-3.5 w-3.5" />
              Print PDF
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard variant="inline" title="Total Families" value={report.totalFamilies} />
        <StatCard variant="inline" title="Total Members" value={report.totalMembers} viz={report.maleCount + report.femaleCount > 0 ? { type: 'segments', segments: [{ value: report.maleCount }, { value: report.femaleCount, color: '#8EC13E' }] } : undefined} summary={`Total members ${report.totalMembers}: ${report.maleCount} male, ${report.femaleCount} female`} />
        <StatCard variant="inline" title="Male" value={report.maleCount} viz={report.totalMembers > 0 ? { type: 'ring', percent: pct(report.maleCount, report.totalMembers) } : undefined} summary={`Male ${report.maleCount} of ${report.totalMembers}, ${pct(report.maleCount, report.totalMembers)} percent`} />
        <StatCard variant="inline" title="Female" value={report.femaleCount} viz={report.totalMembers > 0 ? { type: 'ring', percent: pct(report.femaleCount, report.totalMembers), color: '#8EC13E' } : undefined} summary={`Female ${report.femaleCount} of ${report.totalMembers}, ${pct(report.femaleCount, report.totalMembers)} percent`} />
      </div>

      <Card padding="lg">
        <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Family Details</h2>
        <ScrollX>
          <table className="w-full min-w-[400px] border-collapse text-[12.5px]">
            <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
              <tr>
                <th className="px-3.5 py-2.5 text-left align-bottom text-[12px] font-bold leading-tight text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.03em] sticky left-0 z-[1] bg-[#FAFCFB] dark:bg-surface-card min-w-[10.5rem]">
                  House Name
                </th>
                <th className="px-3.5 py-2.5 text-left align-bottom text-[12px] font-bold leading-tight text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.03em]">
                  Area
                </th>
                <th className="px-3.5 py-2.5 text-left align-bottom text-[12px] font-bold leading-tight text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.03em]">
                  Members
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
              {report.families.map((family) => (
                <tr key={family.id} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                  <td className="sticky left-0 z-[1] min-w-[10.5rem] max-w-[13rem] bg-white px-3.5 py-2 text-[12.5px] text-[#18231E] dark:bg-surface-card dark:text-surface-text">
                    <PersonCell name={family.houseName} size={24} />
                  </td>
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                    {family.area || '-'}
                  </td>
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#18231E] dark:text-surface-text">
                    {family.memberCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollX>
      </Card>
    </div>
  );
}

