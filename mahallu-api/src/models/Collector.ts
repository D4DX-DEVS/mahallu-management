import mongoose, { Schema, Document } from 'mongoose';

export interface ICollector extends Document {
  tenantId: mongoose.Types.ObjectId;
  /** Login user, when the collector also uses the CMS */
  userId?: mongoose.Types.ObjectId;
  /** Or a member of the mahallu */
  memberId?: mongoose.Types.ObjectId;
  name: string;
  phone?: string;
  wards: string[];
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const CollectorSchema = new Schema<ICollector>(
  {
    tenantId: { type: Schema.Types.ObjectId, ref: 'Tenant', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    memberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    name: { type: String, required: [true, 'Collector name is required'], trim: true },
    phone: { type: String, trim: true },
    wards: { type: [String], default: [] },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);
CollectorSchema.index({ tenantId: 1, active: 1 });

export default mongoose.model<ICollector>('Collector', CollectorSchema);
