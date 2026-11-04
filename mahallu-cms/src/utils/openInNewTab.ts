/**
 * Open a document that has to be fetched first (a signed link from the API) in a separate tab,
 * leaving the application tab exactly where it is.
 *
 * Browsers only allow a new tab that is opened synchronously from the user's click; one opened after
 * an `await` is treated as a pop-up and blocked. So the blank tab is opened FIRST, inside the click
 * handler, and pointed at the document once the link arrives. If fetching the link fails the blank
 * tab is closed again, so no empty tab is left behind.
 *
 * The link comes from our own API (a short-lived signed URL). It is only followed when it is a plain
 * http(s) address, so a `javascript:` or `data:` value can never be opened. There is no Blob URL here,
 * so nothing needs revoking.
 */

export type OpenResult = 'opened' | 'blocked';

export const isHttpUrl = (value: unknown): value is string => {
  if (typeof value !== 'string' || !value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === 'https:' || protocol === 'http:';
  } catch {
    return false;
  }
};

export async function openInNewTab(resolveUrl: () => Promise<string>): Promise<OpenResult> {
  const tab = window.open('about:blank', '_blank');
  if (!tab) return 'blocked';
  // `noopener` would make window.open return null, so detach the new tab from this one by hand.
  try {
    tab.opener = null;
  } catch {
    /* some browsers refuse to set it; the link target is still our own API's signed URL */
  }
  try {
    tab.document.title = 'Opening…';
  } catch {
    /* cosmetic only */
  }
  try {
    const url = await resolveUrl();
    if (!isHttpUrl(url)) throw new Error('The document link was not a web address.');
    tab.location.replace(url);
    return 'opened';
  } catch (error) {
    tab.close();
    throw error;
  }
}
