import jwt from 'jsonwebtoken';

/**
 * Session JWTs.
 *
 * Claims:
 *  - `userId`    the account this session acts as.
 *  - `tv`        the account's `tokenVersion` when the token was issued. authMiddleware rejects a
 *                token whose `tv` no longer matches, which is how logout, a password change, a
 *                phone change and similar security events end every existing session.
 *  - `pp`        "proven phone": the normalised phone number the person proved they control with an
 *                OTP during THIS sign-in. It is the only thing account switching trusts. It is set
 *                by the OTP flows and carried through switch-account; password sign-in never sets
 *                it, because knowing a password proves nothing about owning the phone number an
 *                admin may have typed onto that account.
 *  - `instituteId` the institute of an institute account, for the client. The server never trusts it:
 *                authMiddleware reads the institute from the account record on every request.
 */
export const SESSION_TTL = '7d';
/** "View As" sessions are a support/testing tool and are not worth a week of validity. */
export const IMPERSONATION_TTL = '4h';

interface SessionUser {
  _id: unknown;
  isSuperAdmin?: boolean;
  tokenVersion?: number;
  role?: string;
  instituteId?: unknown;
}

/** The institute of an institute account, as a string; null for every other account. */
const instituteIdOf = (user: SessionUser): string | null =>
  user.role === 'institute' && user.instituteId ? String((user.instituteId as any)?._id ?? user.instituteId) : null;

const secret = (): string => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return process.env.JWT_SECRET;
};

export const signSessionToken = (user: SessionUser, opts: { provenPhone?: string } = {}): string =>
  jwt.sign(
    {
      userId: user._id,
      isSuperAdmin: user.isSuperAdmin,
      tv: user.tokenVersion ?? 0,
      ...(opts.provenPhone ? { pp: opts.provenPhone } : {}),
      ...(instituteIdOf(user) ? { instituteId: instituteIdOf(user) } : {}),
    },
    secret(),
    { expiresIn: SESSION_TTL, algorithm: 'HS256' }
  );

export const signImpersonationToken = (
  superAdmin: SessionUser,
  imp: Record<string, unknown>
): string =>
  jwt.sign(
    { userId: superAdmin._id, isSuperAdmin: true, tv: superAdmin.tokenVersion ?? 0, imp },
    secret(),
    { expiresIn: IMPERSONATION_TTL, algorithm: 'HS256' }
  );

/**
 * The account as the client may see it. `tokenVersion` is the server's session-revocation counter and
 * means nothing to a client, so it is dropped from every user payload sent back after sign-in.
 * An institute account always carries its `instituteId` (as a string), whichever sign-in route built it.
 */
export const toPublicUser = (user: any): any => {
  if (!user) return user;
  const plain = typeof user.toObject === 'function' ? user.toObject() : { ...user };
  delete plain.tokenVersion;
  if (plain.role === 'institute') plain.instituteId = instituteIdOf(plain);
  return plain;
};
