import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
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
  });
}

export async function uploadFileToSpaces(
  file: Express.Multer.File,
  folderType: 'notifications' | 'banners' | 'profiles' = 'notifications'
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
