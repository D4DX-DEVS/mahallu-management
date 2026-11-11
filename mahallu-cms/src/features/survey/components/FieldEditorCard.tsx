import { FiArrowDown, FiArrowUp, FiChevronDown, FiChevronUp, FiCopy, FiPlus, FiTrash2, FiX, FiEyeOff, FiGitBranch, FiZap } from 'react-icons/fi';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Select from '@/components/ui/Select';
import Checkbox from '@/components/ui/Checkbox';
import Button from '@/components/ui/Button';
import DateInput from '@/components/ui/DateInput';
import Badge from '@/components/ui/Badge';
import {
  CONDITION_LABELS,
  ConditionOperator,
  FIELD_TYPES,
  FIELD_TYPE_ORDER,
  FieldValidation,
  RespondentType,
  SurveyField,
  SurveyFieldType,
  SurveyFormContent,
  allFields,
  autoFillSourcesFor,
  operatorNeedsValue,
} from '../formEngine';
import { FIELD_ICONS, changeFieldType, moveItem, newOptionValue } from '../builderOps';

interface FieldEditorCardProps {
  field: SurveyField;
  index: number;
  count: number;
  content: SurveyFormContent;
  respondentType: RespondentType;
  pages: { id: number; title: string }[];
  pageId: number;
  expanded: boolean;
  onToggle: () => void;
  onChange: (field: SurveyField) => void;
  onMove: (direction: -1 | 1) => void;
  onMoveToPage: (pageId: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onInsertAfter: () => void;
}

const numberOrUndefined = (value: string): number | undefined => {
  if (value.trim() === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
};

const operatorLabel = (op: ConditionOperator, depType?: SurveyFieldType) => {
  if (depType === 'date' && op === 'greater_than') return 'is after';
  if (depType === 'date' && op === 'less_than') return 'is before';
  if (depType === 'checkbox' && op === 'equals') return 'is';
  return CONDITION_LABELS[op];
};

/** One question in the builder: a compact header that is always visible, and its settings when expanded. */
export default function FieldEditorCard(props: FieldEditorCardProps) {
  const { field, index, count, content, respondentType, pages, pageId, expanded, onToggle, onChange } = props;
  const meta = FIELD_TYPES[field.type];
  const Icon = FIELD_ICONS[field.type];
  const update = (patch: Partial<SurveyField>) => onChange({ ...field, ...patch });
  const setValidation = (patch: Partial<FieldValidation>) => {
    const next = { ...(field.validation || {}), ...patch };
    (Object.keys(next) as (keyof FieldValidation)[]).forEach((k) => next[k] === undefined && delete next[k]);
    update({ validation: Object.keys(next).length ? next : undefined });
  };
  const hidden = field.enabled === false;

  return (
    <div className={`rounded-xl border bg-card shadow-sm transition-colors ${expanded ? 'border-primary/50' : 'border-border'} ${hidden ? 'opacity-70' : ''}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-subtle text-primary" title={meta.label}>
          <Icon className="h-4 w-4" />
        </span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <span className="block truncate text-sm font-medium text-foreground">
            {field.label || <span className="italic text-muted-foreground">Untitled question</span>}
            {field.required && <span className="ml-1 text-destructive">*</span>}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {meta.label}
            {field.condition?.fieldId ? (
              <Badge size="sm" variant="info">
                <FiGitBranch className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Conditional
              </Badge>
            ) : null}
            {field.autoFill ? (
              <Badge size="sm" variant="secondary">
                <FiZap className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Auto-fill
              </Badge>
            ) : null}
            {hidden ? (
              <Badge size="sm" variant="warning">
                <FiEyeOff className="mr-1 inline h-3 w-3" aria-hidden="true" />
                Hidden
              </Badge>
            ) : null}
          </span>
        </button>
        <div className="flex flex-shrink-0 items-center">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move up" disabled={index === 0} onClick={() => props.onMove(-1)}>
            <FiArrowUp />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Move down" disabled={index === count - 1} onClick={() => props.onMove(1)}>
            <FiArrowDown />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" aria-label={expanded ? 'Collapse' : 'Edit question'} onClick={onToggle}>
            {expanded ? <FiChevronUp /> : <FiChevronDown />}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-4 border-t border-border px-3 pb-3 pt-3 sm:px-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_14rem]">
            {field.type === 'heading' ? (
              <Input label="Heading text" value={field.label} onChange={(e) => update({ label: e.target.value })} maxLength={300} />
            ) : (
              <Input label="Question" value={field.label} onChange={(e) => update({ label: e.target.value })} maxLength={300} />
            )}
            <Select
              label="Type"
              value={field.type}
              onChange={(e) => onChange(changeFieldType(field, e.target.value as SurveyFieldType, respondentType))}
              options={FIELD_TYPE_ORDER.map((t) => ({ value: t, label: FIELD_TYPES[t].label }))}
            />
          </div>

          <Input
            label={field.type === 'heading' ? 'Subtitle' : 'Help text'}
            value={field.helpText || ''}
            placeholder="Shown under the question"
            maxLength={1000}
            onChange={(e) => update({ helpText: e.target.value || undefined })}
          />

          {meta.hasPlaceholder && (
            <Input
              label={field.type === 'select' ? 'Prompt' : 'Placeholder'}
              value={field.placeholder || ''}
              maxLength={200}
              onChange={(e) => update({ placeholder: e.target.value || undefined })}
            />
          )}

          <div className="flex flex-wrap gap-x-6 gap-y-1">
            {meta.takesInput && (
              <Checkbox label="Required" checked={field.required} onChange={(e) => update({ required: e.target.checked })} />
            )}
            <Checkbox
              label="Hide this question (keeps earlier answers)"
              checked={hidden}
              onChange={(e) => update({ enabled: e.target.checked ? false : undefined })}
            />
          </div>

          {meta.hasOptions && <OptionsEditor field={field} onChange={onChange} />}
          {field.type === 'table' && <TableEditor field={field} onChange={onChange} />}
          {field.type === 'auto_sum' && <SumSourcesEditor field={field} content={content} onChange={onChange} />}
          <ValidationEditor field={field} setValidation={setValidation} />
          {field.type !== 'heading' && <ConditionEditor field={field} content={content} onChange={onChange} />}
          {meta.takesInput && <AutoFillEditor field={field} respondentType={respondentType} onChange={onChange} />}

          <div className="flex flex-col gap-2 border-t border-border pt-3 sm:flex-row sm:items-end sm:justify-between">
            {pages.length > 1 ? (
              <div className="w-full sm:w-56">
                <Select
                  label="Page"
                  value={String(pageId)}
                  onChange={(e) => props.onMoveToPage(Number(e.target.value))}
                  options={pages.map((p, i) => ({ value: String(p.id), label: `${i + 1}. ${p.title || 'Untitled page'}` }))}
                />
              </div>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" icon={<FiPlus />} onClick={props.onInsertAfter}>
                Add below
              </Button>
              <Button type="button" variant="outline" size="sm" icon={<FiCopy />} onClick={props.onDuplicate}>
                Duplicate
              </Button>
              <Button type="button" variant="danger" size="sm" icon={<FiTrash2 />} onClick={props.onDelete}>
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------------------------- */

function Panel({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-subtle/40 p-3">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      <div className="mt-2">{children}</div>
    </section>
  );
}

function OptionsEditor({ field, onChange }: { field: SurveyField; onChange: (f: SurveyField) => void }) {
  const options = field.options || [];
  const set = (next: typeof options) => onChange({ ...field, options: next });
  return (
    <Panel title="Options" hint="Renaming an option keeps the answers already given.">
      <ol className="space-y-2">
        {options.map((option, i) => (
          <li key={option.value} className="flex items-center gap-1.5">
            <span className="w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}.</span>
            <input
              aria-label={`Option ${i + 1}`}
              className="h-9 min-w-0 flex-1 rounded-md border border-input/40 bg-card px-2 text-sm focus-visible:border-primary focus-visible:outline-none"
              value={option.label}
              maxLength={200}
              onChange={(e) => set(options.map((o) => (o.value === option.value ? { ...o, label: e.target.value } : o)))}
            />
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Move option up" disabled={i === 0} onClick={() => set(moveItem(options, i, i - 1))}>
              <FiArrowUp />
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove option" disabled={options.length <= 1} onClick={() => set(options.filter((o) => o.value !== option.value))}>
              <FiX />
            </Button>
          </li>
        ))}
      </ol>
      <Button
        type="button"
        variant="outline"
        size="sm"
        icon={<FiPlus />}
        className="mt-2"
        onClick={() => set([...options, { value: newOptionValue(options), label: `Option ${options.length + 1}` }])}
      >
        Add option
      </Button>
    </Panel>
  );
}

function TableEditor({ field, onChange }: { field: SurveyField; onChange: (f: SurveyField) => void }) {
  const table = field.table || { columns: [], rows: [] };
  const set = (patch: Partial<typeof table>) => onChange({ ...field, table: { ...table, ...patch } });
  const hasNumber = table.columns.some((c) => c.type === 'number');
  return (
    <Panel title="Table" hint="Columns are what is asked for each row. Fixed rows are labelled; leave them empty to let the surveyor add rows.">
      <div className="space-y-2">
        {table.columns.map((column, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <input
              aria-label={`Column ${i + 1} title`}
              className="h-9 min-w-0 flex-1 rounded-md border border-input/40 bg-card px-2 text-sm focus-visible:border-primary focus-visible:outline-none"
              value={column.title}
              placeholder={`Column ${i + 1}`}
              onChange={(e) => set({ columns: table.columns.map((c, j) => (j === i ? { ...c, title: e.target.value } : c)) })}
            />
            <select
              aria-label={`Column ${i + 1} type`}
              className="h-9 rounded-md border border-input/40 bg-card px-2 text-sm"
              value={column.type}
              onChange={(e) =>
                set({ columns: table.columns.map((c, j) => (j === i ? { ...c, type: e.target.value === 'number' ? 'number' : 'text' } : c)) })
              }
            >
              <option value="text">Text</option>
              <option value="number">Number</option>
            </select>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Remove column" disabled={table.columns.length <= 1} onClick={() => set({ columns: table.columns.filter((_, j) => j !== i) })}>
              <FiX />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" icon={<FiPlus />} onClick={() => set({ columns: [...table.columns, { title: '', type: 'text' }] })} disabled={table.columns.length >= 20}>
          Add column
        </Button>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <Textarea
          label="Fixed rows (one per line)"
          rows={3}
          value={table.rows.join('\n')}
          placeholder={'e.g.\nFood\nRent\nEducation'}
          onChange={(e) => {
            const rows = e.target.value.split('\n').slice(0, 50);
            set({ rows, allowAddRows: rows.filter((r) => r.trim()).length === 0 ? true : table.allowAddRows });
          }}
          onBlur={() => set({ rows: table.rows.map((r) => r.trim()).filter(Boolean) })}
        />
        <div className="space-y-1">
          <Input label="Row label header" value={table.rowHeader || ''} placeholder="e.g. Item" onChange={(e) => set({ rowHeader: e.target.value || undefined })} />
          {table.rows.filter((r) => r.trim()).length > 0 && (
            <Checkbox label="Surveyor can add more rows" checked={!!table.allowAddRows} onChange={(e) => set({ allowAddRows: e.target.checked })} />
          )}
          {hasNumber ? (
            <Checkbox label="Show a totals row" checked={!!table.showTotals} onChange={(e) => set({ showTotals: e.target.checked })} />
          ) : (
            <p className="text-xs text-muted-foreground">Make a column a Number to offer totals.</p>
          )}
        </div>
      </div>
    </Panel>
  );
}

function SumSourcesEditor({ field, content, onChange }: { field: SurveyField; content: SurveyFormContent; onChange: (f: SurveyField) => void }) {
  const selected = new Set(field.sumFields || []);
  const groups = content.pages
    .map((page) => ({ page, fields: page.fields.filter((f) => f.type === 'number' && f.enabled !== false) }))
    .filter((g) => g.fields.length > 0);
  const chosen = allFields(content).filter((f) => selected.has(f.id) && f.type === 'number');
  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange({ ...field, sumFields: allFields(content).filter((f) => next.has(f.id) && f.type === 'number').map((f) => f.id) });
  };
  return (
    <Panel title="Adds up" hint="Recalculated on every change and again on the server when submitted.">
      {groups.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-400">Add a Number question first, then choose it here.</p>
      ) : (
        <div className="space-y-2">
          {groups.map(({ page, fields }) => (
            <div key={page.id}>
              <p className="text-xs font-medium text-muted-foreground">{page.title || 'Untitled page'}</p>
              {fields.map((f) => (
                <Checkbox key={f.id} label={f.label || 'Untitled'} checked={selected.has(f.id)} onChange={() => toggle(f.id)} />
              ))}
            </div>
          ))}
          <p className="rounded-md bg-card px-2 py-1.5 text-xs text-muted-foreground">
            {chosen.length ? `${field.label || 'Total'} = ${chosen.map((f) => f.label || 'Untitled').join(' + ')}` : 'Choose at least one number question.'}
          </p>
        </div>
      )}
    </Panel>
  );
}

function ValidationEditor({ field, setValidation }: { field: SurveyField; setValidation: (patch: Partial<FieldValidation>) => void }) {
  const v = field.validation || {};
  const num = (value?: number) => (value === undefined ? '' : String(value));
  if (field.type === 'number') {
    return (
      <Panel title="Limits">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Input label="Minimum" inputMode="decimal" value={num(v.min)} onChange={(e) => setValidation({ min: numberOrUndefined(e.target.value) })} />
          <Input label="Maximum" inputMode="decimal" value={num(v.max)} onChange={(e) => setValidation({ max: numberOrUndefined(e.target.value) })} />
          <Input label="Error message" value={v.message || ''} placeholder="Optional" onChange={(e) => setValidation({ message: e.target.value || undefined })} />
        </div>
      </Panel>
    );
  }
  if (field.type === 'multiselect') {
    return (
      <Panel title="Limits">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Fewest choices" inputMode="numeric" value={num(v.min)} onChange={(e) => setValidation({ min: numberOrUndefined(e.target.value) })} />
          <Input label="Most choices" inputMode="numeric" value={num(v.max)} onChange={(e) => setValidation({ max: numberOrUndefined(e.target.value) })} />
        </div>
      </Panel>
    );
  }
  if (field.type === 'text' || field.type === 'textarea') {
    return (
      <Panel title="Limits" hint="Format is a regular expression, e.g. ^[0-9]{12}$ for a 12-digit number.">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Fewest characters" inputMode="numeric" value={num(v.minLength)} onChange={(e) => setValidation({ minLength: numberOrUndefined(e.target.value) })} />
          <Input label="Most characters" inputMode="numeric" value={num(v.maxLength)} onChange={(e) => setValidation({ maxLength: numberOrUndefined(e.target.value) })} />
          <Input label="Format (optional)" value={v.pattern || ''} onChange={(e) => setValidation({ pattern: e.target.value || undefined })} />
          <Input label="Error message" value={v.message || ''} placeholder="Optional" onChange={(e) => setValidation({ message: e.target.value || undefined })} />
        </div>
      </Panel>
    );
  }
  return null;
}

function ConditionEditor({ field, content, onChange }: { field: SurveyField; content: SurveyFormContent; onChange: (f: SurveyField) => void }) {
  const ordered = allFields(content);
  const position = ordered.findIndex((f) => f.id === field.id);
  const candidates = ordered.slice(0, Math.max(0, position)).filter((f) => FIELD_TYPES[f.type].conditionOperators.length > 0);
  const condition = field.condition;
  const dependency = condition ? ordered.find((f) => f.id === condition.fieldId) : undefined;
  const operators = dependency ? FIELD_TYPES[dependency.type].conditionOperators : [];

  if (!condition) {
    return (
      <div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={<FiGitBranch />}
          disabled={candidates.length === 0}
          onClick={() => {
            const dep = candidates[candidates.length - 1];
            const op = FIELD_TYPES[dep.type].conditionOperators[0];
            onChange({ ...field, condition: { fieldId: dep.id, operator: op, action: 'show', value: dep.options?.[0]?.value ?? (dep.type === 'checkbox' ? 'true' : '') } });
          }}
        >
          Show only when…
        </Button>
        {candidates.length === 0 && <p className="mt-1 text-xs text-muted-foreground">Conditions can depend on questions that come before this one.</p>}
      </div>
    );
  }

  const set = (patch: Partial<typeof condition>) => onChange({ ...field, condition: { ...condition, ...patch } });
  const valueInput = () => {
    if (!dependency || !operatorNeedsValue(condition.operator)) return null;
    if (dependency.options?.length) {
      return (
        <Select label="Value" value={condition.value || ''} onChange={(e) => set({ value: e.target.value })} options={dependency.options.map((o) => ({ value: o.value, label: o.label }))} />
      );
    }
    if (dependency.type === 'checkbox') {
      return (
        <Select label="Value" value={condition.value || 'true'} onChange={(e) => set({ value: e.target.value })} options={[{ value: 'true', label: 'Ticked' }, { value: 'false', label: 'Not ticked' }]} />
      );
    }
    if (dependency.type === 'date') return <DateInput label="Value" value={condition.value || ''} onValueChange={(v) => set({ value: v })} />;
    return <Input label="Value" value={condition.value || ''} onChange={(e) => set({ value: e.target.value })} />;
  };

  return (
    <Panel title="Condition" hint="The question is skipped, and never required, while it is hidden.">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
        <Select label="Action" value={condition.action} onChange={(e) => set({ action: e.target.value === 'hide' ? 'hide' : 'show' })} options={[{ value: 'show', label: 'Show when' }, { value: 'hide', label: 'Hide when' }]} />
        <Select
          label="Question"
          value={String(condition.fieldId)}
          onChange={(e) => {
            const dep = ordered.find((f) => f.id === Number(e.target.value));
            if (!dep) return;
            set({ fieldId: dep.id, operator: FIELD_TYPES[dep.type].conditionOperators[0], value: dep.options?.[0]?.value ?? (dep.type === 'checkbox' ? 'true' : '') });
          }}
          options={[
            ...(dependency ? [] : [{ value: String(condition.fieldId), label: 'Removed question' }]),
            ...candidates.map((f) => ({ value: String(f.id), label: f.label || 'Untitled' })),
          ]}
        />
        <Select
          label="Rule"
          value={condition.operator}
          onChange={(e) => set({ operator: e.target.value as ConditionOperator })}
          options={operators.map((op) => ({ value: op, label: operatorLabel(op, dependency?.type) }))}
        />
        {valueInput()}
      </div>
      <Button type="button" variant="ghost" size="sm" icon={<FiX />} className="mt-2" onClick={() => onChange({ ...field, condition: null })}>
        Remove condition
      </Button>
    </Panel>
  );
}

function AutoFillEditor({ field, respondentType, onChange }: { field: SurveyField; respondentType: RespondentType; onChange: (f: SurveyField) => void }) {
  const sources = autoFillSourcesFor(field.type, respondentType);
  if (respondentType === 'none') return null;
  if (sources.length === 0) return null;
  return (
    <div className="w-full sm:w-80">
      <Select
        label="Fill automatically from"
        value={field.autoFill || ''}
        onChange={(e) => onChange({ ...field, autoFill: e.target.value || null })}
        options={[
          { value: '', label: 'Do not auto-fill' },
          ...sources.map((s) => ({ value: s.key, label: `${s.scope === 'family' ? 'Family' : 'Member'}: ${s.label}` })),
        ]}
      />
      <p className="mt-1 text-xs text-muted-foreground">Filled when the surveyor picks the {respondentType}, only if empty. It stays editable.</p>
    </div>
  );
}
