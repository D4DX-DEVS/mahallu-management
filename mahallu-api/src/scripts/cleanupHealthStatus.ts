/**
 * Removes stray health-status options (e.g. 'Good', 'Great') from the
 * Categories master data.
 *
 * They got there because seedCategories' backfill imports any free-text
 * healthStatus it finds on existing Member records, and old sample/imported
 * data carried values that predate the canonical list. Deleting the option
 * alone is not enough: the next boot re-imports it from those same members,
 * so this remaps the members FIRST, then drops the option.
 *
 * Values that are neither canonical nor in LEGACY_MAP are reported and left
 * alone - a Super Admin may have added them deliberately.
 *
 * Usage:
 *   npx ts-node src/scripts/cleanupHealthStatus.ts           # dry run, shows the plan
 *   npx ts-node src/scripts/cleanupHealthStatus.ts --apply   # writes the changes
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { connectDatabase } from '../config/database';
import { MasterCategory as Category, MasterCategoryValue as CategoryValue } from '../models/MasterCategory';
import Member from '../models/Member';

dotenv.config();

/** The codes seedCategories ships. Anything else is either legacy or admin-added. */
const CANONICAL_CODES = ['healthy', 'under_treatment', 'chronic', 'disabled', 'critical', 'recovering'];

/** Legacy free-text values (lowercased) and the canonical code they become. */
const LEGACY_MAP: Record<string, string> = {
  good: 'healthy',
  great: 'healthy',
  excellent: 'healthy',
  fine: 'healthy',
  normal: 'healthy',
  ok: 'healthy',
  average: 'healthy',
  'minor health issues': 'healthy',
};

async function main() {
  const apply = process.argv.includes('--apply');

  try {
    await connectDatabase();

    const category = await Category.findOne({ key: 'health_status' });
    if (!category) {
      console.log('No health_status category found - nothing to clean up.');
      await mongoose.connection.close();
      process.exit(0);
    }

    const values = await CategoryValue.find({ categoryId: category._id });
    const strays = values.filter((v) => !CANONICAL_CODES.includes(v.code));

    if (strays.length === 0) {
      console.log('✅ health_status already holds only the canonical options.');
      await mongoose.connection.close();
      process.exit(0);
    }

    const removable = strays.filter((v) => LEGACY_MAP[v.code.trim().toLowerCase()]);
    const kept = strays.filter((v) => !LEGACY_MAP[v.code.trim().toLowerCase()]);

    if (kept.length) {
      console.log(
        `\n⚠️  Left alone (not recognised as legacy - delete in Admin > Categories if unwanted):\n   ${kept
          .map((v) => `${v.label} (${v.code})`)
          .join('\n   ')}`
      );
    }

    if (removable.length === 0) {
      console.log('\nNothing to remove.');
      await mongoose.connection.close();
      process.exit(0);
    }

    console.log(`\n${apply ? 'Applying' : 'Dry run'}:`);
    for (const value of removable) {
      const target = LEGACY_MAP[value.code.trim().toLowerCase()];
      const affected = await Member.countDocuments({ healthStatus: value.code });
      console.log(`  '${value.code}' -> '${target}'  (${affected} member${affected === 1 ? '' : 's'} remapped, then option deleted)`);

      if (apply) {
        // Members first: the boot-time backfill re-creates any value still in use.
        await Member.updateMany({ healthStatus: value.code }, { $set: { healthStatus: target } });
        await CategoryValue.deleteOne({ _id: value._id });
      }
    }

    console.log(
      apply
        ? '\n✅ Done. Restart the API so the dropdown reloads.'
        : '\nDry run only - no changes written. Re-run with --apply to make them.'
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await mongoose.connection.close();
    process.exit(1);
  }
}

main();
