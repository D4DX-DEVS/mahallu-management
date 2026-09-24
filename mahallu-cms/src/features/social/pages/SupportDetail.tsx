import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiSave } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Select from '@/components/ui/Select';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { ROUTES } from '@/constants/routes';
import { socialService, Support } from '@/services/socialService';
import { formatDate } from '@/utils/format';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';
import { loadErrorMessage } from '@/utils/errors';
import { toTitleCase } from '@/utils/format';

export default function SupportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState<Support | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('open');
  const [priority, setPriority] = useState<string>('medium');
  const [response, setResponse] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchTicket(id);
  }, [id]);

  const fetchTicket = async (ticketId: string) => {
    try {
      setLoading(true);
      setError(null);
      const data = await socialService.getSupportById(ticketId);
      setTicket(data);
      setStatus(data.status || 'open');
      setPriority(data.priority || 'medium');
      setResponse(data.response || '');
    } catch (err: any) {
      setError(loadErrorMessage(err, 'support ticket'));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!id) return;
    try {
      setSaving(true);
      await socialService.updateSupport(id, {
        status: status as Support['status'],
        priority: priority as Support['priority'],
        response,
      });
      toast.success('Support ticket updated');
      await fetchTicket(id);
    } catch (err: any) {
      toast.error(errorMessage(err, { action: 'update support ticket' }));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton variant="section" />;

  if (error || !ticket) {
    return (
      <Card>
        <div className="py-8 text-center">
          <p className="text-red-600 dark:text-red-400">{error || 'Support ticket not found'}</p>
          <Button onClick={() => navigate(ROUTES.SOCIAL.SUPPORT)} className="mt-4" variant="outline">
            Back to Support
          </Button>
        </div>
      </Card>
    );
  }

  const requesterName = typeof ticket.userId === 'object' ? ticket.userId?.name : ticket.userName;

  return (
    <div className="space-y-4">
      <PageHeader
        title={ticket.subject}
        description={`${requesterName ? `From ${toTitleCase(requesterName)} · ` : ''}${formatDate(ticket.createdAt)}`}
        breadcrumbs={[{ label: 'Support', path: ROUTES.SOCIAL.SUPPORT }]}
      />

      <Card className="space-y-4">
        <div>
          <label className="text-label text-gray-500 uppercase block mb-2">Message</label>
          <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{ticket.message}</p>
        </div>
      </Card>

      <Card className="space-y-4">
        <h2 className="text-lg font-semibold text-foreground">Respond</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            label="Status"
            options={[
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ]}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          />
          <Select
            label="Priority"
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
            ]}
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Response</label>
          <textarea
            aria-label="Response"
            value={response}
            onChange={(e) => setResponse(e.target.value)}
            placeholder="Write a response for this ticket..."
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="outline" onClick={() => navigate(ROUTES.SOCIAL.SUPPORT)}>
            Back
          </Button>
          <Button onClick={handleSave} isLoading={saving}>
            <FiSave className="h-4 w-4 mr-2" />
            Save
          </Button>
        </div>
      </Card>
    </div>
  );
}
