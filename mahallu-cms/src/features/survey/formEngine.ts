/**
 * Survey form engine: what a survey form is, and how its answers behave.
 *
 * SHARED FILE. An identical copy lives in both projects:
 *   mahallu-api/src/shared/surveyFormEngine.ts
 *   mahallu-cms/src/features/survey/formEngine.ts
 * `surveyForms.test.ts` in the API fails when the two differ, so edit one and copy it over.
 *
 * The builder, the fill wizard, the preview, the read-only view, the CSV export and the server's
 * submit pipeline all read the form through this module, so a rule is written once. It is pure
 * TypeScript with no imports so it compiles under both projects' settings.
 *
 * Contract:
 *   - A form is `pages[] -> fields[]`. Field ids are numbers, unique across the whole form and never
 *     reused (the survey keeps a monotonic `nextFieldId`).
 *   - Every answer is stored under `field_<id>`, so a label can be renamed without losing data.
 *   - Choice answers store the option's stable `value`, never its label.
 *   - Derived values (auto-sum) are recomputed on the server; the client's copy is never trusted.
 */

export type SurveyFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'select'
  | 'radio'
  | 'multiselect'
  | 'checkbox'
  | 'file'
  | 'photo'
  | 'table'
  | 'auto_sum'
  | 'heading';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'is_empty'
  | 'is_not_empty';

export type RespondentType = 'none' | 'family' | 'member';

export interface FieldOption {
  /** Stable key stored in answers. Never shown, never changes after the option is created. */
  value: string;
  label: string;
}

export interface FieldCondition {
  /** Id of an EARLIER field this one depends on. */
  fieldId: number;
  operator: ConditionOperator;
  value?: string;
  action: 'show' | 'hide';
}

export interface FieldValidation {
  /** number: smallest value. multiselect: fewest choices. */
  min?: number;
  /** number: largest value. multiselect: most choices. */
  max?: number;
  minLength?: number;
  maxLength?: number;
  /** Regular expression source, tested against text answers. */
  pattern?: string;
  /** Replaces every error except "required". */
  message?: string;
}

export interface TableColumnConfig {
  title: string;
  type: 'text' | 'number';
}

export interface TableConfig {
  columns: TableColumnConfig[];
  /** Fixed, labelled rows. Empty means the respondent adds rows freely. */
  rows: string[];
  /** Header above the row-label column. */
  rowHeader?: string;
  /** Respondent may add rows beyond the fixed ones. Always true when `rows` is empty. */
  allowAddRows?: boolean;
  /** Totals row under number columns. */
  showTotals?: boolean;
}

export interface FileAnswer {
  documentId: string;
  fileName: string;
  mimeType?: string;
  size?: number;
}

export interface SurveyField {
  id: number;
  type: SurveyFieldType;
  label: string;
  required: boolean;
  /** false hides the field everywhere but keeps answers already given. */
  enabled?: boolean;
  placeholder?: string;
  helpText?: string;
  options?: FieldOption[];
  validation?: FieldValidation;
  table?: TableConfig;
  /** auto_sum: ids of number fields to add up. */
  sumFields?: number[];
  condition?: FieldCondition | null;
  /** Key of an AUTO_FILL_SOURCES entry. */
  autoFill?: string | null;
}

export interface SurveyPage {
  id: number;
  title: string;
  description?: string;
  fields: SurveyField[];
}

export interface SurveyFormContent {
  pages: SurveyPage[];
  /** Shown before the form starts, as a numbered list. */
  instructions: string[];
}

export type Answers = Record<string, unknown>;

/* ------------------------------------------------------------------------------------------------
 * Field type registry
 * ---------------------------------------------------------------------------------------------- */

export interface FieldTypeMeta {
  label: string;
  description: string;
  category: 'input' | 'choice' | 'upload' | 'structured' | 'layout';
  /** false for layout items (headings) and computed values. */
  takesInput: boolean;
  hasOptions: boolean;
  hasPlaceholder: boolean;
  /** Operators offered when ANOTHER field depends on this one. Empty: cannot be a dependency. */
  conditionOperators: ConditionOperator[];
  /** Can be used as a quick filter on the submissions list. */
  filterable: boolean;
}

const TEXT_OPS: ConditionOperator[] = ['equals', 'not_equals', 'contains', 'not_contains', 'is_empty', 'is_not_empty'];
const NUMBER_OPS: ConditionOperator[] = ['equals', 'not_equals', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];
const CHOICE_OPS: ConditionOperator[] = ['equals', 'not_equals', 'is_empty', 'is_not_empty'];
const PRESENCE_OPS: ConditionOperator[] = ['is_empty', 'is_not_empty'];

