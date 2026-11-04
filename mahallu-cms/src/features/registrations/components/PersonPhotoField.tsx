import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { FiCamera, FiTrash2, FiUser } from 'react-icons/fi';
import Button from '@/components/ui/Button';
import { documentService } from '@/services/documentService';
import { PHOTO_ACCEPT, PhotoError, preparePhoto } from '@/utils/imageCompression';
import type { PhotoValue } from '../nikahPhotos';

interface PersonPhotoFieldProps {
  /** "Groom" or "Bride": names the photo for sighted and screen-reader users alike. */
  person: string;
  /** The document id of the photo already stored on the registration, if any. */
  storedId?: string;
  value: PhotoValue;
  onChange: (value: PhotoValue) => void;
  /** 0-100 while this photo uploads on save. */
  uploadPercent?: number;
  disabled?: boolean;
}

/**
 * Choose, preview, replace or remove one person's photo.
 *
 * Picking a file checks it and shrinks it right away (so the preview is what will be uploaded); nothing
 * is sent until the form is saved. A stored photo is shown through a short-lived signed link, and stays
 * exactly as it is unless the person replaces or removes it.
 */
export default function PersonPhotoField({ person, storedId, value, onChange, uploadPercent, disabled }: PersonPhotoFieldProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [storedFailed, setStoredFailed] = useState(false);

  // Preview of the picture chosen but not yet saved.
  useEffect(() => {
    if (!value.file) {
      setPendingUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.file);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value.file]);

  // The photo already on the registration.
  useEffect(() => {
    setStoredUrl(null);
    setStoredFailed(false);
    if (!storedId) return;
    let cancelled = false;
    documentService
      .getUrl(storedId)
      .then((url) => !cancelled && setStoredUrl(url))
      .catch(() => !cancelled && setStoredFailed(true));
    return () => {
      cancelled = true;
    };
  }, [storedId]);

  const choose = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ''; // so choosing the same file again still fires
    if (!file) return;
    setError('');
    setPreparing(true);
    try {
      onChange({ file: await preparePhoto(file), removed: false });
    } catch (err) {
      setError(err instanceof PhotoError ? err.message : "We couldn't prepare that photo. Please try another.");
    } finally {
      setPreparing(false);
    }
  };

  const showsStored = !value.file && !value.removed && Boolean(storedId);
  const previewUrl = pendingUrl ?? (showsStored ? storedUrl : null);
  const hasPhoto = Boolean(value.file) || showsStored;
  const busy = disabled || preparing || uploadPercent !== undefined;

  return (
    <div className="min-w-0">
      <p className="mb-1.5 text-sm font-medium text-foreground">{person} Photo</p>
      <div className="flex items-center gap-4">
        <div
          className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-subtle text-muted-foreground"
          aria-live="polite"
        >
          {previewUrl ? (
            <img src={previewUrl} alt={`${person} photo preview`} className="h-full w-full object-cover" />
          ) : (
            <FiUser className="h-8 w-8" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0 space-y-2">
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={PHOTO_ACCEPT}
            className="sr-only"
            onChange={choose}
            disabled={busy}
            aria-label={`Choose ${person.toLowerCase()} photo`}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" icon={<FiCamera />} onClick={() => inputRef.current?.click()} disabled={busy}>
              {hasPhoto ? 'Replace photo' : 'Choose photo'}
            </Button>
            {hasPhoto && (
              <Button
                type="button"
                variant="outline"
                icon={<FiTrash2 />}
                onClick={() => onChange({ file: null, removed: Boolean(storedId) })}
                disabled={busy}
              >
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground" role="status">
            {preparing && 'Preparing photo…'}
            {!preparing && uploadPercent !== undefined && `Uploading… ${uploadPercent}%`}
            {!preparing && uploadPercent === undefined && value.file && 'New photo selected. It is saved with the registration.'}
            {!preparing && uploadPercent === undefined && !value.file && value.removed && 'The photo will be removed when you save.'}
            {!preparing && uploadPercent === undefined && showsStored && storedFailed && "The saved photo couldn't be loaded right now."}
            {!preparing && uploadPercent === undefined && !hasPhoto && !value.removed && 'JPEG, PNG or WebP. It is resized before upload.'}
          </p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
