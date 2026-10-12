import Bars, { BarsProps } from './Bars';
import Area, { AreaProps } from './Area';
import Step, { StepProps } from './Step';
import Ring, { RingProps } from './Ring';
import Segments, { SegmentsProps } from './Segments';
import Bullet, { BulletProps } from './Bullet';
import Ladder, { LadderProps } from './Ladder';
import Dots, { DotsProps } from './Dots';
import Pair, { PairProps } from './Pair';
import Meter, { MeterProps } from './Meter';
import Months, { MonthsProps } from './Months';

type Omit_<T> = Omit<T, 'scale'>;

/** Graphic on the right of a KPI card. The design depends on what the number means. */
export type StatViz =
  | ({ type: 'bars' } & Omit_<BarsProps>)
  | ({ type: 'area' } & Omit_<AreaProps>)
  | ({ type: 'step' } & Omit_<StepProps>)
  | ({ type: 'ring' } & Omit_<RingProps>)
  | ({ type: 'segments' } & Omit_<SegmentsProps>)
  | ({ type: 'bullet' } & Omit_<BulletProps>)
  | ({ type: 'ladder' } & Omit_<LadderProps>)
  | ({ type: 'dots' } & Omit_<DotsProps>)
  | ({ type: 'pair' } & Omit_<PairProps>)
  | ({ type: 'meter' } & Omit_<MeterProps>)
  | ({ type: 'months' } & Omit_<MonthsProps>);

export default function StatVizGraphic({ viz, scale }: { viz: StatViz; scale?: number }) {
  return (
    <span className="stat-viz flex flex-shrink-0" aria-hidden="true">
      <Graphic viz={viz} scale={scale} />
    </span>
  );
}

function Graphic({ viz, scale }: { viz: StatViz; scale?: number }) {
  switch (viz.type) {
    case 'bars':
      return <Bars {...viz} scale={scale} />;
    case 'area':
      return <Area {...viz} scale={scale} />;
    case 'step':
      return <Step {...viz} scale={scale} />;
    case 'ring':
      return <Ring {...viz} scale={scale} />;
    case 'segments':
      return <Segments {...viz} scale={scale} />;
    case 'bullet':
      return <Bullet {...viz} scale={scale} />;
    case 'ladder':
      return <Ladder {...viz} scale={scale} />;
    case 'dots':
      return <Dots {...viz} scale={scale} />;
    case 'pair':
      return <Pair {...viz} scale={scale} />;
    case 'meter':
      return <Meter {...viz} scale={scale} />;
    case 'months':
      return <Months {...viz} scale={scale} />;
    default:
      return null;
  }
}

export { Bars, Area, Step, Ring, Segments, Bullet, Ladder, Dots, Pair, Meter, Months };
