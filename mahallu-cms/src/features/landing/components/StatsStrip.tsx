import { STATS } from '../content';
import { CARD, CONTAINER } from '../styles';
import { useCountUp, useInView } from '../useMotion';

function StatValue({ value, active }: { value: string; active: boolean }) {
  const count = useCountUp(parseInt(value, 10), active);
  return <>{count}</>;
}

/** The four product facts under the ayah and hadith; the numbers count up on arrival. */
export default function StatsStrip() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <div ref={ref} className="bg-[#F1F7F3] py-4 sm:py-8">
      <div className={CONTAINER}>
        <dl
          className={`${CARD} lp-reveal lp-reveal--scale grid grid-cols-2 py-1 sm:gap-y-2 sm:py-2 lg:grid-cols-4 lg:divide-x lg:divide-[#E6E9EE] ${
            inView ? 'is-visible' : ''
          }`}
        >
          {STATS.map(({ value, label, hint, icon: Icon }, index) => (
            <div
              key={label}
              className={`lp-reveal flex items-start gap-[10px] px-3 py-3 sm:gap-4 sm:px-6 sm:py-4 ${inView ? 'is-visible' : ''}`}
              style={{ transitionDelay: `${150 + index * 110}ms` }}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border border-[#E6E9EE] bg-white text-[#15603B] sm:h-11 sm:w-11 sm:rounded-[12px]">
                <Icon className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
              <div>
                <dd className="text-[20px] font-extrabold leading-none tabular-nums text-[#192024] sm:text-[26px]">
                  <StatValue value={value} active={inView} />
                </dd>
                <dt className="mt-1 text-[12px] font-bold text-[#192024] max-sm:leading-[1.3] sm:text-[14px]">{label}</dt>
                <p className="mt-[2px] text-[11px] text-[#5D696F] max-sm:leading-[1.35] sm:text-[12px]">{hint}</p>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
