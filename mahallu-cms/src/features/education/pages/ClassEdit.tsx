import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import { madrasaService, MadrasaClass } from '@/services/madrasaService';
import ClassForm from '../components/ClassForm';

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
      .catch((err: any) => setError(err.response?.data?.message || 'Failed to load the class'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner />;

  if (error || !cls) {
    return (
      <Card>
        <p className="text-sm text-red-600 dark:text-red-400">{error || 'Class not found'}</p>
        <Button className="mt-3" variant="secondary" onClick={() => navigate('/education')}>
          Back to classes
        </Button>
      </Card>
    );
  }

  return <ClassForm existing={cls} />;
}
