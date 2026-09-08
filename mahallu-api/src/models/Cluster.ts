import mongoose, { Schema, Document } from 'mongoose';

export interface ICluster extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  code?: string;
  coordinatorMemberId?: mongoose.Types.ObjectId;
  teamMemberIds: mongoose.Types.ObjectId[];
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ClusterSchema = new Schema<ICluster>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Cluster name is required'], trim: true },
    nameMl: { type: String, trim: true },
    code: { type: String, trim: true, uppercase: true },
    coordinatorMemberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    // Spec 27: a coordinator plus up to three team members
    teamMemberIds: {
      type: [{ type: Schema.Types.ObjectId, ref: 'Member' }],
      validate: {
        validator: (value: unknown[]) => !value || value.length <= 3,
        message: 'A cluster team can have at most 3 members.',
      },
      default: [],
    },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

ClusterSchema.index({ tenantId: 1, status: 1 });
ClusterSchema.index({ tenantId: 1, name: 1 });

export default mongoose.model<ICluster>('Cluster', ClusterSchema);
