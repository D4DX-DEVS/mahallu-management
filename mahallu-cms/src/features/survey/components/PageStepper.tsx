import Stepper from '@/components/ui/Stepper';
import type { SurveyPage } from '../formEngine';
import { useNarrowerThan } from '../useNarrowerThan';

/** Below this width the page names are dropped and only the numbered steps show. */
const COMPACT_BREAKPOINT = 480;
/** Roughly the room one step needs with its page name beside it. */
const STEP_WIDTH = 160;

/**
 * The survey's page progress. Page names are free text and can be long, so when they will not fit
 * the stepper shows numbers only; the current page's name is the heading just below it.
 */
export default function PageStepper({
  pages,
  current,
  onStepClick,
}: {
  pages: SurveyPage[];
  current: number;
  onStepClick?: (index: number) => void;
}) {
  const [ref, compact] = useNarrowerThan<HTMLDivElement>(Math.max(COMPACT_BREAKPOINT, pages.length * STEP_WIDTH));
  return (
    <div ref={ref}>
      <Stepper
        steps={pages.map((p) => ({ id: String(p.id), label: p.title || 'Untitled' }))}
        current={current}
        onStepClick={onStepClick}
        compact={compact}
      />
    </div>
  );
}
