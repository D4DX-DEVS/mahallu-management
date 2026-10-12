import mongoose, { Schema, Document } from 'mongoose';

export const CLASS_TYPES = [
  'weekend_madrasa',
  'tuition',
  'adult_quran',
  'remedial',
  'other',
] as const;
export type ClassType = (typeof CLASS_TYPES)[number];

export const ENROLLMENT_STATUSES = ['active', 'completed', 'dropped'] as const;
export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export interface IMadrasaClass extends Document {
  tenantId: mongoose.Types.ObjectId;
  instituteId?: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  academicYear: string;
  classType: ClassType;
  teacherEmployeeId?: mongoose.Types.ObjectId;
  subjects: string[];
  schedule?: string;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const MadrasaClassSchema = new Schema<IMadrasaClass>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    instituteId: { type: Schema.Types.ObjectId, ref: 'Institute', index: true },
    name: { type: String, required: [true, 'Class name is required'], trim: true },
    nameMl: { type: String, trim: true },
    academicYear: {
      type: String,
      required: [true, 'Academic year is required'],
      trim: true,
      index: true,
    },
    classType: { type: String, enum: CLASS_TYPES, default: 'weekend_madrasa', index: true },
    teacherEmployeeId: { type: Schema.Types.ObjectId, ref: 'Employee', index: true },
    subjects: { type: [String], default: [] },
    schedule: { type: String, trim: true },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true }
);

MadrasaClassSchema.index({ tenantId: 1, academicYear: 1, status: 1 });

export interface IStudentEnrollment extends Document {
  tenantId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  rollNo?: string;
  enrollDate: Date;
  status: EnrollmentStatus;
  createdAt: Date;
  updatedAt: Date;
}

const StudentEnrollmentSchema = new Schema<IStudentEnrollment>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    classId: {
      type: Schema.Types.ObjectId,
      ref: 'MadrasaClass',
      required: [true, 'Class is required'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Student member is required'],
      index: true,
    },
    rollNo: { type: String, trim: true },
    enrollDate: { type: Date, default: Date.now },
    status: { type: String, enum: ENROLLMENT_STATUSES, default: 'active', index: true },
  },
  { timestamps: true }
);

// A student joins a given class once; re-enrolling reuses the existing record.
StudentEnrollmentSchema.index({ classId: 1, memberId: 1 }, { unique: true });
StudentEnrollmentSchema.index({ tenantId: 1, status: 1 });

export const MadrasaClass = mongoose.model<IMadrasaClass>('MadrasaClass', MadrasaClassSchema);
export const StudentEnrollment = mongoose.model<IStudentEnrollment>(
  'StudentEnrollment',
  StudentEnrollmentSchema
);
