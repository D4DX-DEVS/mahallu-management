import { useRef, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { libraryService, LibraryBook } from '@/services/libraryService';
import { FiUpload } from 'react-icons/fi';

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
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        (err instanceof Error ? err.message : 'Import failed');
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
    >
      <div className="space-y-4">
        <p className="text-sm text-gray-500">
          Upload a CSV with columns: <code className="text-xs">title, author, category, copies, isbn</code>.
          Only <b>title</b> is required. Unknown categories become "general".{' '}
          <button type="button" onClick={downloadTemplate} className="text-primary-600 underline">
            Download template
          </button>
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-primary-50 file:px-3 file:py-2 file:text-primary-700"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {fileName && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs text-gray-500">File</p>
              <p className="break-words font-medium">{fileName}</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 dark:bg-slate-800">
              <p className="text-xs text-gray-500">Books detected</p>
              <p className="font-medium">{rows.length}</p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <ul className="max-h-32 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-3 text-xs text-red-700">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}

        {result && <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-800">{result}</p>}

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
            <FiUpload className="mr-2 h-4 w-4" />
            {importing ? 'Importing…' : `Import ${rows.length || ''}`}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
