import { useEffect, useId, useRef, type CSSProperties, type KeyboardEvent } from 'react';
import { FiArrowRight, FiPlus, FiX } from 'react-icons/fi';
import Modal from '@/components/ui/Modal';
import { ICON_PATH } from '@/constants/theme';
import { HERO, type HeroPoint } from '../content';
import { RequestDemoButton } from './shared';
import { LaptopFrame, PhoneFrame, DashboardScreen, MemberPortalScreen } from './mockups';

const POINTS = HERO.trust;

/** Staggered entrance for the n-th item, replayed whenever the tab changes. */
const riseAt = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

/* The customizable point's picture: a module list whose switches turn on one by one. */
const MODULES = [
  { label: 'Families', on: true },
  { label: 'Collections', on: true },
  { label: 'Certificates', on: true },
  { label: 'Welfare & Zakat', on: false },
  { label: 'Notices', on: true },
];

function ModulesCard() {
  return (
    <div className="w-full max-w-[290px] rounded-[18px] bg-white p-4 text-[#192024] shadow-[0_30px_50px_-24px_rgba(0,0,0,0.55)]">
      <div className="flex items-center gap-2">
        <img src={ICON_PATH} alt="" className="h-6 w-6 rounded-[7px]" />
        <span className="text-[13px] font-extrabold">Modules</span>
        <span className="ml-auto text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A959B]">Your Mahallu</span>
      </div>
      <ul className="mt-3 space-y-[6px]">
        {MODULES.map(({ label, on }, index) => (
          <li key={label} className="flex items-center gap-3 rounded-[10px] border border-[#EEF1F3] px-3 py-2 text-[12px] font-semibold">
            {label}
            <span
              className={`relative ml-auto h-[18px] w-[32px] shrink-0 rounded-full bg-[#D5DCD8] ${on ? 'lp-switch-on' : ''}`}
              style={{ '--lp-delay': `${500 + index * 220}ms` } as CSSProperties}
            >
              <span className="absolute left-[2px] top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.25)]" />
            </span>
          </li>
        ))}
        <li className="flex items-center justify-center gap-2 rounded-[10px] border border-dashed border-[#9CCBB2] px-3 py-2 text-[12px] font-bold text-[#15603B]">
          <FiPlus className="h-3.5 w-3.5" />
          Add a feature
        </li>
      </ul>
    </div>
  );
}

function PointVisual({ id }: { id: HeroPoint['id'] }) {
  if (id === 'web') {
    return (
      <LaptopFrame className="w-full max-w-[380px]">
        <DashboardScreen />
      </LaptopFrame>
    );
  }
  if (id === 'app') {
    return (
      <PhoneFrame className="w-[150px] lg:w-[170px]">
        <MemberPortalScreen />
      </PhoneFrame>
    );
  }
  return <ModulesCard />;
}

interface DetailBodyProps {
  index: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

function DetailBody({ index, onSelect, onClose }: DetailBodyProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const baseId = useId();
  const point = POINTS[index];
  const nextIndex = (index + 1) % POINTS.length;
  const next = POINTS[nextIndex];
  const { detail, icon: Icon } = point;
  const tabId = (i: number) => `${baseId}-tab-${i}`;
  const panelId = `${baseId}-panel`;

  // A new point starts at its top; "Next" sits at the bottom of a long sheet on phones.
  useEffect(() => {
    rootRef.current?.closest('.modal-body')?.scrollTo({ top: 0 });
  }, [index]);

  /* Arrow keys move between the tabs, as in any tab list. */
  const onTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const target = (index + step + POINTS.length) % POINTS.length;
    onSelect(target);
    event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[target]?.focus();
  };

