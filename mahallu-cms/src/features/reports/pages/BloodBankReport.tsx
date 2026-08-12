import { useState, useEffect } from 'react';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import Breadcrumb from '@/components/layout/Breadcrumb';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { reportService, BloodBankReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';

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
      setError(err.response?.data?.message || 'Failed to fetch blood bank report');
      console.error('Error fetching report:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!report) return;
    const csvData = report.members.map(member => ({
      Name: member.name,
      'Blood Group': member.bloodGroup,
      Age: member.age || '-',
      Gender: member.gender || '-',
      Phone: member.phone || '-'
    }));
    
    const headers = ['Name', 'Blood Group', 'Age', 'Gender', 'Phone'];
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
      { key: 'phone', label: 'Phone' }
    ];
    
    const data = report.members.map(member => ({
      name: member.name,
      bloodGroup: member.bloodGroup,
      age: member.age || '-',
      gender: member.gender || '-',
      phone: member.phone || '-'
    }));
    
    exportToPDF(columns, data, `blood-bank-report-${new Date().toISOString().split('T')[0]}`, 'Blood Bank Report');
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
        <p className="text-red-600 dark:text-red-400">{error || 'Report not available'}</p>
        <Button onClick={fetchReport} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: 'Dashboard', path: '/dashboard' }, { label: 'Blood Bank Report' }]} />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Blood Bank Report</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Blood group statistics and member details</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleExportCSV}
            variant="outline"
            className="flex items-center gap-2"
          >
            <FiDownload className="h-4 w-4" />
            Export CSV
          </Button>
          <Button
            onClick={handlePrintPDF}
            variant="outline"
            className="flex items-center gap-2"
          >
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
          className="w-48"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Members</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{report.total}</div>
        </Card>
        {Object.entries(report.bloodGroupStats).map(([group, count]) => (
          <Card key={group}>
            <div className="text-sm text-gray-500 dark:text-gray-400">{group}</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{count}</div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold mb-4">Member Details</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Blood Group
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Age
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Gender
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Phone
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {report.members.map((member) => (
                <tr key={member.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {member.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600 dark:text-red-400">
                    {member.bloodGroup}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {member.age || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 capitalize">
                    {member.gender || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
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

