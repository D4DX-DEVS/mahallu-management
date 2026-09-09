import { useState, useEffect } from 'react';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService, BloodBankReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import SortableTh from '@/components/ui/SortableTh';
import { useSortableRows } from '@/hooks/useSortableRows';

export default function BloodBankReportPage() {
  const [bloodGroupFilter, setBloodGroupFilter] = useState('all');
  const [report, setReport] = useState<BloodBankReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReport();
  }, [bloodGroupFilter]);

  const fetchReport = async () => {
    try {
      setLoading(true);
      setError(null);
      const params: any = {};
      if (bloodGroupFilter !== 'all') {
        params.bloodGroup = bloodGroupFilter;
      }
      const data = await reportService.getBloodBankReport(params);
      setReport(data);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'blood bank report'));
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csvData = report.members.map((member) => ({
      Name: member.name,
      'Blood Group': member.bloodGroup,
      Age: member.age || '-',
      Gender: member.gender || '-',
      Phone: member.phone || '-',
    }));

    const headers = ['Name', 'Blood Group', 'Age', 'Gender', 'Phone'];
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
    link.setAttribute('download', `blood-bank-report-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    if (!report) return;
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'bloodGroup', label: 'Blood Group' },
      { key: 'age', label: 'Age' },
      { key: 'gender', label: 'Gender' },
      { key: 'phone', label: 'Phone' },
    ];

    const data = report.members.map((member) => ({
      name: member.name,
      bloodGroup: member.bloodGroup,
      age: member.age || '-',
      gender: member.gender || '-',
      phone: member.phone || '-',
    }));

    exportToPDF(
      columns,
      data,
      `blood-bank-report-${new Date().toISOString().split('T')[0]}`,
      'Blood Bank Report'
    );
  };

  const {
    rows: sortedMembers,
    sort,
    toggleSort,
  } = useSortableRows(report?.members ?? []);

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
      <PageHeader description="Blood group statistics and member details" title="Blood Bank Report" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <Button onClick={handleExportCSV} variant="outline" className="flex items-center gap-2">
            <FiDownload className="h-4 w-4" />
            Export CSV
          </Button>
          <Button onClick={handlePrintPDF} variant="outline" className="flex items-center gap-2">
            <FiPrinter className="h-4 w-4" />
            Print PDF
          </Button>
          <Select
            options={[
              { value: 'all', label: 'All Blood Groups' },
              { value: 'A +ve', label: 'A +ve' },
              { value: 'A -ve', label: 'A -ve' },
              { value: 'B +ve', label: 'B +ve' },
              { value: 'B -ve', label: 'B -ve' },
              { value: 'AB +ve', label: 'AB +ve' },
              { value: 'AB -ve', label: 'AB -ve' },
              { value: 'O +ve', label: 'O +ve' },
              { value: 'O -ve', label: 'O -ve' },
            ]}
            value={bloodGroupFilter}
            onChange={(e) => setBloodGroupFilter(e.target.value)}
            className="w-full sm:w-48"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard title="Total Members" value={report.total} />
        {Object.entries(report.bloodGroupStats).map(([group, count]) => (
          <StatCard key={group} title={group} value={count} />
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-3">Member Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <SortableTh sortKey="name" sort={sort} onSort={toggleSort}>
                  Name
                </SortableTh>
                <SortableTh sortKey="bloodGroup" sort={sort} onSort={toggleSort}>
                  Blood Group
                </SortableTh>
                <SortableTh sortKey="age" sort={sort} onSort={toggleSort}>
                  Age
                </SortableTh>
                <SortableTh sortKey="gender" sort={sort} onSort={toggleSort}>
                  Gender
                </SortableTh>
                <SortableTh sortKey="phone" sort={sort} onSort={toggleSort}>
                  Phone
                </SortableTh>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-border">
              {sortedMembers.map((member) => (
                <tr key={member.id}>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-foreground capitalize">
                    {member.name}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400">
                    {member.bloodGroup}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">
                    {member.age || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground capitalize">
                    {member.gender || '-'}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-sm text-muted-foreground">
                    {member.phone || '-'}
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
