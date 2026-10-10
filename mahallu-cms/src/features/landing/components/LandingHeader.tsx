import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiMenu, FiX } from 'react-icons/fi';
import { useAuthStore } from '@/store/authStore';
import { ROUTES } from '@/constants/routes';
import { BRAND_NAME } from '@/constants/theme';
import { NAV_LINKS } from '../content';
import { BTN_PRIMARY, CONTAINER } from '../styles';
import { useScrollFrame } from '../useMotion';
import { RequestDemoButton } from './shared';
import BrandLogo from './BrandLogo';

const SECTION_IDS = NAV_LINKS.map((link) => link.section);

/** The section the viewport is on, so the matching nav link can be marked. */
function useActiveSection(): string {
  const [active, setActive] = useState(SECTION_IDS[0]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const marker = window.scrollY + 140;
      let current = SECTION_IDS[0];
      let currentTop = -Infinity;
      for (const id of SECTION_IDS) {
        const el = document.getElementById(id);
        if (!el) continue;
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (top <= marker && top > currentTop) {
          current = id;
          currentTop = top;
        }
      }
      setActive(current);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return active;
}

export default function LandingHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);
  const active = useActiveSection();
  const user = useAuthStore((state) => state.user);

  // A thin line under the header fills as the visitor reads down the page; the
  // header picks up a shadow once there is content underneath it.
  useScrollFrame((scrollY) => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const progress = max > 0 ? Math.min(1, scrollY / max) : 0;
    if (progressRef.current) progressRef.current.style.transform = `scaleX(${progress.toFixed(4)})`;
    const next = scrollY > 8;
    setScrolled((previous) => (previous === next ? previous : next));
  });

  // A signed-in visitor goes straight back into the app instead of to the sign-in form.
  const appHref = user ? (user.role === 'member' ? ROUTES.MEMBER.OVERVIEW : ROUTES.DASHBOARD) : ROUTES.LOGIN;
  const appLabel = user ? 'Open dashboard' : 'Sign in';

  return (
    <header
      className={`sticky top-0 z-40 border-b border-[#E6E9EE]/80 bg-white/90 backdrop-blur transition-shadow duration-300 ${
        scrolled ? 'shadow-[0_10px_30px_-22px_rgba(25,32,36,0.45)]' : ''
      }`}
    >
      <div className={`${CONTAINER} flex h-[84px] items-center justify-between gap-6`}>
        <a href="#home" className="group flex shrink-0 items-center" aria-label={`${BRAND_NAME} home`}>
          <BrandLogo />
        </a>

        <nav aria-label="Primary" className="hidden items-center gap-8 lg:flex">
          {NAV_LINKS.map((link) => {
            const isActive = link.section === active;
            return (
              <a
                key={link.section}
                href={link.href}
                aria-current={isActive ? 'page' : undefined}
                className={`group relative text-[14px] font-semibold transition-colors duration-200 ${
                  isActive ? 'text-[#15603B]' : 'text-[#3A454B] hover:text-[#15603B]'
                }`}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-[7px] left-0 h-[2px] rounded-full bg-[#15603B] transition-all duration-300 ease-out ${
                    isActive ? 'w-5 opacity-100' : 'w-0 opacity-0 group-hover:w-3 group-hover:opacity-60'
                  }`}
                />
              </a>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link to={appHref} className="px-3 py-2 text-[14px] font-semibold text-[#192024] transition-colors duration-200 hover:text-[#15603B]">
            {appLabel}
          </Link>
          <RequestDemoButton className={`${BTN_PRIMARY} px-5 py-[10px] text-[14px]`} />
        </div>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#192024] transition hover:bg-[#F1F7F3] lg:hidden"
          aria-expanded={open}
          aria-controls="landing-mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <FiX className="h-5 w-5" aria-hidden="true" /> : <FiMenu className="h-5 w-5" aria-hidden="true" />}
          <span className="sr-only">{open ? 'Close menu' : 'Open menu'}</span>
        </button>
      </div>

      <div ref={progressRef} aria-hidden="true" className="absolute bottom-0 left-0 h-[2px] w-full origin-left scale-x-0 bg-[#298959]" />

      {open && (
        <div id="landing-mobile-nav" className="animate-fade-in border-t border-[#E6E9EE] bg-white lg:hidden">
          <nav aria-label="Primary" className={`${CONTAINER} flex flex-col py-3`}>
            {NAV_LINKS.map((link, index) => (
              <a
                key={link.section}
                href={link.href}
                onClick={() => setOpen(false)}
                className={`lp-enter rounded-[10px] px-3 py-3 text-[15px] font-semibold ${
                  link.section === active ? 'bg-[#F1F7F3] text-[#15603B]' : 'text-[#192024]'
                }`}
                style={{ animationDelay: `${index * 50}ms`, animationDuration: '0.45s' }}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 flex flex-col gap-2 border-t border-[#E6E9EE] pt-4">
              <Link to={appHref} className="rounded-full border border-[#D5DBE1] px-5 py-3 text-center text-[15px] font-bold text-[#192024]">
                {appLabel}
              </Link>
              <RequestDemoButton onAfterClick={() => setOpen(false)} />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
