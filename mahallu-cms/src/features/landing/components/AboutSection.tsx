import { ABOUT } from '../content';
import { CARD, CONTAINER } from '../styles';
import Reveal from './Reveal';

export default function AboutSection() {
  return (
    <section id="about-us" className="scroll-mt-[80px] bg-[#EEF5F0] py-20">
      <div className={`${CONTAINER} grid items-center gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14`}>
        <Reveal variant="left">
          <div className={`${CARD} p-7 sm:p-10`}>
            <h2 className="text-[26px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#192024] sm:text-[30px]">
              {ABOUT.heading}
            </h2>
            <span aria-hidden="true" className="mt-4 block h-[3px] w-10 rounded-full bg-[#298959]" />
            <div className="mt-6 space-y-4">
              {ABOUT.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-[16px] leading-[1.7] text-[#5D696F]">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </Reveal>

        {/* Sits straight on the green band: the painting's white background multiplies away, so there is no frame. */}
        <img
          src="/landing/about-mosque.jpg"
          alt="Watercolour illustration of a mosque with a green dome, minarets and a crescent moon"
          width={736}
          height={736}
          loading="lazy"
          decoding="async"
          className="pointer-events-none mx-auto block aspect-square w-full max-w-[300px] select-none mix-blend-multiply brightness-[1.04] sm:max-w-[360px] lg:max-w-[440px]"
        />
      </div>
    </section>
  );
}
