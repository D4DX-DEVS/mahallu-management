import { useRef, type CSSProperties } from 'react';
import { FiPlay, FiCheck, FiChevronDown } from 'react-icons/fi';
import { HERO, WATCH_VIDEO_HREF } from '../content';
import { BTN_OUTLINE, CONTAINER } from '../styles';
import { prefersReducedMotion, useScrollFrame } from '../useMotion';
import { BRAND_NAME, ICON_PATH } from '@/constants/theme';
import { Eyebrow, RequestDemoButton } from './shared';
import { MosqueIllustration, PalmFrond } from './illustrations';
import { LaptopFrame, PhoneFrame, DashboardScreen, MemberPortalScreen } from './mockups';

/** Page-load entrance timing, so the hero builds up piece by piece. */
const enterAt = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[620px] lg:max-w-none" aria-hidden="true">
      <div className="relative aspect-[10/8] w-full">
        <div
          className="lp-enter absolute inset-x-4 bottom-10 top-0 rounded-[32px] bg-[linear-gradient(180deg,#D3E5F1_0%,#E8F2EC_55%,#FFFFFF_100%)]"
          style={enterAt(150)}
        />
        <div className="lp-enter absolute right-[8%] top-[2%] w-[56%]" style={enterAt(350)}>
          <MosqueIllustration className="w-full" fill="#FFFFFF" shade="#D2DFD7" />
        </div>
        <div className="lp-enter absolute -right-8 -top-8 w-[170px]" style={enterAt(500)}>
          <PalmFrond className="lp-float lp-float--slow w-full text-[#1F6B45] opacity-60" />
        </div>
        <div className="absolute inset-y-0 left-0 w-[28%] bg-gradient-to-r from-white to-transparent" />
        {/* A small app badge in place of a second full logo, so the brand is present without repeating the header. */}
        <div className="lp-enter absolute left-[7%] top-[6%] z-10" style={enterAt(800)}>
          <div className="lp-float lp-float--slow flex items-center gap-2 rounded-full border border-white/80 bg-white/90 py-[6px] pl-[6px] pr-4 shadow-[0_14px_30px_-16px_rgba(21,96,59,0.5)] backdrop-blur">
            <img src={ICON_PATH} alt="" className="h-8 w-8 rounded-[9px]" />
            <span className="flex flex-col leading-none">
              <span className="text-[13px] font-extrabold text-[#0E5A3A]">{BRAND_NAME}</span>
              <span className="mt-[3px] text-[9px] font-semibold uppercase tracking-[0.12em] text-[#5D696F]">Mahallu app</span>
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
      <div ref={innerRef} className="will-change-[transform,opacity] [transform-origin:50%_30%]">
        <div className="lp-enter pointer-events-none absolute -left-24 top-[38%] hidden w-[240px] xl:block" style={enterAt(700)}>
          <PalmFrond className="lp-float w-full text-[#1F6B45] opacity-25" />
        </div>
        <div className={`${CONTAINER} grid items-center gap-12 py-14 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:py-20`}>
          <div className="relative z-10">
            <div className="lp-enter" style={enterAt(0)}>
              <Eyebrow>{HERO.eyebrow}</Eyebrow>
            </div>
            <h1
              className="lp-enter mt-5 text-[40px] font-extrabold leading-[1.08] tracking-[-0.025em] text-[#192024] sm:text-[48px] lg:text-[54px]"
              style={enterAt(90)}
            >
              {HERO.headline[0]}
              <br />
              <span className="text-[#298959]">{HERO.headline[1]}</span>
            </h1>
            <p className="lp-enter mt-5 max-w-[480px] text-[16px] leading-[1.65] text-[#5D696F] sm:text-[17px]" style={enterAt(180)}>
              {HERO.body}
            </p>
            <div className="lp-enter mt-8 flex flex-wrap gap-3" style={enterAt(280)}>
              <RequestDemoButton />
              <a href={WATCH_VIDEO_HREF} className={`${BTN_OUTLINE} group`}>
                <span className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#192024] transition-transform duration-300 group-hover:scale-110">
                  <FiPlay className="ml-[1px] h-3 w-3 fill-current" aria-hidden="true" />
                </span>
                Watch video
              </a>
            </div>
            <ul className="lp-enter mt-8 flex flex-wrap gap-x-6 gap-y-3" style={enterAt(380)}>
              {HERO.trust.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13px] font-semibold text-[#3A454B]">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#15603B] text-white">
                    <FiCheck className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
                  </span>
                  {item}
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
