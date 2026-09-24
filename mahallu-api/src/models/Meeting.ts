import mongoose, { Schema, Document } from 'mongoose';

export interface IMeeting extends Document {
  tenantId: mongoose.Types.ObjectId;
  committeeId: mongoose.Types.ObjectId;
  title: string;
  titleMl?: string;
  meetingDate: Date;
  attendance: mongoose.Types.ObjectId[];
  totalMembers: number;
  attendancePercent: number;
  agenda?: string;
  agendaMl?: string;
  minutes?: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const MeetingSchema = new Schema<IMeeting>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    committeeId: {
      type: Schema.Types.ObjectId,
      ref: 'Committee',
      required: [true, 'Committee ID is required'],
    },
    title: {
      type: String,
      required: [true, 'Meeting title is required'],
      trim: true,
    },
    titleMl: {
      type: String,
      trim: true,
    },
    meetingDate: {
      type: Date,
      required: [true, 'Meeting date is required'],
    },
    attendance: [{
      type: Schema.Types.ObjectId,
      ref: 'Member',
    }],
    totalMembers: {
      type: Number,
      default: 0,
    },
    attendancePercent: {
      type: Number,
      default: 0,
    },
    agenda: {
      type: String,
      trim: true,
    },
    agendaMl: {
      type: String,
      trim: true,
    },
    minutes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IMeeting>('Meeting', MeetingSchema);

