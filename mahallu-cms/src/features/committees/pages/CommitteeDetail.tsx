import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiCalendar } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import TableCard from '@/components/ui/TableCard';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Table from '@/components/ui/Table';
import { TableColumn } from '@/types';
import { Committee, Member } from '@/types';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { formatDate } from '@/utils/format';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { toTitleCase } from '@/utils/format';

export default function CommitteeDetail() {
  const { id } = useParams<{ id: string }>();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchCommittee();
      fetchMeetings();
    }
  }, [id]);

  const fetchCommittee = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await committeeService.getById(id);
      setCommittee(data);
    } catch (err: any) {
      setError(loadErrorMessage(err, 'committee'));
      console.error('Error fetching committee:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeetings = async () => {
    if (!id) return;
    try {
      const data = await committeeService.getMeetings(id);
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching meetings:', err);
      setMeetings([]);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !committee) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Committee not found'}</p>
        <Link to={ROUTES.COMMITTEES.LIST} className="mt-4 inline-block">
          <Button variant="outline">Back to Committees</Button>
        </Link>
      </div>
    );
  }

  const memberColumns: TableColumn<Member>[] = [
    { key: 'name', label: 'Name', width: '6.75rem', render: (v) => <span>{toTitleCase(v)}</span> },
    { key: 'familyName', label: 'Family', width: '7.25rem', render: (v) => toTitleCase(v) },
    { key: 'phone', label: 'Phone', width: '6.75rem' },
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        description="Committee Details"
        title={toTitleCase(committee.name)}
        breadcrumbs={[{ label: 'Committees', path: ROUTES.COMMITTEES.LIST }]}
      />

      <div className="flex gap-2 items-center justify-between">
        <div className="flex gap-2 items-center">
          <Link to={ROUTES.COMMITTEES.LIST}>
            <Button variant="outline" icon={<FiArrowLeft />} collapseLabel>Back</Button>
          </Link>
          <Link to={`/committees/${committee.id}/edit`}>
            <Button icon={<FiEdit2 />} collapseLabel>Edit</Button>
          </Link>
          <Link to={`/committees/${committee.id}/meetings`}>
            <Button variant="outline" icon={<FiCalendar />} collapseLabel>Meetings</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Name</p>
              <p className="text-base font-medium text-gray-900 dark:text-gray-100">{toTitleCase(committee.name)}</p>
            </div>
            {committee.description && (
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Description</p>
                <p className="text-base text-gray-900 dark:text-gray-100">{committee.description}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
              <span
                className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  committee.status === 'active'
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {committee.status || 'active'}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Created</p>
              <p className="text-base text-gray-900 dark:text-gray-100">{formatDate(committee.createdAt)}</p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Statistics</h2>
          <div className="space-y-3">
            <div>
              <p className="text-label font-medium text-muted-foreground">Total Members</p>
              <p className="text-2xl font-semibold leading-tight tabular-nums tracking-tight text-foreground">
                {Array.isArray(committee.members) ? committee.members.length : 0}
              </p>
            </div>
            <div>
              <p className="text-label font-medium text-muted-foreground">Total Meetings</p>
              <p className="text-2xl font-semibold leading-tight tabular-nums tracking-tight text-foreground">{meetings.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {Array.isArray(committee.members) && committee.members.length > 0 && (
        <TableCard>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Members</h2>
          <Table
            fixedLayout
            striped
            columns={memberColumns}
            data={committee.members as Member[]}
            emptyMessage="No members assigned"
          />
        </TableCard>
      )}

      {meetings.length > 0 && (
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Recent Meetings</h2>
          <div className="space-y-2">
            {meetings.slice(0, 5).map((meeting: any, index: number) => (
              <div
                key={meeting.id || index}
                className="p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <p className="font-medium text-gray-900 dark:text-gray-100">{meeting.title ? toTitleCase(meeting.title) : 'Meeting'}</p>
                {meeting.date && (
                  <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(meeting.date)}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
