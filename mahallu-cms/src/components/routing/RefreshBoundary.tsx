import { Fragment, ReactNode, useContext } from 'react';
import { RefreshKeyContext } from '@/hooks/useModalContext';

/** Remounts the page when a route modal closed after a successful write, so lists refetch. */
export default function RefreshBoundary({ children }: { children: ReactNode }) {
  const key = useContext(RefreshKeyContext);
  return <Fragment key={key}>{children}</Fragment>;
}
