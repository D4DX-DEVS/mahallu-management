/**
 * Choosing a photo in the browser: check what the file really is, then shrink it before it is uploaded.
 *
 * - The type is judged from the file's own first bytes, not its name or the browser-reported MIME type.
 * - The picture is decoded with its EXIF orientation applied, scaled so its longer side is at most
 *   `maxDimension` (never enlarged, aspect ratio kept) and re-encoded as JPEG. PNG/WebP transparency is
 *   flattened onto white.
 * - A phone photo of several MB typically becomes a few hundred KB. The server still enforces its own
 *   type and size limits: this only saves bandwidth and storage.
 */

export const PHOTO_ACCEPT = 'image/jpeg,image/png,image/webp';
/** The largest file a person may pick (before compression). */
export const PHOTO_PICK_MAX_BYTES = 15 * 1024 * 1024;
/** The server's hard cap for a stored photo; compression must get under it. */
export const PHOTO_STORE_MAX_BYTES = 5 * 1024 * 1024;
export const PHOTO_MAX_DIMENSION = 1280;
export const PHOTO_QUALITY = 0.8;

export class PhotoError extends Error {}

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  signature.every((byte, index) => bytes[offset + index] === byte);

/** 'image/jpeg' | 'image/png' | 'image/webp' from the leading bytes, or null for anything else. */
export const sniffImageType = (bytes: Uint8Array): 'image/jpeg' | 'image/png' | 'image/webp' | null => {
  if (bytes.length < 12) return null;
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return 'image/webp';
  return null;
};

/** The size an image of `width` x `height` is scaled to so its longer side is at most `max`. */
export const fitWithin = (width: number, height: number, max: number): { width: number; height: number } => {
  const longest = Math.max(width, height);
  if (longest <= max) return { width, height };
  const scale = max / longest;
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
};

const decode = async (file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> => {
  if (typeof createImageBitmap === 'function') {
    try {
      // 'from-image' applies the EXIF rotation, so a portrait phone photo is not drawn sideways.
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall back to an <img> element below */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, close: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    throw new PhotoError("We couldn't read that image. Please choose a different photo.");
  }
};

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));

/** Validate and compress a chosen photo. Throws PhotoError with a message fit to show the user. */
export async function preparePhoto(file: File): Promise<File> {
  if (file.size === 0) throw new PhotoError('That file is empty. Please choose a photo.');
  if (file.size > PHOTO_PICK_MAX_BYTES) throw new PhotoError('That photo is too large (over 15 MB). Please choose a smaller one.');

  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  if (!sniffImageType(head)) throw new PhotoError('Please choose a JPEG, PNG or WebP image.');

  const decoded = await decode(file);
  try {
    const { width, height } = fitWithin(decoded.width, decoded.height, PHOTO_MAX_DIMENSION);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new PhotoError("We couldn't process that image in this browser.");
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(decoded.source, 0, 0, width, height);

    let blob = await toBlob(canvas, PHOTO_QUALITY);
    // Very detailed pictures can still be big: step the quality down a little before giving up.
    for (const quality of [0.7, 0.6]) {
      if (blob && blob.size <= PHOTO_STORE_MAX_BYTES) break;
      blob = await toBlob(canvas, quality);
    }
    if (!blob || blob.size > PHOTO_STORE_MAX_BYTES) {
      throw new PhotoError('That photo is still too large after compression. Please choose a smaller one.');
    }
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    decoded.close();
  }
}
