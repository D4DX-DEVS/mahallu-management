import { FEATURES, STEPS } from '../content';
import { BTN_PRIMARY, CARD, CARD_HOVER, CONTAINER } from '../styles';
import { Eyebrow, RequestDemoButton, SectionHeading } from './shared';
import { StepIllustration } from './illustrations';
import Reveal from './Reveal';

function KeyFeatures() {
  return (
    <section id="features" className="scroll-mt-[80px] py-20">
      <div className={CONTAINER}>
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="Key features"
            title={
              <>
                Your entire Mahallu, <span className="text-[#298959]">organised.</span>
              </>
            }
            subtitle="All the essential functions your committee needs, in one simple and secure platform."
          />
        </Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ title, body, icon: Icon, tint }, index) => (
            <Reveal as="li" key={title} delay={(index % 4) * 90} className="h-full">
              <article className={`${CARD} ${CARD_HOVER} h-full p-6`}>
                <span
                  className="flex h-11 w-11 items-center justify-center rounded-[12px] transition-transform duration-300 ease-out group-hover:-rotate-6 group-hover:scale-110"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <h3 className="mt-5 text-[16px] font-bold text-[#192024]">{title}</h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#5D696F]">{body}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-[80px] pb-20">
      <div className={`${CONTAINER} grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.5fr)] lg:items-center`}>
        <Reveal variant="left">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#192024] sm:text-[34px]">
            Simple for everyone.
            <br />
            <span className="text-[#298959]">Powerful for your community.</span>
          </h2>
          <p className="mt-4 max-w-[420px] text-[16px] leading-[1.6] text-[#5D696F]">
            ZAAD is designed to be easy to use, even for volunteers with little technical experience.
          </p>
          <RequestDemoButton className={`${BTN_PRIMARY} mt-7`} />
        </Reveal>

        {/* The numbered circles pop in one after another and a line draws between them. */}
        <Reveal variant="fade" className="relative" threshold={0.25}>
          <div className="lp-step-line absolute left-[12.5%] right-[12.5%] top-4 hidden h-[2px] bg-[#CFE3D7] lg:block" aria-hidden="true" />
          <ol className="grid grid-cols-1 gap-y-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-y-0">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className={`relative flex flex-col px-5 ${index > 0 ? 'lg:border-l lg:border-[#E6E9EE]' : ''}`}
              >
                <span
                  className="lp-step-num relative z-10 flex h-8 w-8 items-center justify-center self-center rounded-full bg-[#15603B] text-[14px] font-extrabold text-white shadow-[0_0_0_6px_#FFFFFF]"
                  style={{ animationDelay: `${250 + index * 240}ms` }}
                >
                  {index + 1}
                </span>
                <div className="lp-step-body flex flex-1 flex-col" style={{ transitionDelay: `${400 + index * 240}ms` }}>
                  <h3 className="mt-5 text-[15px] font-bold text-[#192024]">{step.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.55] text-[#5D696F]">{step.body}</p>
                  <StepIllustration step={(index + 1) as 1 | 2 | 3 | 4} className="mt-auto w-full max-w-[220px] self-center pt-5" />
                </div>
              </li>
            ))}
          </ol>
        </Reveal>
      </div>
    </section>
  );
}

export default function FeaturesSection() {
  return (
    <>
      <KeyFeatures />
      <HowItWorks />
    </>
  );
}
