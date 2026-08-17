import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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

function getS3Client(): S3Client {
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
