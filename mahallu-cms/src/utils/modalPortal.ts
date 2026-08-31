export const MODAL_PORTAL_TARGET_ID = 'app-content-area';

/**
 * Modals center within the content area (right of the sidebar) when rendered
 * inside MainLayout, and fall back to full-viewport centering (e.g. login
 * pages) when that container isn't present.
 */
export function getModalPortalTarget(): { node: HTMLElement; scoped: boolean } {
  const scopedNode = document.getElementById(MODAL_PORTAL_TARGET_ID);
  return scopedNode ? { node: scopedNode, scoped: true } : { node: document.body, scoped: false };
}
