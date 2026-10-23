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

/**
 * The sign-in name an account can use instead of its phone number.
 *
 * Lowercase letters, digits and `. _ -`, 4 to 30 characters, starting with a letter or digit and
 * containing at least one letter. The letter rule keeps a username from ever looking like a phone
 * number, so "phone or username" is never ambiguous on the sign-in form.
 */
export const USERNAME_PATTERN = /^(?=.*[a-z])[a-z0-9][a-z0-9._-]{3,29}$/;
export const USERNAME_MESSAGE =
  'Use 4 to 30 lowercase letters, numbers, dots, dashes or underscores, with at least one letter.';

/** The stored form of a username: trimmed and lowercase. Returns '' for anything that is not text. */
export const normalizeUsername = (input: unknown): string => (typeof input === 'string' ? input.trim().toLowerCase() : '');

export const isValidUsername = (input: unknown): boolean => USERNAME_PATTERN.test(normalizeUsername(input));

/** Rule for any password an administrator sets or a person chooses on a credential screen. */
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;
export const PASSWORD_MESSAGE = `Please use ${PASSWORD_MIN} to ${PASSWORD_MAX} characters, with at least one letter and one number.`;

export const isStrongPassword = (input: unknown): boolean =>
  typeof input === 'string' &&
  input.length >= PASSWORD_MIN &&
  input.length <= PASSWORD_MAX &&
  /[A-Za-z]/.test(input) &&
  /[0-9]/.test(input);

// No 0/O/1/l/I: a temporary password is read off a screen and typed by someone else.
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const DIGITS = '23456789';

const pick = (alphabet: string): string => alphabet[crypto.randomInt(alphabet.length)];

/**
 * A one-time password for an account whose owner will be told to change it at once.
 * 12 characters from a CSPRNG, always with at least one letter and one number so it satisfies
 * `isStrongPassword`. It is shown to the administrator once and never stored in the clear.
 */
export const generateTemporaryPassword = (length = 12): string => {
  const chars = [pick(LETTERS), pick(DIGITS)];
  while (chars.length < length) chars.push(pick(LETTERS + DIGITS));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
};

/**
 * Compared against when a sign-in names an account that does not exist, so "no such username" costs
 * the same time as "wrong password" and the response timing does not reveal which usernames exist.
 */
export const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 10);
