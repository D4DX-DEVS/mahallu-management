import mongoose, { Schema, Document } from 'mongoose';

export interface ICemetery extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  location?: string;
  capacity: number;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

export interface IGraveRecord extends Document {
  tenantId: mongoose.Types.ObjectId;
  cemeteryId: mongoose.Types.ObjectId;
  graveNo: string;
  deceasedMemberId?: mongoose.Types.ObjectId; // Member ID if available
  deceasedName: string;
  dateOfDeath?: Date;
  burialDate?: Date;
  familyId?: mongoose.Types.ObjectId;
  rowLabel?: string;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CemeterySchema = new Schema<ICemetery>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Cemetery name is required'],
      trim: true,
    },
    location: {
      type: String,
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Cemetery capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    notes: String,
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Indexes for hot queries
CemeterySchema.index({ tenantId: 1, status: 1 });

const GraveRecordSchema = new Schema<IGraveRecord>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    cemeteryId: {
      type: Schema.Types.ObjectId,
      ref: 'Cemetery',
      required: [true, 'Cemetery is required'],
      index: true,
    },
    graveNo: {
      type: String,
      required: [true, 'Grave number is required'],
      trim: true,
    },
    deceasedMemberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
    },
    deceasedName: {
      type: String,
      required: [true, 'Deceased name is required'],
      trim: true,
    },
    dateOfDeath: Date,
    burialDate: Date,
    familyId: {
      type: Schema.Types.ObjectId,
      ref: 'Family',
    },
    rowLabel: {
      type: String,
      trim: true,
    },
    notes: String,
  },
  { timestamps: true }
);

// Unique compound index: one grave per cemetery per grave number per tenant
GraveRecordSchema.index(
  { tenantId: 1, cemeteryId: 1, graveNo: 1 },
  { unique: true }
);

// Index for search and filtering
GraveRecordSchema.index({ tenantId: 1, cemeteryId: 1 });

export const Cemetery = mongoose.model<ICemetery>('Cemetery', CemeterySchema);
export const GraveRecord = mongoose.model<IGraveRecord>('GraveRecord', GraveRecordSchema);
