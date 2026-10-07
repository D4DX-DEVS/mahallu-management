/**
 * Multi-role QA test-account restoration.
 *
 * Recreates the missing role accounts for a QA test phone number so the
 * OTP → account-selection flow has something to select between again.
 * Never touches a phone number this script wasn't explicitly told about,
 * and never deletes or overwrites an existing account's identity.
 *
 * SAFETY:
 *   - Refuses to run unless NODE_ENV !== 'production' AND
 *     ALLOW_TEST_DATA_SEED=true is set — two separate opt-ins, so a stray
 *     invocation against a production-configured environment does nothing.
 *   - The phone number comes only from the TEST_PHONE env var — never
 *     hardcoded, never logged in full.
 *   - Idempotent: an existing (phone, tenantId, role) account is reactivated
 *     in place, never duplicated, never deleted, matching the User schema's
 *     own compound-unique index.
 *   - Only ever creates or reactivates accounts; never deletes anything.
 *
 * Usage:
 *   TEST_PHONE=<10-digit number> \
 *   ALLOW_TEST_DATA_SEED=true \
 *   [TEST_TENANT_CODE=<existing tenant code>] \
 *   [TEST_PASSWORD=<password>] \
 *   [TEST_ROLES=super_admin,mahall,institute,member,survey] \
 *     npx ts-node src/scripts/restoreTestAccounts.ts
 *
 * TEST_ROLES defaults to: mahall,institute,member (the same three the
 * App Store test account uses). Add super_admin and/or survey explicitly —
 * they are opt-in, not default, since a super_admin account is the most
 * sensitive one to hand out.
 */

import crypto from 'crypto';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Tenant from '../models/Tenant';
import Family from '../models/Family';
import Member from '../models/Member';
import Institute from '../models/Institute';

dotenv.config();

type SupportedRole = 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';
const ALL_ROLES: SupportedRole[] = ['super_admin', 'mahall', 'survey', 'institute', 'member'];

const FULL_PERMISSIONS = { view: true, add: true, edit: true, delete: true };

const maskPhone = (phone: string) => (phone.length > 2 ? `${'*'.repeat(phone.length - 2)}${phone.slice(-2)}` : '**');

function assertSafeToRun() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to run: NODE_ENV is production.');
  }
  if (process.env.ALLOW_TEST_DATA_SEED !== 'true') {
    throw new Error(
      'Refusing to run: set ALLOW_TEST_DATA_SEED=true explicitly to confirm this is a test/dev database.'
    );
  }
}

function readConfig() {
  const phone = process.env.TEST_PHONE?.trim();
  if (!phone || !/^\d{10}$/.test(phone)) {
    throw new Error('Set TEST_PHONE to a 10-digit test phone number via environment variable.');
  }

  const rolesInput = process.env.TEST_ROLES?.trim();
  const roles: SupportedRole[] = rolesInput
    ? (rolesInput.split(',').map((r) => r.trim()) as SupportedRole[])
    : ['mahall', 'institute', 'member'];

  const invalid = roles.filter((r) => !ALL_ROLES.includes(r));
  if (invalid.length > 0) {
    throw new Error(`Unsupported role(s) in TEST_ROLES: ${invalid.join(', ')}. Supported: ${ALL_ROLES.join(', ')}`);
  }

  return {
    phone,
    roles,
    tenantCode: process.env.TEST_TENANT_CODE?.trim(),
    // Only meaningful for password-based sign-in; OTP login never reads this.
    // A random value is generated when not supplied, so nothing predictable
    // is ever written and nothing is ever printed.
    password: process.env.TEST_PASSWORD?.trim() || crypto.randomBytes(12).toString('hex'),
  };
}

async function getOrCreateTenant(tenantCode?: string): Promise<mongoose.Types.ObjectId> {
  if (tenantCode) {
    const byCode = await Tenant.findOne({ code: tenantCode });
    if (byCode) return byCode._id as mongoose.Types.ObjectId;
    throw new Error(`TEST_TENANT_CODE "${tenantCode}" does not match an existing tenant. Not creating a new one implicitly.`);
  }

  const anyActive = await Tenant.findOne({ status: 'active' });
  if (anyActive) {
    console.log(`Using existing tenant: ${anyActive.name} (${anyActive.code})`);
    return anyActive._id as mongoose.Types.ObjectId;
  }

  throw new Error('No active tenant exists and no TEST_TENANT_CODE was given — create a tenant first, or pass TEST_TENANT_CODE.');
}

