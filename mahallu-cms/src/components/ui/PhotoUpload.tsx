/**
 * PhotoUpload - circle preview + "Add photo" / "Change" / "Remove" for a person's photo.
 * Controlled: it only edits a URL string; the form stores it as `photoUrl`.
 *
 * Usage (react-hook-form)
 *   <PhotoUpload name={v.name} value={v.photoUrl} onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })} />
 *
 * Props: value (current url or ''), onChange(url) ('' when removed), name (for the initials
 * placeholder), disabled, size (default 72), className.
 * Checks on the client: JPEG / PNG / WebP / GIF only and <= 2 MB, before anything is sent.
 * Uploads through POST /api/upload/profile-photo (uploadService); shows the picked file
 * instantly as a local preview while uploading. With no photo it shows the placeholder.
 */
import { useEffect, useRef, useState } from 'react';
import { FiCamera, FiTrash2 } from 'react-icons/fi';
import { uploadService } from '@/services/uploadService';
import Button from './Button';
import { cn } from '@/utils/cn';
import { getFriendlyError } from '@/utils/apiMessages';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_BYTES = 2 * 1024 * 1024;

export interface PhotoUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  name?: string | null;
  disabled?: boolean;
  size?: number;
  className?: string;
}

export default function PhotoUpload({ value, onChange, name, disabled, size = 72, className }: PhotoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [value]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const shown = preview || (!broken && value) || null;
  const initials = (name || '').trim().split(/\s+/).filter(Boolean).map((w) => Array.from(w)[0]).slice(0, 2).join('').toUpperCase();

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (!TYPES.includes(file.type)) return setError('Use a JPEG, PNG, WebP or GIF image.');
    if (file.size > MAX_BYTES) return setError('Photo must be 2 MB or smaller.');
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const url = await uploadService.uploadProfilePhoto(file);
      onChange(url);
    } catch (e: any) {
      setError(getFriendlyError(e, "We couldn't upload the photo. Please try again."));
    } finally {
      setBusy(false);
      setPreview(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className={cn('flex items-center gap-4', className)}>
      <span
        style={{ width: size, height: size }}
        className="relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#E7F1EC] text-[#0B4837] ring-1 ring-line dark:bg-brand-lime/15 dark:text-brand-lime dark:ring-surface-border"
      >
        {shown ? (
          <img src={shown} alt={name ? `Photo of ${name}` : 'Profile photo'} onError={() => setBroken(true)} className="h-full w-full object-cover" />
        ) : initials ? (
          <span className="text-lg font-extrabold" aria-hidden="true">{initials}</span>
        ) : (
          <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
        )}
        {busy && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-[10px] font-bold text-[#0B4837] dark:bg-black/50 dark:text-white">Uploading</span>}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={disabled || busy} onClick={() => inputRef.current?.click()}>
            <FiCamera className="h-3.5 w-3.5" />
            {value ? 'Change' : 'Add photo'}
          </Button>
          {value && (
            <Button type="button" size="sm" variant="ghost" disabled={disabled || busy} onClick={() => { setError(null); onChange(''); }}>
              <FiTrash2 className="h-3.5 w-3.5" />
              Remove
            </Button>
          )}
        </div>
        <p className={cn('mt-1.5 text-xs', error ? 'text-[#B3261E] dark:text-red-300' : 'text-[#7B8983] dark:text-surface-muted')} role={error ? 'alert' : undefined}>
          {error || 'Optional. JPEG, PNG, WebP or GIF, up to 2 MB.'}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={TYPES.join(',')}
          className="sr-only"
          tabIndex={-1}
          aria-label="Choose photo"
          onChange={(e) => pick(e.target.files?.[0])}
        />
      </div>
    </div>
  );
}
