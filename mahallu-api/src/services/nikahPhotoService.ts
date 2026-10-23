import type { ClientSession } from 'mongoose';
import DocumentFile from '../models/DocumentFile';
import { discardPrivateObject, reportOrphanedObject } from './uploadService';

/**
 * The groom's and bride's photos on a Nikah registration.
 *
 * They are ordinary private documents (models/DocumentFile, uploaded through POST /documents/upload and
 * read back through short-lived signed URLs), referenced from the registration by id. The registration
 * never holds image bytes or a storage key. This module is the one place that decides whether a
 * document may be used as such a photo, ties it to the registration, and removes the file again when it
 * is replaced or removed.
 */

/** What a person photo may be: the image types the upload endpoint recognises by their bytes. */
export const PHOTO_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
/** The CMS compresses before uploading, so a real photo is far below this; it is the hard server cap. */
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

export const isPhotoMime = (mime: unknown): boolean => (PHOTO_MIME_TYPES as readonly string[]).includes(String(mime));

export type PhotoField = 'groomPhotoId' | 'bridePhotoId';
export const PHOTO_FIELDS: readonly PhotoField[] = ['groomPhotoId', 'bridePhotoId'];

export interface PhotoProblem {
  status: number;
  message: string;
}

interface Caller {
  userId: unknown;
  isSuperAdmin: boolean;
}

const LABEL: Record<PhotoField, string> = { groomPhotoId: "groom's photo", bridePhotoId: "bride's photo" };

/**
 * Whether every photo id in `requested` may be used. `requested` holds only the fields the request
 * actually sets to an id (a removal or an absent field is not checked). A photo must be:
 *  - a document of this Mahallu, uploaded as a nikah photo, an image of an accepted type and size;
 *  - uploaded by the caller (a Super Admin may use any upload of the Mahallu);
 *  - not attached to a different record, and not used for both people.
 */
export const findPhotoProblem = async (
  tenantId: string,
  caller: Caller,
  requested: Partial<Record<PhotoField, string>>,
  registrationId?: unknown
): Promise<PhotoProblem | null> => {
  const entries = Object.entries(requested) as Array<[PhotoField, string]>;
  if (entries.length === 2 && String(entries[0][1]) === String(entries[1][1])) {
    return { status: 400, message: "Please use a different photo for the groom and the bride." };
  }

  for (const [field, id] of entries) {
    const doc = await DocumentFile.findOne({ _id: id, tenantId });
    if (!doc) return { status: 404, message: `We couldn't find the ${LABEL[field]}. Please choose it again.` };

    if (doc.documentType !== 'photo' || doc.ownerType !== 'nikah') {
      return { status: 400, message: `That file can't be used as the ${LABEL[field]}.` };
    }
    if (!isPhotoMime(doc.mimeType)) {
      return { status: 400, message: `The ${LABEL[field]} must be a JPEG, PNG or WebP image.` };
    }
    if (doc.size > PHOTO_MAX_BYTES) {
      return { status: 400, message: `The ${LABEL[field]} is too large. Please choose a smaller image.` };
    }
    if (!caller.isSuperAdmin && String(doc.uploadedByUserId) !== String(caller.userId)) {
      return { status: 404, message: `We couldn't find the ${LABEL[field]}. Please choose it again.` };
    }
    if (doc.ownerId && String(doc.ownerId) !== String(registrationId ?? '')) {
      return { status: 409, message: `The ${LABEL[field]} is already used by another record.` };
    }
  }
  return null;
};

/** Tie the photos to the registration, so they are no longer "unattached uploads". */
export const attachPhotos = async (registrationId: unknown, ids: string[], session?: ClientSession): Promise<void> => {
  if (ids.length === 0) return;
  await DocumentFile.updateMany({ _id: { $in: ids } }, { $set: { ownerId: registrationId } }, session ? { session } : {});
};

/** Hand a photo back to "unattached" (undo of attachPhotos). */
export const detachPhotos = async (registrationId: unknown, ids: string[]): Promise<void> => {
  if (ids.length === 0) return;
  await DocumentFile.updateMany({ _id: { $in: ids }, ownerId: registrationId }, { $unset: { ownerId: 1 } });
};

/**
 * Remove a photo that is no longer used: the record first (so the storage guard sees nothing pointing at
 * the file), then the object. Never throws; a file that could not be removed is reported for an
 * operator instead of being left silently behind.
 */
export const removePhoto = async (id: unknown, tenantId: unknown): Promise<void> => {
  try {
    const doc = await DocumentFile.findOne({ _id: id, tenantId });
    if (!doc) return;
    const { fileKey } = doc;
    await DocumentFile.deleteOne({ _id: doc._id });
    const outcome = await discardPrivateObject(fileKey);
    if (outcome !== 'deleted' && outcome !== 'kept-referenced') {
      reportOrphanedObject(fileKey, `nikah-photo-removed:${outcome}`, { tenantId });
    }
  } catch (error: any) {
    console.error('[nikah-photo] could not remove a replaced photo:', error?.name || 'error');
  }
};
