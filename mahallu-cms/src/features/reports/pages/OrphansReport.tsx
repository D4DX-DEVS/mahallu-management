import { useState, useEffect } from 'react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService, OrphansReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

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
      setError(loadErrorMessage(err, 'orphans report'));
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csvData = sortedOrphans.map((orphan) => ({
      Name: orphan.name,
      Age: orphan.age || '-',
      Gender: orphan.gender || '-',
      Family: orphan.family || '-',
    }));

    const headers = ['Name', 'Age', 'Gender', 'Family'];
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
      { key: 'familyName', label: 'Family' },
    ];

    const data = report.orphans.map((orphan) => ({
      name: orphan.name,
      age: orphan.age || '-',
      gender: orphan.gender || '-',
      familyName: orphan.family || '-',
    }));

    exportToPDF(columns, data, `orphans-report-${new Date().toISOString().split('T')[0]}`, 'Orphans Report');
  };

  const {
    rows: sortedOrphans,
    sort,
    toggleSort,
  } = useSortableRows(report?.orphans ?? []);

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
    <div className="space-y-4">
      <PageHeader description="List of orphaned members (under 18 years)" title="Orphans Report" />

      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-3">
          <Dropdown
            trigger={
              <Button variant="outline" icon={<FiDownload />} collapseLabel>
                Export
              </Button>
            }
            items={exportItems}
          />
        </div>
      </div>

      <StatCard title="Total Orphans" value={report.total} />

      <Card>
        <h2 className="text-lg font-semibold mb-3">Orphan Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                  Name
                </SortableTh>
                <SortableTh sortKey="age" sort={sort} onSort={toggleSort}>
                  Age
                </SortableTh>
                <SortableTh sortKey="gender" sort={sort} onSort={toggleSort}>
                  Gender
                </SortableTh>
                <SortableTh sortKey="family" sort={sort} onSort={toggleSort}>
                  Family
                </SortableTh>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
              {report.orphans.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                    No orphans found
                  </td>
                </tr>
              ) : (
                report.orphans.map((orphan) => (
                  <tr key={orphan.id}>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground">
                      {toTitleCase(orphan.name)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">
                      {orphan.age || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground capitalize">
                      {orphan.gender || '-'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">
                      {orphan.family ? toTitleCase(orphan.family) : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
