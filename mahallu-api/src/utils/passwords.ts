import crypto from 'crypto';

/**
 * Initial password for accounts created without an explicit password.
 * Never a fixed well-known value: uses DEFAULT_MEMBER_PASSWORD when the
 * operator configured one, otherwise a random throwaway (member accounts
 * sign in by OTP, admin accounts can use OTP or a password reset).
 */
export const getInitialPassword = (): string =>
  process.env.DEFAULT_MEMBER_PASSWORD || crypto.randomBytes(18).toString('base64url');