export const FIELD_TYPES: Record<SurveyFieldType, FieldTypeMeta> = {
  text: { label: 'Short text', description: 'One line of text', category: 'input', takesInput: true, hasOptions: false, hasPlaceholder: true, conditionOperators: TEXT_OPS, filterable: false },
  textarea: { label: 'Long text', description: 'Several lines of text', category: 'input', takesInput: true, hasOptions: false, hasPlaceholder: true, conditionOperators: TEXT_OPS, filterable: false },
  number: { label: 'Number', description: 'A number, with optional limits', category: 'input', takesInput: true, hasOptions: false, hasPlaceholder: true, conditionOperators: NUMBER_OPS, filterable: false },
  email: { label: 'Email', description: 'An email address', category: 'input', takesInput: true, hasOptions: false, hasPlaceholder: true, conditionOperators: TEXT_OPS, filterable: false },
  phone: { label: 'Phone', description: 'A phone number', category: 'input', takesInput: true, hasOptions: false, hasPlaceholder: true, conditionOperators: TEXT_OPS, filterable: false },
  date: { label: 'Date', description: 'A calendar date', category: 'input', takesInput: true, hasOptions: false, hasPlaceholder: false, conditionOperators: NUMBER_OPS, filterable: false },
  select: { label: 'Dropdown', description: 'Pick one from a list', category: 'choice', takesInput: true, hasOptions: true, hasPlaceholder: true, conditionOperators: CHOICE_OPS, filterable: true },
  radio: { label: 'Single choice', description: 'Pick one, all options visible', category: 'choice', takesInput: true, hasOptions: true, hasPlaceholder: false, conditionOperators: CHOICE_OPS, filterable: true },
  multiselect: { label: 'Multiple choice', description: 'Tick any number of options', category: 'choice', takesInput: true, hasOptions: true, hasPlaceholder: false, conditionOperators: ['contains', 'not_contains', 'is_empty', 'is_not_empty'], filterable: true },
  checkbox: { label: 'Yes / No tick', description: 'A single tick box', category: 'choice', takesInput: true, hasOptions: false, hasPlaceholder: false, conditionOperators: ['equals'], filterable: true },
  file: { label: 'File upload', description: 'A PDF or image document', category: 'upload', takesInput: true, hasOptions: false, hasPlaceholder: false, conditionOperators: PRESENCE_OPS, filterable: false },
  photo: { label: 'Photo', description: 'A JPEG, PNG or WebP photo', category: 'upload', takesInput: true, hasOptions: false, hasPlaceholder: false, conditionOperators: PRESENCE_OPS, filterable: false },
  table: { label: 'Table', description: 'Rows and columns, with totals', category: 'structured', takesInput: true, hasOptions: false, hasPlaceholder: false, conditionOperators: [], filterable: false },
  auto_sum: { label: 'Auto sum', description: 'Read-only total of number fields', category: 'structured', takesInput: false, hasOptions: false, hasPlaceholder: false, conditionOperators: NUMBER_OPS, filterable: false },
  heading: { label: 'Heading', description: 'A section title, no answer', category: 'layout', takesInput: false, hasOptions: false, hasPlaceholder: false, conditionOperators: [], filterable: false },
};

export const FIELD_TYPE_ORDER: SurveyFieldType[] = [
  'text', 'textarea', 'number', 'email', 'phone', 'date',
  'select', 'radio', 'multiselect', 'checkbox',
  'file', 'photo', 'table', 'auto_sum', 'heading',
];

export const isFieldType = (value: unknown): value is SurveyFieldType =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(FIELD_TYPES, value);

/** Fields that hold an answer (everything but headings). auto_sum holds a computed one. */
export const hasAnswer = (field: SurveyField): boolean => field.type !== 'heading';

export const CONDITION_LABELS: Record<ConditionOperator, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'does not contain',
  greater_than: 'is greater than',
  less_than: 'is less than',
  is_empty: 'is empty',
  is_not_empty: 'is answered',
};

export const operatorNeedsValue = (op: ConditionOperator): boolean => op !== 'is_empty' && op !== 'is_not_empty';

/* ------------------------------------------------------------------------------------------------
 * Limits (also the server's ceiling on what a form or an answer may hold)
 * ---------------------------------------------------------------------------------------------- */

export const FORM_LIMITS = {
  pages: 30,
  fields: 300,
  options: 100,
  label: 300,
  helpText: 1000,
  placeholder: 200,
  optionLabel: 200,
  instructions: 30,
  instruction: 500,
  tableColumns: 20,
  tableRows: 50,
  tableAddedRows: 100,
  textAnswer: 1000,
  longTextAnswer: 10000,
  cell: 500,
} as const;

/* ------------------------------------------------------------------------------------------------
 * Small helpers
 * ---------------------------------------------------------------------------------------------- */

export const answerKey = (fieldId: number): string => `field_${fieldId}`;

export const fieldIdFromKey = (key: string): number | null => {
  const match = /^field_(\d+)$/.exec(key);
  return match ? Number(match[1]) : null;
};

export const allFields = (content: SurveyFormContent | null | undefined): SurveyField[] =>
  (content?.pages || []).flatMap((page) => page.fields || []);

export const findField = (content: SurveyFormContent, id: number): SurveyField | undefined =>
  allFields(content).find((field) => field.id === id);

export const isEnabled = (field: SurveyField): boolean => field.enabled !== false;

/** "25,000" -> 25000; blank or not a number -> null. */
export const parseNumber = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (cleaned === '') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Hides floating-point noise: 0.1 + 0.2 -> 0.3. */
export const tidyNumber = (n: number): number => parseFloat(n.toFixed(8));

export const isFileAnswer = (value: unknown): value is FileAnswer =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  typeof (value as FileAnswer).documentId === 'string' &&
  /^[a-f0-9]{24}$/i.test((value as FileAnswer).documentId);

const isTableValue = (value: unknown): value is unknown[][] =>
  Array.isArray(value) && value.every((row) => Array.isArray(row));

export const isEmptyAnswer = (value: unknown): boolean => {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) {
    if (value.length === 0) return true;
    if (isTableValue(value)) return value.every((row) => row.every((cell) => isEmptyAnswer(cell)));
    return false;
  }
  return false;
};

export const optionLabel = (field: SurveyField, value: unknown): string => {
  const match = (field.options || []).find((option) => option.value === value);
  return match ? match.label : String(value ?? '');
};

