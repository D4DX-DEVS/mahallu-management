import {
  ForwardedRef, InputHTMLAttributes, ReactNode, useCallback, useEffect, useId, useRef, useState,
} from 'react';
import { FiX } from 'react-icons/fi';
import { cn } from '@/utils/cn';
import { controlClasses, controlErrorClasses, labelClasses } from '../controlStyles';
import PickerPopover from './PickerPopover';
import { useIsPhone } from '@/hooks/useMediaQuery';

/** Props shared by DateInput, MonthPicker, TimeInput and DateTimeInput. */
export interface PickerCommonProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'defaultValue' | 'size' | 'min' | 'max' | 'onChange' | 'children'> {
  label?: string;
  error?: string;
  helperText?: string;
  /** Show the Clear action / x button (default: true unless `required`). */
  clearable?: boolean;
  /** ISO value ('YYYY-MM-DD'; month 'YYYY-MM'; time 'HH:mm'). An ISO datetime is cut to its date part. */
  value?: string | null;
  defaultValue?: string | null;
  /** Receives a real change event from the hidden input (e.target.value is the ISO string). */
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  /** Convenience: called with the new ISO string ('' when cleared). */
  onValueChange?: (iso: string) => void;
  min?: string;
  max?: string;
}

export interface PickerCtx {
  iso: string;
  /** Sets the value (emits real input/change events) and optionally closes the popover. */
  commit: (next: string, close?: boolean) => void;
  close: () => void;
  clear: () => void;
  canClear: boolean;
  phone: boolean;
}

interface ShellProps extends PickerCommonProps {
  innerRef: ForwardedRef<HTMLInputElement>;
  normalize: (v: unknown) => string;
  format: (iso: string) => string;
  parse: (text: string) => string | null;
  mask: (raw: string, prev: string) => string;
  fullLength: number;
  icon: ReactNode;
  ariaLabel: string;
  invalidMessage: string;
  bounds?: (iso: string) => string | null;
  popoverWidth?: number;
  children: (ctx: PickerCtx) => ReactNode;
}

const protoDesc = typeof HTMLInputElement !== 'undefined' ? Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')! : undefined;
const nativeGet = (el: HTMLInputElement) => protoDesc!.get!.call(el) as string;
const nativeSet = (el: HTMLInputElement, v: string) => protoDesc!.set!.call(el, v);

/**
 * Masks free typing into groups: ['dd','mm','yyyy'] separated by `sep`. Digits-only input (12102026) is
 * split automatically; overflowing groups spill into the next one; a separator is added when a group fills.
 */
