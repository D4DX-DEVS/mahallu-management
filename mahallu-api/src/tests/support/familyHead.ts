import Member from '../../models/Member';

/**
 * Among members only the family head signs in, and every sign-in and request looks the member up to
 * check (services/familyHeadLogin.ts). A test whose member account should be allowed in calls this:
 * every member lookup by id answers with an active family head. Returns the function that undoes it.
 */
export const stubFamilyHead = (member: Record<string, unknown> | null = { isFamilyHead: true, status: 'active', phone: '9000000001' }) => {
  const original = Member.findById;
  (Member as any).findById = () => ({ select: async () => member });
  return () => {
    (Member as any).findById = original;
  };
};
