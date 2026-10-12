import mongoose, { Schema, Document } from 'mongoose';

export interface IClassAttendance extends Document {
  tenantId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  date: Date;
  records: Array<{
    enrollmentId: mongoose.Types.ObjectId;
    present: boolean;
  }>;
  markedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ClassAttendanceSchema = new Schema<IClassAttendance>(
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
    date: {
      type: Date,
      required: [true, 'Date is required'],
      set: (val: Date) => {
        // Normalize to midnight UTC
        const d = new Date(val);
        d.setUTCHours(0, 0, 0, 0);
        return d;
      },
    },
    records: {
      type: [
        {
          enrollmentId: {
            type: Schema.Types.ObjectId,
            ref: 'StudentEnrollment',
            required: true,
          },
          present: { type: Boolean, default: false },
        },
      ],
      default: [],
    },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User', index: true },
  },
  { timestamps: true }
);

// One record per class per date
ClassAttendanceSchema.index({ tenantId: 1, classId: 1, date: 1 }, { unique: true });
ClassAttendanceSchema.index({ tenantId: 1, classId: 1 });
ClassAttendanceSchema.index({ tenantId: 1, date: 1 });

export interface IExam extends Document {
  tenantId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  name: string;
  examDate: Date;
  maxMarks: number;
  results: Array<{
    enrollmentId: mongoose.Types.ObjectId;
    marks: number;
    grade?: string;
  }>;
  status?: 'scheduled' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const ExamSchema = new Schema<IExam>(
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
    name: { type: String, required: [true, 'Exam name is required'], trim: true },
    examDate: { type: Date, required: [true, 'Exam date is required'] },
    maxMarks: {
      type: Number,
      required: [true, 'Max marks is required'],
      min: 0,
    },
    results: {
      type: [
        {
          enrollmentId: {
            type: Schema.Types.ObjectId,
            ref: 'StudentEnrollment',
            required: true,
          },
          marks: { type: Number, required: true, min: 0 },
          grade: { type: String, trim: true },
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['scheduled', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  { timestamps: true }
);

ExamSchema.index({ tenantId: 1, classId: 1 });
ExamSchema.index({ tenantId: 1, examDate: 1 });

export const ClassAttendance = mongoose.model<IClassAttendance>(
  'ClassAttendance',
  ClassAttendanceSchema
);
export const Exam = mongoose.model<IExam>('Exam', ExamSchema);
