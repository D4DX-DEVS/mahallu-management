import { documentService } from '@/services/documentService';
import { errorMessage } from '@/utils/errors';

/** What the form holds for one person's photo. `file` is the compressed, not-yet-uploaded picture. */
export interface PhotoValue {
  file: File | null;
  /** True when the person asked to remove the photo that is stored on the registration. */
  removed: boolean;
}

/** A photo upload failed; the message is already fit to show. */
export class PhotoUploadError extends Error {}

export const EMPTY_PHOTO: PhotoValue = { file: null, removed: false };

export type PersonKey = 'groom' | 'bride';
export type PhotoValues = Record<PersonKey, PhotoValue>;
export type PhotoProgress = Partial<Record<PersonKey, number>>;

export interface PhotoUploadResult {
  /** The photo fields to merge into the save request: an id for a new photo, null for a removal. */
  fields: { groomPhotoId?: string | null; bridePhotoId?: string | null };
  /** Ids uploaded by this call - to be discarded again if the save then fails. */
  uploaded: string[];
}

/**
 * Upload the photos the person picked, one after the other, and say what the save request should carry.
 *
 * A photo the person did not touch is left out of `fields` entirely, so editing a registration without
 * changing its photos keeps them. If one upload fails, any photo already uploaded by this call is
 * discarded and the error is thrown, so a failed attempt leaves nothing behind.
 */
export async function uploadPendingPhotos(
  values: PhotoValues,
  onProgress: (progress: PhotoProgress) => void
): Promise<PhotoUploadResult> {
  const fields: PhotoUploadResult['fields'] = {};
  const uploaded: string[] = [];
  const people: Array<[PersonKey, 'groomPhotoId' | 'bridePhotoId']> = [
    ['groom', 'groomPhotoId'],
    ['bride', 'bridePhotoId'],
  ];

  for (const [person, field] of people) {
    const value = values[person];
    if (value.file) {
      try {
        onProgress({ [person]: 0 });
        const doc = await documentService.uploadPersonPhoto(value.file, 'nikah', (percent) => onProgress({ [person]: percent }));
        uploaded.push(doc.id);
        fields[field] = doc.id;
      } catch (err) {
        await discardUploads(uploaded);
        throw new PhotoUploadError(errorMessage(err, { action: `upload the ${person} photo` }));
      } finally {
        onProgress({ [person]: undefined });
      }
    } else if (value.removed) {
      fields[field] = null;
    }
  }
  return { fields, uploaded };
}

/** Remove uploads that never became part of a saved registration. */
export const discardUploads = async (ids: string[]): Promise<void> => {
  await Promise.all(ids.map((id) => documentService.discard(id)));
};
