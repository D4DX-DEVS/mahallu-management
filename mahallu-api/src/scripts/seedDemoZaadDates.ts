/** Spreads demo families' createdAt across the last 7 days (only ids in the demo manifest). */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import { connectDatabase } from '../config/database';
dotenv.config();
(async () => {
  const manifest: Record<string, string[]> = JSON.parse(fs.readFileSync(process.env.DEMO_MANIFEST || 'demo-seed-manifest.json', 'utf8'));
  await connectDatabase();
  const col = mongoose.connection.db!.collection('families');
  const counts = [3, 5, 4, 6, 4, 3, 3]; // oldest -> today
  const ids = manifest.families;
  let i = 0;
  for (let day = 0; day < counts.length; day++) {
    for (let k = 0; k < counts[day] && i < ids.length; k++, i++) {
      const d = new Date(); d.setDate(d.getDate() - (counts.length - 1 - day)); d.setHours(Math.max(0, new Date().getHours() - 1 - k), 5 * k, 0, 0);
      await col.updateOne({ _id: new mongoose.Types.ObjectId(ids[i]) }, { $set: { createdAt: d } });
    }
  }
  console.log('dated', i, 'families');
  await mongoose.disconnect();
})().catch((e) => { console.error(e.message); process.exit(1); });
