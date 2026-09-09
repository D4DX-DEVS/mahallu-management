import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';
import { cn } from '@/utils/cn';
export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm';
  isLoading?: boolean; /** Shown beside the spinner while loading. Keeps the button's meaning and width. */
  loadingText?: string;
  /*
   *
   * Required for icon-only buttons: supplies the accessible name that a bare
   * icon cannot. `title` is not a substitute — it never appears on touch.
   */
  'aria-label'?: string;
  /**
   * Leading glyph. Sized by the button, so pass it bare — `<FiPlus />`, not
   * `<FiPlus className="h-4 w-4 mr-2" />`. The gap is the button's own.
   */
  icon?: ReactNode;
  /**
   * Below `sm`, show the icon and drop the label to a square button.
   *
   * A phone toolbar holds six controls across 320px; a single "+ New
   * Committee" spends half of that, which is what pushed the row onto a second
   * line. The label is still in the accessibility tree — `sr-only`, not
   * `hidden` — so the button keeps its name for a screen reader and its
   * tooltip for a pointer. Requires `icon`; without one there would be nothing
   * left to press.
   */
  collapseLabel?: boolean;
  /**
   * Rendered after the label and never collapsed — a count, a status dot.
   * Use it for the one piece of state a glyph cannot carry on its own.
   */
  trailing?: ReactNode;
  children?: ReactNode;
}
const Spinner = () => (
  <svg
    className="h-4 w-4 animate-spin"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);
const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = 'primary',
      size = 'md',
      isLoading,
      loadingText,
      icon,
      collapseLabel = false,
      trailing,
      children,
      disabled,
      type = 'button',
      title,
      ...props
    },
    ref
  ) => {
    const base =
      'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors ' +
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ' +
      'focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 ' +
      'whitespace-nowrap';
    const variants = {
      primary: 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/90',
      secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
      outline: 'border border-border bg-transparent text-foreground hover:bg-muted',
      ghost: 'text-muted-foreground hover:bg-muted hover:text-foreground',
      danger: 'bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90',
    };
    /*
     * One control ladder — 32 / 40 / 48 — shared with Input, Select and DatePicker. */
    const sizes = {
      sm: 'h-8 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10 p-0',
      'icon-sm': 'h-8 w-8 p-0',
    };
    /* A square of the same height below `sm`, the ordinary button from `sm`.
     * The label is absolutely positioned while collapsed, so it is not a flex
     * item, contributes no width and takes no gap — the glyph sits dead
     * centre without a second rule to re-centre it. */
    const collapsedSizes = {
      sm: 'h-8 w-8 p-0 sm:w-auto sm:px-3 text-sm',
      md: 'h-10 w-10 p-0 sm:w-auto sm:px-4 text-sm',
      lg: 'h-12 w-12 p-0 sm:w-auto sm:px-6 text-base',
      icon: 'h-10 w-10 p-0',
      'icon-sm': 'h-8 w-8 p-0',
    };
    const iconOnly = size === 'icon' || size === 'icon-sm';
    const collapsed = collapseLabel && Boolean(icon) && !iconOnly;
    if (import.meta.env.DEV && iconOnly && !props['aria-label']) {
      // eslint-disable-next-line no-console
      console.warn('Button: icon-only buttons require an aria-label.');
    }
    if (import.meta.env.DEV && collapseLabel && !icon) {
      // eslint-disable-next-line no-console
      console.warn('Button: collapseLabel needs an icon — a collapsed button would be empty.');
    }
    /* Every glyph the same size, whatever the call site passed. */
    const glyph = icon && (
      <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4">
        {icon}
      </span>
    );
    const label = collapsed ? <span className="sr-only sm:not-sr-only">{children}</span> : children;
    /* Stays visible when the label collapses. For the one thing a glyph cannot
     * carry on its own — a count. The button gives up its fixed square width
     * to make room. */
    const suffix = trailing && <span className="flex flex-shrink-0 items-center">{trailing}</span>;
    return (
      <button
        ref={ref}
        type={type}
        /* Collapsed, the visible control is a bare glyph: the tooltip is the
         * only thing a pointer has to go on. */
        title={title ?? (collapsed && typeof children === 'string' ? children : undefined)}
        className={cn(
          base,
          variants[variant],
          collapsed ? collapsedSizes[size] : sizes[size],
          /* A trailing badge needs room the fixed square does not have. */
          collapsed && trailing && 'w-auto gap-1 px-2 sm:gap-2 sm:px-4',
          className
        )}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading ? (
          <>
            <Spinner />{' '}
            {!iconOnly && (
              <span className={collapsed ? 'sr-only sm:not-sr-only' : undefined}>
                {loadingText ?? children}
              </span>
            )}
          </>
        ) : (
          <>
            {glyph}
            {label}
            {suffix}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export default Button;
