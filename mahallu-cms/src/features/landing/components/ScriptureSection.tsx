import { useEffect, useState } from 'react';
import { SCRIPTURE } from '../content';
import { CARD, CONTAINER } from '../styles';
import Reveal from './Reveal';

/** How long each text stays up before the next fades in. */
const ROTATE_MS = 9000;

/** An eight-pointed star, the familiar ornament of Islamic geometric art. */
function StarOrnament({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <rect x="5" y="5" width="14" height="14" rx="1.5" fill="currentColor" />
      <rect x="5" y="5" width="14" height="14" rx="1.5" fill="currentColor" transform="rotate(45 12 12)" />
      <circle cx="12" cy="12" r="3" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * The ayah and hadith right after the hero, one at a time in a full-width
 * card: the shown text fades out and the other fades in, round and round. It
 * holds still while the pointer or focus is on it, so it can be read.
 *
 * It is the top edge of the sheet that slides over the pinned hero, so it
 * carries the sheet's rounded corners.
 */
export default function ScriptureSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  // A fresh timer per text, so picking one from the dots gives it a full turn.
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => setActive((index) => (index + 1) % SCRIPTURE.length), ROTATE_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused]);

  return (
    <section aria-label="Quran and Hadith" className="rounded-t-[28px] bg-[#F1F7F3] pt-5 sm:rounded-t-[36px] sm:pt-12 lg:rounded-t-[44px] lg:pt-16">
      <div className={CONTAINER}>
        <Reveal variant="scale">
          <div
            className={`${CARD} px-4 pb-2 pt-4 text-center sm:px-12 sm:pb-6 sm:pt-12`}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onFocus={() => setPaused(true)}
            onBlur={() => setPaused(false)}
          >
            <StarOrnament className="mx-auto h-6 w-6 text-[#298959] sm:h-9 sm:w-9" />
            {/* Both texts share one grid cell, so the card keeps the taller one's height and never jumps. */}
            <div className="mt-2 grid sm:mt-6">
              {SCRIPTURE.map(({ arabic, text, source }, index) => (
                <figure
                  key={source}
                  aria-hidden={index !== active}
                  className={`lp-scripture self-center ${index === active ? 'is-active' : ''}`}
                >
                  {arabic && (
                    <p
                      lang="ar"
                      dir="rtl"
                      className="mx-auto mb-1 max-w-[860px] text-balance font-arabic text-[16px] font-semibold leading-[1.85] text-[#15603B] sm:mb-4 sm:text-[24px] sm:leading-[2]"
                    >
                      {arabic}
                    </p>
                  )}
                  <blockquote className="mx-auto max-w-[860px] text-[13.5px] font-medium leading-[1.65] text-[#192024] sm:text-[19px] sm:leading-[1.9]">
                    {text}
                  </blockquote>
                  <figcaption className="mt-2 flex items-center justify-center gap-3 text-[12px] font-bold text-[#15603B] sm:mt-5 sm:text-[15px]">
                    <span aria-hidden="true" className="h-px w-6 bg-[#298959]" />
                    {source}
                    <span aria-hidden="true" className="h-px w-6 bg-[#298959]" />
                  </figcaption>
                </figure>
              ))}
            </div>
            <div className="mt-1 flex justify-center sm:mt-6">
              {SCRIPTURE.map(({ source }, index) => (
                <button
                  key={source}
                  type="button"
                  aria-label={`Show ${source}`}
                  aria-current={index === active}
                  onClick={() => setActive(index)}
                  className="group p-2 focus-visible:outline-none"
                >
                  <span
                    className={`block h-2 rounded-full transition-all duration-300 group-focus-visible:ring-2 group-focus-visible:ring-[#15603B] group-focus-visible:ring-offset-2 ${
                      index === active ? 'w-6 bg-[#15603B]' : 'w-2 bg-[#CFE3D7] group-hover:bg-[#9CC9AE]'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
