import { Z, VizBox } from './tokens';

export interface RingProps extends VizBox {
  /** 0-100 */
  percent: number;
  color?: string;
}

/** A single percentage. */
export default function Ring({ percent, color = Z.deep, scale = 1 }: RingProps) {
  const s = Math.round(34 * scale);
  const r = 11 * scale;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, percent));
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} aria-hidden="true" className="flex-shrink-0">
      <circle cx={s / 2} cy={s / 2} r={r} fill="none" strokeWidth={5} className="stroke-[#E7EEEA] dark:stroke-[#2B342F]" />
      <circle
        cx={s / 2}
        cy={s / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={5}
        strokeLinecap={p > 0 ? 'round' : 'butt'}
        strokeDasharray={`${(c * p) / 100} ${c}`}
        transform={`rotate(-90 ${s / 2} ${s / 2})`}
      />
    </svg>
  );
}
