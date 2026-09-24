import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { FiUpload } from 'react-icons/fi';
import { errorMessage, safeApiMessage } from '@/utils/errors';

export interface ColumnSpec {
  key: string;
  label: string;
  required?: boolean;
}

interface BulkImportCsvProps {
  title: string;
  columnSpec: ColumnSpec[];
  templateCsv: string;
  onImport: (rows: any[]) => Promise<{ imported: number }>;
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

/** Reading a huge file into memory locks up the tab long before the row cap. */
const MAX_CSV_BYTES = 5 * 1024 * 1024;

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
  errors: string[];
}

function parseCsv(text: string, columns: ColumnSpec[]): ParseResult {
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

  const rows: Record<string, any>[] = [];
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
  });

  if (rows.length > 500) {
    errors.push(`Maximum 500 rows per import (found ${rows.length})`);
  }

  return { rows, errors };
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

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
    setResult('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleFile = (file: File) => {
    setFileName(file.name);
    setResult('');
    setRows([]);

    /*
     * The row cap was only checked after the whole file had been parsed, and a
     * read that failed reported nothing at all — the panel simply sat there
     * naming a file with no rows and no error. Size is checked before the read,
     * and both failure paths now say something.
     */
    if (file.size > MAX_CSV_BYTES) {
      setErrors([
        'That file is too large to import. Please split it into files under 5 MB (about 500 rows each).',
      ]);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rows: parsed, errors: parseErrors } = parseCsv(String(reader.result || ''), columnSpec);
        setRows(parsed);
        setErrors(parseErrors);
      } catch {
        setErrors(["We couldn't read that file. Please check it is a CSV saved from the template."]);
      }
    };
    reader.onerror = () => {
      setErrors(["We couldn't read that file. Please try choosing it again."]);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult('');
    try {
      const { imported } = await onImport(rows);
      setResult(`Successfully imported ${imported} records`);
      setRows([]);
      onImported();
    } catch (err: unknown) {
      const message = safeApiMessage(err, '') || errorMessage(err, { action: 'import these rows' });
      setErrors([message]);
    } finally {
      setImporting(false);
    }
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
        <div className="text-sm text-gray-500">
          <p>
            <b>Required columns:</b> {requiredCols.join(', ')}
          </p>
          {optionalCols.length > 0 && (
            <p>
              <b>Optional columns:</b> {optionalCols.join(', ')}
            </p>
          )}
          <p className="mt-2">
            Max 500 records per import.
            <button type="button" onClick={downloadTemplate} className="text-primary-600 underline">
              Download template
            </button>
          </p>
        </div>

        <input
          aria-label="Choose a file"
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileName && (
          <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-label text-muted-foreground">File</p>
              <p className="break-words font-medium">{fileName}</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
              <p className="text-label text-muted-foreground">Records detected</p>
              <p className="font-medium">{rows.length}</p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-destructive/10 p-3 text-label text-destructive">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {result && <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800">{result}</p>}

        <div className="flex gap-2 flex-col-reverse sm:flex-row sm:justify-end sm:gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Close
          </Button>
          <Button onClick={handleImport} disabled={rows.length === 0 || errors.length > 0 || importing}>
            <FiUpload className="mr-2 h-4 w-4" />
            {importing ? 'Importing…' : `Import ${rows.length || ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
