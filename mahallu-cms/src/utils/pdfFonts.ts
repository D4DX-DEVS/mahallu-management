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
 *
 * KNOWN LIMITATION - MALAYALAM (and every other Indic script): the subset has
 * NO glyphs for U+0900-U+0DFF (verified by parsing the cmap: Malayalam block
 * 0/128, Devanagari 0/128). jsPDF drops code points the font lacks, so a
 * Malayalam name used to come out of the PDF as blank space with no warning.
 * No Malayalam-capable font is vendored in the repo or in node_modules, and
 * jsPDF cannot shape complex scripts (conjuncts, vowel-sign reordering) even
 * with one, so `toPdfSafeText` below replaces unsupported runs with a visible
 * "?" instead. See DEPLOYMENT.md ("PDF fonts and Malayalam") for the options.
 */
export const PDF_FONT_FAMILY = 'NotoSans';

/**
 * Code point ranges present in the bundled NotoSans-Regular/Bold subset
 * (read from the font cmap; keep in step with public/fonts if the subset is
 * regenerated). Inclusive [from, to].
 */
export const PDF_FONT_RANGES: ReadonlyArray<readonly [number, number]> = [
  [0x20, 0x7e], // Basic Latin
  [0xa0, 0x17f], // Latin-1 Supplement + Latin Extended-A
  [0x2010, 0x2027], // General punctuation (dashes, quotes, bullet, ellipsis)
  [0x2030, 0x203a], // per mille ... single guillemets
  [0x20a0, 0x20c0], // Currency symbols (includes U+20B9 INDIAN RUPEE SIGN)
  [0x2122, 0x2122], // trade mark
  [0x2212, 0x2212], // minus
];

/** True when the bundled PDF font has a glyph for this code point. */
export const isPdfGlyphSupported = (codePoint: number): boolean =>
  PDF_FONT_RANGES.some(([from, to]) => codePoint >= from && codePoint <= to);

// Control characters jsPDF/autoTable interpret themselves (line breaks, tabs).
const isLayoutControl = (codePoint: number) =>
  codePoint === 0x0a || codePoint === 0x0d || codePoint === 0x09;

/** True when `text` contains a character the bundled PDF font cannot draw. */
export const hasUnsupportedPdfChars = (text: string): boolean => {
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (!isLayoutControl(cp) && !isPdfGlyphSupported(cp)) return true;
  }
  return false;
};

/**
 * Replaces every run of characters the PDF font cannot draw (Malayalam, other
 * Indic scripts, emoji, ...) with a single "?" so missing data is visible
 * rather than silently blank. Supported text is returned unchanged.
 * A zero-width joiner/non-joiner that is not part of an unsupported run is
 * dropped (the font has no glyph for it). This is a stop-gap, not
 * transliteration: the original text is lost from the PDF.
 */
export const toPdfSafeText = (text: string): string => {
  if (!text) return text;
  let out = '';
  let inRun = false;
  for (const ch of text) {
    const cp = ch.codePointAt(0) as number;
    if (isLayoutControl(cp) || isPdfGlyphSupported(cp)) {
      out += ch;
      inRun = false;
    } else if (!inRun) {
      const joiner = cp === 0x200c || cp === 0x200d;
      if (!joiner) {
        out += '?';
        inRun = true;
      }
    }
  }
  return out;
};

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