/** The label of table row `index`: the fixed row's title, or "Row n" for an added row. */
export const tableRowLabel = (table: TableConfig | undefined, index: number): string =>
  table?.rows?.[index]?.trim() || `Row ${index + 1}`;

export const tableAllowsAddingRows = (table: TableConfig | undefined): boolean =>
  !table || table.rows.length === 0 || !!table.allowAddRows;

/* ------------------------------------------------------------------------------------------------
 * Conditional logic
 * ---------------------------------------------------------------------------------------------- */

const conditionMatches = (condition: FieldCondition, dependency: SurveyField | undefined, raw: unknown): boolean => {
  const expected = condition.value ?? '';
  switch (condition.operator) {
    case 'is_empty':
      return isEmptyAnswer(raw) || raw === false;
    case 'is_not_empty':
      return !isEmptyAnswer(raw) && raw !== false;
    default:
      break;
  }
  if (dependency?.type === 'checkbox') {
    const ticked = raw === true;
    return condition.operator === 'not_equals' ? ticked !== (expected === 'true') : ticked === (expected === 'true');
  }
  if (Array.isArray(raw)) {
    const has = raw.map(String).includes(expected);
    if (condition.operator === 'contains' || condition.operator === 'equals') return has;
    if (condition.operator === 'not_contains' || condition.operator === 'not_equals') return !has;
    return false;
  }
  if (condition.operator === 'greater_than' || condition.operator === 'less_than') {
    if (dependency?.type === 'date') {
      const actual = typeof raw === 'string' ? raw : '';
      if (!actual || !expected) return false;
      return condition.operator === 'greater_than' ? actual > expected : actual < expected;
    }
    const a = parseNumber(raw);
    const b = parseNumber(expected);
    if (a === null || b === null) return false;
    return condition.operator === 'greater_than' ? a > b : a < b;
  }
  const actual = raw === null || raw === undefined ? '' : String(raw).trim();
  const isNumeric = dependency?.type === 'number' || dependency?.type === 'auto_sum';
  const same = isNumeric
    ? parseNumber(actual) !== null && parseNumber(actual) === parseNumber(expected)
    : dependency?.type === 'select' || dependency?.type === 'radio'
      ? actual === expected
      : actual.toLowerCase() === expected.trim().toLowerCase();
  switch (condition.operator) {
    case 'equals':
      return same;
    case 'not_equals':
      return !same;
    case 'contains':
      return actual.toLowerCase().includes(expected.trim().toLowerCase());
    case 'not_contains':
      return !actual.toLowerCase().includes(expected.trim().toLowerCase());
    default:
      return true;
  }
};

/**
 * Ids of the fields a respondent sees for these answers.
 *
 * A disabled field is never visible. A field whose dependency is hidden is evaluated as if that
 * dependency were unanswered, because a hidden field's answer is dropped on submit. Dependencies
 * always point at earlier fields (checked when the form is published), so one pass in form order
 * settles every chain.
 */
export const visibleFieldIds = (content: SurveyFormContent, answers: Answers): Set<number> => {
  const visible = new Set<number>();
  const byId = new Map<number, SurveyField>();
  for (const field of allFields(content)) byId.set(field.id, field);
  for (const field of allFields(content)) {
    if (!isEnabled(field)) continue;
    const condition = field.condition;
    if (!condition || !condition.fieldId) {
      visible.add(field.id);
      continue;
    }
    const dependency = byId.get(condition.fieldId);
    const raw = dependency && visible.has(dependency.id) ? answers[answerKey(dependency.id)] : undefined;
    const matched = conditionMatches(condition, dependency, raw);
    if (condition.action === 'hide' ? !matched : matched) visible.add(field.id);
  }
  return visible;
};

/* ------------------------------------------------------------------------------------------------
 * Computed values
 * ---------------------------------------------------------------------------------------------- */

/** The number fields an auto-sum adds up. Stale or disabled ids are skipped. */
export const sumSources = (field: SurveyField, content: SurveyFormContent): SurveyField[] => {
  const ids = new Set(field.sumFields || []);
  return allFields(content).filter((f) => ids.has(f.id) && f.type === 'number' && isEnabled(f));
};

export const computeAutoSum = (field: SurveyField, content: SurveyFormContent, answers: Answers): number =>
  tidyNumber(sumSources(field, content).reduce((sum, f) => sum + (parseNumber(answers[answerKey(f.id)]) ?? 0), 0));

export const applyAutoSums = (content: SurveyFormContent, answers: Answers): Answers => {
  const sums = allFields(content).filter((f) => f.type === 'auto_sum' && isEnabled(f));
  if (sums.length === 0) return answers;
  const next: Answers = { ...answers };
  for (const field of sums) next[answerKey(field.id)] = computeAutoSum(field, content, answers);
  return next;
};

/** Column totals of a table's number columns (null for text columns) and their grand total. */
export const tableTotals = (table: TableConfig | undefined, value: unknown) => {
  const columns = table?.columns || [];
  const rows = isTableValue(value) ? value : [];
  const columnTotals = columns.map((column, c) =>
    column.type === 'number' ? tidyNumber(rows.reduce((sum: number, row) => sum + (parseNumber(row[c]) ?? 0), 0)) : null
  );
  const grandTotal = tidyNumber(columnTotals.reduce((sum: number, n) => sum + (n ?? 0), 0));
  return { columnTotals, grandTotal, hasNumberColumns: columns.some((c) => c.type === 'number') };
};

/* ------------------------------------------------------------------------------------------------
 * Answer validation
 * ---------------------------------------------------------------------------------------------- */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const isRealDate = (value: string): boolean => {
  if (!DATE_RE.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
};

const testPattern = (pattern: string | undefined, value: string): boolean => {
  if (!pattern) return true;
  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true; // an unusable pattern is refused when the form is published, never at fill time
  }
};

