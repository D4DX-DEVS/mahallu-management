import { BENEFITS } from '../content';
import { CONTAINER } from '../styles';
import Reveal from './Reveal';

/*
 * "What ZAAD gives you": the one dark band on the page, so it reads as a pause
 * between the feature cards and the About section. Each benefit is a glass
 * tile with a gold icon and a large faint number; phones lay the icon beside
 * the text to keep the six tiles short.
 */
export default function BenefitsSection() {
  return (
    <section
      id="benefits"
      className="relative scroll-mt-[80px] overflow-hidden bg-[linear-gradient(160deg,#16633E_0%,#0F4A2E_55%,#0A3822_100%)] py-12 text-white sm:py-20"
    >
      <div className="lp-pattern pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="lp-glow pointer-events-none absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[#8EDCB3]/10" aria-hidden="true" />
      <div
        className="lp-glow pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-[#F2C14E]/[0.07]"
        style={{ animationDelay: '-5s' }}
        aria-hidden="true"
      />

      <div className={`${CONTAINER} relative`}>
        <Reveal className="mx-auto max-w-[680px] text-center">
          <p className="flex items-center justify-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#8EDCB3]">
            <span aria-hidden="true" className="h-px w-6 bg-[#8EDCB3]" />
            <span>{BENEFITS.eyebrow}</span>
            <span aria-hidden="true" className="h-px w-6 bg-[#8EDCB3]" />
          </p>
          <h2 className="mt-2 text-[20px] font-extrabold leading-[1.35] sm:mt-4 sm:text-[27px]">
            {BENEFITS.headline[0]} <span className="whitespace-nowrap text-[#F2C14E]">{BENEFITS.headline[1]}</span>
          </h2>
        </Reveal>

        <ul className="mt-7 grid gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {BENEFITS.items.map(({ title, body, icon: Icon }, index) => (
            <Reveal as="li" key={title} delay={(index % 3) * 90} className="h-full">
              <div className="group relative flex h-full gap-4 overflow-hidden rounded-[20px] border border-white/10 bg-white/[0.06] p-4 backdrop-blur-[2px] transition-[transform,background-color,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-[#F2C14E]/40 hover:bg-white/[0.1] sm:flex-col sm:p-7">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-2 text-[44px] font-extrabold leading-none tabular-nums text-white/[0.07] transition-colors duration-300 group-hover:text-[#F2C14E]/20 sm:right-6 sm:top-4 sm:text-[56px]"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#F2C14E]/15 text-[#F2C14E] ring-1 ring-[#F2C14E]/25 transition-transform duration-300 group-hover:scale-110 sm:h-12 sm:w-12">
                  <Icon className="h-5 w-5 sm:h-[22px] sm:w-[22px]" aria-hidden="true" />
                </span>
                <div className="relative min-w-0">
                  <h3 className="text-[15px] font-bold leading-[1.4] sm:mt-1 sm:text-[18px]">{title}</h3>
                  <p className="mt-1 text-[13px] leading-[1.6] text-white/75 sm:mt-2 sm:text-[14.5px] sm:leading-[1.7]">{body}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
