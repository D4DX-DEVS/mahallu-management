import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import Button from '@/components/ui/Button';
import { FiUpload } from 'react-icons/fi';
import { errorMessage, safeApiMessage } from '@/utils/errors';
import { formatServerRowErrors, parseCsv } from '@/utils/csvImport';
import type { ColumnSpec } from '@/utils/csvImport';

/* Callers import the column type from here; it now lives with the parser. */
export type { ColumnSpec };

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

/** Heads the list of row errors the server returned. */
const IMPORT_REFUSED_NOTE = 'Nothing was imported. Fix the rows below in your file, then upload it again.';

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
  const [confirmImport, setConfirmImport] = useState(false);
  const [result, setResult] = useState<string>('');

  const reset = () => {
    setConfirmImport(false);
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
    setConfirmImport(false);
    setImporting(true);
    setResult('');
    try {
      const { imported } = await onImport(rows);
      setResult(`Successfully imported ${imported} records`);
      setRows([]);
      onImported();
    } catch (err: unknown) {
      // A refused import lists which rows are wrong (the server saves nothing when any row is refused).
      const rowLines = formatServerRowErrors(err);
      if (rowLines.length > 0) {
        setErrors([IMPORT_REFUSED_NOTE, ...rowLines]);
      } else {
        const message = safeApiMessage(err, '') || errorMessage(err, { action: 'import these rows' });
        setErrors([message]);
      }
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
    <>
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
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg bg-destructive/10 p-3 text-label text-destructive">
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
          <Button
            onClick={() => setConfirmImport(true)}
            disabled={rows.length === 0 || errors.length > 0 || importing}
          >
            <FiUpload className="mr-2 h-4 w-4" />
            {importing ? 'Importing…' : `Import ${rows.length || ''}`}
          </Button>
        </div>
        </div>
      </Modal>
      <ConfirmDialog
        isOpen={confirmImport}
        title="Import these records?"
        message={`This will add ${rows.length} records from ${fileName || 'the selected CSV'} to the system.`}
        consequence="Please review the detected rows before confirming."
        confirmLabel="Import records"
        variant="primary"
        isLoading={importing}
        onConfirm={handleImport}
        onCancel={() => setConfirmImport(false)}
      />
    </>
  );
}
