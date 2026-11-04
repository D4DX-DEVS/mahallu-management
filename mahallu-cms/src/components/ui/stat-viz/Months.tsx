import { Z, VizBox, dim } from './tokens';

export interface MonthsProps extends VizBox {
  /** One entry per month: true = paid, false = missed */
  values: boolean[];
}

/** Monthly yes/no squares. */
export default function Months({ values, scale }: MonthsProps) {
  const { w, h } = dim(scale);
  const sc = scale ?? 1;
  const v = values.slice(0, 12);
  if (v.length === 0) return null;
  const cols = 6;
  const pitch = 11 * sc;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      {v.map((x, i) => (
        <rect
          key={i}
          x={2 + (i % cols) * pitch}
          y={v.length > cols ? 2 + Math.floor(i / cols) * 13 * sc : h / 2 - 5 * sc}
          width={9 * sc}
          height={10 * sc}
          rx={3}
          fill={x ? Z.deep : Z.gold}
        />
      ))}
    </svg>
  );
}
