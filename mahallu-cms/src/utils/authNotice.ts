/**
 * A one-line message handed to the sign-in page across the redirect that ends a session.
 *
 * The API client signs the user out and reloads /login when the session ends for a reason the person
 * should hear (their Mahallu was suspended); the reload would drop a toast, so the message travels in
 * sessionStorage (this tab only) and the login page shows it once. Storage can be unavailable (private
 * mode): the message is then simply not shown, the sign-out still happens.
 */
const KEY = 'auth-notice';

export const setAuthNotice = (message: string): void => {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // best effort
  }
};

export const peekAuthNotice = (): string => {
  try {
    return sessionStorage.getItem(KEY) || '';
  } catch {
    return '';
  }
};

export const clearAuthNotice = (): void => {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // best effort
  }
};