// eslint-disable-next-line react-refresh/only-export-components -- helper shared with other files; only affects dev hot-reload
export function maskGroups(raw: string, prev: string, limits: number[], sep: string): string {
  if (/[A-Za-z]/.test(raw)) return raw;
  const tokens = raw.split(/[/\-.:\s]+/);
  const out: string[] = [];
  let carry = '';
  for (let i = 0; i < limits.length; i++) {
    const g = carry + (tokens[i] ?? '');
    if (i < limits.length - 1 && g.length > limits[i]) {
      out.push(g.slice(0, limits[i]));
      carry = g.slice(limits[i]);
    } else {
      out.push(g.slice(0, limits[i]));
      carry = '';
    }
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  let res = out.join(sep);
  const typing = raw.length > prev.length;
  const last = out.length - 1;
  if (typing && out.length < limits.length && last >= 0 && (out[last].length === limits[last] || /[/\-.:\s]$/.test(raw))) res += sep;
  return res.slice(0, limits.reduce((a, b) => a + b, 0) + sep.length * (limits.length - 1));
}

export default function PickerField(props: ShellProps) {
  const {
    innerRef, normalize, format, parse, mask, fullLength, icon, ariaLabel, invalidMessage, bounds, popoverWidth, children,
    label, error, helperText, clearable, value, defaultValue, onChange, onValueChange, onBlur, onFocus, min, max, required, disabled,
    name, id, placeholder, className, autoFocus, ...rest
  } = props;
  const autoId = useId();
  const inputId = id ?? autoId;
  const phone = useIsPhone();
  const controlled = value !== undefined;
  const [state, setState] = useState(() => normalize(controlled ? value : defaultValue));
  const iso = controlled ? normalize(value) : state;
  const [text, setText] = useState(format(iso));
  const [typeErr, setTypeErr] = useState('');
  const [open, setOpen] = useState(false);

  const initialIso = useRef(iso);
  const hiddenRef = useRef<HTMLInputElement | null>(null);
  const visibleRef = useRef<HTMLInputElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const latest = useRef({ controlled, value, normalize, format, iso, text });
  latest.current = { controlled, value, normalize, format, iso, text };

  // external writes to the hidden input (react-hook-form reset()/setValue() assign el.value) -> follow them
  const onExternal = useCallback((n: string) => {
    if (!latest.current.controlled) setState(n);
  }, []);
  const syncRef = useRef(onExternal);
  syncRef.current = onExternal;

  const setHidden = useCallback(
    (el: HTMLInputElement | null) => {
      hiddenRef.current = el;
      if (el) {
        const anyEl = el as HTMLInputElement & { __zd?: boolean };
        if (!anyEl.__zd) {
          anyEl.__zd = true;
          // keep React's own value tracker (own property) in the chain, then add normalisation + notification
          const own = Object.getOwnPropertyDescriptor(el, 'value');
          const getter = own?.get ?? protoDesc!.get!;
          const setter = own?.set ?? protoDesc!.set!;
          Object.defineProperty(el, 'value', {
            configurable: true,
            enumerable: true,
            get() {
              return getter.call(this);
            },
            set(v: unknown) {
              const n = latest.current.normalize(v);
              setter.call(this, n);
              syncRef.current(n);
            },
          });
          // react-hook-form focuses the registered element on validation errors: forward to the visible field
          el.focus = () => visibleRef.current?.focus();
        }
      }
      if (typeof innerRef === 'function') innerRef(el);
      else if (innerRef) (innerRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
    },
    [innerRef]
  );

  // controlled: mirror the prop into state so switching modes stays consistent
  useEffect(() => {
    if (controlled) setState(normalize(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, controlled]);

  // keep the hidden input's DOM value equal to the ISO value (no events: those are for user edits)
  useEffect(() => {
    const el = hiddenRef.current;
    if (el && nativeGet(el) !== iso) nativeSet(el, iso);
  });

  // text follows the value unless the user's own text already parses to it
  useEffect(() => {
    if (parse(latest.current.text) !== iso) {
      setText(format(iso));
      setTypeErr('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  const fireBlur = () => hiddenRef.current?.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));

  const emit = (next: string) => {
    const el = hiddenRef.current;
    if (el && nativeGet(el) !== next) {
      nativeSet(el, next);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    if (!latest.current.controlled) setState(next);
    onValueChange?.(next);
    if (latest.current.controlled) {
      // a parent that refuses the change keeps its value: put the DOM and the text back
      window.setTimeout(() => {
        const l = latest.current;
        const keep = l.normalize(l.value);
        if (el && nativeGet(el) !== keep) nativeSet(el, keep);
        setText(l.format(keep));
      }, 0);
    }
  };

  const check = (p: string): string | null => {
    if (min && p < min && min.length === p.length) return `Must be on or after ${format(min)}`;
    if (max && p > max && max.length === p.length) return `Must be on or before ${format(max)}`;
    return bounds ? bounds(p) : null;
  };

  const commitText = (): boolean => {
    const t = latest.current.text.trim();
    if (!t) {
      setTypeErr('');
      if (latest.current.iso) emit('');
      return true;
    }
    const p = parse(t);
    if (!p) {
      setTypeErr(invalidMessage);
      return false;
    }
    const bad = check(p);
    if (bad) {
      setTypeErr(bad);
      return false;
    }
    setTypeErr('');
    if (p !== latest.current.iso) emit(p);
    setText(format(p));
    return true;
  };

  const close = (refocus: boolean) => {
    setOpen(false);
    if (refocus) visibleRef.current?.focus({ preventScroll: true });
    else
      window.requestAnimationFrame(() => {
        if (!anchorRef.current?.contains(document.activeElement)) fireBlur();
      });
  };

  const canClear = (clearable ?? !required) && !disabled;
  const ctx: PickerCtx = {
    iso,
    phone,
    canClear,
    commit: (next, closeIt = true) => {
      setTypeErr('');
      emit(next);
      setText(format(next));
      if (closeIt) close(true);
    },
    close: () => close(true),
    clear: () => {
      setTypeErr('');
      emit('');
      setText('');
      close(true);
    },
  };

  const shownError = error || typeErr;
  const showClearBtn = canClear && !!iso;

  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className={labelClasses}>
          {label}
          {required && <span className="ml-0.5 text-[#D9534F]">*</span>}
        </label>
      )}
      <div ref={anchorRef} className="group relative">
        <input
          ref={visibleRef}
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          value={text}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-label={label ? undefined : (rest['aria-label'] ?? ariaLabel)}
          aria-invalid={shownError ? true : undefined}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-describedby={shownError ? `${inputId}-error` : helperText ? `${inputId}-hint` : undefined}
          onFocus={onFocus}
          onChange={(e) => {
            const m = mask(e.target.value, text);
            setText(m);
            setTypeErr('');
            if (m.trim() === '') {
              if (iso) emit('');
              return;
            }
            const p = parse(m);
            if (p) {
              const bad = check(p);
              if (bad) setTypeErr(bad);
              else if (p !== iso) emit(p);
            } else if (m.length >= fullLength) setTypeErr(invalidMessage);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
              e.preventDefault();
              if (e.key === 'Enter' && text.trim() !== format(iso) && commitText()) return;
              if (!disabled) setOpen(true);
            }
          }}
          onBlur={(e) => {
            const to = e.relatedTarget as Element | null;
            if (to && (anchorRef.current?.contains(to) || to.closest('[data-floating-panel]'))) return;
            commitText();
            fireBlur();
          }}
          className={cn(controlClasses, 'flex h-9 max-sm:h-11', showClearBtn ? 'pr-[68px]' : 'pr-10', shownError && controlErrorClasses, className)}
        />
        {showClearBtn && (
          <button
            type="button"
            aria-label="Clear"
            tabIndex={-1}
            onClick={() => {
              ctx.clear();
            }}
            className="absolute right-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#7B8983] transition-colors hover:bg-primary-50 hover:text-[#18231E] max-sm:h-9 max-sm:w-9 dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-surface-text"
          >
            <FiX className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close(true) : setOpen(true))}
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#7B8983] transition-colors hover:bg-primary-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-600 disabled:cursor-not-allowed disabled:opacity-50 max-sm:h-9 max-sm:w-9 dark:text-surface-muted dark:hover:bg-surface-hover dark:hover:text-brand-lime dark:focus-visible:ring-brand-lime"
        >
          {icon}
        </button>
        {/* the real, form-facing input: holds the ISO value, receives real input/change events */}
        <input
          {...rest}
          ref={setHidden}
          type="text"
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          disabled={disabled}
          defaultValue={initialIso.current}
          onChange={onChange}
          onBlur={onBlur}
          data-picker-value=""
          className="pointer-events-none absolute left-0 top-0 h-px w-px overflow-hidden opacity-0"
        />
        <PickerPopover open={open} anchorRef={anchorRef} onClose={close} width={popoverWidth} label={ariaLabel}>
          {children(ctx)}
        </PickerPopover>
      </div>
      {shownError && (
        <p id={`${inputId}-error`} role="alert" className="mt-1.5 text-[12px] font-medium text-[#B3261E] dark:text-red-300">{shownError}</p>
      )}
      {helperText && !shownError && (
        <p id={`${inputId}-hint`} className="mt-1.5 text-[12px] text-[#7B8983] dark:text-surface-muted">{helperText}</p>
      )}
    </div>
  );
}