/** The error for one answer, or null. Does not look at visibility; callers skip hidden fields. */
export const validateFieldValue = (field: SurveyField, value: unknown): string | null => {
  if (field.type === 'heading' || field.type === 'auto_sum') return null;
  const v = field.validation || {};

  const missing =
    field.type === 'checkbox'
      ? value !== true
      : field.type === 'file' || field.type === 'photo'
        ? !isFileAnswer(value)
        : isEmptyAnswer(value);
  if (missing) return field.required ? 'This field is required.' : null;

  const fail = (message: string) => v.message?.trim() || message;

  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'email':
    case 'phone': {
      if (typeof value !== 'string' && typeof value !== 'number') return fail('Please enter text.');
      const text = String(value).trim();
      const ceiling = field.type === 'textarea' ? FORM_LIMITS.longTextAnswer : FORM_LIMITS.textAnswer;
      if (text.length > ceiling) return fail(`Please keep this under ${ceiling} characters.`);
      if (field.type === 'email' && !EMAIL_RE.test(text)) return fail('Please enter a valid email address.');
      if (field.type === 'phone' && !PHONE_RE.test(text.replace(/[\s()-]/g, ''))) return fail('Please enter a valid phone number.');
      if (v.minLength !== undefined && text.length < v.minLength) return fail(`Please enter at least ${v.minLength} characters.`);
      if (v.maxLength !== undefined && text.length > v.maxLength) return fail(`Please enter no more than ${v.maxLength} characters.`);
      if (!testPattern(v.pattern, text)) return fail('Please check the format of this answer.');
      return null;
    }
    case 'number': {
      const n = parseNumber(value);
      if (n === null) return fail('Please enter a number.');
      if (v.min !== undefined && n < v.min) return fail(`Please enter ${v.min} or more.`);
      if (v.max !== undefined && n > v.max) return fail(`Please enter ${v.max} or less.`);
      return null;
    }
    case 'date':
      return typeof value === 'string' && isRealDate(value) ? null : fail('Please choose a valid date.');
    case 'select':
    case 'radio':
      return (field.options || []).some((o) => o.value === value) ? null : fail('Please choose one of the options.');
    case 'multiselect': {
      if (!Array.isArray(value)) return fail('Please choose from the options.');
      const allowed = new Set((field.options || []).map((o) => o.value));
      if (value.some((item) => typeof item !== 'string' || !allowed.has(item))) return fail('Please choose from the options.');
      if (v.min !== undefined && value.length < v.min) return fail(`Please choose at least ${v.min}.`);
      if (v.max !== undefined && value.length > v.max) return fail(`Please choose no more than ${v.max}.`);
      return null;
    }
    case 'checkbox':
      return typeof value === 'boolean' ? null : fail('Please tick or untick this box.');
    case 'file':
    case 'photo':
      return null;
    case 'table': {
      if (!isTableValue(value)) return fail('Please fill in the table.');
      const table = field.table;
      const columns = table?.columns || [];
      const maxRows = (table?.rows.length || 0) + (tableAllowsAddingRows(table) ? FORM_LIMITS.tableAddedRows : 0);
      if (value.length > maxRows) return fail('This table has too many rows.');
      for (const row of value) {
        if (row.length > columns.length) return fail('This table has too many columns.');
        for (let c = 0; c < row.length; c++) {
          const cell = row[c];
          if (isEmptyAnswer(cell)) continue;
          if (String(cell).length > FORM_LIMITS.cell) return fail('Please shorten the table entries.');
          if (columns[c]?.type === 'number' && parseNumber(cell) === null) {
            return fail(`"${columns[c].title || `Column ${c + 1}`}" accepts numbers only.`);
          }
        }
      }
      return null;
    }
    default:
      return null;
  }
};

/**
 * Errors for every visible field (or only those on `pageId`), keyed by answer key.
 * Hidden and disabled fields are never required.
 */
export const validateAnswers = (
  content: SurveyFormContent,
  answers: Answers,
  options: { pageId?: number } = {}
): Record<string, string> => {
  const visible = visibleFieldIds(content, answers);
  const errors: Record<string, string> = {};
  for (const page of content.pages || []) {
    if (options.pageId !== undefined && page.id !== options.pageId) continue;
    for (const field of page.fields || []) {
      if (!visible.has(field.id)) continue;
      const error = validateFieldValue(field, answers[answerKey(field.id)]);
      if (error) errors[answerKey(field.id)] = error;
    }
  }
  return errors;
};

/* ------------------------------------------------------------------------------------------------
 * Sanitising (server: every write; client: before sending)
 * ---------------------------------------------------------------------------------------------- */

const cleanText = (value: unknown, max: number): string | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value !== 'string') return undefined;
  return value.slice(0, max);
};

