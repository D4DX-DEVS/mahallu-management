import { Z, VizBox, dim } from './tokens';

export interface MeterProps extends VizBox {
  /** Level 1..5 */
  level: number;
  color?: string;
}

/** Graded level as five rising bars. */
export default function Meter({ level, color = Z.deep, scale }: MeterProps) {
  const { w, h } = dim(scale);
  const sc = scale ?? 1;
  const n = Math.max(0, Math.min(5, Math.round(level)));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      {Array.from({ length: 5 }).map((_, i) => {
        const hh = (8 + i * 4) * sc;
        return <rect key={i} x={2 + i * 13 * sc} y={h - hh} width={9 * sc} height={hh} rx={3} fill={i < n ? color : undefined} className={i < n ? undefined : "fill-[#E7EEEA] dark:fill-[#2B342F]"} />;
      })}
    </svg>
  );
}
