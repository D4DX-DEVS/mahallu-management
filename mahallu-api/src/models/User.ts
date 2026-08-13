import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  name: string;
  nameMl?: string;
  phone: string;
  email?: string;
  role: 'super_admin' | 'mahall' | 'survey' | 'institute' | 'member';
  tenantId?: mongoose.Types.ObjectId; // null for super admin
  memberId?: mongoose.Types.ObjectId; // Reference to Member for member users
  instituteId?: mongoose.Types.ObjectId; // Reference to Institute for institute users
  status: 'active' | 'inactive';
  joiningDate: Date;
  lastLogin?: Date;
  permissions: {
    view: boolean;
    add: boolean;
    edit: boolean;
    delete: boolean;
    sensitiveModules?: ('counselling' | 'maslahat' | 'inheritance' | 'health' | 'welfare')[];
  };
  password: string;
  isSuperAdmin: boolean;
  /** Task C5 — when on, password login stops at an OTP step instead of issuing a token. */
  twoFactorEnabled: boolean;
  oneSignalPlayerId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    role: {
      type: String,
      enum: ['super_admin', 'mahall', 'survey', 'institute', 'member'],
      required: true,
    },
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      default: null,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      default: null,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: 'Institute',
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    joiningDate: {
      type: Date,
      default: Date.now,
    },
    lastLogin: {
      type: Date,
    },
    permissions: {
      view: { type: Boolean, default: false },
      add: { type: Boolean, default: false },
      edit: { type: Boolean, default: false },
      delete: { type: Boolean, default: false },
      sensitiveModules: {
        type: [String],
        enum: ['counselling', 'maslahat', 'inheritance', 'health', 'welfare'],
        default: undefined,
      },
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      select: false,
    },
    isSuperAdmin: {
      type: Boolean,
      default: false,
    },
    twoFactorEnabled: {
      type: Boolean,
      default: false,
    },
    oneSignalPlayerId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for phone + tenantId + role (same person can have multiple roles in the same mahallu)
UserSchema.index({ phone: 1, tenantId: 1, role: 1 }, { unique: true, sparse: true });

export default mongoose.model<IUser>('User', UserSchema);

