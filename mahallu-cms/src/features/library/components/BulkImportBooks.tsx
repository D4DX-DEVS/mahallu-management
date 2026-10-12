import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { FiUpload } from 'react-icons/fi';
import { getFriendlyError } from '@/utils/apiMessages';

interface BulkImportBooksProps {
  isOpen: boolean;
  onClose: () => void;
  onImported: () => void;
}

const CATEGORIES = ['quran', 'hadith', 'fiqh', 'history', 'children', 'women', 'youth', 'general'];
const TEMPLATE = 'title,author,category,copies,isbn\nQuran Basics,Author Name,quran,3,\n';

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

function parseCsv(text: string): { rows: Partial<LibraryBook>[]; errors: string[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], errors: ['File needs a header row and at least one book row'] };

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const col = (name: string) => header.indexOf(name);
  if (col('title') === -1) return { rows: [], errors: ['Header must contain a "title" column'] };

  const rows: Partial<LibraryBook>[] = [];
  const errors: string[] = [];
  lines.slice(1).forEach((line, i) => {
    const cells = parseCsvLine(line);
    const title = cells[col('title')];
    if (!title) {
      errors.push(`Row ${i + 2}: missing title`);
      return;
    }
    const category = col('category') >= 0 ? cells[col('category')]?.toLowerCase() : '';
    rows.push({
      title,
      author: col('author') >= 0 ? cells[col('author')] : undefined,
      category: (CATEGORIES.includes(category) ? category : 'general') as LibraryBook['category'],
      copies: col('copies') >= 0 && Number(cells[col('copies')]) > 0 ? Number(cells[col('copies')]) : 1,
      isbn: col('isbn') >= 0 ? cells[col('isbn')] || undefined : undefined,
    });
  });
  if (rows.length > 500) errors.push(`Maximum 500 books per import (found ${rows.length})`);
  return { rows, errors };
}

export default function BulkImportBooks({ isOpen, onClose, onImported }: BulkImportBooksProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<Partial<LibraryBook>[]>([]);
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
    const reader = new FileReader();
    reader.onload = () => {
      const { rows: parsed, errors: parseErrors } = parseCsv(String(reader.result || ''));
      setRows(parsed);
      setErrors(parseErrors);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    setImporting(true);
    setResult('');
    try {
      const { imported } = await libraryService.bulkImportBooks(rows);
      setResult(`Imported ${imported} books`);
      setRows([]);
      onImported();
    } catch (err: unknown) {
      const message = getFriendlyError(err, "Couldn't import the file. Check the file and try again.");
      setErrors([message]);
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'books-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Import Books from CSV"
      description="Add many books at once from a spreadsheet"
    >
      <div className="space-y-4">
        <p className="text-[13px] text-[#5B6963] dark:text-surface-muted">
          Upload a CSV with columns: <code className="text-xs">title, author, category, copies, isbn</code>.
          Only <b>title</b> is required. Unknown categories become "general".{' '}
          <button type="button" onClick={downloadTemplate} className="font-semibold text-primary-700 underline dark:text-brand-lime">
            Download template
          </button>
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-[13px] file:mr-3 file:rounded-[10px] file:border-0 file:bg-mint file:px-3 file:py-2 file:text-[12.5px] file:font-bold file:text-primary-700"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileName && (
          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <div className="rounded-[10px] bg-[#F4F7F5] p-3 dark:bg-surface-raised">
              <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted">File</p>
              <p className="break-words font-semibold">{fileName}</p>
            </div>
            <div className="rounded-[10px] bg-[#F4F7F5] p-3 dark:bg-surface-raised">
              <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#7B8983] dark:text-surface-muted">Books detected</p>
              <p className="font-semibold">{rows.length}</p>
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
          <Button onClick={handleImport} disabled={rows.length === 0 || errors.length > 0 || importing}>
            <FiUpload className="h-3.5 w-3.5" />
            {importing ? 'Importing…' : `Import ${rows.length || ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
