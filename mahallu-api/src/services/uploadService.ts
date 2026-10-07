import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import Certificate from '../models/Certificate';
import DocumentFile from '../models/DocumentFile';
import { reportReconciliationRequired } from '../utils/reconciliation';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const DOCUMENT_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

function getMissingSpacesVars(): string[] {
  const required = ['DO_SPACES_ENDPOINT', 'DO_SPACES_KEY', 'DO_SPACES_SECRET', 'DO_SPACES_BUCKET'];
  return required.filter((name) => !process.env[name]);
}

function normalizeEndpoint(endpoint: string): string {
  return endpoint.replace(/^https?:\/\//i, '').replace(/\/$/, '');
}

/** Minimal client surface the service needs; lets tests inject a fake so nothing touches the network. */
type StorageClient = { send: (command: any) => Promise<any> };
let injectedClient: StorageClient | null = null;

/** Test hook only: route every storage call through `client` (pass null to restore the real client). */
export function setStorageClientForTests(client: StorageClient | null): void {
  injectedClient = client;
}

function getS3Client(): S3Client {
  if (injectedClient) return injectedClient as unknown as S3Client;
  const missing = getMissingSpacesVars();
  if (missing.length > 0) {
    throw new Error(`Missing object storage env vars: ${missing.join(', ')}`);
  }

  const rawEndpoint = process.env.DO_SPACES_ENDPOINT as string;
  const endpoint = normalizeEndpoint(rawEndpoint);

  return new S3Client({
    endpoint: `https://${endpoint}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: process.env.DO_SPACES_KEY!,
      secretAccessKey: process.env.DO_SPACES_SECRET!,
    },
    forcePathStyle: false,
    // DigitalOcean Spaces rejects AWS SDK v3's default CRC32 checksums — only send when required
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
}

export async function uploadFileToSpaces(
  file: Express.Multer.File,
  folderType: 'notifications' | 'banners' = 'notifications'
): Promise<string> {
  const missing = getMissingSpacesVars();
  if (missing.length > 0) {
    throw new Error(`Missing object storage env vars: ${missing.join(', ')}`);
  }

  const s3 = getS3Client();

  const folder = process.env.DO_SPACES_FOLDER || 'uploads';
  const ext = MIME_TO_EXT[file.mimetype] || 'bin';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;
  const key = `${folder}/${folderType}/${uniqueName}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
        ACL: 'public-read',
      })
    );
  } catch (error: any) {
    const storageError = error?.message || 'Unknown storage error';
    console.error('[Upload] Spaces upload failed:', storageError);
    throw new Error(`Failed to upload image to object storage: ${storageError}`);
  }

  const cdnEndpoint = process.env.DO_SPACES_CDN_ENDPOINT;
  if (cdnEndpoint) {
    return `${cdnEndpoint.replace(/\/$/, '')}/${key}`;
  }

  const endpoint = normalizeEndpoint(process.env.DO_SPACES_ENDPOINT as string);
  return `https://${process.env.DO_SPACES_BUCKET}.${endpoint}/${key}`;
}

export const DOCUMENT_ALLOWED_MIME_TYPES = Object.keys(DOCUMENT_MIME_TO_EXT);

/**
 * Uploads a sensitive document as a PRIVATE object and returns the storage key.
 * Access only via short-lived signed URLs — never a public URL.
 */
