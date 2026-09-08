import { Component, ErrorInfo, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { FiAlertTriangle } from 'react-icons/fi';
import Button from './Button';

/*
 * Nothing used to stand between a render-time exception and the user.
 *
 * React unmounts the whole tree when a component throws and no boundary
 * catches it, so a single `undefined.map()` on one page replaced the entire
 * app — sidebar, header and all — with an empty white document, with no way
 * back except a manual reload. A crash on one screen should cost the user
 * that screen, not the session.
 *
 * `RouteErrorBoundary` keeps the page chrome alive, explains what happened in
 * the user's words, and resets itself when they navigate somewhere else, so a
 * bad record no longer strands them.
 */

interface Props {
  children: ReactNode;
  /** Changing this value clears a caught error — used to recover on navigation. */
  resetKey?: string;
  /** Copy for the retry action; the reload fallback is used when absent. */
  onRetry?: () => void;
  /** Rendered instead of the default card when the caller wants its own copy. */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidUpdate(prev: Props) {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The real detail stays where an engineer can find it, never on screen.
    console.error('[ui] render failed:', error, info.componentStack);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <FiAlertTriangle className="mb-4 h-8 w-8 text-destructive" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">This page couldn’t be shown</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Something went wrong while loading it. Your data is safe — try again, or move to another
          section.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={this.props.onRetry ?? this.reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
        </div>
      </div>
    );
  }
}

/** Page-level boundary: recovers on its own as soon as the user navigates away. */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <ErrorBoundary resetKey={location.pathname + location.search}>{children}</ErrorBoundary>;
}

/**
 * Outermost boundary. Catches anything the page-level one can't — the layout
 * itself, a store, a provider — where there is no chrome left to navigate with.
 */
export function AppErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={(_error, reset) => (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 text-center">
          <FiAlertTriangle className="mb-4 h-10 w-10 text-destructive" aria-hidden="true" />
          <h1 className="text-lg font-semibold text-foreground">Mahal Connect ran into a problem</h1>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            The app stopped unexpectedly. Nothing you saved has been lost. Reloading usually clears
            it.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <Button onClick={() => window.location.reload()}>Reload</Button>
            <Button
              variant="outline"
              onClick={() => {
                reset();
                window.location.href = '/dashboard';
              }}
            >
              Go to dashboard
            </Button>
          </div>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

/** Small boundary for a widget inside a page — a chart, a panel, a card. */
export function WidgetErrorBoundary({ children, label }: { children: ReactNode; label?: string }) {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-4 py-6 text-sm text-muted-foreground">
          <FiAlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          <span>{label ? label + ' couldn’t be shown.' : 'This section couldn’t be shown.'}</span>
        </div>
      )}
    >
      {children}
    </ErrorBoundary>
  );
}

export default ErrorBoundary;
