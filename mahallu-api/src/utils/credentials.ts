import bcrypt from 'bcryptjs';
import crypto from 'crypto';

/**
 * A password hash nobody knows.
 *
 * Accounts that are created for someone else (a member's login created on first OTP, a staff user an
 * admin adds without choosing a password) used to get the shared default "123456". Anyone who knew a
 * phone number could then sign in with it. These accounts now start with a random 256-bit secret that
 * is hashed and immediately discarded: the person signs in with an OTP to their own phone, and can set
 * a password of their own later. Nothing about this value is returned or logged.
 */
export const randomUnusablePasswordHash = async (): Promise<string> =>
  bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
