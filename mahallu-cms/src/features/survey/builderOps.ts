import type { ComponentType } from 'react';
import {
  FiAlignLeft,
  FiBookmark,
  FiCalendar,
  FiCheck,
  FiCheckSquare,
  FiChevronDown,
  FiDisc,
  FiGrid,
  FiHash,
  FiImage,
  FiMail,
  FiPaperclip,
  FiPhone,
  FiPlusSquare,
  FiType,
} from 'react-icons/fi';
import {
  FIELD_TYPES,
  RespondentType,
  SurveyField,
  SurveyFieldType,
  SurveyFormContent,
  autoFillSourcesFor,
} from './formEngine';

/** Pure helpers the form builder uses to change a form. */

export const FIELD_ICONS: Record<SurveyFieldType, ComponentType<{ className?: string }>> = {
  text: FiType,
  textarea: FiAlignLeft,
  number: FiHash,
  email: FiMail,
  phone: FiPhone,
  date: FiCalendar,
  select: FiChevronDown,
  radio: FiDisc,
  multiselect: FiCheckSquare,
  checkbox: FiCheck,
  file: FiPaperclip,
  photo: FiImage,
  table: FiGrid,
  auto_sum: FiPlusSquare,
  heading: FiBookmark,
};

export const newOptionValue = (existing: { value: string }[] = []): string => {
  const taken = new Set(existing.map((o) => o.value));
  let value = '';
  do {
    value = `o${Math.random().toString(36).slice(2, 8)}`;
  } while (taken.has(value));
  return value;
};

const defaultOptions = () => {
  const first = { value: newOptionValue(), label: 'Option 1' };
  return [first, { value: newOptionValue([first]), label: 'Option 2' }];
};

export const newField = (type: SurveyFieldType, id: number): SurveyField => {
  const base: SurveyField = {
    id,
    type,
    label: type === 'heading' ? 'Section heading' : type === 'auto_sum' ? 'Total' : FIELD_TYPES[type].label,
    required: false,
  };
  if (FIELD_TYPES[type].hasOptions) base.options = defaultOptions();
  if (type === 'table') {
    base.table = {
      columns: [
        { title: 'Details', type: 'text' },
        { title: 'Amount', type: 'number' },
      ],
      rows: [],
      allowAddRows: true,
      showTotals: false,
    };
  }
  if (type === 'auto_sum') base.sumFields = [];
  return base;
};

/** Switches a field's type, keeping what still applies and dropping what no longer does. */
export const changeFieldType = (field: SurveyField, type: SurveyFieldType, respondentType: RespondentType): SurveyField => {
  const fresh = newField(type, field.id);
  const next: SurveyField = {
    ...fresh,
    label: field.label,
    helpText: field.helpText,
    required: FIELD_TYPES[type].takesInput ? field.required : false,
    enabled: field.enabled,
    condition: field.condition,
  };
  if (FIELD_TYPES[type].hasPlaceholder && field.placeholder) next.placeholder = field.placeholder;
  if (FIELD_TYPES[type].hasOptions && field.options?.length) next.options = field.options;
  if (field.autoFill && autoFillSourcesFor(type, respondentType).some((s) => s.key === field.autoFill)) next.autoFill = field.autoFill;
  return next;
};

/** Removes every reference to a deleted field: auto-sum sources and conditions. */
export const dropFieldReferences = (content: SurveyFormContent, removedId: number): SurveyFormContent => ({
  ...content,
  pages: content.pages.map((page) => ({
    ...page,
    fields: page.fields.map((f) => {
      let next = f;
      if (f.sumFields?.includes(removedId)) next = { ...next, sumFields: f.sumFields.filter((id) => id !== removedId) };
      if (f.condition?.fieldId === removedId) next = { ...next, condition: null };
      return next;
    }),
  })),
});

/** Labels of the fields that point at `id` (conditions, auto-sums), to warn before deleting it. */
export const referencesTo = (content: SurveyFormContent, id: number): string[] =>
  content.pages
    .flatMap((p) => p.fields)
    .filter((f) => f.id !== id && (f.condition?.fieldId === id || f.sumFields?.includes(id)))
    .map((f) => f.label || 'Untitled');

export const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
