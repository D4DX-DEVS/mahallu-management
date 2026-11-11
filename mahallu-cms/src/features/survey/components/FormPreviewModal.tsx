import { useMemo, useState } from 'react';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import Segmented from '@/components/ui/Segmented';
import { Answers, SurveyFormContent, validateAnswers, visibleFieldIds } from '../formEngine';
import SurveyPageFields from './SurveyPageFields';
import PageStepper from './PageStepper';

interface FormPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: SurveyFormContent;
}

/** The form exactly as survey workers will see it, with the same renderer and validation. */
export default function FormPreviewModal({ isOpen, onClose, title, content }: FormPreviewModalProps) {
  const [answers, setAnswers] = useState<Answers>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pageIndex, setPageIndex] = useState(0);
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const visible = useMemo(() => visibleFieldIds(content, answers), [content, answers]);
  const pages = content.pages;
  const page = pages[Math.min(pageIndex, pages.length - 1)];

  const close = () => {
    setAnswers({});
    setErrors({});
    setPageIndex(0);
    onClose();
  };

  const next = () => {
    const found = validateAnswers(content, answers, { pageId: page.id });
    setErrors(found);
    if (Object.keys(found).length === 0) setPageIndex((i) => Math.min(i + 1, pages.length - 1));
  };

  return (
    <Modal isOpen={isOpen} onClose={close} title={`Preview: ${title}`} description="Answers here are not saved." size="xl">
      <div className="mb-3 flex justify-end">
        <Segmented
          aria-label="Preview width"
          size="sm"
          value={width}
          onChange={(v) => setWidth(v === 'phone' ? 'phone' : 'desktop')}
          options={[
            { value: 'desktop', label: 'Desktop' },
            { value: 'phone', label: 'Phone' },
          ]}
        />
      </div>
      <div className={`mx-auto ${width === 'phone' ? 'max-w-[380px] rounded-2xl border border-border p-3' : ''}`}>
        {!page ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Add a page and a question to preview the form.</p>
        ) : (
          <div className="space-y-4">
            {pageIndex === 0 && content.instructions.length > 0 && (
              <div className="rounded-lg border border-border bg-subtle/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Instructions</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-sm">
                  {content.instructions.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ol>
              </div>
            )}
            {pages.length > 1 && <PageStepper pages={pages} current={pageIndex} />}
            <div>
              <h3 className="text-base font-semibold">{page.title}</h3>
              {page.description && <p className="text-sm text-muted-foreground">{page.description}</p>}
            </div>
            <SurveyPageFields
              page={page}
              content={content}
              answers={answers}
              visible={visible}
              errors={errors}
              preview
              onChange={(key, value) => {
                setAnswers((prev) => ({ ...prev, [key]: value }));
                setErrors((prev) => ({ ...prev, [key]: '' }));
              }}
            />
            <div className="flex justify-between gap-2 border-t border-border pt-3">
              <Button type="button" variant="outline" disabled={pageIndex === 0} onClick={() => setPageIndex((i) => i - 1)}>
                Previous
              </Button>
              {pageIndex < pages.length - 1 ? (
                <Button type="button" onClick={next}>
                  Next
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    const found = validateAnswers(content, answers);
                    setErrors(found);
                  }}
                >
                  Check answers
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