const cleanValue = (field: SurveyField, value: unknown): unknown => {
  switch (field.type) {
    case 'text':
    case 'email':
    case 'phone':
    case 'date':
    case 'select':
    case 'radio':
      return cleanText(value, FORM_LIMITS.textAnswer);
    case 'textarea':
      return cleanText(value, FORM_LIMITS.longTextAnswer);
    case 'number':
      return typeof value === 'number' ? (Number.isFinite(value) ? value : undefined) : cleanText(value, 50);
    case 'multiselect':
      return Array.isArray(value)
        ? Array.from(new Set(value.filter((item): item is string => typeof item === 'string'))).slice(0, FORM_LIMITS.options)
        : undefined;
    case 'checkbox':
      return value === true || value === 'true' ? true : value === false || value === 'false' ? false : undefined;
    case 'file':
    case 'photo':
      if (!isFileAnswer(value)) return undefined;
      return {
        documentId: value.documentId,
        fileName: String(value.fileName || 'file').slice(0, 200),
        ...(typeof value.mimeType === 'string' ? { mimeType: value.mimeType.slice(0, 100) } : {}),
        ...(typeof value.size === 'number' && Number.isFinite(value.size) ? { size: value.size } : {}),
      };
    case 'table': {
      if (!isTableValue(value)) return undefined;
      const columns = field.table?.columns.length || 0;
      const maxRows = (field.table?.rows.length || 0) + FORM_LIMITS.tableAddedRows;
      return value.slice(0, maxRows).map((row) =>
        Array.from({ length: columns }, (_, c) => {
          const cell = row[c];
          return typeof cell === 'string' || typeof cell === 'number' ? String(cell).slice(0, FORM_LIMITS.cell) : '';
        })
      );
    }
    default:
      return undefined;
  }
};

/**
 * Keeps only answers this form can hold, each in its expected shape, and recomputes auto-sums.
 *
 * `dropHidden` (submit) also removes answers of fields that are hidden or disabled for these answers,
 * so a stale answer behind a condition never reaches the record. A draft keeps them: the respondent
 * may still change the answer that hides them.
 */
export const sanitizeAnswers = (
  content: SurveyFormContent,
  answers: unknown,
  options: { dropHidden: boolean }
): Answers => {
  const source: Answers = answers && typeof answers === 'object' && !Array.isArray(answers) ? (answers as Answers) : {};
  const out: Answers = {};
  for (const field of allFields(content)) {
    if (!hasAnswer(field) || field.type === 'auto_sum' || !isEnabled(field)) continue;
    const key = answerKey(field.id);
    if (!Object.prototype.hasOwnProperty.call(source, key)) continue;
    const cleaned = cleanValue(field, source[key]);
    if (cleaned !== undefined) out[key] = cleaned;
  }
  let result = applyAutoSums(content, out);
  if (options.dropHidden) {
    const visible = visibleFieldIds(content, result);
    result = Object.fromEntries(
      Object.entries(result).filter(([key]) => {
        const id = fieldIdFromKey(key);
        return id !== null && visible.has(id);
      })
    );
  }
  return result;
};

/** Numbers stored as numbers once an answer has passed validation ("25,000" -> 25000). */
export const normalizeAnswers = (content: SurveyFormContent, answers: Answers): Answers => {
  const out: Answers = { ...answers };
  for (const field of allFields(content)) {
    if (field.type !== 'number') continue;
    const key = answerKey(field.id);
    if (!(key in out)) continue;
    const n = parseNumber(out[key]);
    if (n === null) delete out[key];
    else out[key] = n;
  }
  return out;
};

/** Document ids referenced by file and photo answers. */
export const fileDocumentIds = (content: SurveyFormContent, answers: Answers): string[] =>
  allFields(content)
    .filter((f) => f.type === 'file' || f.type === 'photo')
    .map((f) => answers[answerKey(f.id)])
    .filter(isFileAnswer)
    .map((file) => file.documentId);

/* ------------------------------------------------------------------------------------------------
 * Display
 * ---------------------------------------------------------------------------------------------- */

/** One line of text for an answer: list cells, CSV columns, search. */
export const formatAnswer = (field: SurveyField, value: unknown): string => {
  if (isEmptyAnswer(value) && value !== false) return '';
  switch (field.type) {
    case 'select':
    case 'radio':
      return optionLabel(field, value);
    case 'multiselect':
      return Array.isArray(value) ? value.map((item) => optionLabel(field, item)).join(', ') : '';
    case 'checkbox':
      return value === true ? 'Yes' : 'No';
    case 'file':
    case 'photo':
      return isFileAnswer(value) ? value.fileName : '';
    case 'table':
      if (!isTableValue(value)) return '';
      return value
        .map((row, r) => ({ label: tableRowLabel(field.table, r), cells: row.map((c) => String(c ?? '').trim()) }))
        .filter((row) => row.cells.some(Boolean))
        .map((row) => `${row.label}: ${row.cells.join(' / ')}`)
        .join('; ');
    default:
      return String(value);
  }
};

/* ------------------------------------------------------------------------------------------------
 * Auto-fill from the linked family or member
 * ---------------------------------------------------------------------------------------------- */

export interface AutoFillSource {
  key: string;
  label: string;
  scope: 'family' | 'member';
  fieldTypes: SurveyFieldType[];
}

const TEXTUAL: SurveyFieldType[] = ['text', 'textarea'];
const CHOICE: SurveyFieldType[] = ['select', 'radio'];

