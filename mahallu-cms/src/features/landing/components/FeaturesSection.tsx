import { useId, useState } from 'react';
import { FiRotateCw } from 'react-icons/fi';
import { FEATURES, STEPS, type Feature } from '../content';
import { BTN_PRIMARY, CARD, CONTAINER } from '../styles';
import { Eyebrow, RequestDemoButton, SectionHeading } from './shared';
import { StepIllustration } from './illustrations';
import Reveal from './Reveal';

/*
 * Each card shows its icon and title, and turns over to its description: on
 * hover where there is a mouse, on a tap on touch screens, on Enter or Space
 * from the keyboard. Both faces stay in the accessibility tree, so a screen
 * reader hears the title and description whichever side is up.
 */
function FeatureCard({ title, body, icon: Icon, tint }: Feature) {
  const [flipped, setFlipped] = useState(false);
  const titleId = useId();
  const bodyId = useId();

  return (
    <button
      type="button"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      onClick={() => setFlipped((value) => !value)}
      // A mouse turns the card with hover, so a click must not leave it turned once the pointer moves on.
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') setFlipped(false);
      }}
      className={`lp-flip block h-full w-full rounded-[18px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#15603B] focus-visible:ring-offset-2 ${
        flipped ? 'is-flipped' : ''
      }`}
    >
      <span className="lp-flip-inner min-h-[212px] sm:min-h-[230px]">
        <span className={`${CARD} lp-flip-face relative flex flex-col items-center justify-center px-3 py-5 text-center sm:px-6 sm:py-9`}>
          <span
            className="flex h-12 w-12 items-center justify-center rounded-[14px] sm:h-16 sm:w-16 sm:rounded-[18px]"
            style={{ background: tint.bg, color: tint.fg }}
          >
            <Icon className="h-6 w-6 sm:h-7 sm:w-7" aria-hidden="true" />
          </span>
          <span id={titleId} className="mt-3 max-w-[260px] text-[13.5px] font-bold leading-[1.4] text-[#192024] sm:mt-5 sm:text-[17px] sm:leading-[1.45]">
            {title}
          </span>
          <FiRotateCw className="absolute bottom-2 right-2 h-3 w-3 text-[#A3ACB1] sm:bottom-4 sm:right-4 sm:h-4 sm:w-4" aria-hidden="true" />
        </span>
        <span className="lp-flip-face lp-flip-back flex flex-col justify-center rounded-[18px] bg-[linear-gradient(150deg,#1B6E45_0%,#15603B_50%,#0F4A2E_100%)] p-[10px] text-white shadow-[0_30px_50px_-30px_rgba(21,96,59,0.6)] sm:p-7">
          {/* Phones show the description alone: the card is small, and the title was just on its front. */}
          <span className="hidden items-center gap-3 sm:flex">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-white/15">
              <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
            </span>
            <span className="text-[15px] font-bold leading-[1.4]" aria-hidden="true">
              {title}
            </span>
          </span>
          <span id={bodyId} className="lp-flip-text text-[11px] leading-[1.45] text-white/90 sm:mt-4 sm:text-[14px] sm:leading-[1.75]">
            {body}
          </span>
        </span>
      </span>
    </button>
  );
}

export function KeyFeatures() {
  return (
    <section id="features" className="scroll-mt-[80px] py-12 sm:py-20">
      <div className={CONTAINER}>
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Key features"
            title={
              <>
                ZAAD-ന്റെ <span className="text-[#298959]">പ്രധാന സവിശേഷതകൾ</span>
              </>
            }
            subtitle="All the essential functions your committee needs, in one simple and secure platform."
          />
        </Reveal>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:mt-12 sm:gap-5 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal as="li" key={feature.title} delay={(index % 3) * 90} className="h-full">
              <FeatureCard {...feature} />
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-[80px] py-12 sm:py-20">
      <div className={`${CONTAINER} grid gap-6 sm:gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:items-center`}>
        <Reveal variant="left">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-2 text-[20px] font-extrabold leading-[1.2] tracking-[-0.02em] text-[#192024] sm:mt-4 sm:text-[27px]">
            Simple for everyone.
            <br />
            <span className="text-[#298959]">Powerful for your community.</span>
          </h2>
          <p className="mt-2 max-w-[420px] text-[14px] leading-[1.55] text-[#5D696F] sm:mt-4 sm:text-[16px] sm:leading-[1.6]">
            ZAAD is designed to be easy to use, even for volunteers with little technical experience.
          </p>
          <RequestDemoButton className={`${BTN_PRIMARY} mt-4 sm:mt-7`} />
        </Reveal>

        {/* The numbered circles pop in one after another and a line draws between them: across
            the row on wide screens, and down the left edge from circle to circle on phones,
            where each step is a small card with its picture beside the text. */}
        <Reveal variant="fade" className="relative" threshold={0.25}>
          <div className="lp-step-line absolute left-[12.5%] right-[12.5%] top-4 hidden h-[2px] bg-[#CFE3D7] lg:block" aria-hidden="true" />
          <ol className="grid grid-cols-1 gap-y-3 sm:grid-cols-2 sm:gap-y-8 lg:grid-cols-4 lg:gap-y-0">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={`relative flex flex-col px-5 max-sm:flex-row max-sm:items-start max-sm:gap-3 max-sm:px-0 max-sm:transition-transform max-sm:duration-150 max-sm:active:scale-[0.98] ${index > 0 ? 'lg:border-l lg:border-[#E6E9EE]' : ''}`}
              >
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="lp-step-vline absolute -bottom-3 left-[15px] top-8 w-[2px] bg-[#CFE3D7] sm:hidden"
                    style={{ transitionDelay: `${400 + index * 240}ms` }}
                  />
                )}
                <span
                  className="lp-step-num relative z-10 flex h-8 w-8 items-center justify-center self-center rounded-full bg-[#15603B] text-[14px] font-extrabold text-white shadow-[0_0_0_6px_#FFFFFF] max-sm:shrink-0 max-sm:self-start max-sm:shadow-[0_0_0_4px_#FFFFFF]"
                  style={{ animationDelay: `${250 + index * 240}ms` }}
                >
                  {index + 1}
                </span>
                <div
                  className="lp-step-body flex flex-1 flex-col max-sm:min-w-0 max-sm:flex-row max-sm:items-center max-sm:gap-3 max-sm:rounded-[14px] max-sm:border max-sm:border-[#E6E9EE] max-sm:bg-white max-sm:p-3 max-sm:shadow-[0_12px_28px_-22px_rgba(21,96,59,0.6)]"
                  style={{ transitionDelay: `${400 + index * 240}ms` }}
                >
                  <div className="flex-1 max-sm:min-w-0">
                    <h3 className="text-[14px] font-bold text-[#192024] sm:mt-5 sm:text-[15px]">{step.title}</h3>
                    <p className="mt-1 text-[12.5px] leading-[1.5] text-[#5D696F] sm:mt-2 sm:text-[13px] sm:leading-[1.55]">{step.body}</p>
                  </div>
                  <StepIllustration
                    step={(index + 1) as 1 | 2 | 3 | 4}
                    className="mt-auto w-full max-w-[220px] self-center pt-5 max-sm:mt-0 max-sm:w-[76px] max-sm:shrink-0 max-sm:pt-0"
                  />
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}
