import mongoose, { Schema, Document } from 'mongoose';
import { TENANT_CLASSIFICATIONS, TenantClassification } from '../config/moduleFeatures';

export interface ITenant extends Document {
  name: string;
  nameMl?: string;
  code: string;
  type: 'standard' | 'premium' | 'enterprise';
  classification: TenantClassification;
  since: Date;
  location: string;
  locationMl?: string;
  address: {
    state: string;
    district: string;
    pinCode?: string;
    postOffice?: string;
    lsgName: string;
    village: string;
  };
  logo?: string;
  status: 'active' | 'suspended' | 'inactive';
  subscription: {
    plan: string;
    startDate: Date;
    endDate?: Date;
    isActive: boolean;
  };
  settings: {
    varisangyaAmount: number;
    varisangyaGrades: Array<{
      name: string;
      amount: number;
    }>;
    educationOptions: string[];
    areaOptions: string[];
    features: {
      [key: string]: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

const TenantSchema = new Schema<ITenant>(
  {
    name: {
      type: String,
      required: [true, 'Tenant name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    code: {
      type: String,
      required: [true, 'Tenant code is required'],
      unique: true,
      uppercase: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ['standard', 'premium', 'enterprise'],
      default: 'standard',
    },
    classification: {
      type: String,
      enum: TENANT_CLASSIFICATIONS,
      default: 'fully_functional',
    },
    since: {
      type: Date,
      default: Date.now,
    },
    location: {
      type: String,
      trim: true,
    },
    locationMl: {
      type: String,
      trim: true,
    },
    address: {
      state: { type: String, required: true },
      district: { type: String, required: true },
      pinCode: String,
      postOffice: String,
      lsgName: { type: String, required: true },
      village: { type: String, required: true },
    },
    logo: String,
    status: {
      type: String,
      enum: ['active', 'suspended', 'inactive'],
      default: 'active',
    },
    subscription: {
      plan: { type: String, default: 'basic' },
      startDate: { type: Date, default: Date.now },
      endDate: Date,
      isActive: { type: Boolean, default: true },
    },
    settings: {
      varisangyaAmount: { type: Number, default: 0 },
      varisangyaGrades: {
        type: [
          {
            name: { type: String, required: true },
            amount: { type: Number, required: true },
          },
        ],
        default: [
          { name: 'Grade A', amount: 100 },
          { name: 'Grade B', amount: 75 },
          { name: 'Grade C', amount: 50 },
          { name: 'Grade D', amount: 25 },
        ],
      },
      educationOptions: {
        type: [String],
        default: [
          'Below SSLC',
          'SSLC',
          'Plus Two',
          'Degree',
          'Diploma',
          'Post Graduation',
          'Doctorate',
          'MBBS',
        ],
      },
      areaOptions: {
        type: [String],
        default: [
          'Area A',
          'Area B',
          'Area C',
          'Area D',
        ],
      },
      features: {
        type: Map,
        of: Boolean,
        default: {},
      },
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<ITenant>('Tenant', TenantSchema);

