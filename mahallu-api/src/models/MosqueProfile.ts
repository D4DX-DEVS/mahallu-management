import mongoose, { Schema, Document } from 'mongoose';

export const MOSQUE_FACILITIES = [
  'parking',
  'wudu_area',
  'women_prayer_area',
  'ac',
  'library',
  'madrasa_hall',
  'janazah_facility',
  'other',
] as const;

export interface IMosqueProfile extends Document {
  tenantId: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  capacity?: number;
  facilities: string[];
  prayerFacilityNotes?: string;
  imamName?: string;
  imamMemberId?: mongoose.Types.ObjectId;
  muazzinName?: string;
  khateebName?: string;
  staffNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const MosqueProfileSchema = new Schema<IMosqueProfile>(
  {
    // A Mahallu can have multiple mosques
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    name: { type: String, required: [true, 'Mosque name is required'], trim: true },
    nameMl: { type: String, trim: true },
    capacity: { type: Number, min: 0 },
    facilities: {
      type: [{ type: String, enum: MOSQUE_FACILITIES }],
      default: [],
    },
    prayerFacilityNotes: { type: String, trim: true },
    imamName: { type: String, trim: true },
    imamMemberId: { type: Schema.Types.ObjectId, ref: 'Member' },
    muazzinName: { type: String, trim: true },
    khateebName: { type: String, trim: true },
    staffNotes: { type: String, trim: true },
  },
  { timestamps: true }
);

export default mongoose.model<IMosqueProfile>('MosqueProfile', MosqueProfileSchema);