async function getOrCreateInstitute(tenantId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
  let institute = await Institute.findOne({ tenantId, name: 'QA Test Institute' });
  if (institute) return institute._id as mongoose.Types.ObjectId;

  institute = new Institute({ tenantId, name: 'QA Test Institute', place: 'Test', type: 'institute', status: 'active' });
  await institute.save();
  console.log('Created QA test institute.');
  return institute._id as mongoose.Types.ObjectId;
}

async function getOrCreateMember(tenantId: mongoose.Types.ObjectId, phone: string): Promise<mongoose.Types.ObjectId> {
  const phoneVariants = [phone, `91${phone}`, `+91${phone}`];
  let member = await Member.findOne({ phone: { $in: phoneVariants } });
  if (member) return member._id as mongoose.Types.ObjectId;

  let family = await Family.findOne({ tenantId, houseName: 'QA Test House' });
  if (!family) {
    family = new Family({ tenantId, houseName: 'QA Test House', familyHead: 'QA Test User', status: 'approved' });
    await family.save();
    console.log('Created QA test family.');
  }

  member = new Member({
    tenantId,
    name: 'QA Test Member',
    familyId: family._id,
    familyName: family.houseName,
    phone,
    status: 'active',
  });
  await member.save();
  console.log('Created QA test member profile.');
  return member._id as mongoose.Types.ObjectId;
}

async function upsertRoleAccount(opts: {
  phone: string;
  role: SupportedRole;
  tenantId: mongoose.Types.ObjectId | null;
  instituteId?: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  hashedPassword: string;
}) {
  const { phone, role, tenantId, instituteId, memberId, hashedPassword } = opts;
  const phoneVariants = [phone, `91${phone}`, `+91${phone}`];

  // Matches the schema's own { phone, tenantId, role } uniqueness — the exact
  // combination that the recent multi-role duplicate-check fix in
  // userController.ts relies on, so this script must key on it the same way.
  const existing = await User.findOne({ phone: { $in: phoneVariants }, tenantId, role });
  if (existing) {
    let changed = false;
    if (existing.status !== 'active') {
      existing.status = 'active';
      changed = true;
    }
    if (changed) {
      await existing.save();
      console.log(`Reactivated existing ${role} account.`);
    } else {
      console.log(`${role} account already exists and is active — left untouched.`);
    }
    return;
  }

  const user = new User({
    name: `QA Test (${role})`,
    phone,
    role,
    tenantId,
    memberId: memberId ?? null,
    instituteId: instituteId ?? null,
    status: 'active',
    isSuperAdmin: role === 'super_admin',
    permissions: FULL_PERMISSIONS,
    password: hashedPassword,
  });
  await user.save();
  console.log(`Created ${role} account.`);
}

async function main() {
  assertSafeToRun();
  const { phone, roles, tenantCode, password } = readConfig();

  console.log(`\nRestoring QA test accounts for phone ${maskPhone(phone)}`);
  console.log(`Roles requested: ${roles.join(', ')}\n`);

  await connectDatabase();
  const hashedPassword = await bcrypt.hash(password, 10);

  let tenantId: mongoose.Types.ObjectId | null = null;
  if (roles.some((r) => r !== 'super_admin')) {
    tenantId = await getOrCreateTenant(tenantCode);
  }

  for (const role of roles) {
    if (role === 'super_admin') {
      await upsertRoleAccount({ phone, role, tenantId: null, hashedPassword });
      continue;
    }
    if (role === 'institute') {
      const instituteId = await getOrCreateInstitute(tenantId!);
      await upsertRoleAccount({ phone, role, tenantId, instituteId, hashedPassword });
      continue;
    }
    if (role === 'member') {
      const memberId = await getOrCreateMember(tenantId!, phone);
      await upsertRoleAccount({ phone, role, tenantId, memberId, hashedPassword });
      continue;
    }
    // mahall, survey
    await upsertRoleAccount({ phone, role, tenantId, hashedPassword });
  }

  console.log('\nDone. Sign in with that phone via the normal OTP flow to see the account-selection screen.\n');
  await mongoose.connection.close();
  process.exit(0);
}

main().catch(async (error: any) => {
  console.error(`\nAborted: ${error.message}\n`);
  try {
    await mongoose.connection.close();
  } catch {
    // already closed / never opened
  }
  process.exit(1);
});
