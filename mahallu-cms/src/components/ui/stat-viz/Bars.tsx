import { Z, VizBox, dim } from './tokens';

export interface BarsProps extends VizBox {
  values: number[];
  color?: string;
}

/** Counts over time; the last bar is highlighted. */
export default function Bars({ values, color = Z.deep, scale }: BarsProps) {
  const { w, h } = dim(scale);
  const v = values.slice(-8);
  if (v.length < 2) return null;
  const n = v.length;
  const gap = 3;
  const bw = (w - 4) / n - gap;
  const mx = Math.max(...v, 1);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      {v.map((x, i) => {
        const bh = Math.max(3, (x / mx) * (h - 3));
        return <rect key={i} x={2 + i * (bw + gap)} y={h - bh} width={Math.max(bw, 2)} height={bh} rx={2.5} fill={i === n - 1 ? color : undefined} className={i === n - 1 ? undefined : "fill-[#CFE2D8] dark:fill-[#34413A]"} />;
      })}
    </svg>
  );
}
