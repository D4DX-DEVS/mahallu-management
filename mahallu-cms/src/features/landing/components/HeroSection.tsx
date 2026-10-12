import { useRef, type CSSProperties } from 'react';
import { FiCheck, FiChevronDown } from 'react-icons/fi';
import { HERO } from '../content';
import { CONTAINER } from '../styles';
import { prefersReducedMotion, useScrollFrame } from '../useMotion';
import { BRAND_NAME, ICON_PATH } from '@/constants/theme';
import { Eyebrow, RequestDemoButton } from './shared';
import { LaptopFrame, PhoneFrame, DashboardScreen, MemberPortalScreen } from './mockups';

/** Page-load entrance timing, so the hero builds up piece by piece. */
const enterAt = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:max-w-none" aria-hidden="true">
      <div className="relative aspect-[10/8] w-full">
        {/* A small app badge in place of a second full logo, so the brand is present without repeating the header. */}
        <div className="lp-enter absolute left-[7%] top-[6%] z-10" style={enterAt(800)}>
          <div className="lp-float lp-float--slow flex items-center gap-2 rounded-full border border-white/80 bg-white/90 py-[6px] pl-[6px] pr-4 shadow-[0_14px_30px_-16px_rgba(21,96,59,0.5)] backdrop-blur">
            <img src={ICON_PATH} alt="" className="h-8 w-8 rounded-[9px]" />
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-extrabold text-[#0E5A3A]">{BRAND_NAME}</span>
              <span className="mt-[3px] text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5D696F]">App</span>
            </span>
          </div>
        </div>
        <div className="lp-enter absolute left-[1%] top-[21%] w-[80%]" style={enterAt(450)}>
          <div className="lp-float">
            <LaptopFrame>
              <DashboardScreen />
            </LaptopFrame>
          </div>
        </div>
        <div className="lp-enter absolute bottom-0 right-[1%] w-[27%] min-w-[112px]" style={enterAt(650)}>
          <div className="lp-float lp-float--slow">
            <PhoneFrame>
              <MemberPortalScreen />
            </PhoneFrame>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  /* On wide screens the hero is pinned and the next section slides over it
     (see Landing.tsx); as it is covered it recedes and fades, like a card
     being slid under a sheet. Phones scroll it normally. */
  useScrollFrame((scrollY) => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    if (!section || !inner) return;
    const pinned = window.matchMedia('(min-width: 1024px)').matches && !prefersReducedMotion();
    if (!pinned) {
      inner.style.opacity = '';
      inner.style.transform = '';
      return;
    }
    const progress = Math.min(1, Math.max(0, scrollY / Math.max(1, section.offsetHeight * 0.85)));
    inner.style.opacity = (1 - progress * 0.75).toFixed(3);
    inner.style.transform = `translate3d(0, ${(-progress * 90).toFixed(1)}px, 0) scale(${(1 - progress * 0.08).toFixed(3)})`;
  });

  return (
    <section id="home" ref={sectionRef} className="relative z-0 overflow-hidden scroll-mt-[80px] lg:sticky lg:top-[84px]">
      {/* The banner photo stays put while the content recedes over it. Its left side is a pale wash
          that sits under the text; the mosque sits under the devices. */}
      <div className="lp-enter pointer-events-none absolute inset-0" style={enterAt(0)} aria-hidden="true">
        <div
          className="absolute inset-0 bg-cover bg-[position:68%_center] bg-no-repeat opacity-90 lg:bg-center"
          style={{ backgroundImage: `url(${HERO.background})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white/85 to-white/20 lg:bg-gradient-to-r lg:from-white/80 lg:via-white/25 lg:to-transparent" />
      </div>
      <div ref={innerRef} className="relative will-change-[transform,opacity] [transform-origin:50%_30%]">
        <div className={`${CONTAINER} grid items-center gap-8 py-8 sm:gap-12 sm:py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:py-20`}>
          <div className="relative z-10">
            <div className="lp-enter" style={enterAt(0)}>
              <Eyebrow>{HERO.eyebrow}</Eyebrow>
            </div>
            <h1
              className="lp-enter mt-3 text-[21px] font-extrabold leading-[1.35] text-[#192024] sm:mt-5 sm:text-[31px] sm:leading-[1.3] xl:text-[29px]"
              style={enterAt(90)}
            >
              <span className="xl:whitespace-nowrap">{HERO.headline[0]}</span>
              <br />
              <span className="text-[#298959]">{HERO.headline[1]}</span>
            </h1>
            <p className="lp-enter mt-3 max-w-[480px] text-[14px] leading-[1.6] text-[#5D696F] sm:mt-5 sm:text-[16px] sm:leading-[1.7]" style={enterAt(180)}>
              {HERO.body}
            </p>
            <div className="lp-enter mt-5 flex flex-wrap gap-3 sm:mt-8" style={enterAt(280)}>
              <RequestDemoButton />
            </div>
            <ul className="lp-enter mt-5 flex flex-wrap gap-x-6 gap-y-2 sm:mt-8 sm:gap-y-3" style={enterAt(380)}>
              {HERO.trust.map(({ lead, highlight }) => (
                <li key={highlight} className="flex items-center gap-2 text-[12px] font-semibold text-[#3A454B] max-sm:leading-[1.45] sm:text-[13px]">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#15603B] text-white">
                    <FiCheck className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  <span>
                    {lead} <strong className="whitespace-nowrap text-[13px] font-extrabold text-[#15603B] sm:text-[14px]">{highlight}</strong>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <HeroVisual />
        </div>
        <div className="lp-enter hidden justify-center pb-6 lg:flex" style={enterAt(900)} aria-hidden="true">
          <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-[#5D696F]">
            Scroll to explore
            <FiChevronDown className="lp-bounce h-4 w-4 text-[#298959]" />
          </span>
        </div>
      </div>
    </section>
  );
}
