import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { madrasaService, MadrasaClass } from '@/services/madrasaService';
import ClassForm from '../components/ClassForm';
import { getFriendlyError } from '@/utils/apiMessages';

export default function ClassEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cls, setCls] = useState<MadrasaClass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    madrasaService
      .getClass(id)
      .then(setCls)
      .catch((err: any) => setError(getFriendlyError(err, "Couldn't load the class. Refresh the page or try again.")))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (error || !cls) {
    return (
      <Alert
        tone="danger"
        action={
          <Button variant="secondary" size="sm" onClick={() => navigate('/education')}>
            Back to classes
          </Button>
        }
      >
        {error || 'Class not found'}
      </Alert>
    );
  }

  return <ClassForm existing={cls} />;
}
