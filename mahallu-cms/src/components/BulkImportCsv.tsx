import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import { FiUpload } from 'react-icons/fi';
import { DuplicateMatchItem, parseDuplicateError } from '@/services/familyService';
import { getFriendlyError } from '@/utils/apiMessages';

export interface ColumnSpec {
  key: string;
  label: string;
  required?: boolean;
}

interface BulkImportCsvProps {
  title: string;
  columnSpec: ColumnSpec[];
  templateCsv: string;
  /** Pass `{ confirmDuplicate: true }` through to the API to import rows it flagged as possible duplicates. */
  onImport: (rows: any[], opts?: { confirmDuplicate?: boolean }) => Promise<{ imported: number }>;
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

/** Minimal CSV line parser — handles quoted fields with commas. */
function parseCsvLine(line: string): string[] {
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

interface ParseResult {
  rows: Record<string, any>[];
  /** Line number in the file for each parsed row (the header is line 1). */
  lines: number[];
  errors: string[];
}

function parseCsv(text: string, columns: ColumnSpec[]): ParseResult {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], lines: [], errors: ['File needs a header row and at least one data row'] };
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
      lines: [],
      errors: [
        `Missing required columns: ${missingColumns.map((c) => c.label).join(', ')}`,
      ],
    };
  }

  const rows: Record<string, any>[] = [];
  const rowLines: number[] = [];
  const errors: string[] = [];

  lines.slice(1).forEach((line, i) => {
    const cells = parseCsvLine(line);
    const row: Record<string, any> = {};
    let hasData = false;

    columns.forEach((col) => {
      const idx = colIndex(col.key.toLowerCase());
      const value = idx >= 0 ? cells[idx] : '';
      if (value) {
        row[col.key] = value;
        hasData = true;
      }
    });

    if (!hasData) {
      errors.push(`Row ${i + 2}: is empty`);
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
    rowLines.push(i + 2);
  });

  if (rows.length > 500) {
    errors.push(`Maximum 500 rows per import (found ${rows.length})`);
  }

  return { rows, lines: rowLines, errors };
}

