import { createContext, useContext } from 'react';

export type ModalPageSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalPageContextValue {
  /** True when the page is rendered inside a route modal (see components/routing/ModalRoutes). */
  isInModal: boolean;
  /** Closes the modal (history back to the background page). */
  close: () => void;
  size: ModalPageSize | null;
  /** DOM node in the modal header that PageHeader portals into. */
  headerEl: HTMLElement | null;
  /** id of the element naming the dialog. */
  titleId?: string;
}

export const ModalPageContext = createContext<ModalPageContextValue>({
  isInModal: false,
  close: () => {},
  size: null,
  headerEl: null,
});

export const useModalPage = () => useContext(ModalPageContext);

/**
 * Set while a modal is being closed programmatically after a successful submit
 * (navigate(LIST) converted into history.go(-n)); useUnsavedChangesGuard lets that pop through.
 */
export const modalNav = { bypassGuard: false };

/** Bumped by ModalRoutes when a modal closes after a successful mutation; route pages remount on change. */
export const RefreshKeyContext = createContext(0);
