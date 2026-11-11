import { useState } from 'react';
import { FiPaperclip } from 'react-icons/fi';
import Card from '@/components/ui/Card';
import { surveyFormService } from '@/services/surveyFormService';
import { toast } from '@/store/toastStore';
import { errorMessage } from '@/utils/errors';
import { openInNewTab } from '@/utils/openInNewTab';
import {
  Answers,
  SurveyField,
  SurveyFormContent,
  answerKey,
  applyAutoSums,
  fieldIdFromKey,
  formatAnswer,
  isEmptyAnswer,
  isFileAnswer,
  tableRowLabel,
  tableTotals,
  visibleFieldIds,
} from '../formEngine';

interface SurveyAnswersViewProps {
  content: SurveyFormContent;
  answers: Answers;
  submissionId: string;
}

const formatDate = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return value;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
};

/**
 * A response read as it was answered: grouped by the pages of the version it was filled on, hidden
 * questions left out, and any answer the form no longer describes listed under "Other details".
 */
export default function SurveyAnswersView({ content, answers: raw, submissionId }: SurveyAnswersViewProps) {
  const answers = applyAutoSums(content, raw);
  const visible = visibleFieldIds(content, answers);
  const known = new Set(content.pages.flatMap((p) => p.fields.map((f) => answerKey(f.id))));
  const leftovers = Object.keys(answers).filter((key) => !known.has(key) && fieldIdFromKey(key) !== null);

  return (
    <div className="space-y-3">
      {content.pages.map((page) => {
        const fields = page.fields.filter((f) => visible.has(f.id));
        if (fields.length === 0) return null;
        return (
          <Card key={page.id}>
            <h2 className="text-sm font-semibold text-foreground">{page.title}</h2>
            {page.description && <p className="mt-0.5 text-xs text-muted-foreground">{page.description}</p>}
            <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
              {fields.map((field) =>
                field.type === 'heading' ? (
                  <div key={field.id} className="sm:col-span-2">
                    <p className="border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {field.label}
                    </p>
                  </div>
                ) : (
                  <div key={field.id} className={field.type === 'table' || field.type === 'textarea' ? 'sm:col-span-2' : ''}>
                    <dt className="text-xs font-medium text-muted-foreground">{field.label}</dt>
                    <dd className="mt-0.5 break-words text-sm text-foreground">
                      <AnswerValue field={field} value={answers[answerKey(field.id)]} submissionId={submissionId} />
                    </dd>
                  </div>
                )
              )}
            </dl>
          </Card>
        );
      })}
      {leftovers.length > 0 && (
        <Card>
          <h2 className="text-sm font-semibold text-foreground">Other details</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Answers to questions that are no longer on this form.</p>
          <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
            {leftovers.map((key) => (
              <div key={key}>
                <dt className="text-xs font-medium text-muted-foreground">Question {fieldIdFromKey(key)}</dt>
                <dd className="mt-0.5 break-words text-sm">{JSON.stringify(answers[key])}</dd>
              </div>
            ))}
          </dl>
        </Card>
      )}
    </div>
  );
}

function AnswerValue({ field, value, submissionId }: { field: SurveyField; value: unknown; submissionId: string }) {
  const [opening, setOpening] = useState(false);
  if (isEmptyAnswer(value) && value !== false) return <span className="text-muted-foreground">—</span>;

  if ((field.type === 'file' || field.type === 'photo') && isFileAnswer(value)) {
    const open = async () => {
      try {
        setOpening(true);
        const result = await openInNewTab(() => surveyFormService.fileUrl(submissionId, value.documentId));
        if (result === 'blocked') toast.error('Your browser blocked the new tab. Please allow pop-ups for this site.');
      } catch (err) {
        toast.error(errorMessage(err, { action: 'open the file' }));
      } finally {
        setOpening(false);
      }
    };
    return (
      <button type="button" onClick={open} disabled={opening} className="inline-flex items-center gap-1.5 text-primary hover:underline">
        <FiPaperclip className="h-4 w-4" aria-hidden="true" />
        {opening ? 'Opening…' : value.fileName}
      </button>
    );
  }

  if (field.type === 'table' && Array.isArray(value)) {
    const table = field.table;
    const rows = value as unknown[][];
    const totals = table?.showTotals ? tableTotals(table, rows) : null;
    return (
      <div className="mt-1 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-subtle text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5">{table?.rowHeader || ''}</th>
              {(table?.columns || []).map((c, i) => (
                <th key={i} className={`px-3 py-1.5 ${c.type === 'number' ? 'text-right' : ''}`}>{c.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r} className="border-t border-border">
                <th scope="row" className="px-3 py-1.5 text-left font-medium">{tableRowLabel(table, r)}</th>
                {(table?.columns || []).map((c, i) => (
                  <td key={i} className={`px-3 py-1.5 ${c.type === 'number' ? 'text-right tabular-nums' : ''}`}>{String(row[i] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
          {totals?.hasNumberColumns && (
            <tfoot className="border-t-2 border-border bg-subtle font-semibold">
              <tr>
                <th scope="row" className="px-3 py-1.5 text-left">Total</th>
                {totals.columnTotals.map((t, i) => (
                  <td key={i} className="px-3 py-1.5 text-right tabular-nums">{t === null ? '' : t.toLocaleString('en-IN')}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    );
  }

  if (field.type === 'date' && typeof value === 'string') return <>{formatDate(value)}</>;
  if ((field.type === 'number' || field.type === 'auto_sum') && typeof value === 'number') {
    return <span className="tabular-nums">{value.toLocaleString('en-IN')}</span>;
  }
  return <span className="whitespace-pre-line">{formatAnswer(field, value)}</span>;
}
