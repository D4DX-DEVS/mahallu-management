import { useState } from 'react';
import { FiPlus, FiTrash2, FiUpload, FiPaperclip, FiX } from 'react-icons/fi';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import DateInput from '@/components/ui/DateInput';
import Checkbox from '@/components/ui/Checkbox';
import Button from '@/components/ui/Button';
import Field, { useFieldIds } from '@/components/ui/Field';
import { surveyFormService } from '@/services/surveyFormService';
import { errorMessage } from '@/utils/errors';
import {
  Answers,
  SurveyField,
  SurveyFormContent,
  computeAutoSum,
  isFileAnswer,
  tableAllowsAddingRows,
  tableRowLabel,
  tableTotals,
} from '../formEngine';

export interface SurveyFieldInputProps {
  field: SurveyField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  content: SurveyFormContent;
  answers: Answers;
  /** Builder preview: everything renders, nothing uploads. */
  preview?: boolean;
}

const asString = (value: unknown) => (value === null || value === undefined ? '' : String(value));

/** One survey question, in the control its type calls for. Every fill surface renders through this. */
export default function SurveyFieldInput({ field, value, onChange, error, content, answers, preview }: SurveyFieldInputProps) {
  const common = { label: field.label, required: field.required, error, helperText: field.helpText };

  switch (field.type) {
    case 'heading':
      return (
        <div className="pt-2">
          <h3 className="text-base font-semibold text-foreground">{field.label}</h3>
          {field.helpText && <p className="mt-0.5 text-sm text-muted-foreground">{field.helpText}</p>}
          <div className="mt-2 h-px bg-border" />
        </div>
      );
    case 'text':
    case 'email':
    case 'phone':
      return (
        <Input
          {...common}
          type={field.type === 'phone' ? 'tel' : field.type === 'email' ? 'email' : 'text'}
          inputMode={field.type === 'phone' ? 'tel' : undefined}
          placeholder={field.placeholder}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'number':
      return (
        <Input
          {...common}
          type="text"
          inputMode="decimal"
          placeholder={field.placeholder}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'textarea':
      return (
        <Textarea
          {...common}
          rows={3}
          placeholder={field.placeholder}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
        />
      );
    case 'date':
      return <DateInput {...common} value={asString(value)} onValueChange={(iso) => onChange(iso)} />;
    case 'select':
      return (
        <Select
          {...common}
          value={asString(value)}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: '', label: field.placeholder?.trim() || 'Select...' },
            ...(field.options || []).map((o) => ({ value: o.value, label: o.label })),
          ]}
        />
      );
    case 'radio':
      return <ChoiceList field={field} multiple={false} value={value} onChange={onChange} error={error} />;
    case 'multiselect':
      return <ChoiceList field={field} multiple value={value} onChange={onChange} error={error} />;
    case 'checkbox':
      return (
        <div>
          <Checkbox
            label={field.label + (field.required ? ' *' : '')}
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            error={error}
            helperText={field.helpText}
          />
        </div>
      );
    case 'auto_sum':
      return (
        <Input
          label={field.label}
          helperText={field.helpText || 'Calculated automatically'}
          value={computeAutoSum(field, content, answers).toLocaleString('en-IN')}
          readOnly
          className="bg-subtle font-semibold tabular-nums"
        />
      );
    case 'file':
    case 'photo':
      return <FileInput field={field} value={value} onChange={onChange} error={error} preview={preview} />;
    case 'table':
      return <TableInput field={field} value={value} onChange={onChange} error={error} />;
    default:
      return null;
  }
}

/* ---------------------------------------------------------------------------------------------- */

function ChoiceList({
  field,
  multiple,
  value,
  onChange,
  error,
}: {
  field: SurveyField;
  multiple: boolean;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const ids = useFieldIds({ error, helperText: field.helpText, required: field.required });
  const selected = multiple ? (Array.isArray(value) ? (value as string[]) : []) : [asString(value)];
  const toggle = (option: string) => {
    if (!multiple) return onChange(option);
    onChange(selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option]);
  };
  return (
    <Field ids={ids} label={field.label} required={field.required} error={error} helperText={field.helpText}>
      <div
        role={multiple ? 'group' : 'radiogroup'}
        aria-labelledby={ids.id}
        className="grid grid-cols-1 gap-2 sm:grid-cols-2"
      >
        {(field.options || []).map((option) => {
          const checked = selected.includes(option.value);
          return (
            <label
              key={option.value}
              className={`flex min-h-[44px] cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm transition-colors ${
                checked ? 'border-primary bg-primary/5 text-foreground' : 'border-border hover:bg-subtle'
              }`}
            >
              <input
                type={multiple ? 'checkbox' : 'radio'}
                aria-label={option.label}
                name={`field-${field.id}`}
                className="h-4 w-4 flex-shrink-0"
                checked={checked}
                onChange={() => toggle(option.value)}
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          );
        })}
      </div>
    </Field>
  );
}

/* ---------------------------------------------------------------------------------------------- */

const ACCEPT = {
  file: 'application/pdf,image/jpeg,image/png,image/webp',
  photo: 'image/jpeg,image/png,image/webp',
};

