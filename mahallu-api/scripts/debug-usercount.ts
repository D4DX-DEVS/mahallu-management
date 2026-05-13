import dotenv from 'dotenv';
dotenv.config();
import { connectDatabase } from '../src/config/database';
import User from '../src/models/User';
import Tenant from '../src/models/Tenant';

(async () => {
  await connectDatabase();
  
  const tenants = await Tenant.find({}).lean();
  const tenantIds = tenants.map(t => t._id);
  console.log('Tenant IDs:', tenantIds.map(id => id.toString()));
  
  const userCounts = await User.aggregate([
    { $match: { tenantId: { $in: tenantIds } } },
    { $group: { _id: '$tenantId', count: { $sum: 1 } } },
  ]);
  console.log('User counts aggregation:', JSON.stringify(userCounts, null, 2));
  
  const allUsers = await User.find({ tenantId: { $ne: null } }, 'name tenantId').lean();
  console.log('Total users with tenantId:', allUsers.length);
  
  process.exit(0);
})();
