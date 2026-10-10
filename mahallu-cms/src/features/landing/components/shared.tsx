import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { FiArrowRight, FiCheck } from 'react-icons/fi';
import { useRequestDemo } from '../demoRequestContext';
import { BTN_PRIMARY } from '../styles';

interface EyebrowProps {
  children: ReactNode;
  align?: 'left' | 'center';
  className?: string;
}

/** Small green section label with a short rule in front of it. */
export function Eyebrow({ children, align = 'left', className = '' }: EyebrowProps) {
  return (
    <p
      className={`flex items-center gap-3 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#298959] ${
        align === 'center' ? 'justify-center' : ''
      } ${className}`}
    >
      <span aria-hidden="true" className="h-px w-6 bg-[#298959]" />
      <span>{children}</span>
    </p>
  );
}

interface SectionHeadingProps {
  eyebrow: string;
  title: ReactNode;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export function SectionHeading({ eyebrow, title, subtitle, align = 'left', className = '' }: SectionHeadingProps) {
  const center = align === 'center';
  return (
    <div className={`${center ? 'mx-auto max-w-[680px] text-center' : 'max-w-[600px]'} ${className}`}>
      <Eyebrow align={align}>{eyebrow}</Eyebrow>
      <h2 className="mt-4 text-[30px] font-extrabold leading-[1.15] tracking-[-0.02em] text-[#192024] sm:text-[36px]">
        {title}
      </h2>
      {subtitle && <p className="mt-3 text-[16px] leading-[1.6] text-[#5D696F]">{subtitle}</p>}
    </div>
  );
}

/** A tick in a green circle followed by a short line of text. */
export function CheckItem({
  children,
  className = '',
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <li className={`flex items-center gap-3 text-[14px] font-semibold text-[#3A454B] ${className}`} style={style}>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#15603B] text-white">
        <FiCheck className="h-3 w-3" strokeWidth={3} aria-hidden="true" />
      </span>
      {children}
    </li>
  );
}

interface ScaledFrameProps {
  /** Design size of the content. It is laid out at this size and scaled to fit. */
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}

/**
 * Lays its child out at a fixed design size and scales it to the width it is
 * given, so the device mockups look identical on a phone and a wide screen.
 */
export function ScaledFrame({ width, height, children, className = '' }: ScaledFrameProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setScale(entry.contentRect.width / width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [width]);

  return (
    <div ref={ref} className={className} style={{ height: height * scale }}>
      <div style={{ width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  );
}

interface RequestDemoButtonProps {
  className?: string;
  /** Runs after the form opens, e.g. to close a mobile menu. */
  onAfterClick?: () => void;
}

/** Opens the demo-request form from anywhere on the page. */
export function RequestDemoButton({ className = BTN_PRIMARY, onAfterClick }: RequestDemoButtonProps) {
  const openDemo = useRequestDemo();
  return (
    <button
      type="button"
      className={`group ${className}`}
      onClick={() => {
        openDemo();
        onAfterClick?.();
      }}
    >
      Request a demo
      <FiArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
    </button>
  );
}
