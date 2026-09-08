import User from '../models/User';
import bcrypt from 'bcryptjs';

/**
 * Script to create a super admin user
 * Run this once to create the initial super admin
 */
export const createSuperAdmin = async () => {
  try {
    const superAdminData = {
      name: 'Super Admin',
      phone: '9999999999',
      email: 'admin@jamaahhub.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'super_admin' as const,
      isSuperAdmin: true,
      tenantId: null,
      status: 'active' as const,
      permissions: {
        view: true,
        add: true,
        edit: true,
        delete: true,
      },
    };

    const existingAdmin = await User.findOne({ phone: superAdminData.phone });
    if (existingAdmin) {
      console.log('Super admin already exists');
      return existingAdmin;
    }

    const superAdmin = new User(superAdminData);
    await superAdmin.save();
    console.log('✅ Super admin created');
    console.log('Phone: 9999999999');
    console.log('Password: admin123');
    return superAdmin;
  } catch (error) {
    console.error('Error creating super admin:', error);
    throw error;
  }
};

