import { useEffect, useState } from 'react';
import { FiUser } from 'react-icons/fi';
import { documentService } from '@/services/documentService';

interface PersonPhotoViewProps {
  /** Document id stored on the registration; absent for registrations saved without a photo. */
  photoId?: string | null;
  person: string;
}

/** A saved photo shown through a short-lived signed link, or a neutral placeholder when there is none. */
export default function PersonPhotoView({ photoId, person }: PersonPhotoViewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUrl(null);
    setFailed(false);
    if (!photoId) return;
    let cancelled = false;
    documentService
      .getUrl(photoId)
      .then((signed) => !cancelled && setUrl(signed))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [photoId]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-subtle text-muted-foreground">
        {url ? <img src={url} alt={`${person} photo`} className="h-full w-full object-cover" /> : <FiUser className="h-8 w-8" aria-hidden="true" />}
      </div>
      <p className="text-sm text-muted-foreground">
        {!photoId && 'No photo added'}
        {photoId && !url && !failed && 'Loading photo…'}
        {photoId && failed && "The photo couldn't be loaded right now"}
      </p>
    </div>
  );
}
