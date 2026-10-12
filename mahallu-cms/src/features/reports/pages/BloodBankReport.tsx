import { useState, useEffect } from 'react';
import { FiDownload, FiPrinter } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import PageHeader from '@/components/ui/PageHeader';
import Button from '@/components/ui/Button';
import { PersonCell } from '@/components/ui/Avatar';
import BloodGroupBadge from '@/components/ui/BloodGroupBadge';
import GenderChip from '@/components/ui/GenderChip';
import Select from '@/components/ui/Select';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { reportService, BloodBankReport } from '@/services/reportService';
import { exportToPDF } from '@/utils/exportUtils';
import { getFriendlyError } from '@/utils/apiMessages';
import ScrollX from '@/features/_shared/ScrollX';

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
      setError(getFriendlyError(err, "Couldn't load blood bank report. Refresh the page or try again."));
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
        title="Blood Bank Report"
        description="Blood group statistics and member details"
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
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard variant="inline" title="Total Members" value={report.total} />
        {Object.entries(report.bloodGroupStats).map(([group, count]) => (
          <Card key={group}>
            <div className="text-sm text-[#7B8983] dark:text-surface-muted"><BloodGroupBadge value={group} /></div>
            <div className="text-2xl font-bold text-[#18231E] dark:text-surface-text">{count}</div>
          </Card>
        ))}
      </div>

      <Card padding="lg">
        <h2 className="mb-3.5 text-sm font-bold text-primary-700 dark:text-surface-text">Member Details</h2>
        <ScrollX>
          <table className="w-full border-collapse text-[12.5px]">
            <thead className="bg-[#FAFCFB] dark:bg-surface-base/60">
              <tr>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Name
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Blood Group
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Age
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Gender
                </th>
                <th className="whitespace-nowrap px-3.5 py-2.5 text-left text-[12px] font-bold text-[#7B8983] dark:text-surface-muted uppercase tracking-[0.06em]">
                  Phone
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft bg-white dark:divide-surface-border dark:bg-surface-card">
              {report.members.map((member) => (
                <tr key={member.id} className="hover:bg-[#F6FAF8] dark:hover:bg-surface-hover/60">
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#18231E] dark:text-surface-text">
                    <PersonCell name={member.name} size={32} />
                  </td>
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px]">
                    <BloodGroupBadge value={member.bloodGroup} />
                  </td>
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                    {member.age || '-'}
                  </td>
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                    <GenderChip value={member.gender} />
                  </td>
                  <td className="px-3.5 py-2 whitespace-nowrap text-[12.5px] text-[#7B8983] dark:text-surface-muted">
                    {member.phone || '-'}
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

