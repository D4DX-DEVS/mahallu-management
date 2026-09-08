import { useState, useEffect } from 'react';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService, AreaReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

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
      setError(loadErrorMessage(err, 'area report'));
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csvData = report.families.map((family) => ({
      'House Name': family.houseName,
      Area: family.area || '-',
      Members: family.memberCount,
    }));

    const headers = ['House Name', 'Area', 'Members'];
    const csvRows = [headers.join(',')];

    csvData.forEach((row) => {
      const values = headers.map((header) => {
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
      { key: 'memberCount', label: 'Members' },
    ];

    const data = report.families.map((family) => ({
      houseName: family.houseName,
      area: family.area || '-',
      memberCount: family.memberCount,
    }));

    exportToPDF(columns, data, `area-report-${new Date().toISOString().split('T')[0]}`, 'Area Report');
  };

  const {
    rows: sortedFamilies,
    sort,
    toggleSort,
  } = useSortableRows(report?.families ?? []);

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !report) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Report not available'}</p>
        <Button onClick={fetchReport} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader description="Area-wise family and member statistics" title="Area Report" />

      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
            <FiDownload className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handlePrintPDF} variant="outline" className="flex items-center gap-2">
            <FiPrinter className="h-4 w-4" />
            Print PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Families</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.totalFamilies}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Members</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.totalMembers}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Male</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.maleCount}</div>
        </Card>
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Female</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.femaleCount}</div>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Family Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <SortableTh sortKey="houseName" sort={sort} onSort={toggleSort} className="px-6 py-3 uppercase tracking-wider">
                  House Name
                </SortableTh>
                <SortableTh sortKey="area" sort={sort} onSort={toggleSort} className="px-6 py-3 uppercase tracking-wider">
                  Area
                </SortableTh>
                <SortableTh sortKey="memberCount" sort={sort} onSort={toggleSort} className="px-6 py-3 uppercase tracking-wider">
                  Members
                </SortableTh>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {sortedFamilies.map((family) => (
                <tr key={family.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {family.houseName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {family.area || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {family.memberCount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