export const AUTO_FILL_SOURCES: AutoFillSource[] = [
  { key: 'family.houseName', label: 'House name', scope: 'family', fieldTypes: TEXTUAL },
  { key: 'family.familyHead', label: 'Family head', scope: 'family', fieldTypes: TEXTUAL },
  { key: 'family.contactNo', label: 'Family contact number', scope: 'family', fieldTypes: ['phone', ...TEXTUAL] },
  { key: 'family.houseNo', label: 'House number', scope: 'family', fieldTypes: TEXTUAL },
  { key: 'family.wardNumber', label: 'Ward number', scope: 'family', fieldTypes: ['number', ...TEXTUAL] },
  { key: 'family.area', label: 'Area', scope: 'family', fieldTypes: [...CHOICE, ...TEXTUAL] },
  { key: 'family.place', label: 'Place', scope: 'family', fieldTypes: [...CHOICE, ...TEXTUAL] },
  { key: 'member.name', label: 'Member name', scope: 'member', fieldTypes: TEXTUAL },
  { key: 'member.gender', label: 'Gender', scope: 'member', fieldTypes: [...CHOICE, ...TEXTUAL] },
  { key: 'member.age', label: 'Age', scope: 'member', fieldTypes: ['number', ...TEXTUAL] },
  { key: 'member.dateOfBirth', label: 'Date of birth', scope: 'member', fieldTypes: ['date', 'text'] },
  { key: 'member.phone', label: 'Member phone', scope: 'member', fieldTypes: ['phone', ...TEXTUAL] },
  { key: 'member.maritalStatus', label: 'Marital status', scope: 'member', fieldTypes: [...CHOICE, ...TEXTUAL] },
  { key: 'member.education', label: 'Education', scope: 'member', fieldTypes: [...CHOICE, ...TEXTUAL] },
  { key: 'member.occupation', label: 'Occupation', scope: 'member', fieldTypes: [...CHOICE, ...TEXTUAL] },
  { key: 'member.bloodGroup', label: 'Blood group', scope: 'member', fieldTypes: [...CHOICE, ...TEXTUAL] },
];

/** Sources a field of `type` may use. A member survey also reaches the member's family. */
export const autoFillSourcesFor = (type: SurveyFieldType, respondentType: RespondentType): AutoFillSource[] =>
  respondentType === 'none'
    ? []
    : AUTO_FILL_SOURCES.filter(
        (s) => s.fieldTypes.includes(type) && (s.scope === 'family' || respondentType === 'member')
      );

export interface RespondentRecord {
  family?: Record<string, unknown> | null;
  member?: Record<string, unknown> | null;
}

const humanize = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

/** The value `field` takes from the respondent's record, snapped to an option for choice fields. */
export const resolveAutoFill = (field: SurveyField, record: RespondentRecord): unknown => {
  const source = AUTO_FILL_SOURCES.find((s) => s.key === field.autoFill);
  if (!source || !source.fieldTypes.includes(field.type)) return undefined;
  const [scope, prop] = source.key.split('.');
  const raw = (scope === 'family' ? record.family : record.member)?.[prop];
  if (raw === null || raw === undefined || raw === '') return undefined;
  let value: string;
  if (prop === 'dateOfBirth') value = String(raw).slice(0, 10);
  else value = String(raw);
  if (field.type === 'select' || field.type === 'radio') {
    const wanted = value.trim().toLowerCase();
    const human = humanize(value).toLowerCase();
    const match = (field.options || []).find((o) => {
      const label = o.label.trim().toLowerCase();
      return o.value.toLowerCase() === wanted || label === wanted || label === human;
    });
    return match ? match.value : undefined;
  }
  if (field.type === 'number') return parseNumber(value) ?? undefined;
  if (field.type === 'date' && !isRealDate(value)) return undefined;
  if (TEXTUAL.includes(field.type) && /^[a-z_]+$/.test(value)) return humanize(value); // category keys
  return value;
};

/** Auto-filled values for every EMPTY mapped field, so a draft or the user's own input always wins. */
export const buildAutoFillUpdates = (content: SurveyFormContent, record: RespondentRecord, current: Answers): Answers => {
  const updates: Answers = {};
  for (const field of allFields(content)) {
    if (!field.autoFill || !isEnabled(field)) continue;
    const key = answerKey(field.id);
    if (!isEmptyAnswer(current[key])) continue;
    const value = resolveAutoFill(field, record);
    if (value !== undefined) updates[key] = value;
  }
  return updates;
};

/* ------------------------------------------------------------------------------------------------
 * Normalising a form definition (server: before storing; builder: on load)
 * ---------------------------------------------------------------------------------------------- */

const str = (value: unknown, max: number): string => (typeof value === 'string' ? value.slice(0, max) : '');
const optStr = (value: unknown, max: number): string | undefined => {
  const s = str(value, max).trim();
  return s ? s : undefined;
};
const optNum = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : undefined;
const CONDITION_OPERATORS: ConditionOperator[] = ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'is_empty', 'is_not_empty'];

