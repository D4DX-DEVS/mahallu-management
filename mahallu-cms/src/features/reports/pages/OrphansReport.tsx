import { useState, useEffect } from 'react';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { PersonCell } from '@/components/ui/Avatar';
import GenderChip from '@/components/ui/GenderChip';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { reportService, OrphansReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

export default function OrphansReportPage() {
  const [report, setReport] = useState<OrphansReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, []);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await reportService.getOrphansReport();
      setReport(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load orphans report. Refresh the page or try again."));
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csvData = report.orphans.map(orphan => ({
      Name: orphan.name,
      Age: orphan.age || '-',
      Gender: orphan.gender || '-',
      Family: orphan.family || '-'
    }));
    
    const headers = ['Name', 'Age', 'Gender', 'Family'];
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
    link.setAttribute('download', `orphans-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    if (!report) return;
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'age', label: 'Age' },
      { key: 'gender', label: 'Gender' },
      { key: 'familyName', label: 'Family' }
    ];
    
    const data = report.orphans.map(orphan => ({
      name: orphan.name,
      age: orphan.age || '-',
      gender: orphan.gender || '-',
      familyName: orphan.family || '-'
    }));
    
    exportToPDF(columns, data, `orphans-report-${new Date().toISOString().split('T')[0]}`, 'Orphans Report');
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
        title="Orphans Report"
        description="List of orphaned members (under 18 years)"
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatCard variant="inline" title="Total Orphans" value={report.total} />
      </div>

      <Card padding="lg">
        <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Orphan Details</h2>
        <ScrollX>
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
              <tr>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Name
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Age
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Gender
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Family
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
              {report.orphans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3.5 py-2 text-center text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                    No orphans found
                  </td>
                </tr>
              ) : (
                report.orphans.map((orphan) => (
                  <tr key={orphan.id} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                    <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#18231E] dark:text-surface-text">
                      <PersonCell name={orphan.name} size={32} />
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                      {orphan.age || '-'}
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                      <GenderChip value={orphan.gender} />
                    </td>
                    <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                      {orphan.family || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </ScrollX>
      </Card>
    </div>
  );
}

