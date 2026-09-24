import mongoose, { Schema, Document } from 'mongoose';

export const VOLUNTEER_WINGS = ['youth', 'women', 'general'] as const;
export type VolunteerWing = (typeof VOLUNTEER_WINGS)[number];

export const SERVICE_TYPES = [
  'janazah',
  'grave_digging',
  'patient_transport',
  'palliative',
  'emergency',
  'first_aid',
  'disaster',
  'environment',
  'govt_scheme_support',
  'medical',
  'other',
] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const AVAILABILITY_OPTIONS = ['anytime', 'weekends', 'emergency_only'] as const;
export type Availability = (typeof AVAILABILITY_OPTIONS)[number];

export interface IVolunteerProfile extends Document {
  tenantId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  wings: VolunteerWing[];
  serviceTypes: ServiceType[];
  availability: Availability;
  notes?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const VolunteerProfileSchema = new Schema<IVolunteerProfile>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member is required'],
      index: true,
    },
    wings: {
      type: [String],
      enum: VOLUNTEER_WINGS,
      required: [true, 'At least one wing is required'],
      default: ['general'],
    },
    serviceTypes: {
      type: [String],
      enum: SERVICE_TYPES,
      required: [true, 'At least one service type is required'],
      default: [],
    },
    availability: {
      type: String,
      enum: AVAILABILITY_OPTIONS,
      default: 'anytime',
    },
    notes: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
      index: true,
    },
  },
  { timestamps: true }
);

// Unique compound index: one profile per member per tenant
VolunteerProfileSchema.index({ tenantId: 1, memberId: 1 }, { unique: true });
// Index for filtering
VolunteerProfileSchema.index({ tenantId: 1, status: 1 });

export interface IVolunteerAssignment extends Document {
  tenantId: mongoose.Types.ObjectId;
  volunteerIds: mongoose.Types.ObjectId[];
  serviceType: ServiceType;
  date: Date;
  description: string;
  status: 'assigned' | 'completed' | 'cancelled';
  completionNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const VolunteerAssignmentSchema = new Schema<IVolunteerAssignment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Please select a Mahallu before continuing.'],
      index: true,
    },
    volunteerIds: {
      type: [Schema.Types.ObjectId],
      ref: 'VolunteerProfile',
      required: [true, 'At least one volunteer is required'],
      validate: {
        validator: (arr: mongoose.Types.ObjectId[]) => arr.length > 0,
        message: 'Please assign at least one volunteer.',
      },
    },
    serviceType: {
      type: String,
      enum: SERVICE_TYPES,
      required: [true, 'Service type is required'],
      index: true,
    },
    date: {
      type: Date,
      required: [true, 'Assignment date is required'],
      index: true,
    },
    description: {
      type: String,
      trim: true,
      required: [true, 'Description is required'],
    },
    status: {
      type: String,
      enum: ['assigned', 'completed', 'cancelled'],
      default: 'assigned',
      index: true,
    },
    completionNotes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

// Index for filtering
VolunteerAssignmentSchema.index({ tenantId: 1, status: 1 });
VolunteerAssignmentSchema.index({ tenantId: 1, serviceType: 1 });

export const VolunteerProfile = mongoose.model<IVolunteerProfile>(
  'VolunteerProfile',
  VolunteerProfileSchema
);
export const VolunteerAssignment = mongoose.model<IVolunteerAssignment>(
  'VolunteerAssignment',
  VolunteerAssignmentSchema
);