const normalizeField = (raw: unknown): SurveyField | null => {
  if (!raw || typeof raw !== 'object') return null;
  const f = raw as Record<string, unknown>;
  const id = Number(f.id);
  if (!isWholeNumberValue(id) || !isFieldType(f.type)) return null;
  const type = f.type;
  const meta = FIELD_TYPES[type];
  const field: SurveyField = {
    id,
    type,
    label: str(f.label, FORM_LIMITS.label),
    required: meta.takesInput && f.required === true,
  };
  if (f.enabled === false) field.enabled = false;
  const help = optStr(f.helpText, FORM_LIMITS.helpText);
  if (help) field.helpText = help;
  const placeholder = meta.hasPlaceholder ? optStr(f.placeholder, FORM_LIMITS.placeholder) : undefined;
  if (placeholder) field.placeholder = placeholder;
  if (meta.hasOptions) {
    field.options = (Array.isArray(f.options) ? f.options : [])
      .slice(0, FORM_LIMITS.options)
      .map((o) => (o && typeof o === 'object' ? (o as Record<string, unknown>) : {}))
      .map((o) => ({ value: str(o.value, 40), label: str(o.label, FORM_LIMITS.optionLabel) }))
      .filter((o) => o.value);
  }
  if (f.validation && typeof f.validation === 'object') {
    const v = f.validation as Record<string, unknown>;
    const validation: FieldValidation = {};
    if (type === 'number' || type === 'multiselect') {
      const min = optNum(v.min);
      const max = optNum(v.max);
      if (min !== undefined) validation.min = min;
      if (max !== undefined) validation.max = max;
    }
    if (type === 'text' || type === 'textarea') {
      const minLength = optNum(v.minLength);
      const maxLength = optNum(v.maxLength);
      if (minLength !== undefined && minLength >= 0) validation.minLength = Math.floor(minLength);
      if (maxLength !== undefined && maxLength > 0) validation.maxLength = Math.floor(maxLength);
      const pattern = optStr(v.pattern, 300);
      if (pattern) validation.pattern = pattern;
    }
    const message = optStr(v.message, 300);
    if (message) validation.message = message;
    if (Object.keys(validation).length) field.validation = validation;
  }
  if (type === 'table') {
    const t = f.table && typeof f.table === 'object' ? (f.table as Record<string, unknown>) : {};
    const columns = (Array.isArray(t.columns) ? t.columns : [])
      .slice(0, FORM_LIMITS.tableColumns)
      .map((c) => (c && typeof c === 'object' ? (c as Record<string, unknown>) : {}))
      .map((c) => ({ title: str(c.title, FORM_LIMITS.optionLabel), type: c.type === 'number' ? ('number' as const) : ('text' as const) }));
    const rows = (Array.isArray(t.rows) ? t.rows : []).slice(0, FORM_LIMITS.tableRows).map((r) => str(r, FORM_LIMITS.optionLabel));
    field.table = {
      columns,
      rows,
      ...(optStr(t.rowHeader, FORM_LIMITS.optionLabel) ? { rowHeader: optStr(t.rowHeader, FORM_LIMITS.optionLabel) } : {}),
      allowAddRows: rows.length === 0 || t.allowAddRows === true,
      showTotals: t.showTotals === true,
    };
  }
  if (type === 'auto_sum') {
    field.sumFields = Array.from(new Set((Array.isArray(f.sumFields) ? f.sumFields : []).map(Number).filter(isWholeNumberValue)));
  }
  if (f.condition && typeof f.condition === 'object') {
    const c = f.condition as Record<string, unknown>;
    const fieldId = Number(c.fieldId);
    const operator = c.operator as ConditionOperator;
    if (isWholeNumberValue(fieldId) && CONDITION_OPERATORS.includes(operator)) {
      field.condition = {
        fieldId,
        operator,
        action: c.action === 'hide' ? 'hide' : 'show',
        ...(operatorNeedsValue(operator) ? { value: str(c.value, FORM_LIMITS.optionLabel) } : {}),
      };
    }
  }
  const autoFill = optStr(f.autoFill, 60);
  if (autoFill && AUTO_FILL_SOURCES.some((s) => s.key === autoFill)) field.autoFill = autoFill;
  return field;
};

const isWholeNumberValue = (n: number): boolean => Number.isInteger(n) && n > 0;

/** Keeps only the properties this engine knows, each in its expected shape. */
export const normalizeFormContent = (raw: unknown): SurveyFormContent => {
  const source = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pages = (Array.isArray(source.pages) ? source.pages : []).map((rawPage) => {
    const p = rawPage && typeof rawPage === 'object' ? (rawPage as Record<string, unknown>) : {};
    const page: SurveyPage = {
      id: Number(p.id),
      title: str(p.title, FORM_LIMITS.label),
      fields: (Array.isArray(p.fields) ? p.fields : []).map(normalizeField).filter((f): f is SurveyField => f !== null),
    };
    const description = optStr(p.description, FORM_LIMITS.helpText);
    if (description) page.description = description;
    return page;
  });
  const instructions = (Array.isArray(source.instructions) ? source.instructions : [])
    .map((line) => str(line, FORM_LIMITS.instruction).trim())
    .filter(Boolean);
  return { pages, instructions };
};

/** Largest field and page ids in use, so a monotonic counter never falls behind the form. */
export const maxIds = (content: SurveyFormContent): { field: number; page: number } => ({
  field: allFields(content).reduce((max, f) => Math.max(max, f.id), 0),
  page: (content.pages || []).reduce((max, p) => Math.max(max, p.id), 0),
});

/* ------------------------------------------------------------------------------------------------
 * Form structure validation (builder save and publish)
 * ---------------------------------------------------------------------------------------------- */

const isWholeNumber = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;

/**
 * Problems with a form definition, in words an admin can act on. Empty when the form is fine.
 *
 * Saving checks what keeps the stored document sound (ids, types, sizes). Publishing also checks
 * that the form is complete and fillable: labels, options, table columns, sum sources and that
 * every condition points at an earlier field with an operator that suits it.
 */
