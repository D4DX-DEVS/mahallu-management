import { useState, useEffect } from 'react';
import { FiDownload, FiFileText, FiFile } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Dropdown, { DropdownItem } from '@/components/ui/Dropdown';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService, OrphansReport } from '@/services/reportService';
import { exportToCSV, exportToPDF } from '@/utils/exportUtils';
import { TableColumn } from '@/types';
import { loadErrorInfo, LoadErrorInfo } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';
import { logError } from '@/utils/safeLog';

export default function OrphansReportPage() {
  const [report, setReport] = useState<OrphansReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<LoadErrorInfo | null>(null);

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
      setError(loadErrorInfo(err, 'orphans report'));
      logError('Error fetching report', err);
    } finally {
      setLoading(false);
    }
  };

  const exportColumns: TableColumn[] = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age' },
    { key: 'gender', label: 'Gender' },
    { key: 'familyName', label: 'Family' },
  ];

  const toExportRows = (orphans: NonNullable<typeof report>['orphans']) =>
    orphans.map((orphan) => ({
      name: orphan.name,
      age: orphan.age || '-',
      gender: orphan.gender || '-',
      familyName: orphan.family || '-',
    }));

  const exportFilename = () => `orphans-report-${new Date().toISOString().split('T')[0]}`;

  // The CSV follows the order on screen; exportToCSV applies the shared CSV
  // safeguards (BOM, quoting, formula guard).
  const handleExportCSV = () => {
    if (!report) return;
    exportToCSV(exportColumns, toExportRows(sortedOrphans), exportFilename());
  };

  const handlePrintPDF = async () => {
    if (!report) return;
    await exportToPDF(exportColumns, toExportRows(report.orphans), exportFilename(), 'Orphans Report');
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
      <div className="space-y-4">
        <Alert
          variant={error?.variant ?? 'error'}
          title={error?.title ?? "Couldn't load report"}
          action={error?.variant === 'info' ? undefined : { label: 'Try again', onClick: fetchReport }}
        >
          {error?.message ?? 'Report not available'}
        </Alert>
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
          <table className="data-table min-w-full divide-y divide-border">
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