export async function uploadPrivateDocument(
  file: Express.Multer.File,
  subFolder: string,
  contentBuffer?: Buffer,
  contentType?: string
): Promise<string> {
  const s3 = getS3Client();

  const folder = process.env.DO_SPACES_FOLDER || 'uploads';
  const mime = contentType || file.mimetype;
  const ext = DOCUMENT_MIME_TO_EXT[mime] || 'bin';
  const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}.${ext}`;
  const key = `${folder}/documents/${subFolder}/${uniqueName}`;

  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: process.env.DO_SPACES_BUCKET!,
        Key: key,
        Body: contentBuffer || file.buffer,
        ContentType: mime,
        ACL: 'private',
      })
    );
  } catch (error: any) {
    const storageError = error?.message || 'Unknown storage error';
    console.error('[Upload] Private document upload failed:', storageError);
    throw new Error(`Failed to upload document to object storage: ${storageError}`);
  }

  return key;
}

/** Uploads a generated buffer (e.g. certificate PDF) as a private object. */
export async function uploadPrivateBuffer(buffer: Buffer, subFolder: string, contentType: string): Promise<string> {
  return uploadPrivateDocument({} as Express.Multer.File, subFolder, buffer, contentType);
}

/**
 * True only for a key this service could have generated for a private document:
 * `<folder>/documents/<sub>/<file>` with no empty, `.` or `..` segment, no backslash and no control
 * character. Anything else is never passed to the storage client.
 */
export function isDeletablePrivateKey(key: unknown): key is string {
  if (typeof key !== 'string') return false;
  const prefix = `${process.env.DO_SPACES_FOLDER || 'uploads'}/documents/`;
  if (key.length <= prefix.length || key.length > 1024 || !key.startsWith(prefix)) return false;
  if (key.includes('..') || key.includes('\\') || /[\u0000-\u001f\u007f]/.test(key)) return false;
  return !key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..');
}

const isMissingObjectError = (error: any): boolean =>
  error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404;

/**
 * Removes a private object. Only keys under the private documents folder are accepted, so a bad key
 * can never delete anything else in the bucket. Idempotent (an object that is already gone counts as
 * removed) and it never throws: a failed clean-up must not mask the original error. Returns whether
 * the object is gone. The log line carries the error class only, never the message or credentials.
 *
 * This is the raw primitive: it does NOT check whether a database record still points at the key. Use
 * `discardPrivateObject` for the clean-up of an upload whose record could not be saved.
 */
export async function deletePrivateObject(key: string): Promise<boolean> {
  if (!isDeletablePrivateKey(key)) {
    console.error('[Upload] Refused to delete an object outside the private documents folder');
    return false;
  }
  try {
    await getS3Client().send(new DeleteObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET!, Key: key }));
    return true;
  } catch (error: any) {
    if (isMissingObjectError(error)) return true;
    console.error('[Upload] Could not remove a private object:', error?.name || 'storage error');
    return false;
  }
}

/** True when any record stores `key` as a private object key (certificates and uploaded documents). */
export async function isPrivateObjectReferenced(key: string): Promise<boolean> {
  const [certificate, document] = await Promise.all([
    Certificate.exists({ pdfKey: key }),
    DocumentFile.exists({ fileKey: key } as any),
  ]);
  return Boolean(certificate || document);
}

export type DiscardOutcome =
  | 'deleted'          // the object is gone (or was already gone)
  | 'kept-referenced'  // a record points at it: never deleted
  | 'refused'          // not a deletable private key
  | 'unverified'       // could not tell whether a record points at it: not deleted (fail closed)
  | 'failed';          // the storage delete failed: the object may still exist

/**
 * Clean-up of an object uploaded by the CURRENT request whose record could not be saved. Never throws.
 * The delete is skipped when any record references the key (the save may have succeeded even though
 * the caller saw an error, e.g. a timeout after commit), and when that cannot be checked.
 */
export async function discardPrivateObject(key: string): Promise<DiscardOutcome> {
  if (!isDeletablePrivateKey(key)) return 'refused';
  try {
    if (await isPrivateObjectReferenced(key)) return 'kept-referenced';
  } catch (error: any) {
    console.error('[Upload] Could not check whether a private object is still referenced:', error?.name || 'error');
    return 'unverified';
  }
  return (await deletePrivateObject(key)) ? 'deleted' : 'failed';
}

/**
 * Durable best-effort record of an object that may be left behind in storage, for an operator to
 * clean up: a structured log line `[ORPHAN OBJECT] {key, reason}` (the key only, no secrets) plus a
 * ReconciliationIssue (utils/reconciliation.ts; keyed by the file name, since the shared scrubber
 * redacts long path-like strings, so the full key is in the log line). Never throws and never waits.
 */
export function reportOrphanedObject(key: string, reason: string, context: { tenantId?: unknown } = {}): void {
  try {
    console.error('[ORPHAN OBJECT]', JSON.stringify({ key, reason }));
  } catch {
    /* logging must never throw */
  }
  try {
    const parts = String(key).split('/');
    const file = (parts[parts.length - 1] || '').replace(/\.[A-Za-z0-9]{1,5}$/, '');
    const documentsAt = parts.indexOf('documents');
    void Promise.resolve(
      reportReconciliationRequired({
        flow: 'private object cleanup',
        entity: 'PrivateObject',
        entityId: file,
        tenantId: context.tenantId,
        step: 'delete orphaned upload',
        reason,
        state: { folder: documentsAt >= 0 ? parts[documentsAt + 1] : null, file },
      })
    ).catch(() => undefined);
  } catch {
    /* the log line above is the record */
  }
}

/** Returns a short-lived signed download URL for a private object key. */
export async function getSignedDownloadUrl(key: string, expiresInSeconds = 300): Promise<string> {
  const s3 = getS3Client();
  // ponytail: cast — @smithy type identity differs between client-s3 and presigner versions, runtime-compatible
  return getSignedUrl(
    s3 as any,
    new GetObjectCommand({ Bucket: process.env.DO_SPACES_BUCKET!, Key: key }) as any,
    { expiresIn: expiresInSeconds }
  );
}
