import mongoose, { Schema, Document } from 'mongoose';

export interface IFamily extends Document {
  tenantId: mongoose.Types.ObjectId; // Required for multi-tenancy
  mahallId?: string;
  varisangyaGrade?: string;
  houseName: string;
  houseNameMl?: string;
  familyHead?: string;
  familyHeadMl?: string;
  contactNo?: string;
  wardNumber?: string;
  houseNo?: string;
  area?: string;
  areaMl?: string;
  place?: string;
  placeMl?: string;
  status: 'approved' | 'unapproved' | 'pending';
  createdAt: Date;
  updatedAt: Date;
}

const FamilySchema = new Schema<IFamily>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    mahallId: {
      type: String,
      trim: true,
    },
    varisangyaGrade: {
      type: String,
    },
    houseName: {
      type: String,
      required: [true, 'House Name is required'],
      trim: true,
    },
    houseNameMl: {
      type: String,
      trim: true,
    },
    familyHead: {
      type: String,
      trim: true,
    },
    familyHeadMl: {
      type: String,
      trim: true,
    },
    contactNo: {
      type: String,
      trim: true,
    },
    wardNumber: {
      type: String,
      trim: true,
    },
    houseNo: {
      type: String,
      trim: true,
    },
    area: {
      type: String,
    },
    areaMl: {
      type: String,
      trim: true,
    },
    place: {
      type: String,
      trim: true,
    },
    placeMl: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['approved', 'unapproved', 'pending'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual field to populate members
FamilySchema.virtual('members', {
  ref: 'Member',
  localField: '_id',
  foreignField: 'familyId',
});

export default mongoose.model<IFamily>('Family', FamilySchema);

