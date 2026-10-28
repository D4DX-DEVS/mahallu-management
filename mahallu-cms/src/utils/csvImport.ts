/*
 * Pure helpers behind the CSV import dialog (components/BulkImportCsv.tsx): reading a CSV file into rows, and
 * turning a refused import's response into lines a person can act on.
 *
 * No React, no imports of its own, so it can be tested directly with `node --test`.
 */

export interface ColumnSpec {
  key: string;
  label: string;
  required?: boolean;
  /**
   * Cleans a non-empty cell, or refuses it with a message that names what is wrong. A refused cell fails
   * its row before anything is sent.
   */
  normalize?: (value: string) => { value: string } | { error: string };
}

/** The most rows one import may carry (the API enforces the same limit). */
export const MAX_IMPORT_ROWS = 500;

/** How many of the server's row errors the dialog lists before summarising the rest as "+N more". */
export const MAX_ROW_ERRORS_SHOWN = 10;

/** Minimal CSV line parser — handles quoted fields with commas. */
export function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      cells.push(cur.trim());
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur.trim());
  return cells;
}

export interface ParseResult {
  rows: Record<string, string>[];
  errors: string[];
}

/** Rows are numbered the way a spreadsheet shows them: the header is row 1, the first record row 2. */
export function parseCsv(text: string, columns: ColumnSpec[]): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ['File needs a header row and at least one data row'] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const colIndex = (name: string) => header.indexOf(name);

  // Check required columns
  const missingColumns = columns
    .filter((c) => c.required)
    .filter((c) => colIndex(c.key.toLowerCase()) === -1);

  if (missingColumns.length > 0) {
    return {
      rows: [],
      errors: [`Missing required columns: ${missingColumns.map((c) => c.label).join(', ')}`],
    };
  }

  const rows: Record<string, string>[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, i) => {
    const cells = parseCsvLine(line);
    const row: Record<string, string> = {};
    const cellErrors: string[] = [];
    let hasData = false;

    columns.forEach((col) => {
      const idx = colIndex(col.key.toLowerCase());
      const value = idx >= 0 ? cells[idx] : '';
      if (value) {
        hasData = true;
        const cleaned = col.normalize ? col.normalize(value) : { value };
        if ('error' in cleaned) cellErrors.push(cleaned.error);
        else row[col.key] = cleaned.value;
      }
    });

    if (!hasData) {
      errors.push(`Row ${i + 2}: is empty`);
      return;
    }

    if (cellErrors.length > 0) {
      errors.push(`Row ${i + 2}: ${cellErrors.join(' ')}`);
      return;
    }

    // Check required fields
    const missingRequired = columns.filter((c) => c.required && !row[c.key]);
    if (missingRequired.length > 0) {
      errors.push(
        `Row ${i + 2}: missing required field(s) ${missingRequired.map((c) => c.label).join(', ')}`
      );
      return;
    }

    rows.push(row);
  });

  if (rows.length > MAX_IMPORT_ROWS) {
    errors.push(`Maximum ${MAX_IMPORT_ROWS} rows per import (found ${rows.length})`);
  }

  return { rows, errors };
}

/* ---- What the server says when it refuses an import ------------------------------------------------------
 * A refused import answers 400 with `{ message, errors: [{ row, message }] }`, where `row` counts the submitted
 * records from 1. Nothing is saved when any row is refused. */

export interface RowError {
  row: number;
  message: string;
}

/** Longest server sentence shown. */
const MAX_MESSAGE_LENGTH = 160;

/**
 * A server sentence that is safe to put in front of a person: short, plain text, no developer vocabulary or
 * object/stack syntax. This is the same rule as `safeApiMessage` in utils/errors.ts, plus one stricter check:
 * control characters (newlines, tabs) are refused too, so a message stays on one line of the dialog's list.
 * The rule is repeated here (not imported) so this file stays free of imports; tests/csvImport.test.ts compares
 * the two on a shared set of messages, so they cannot drift apart unnoticed.
 */
const isShowable = (message: unknown): message is string => {
  if (typeof message !== 'string') return false;
  const text = message.trim();
  if (text.length === 0 || text.length > MAX_MESSAGE_LENGTH) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(text)) return false;
  return !/(cast to|objectid|validationerror|econnrefused|enotfound|mongo|prisma|undefined|null|\bat\s+\w+\.\w+|[{}[\]<>]|https?:\/\/|\bError:)/i.test(
    text
  );
};

/**
 * The usable `{ row, message }` entries of a failed import's response, in row order. An entry is skipped when
 * it is not an object, its `row` is not a whole number from 1 to the import limit, or its message is missing
 * or not fit to show. Anything else in the payload (a missing or non-array `errors`, a different shape) yields
 * an empty list.
 */
export function extractRowErrors(error: unknown): RowError[] {
  const list = (error as { response?: { data?: { errors?: unknown } } } | null | undefined)?.response?.data?.errors;
  if (!Array.isArray(list)) return [];

  const usable: RowError[] = [];
  for (const entry of list) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { row, message } = entry as { row?: unknown; message?: unknown };
    if (typeof row !== 'number' || !Number.isInteger(row) || row < 1 || row > MAX_IMPORT_ROWS) continue;
    if (!isShowable(message)) continue;
    usable.push({ row, message: message.trim() });
  }
  return usable.sort((a, b) => a.row - b.row);
}

/** "Row 3: Please enter the house name." The server counts records from 1; our own messages count the header as row 1. */
export const formatRowError = ({ row, message }: RowError): string => `Row ${row + 1}: ${message}`;

/**
 * Lines for the dialog: up to `max` row errors, then "+N more" when there are further ones. Empty when the
 * response carries no usable row errors, so the caller can fall back to its general message.
 */
export function formatServerRowErrors(error: unknown, max: number = MAX_ROW_ERRORS_SHOWN): string[] {
  const rows = extractRowErrors(error);
  if (rows.length === 0) return [];
  const limit = Math.max(0, Math.floor(max));
  const lines = rows.slice(0, limit).map(formatRowError);
  const rest = rows.length - lines.length;
  return rest > 0 ? [...lines, `+${rest} more`] : lines;
}