export const validateFormStructure = (
  content: SurveyFormContent,
  options: { forPublish: boolean; respondentType?: RespondentType }
): string[] => {
  const problems: string[] = [];
  const pages = Array.isArray(content?.pages) ? content.pages : [];
  const instructions = Array.isArray(content?.instructions) ? content.instructions : [];

  if (pages.length > FORM_LIMITS.pages) problems.push(`A form can have up to ${FORM_LIMITS.pages} pages.`);
  if (instructions.length > FORM_LIMITS.instructions) problems.push(`Please keep instructions to ${FORM_LIMITS.instructions} points.`);
  if (instructions.some((line) => typeof line !== 'string' || line.length > FORM_LIMITS.instruction)) {
    problems.push(`Please keep each instruction under ${FORM_LIMITS.instruction} characters.`);
  }

  const fields = pages.flatMap((page) => (Array.isArray(page.fields) ? page.fields : []));
  if (fields.length > FORM_LIMITS.fields) problems.push(`A form can have up to ${FORM_LIMITS.fields} fields.`);

  const pageIds = new Set<number>();
  for (const page of pages) {
    if (!isWholeNumber(page.id) || pageIds.has(page.id)) problems.push('Two pages share an id. Please reload the builder.');
    pageIds.add(page.id);
    if ((page.title || '').length > FORM_LIMITS.label) problems.push('A page title is too long.');
  }

  const seen = new Map<number, number>(); // field id -> position in form order
  fields.forEach((field, index) => {
    if (!isWholeNumber(field.id) || seen.has(field.id)) problems.push('Two fields share an id. Please reload the builder.');
    seen.set(field.id, index);
    if (!isFieldType(field.type)) problems.push(`"${field.label || 'A field'}" has an unknown type.`);
    if ((field.label || '').length > FORM_LIMITS.label) problems.push(`"${field.label.slice(0, 40)}…" has a label that is too long.`);
    if ((field.helpText || '').length > FORM_LIMITS.helpText) problems.push(`"${field.label}" has help text that is too long.`);
    if ((field.placeholder || '').length > FORM_LIMITS.placeholder) problems.push(`"${field.label}" has a placeholder that is too long.`);
    if ((field.options || []).length > FORM_LIMITS.options) problems.push(`"${field.label}" has too many options.`);
    if ((field.options || []).some((o) => !o || typeof o.value !== 'string' || !o.value || (o.label || '').length > FORM_LIMITS.optionLabel)) {
      problems.push(`"${field.label}" has an option that is too long or empty.`);
    }
    const table = field.table;
    if (table && ((table.columns || []).length > FORM_LIMITS.tableColumns || (table.rows || []).length > FORM_LIMITS.tableRows)) {
      problems.push(`"${field.label}" has too many rows or columns.`);
    }
  });

  if (!options.forPublish) return Array.from(new Set(problems));

  if (pages.length === 0) problems.push('Add at least one page before publishing.');
  if (!fields.some((f) => isEnabled(f) && FIELD_TYPES[f.type]?.takesInput)) {
    problems.push('Add at least one question before publishing.');
  }

  const byId = new Map(fields.map((f) => [f.id, f] as const));
  pages.forEach((page, p) => {
    const where = `Page ${p + 1}`;
    if (!page.title?.trim()) problems.push(`${where} needs a title.`);
    if (!(page.fields || []).length) problems.push(`${where} has no fields.`);
    for (const field of page.fields || []) {
      const name = field.label?.trim() ? `"${field.label.trim()}"` : 'A field';
      const at = `${where} › ${name}`;
      if (!field.label?.trim()) problems.push(`${where}: every field needs a label.`);
      const meta = FIELD_TYPES[field.type];
      if (!meta) continue;
      if (meta.hasOptions) {
        const opts = field.options || [];
        if (opts.length === 0) problems.push(`${at}: add at least one option.`);
        if (opts.some((o) => !o.label?.trim())) problems.push(`${at}: an option has no text.`);
        if (new Set(opts.map((o) => o.value)).size !== opts.length) problems.push(`${at}: two options share a key. Delete and re-add one.`);
        if (new Set(opts.map((o) => o.label.trim().toLowerCase())).size !== opts.length) problems.push(`${at}: two options have the same text.`);
      }
      if (field.type === 'table') {
        const cols = field.table?.columns || [];
        if (cols.length === 0) problems.push(`${at}: add at least one column.`);
        if (cols.some((c) => !c.title?.trim())) problems.push(`${at}: every column needs a title.`);
      }
      if (field.type === 'auto_sum' && sumSources(field, content).length === 0) {
        problems.push(`${at}: choose at least one number field to add up.`);
      }
      const v = field.validation;
      if (v?.pattern) {
        try {
          new RegExp(v.pattern);
        } catch {
          problems.push(`${at}: the format pattern is not valid.`);
        }
      }
      if (v && v.min !== undefined && v.max !== undefined && v.min > v.max) problems.push(`${at}: the minimum is above the maximum.`);
      if (v && v.minLength !== undefined && v.maxLength !== undefined && v.minLength > v.maxLength) {
        problems.push(`${at}: the minimum length is above the maximum length.`);
      }
      const cond = field.condition;
      if (cond && cond.fieldId) {
        const dep = byId.get(cond.fieldId);
        const depAt = seen.get(cond.fieldId);
        const selfAt = seen.get(field.id);
        if (!dep || depAt === undefined || selfAt === undefined || depAt >= selfAt) {
          problems.push(`${at}: its condition must depend on a field that comes before it.`);
        } else if (!FIELD_TYPES[dep.type]?.conditionOperators.includes(cond.operator)) {
          problems.push(`${at}: its condition does not suit the type of "${dep.label}".`);
        } else if (operatorNeedsValue(cond.operator) && !(cond.value ?? '').toString().trim()) {
          problems.push(`${at}: its condition needs a value.`);
        } else if ((dep.type === 'select' || dep.type === 'radio' || dep.type === 'multiselect') && operatorNeedsValue(cond.operator) &&
          !(dep.options || []).some((o) => o.value === cond.value)) {
          problems.push(`${at}: its condition points at an option of "${dep.label}" that no longer exists.`);
        }
      }
      if (field.autoFill) {
        const allowed = autoFillSourcesFor(field.type, options.respondentType || 'none');
        if (!allowed.some((s) => s.key === field.autoFill)) {
          problems.push(`${at}: its auto-fill source does not suit this field or this survey's respondent.`);
        }
      }
    }
  });

  return Array.from(new Set(problems));
};
