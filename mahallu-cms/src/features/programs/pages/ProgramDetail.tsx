import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { FiEdit2, FiArrowLeft, FiTrash2 } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageSkeleton } from '@/components/ui/Skeleton';
import Modal from '@/components/ui/Modal';
import { Institute } from '@/types';
import { ROUTES } from '@/constants/routes';
import { programService } from '@/services/programService';
import { formatDate, toTitleCase } from '@/utils/format';
import ProgramRegistrations from '../components/ProgramRegistrations';
import { errorMessage, loadErrorMessage } from '@/utils/errors';
import PageHeader from '@/components/layout/PageHeader';

export default function ProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Institute | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

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

  const handleDelete = async () => {
    if (!id) return;
    try {
      setDeleting(true);
      await programService.delete(id);
      navigate(ROUTES.PROGRAMS.LIST);
    } catch (err: any) {
      setError(errorMessage(err, { action: 'delete program' }));
      setDeleting(false);
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
            title={toTitleCase(program.name)}
            breadcrumbs={[{ label: 'Programs', path: ROUTES.PROGRAMS.LIST }]}
          />
          <div className="flex gap-2 items-center">
            <Link to={ROUTES.PROGRAMS.LIST}>
              <Button variant="outline" icon={<FiArrowLeft />} collapseLabel>Back</Button>
            </Link>
            <Link to={`/programs/${program.id}/edit`}>
              <Button icon={<FiEdit2 />} collapseLabel>Edit</Button>
            </Link>
            <Button variant="danger" onClick={() => setShowDeleteModal(true)} icon={<FiTrash2 />} collapseLabel>Delete</Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <h2 className="text-lg font-semibold mb-3 text-foreground">Basic Information</h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(program.name)}</p>
            </div>
            {program.nameMl && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Name (Malayalam)</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-malayalam">{program.nameMl}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Place</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{toTitleCase(program.place)}</p>
            </div>
            {program.placeMl && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Place (Malayalam)</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 font-malayalam">{program.placeMl}</p>
              </div>
            )}
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Join Date</label>
              <p className="mt-1 text-gray-900 dark:text-gray-100">{formatDate(program.joinDate)}</p>
            </div>
            {program.audience && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Audience</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 capitalize">{program.audience}</p>
              </div>
            )}
            {program.programType && (
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Program Type</label>
                <p className="mt-1 text-gray-900 dark:text-gray-100 capitalize">
                  {program.programType.replace(/_/g, ' ')}
                </p>
              </div>
            )}
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

        {(program.address?.state ||
          program.address?.district ||
          program.address?.pinCode ||
          program.address?.postOffice) && (
          <Card className="md:col-span-2">
            <h2 className="text-lg font-semibold mb-3 text-foreground">Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              {program.address?.state && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">State</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{program.address.state}</p>
                </div>
              )}
              {program.address?.district && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">District</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{program.address.district}</p>
                </div>
              )}
              {program.address?.pinCode && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">PIN Code</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{program.address.pinCode}</p>
                </div>
              )}
              {program.address?.postOffice && (
                <div>
                  <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Post Office</label>
                  <p className="mt-1 text-gray-900 dark:text-gray-100">{program.address.postOffice}</p>
                </div>
              )}
            </div>
          </Card>
        )}

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
                        .map(
                          (c) =>
                            `${toTitleCase(c.name)}${c.winners?.length ? ` (${c.winners.map((w) => toTitleCase(w)).join(', ')})` : ''}`
                        )
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

      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Delete Program"
        footer={
          <>
            <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} isLoading={deleting}>
              Delete
            </Button>
          </>
        }
      >
        <p className="text-gray-600 dark:text-gray-400">
          Are you sure you want to delete <strong>{toTitleCase(program.name)}</strong>? This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
