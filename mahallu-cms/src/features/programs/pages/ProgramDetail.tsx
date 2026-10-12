import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft } from 'react-icons/fi';
import PageHeader from '@/components/ui/PageHeader';
import Avatar, { PersonCell } from '@/components/ui/Avatar';
import StatusBadge from '@/components/ui/StatusBadge';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';
import { formatDate } from '@/utils/format';
import ProgramRegistrations from '../components/ProgramRegistrations';
import { getFriendlyError } from '@/utils/apiMessages';

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<Institute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchProgram();
    }
  }, [id]);

  const fetchProgram = async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await programService.getById(id);
      setProgram(data);
    } catch (err: any) {
      setError(getFriendlyError(err, "Couldn't load program. Refresh the page or try again."));
      console.error('Error fetching program:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !program) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 dark:text-red-400">{error || 'Program not found'}</p>
        <Link to={ROUTES.PROGRAMS.LIST} className="mt-4 inline-block">
          <Button variant="secondary">Back to Programs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={program.name}
        leading={<Avatar size={56} name={program.name} />}
        description="Program Details"
        actions={
          <>
            <Link to={ROUTES.PROGRAMS.LIST}>
              <Button variant="secondary">
                <FiArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </Link>
            <Link to={`/programs/${program.id}/edit`}>
              <Button>
                <FiEdit2 className="h-3.5 w-3.5" />
                Edit
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Name</label>
              <div className="mt-0.5"><PersonCell name={program.name} size={24} /></div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Place</label>
              <p className="mt-1 text-[#18231E] dark:text-surface-text">{program.place}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Join Date</label>
              <p className="mt-1 text-[#18231E] dark:text-surface-text">{formatDate(program.joinDate)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Status</label>
              <p className="mt-1">
                <StatusBadge status={program.status || 'active'} />
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Contact Information</h2>
          <div className="space-y-4">
            {program.contactNo && (
              <div>
                <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Contact No.</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">{program.contactNo}</p>
              </div>
            )}
            {program.email && (
              <div>
                <label className="text-sm font-medium text-[#7B8983] dark:text-surface-muted">Email</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">{program.email}</p>
              </div>
            )}
          </div>
        </Card>

        {program.description && (
          <Card className="md:col-span-2">
            <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Description</h2>
            <p className="text-[#3A4741] dark:text-surface-text">{program.description}</p>
          </Card>
        )}

        {/* Event details (Task C3) — only meaningful once a program is run as an event */}
        {(program.eventDate || program.competitions?.length || program.awards) && (
          <Card className="md:col-span-2">
            <h2 className="text-[13.5px] font-bold mb-3 text-[#18231E] dark:text-surface-text">Event</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-xs sm:text-sm font-medium text-[#7B8983] dark:text-surface-muted">Event Date</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">
                  {program.eventDate ? formatDate(program.eventDate) : '—'}
                </p>
              </div>
              <div>
                <label className="text-xs sm:text-sm font-medium text-[#7B8983] dark:text-surface-muted">Awards</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">{program.awards || '—'}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-xs sm:text-sm font-medium text-[#7B8983] dark:text-surface-muted">Competitions</label>
                <p className="mt-1 text-[#18231E] dark:text-surface-text">
                  {program.competitions?.length
                    ? program.competitions
                        .map((c) => `${c.name}${c.winners?.length ? ` (${c.winners.join(', ')})` : ''}`)
                        .join('; ')
                    : '—'}
                </p>
              </div>
            </div>
          </Card>
        )}

        <div className="md:col-span-2">
          <ProgramRegistrations programId={program.id} />
        </div>
      </div>
    </div>
  );
}

