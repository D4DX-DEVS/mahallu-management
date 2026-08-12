import mongoose, { Schema, Document } from 'mongoose';

export interface IClusterVisit extends Document {
  tenantId: mongoose.Types.ObjectId;
  clusterId: mongoose.Types.ObjectId;
  familyId?: mongoose.Types.ObjectId;
  visitDate: Date;
  visitedBy?: string;
  notes?: string;
  issuesFound?: string;
  followUpNeeded: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ClusterVisitSchema = new Schema<IClusterVisit>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    clusterId: {
      type: Schema.Types.ObjectId,
      ref: 'Cluster',
      required: [true, 'Cluster ID is required'],
      index: true,
    },
    familyId: { type: Schema.Types.ObjectId, ref: 'Family' },
    visitDate: { type: Date, required: true, default: Date.now },
    visitedBy: { type: String, trim: true },
    notes: { type: String, trim: true },
    issuesFound: { type: String, trim: true },
    followUpNeeded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ClusterVisitSchema.index({ tenantId: 1, visitDate: -1 });
ClusterVisitSchema.index({ tenantId: 1, clusterId: 1, visitDate: -1 });

export default mongoose.model<IClusterVisit>('ClusterVisit', ClusterVisitSchema);
