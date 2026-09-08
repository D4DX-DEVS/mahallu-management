import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import { connectDatabase } from '../config/database';
import User from '../models/User';
import Tenant from '../models/Tenant';

dotenv.config();

const DEFAULT_PASSWORD = '123456';
const FULL_PERMISSIONS = { view: true, add: true, edit: true, delete: true };

const mahallus = [
  {
    tenantName: 'Masjidul Hilal',
    tenantCode: 'HILAL001',
    location: 'Farooq Nagar Kodinhi',
    address: {
      state: 'Kerala',
      district: 'Malappuram',
      lsgName: 'Kodinhi',
      village: 'Kodinhi',
    },
    adminName: 'PK Kutty',
    adminPhone: '6238486463',
  },
  {
    tenantName: 'Masjid Abdullahibnu Rawaha',
    tenantCode: 'RAWAHA01',
    location: 'Edathanattikara',
    address: {
      state: 'Kerala',
      district: 'Malappuram',
      lsgName: 'Edathanattikara',
      village: 'Edathanattikara',
    },
    adminName: 'Salih TP',
    adminPhone: '7012191914',
  },
];

async function main() {
  try {
    await connectDatabase();
    console.log('\n🚀 Adding Mahall Admins...\n');

    for (const m of mahallus) {
      // 1. Find or create tenant
      let tenant = await Tenant.findOne({ code: m.tenantCode });
      if (!tenant) {
        tenant = await Tenant.create({
          name: m.tenantName,
          code: m.tenantCode,
          type: 'standard',
          location: m.location,
          address: m.address,
          status: 'active',
          subscription: { plan: 'standard', startDate: new Date(), isActive: true },
          settings: {
            varisangyaAmount: 100,
            educationOptions: [],
            features: {},
          },
        });
        console.log(`✅ Created tenant: ${tenant.name} (${tenant.code})`);
      } else {
        console.log(`⏭️  Tenant already exists: ${tenant.name} (${tenant.code})`);
      }

      // 2. Find or create mahall admin user
      const phoneVariants = [m.adminPhone, `91${m.adminPhone}`, `+91${m.adminPhone}`];
      let user = await User.findOne({
        phone: { $in: phoneVariants },
        role: 'mahall',
        tenantId: tenant._id,
      });

      if (!user) {
        const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
        user = await User.create({
          name: m.adminName,
          phone: m.adminPhone,
          role: 'mahall',
          tenantId: tenant._id,
          status: 'active',
          isSuperAdmin: false,
          permissions: FULL_PERMISSIONS,
          password: hashedPassword,
        });
        console.log(`✅ Created mahall admin: ${user.name} (${user.phone}) for ${m.tenantName}`);
      } else {
        console.log(`⏭️  Admin already exists: ${user.name} (${user.phone})`);
      }

      console.log('');
    }

    console.log('✅ Done! Both mahall admins added.\n');
    console.log('📋 Summary:');
    console.log('   1. Masjidul Hilal — PK Kutty (6238486463)');
    console.log('   2. Masjid Abdullahibnu Rawaha — Salih TP (7012191914)');
    console.log(`   Default password: ${DEFAULT_PASSWORD}`);
    console.log('   Login via OTP flow on the app.\n');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
