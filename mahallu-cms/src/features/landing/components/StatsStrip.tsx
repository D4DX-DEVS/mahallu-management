import { STATS } from '../content';
import { CARD, CONTAINER } from '../styles';
import { useCountUp, useInView } from '../useMotion';

function StatValue({ value, active }: { value: string; active: boolean }) {
  const count = useCountUp(parseInt(value, 10), active);
  return <>{count}</>;
}

/** The four product facts under the hero; the numbers count up on arrival. */
export default function StatsStrip() {
  const [ref, inView] = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <div ref={ref} className="rounded-t-[36px] bg-[#F1F7F3] py-8 lg:rounded-t-[44px]">
      <div className={CONTAINER}>
        <dl
          className={`${CARD} lp-reveal lp-reveal--scale grid grid-cols-1 gap-y-2 py-2 sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-[#E6E9EE] ${
            inView ? 'is-visible' : ''
          }`}
        >
          {STATS.map(({ value, label, hint, icon: Icon }, index) => (
            <div
              key={label}
              className={`lp-reveal flex items-start gap-4 px-6 py-4 ${inView ? 'is-visible' : ''}`}
              style={{ transitionDelay: `${150 + index * 110}ms` }}
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[12px] border border-[#E6E9EE] bg-white text-[#15603B]">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <dd className="text-[26px] font-extrabold leading-none tabular-nums text-[#192024]">
                  <StatValue value={value} active={inView} />
                </dd>
                <dt className="mt-1 text-[14px] font-bold text-[#192024]">{label}</dt>
                <p className="mt-[2px] text-[12px] text-[#5D696F]">{hint}</p>
              </div>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
