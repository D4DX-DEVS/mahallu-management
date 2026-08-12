import mongoose, { Schema, Document } from 'mongoose';

export interface IInstitute extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  place: string;
  placeMl?: string;
  type: 'institute' | 'madrasa' | 'orphanage' | 'hospital' | 'other' | 'program' | 'mosque';
  joinDate: Date;
  description?: string;
  contactNo?: string;
  email?: string;
  status: 'active' | 'inactive';
  audience?: 'all' | 'men' | 'women' | 'youth' | 'children' | 'families';
  programType?: 'quran_class' | 'hadith' | 'fiqh' | 'lecture' | 'family' | 'other';
  createdAt: Date;
  updatedAt: Date;
}

const InstituteSchema = new Schema<IInstitute>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Institute name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    place: {
      type: String,
      required: [true, 'Place is required'],
      trim: true,
    },
    placeMl: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ['institute', 'madrasa', 'orphanage', 'hospital', 'other', 'program', 'mosque'],
      required: true,
    },
    joinDate: {
      type: Date,
      default: Date.now,
    },
    description: {
      type: String,
      trim: true,
    },
    contactNo: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    audience: {
      type: String,
      enum: ['all', 'men', 'women', 'youth', 'children', 'families'],
    },
    programType: {
      type: String,
      enum: ['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other'],
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IInstitute>('Institute', InstituteSchema);

