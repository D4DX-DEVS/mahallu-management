import { createElement, type CSSProperties, type ReactNode } from 'react';
import { useInView } from '../useMotion';

type RevealTag = 'div' | 'section' | 'ul' | 'ol' | 'li' | 'figure' | 'article' | 'nav' | 'p';
export type RevealVariant = 'up' | 'left' | 'right' | 'scale' | 'fade';

interface RevealProps {
  children: ReactNode;
  variant?: RevealVariant;
  /** Milliseconds to wait once in view, for staggering siblings. */
  delay?: number;
  as?: RevealTag;
  className?: string;
  style?: CSSProperties;
  threshold?: number;
}

/** Fades and slides its content in the first time it scrolls into view. */
export default function Reveal({
  children,
  variant = 'up',
  delay = 0,
  as = 'div',
  className = '',
  style,
  threshold,
}: RevealProps) {
  const [ref, inView] = useInView<HTMLElement>({ threshold });
  const classes = ['lp-reveal', variant !== 'up' && `lp-reveal--${variant}`, inView && 'is-visible', className]
    .filter(Boolean)
    .join(' ');

  return createElement(
    as,
    { ref, className: classes, style: { transitionDelay: delay ? `${delay}ms` : undefined, ...style } },
    children
  );
}
