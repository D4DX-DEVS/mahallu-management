import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { FiEdit2, FiArrowLeft } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';
import { formatDate } from '@/utils/format';
import ProgramRegistrations from '../components/ProgramRegistrations';
import { loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

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
      setError(loadErrorMessage(err, 'program'));
      console.error('Error fetching program:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <PageSkeleton />;
  }

  if (error || !program) {
    return (
      <div className="text-center py-10">
        <p className="text-red-600 dark:text-red-400">{error || 'Program not found'}</p>
        <Link to={ROUTES.PROGRAMS.LIST} className="mt-4 inline-block">
          <Button variant="outline">Back to Programs</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center justify-between">
        <div className="flex items-center gap-4">
          <PageHeader
            description="Program Details"
            title={program.name}
            breadcrumbs={[{ label: 'Programs', path: ROUTES.PROGRAMS.LIST }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.PROGRAMS.LIST}>
              <Button variant="outline" icon={<FiArrowLeft />} collapseLabel>Back</Button>
            </Link>
            <Link to={`/programs/${program.id}/edit`}>
              <Button icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100 capitalize">{program.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Place</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{program.place}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Join Date</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(program.joinDate)}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Status</label>
              <p className="mt-1">
                <span
                  className={`px-2 py-1 text-xs font-medium rounded-full ${
                    program.status === 'active'
                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {program.status || 'active'}
                </span>
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Contact Information</h2>
          <div className="space-y-4">
            {program.contactNo && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Contact No.</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{program.contactNo}</p>
              </div>
            )}
            {program.email && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Email</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{program.email}</p>
              </div>
            )}
          </div>
        </Card>

        {program.description && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-3 text-foreground">Description</h2>
            <p className="text-gray-700 dark:text-gray-300">{program.description}</p>
          </Card>
        )}

        {/* Event details (Task C3) — only meaningful once a program is run as an event */}
        {(program.eventDate || program.competitions?.length || program.awards) && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-3 text-foreground">Event</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-label sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                  Event Date
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
                  {program.eventDate ? formatDate(program.eventDate) : '—'}
                </p>
              </div>
              <div>
                <label className="text-label sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                  Awards
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">{program.awards || '—'}</p>
              </div>
              <div className="col-span-2 md:col-span-1">
                <label className="text-label sm:text-sm font-medium text-gray-500 dark:text-gray-400">
                  Competitions
                </label>
                <p className="mt-1 text-gray-900 dark:text-gray-100">
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
