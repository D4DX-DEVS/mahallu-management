import { useEffect, useRef } from 'react';
import { FiChevronLeft, FiChevronRight } from 'react-icons/fi';
import { FaQuoteLeft, FaStar } from 'react-icons/fa';
import { AUDIENCES, TESTIMONIALS, type Testimonial } from '../content';
import { CARD, CARD_HOVER, CONTAINER } from '../styles';
import { prefersReducedMotion } from '../useMotion';
import { Eyebrow, SectionHeading } from './shared';
import Reveal from './Reveal';

function Audiences() {
  return (
    <section id="for-members" className="scroll-mt-[80px] py-20">
      <div className={CONTAINER}>
        <Reveal>
          <SectionHeading
            align="center"
            eyebrow="For everyone in your Mahallu"
            title="Made for your entire community."
            subtitle="Different people, different needs –– one unified platform."
          />
        </Reveal>
        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map(({ title, body, icon: Icon, tint }, index) => (
            <Reveal as="li" key={title} delay={index * 100} className="h-full">
              <article className={`${CARD} ${CARD_HOVER} h-full p-7`}>
                <span
                  className="flex h-14 w-14 items-center justify-center rounded-full transition-transform duration-300 ease-out group-hover:scale-110"
                  style={{ background: tint.bg, color: tint.fg }}
                >
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-6 text-[17px] font-bold text-[#192024]">{title}</h3>
                <p className="mt-2 text-[14px] leading-[1.6] text-[#5D696F]">{body}</p>
              </article>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();

function TestimonialCard({ quote, name, role, hidden }: Testimonial & { hidden?: boolean }) {
  return (
    <figure
      aria-hidden={hidden || undefined}
      className={`${CARD} ${CARD_HOVER} flex w-[300px] shrink-0 flex-col p-7 sm:w-[360px]`}
    >
      <FaQuoteLeft className="h-5 w-5 text-[#298959]" aria-hidden="true" />
      <blockquote className="mt-4 flex-1 text-[14px] leading-[1.7] text-[#3A454B]">{quote}</blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#E6F4EC] text-[13px] font-extrabold text-[#15603B]">
          {initials(name)}
        </span>
        <div>
          <p className="text-[14px] font-bold text-[#192024]">{name}</p>
          <p className="text-[12px] text-[#5D696F]">{role}</p>
          <p className="mt-1 flex gap-[2px] text-[#F2A91C]" aria-label="5 out of 5 stars">
            {[0, 1, 2, 3, 4].map((star) => (
              <FaStar key={star} className="h-3 w-3" aria-hidden="true" />
            ))}
          </p>
        </div>
      </figcaption>
    </figure>
  );
}

/* The track holds two copies of the cards and glides left forever, wrapping
   when the first copy has fully passed, so the loop never shows a seam. */
const GAP = 20; // matches gap-5
const SPEED = 28; // px per second

function Testimonials() {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const pending = useRef(0);
  const paused = useRef(false);
  const onScreen = useRef(true);

  useEffect(() => {
    const track = trackRef.current;
    const viewport = viewportRef.current;
    if (!track || !viewport) return;
    const reduced = prefersReducedMotion();

    // Nothing moves while the carousel is off screen.
    const observer = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
    });
    observer.observe(viewport);

    let frame = 0;
    let last = performance.now();
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const dt = Math.min(64, now - last);
      last = now;
      if (!onScreen.current) return;

      const loop = (track.scrollWidth + GAP) / 2;
      if (!paused.current && !reduced) offset.current += (SPEED * dt) / 1000;
      if (pending.current !== 0) {
        // An arrow press eases the track one card along.
        const move = pending.current * 0.14;
        pending.current -= move;
        offset.current += move;
        if (Math.abs(pending.current) < 0.5) {
          offset.current += pending.current;
          pending.current = 0;
        }
      }
      offset.current = ((offset.current % loop) + loop) % loop;
      track.style.transform = `translate3d(${(-offset.current).toFixed(2)}px, 0, 0)`;
    };
    frame = requestAnimationFrame(step);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  const nudge = (direction: 1 | -1) => {
    const card = trackRef.current?.firstElementChild as HTMLElement | null;
    pending.current += direction * ((card?.offsetWidth ?? 320) + GAP);
  };
  const setPaused = (value: boolean) => {
    paused.current = value;
  };

  const arrowClass =
    'flex h-10 w-10 items-center justify-center rounded-full border border-[#D5DBE1] bg-white text-[#192024] transition-[transform,border-color,color] duration-200 hover:-translate-y-[2px] hover:border-[#15603B] hover:text-[#15603B] active:translate-y-0';

  return (
    <section id="testimonials" className="scroll-mt-[80px] pb-20">
      <div className={CONTAINER}>
        <Reveal className="flex items-end justify-between gap-6">
          <div>
            <Eyebrow>Testimonials</Eyebrow>
            <h2 className="mt-4 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#192024] sm:text-[34px]">
              What committees say about ZAAD.
            </h2>
            <p className="mt-2 text-[15px] text-[#5D696F]">Trusted by Mahallus across Kerala.</p>
          </div>
          <div className="hidden shrink-0 gap-2 sm:flex">
            <button type="button" className={arrowClass} onClick={() => nudge(-1)} aria-label="Previous testimonials">
              <FiChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button type="button" className={arrowClass} onClick={() => nudge(1)} aria-label="Next testimonials">
              <FiChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </Reveal>
      </div>

      <Reveal variant="fade" delay={150} className="mt-8">
        <div
          ref={viewportRef}
          className="overflow-hidden py-3 [mask-image:linear-gradient(90deg,transparent,#000_6%,#000_94%,transparent)]"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          <div ref={trackRef} className="flex w-max gap-5 pl-5 will-change-transform">
            {[0, 1].map((copy) =>
              TESTIMONIALS.map((testimonial) => (
                <TestimonialCard key={`${copy}-${testimonial.name}`} {...testimonial} hidden={copy === 1} />
              ))
            )}
          </div>
        </div>
      </Reveal>
    </section>
  );
}

export default function CommunitySection() {
  return (
    <>
      <Audiences />
      <Testimonials />
    </>
  );
}
