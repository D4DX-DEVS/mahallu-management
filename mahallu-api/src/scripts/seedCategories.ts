/**
 * Manually (re-)seed the Categories master-data collections.
 *
 * The app also runs this automatically on every boot (see src/index.ts) —
 * this script exists for CI/ops use where you want to seed without starting
 * the server. Safe to run repeatedly: upsert-only, never overwrites an edit
 * a Super Admin has already made.
 *
 * Usage:
 *   npm run seed-categories
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { seedCategories } from '../utils/seedCategories';

dotenv.config();

async function main() {
  try {
    await connectDatabase();
    await seedCategories();
    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
