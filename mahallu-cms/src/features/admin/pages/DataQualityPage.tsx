import { useState, useEffect } from 'react';
import { FiDownload } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { reportService } from '@/services/reportService';
import api from '@/services/api';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { errorMessage } from '@/utils/errors';

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
      <div className="space-y-6">
        <Card>
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Quality Report"
        description="Monitor data quality metrics and identify duplicates"
      />

      {/* Data Quality Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Families Stats */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Families</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats?.data?.families?.total || 0}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {stats?.data?.families?.pendingApproval || 0} pending approval
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Families without Head</h3>
          <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">
            {stats?.data?.families?.withoutHead || 0}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Action required</p>
        </Card>

        {/* Members Stats */}
        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Total Members</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {stats?.data?.members?.total || 0}
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Missing Phone</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {stats?.data?.members?.missingPhone || 0}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {(((stats?.data?.members?.missingPhone || 0) / (stats?.data?.members?.total || 1)) * 100).toFixed(
              1
            )}
            % of total
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Missing Age</h3>
          <p className="text-3xl font-bold text-red-600 dark:text-red-400">
            {stats?.data?.members?.missingAge || 0}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
            {(((stats?.data?.members?.missingAge || 0) / (stats?.data?.members?.total || 1)) * 100).toFixed(
              1
            )}
            % of total
          </p>
        </Card>

        <Card>
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Unenrolled Students</h3>
          <p className="text-3xl font-bold text-orange-600 dark:text-orange-400">
            {stats?.data?.members?.unenrolledStudents || 0}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">Missing education info</p>
        </Card>
      </div>

      {/* Duplicates Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Suspected Duplicates</h2>

        {/* Duplicates by Phone */}
        {duplicates?.data?.byPhone && duplicates.data.byPhone.length > 0 && (
          <Card>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
              Duplicate Phone Numbers ({duplicates.data.byPhone.length})
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
                  {duplicates.data.byPhone.map((group: DuplicatePhoneGroup) => (
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
                            {m.name} ({m.familyName})
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
        {duplicates?.data?.byNameAge && duplicates.data.byNameAge.length > 0 && (
          <Card>
            <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">
              Duplicate Names & Age ({duplicates.data.byNameAge.length})
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
                  {duplicates.data.byNameAge.map((group: DuplicateNameAge) => (
                    <tr
                      key={(group.id?.name ?? '') + '-' + (group.id?.age ?? '')}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100 font-mono text-xs">
                        {group.id?.name}
                        {group.id?.age != null ? ', age ' + group.id.age : ''}
                      </td>
                      <td className="py-3 px-3 text-gray-900 dark:text-gray-100 font-semibold">
                        {group.count}
                      </td>
                      <td className="py-3 px-3 text-gray-600 dark:text-gray-400">
                        {group.members.map((m, idx) => (
                          <div key={idx} className="text-xs">
                            {m.name} ({m.familyName}){m.age ? `, age ${m.age}` : ''}
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
        <h3 className="text-md font-medium text-gray-900 dark:text-gray-100 mb-4">Export Data</h3>
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
