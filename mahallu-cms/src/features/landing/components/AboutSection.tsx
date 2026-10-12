import { ABOUT } from '../content';
import { CARD, CONTAINER } from '../styles';
import Reveal from './Reveal';

export default function AboutSection() {
  return (
    <section id="about-us" className="scroll-mt-[80px] bg-[#EEF5F0] py-10 sm:py-20">
      <div className={`${CONTAINER} grid items-center gap-4 sm:gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-14`}>
        <Reveal variant="left">
          <div className={`${CARD} p-5 sm:p-10`}>
            <h2 className="text-[20px] font-extrabold leading-[1.3] text-[#192024] sm:text-[27px]">
              {ABOUT.heading}
            </h2>
            <span aria-hidden="true" className="mt-3 block h-[3px] w-10 rounded-full bg-[#298959] sm:mt-4" />
            <div className="mt-4 space-y-3 sm:mt-6 sm:space-y-4">
              {ABOUT.paragraphs.map((paragraph) => (
                <p key={paragraph} className="text-[14px] leading-[1.65] text-[#5D696F] sm:text-[15px] sm:leading-[1.75]">
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
          className="pointer-events-none mx-auto block aspect-square w-full max-w-[200px] select-none mix-blend-multiply brightness-[1.04] sm:max-w-[360px] lg:max-w-[440px]"
        />
      </div>
    </section>
  );
}
