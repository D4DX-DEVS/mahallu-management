import { Z, VizBox, dim } from './tokens';

export interface BulletProps extends VizBox {
  /** 0-100, balance as share of target */
  percent: number;
  /** 0-100 marker position (target). Defaults to 100. */
  target?: number;
  color?: string;
}

/** Balance against a target, with a gold target marker. */
export default function Bullet({ percent, target = 100, color = Z.green, scale }: BulletProps) {
  const { w, h } = dim(scale);
  const ww = w - 2;
  const p = Math.max(0, Math.min(100, percent));
  const t = Math.max(0, Math.min(100, target));
  const tx = 1 + (ww * t) / 100;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="flex-shrink-0">
      <rect x={1} y={h / 2 - 4} width={ww} height={8} rx={4} className="fill-[#E7EEEA] dark:fill-[#2B342F]" />
      <rect x={1} y={h / 2 - 4} width={Math.max(0, (ww * p) / 100)} height={8} rx={4} fill={color} />
      <line x1={tx} x2={tx} y1={h / 2 - 9} y2={h / 2 + 9} stroke={Z.yellow} strokeWidth={3} strokeLinecap="round" />
    </svg>
  );
}
