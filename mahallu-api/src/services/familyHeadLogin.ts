import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import Member from '../models/Member';
import User from '../models/User';

/*
 * Family head sign-in.
 *
 * Among a Mahallu's members only the family head signs in. Their sign-in name is their phone number
 * and their password is generated here, by the Mahallu, not chosen by them. The Mahallu admin has to
 * be able to read it out again later (a head who forgot it asks the office), so next to the usual
 * one-way hash the account keeps a copy the server can decrypt (`User.issuedPassword`). That copy is
 * never selected by default and never leaves the member-credentials endpoints.
 */

/** Capital letters and digits, without 0/O/1/I: it is read off a screen and typed by someone else. */
const PASSWORD_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const HEAD_PASSWORD_LENGTH = 8;

export const generateHeadPassword = (): string =>
  Array.from({ length: HEAD_PASSWORD_LENGTH }, () => PASSWORD_ALPHABET[crypto.randomInt(PASSWORD_ALPHABET.length)]).join('');

/** A key for this one purpose, derived from the server secret, so no extra setting is needed. */
const sealKey = (): Buffer => {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is not set');
  return Buffer.from(crypto.hkdfSync('sha256', process.env.JWT_SECRET, Buffer.alloc(0), 'family-head-issued-password', 32));
};

/** AES-256-GCM, stored as `iv.tag.ciphertext` in base64. */
export const sealPassword = (plain: string): string => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', sealKey(), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((part) => part.toString('base64')).join('.');
};

/** The issued password, or null when there is none or it can no longer be read (the server secret changed). */
export const openPassword = (sealed: unknown): string | null => {
  if (typeof sealed !== 'string' || !sealed) return null;
  try {
    const [iv, tag, body] = sealed.split('.').map((part) => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', sealKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
};

type MemberLike = { _id: unknown; name?: string; phone?: string; tenantId?: unknown; isFamilyHead?: boolean; status?: string };

/** The one rule: an active family head with a phone number signs in; no other member does. */
export const mayMemberSignIn = (member: MemberLike | null | undefined): boolean =>
  Boolean(member && member.isFamilyHead === true && member.status === 'active' && member.phone);

export const HEAD_ONLY_MESSAGE = 'Only the family head can sign in. Please contact your Mahallu admin.';
/** A family head signs in with the password only: an OTP never opens a member account. */
export const HEAD_PASSWORD_ONLY_MESSAGE =
  'Family heads sign in with their phone number and password. Please ask your Mahallu admin for your password.';
export const HEAD_PHONE_REQUIRED = "Please enter the family head's phone number. They sign in with it.";

/**
 * Whether this login account may be used. Staff accounts always may; a member account only while the
 * member it belongs to is an active family head. Asked at every sign-in and on every request, so a
 * member account from before this rule stops working without having to be found and switched off.
 */
export const maySignIn = async (user: { role?: string; memberId?: unknown } | null | undefined): Promise<boolean> => {
  if (!user) return false;
  if (user.role !== 'member') return true;
  if (!user.memberId) return false;
  return mayMemberSignIn(await Member.findById(user.memberId).select('isFamilyHead status phone'));
};

/** A fresh password for the account: hashed for sign-in, sealed for the admin, every old session ended. */
export const issueHeadPassword = async (userId: unknown): Promise<string> => {
  const password = generateHeadPassword();
  await User.updateOne(
    { _id: userId },
    {
      $set: { password: await bcrypt.hash(password, 10), issuedPassword: sealPassword(password), passwordResetRequired: false },
      $inc: { tokenVersion: 1 },
    }
  );
  return password;
};

/**
 * Brings a member's login account in line with the member record. Call it after anything that changes
 * who the member is: created, edited, activated, deactivated, deleted.
 *
 *  - an active family head with a phone number has an active account on that number (created here,
 *    with a generated password, when there is none);
 *  - anyone else has no usable account: one that exists is switched off and its sessions ended.
 */
export const syncHeadLogin = async (member: MemberLike): Promise<{ created: boolean }> => {
  const account = await User.findOne({ memberId: member._id, role: 'member' });

  if (!mayMemberSignIn(member)) {
    if (account && account.status === 'active') {
      await User.updateOne({ _id: account._id }, { $set: { status: 'inactive' }, $inc: { tokenVersion: 1 } });
    }
    return { created: false };
  }

  if (!account) {
    const password = generateHeadPassword();
    await new User({
      name: member.name,
      phone: member.phone,
      role: 'member',
      tenantId: member.tenantId,
      memberId: member._id,
      status: 'active',
      isSuperAdmin: false,
      permissions: { view: true, add: false, edit: false, delete: false },
      password: await bcrypt.hash(password, 10),
      issuedPassword: sealPassword(password),
    }).save();
    return { created: true };
  }

  const phoneChanged = account.phone !== member.phone;
  if (phoneChanged || account.name !== member.name || account.status !== 'active') {
    await User.updateOne(
      { _id: account._id },
      // A new phone number is a new sign-in name: sessions opened under the old one end.
      { $set: { phone: member.phone, name: member.name, status: 'active' }, ...(phoneChanged ? { $inc: { tokenVersion: 1 } } : {}) }
    );
  }
  return { created: false };
};