function FileInput({
  field,
  value,
  onChange,
  error,
  preview,
}: {
  field: SurveyField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  preview?: boolean;
}) {
  const ids = useFieldIds({ error, helperText: field.helpText, required: field.required });
  const [uploading, setUploading] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const kind = field.type === 'photo' ? 'photo' : 'file';
  const file = isFileAnswer(value) ? value : null;

  const pick = async (chosen: File | undefined) => {
    if (!chosen || preview) return;
    try {
      setUploadError(null);
      setUploading(0);
      const uploaded = await surveyFormService.uploadFile(chosen, kind, setUploading);
      onChange(uploaded);
    } catch (err) {
      setUploadError(errorMessage(err, { action: 'upload the file' }));
    } finally {
      setUploading(null);
    }
  };

  return (
    <Field
      ids={ids}
      label={field.label}
      required={field.required}
      error={error || uploadError || undefined}
      helperText={field.helpText || (kind === 'photo' ? 'JPEG, PNG or WebP image' : 'PDF or image, up to 10 MB')}
    >
      {file ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-subtle px-3 py-2 text-sm">
          <FiPaperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">{file.fileName}</span>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove file" onClick={() => onChange(null)}>
            <FiX />
          </Button>
        </div>
      ) : (
        <label
          className={`flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-sm text-muted-foreground hover:bg-subtle ${
            preview ? 'cursor-not-allowed opacity-60' : ''
          }`}
        >
          <FiUpload className="h-4 w-4" aria-hidden="true" />
          {uploading !== null ? `Uploading… ${uploading}%` : kind === 'photo' ? 'Choose a photo' : 'Choose a file'}
          <input
            {...ids.controlProps}
            type="file"
            aria-label={field.label}
            className="sr-only"
            accept={ACCEPT[kind]}
            disabled={preview || uploading !== null}
            onChange={(e) => {
              void pick(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </Field>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function TableInput({
  field,
  value,
  onChange,
  error,
}: {
  field: SurveyField;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
}) {
  const ids = useFieldIds({ error, helperText: field.helpText, required: field.required });
  const table = field.table || { columns: [], rows: [] };
  const columns = table.columns;
  const fixedRows = table.rows.length;
  const stored = Array.isArray(value) ? (value as unknown[][]) : [];
  const rowCount = Math.max(stored.length, fixedRows || 1);
  const grid: string[][] = Array.from({ length: rowCount }, (_, r) =>
    columns.map((_, c) => asString(stored[r]?.[c]))
  );
  const canAdd = tableAllowsAddingRows(table);
  const showLabels = fixedRows > 0 || !!table.showTotals;
  const totals = table.showTotals ? tableTotals(table, grid) : null;

  const setCell = (r: number, c: number, cell: string) => {
    const next = grid.map((row) => [...row]);
    next[r][c] = cell;
    onChange(next);
  };
  const addRow = () => onChange([...grid, columns.map(() => '')]);
  const removeRow = (r: number) => onChange(grid.filter((_, i) => i !== r));

  return (
    <Field ids={ids} label={field.label} required={field.required} error={error} helperText={field.helpText}>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[28rem] text-sm">
          <thead className="bg-subtle text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <tr>
              {showLabels && <th className="px-3 py-2">{table.rowHeader || ''}</th>}
              {columns.map((column, c) => (
                <th key={c} className={`px-3 py-2 ${column.type === 'number' ? 'text-right' : ''}`}>
                  {column.title || `Column ${c + 1}`}
                </th>
              ))}
              {canAdd && <th className="w-10" aria-label="Row actions" />}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r} className="border-t border-border">
                {showLabels && <th scope="row" className="whitespace-nowrap px-3 py-1.5 text-left font-medium">{tableRowLabel(table, r)}</th>}
                {row.map((cell, c) => (
                  <td key={c} className="px-1.5 py-1">
                    <input
                      aria-label={`${tableRowLabel(table, r)}, ${columns[c]?.title || `Column ${c + 1}`}`}
                      className={`h-9 w-full rounded-md border border-input/40 bg-card px-2 text-sm focus-visible:border-primary focus-visible:outline-none ${
                        columns[c]?.type === 'number' ? 'text-right tabular-nums' : ''
                      }`}
                      inputMode={columns[c]?.type === 'number' ? 'decimal' : undefined}
                      value={cell}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
                {canAdd && (
                  <td className="px-1 text-center">
                    {r >= fixedRows && grid.length > 1 && (
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove ${tableRowLabel(table, r)}`} onClick={() => removeRow(r)}>
                        <FiTrash2 />
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {totals && totals.hasNumberColumns && (
            <tfoot className="border-t-2 border-border bg-subtle font-semibold">
              <tr>
                {showLabels && <th scope="row" className="px-3 py-2 text-left">Total</th>}
                {totals.columnTotals.map((total, c) => (
                  <td key={c} className="px-3 py-2 text-right tabular-nums">
                    {total === null ? '' : total.toLocaleString('en-IN')}
                  </td>
                ))}
                {canAdd && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      {canAdd && (
        <Button type="button" variant="outline" size="sm" icon={<FiPlus />} className="mt-2" onClick={addRow}>
          Add row
        </Button>
      )}
    </Field>
  );
}
