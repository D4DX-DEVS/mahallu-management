import type { jsPDF } from 'jspdf';

/**
 * A Unicode font for generated PDFs.
 *
 * jsPDF's built-in fonts (Helvetica and friends) are WinAnsi-only and have no
 * glyph for the Indian Rupee sign, so "₹1,500" came out as mojibake. Noto Sans
 * (SIL OFL, see public/fonts/OFL.txt) has the glyph. The files in public/fonts
 * are subsets - Basic Latin, Latin-1, Latin Extended-A, general punctuation and
 * currency symbols - about 27 KB each, fetched the first time a PDF is made
 * rather than shipped in the main bundle.
 */
export const PDF_FONT_FAMILY = 'NotoSans';

const FONT_FILES = [
  { file: 'NotoSans-Regular.ttf', style: 'normal' },
  { file: 'NotoSans-Bold.ttf', style: 'bold' },
] as const;

type LoadedFont = { file: string; style: string; base64: string };

let fontsPromise: Promise<LoadedFont[]> | null = null;

const toBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const fetchFonts = (): Promise<LoadedFont[]> =>
  Promise.all(
    FONT_FILES.map(async ({ file, style }) => {
      const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`);
      if (!response.ok) throw new Error(`Could not load ${file} (${response.status})`);
      return { file, style, base64: toBase64(await response.arrayBuffer()) };
    })
  );

/**
 * Registers Noto Sans on `doc` and makes it the current font.
 * Resolves `true` when the font is in use, `false` when it could not be loaded
 * (offline, blocked) - the caller then has to avoid characters Helvetica lacks.
 */
export async function registerPdfFont(doc: jsPDF): Promise<boolean> {
  try {
    if (!fontsPromise) fontsPromise = fetchFonts();
    const fonts = await fontsPromise;
    for (const { file, style, base64 } of fonts) {
      doc.addFileToVFS(file, base64);
      // Identity-H is what makes jsPDF address glyphs by Unicode code point;
      // with the default WinAnsi encoding "₹" and even "é" are mis-mapped.
      doc.addFont(file, PDF_FONT_FAMILY, style, undefined, 'Identity-H');
    }
    doc.setFont(PDF_FONT_FAMILY, 'normal');
    return true;
  } catch (error) {
    // Do not cache the failure: the next export may be back online.
    fontsPromise = null;
    console.warn('PDF font unavailable, falling back to the built-in font:', error);
    return false;
  }
}
