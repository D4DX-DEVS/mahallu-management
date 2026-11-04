import type { CSSProperties } from 'react';
import { REALITIES, DEMO_BAND } from '../content';
import { BTN_INVERSE, CONTAINER } from '../styles';
import { useInView, useParallax } from '../useMotion';
import { Eyebrow, RequestDemoButton } from './shared';
import { MosqueIllustration } from './illustrations';
import { LaptopFrame, FamiliesScreen } from './mockups';
import Reveal from './Reveal';

/** Reveal classes for the n-th child of a block that is already in view. */
const staggered = (visible: boolean, index: number): { className: string; style: CSSProperties } => ({
  className: `lp-reveal ${visible ? 'is-visible' : ''}`,
  style: { transitionDelay: `${index * 90}ms` },
});

function Realities() {
  const [textRef, textInView] = useInView<HTMLDivElement>({ threshold: 0.3 });
  const parallaxRef = useParallax<HTMLDivElement>(0.07);

  return (
    <section id="realities" className="scroll-mt-[80px] bg-[#EEF5F0] py-10 sm:py-20">
      {/* max-sm:grid-cols-1 lets the column shrink to the phone: the laptop is laid out at a fixed design width. */}
      <div className={`${CONTAINER} grid items-center gap-6 max-sm:grid-cols-1 sm:gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]`}>
        <Reveal variant="left" threshold={0.2}>
          <div ref={parallaxRef} aria-hidden="true" className="will-change-transform">
            <LaptopFrame>
              <FamiliesScreen />
            </LaptopFrame>
          </div>
        </Reveal>
        <div ref={textRef}>
          <div {...staggered(textInView, 0)}>
            <Eyebrow>{REALITIES.eyebrow}</Eyebrow>
          </div>
          <h2
            {...staggered(textInView, 1)}
            className={`${staggered(textInView, 1).className} mt-2 max-w-[440px] text-[20px] font-extrabold leading-[1.3] text-[#192024] sm:mt-4 sm:text-[27px]`}
          >
            {REALITIES.headline[0]}
            <br />
            <span className="text-[#298959]">{REALITIES.headline[1]}</span>
          </h2>
          <p
            {...staggered(textInView, 2)}
            className={`${staggered(textInView, 2).className} mt-3 max-w-[500px] text-[14px] leading-[1.65] text-[#5D696F] sm:mt-5 sm:text-[15px] sm:leading-[1.75]`}
          >
            {REALITIES.body}
          </p>
        </div>
      </div>
    </section>
  );
}

function DemoBand() {
  return (
    <section id="demo" className="scroll-mt-[80px] py-8 sm:py-16">
      <div className={CONTAINER}>
        <Reveal variant="scale" threshold={0.3}>
          <div className="relative overflow-hidden rounded-[26px] bg-[linear-gradient(100deg,#1B6E45_0%,#15603B_45%,#0F4A2E_100%)] px-5 py-6 text-white shadow-[0_30px_60px_-30px_rgba(15,74,46,0.7)] sm:px-10 sm:py-10">
            <div className="lp-glow pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/5" aria-hidden="true" />
            <div
              className="lp-glow pointer-events-none absolute -bottom-36 left-1/3 h-80 w-80 rounded-full bg-[#8EDCB3]/10"
              style={{ animationDelay: '-5s' }}
              aria-hidden="true"
            />
            <div className="relative grid items-center gap-4 sm:gap-8 lg:grid-cols-[auto_minmax(0,1fr)_auto]">
              <div className="lp-float hidden sm:block">
                <MosqueIllustration className="w-[190px]" fill="#FFFFFF" shade="#B8D6C5" accent="#F2C14E" />
              </div>
              <div>
                <h2 className="text-[17px] font-extrabold leading-[1.35] sm:text-[23px]">{DEMO_BAND.headline}</h2>
                <p className="mt-2 max-w-[520px] text-[13px] leading-[1.55] text-white/85 sm:text-[15px] sm:leading-[1.6]">{DEMO_BAND.body}</p>
              </div>
              <RequestDemoButton className={`${BTN_INVERSE} lp-shine relative overflow-hidden justify-self-start lg:justify-self-end`} />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function ProductSection() {
  return (
    <>
      <Realities />
      <DemoBand />
    </>
  );
}
