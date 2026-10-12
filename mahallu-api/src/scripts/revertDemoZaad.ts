/** Deletes exactly the documents listed in the demo seed manifest. */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import { connectDatabase } from '../config/database';
dotenv.config();
(async () => {
  const file = process.env.DEMO_MANIFEST || 'demo-seed-manifest.json';
  const manifest: Record<string, string[]> = JSON.parse(fs.readFileSync(file, 'utf8'));
  await connectDatabase();
  const db = mongoose.connection.db!;
  for (const [col, ids] of Object.entries(manifest)) {
    const r = await db.collection(col).deleteMany({ _id: { $in: ids.map((i) => new mongoose.Types.ObjectId(i)) } });
    console.log(`${col}: deleted ${r.deletedCount}/${ids.length}`);
  }
  fs.renameSync(file, file.replace('.json', '.reverted.json'));
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
