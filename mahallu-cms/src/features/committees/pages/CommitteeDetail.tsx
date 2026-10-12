import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiCalendar, FiUsers } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';
import Tabs from '@/components/ui/Tabs';
import EmptyState from '@/components/ui/EmptyState';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Table from '@/components/ui/Table';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import { TableColumn } from '@/types';
import { Committee, Member } from '@/types';
import { ROUTES } from '@/constants/routes';
import { committeeService } from '@/services/committeeService';
import { formatDate } from '@/utils/format';
import { monthlySeries } from '@/utils/statSeries';
import RowActions from '@/components/ui/RowActions';
import { getFriendlyError } from '@/utils/apiMessages';

export default function CommitteeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [committee, setCommittee] = useState<Committee | null>(null);
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState('overview');

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
      setError(getFriendlyError(err, "Couldn't load committee. Refresh the page or try again."));
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
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !committee) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Committee not found'}</p>
        <Link to={ROUTES.COMMITTEES.LIST} className="mt-4 inline-block">
          <Button variant="secondary">Back to Committees</Button>
        </Link>
      </div>
    );
  }

  const memberColumns: TableColumn<Member>[] = [
    { key: 'id', label: 'No.', render: (_, __, index) => index + 1 },
    { key: 'name', label: 'Name', render: (name, row) => <PersonCell name={name} src={row.photoUrl} /> },
    { key: 'familyName', label: 'Family', render: (v) => (v ? <PersonCell name={v} size={24} /> : '-') },
    { key: 'phone', label: 'Phone' },
    {
      key: 'actions',
      label: 'Actions',
      hideable: false,
      render: (_v, row) => <RowActions onView={() => navigate(ROUTES.MEMBERS.DETAIL(String(row.id)))} ariaLabels={{ view: 'View member' }} />,
    },
  ];

  const meetingMonths = monthlySeries(meetings as any[], (m: any) => m.meetingDate);

  return (
    <div className="space-y-4">
      <PageHeader
        title={committee.name}
        leading={<Avatar size={56} name={committee.name} />}
        description="Committee Details"
        actions={
          <>
            <Link to={ROUTES.COMMITTEES.LIST}>
              <Button variant="secondary">
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
            <Link to={`/committees/${committee.id}/meetings`}>
              <Button variant="secondary">
                <FiCalendar className="h-3.5 w-3.5" />
                Meetings
              </Button>
            </Link>
            <Link to={`/committees/${committee.id}/edit`}>
              <Button>
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <StatCard
          variant="inline"
          title="Total Members"
          value={Array.isArray(committee.members) ? committee.members.length : 0}
          icon={<FiUsers className="h-[17px] w-[17px]" />}
          tone="green"
        />
        <StatCard
          variant="inline"
          title="Total Meetings"
          viz={meetingMonths.length ? { type: 'bars', values: meetingMonths } : undefined}
          value={meetings.length}
          icon={<FiCalendar className="h-[17px] w-[17px]" />}
          tone="lime"
        />
      </div>

      <Tabs
        aria-label="Committee sections"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'members', label: 'Members', count: Array.isArray(committee.members) ? committee.members.length : 0 },
          { value: 'meetings', label: 'Recent meetings', count: meetings.length },
        ]}
      />

      {tab === 'overview' && (
        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-3">Basic Information</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Name</p>
              <div className="mt-0.5"><PersonCell name={committee.name} size={24} /></div>
            </div>
            {committee.description && (
              <div>
                <p className="text-xs text-[#7B8983] dark:text-surface-muted">Description</p>
                <p className="text-[13px] text-[#18231E] dark:text-surface-text">{committee.description}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Status</p>
              <div className="mt-0.5">
                <StatusBadge status={committee.status || 'active'} />
              </div>
            </div>
            <div>
              <p className="text-xs text-[#7B8983] dark:text-surface-muted">Created</p>
              <p className="text-[13px] text-[#18231E] dark:text-surface-text">{formatDate(committee.createdAt)}</p>
            </div>
          </div>
        </Card>
      )}

      {tab === 'members' && (
        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-3">Members</h2>
          <Table
            columns={memberColumns}
            data={Array.isArray(committee.members) ? (committee.members as Member[]) : []}
            emptyMessage="No members assigned"
          />
        </Card>
      )}

      {tab === 'meetings' && (
        <Card>
          <h2 className="text-[13.5px] font-bold text-[#18231E] dark:text-surface-text mb-3">Recent Meetings</h2>
          {meetings.length === 0 ? (
            <EmptyState title="No meetings yet" description="Meetings scheduled for this committee will appear here." />
          ) : (
            <div className="space-y-2">
              {meetings.slice(0, 5).map((meeting: any, index: number) => (
                <div key={meeting.id || index} className="p-3 border border-line dark:border-surface-border rounded-xl">
                  <p className="text-[13px] font-semibold text-[#18231E] dark:text-surface-text">{meeting.title || 'Meeting'}</p>
                  {meeting.date && (
                    <p className="text-xs text-[#7B8983] dark:text-surface-muted">{formatDate(meeting.date)}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
