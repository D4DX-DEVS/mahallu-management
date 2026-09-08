import { useEffect, useRef } from 'react';
import { cn } from '@/utils/cn';
import { FiBold, FiItalic, FiUnderline, FiRotateCcw, FiRotateCw } from 'react-icons/fi';

interface RichTextEditorProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  error?: string;
}

const FONT_OPTIONS = ['Arial', 'Times New Roman', 'Georgia', 'Courier New', 'Verdana'];

export default function RichTextEditor({ label, value, onChange, className, error }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value;
    }
  }, [value]);

  const runCommand = (command: string, commandValue?: string) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, commandValue);
    onChange(editorRef.current.innerHTML);
  };

  return (
    <div className={cn('w-full', className)}>
      {label && (
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 ml-1">
          {label}
        </label>
      )}
      <div
        className={cn(
          'rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/50',
          error && 'border-red-500'
        )}
      >
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 dark:border-gray-700 px-3 py-2">
          <button
            type="button"
            onClick={() => runCommand('bold')}
            aria-label="Bold"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiBold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => runCommand('italic')}
            aria-label="Italic"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiItalic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => runCommand('underline')}
            aria-label="Underline"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiUnderline className="h-4 w-4" />
          </button>
          <select
            aria-label="Font"
            className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            onChange={(e) => runCommand('fontName', e.target.value)}
            defaultValue=""
          >
            <option value="" disabled>
              Font
            </option>
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font} style={{ fontFamily: font }}>
                {font}
              </option>
            ))}
          </select>
          <input
            type="color"
            aria-label="Text colour"
            className="h-9 w-9 rounded border border-gray-200 p-1 dark:border-gray-700"
            onChange={(e) => runCommand('foreColor', e.target.value)}
            title="Text color"
          />
          <button
            type="button"
            onClick={() => runCommand('undo')}
            aria-label="Undo"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiRotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => runCommand('redo')}
            aria-label="Redo"
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <FiRotateCw className="h-4 w-4" />
          </button>
        </div>
        <div
          ref={editorRef}
          className="min-h-[220px] p-4 text-sm text-gray-900 dark:text-gray-100 focus:outline-none"
          contentEditable
          onInput={() => {
            if (editorRef.current) {
              onChange(editorRef.current.innerHTML);
            }
          }}
        />
      </div>
      {error && <p className="mt-1.5 ml-1 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
