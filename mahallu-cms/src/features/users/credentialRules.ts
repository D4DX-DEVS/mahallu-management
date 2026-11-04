import { z } from 'zod';
import type { User } from '@/types';

/*
 * Sign-in rules, mirroring the API (utils/credentials.ts). The API is the authority: these only give
 * an earlier, friendlier message.
 */
export const USERNAME_PATTERN = /^(?=.*[a-z])[a-z0-9][a-z0-9._-]{3,29}$/;
export const USERNAME_HINT =
  'Use 4 to 30 lowercase letters, numbers, dots, dashes or underscores, with at least one letter.';
export const PASSWORD_HINT = 'Use 8 to 128 characters, with at least one letter and one number.';

export const isStrongPassword = (value: string) =>
  value.length >= 8 && value.length <= 128 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);

/** What the API stores: trimmed and lowercase. */
export const normalizeUsername = (value: string) => value.trim().toLowerCase();

export const usernameSchema = z.string().refine((value) => USERNAME_PATTERN.test(normalizeUsername(value)), USERNAME_HINT);

export const passwordSchema = z.string().refine(isStrongPassword, PASSWORD_HINT);

/** username + password + matching confirmation, for the user-creation forms. */
export const credentialFields = {
  username: usernameSchema,
  password: passwordSchema,
  confirmPassword: z.string().min(1, 'Please repeat the password.'),
};

export const passwordsMatch = {
  check: (data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword,
  message: { message: 'The two passwords do not match.', path: ['confirmPassword'] },
};

/**
 * Whether the signed-in account is offered the credential actions for `target`. A convenience only: the
 * API decides (same rules as utils/credentialAccess.ts) and answers 403/404 whatever this says.
 */
export const canManageCredentials = (
  actor: Pick<User, 'id' | 'role'> | null | undefined,
  actorIsSuperAdmin: boolean,
  isImpersonating: boolean,
  target: Pick<User, 'id' | 'role'>
): boolean => {
  if (!actor || isImpersonating || actor.id === target.id) return false;
  if (!['mahall', 'survey', 'institute'].includes(target.role)) return false;
  if (actorIsSuperAdmin) return true;
  return actor.role === 'mahall' && target.role !== 'mahall';
};

/** The repeated password is only a typing check; it is never sent. */
export const withoutConfirmation = <T extends { confirmPassword?: string }>(data: T): Omit<T, 'confirmPassword'> => {
  const copy: Partial<T> = { ...data };
  delete copy.confirmPassword;
  return copy as Omit<T, 'confirmPassword'>;
};
