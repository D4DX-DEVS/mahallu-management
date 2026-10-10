import { useState } from 'react';
import { FiArrowRight, FiHeadphones, FiPlus } from 'react-icons/fi';
import { CONTACT_EMAIL, FAQS } from '../content';
import { BTN_PRIMARY, CARD, CONTAINER } from '../styles';
import { useInView, useParallax } from '../useMotion';
import { Eyebrow } from './shared';
import { MosqueIllustration, PalmFrond } from './illustrations';
import Reveal from './Reveal';

/*
 * The contact card stacks its text above a fixed-height picture, so the
 * artwork never runs under the button, and it stretches to the FAQ list's
 * height so the two cards share a top and a bottom edge.
 */
function ContactCard() {
  const artRef = useParallax<HTMLDivElement>(0.05);

  return (
    <div id="contact" className={`${CARD} relative flex h-full min-h-[380px] flex-col overflow-hidden scroll-mt-[80px]`}>
      <div className="relative z-10 p-7">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#E6F4EC] text-[#15603B]">
          <FiHeadphones className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-[18px] font-extrabold text-[#192024]">Still have questions?</h3>
        <p className="mt-1 text-[14px] text-[#5D696F]">Our team is here to help you.</p>
        <a href={`mailto:${CONTACT_EMAIL}`} className={`${BTN_PRIMARY} group mt-5 px-5 py-[10px] text-[14px]`}>
          Contact us
          <FiArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </a>
      </div>
      <div className="relative mt-auto h-[160px]" aria-hidden="true">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#FFFFFF_0%,#DCEAF3_55%,#CDE1EC_100%)]" />
        <div ref={artRef} className="absolute inset-0 will-change-transform">
          <MosqueIllustration className="absolute -right-4 bottom-0 w-[64%]" fill="#FFFFFF" shade="#D2DFD7" />
          <PalmFrond className="lp-float absolute -right-8 -top-8 w-[150px] text-[#1F6B45] opacity-60" />
        </div>
      </div>
    </div>
  );
}

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(null);
  const [listRef, listInView] = useInView<HTMLUListElement>({ threshold: 0.2 });

  return (
    <section id="faq" className="scroll-mt-[80px] pb-20">
      <div className={CONTAINER}>
        <Reveal>
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#192024] sm:text-[34px]">
            Frequently asked questions.
          </h2>
        </Reveal>
        <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-stretch">
          <ul ref={listRef} className={`${CARD} flex flex-col divide-y divide-[#E6E9EE] px-2`}>
            {FAQS.map((faq, index) => {
              const isOpen = open === index;
              const panelId = `landing-faq-${index}`;
              return (
                <li
                  key={faq.question}
                  className={`lp-reveal flex flex-1 flex-col justify-center ${listInView ? 'is-visible' : ''}`}
                  style={{ transitionDelay: `${index * 80}ms` }}
                >
                  <button
                    type="button"
                    className="group flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? null : index)}
                  >
                    <span className="text-[15px] font-semibold text-[#192024] transition-colors duration-200 group-hover:text-[#15603B]">
                      {faq.question}
                    </span>
                    <span
                      className={`shrink-0 text-[#15603B] transition-transform duration-300 ease-out ${isOpen ? 'rotate-45' : 'group-hover:rotate-90'}`}
                      aria-hidden="true"
                    >
                      <FiPlus className="h-4 w-4" />
                    </span>
                  </button>
                  <div id={panelId} className={`lp-accordion ${isOpen ? 'is-open' : ''}`} aria-hidden={!isOpen}>
                    <div>
                      <p className="px-4 pb-5 text-[14px] leading-[1.65] text-[#5D696F]">{faq.answer}</p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
          <Reveal variant="right" delay={120}>
            <ContactCard />
          </Reveal>
        </div>
      </div>
    </section>
  );
}
