import { useState, useEffect } from 'react';
import { FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import StatCard from '@/components/ui/StatCard';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService } from '@/services/reportService';
import api from '@/services/api';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { errorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

interface DataQualityStat {
  label: string;
  value: number;
  subLabel?: string;
}

interface DuplicatePhoneGroup {
  id: string;
  count: number;
  members: Array<{ name: string; familyName: string }>;
}

interface DuplicateNameAge {
  /** `$group` key: `{ name, age }`, not a scalar id. */
  id: { name?: string; age?: number };
  count: number;
  members: Array<{ name: string; familyName: string; age?: number }>;
}

export default function DataQualityPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [duplicates, setDuplicates] = useState<any>(null);
  const [exporting, setExporting] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, duplicatesRes] = await Promise.all([
        api.get<{ success: boolean; data: any }>('/reports/data-quality'),
        api.get<{ success: boolean; data: any }>('/reports/duplicates'),
      ]);
      setStats(statsRes.data.data);
      setDuplicates(duplicatesRes.data.data);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'data quality report'));
      console.error('Error fetching data quality:', err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = async (entity: string) => {
    try {
      setExporting((prev) => ({ ...prev, [entity]: true }));
      const response = await api.get(`/export/${entity}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      link.setAttribute('href', url);
      link.setAttribute('download', `${entity}-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      setError(errorMessage(err, { action: `export ${entity}` }));
    } finally {
      setExporting((prev) => ({ ...prev, [entity]: false }));
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Data Quality Report"
          description="Monitor data quality metrics and identify duplicates"
        />
        <Alert variant="error" title="Couldn't load report" action={{ label: 'Try again', onClick: fetchData }}>
          {error}
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Data Quality Report"
        description="Monitor data quality metrics and identify duplicates"
      />

      {/* Data Quality Stats */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {/* Families Stats */}
        <StatCard
          title="Total Families"
          value={stats?.families?.total || 0}
          hint={<>{stats?.families?.pendingApproval || 0} pending approval</>}
        />

        <StatCard
          title="Families without Head"
          value={stats?.families?.withoutHead || 0}
          hint="Action required"
          tone="warning"
        />

        {/* Members Stats */}
        <StatCard title="Total Members" value={stats?.members?.total || 0} />

        <StatCard
          title="Missing Phone"
          value={stats?.members?.missingPhone || 0}
          hint={`${(((stats?.members?.missingPhone || 0) / (stats?.members?.total || 1)) * 100).toFixed(
            1
          )}% of total`}
          tone="destructive"
        />

        <StatCard
          title="Missing Age"
          value={stats?.members?.missingAge || 0}
          hint={`${(((stats?.members?.missingAge || 0) / (stats?.members?.total || 1)) * 100).toFixed(
            1
          )}% of total`}
          tone="destructive"
        />

        <StatCard
          title="Unenrolled Students"
          value={stats?.members?.unenrolledStudents || 0}
          hint="Missing education info"
          tone="warning"
        />
      </div>

      {/* Duplicates Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Suspected Duplicates</h2>

        {/* Duplicates by Phone */}
        {duplicates?.byPhone && duplicates.byPhone.length > 0 && (
          <Card>
            <h3 className="text-base font-semibold mb-3 text-foreground">
              Duplicate Phone Numbers ({duplicates.byPhone.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      Phone
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      Count
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      Members
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.byPhone.map((group: DuplicatePhoneGroup) => (
                    <tr
                      key={group.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-3 font-mono text-gray-900 dark:text-gray-100">{group.id}</td>
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100 font-semibold">
                        {group.count}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                        {group.members.map((m, idx) => (
                          <div key={idx} className="text-xs">
                            {toTitleCase(m.name)} ({toTitleCase(m.familyName)})
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Duplicates by Name & Age */}
        {duplicates?.byNameAge && duplicates.byNameAge.length > 0 && (
          <Card>
            <h3 className="text-base font-semibold mb-3 text-foreground">
              Duplicate Names & Age ({duplicates.byNameAge.length})
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      Name & Age
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      Count
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-gray-700 dark:text-gray-300">
                      Members
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {duplicates.byNameAge.map((group: DuplicateNameAge) => (
                    <tr
                      key={(group.id?.name ?? '') + '-' + (group.id?.age ?? '')}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100 font-mono text-xs">
                        {toTitleCase(group.id?.name)}
                        {group.id?.age != null ? ', age ' + group.id.age : ''}
                      </td>
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100 font-semibold">
                        {group.count}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                        {group.members.map((m, idx) => (
                          <div key={idx} className="text-xs">
                            {toTitleCase(m.name)} ({toTitleCase(m.familyName)}){m.age ? `, age ${m.age}` : ''}
                          </div>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Export Section */}
      <Card>
        <h3 className="text-base font-semibold mb-3 text-foreground">Export Data</h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Download CSV files for all entities</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
          {['families', 'members', 'varisangya', 'zakat', 'nikah', 'death', 'noc'].map((entity) => (
            <Button
              key={entity}
              variant="outline"
              size="sm"
              onClick={() => exportToCSV(entity)}
              isLoading={exporting[entity]}
              className="flex items-center justify-center gap-2"
            >
              <FiDownload className="h-4 w-4" />
              {entity.charAt(0).toUpperCase() + entity.slice(1)}
            </Button>
          ))}
        </div>
      </Card>
    </div>
  );
}
