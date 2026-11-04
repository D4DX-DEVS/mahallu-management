import { Z, VizBox, dim } from './tokens';

export interface LadderProps extends VizBox {
  /** Raw values, ranked rows (largest first, max 5). Normalised to the largest. */
  values: number[];
  color?: string;
}

/** Ranked rows, e.g. by ward. */
export default function Ladder({ values, color = Z.gold, scale }: LadderProps) {
  const { w, h } = dim(scale);
  const v = [...values].filter((x) => x > 0).sort((a, b) => b - a).slice(0, 4);
  if (v.length === 0) return null;
  const mx = v[0];
  const rh = (h - 2) / v.length;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      {v.map((x, i) => {
        const y = 1 + i * rh;
        return (
          <g key={i}>
            <rect x={1} y={y} width={w - 2} height={Math.max(rh - 3, 2)} rx={2} className="fill-[#E7EEEA] dark:fill-[#2B342F]" />
            <rect x={1} y={y} width={((w - 2) * x) / mx} height={Math.max(rh - 3, 2)} rx={2} fill={color} />
          </g>
        );
      })}
    </svg>
  );
}
