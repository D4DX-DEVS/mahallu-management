/**
 * App Store Review Test User Setup
 *
 * Creates a test account with phone 8877665544 that has access to all three
 * user types: mahall (admin), institute, and member.
 *
 * OTP for this number is always 123456 (bypasses DXING in production).
 *
 * Usage:
 *   npx ts-node src/scripts/createTestUser.ts
 */

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

const TEST_PHONE = '8877665544';
const TEST_PHONE_NORMALIZED = '918877665544';
const TEST_PASSWORD = '123456';
const TEST_TENANT_CODE = 'TEST001';
const FULL_PERMISSIONS = { view: true, add: true, edit: true, delete: true };

async function getOrCreateTenant(): Promise<mongoose.Types.ObjectId> {
  let tenant = await Tenant.findOne({ code: TEST_TENANT_CODE });
  if (tenant) {
    console.log(`✅ Using existing test tenant: ${tenant.name}`);
    return tenant._id as mongoose.Types.ObjectId;
  }

  // Fall back to first active tenant
  tenant = await Tenant.findOne({ status: 'active' });
  if (tenant) {
    console.log(`✅ Using existing tenant: ${tenant.name} (${tenant.code})`);
    return tenant._id as mongoose.Types.ObjectId;
  }

  // Create a minimal test tenant
  tenant = new Tenant({
    name: 'App Store Test Mahallu',
    code: TEST_TENANT_CODE,
    type: 'standard',
    location: 'Kerala',
    address: {
      state: 'Kerala',
      district: 'Kozhikode',
      lsgName: 'Kozhikode Corporation',
      village: 'Kozhikode',
    },
    status: 'active',
    subscription: { plan: 'standard', startDate: new Date(), isActive: true },
    settings: {
      varisangyaAmount: 100,
      educationOptions: [],
      features: {},
    },
  });
  await tenant.save();
  console.log(`✅ Created test tenant: ${tenant.name}`);
  return tenant._id as mongoose.Types.ObjectId;
}

async function getOrCreateInstitute(tenantId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
  let institute = await Institute.findOne({ tenantId, name: 'App Store Test Institute' });
  if (institute) {
    console.log(`✅ Using existing test institute: ${institute.name}`);
    return institute._id as mongoose.Types.ObjectId;
  }

  institute = new Institute({
    tenantId,
    name: 'App Store Test Institute',
    place: 'Kozhikode',
    type: 'institute',
    status: 'active',
  });
  await institute.save();
  console.log(`✅ Created test institute: ${institute.name}`);
  return institute._id as mongoose.Types.ObjectId;
}

async function getOrCreateMember(tenantId: mongoose.Types.ObjectId): Promise<mongoose.Types.ObjectId> {
  // Try by phone first
  let member = await Member.findOne({ phone: { $in: [TEST_PHONE, TEST_PHONE_NORMALIZED] } });
  if (member) {
    console.log(`✅ Using existing test member: ${member.name}`);
    return member._id as mongoose.Types.ObjectId;
  }

  // Need a family for the member
  let family = await Family.findOne({ tenantId, houseName: 'App Store Test House' });
  if (!family) {
    family = new Family({
      tenantId,
      houseName: 'App Store Test House',
      familyHead: 'Test User',
      status: 'approved',
    });
    await family.save();
    console.log(`✅ Created test family: ${family.houseName}`);
  } else {
    console.log(`✅ Using existing test family: ${family.houseName}`);
  }

  member = new Member({
    tenantId,
    name: 'App Store Test User',
    familyId: family._id,
    familyName: 'App Store Test House',
    phone: TEST_PHONE,
    status: 'active',
  });
  await member.save();
  console.log(`✅ Created test member: ${member.name}`);
  return member._id as mongoose.Types.ObjectId;
}

async function upsertUser(data: {
  name: string;
  phone: string;
  role: 'mahall' | 'institute' | 'member';
  tenantId: mongoose.Types.ObjectId;
  memberId?: mongoose.Types.ObjectId;
  instituteId?: mongoose.Types.ObjectId;
}) {
  const phoneVariants = [data.phone, `91${data.phone}`, `+91${data.phone}`];
  const existing = await User.findOne({ phone: { $in: phoneVariants }, role: data.role });
  if (existing) {
    // Ensure it is active with full permissions
    existing.status = 'active';
    existing.permissions = FULL_PERMISSIONS;
    await existing.save();
    console.log(`✅ Updated existing ${data.role} user: ${existing.name} (${existing.phone})`);
    return;
  }

  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  const user = new User({
    name: data.name,
    phone: data.phone,
    role: data.role,
    tenantId: data.tenantId,
    memberId: data.memberId ?? null,
    instituteId: data.instituteId ?? null,
    status: 'active',
    isSuperAdmin: false,
    permissions: FULL_PERMISSIONS,
    password: hashedPassword,
  });
  await user.save();
  console.log(`✅ Created ${data.role} user: ${user.name} (${user.phone})`);
}

async function main() {
  try {
    await connectDatabase();
    console.log('\n🚀 Setting up App Store Review test account...\n');
    console.log(`   Phone  : ${TEST_PHONE}`);
    console.log(`   OTP    : 123456 (always, bypasses DXING)`);
    console.log(`   Roles  : mahall | institute | member\n`);

    const tenantId = await getOrCreateTenant();
    const instituteId = await getOrCreateInstitute(tenantId);
    const memberId = await getOrCreateMember(tenantId);

    await upsertUser({
      name: 'Test User (Mahall)',
      phone: TEST_PHONE,
      role: 'mahall',
      tenantId,
    });

    await upsertUser({
      name: 'Test User (Institute)',
      phone: TEST_PHONE,
      role: 'institute',
      tenantId,
      instituteId,
    });

    await upsertUser({
      name: 'Test User (Member)',
      phone: TEST_PHONE,
      role: 'member',
      tenantId,
      memberId,
    });

    console.log('\n✅ App Store Review test account ready!\n');
    console.log('   Login with OTP flow:');
    console.log(`     1. Send OTP to phone: ${TEST_PHONE}`);
    console.log('     2. Enter OTP: 123456');
    console.log('     3. Select any of the 3 roles when prompted\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
