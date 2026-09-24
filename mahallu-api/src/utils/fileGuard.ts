/**
 * What an uploaded file actually is, and what its name is safe to be.
 *
 * `file.mimetype` is the `Content-Type` the client wrote on the multipart part.
 * It is a claim, not a fact: `curl -F "image=@shell.html;type=image/png"` passes
 * a MIME allowlist untouched. The bytes are the only thing that cannot be
 * forged, so `detectContentType` reads the file's own signature and the callers
 * compare that against what they accept.
 *
 * `safeFileName` is the other half. `originalname` is attacker-controlled text
 * that this product stores on the document record and later renders in the CMS
 * and the app — so a name is stripped of path separators, control characters
 * and markup, and capped at a length a filename actually is.
 */

/** A real content type, read from the file's own leading bytes. */
export type DetectedType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' | 'application/pdf';

const startsWith = (buffer: Buffer, bytes: number[], offset = 0): boolean =>
  buffer.length >= offset + bytes.length &&
  bytes.every((byte, index) => buffer[offset + index] === byte);

/**
 * The type the bytes say it is, or `null` when the signature matches nothing we
 * accept. A `null` here is the answer for an empty file, a truncated one, and a
 * `.exe` renamed to `.png` alike — all three are "not a file we take".
 */
export const detectContentType = (buffer: Buffer): DetectedType | null => {
  if (!buffer || buffer.length < 12) return null;

  // JPEG: FF D8 FF
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';

  // GIF: "GIF87a" or "GIF89a"
  if (buffer.subarray(0, 6).toString('latin1').match(/^GIF8[79]a$/)) return 'image/gif';

  // WebP: "RIFF" .... "WEBP"
  if (
    buffer.subarray(0, 4).toString('latin1') === 'RIFF' &&
    buffer.subarray(8, 12).toString('latin1') === 'WEBP'
  ) {
    return 'image/webp';
  }

  // PDF: "%PDF-"
  if (buffer.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';

  return null;
};

/**
 * A filename safe to store and to show.
 *
 * Drops every path separator — so `../../etc/passwd` becomes `passwd` — along
 * with control characters and the characters that would let a name act as
 * markup wherever it is rendered. The extension is kept when there is one,
 * because it is what tells a person which file they attached.
 */
export const safeFileName = (original: unknown, fallback = 'upload'): string => {
  if (typeof original !== 'string') return fallback;

  const base = original
    .split(/[\\/]/)
    .pop()!                       // last path segment only
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f\x7f]/g, '')             // control characters
    .replace(/[<>:"|?*]/g, '')
    .replace(/^\.+/, '')          // no leading dots: never a hidden file
    .trim();

  if (!base) return fallback;

  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return base.slice(0, 120);

  // Keep the extension intact while trimming a very long stem.
  const stem = base.slice(0, dot).slice(0, 100);
  const ext = base.slice(dot).slice(0, 20);
  return stem + ext;
};