export default function BulkImportCsv({
  title,
  columnSpec,
  templateCsv,
  onImport,
  isOpen,
  onClose,
  onImported,
}: BulkImportCsvProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string>('');
  const [lines, setLines] = useState<number[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateMatchItem[] | null>(null);

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
    setResult('');
    setLines([]);
    setDuplicates(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult('');
    setDuplicates(null);
    const reader = new FileReader();
    reader.onload = () => {
      const { rows: parsed, lines: parsedLines, errors: parseErrors } = parseCsv(
        String(reader.result || ''),
        columnSpec
      );
      setRows(parsed);
      setLines(parsedLines);
      setErrors(parseErrors);
    };
    reader.readAsText(file);
  };

  const finish = (imported: number) => {
    setResult(`Successfully imported ${imported} record${imported === 1 ? '' : 's'}`);
    setRows([]);
    setLines([]);
    setDuplicates(null);
    onImported();
  };

  const runImport = async (toSend: Record<string, any>[], confirmDuplicate = false) => {
    setImporting(true);
    setResult('');
    setErrors([]);
    try {
      const { imported } = await onImport(toSend, confirmDuplicate ? { confirmDuplicate: true } : undefined);
      finish(imported);
    } catch (err: unknown) {
      const dupes = parseDuplicateError(err);
      if (dupes) {
        setDuplicates(dupes);
        return;
      }
      const message = getFriendlyError(err, "Couldn't import the file. Check the file and try again.");
      setErrors([message]);
    } finally {
      setImporting(false);
    }
  };

  const handleImport = () => runImport(rows);

  /** Row numbers the API flagged (1-based position among the rows we sent). */
  const flaggedRows = new Set((duplicates || []).map((d) => d.row).filter((r): r is number => typeof r === 'number'));
  const fileLine = (row?: number) => (row ? lines[row - 1] ?? row + 1 : undefined);

  const skipDuplicates = async () => {
    const remaining = rows.filter((_, i) => !flaggedRows.has(i + 1));
    const keptLines = lines.filter((_, i) => !flaggedRows.has(i + 1));
    setRows(remaining);
    setLines(keptLines);
    setDuplicates(null);
    if (remaining.length === 0) {
      setResult('Nothing was imported: every row looked like a record that already exists.');
      return;
    }
    await runImport(remaining);
  };

  const downloadTemplate = () => {
    const blob = new Blob([templateCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const requiredCols = columnSpec.filter((c) => c.required).map((c) => c.label);
  const optionalCols = columnSpec.filter((c) => !c.required).map((c) => c.label);

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title={title}
    >
      <div className="space-y-4">
        <div className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          <p>
            <b>Required columns:</b> {requiredCols.join(', ')}
          </p>
          {optionalCols.length > 0 && (
            <p>
              <b>Optional columns:</b> {optionalCols.join(', ')}
            </p>
          )}
          <p className="mt-2">
            Max 500 records per import.{' '}
            <button
              type="button"
              onClick={downloadTemplate}
              className="font-semibold text-primary-600 underline dark:text-brand-lime"
            >
              Download template
            </button>
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-[13px] file:mr-3 file:cursor-pointer file:rounded-[10px] file:border-0 file:bg-mint file:px-3 file:py-2 file:text-xs file:font-semibold file:text-primary-700 dark:text-surface-text dark:file:bg-brand-lime/15 dark:file:text-brand-lime"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileName && (
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-xl bg-[#F4F7F5] p-3 dark:bg-surface-raised">
              <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">File</p>
              <p className="break-words font-medium">{fileName}</p>
            </div>
            <div className="rounded-xl bg-[#F4F7F5] p-3 dark:bg-surface-raised">
              <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#6A7771] dark:text-surface-muted">Records detected</p>
              <p className="font-medium">{rows.length}</p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <Alert tone="danger">
            <ul className="max-h-32 space-y-1 overflow-y-auto text-xs">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}

        {result && <Alert tone="success">{result}</Alert>}

        {duplicates && (
          <div className="space-y-3" data-testid="duplicate-review">
            <Alert
              tone="warning"
              title={`${flaggedRows.size || duplicates.length} row${(flaggedRows.size || duplicates.length) === 1 ? '' : 's'} may already exist`}
            >
              Nothing has been imported yet. Choose Skip duplicates to import only the other {Math.max(rows.length - flaggedRows.size, 0)} row
              {rows.length - flaggedRows.size === 1 ? '' : 's'}, or Import anyway if these are genuinely new records.
            </Alert>
            <ul className="max-h-52 space-y-2 overflow-y-auto" aria-label="Possible duplicate rows">
              {duplicates.map((d, i) => (
                <li
                  key={`${d.row}-${d.id}-${i}`}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-[12.5px] dark:border-surface-border dark:bg-surface-card"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[#18231E] dark:text-surface-text">Row {fileLine(d.row) ?? '?'}</span>
                    <Badge variant="warning" size="sm">{d.reason}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-[#5B6963] dark:text-surface-muted">
                    Matches {[d.name || d.houseName, d.mahallId, d.familyHead ? `Head: ${d.familyHead}` : undefined].filter(Boolean).join(' · ') || 'an existing record'}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Close
          </Button>
          {duplicates ? (
            <>
              <Button variant="secondary" onClick={skipDuplicates} disabled={importing}>
                Skip duplicates
              </Button>
              <Button onClick={() => runImport(rows, true)} disabled={importing}>
                {importing ? 'Importing…' : 'Import anyway'}
              </Button>
            </>
          ) : (
            <Button onClick={handleImport} disabled={rows.length === 0 || errors.length > 0 || importing}>
              <FiUpload className="h-3.5 w-3.5" />
              {importing ? 'Importing…' : `Import ${rows.length || ''}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
