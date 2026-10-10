import mongoose, { Schema, Document } from 'mongoose';

/**
 * A "Request a demo" submission from the public landing page.
 *
 * There is no tenant or user behind it: the Mahallu is not in the system yet.
 * Platform staff read these from the super admin inbox and follow up by phone.
 */
export interface IDemoRequest extends Document {
  mahalluName: string;
  contactNumber: string;
  whatsappNumber: string;
  createdAt: Date;
  updatedAt: Date;
}

const DemoRequestSchema = new Schema<IDemoRequest>(
  {
    mahalluName: { type: String, required: true, trim: true, maxlength: 150 },
    contactNumber: { type: String, required: true, trim: true },
    whatsappNumber: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

DemoRequestSchema.index({ createdAt: -1 });

export default mongoose.model<IDemoRequest>('DemoRequest', DemoRequestSchema);
