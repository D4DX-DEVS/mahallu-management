import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  RiArrowLeftLine,
  RiArrowRightLine,
  RiArrowRightSLine,
  RiCheckLine,
  RiCheckboxCircleFill,
  RiErrorWarningLine,
  RiExternalLinkLine,
  RiInformationLine,
  RiLightbulbLine,
  RiRestartLine,
} from 'react-icons/ri';
import PageHeader from '@/components/layout/PageHeader';
import { Button, Card } from '@/components/ui';
import { ROUTES } from '@/constants/routes';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/cn';
import { guideChapters, guideGroups } from '../content';
import type { GuideChapter, GuideSection } from '../content/types';
import shotsJson from '../content/shots.json';
import GuideFigure from '../components/GuideFigure';
import GuideText from '../components/GuideText';
import { useGuideProgress, useUserGuideProgress } from '../guideProgress';

const GUIDE_PATH = ROUTES.GUIDE;
const chapterPath = (id: string) => `${GUIDE_PATH}/${id}`;
const shots = shotsJson as Record<string, { marks: { n: number }[] }>;

/* ------------------------------------------------------------------ home */

function ProgressBar({ value, total }: { value: number; total: number }) {
  const percent = total ? Math.round((value / total) * 100) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={value}
      aria-label="ഗൈഡ് പുരോഗതി"
      className="h-2 w-full overflow-hidden rounded-full bg-primary/15"
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${percent}%` }} />
    </div>
  );
}

function ChapterCard({ chapter, index, done }: { chapter: GuideChapter; index: number; done: boolean }) {
  const Icon = chapter.icon;
  return (
    <Link
      to={chapterPath(chapter.id)}
      className="group flex h-full gap-3.5 rounded-lg border border-border bg-card p-4 shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg',
          done ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
        )}
      >
        {done ? <RiCheckLine className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className="text-xs font-semibold tabular-nums text-muted-foreground">{String(index + 1).padStart(2, '0')}</span>
          <span className="text-base font-semibold text-foreground">{chapter.title}</span>
        </span>
        <span lang="en" className="block text-xs font-medium text-muted-foreground">
          {chapter.titleEn}
        </span>
        <span className="mt-1.5 block text-sm text-muted-foreground">{chapter.summary}</span>
        <span className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{chapter.sections.length} ഭാഗങ്ങൾ</span>
          {done && <span className="font-semibold text-success">· പൂർത്തിയായി</span>}
        </span>
      </span>
      <RiArrowRightSLine
        className="h-5 w-5 flex-shrink-0 self-center text-muted-foreground transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </Link>
  );
}

function GuideHome({ userId }: { userId: string | undefined }) {
  const progress = useUserGuideProgress(userId);
  const reset = useGuideProgress((state) => state.reset);
  const doneCount = guideChapters.filter((chapter) => progress.done.includes(chapter.id)).length;
  const allDone = doneCount === guideChapters.length;
  const next =
    guideChapters.find((chapter) => chapter.id === progress.last && !progress.done.includes(chapter.id)) ??
    guideChapters.find((chapter) => !progress.done.includes(chapter.id)) ??
    guideChapters[0];
  const started = doneCount > 0 || Boolean(progress.last);

  return (
    <div className="guide-prose" lang="ml">
      <PageHeader
        title="ഉപയോക്തൃ ഗൈഡ്"
        description="മഹല്ല് അഡ്മിൻ എന്ന നിലയിൽ ZAAD ഉപയോഗിക്കാൻ വേണ്ടതെല്ലാം — ചിത്രങ്ങളോടുകൂടി, ഘട്ടം ഘട്ടമായി."
      />

      <Card padding="lg" className="mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-foreground">
              {allDone
                ? 'അഭിനന്ദനങ്ങൾ! എല്ലാ അധ്യായങ്ങളും പൂർത്തിയാക്കി.'
                : started
                  ? 'നിർത്തിയ ഇടത്തുനിന്ന് തുടരാം'
                  : 'ആദ്യമായാണോ? ഒന്നാം അധ്യായം മുതൽ ക്രമത്തിൽ വായിക്കൂ'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {allDone
                ? 'സംശയം വരുമ്പോൾ ഏത് അധ്യായവും വീണ്ടും തുറന്നു നോക്കാം. ഈ ഗൈഡ് സൈഡ്‌ബാറിൽ എപ്പോഴും ഉണ്ടാകും.'
                : 'അധ്യായങ്ങൾ ഒരു പുതിയ മഹല്ല് സജ്ജമാക്കേണ്ട ക്രമത്തിലാണ്. ആവശ്യമുള്ള അധ്യായം മാത്രം തുറന്നും വായിക്കാം.'}
            </p>
            <div className="mt-3 flex items-center gap-3">
              <ProgressBar value={doneCount} total={guideChapters.length} />
              <span className="flex-shrink-0 text-sm font-semibold tabular-nums text-foreground">
                {doneCount} / {guideChapters.length}
              </span>
            </div>
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {allDone ? (
              <Button variant="outline" icon={<RiRestartLine />} onClick={() => userId && reset(userId)}>
                വീണ്ടും തുടങ്ങുക
              </Button>
            ) : (
              <Link
                to={chapterPath(next.id)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                {started ? `തുടരുക: ${next.title}` : 'ഗൈഡ് തുടങ്ങുക'}
                <RiArrowRightLine className="h-4 w-4" aria-hidden="true" />
              </Link>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-9">
        {guideGroups.map((group) => {
          const chapters = guideChapters.filter((chapter) => chapter.group === group.id);
          if (chapters.length === 0) return null;
          return (
            <section key={group.id} aria-labelledby={`guide-group-${group.id}`}>
              <h2 id={`guide-group-${group.id}`} className="mb-3 text-base font-semibold text-foreground">
                {group.title}
              </h2>
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {chapters.map((chapter) => (
                  <ChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    index={guideChapters.indexOf(chapter)}
                    done={progress.done.includes(chapter.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- chapter */

const CALLOUTS = {
  tip: { icon: RiLightbulbLine, label: 'നുറുങ്ങ്', className: 'border-success/30 bg-success/[0.06]', iconClass: 'text-success' },
  note: { icon: RiInformationLine, label: 'ശ്രദ്ധിക്കുക', className: 'border-info/30 bg-info/[0.06]', iconClass: 'text-info' },
  warn: { icon: RiErrorWarningLine, label: 'മുന്നറിയിപ്പ്', className: 'border-warning/40 bg-warning/[0.08]', iconClass: 'text-warning' },
} as const;

function Callout({ kind, text }: { kind: keyof typeof CALLOUTS; text: string }) {
  const { icon: Icon, label, className, iconClass } = CALLOUTS[kind];
  return (
    <div className={cn('flex gap-3 rounded-lg border p-3.5 text-sm text-foreground', className)}>
      <Icon className={cn('mt-1 h-[18px] w-[18px] flex-shrink-0', iconClass)} aria-hidden="true" />
      <p className="min-w-0">
        <span className="font-semibold">{label}: </span>
        <GuideText text={text} />
      </p>
    </div>
  );
}

function SectionBlock({ section, number }: { section: GuideSection; number: number }) {
  const [activeMark, setActiveMark] = useState<number | null>(null);
  const marked = new Set((section.figure ? shots[section.figure]?.marks : undefined)?.map((mark) => mark.n));
  const hasSteps = Boolean(section.steps?.length);

  return (
    <section id={section.id} aria-labelledby={`${section.id}-title`} className="scroll-mt-4">
      <Card padding="lg">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <h2 id={`${section.id}-title`} className="flex min-w-0 items-baseline gap-2.5 text-lg font-semibold text-foreground">
            <span className="text-sm font-bold tabular-nums text-primary">{number}</span>
            <span className="min-w-0">{section.title}</span>
          </h2>
          {section.to && (
            <Link
              to={section.to}
              target="_blank"
              rel="noopener"
              className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-label font-semibold text-foreground shadow-sm transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              ഈ പേജ് തുറക്കുക
              <RiExternalLinkLine className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          )}
        </div>

        {section.menu && (
          <p className="mt-2 flex flex-wrap items-center gap-1 text-label text-muted-foreground">
            <span className="mr-1 font-semibold">മെനു:</span>
            {section.menu.map((label, index) => (
              <span key={label} className="inline-flex items-center gap-1">
                {index > 0 && <RiArrowRightSLine className="h-4 w-4" aria-hidden="true" />}
                <span lang="en" className="guide-ui-label">
                  {label}
                </span>
              </span>
            ))}
          </p>
        )}

        {section.intro && (
          <p className="mt-3 max-w-3xl text-sm text-foreground/90">
            <GuideText text={section.intro} />
          </p>
        )}

        {(section.figure || hasSteps) && (
          <div
            className={cn(
              'mt-4 grid grid-cols-[minmax(0,1fr)] gap-5',
              // The picture keeps its own thumbnail width; the steps take whatever is left.
              section.figure && hasSteps && 'xl:grid-cols-[auto_minmax(0,1fr)] xl:gap-7'
            )}
          >
            {section.figure && (
              <GuideFigure
                shot={section.figure}
                alt={section.caption ?? section.title}
                caption={section.caption}
                activeMark={activeMark}
                onMarkHover={setActiveMark}
              />
            )}
            {hasSteps && (
              <ol className="m-0 max-w-2xl list-none space-y-1 p-0">
                {section.steps!.map((step, index) => {
                  const n = index + 1;
                  const isMarked = marked.has(n);
                  return (
                    <li
                      key={n}
                      onMouseEnter={() => isMarked && setActiveMark(n)}
                      onMouseLeave={() => isMarked && setActiveMark(null)}
                      className={cn(
                        'flex gap-3 rounded-md px-2 py-1.5 text-sm text-foreground transition-colors',
                        isMarked && activeMark === n && 'guide-step-active'
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'guide-step-number mt-0.5 h-6 w-6 flex-shrink-0 text-xs',
                          isMarked ? 'guide-step-number-marked' : 'border border-border bg-muted text-muted-foreground'
                        )}
                      >
                        {n}
                      </span>
                      <span className="min-w-0 flex-1">
                        <GuideText text={step} />
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        )}

        {section.points && (
          <ul className="mt-4 max-w-3xl list-disc space-y-1.5 pl-5 text-sm text-foreground marker:text-primary">
            {section.points.map((point) => (
              <li key={point}>
                <GuideText text={point} />
              </li>
            ))}
          </ul>
        )}

        {(section.tip || section.note || section.warn) && (
          <div className="mt-4 max-w-3xl space-y-2.5">
            {section.tip && <Callout kind="tip" text={section.tip} />}
            {section.note && <Callout kind="note" text={section.note} />}
            {section.warn && <Callout kind="warn" text={section.warn} />}
          </div>
        )}
      </Card>
    </section>
  );
}

function ChapterView({ chapter, userId }: { chapter: GuideChapter; userId: string | undefined }) {
  const progress = useUserGuideProgress(userId);
  const setDone = useGuideProgress((state) => state.setDone);
  const setLast = useGuideProgress((state) => state.setLast);
  const index = guideChapters.indexOf(chapter);
  const previous = guideChapters[index - 1];
  const next = guideChapters[index + 1];
  const done = progress.done.includes(chapter.id);
  const group = guideGroups.find((item) => item.id === chapter.group);
  const Icon = chapter.icon;

  useEffect(() => {
    if (userId) setLast(userId, chapter.id);
    document.getElementById('main-content')?.scrollTo({ top: 0 });
  }, [chapter.id, userId, setLast]);

  return (
    <div className="guide-prose" lang="ml">
      <Link
        to={GUIDE_PATH}
        className="mb-4 inline-flex items-center gap-1.5 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <RiArrowLeftLine className="h-4 w-4" aria-hidden="true" />
        എല്ലാ അധ്യായങ്ങളും
      </Link>

      <PageHeader
        icon={Icon}
        eyebrow={`അധ്യായം ${index + 1} / ${guideChapters.length}${group ? ` · ${group.title}` : ''}`}
        title={chapter.title}
        description={chapter.summary}
        actions={
          done ? (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
              <RiCheckboxCircleFill className="h-[18px] w-[18px]" aria-hidden="true" />
              പൂർത്തിയായി
            </span>
          ) : undefined
        }
      />

      {chapter.sections.length > 2 && (
        <nav aria-label="ഈ അധ്യായത്തിൽ" className="mb-6 flex flex-wrap items-center gap-2 text-label">
          <span className="font-semibold text-muted-foreground">ഈ അധ്യായത്തിൽ:</span>
          {chapter.sections.map((section, sectionIndex) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={(event) => {
                event.preventDefault();
                document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
              className="rounded-full border border-border bg-card px-3 py-1 font-medium text-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {sectionIndex + 1}. {section.title}
            </a>
          ))}
        </nav>
      )}

      <div className="space-y-5">
        {chapter.sections.map((section, sectionIndex) => (
          <SectionBlock key={section.id} section={section} number={sectionIndex + 1} />
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        {previous ? (
          <Link
            to={chapterPath(previous.id)}
            className="inline-flex items-center gap-2 rounded-md text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RiArrowLeftLine className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            <span className="min-w-0">മുമ്പത്തേത്: {previous.title}</span>
          </Link>
        ) : (
          <span />
        )}
        <div className="flex flex-wrap items-center gap-2">
          {done ? (
            <Button variant="outline" onClick={() => userId && setDone(userId, chapter.id, false)}>
              പൂർത്തിയായില്ല എന്ന് മാറ്റുക
            </Button>
          ) : (
            <Button variant="outline" icon={<RiCheckLine />} onClick={() => userId && setDone(userId, chapter.id, true)}>
              ഈ അധ്യായം പൂർത്തിയായി
            </Button>
          )}
          <Link
            to={next ? chapterPath(next.id) : GUIDE_PATH}
            onClick={() => userId && setDone(userId, chapter.id, true)}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <span className="min-w-0">{next ? `അടുത്തത്: ${next.title}` : 'ഗൈഡ് പൂർത്തിയാക്കുക'}</span>
            <RiArrowRightLine className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ page */

export default function UserGuide() {
  const { chapterId } = useParams<{ chapterId?: string }>();
  const userId = useAuthStore((state) => state.user?.id);
  const chapter = useMemo(() => guideChapters.find((item) => item.id === chapterId), [chapterId]);
  const setWelcomed = useGuideProgress((state) => state.setWelcomed);

  /* Someone who found the guide on their own does not need it offered again on the dashboard. */
  useEffect(() => {
    if (userId) setWelcomed(userId);
  }, [userId, setWelcomed]);

  if (!chapterId) return <GuideHome userId={userId} />;
  if (!chapter) return <Navigate to={GUIDE_PATH} replace />;
  return <ChapterView chapter={chapter} userId={userId} />;
}
