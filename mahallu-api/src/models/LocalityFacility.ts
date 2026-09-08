import mongoose, { Schema, Document } from 'mongoose';

export type LocalityFacilityType =
  | 'school'
  | 'college'
  | 'hospital'
  | 'religious_institution'
  | 'public_institution'
  | 'library'
  | 'organization'
  | 'public_space'
  | 'business'
  | 'other';

export interface ILocalityFacility extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  type: LocalityFacilityType;
  address?: string;
  contactNo?: string;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const LocalityFacilitySchema = new Schema<ILocalityFacility>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    name: { type: String, required: [true, 'Name is required'], trim: true },
    nameMl: { type: String, trim: true },
    type: {
      type: String,
      enum: [
        'school',
        'college',
        'hospital',
        'religious_institution',
        'public_institution',
        'library',
        'organization',
        'public_space',
        'business',
        'other',
      ],
      default: 'other',
    },
    address: { type: String, trim: true },
    contactNo: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

LocalityFacilitySchema.index({ tenantId: 1, status: 1 });
LocalityFacilitySchema.index({ tenantId: 1, type: 1 });

export default mongoose.model<ILocalityFacility>('LocalityFacility', LocalityFacilitySchema);
