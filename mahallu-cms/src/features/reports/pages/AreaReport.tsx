import { useState, useEffect } from 'react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService, AreaReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';
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

  const exportItems: DropdownItem[] = [
    { label: 'Export as CSV', icon: <FiFileText />, onClick: handleExportCSV },
    { label: 'Export as PDF', icon: <FiFile />, onClick: handlePrintPDF },
  ];

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !report) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Report not available'}</p>
        <Button onClick={fetchReport} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Area Report"
        description="Area-wise family and member statistics"
        actions={
          <Dropdown
            trigger={
              <Button variant="outline" icon={<FiDownload />} collapseLabel>
                Export
              </Button>
            }
            items={exportItems}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard title="Total Families" value={report.totalFamilies} />
        <StatCard title="Total Members" value={report.totalMembers} />
        <StatCard title="Male" value={report.maleCount} />
        <StatCard title="Female" value={report.femaleCount} />
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-3">Family Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <SortableTh sortKey="houseName" sort={sort} onSort={toggleSort}>
                  House Name
                </SortableTh>
                <SortableTh sortKey="area" sort={sort} onSort={toggleSort}>
                  Area
                </SortableTh>
                <SortableTh sortKey="memberCount" sort={sort} onSort={toggleSort}>
                  Members
                </SortableTh>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
              {sortedFamilies.map((family) => (
                <tr key={family.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">
                    {toTitleCase(family.houseName)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">
                    {toTitleCase(family.area) || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">
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
