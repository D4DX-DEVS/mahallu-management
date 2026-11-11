import { Answers, SurveyFormContent, SurveyPage, answerKey } from '../formEngine';
import SurveyFieldInput from './SurveyFieldInput';

interface SurveyPageFieldsProps {
  page: SurveyPage;
  content: SurveyFormContent;
  answers: Answers;
  visible: Set<number>;
  errors?: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  preview?: boolean;
}

/** The visible fields of one page, in order. Used by the fill wizard and the builder preview. */
export default function SurveyPageFields({ page, content, answers, visible, errors = {}, onChange, preview }: SurveyPageFieldsProps) {
  const fields = page.fields.filter((field) => visible.has(field.id));
  if (fields.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">Nothing to answer on this page.</p>;
  }
  return (
    <div className="space-y-5">
      {fields.map((field) => {
        const key = answerKey(field.id);
        return (
          <div key={field.id} id={`survey-${key}`}>
            <SurveyFieldInput
              field={field}
              value={answers[key]}
              onChange={(value) => onChange(key, value)}
              error={errors[key]}
              content={content}
              answers={answers}
              preview={preview}
            />
          </div>
        );
      })}
    </div>
  );
}