  return (
    // Bleeds over the dialog body's padding, like the form dialogs do, so the green panel reaches the edges.
    // On wide screens one height fits every point, so the dialog does not jump when the tab changes.
    <div
      ref={rootRef}
      className="relative m-[calc(var(--modal-pad)*-1)] grid lg:min-h-[min(800px,92dvh)] lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
    >
      {/* First in the DOM, so it is what the dialog focuses on opening. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close details"
        className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white lg:bg-[#F1F5F3] lg:text-[#3A454B] lg:hover:bg-[#E3ECE7] lg:focus-visible:ring-[#15603B]"
      >
        <FiX className="h-[18px] w-[18px]" />
      </button>

      {/* Showcase: the point's name and a picture of it, on the brand green. */}
      <div className="relative flex flex-col overflow-hidden bg-[linear-gradient(150deg,#1B6E45_0%,#15603B_50%,#0F4A2E_100%)] px-5 pb-5 pt-5 text-white sm:px-8 sm:pb-0 sm:pt-8 lg:pb-8">
        <div className="lp-pattern pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="lp-glow pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-white/[0.06]" aria-hidden="true" />
        <div
          className="lp-glow pointer-events-none absolute -bottom-32 -left-16 h-72 w-72 rounded-full bg-[#8EDCB3]/10"
          style={{ animationDelay: '-5s' }}
          aria-hidden="true"
        />
        <div key={point.id} className="relative flex flex-1 flex-col">
          <div className="flex items-center gap-3 pr-10 sm:block sm:pr-0">
            <span className="lp-rise flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/15 ring-1 ring-white/20 sm:h-14 sm:w-14 sm:rounded-[16px]">
              <Icon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 sm:mt-5">
              <h2 className="lp-rise text-[19px] font-extrabold leading-[1.3] sm:text-[26px]" style={riseAt(60)}>
                {detail.title}
              </h2>
              <p className="lp-rise mt-[2px] text-[13px] font-semibold text-[#F2C14E] sm:mt-2 sm:text-[15px]" style={riseAt(120)}>
                {detail.subtitle}
              </p>
            </div>
          </div>
          <div className="mt-3 space-y-2 sm:mt-5">
            {detail.intro.map((paragraph, i) => (
              <p
                key={paragraph}
                className={`lp-rise text-[13.5px] leading-[1.65] sm:text-[15px] sm:leading-[1.7] ${i === 0 ? 'text-white/85' : 'font-semibold text-white'}`}
                style={riseAt(160 + i * 60)}
              >
                {paragraph}
              </p>
            ))}
          </div>
          <div className="lp-rise relative mt-8 hidden flex-1 items-center justify-center sm:flex" style={riseAt(260)} aria-hidden="true">
            <div className="lp-float lp-float--slow flex w-full justify-center">
              <PointVisual id={point.id} />
            </div>
          </div>
        </div>
      </div>

      {/* Details: tabs to move between the three points, then the point's own list. */}
      <div className="flex flex-col px-5 pb-5 pt-4 sm:px-8 sm:pb-8 sm:pt-7">
        <div
          role="tablist"
          aria-label="ZAAD at a glance"
          onKeyDown={onTabKeyDown}
          className="grid grid-cols-3 gap-1 rounded-[14px] bg-[#F1F5F3] p-1 lg:mr-12"
        >
          {POINTS.map(({ id, highlight, icon: TabIcon }, i) => {
            const selected = i === index;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                id={tabId(i)}
                aria-selected={selected}
                aria-controls={panelId}
                tabIndex={selected ? 0 : -1}
                onClick={() => onSelect(i)}
                className={`flex items-center justify-center gap-[6px] rounded-[10px] px-2 py-2 text-center text-[11.5px] font-bold leading-[1.25] transition-[background-color,color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15603B] sm:text-[12.5px] ${
                  selected
                    ? 'bg-white text-[#15603B] shadow-[0_6px_16px_-10px_rgba(21,96,59,0.7)]'
                    : 'text-[#5D696F] hover:bg-white/60 hover:text-[#192024]'
                }`}
              >
                <TabIcon className="hidden h-[14px] w-[14px] shrink-0 sm:block" aria-hidden="true" />
                {highlight}
              </button>
            );
          })}
        </div>

        <div key={point.id} role="tabpanel" id={panelId} aria-labelledby={tabId(index)} className="mt-4 flex-1 sm:mt-6">
          <ul className="space-y-1">
            {detail.points.map(({ title, text, icon: PointIcon }, i) => (
              <li
                key={text}
                className="lp-rise group flex items-start gap-3 rounded-[14px] px-2 py-2 transition-colors duration-200 hover:bg-[#F4F9F6] sm:-mx-2"
                style={riseAt(120 + i * 60)}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#E6F4EC] text-[#1F8A55] transition-[background-color,color,transform] duration-200 group-hover:scale-105 group-hover:bg-[#15603B] group-hover:text-white">
                  <PointIcon className="h-[17px] w-[17px]" aria-hidden="true" />
                </span>
                <span className="min-w-0 pt-[7px]">
                  {title && <span className="block text-[14px] font-bold leading-[1.45] text-[#192024] sm:text-[15px]">{title}</span>}
                  <span
                    className={`block leading-[1.55] ${
                      title ? 'mt-[2px] text-[13px] text-[#5D696F] sm:text-[13.5px]' : 'text-[13.5px] font-medium text-[#3A454B] sm:text-[14.5px]'
                    }`}
                  >
                    {text}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[#E6E9EE] pt-5 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => onSelect(nextIndex)}
            className="group inline-flex items-center justify-center gap-2 rounded-full px-1 py-2 text-[13px] font-bold text-[#15603B] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15603B]"
          >
            <span className="text-[#5D696F]">Next:</span> {next.highlight}
            <FiArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
          </button>
          <RequestDemoButton onAfterClick={onClose} />
        </div>
      </div>
    </div>
  );
}

interface HeroDetailDialogProps {
  /** Which hero point is open, or null when the dialog is closed. */
  index: number | null;
  onSelect: (index: number) => void;
  onClose: () => void;
}

/**
 * The "View details" sheet behind each hero point: a green showcase with a
 * picture of the point beside its full description, with tabs to move
 * between the three points without closing.
 */
export default function HeroDetailDialog({ index, onSelect, onClose }: HeroDetailDialogProps) {
  return (
    <Modal
      isOpen={index !== null}
      onClose={onClose}
      size="xl"
      className="max-w-[940px] rounded-[24px] border-0 bg-white font-landing text-[#192024] shadow-[0_40px_90px_-30px_rgba(10,40,25,0.6)]"
    >
      {index !== null && <DetailBody index={index} onSelect={onSelect} onClose={onClose} />}
    </Modal>
  );
}
