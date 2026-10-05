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
  address?: {
    state?: string;
    district?: string;
    pinCode?: string;
    postOffice?: string;
  };
  audience?: 'all' | 'men' | 'women' | 'youth' | 'children' | 'families';
  programType?: 'quran_class' | 'hadith' | 'fiqh' | 'lecture' | 'family' | 'other';
  /** Event fields (Task C3) — used when a program is run as a gathering/event. */
  eventDate?: Date;
  registrations?: { memberId: mongoose.Types.ObjectId; attended: boolean }[];
  competitions?: { name: string; winners: string[] }[];
  awards?: string;
  /** Set when this institute was auto-created/synced from a Locality facility (school/college). */
  syncedFacilityId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InstituteSchema = new Schema<IInstitute>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
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
    address: {
      state: { type: String, trim: true },
      district: { type: String, trim: true },
      pinCode: { type: String, trim: true },
      postOffice: { type: String, trim: true },
    },
    audience: {
      type: String,
      enum: ['all', 'men', 'women', 'youth', 'children', 'families'],
    },
    programType: {
      type: String,
      enum: ['quran_class', 'hadith', 'fiqh', 'lecture', 'family', 'other'],
    },
    // Task C3 — event extension. All optional: existing programs stay valid.
    eventDate: {
      type: Date,
    },
    registrations: [
      {
        _id: false,
        memberId: { type: Schema.Types.ObjectId, ref: 'Member', required: true },
        attended: { type: Boolean, default: false },
      },
    ],
    competitions: [
      {
        _id: false,
        name: { type: String, required: true, trim: true },
        winners: [{ type: String, trim: true }],
      },
    ],
    awards: {
      type: String,
      trim: true,
    },
    syncedFacilityId: {
      type: Schema.Types.ObjectId,
      ref: 'LocalityFacility',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IInstitute>('Institute', InstituteSchema);

