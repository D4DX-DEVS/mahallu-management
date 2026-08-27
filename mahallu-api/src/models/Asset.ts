import mongoose, { Schema, Document } from 'mongoose';

export interface IAsset extends Document {
  tenantId: mongoose.Types.ObjectId;
  mosqueId?: mongoose.Types.ObjectId;
  name: string;
  nameMl?: string;
  description?: string;
  purchaseDate: Date;
  estimatedValue: number;
  category: 'furniture' | 'electronics' | 'vehicle' | 'building' | 'land' | 'equipment' | 'other';
  status: 'active' | 'in_use' | 'under_maintenance' | 'disposed' | 'damaged';
  location?: string;
  locationMl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAssetMaintenance extends Document {
  tenantId: mongoose.Types.ObjectId;
  assetId: mongoose.Types.ObjectId;
  maintenanceDate: Date;
  description: string;
  cost?: number;
  performedBy?: string;
  nextMaintenanceDate?: Date;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
}

const AssetSchema = new Schema<IAsset>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    mosqueId: {
      type: Schema.Types.ObjectId,
      ref: 'MosqueProfile',
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Asset name is required'],
      trim: true,
    },
    nameMl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    purchaseDate: {
      type: Date,
      required: [true, 'Purchase date is required'],
    },
    estimatedValue: {
      type: Number,
      required: [true, 'Estimated value is required'],
      min: [0, 'Estimated value cannot be negative'],
    },
    category: {
      type: String,
      enum: ['furniture', 'electronics', 'vehicle', 'building', 'land', 'equipment', 'other'],
      required: [true, 'Category is required'],
    },
    status: {
      type: String,
      enum: ['active', 'in_use', 'under_maintenance', 'disposed', 'damaged'],
      default: 'active',
    },
    location: {
      type: String,
      trim: true,
    },
    locationMl: {
      type: String,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const AssetMaintenanceSchema = new Schema<IAssetMaintenance>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    assetId: {
      type: Schema.Types.ObjectId,
      ref: 'Asset',
      required: [true, 'Asset ID is required'],
      index: true,
    },
    maintenanceDate: {
      type: Date,
      required: [true, 'Maintenance date is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    cost: {
      type: Number,
      min: [0, 'Cost cannot be negative'],
    },
    performedBy: {
      type: String,
      trim: true,
    },
    nextMaintenanceDate: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
      default: 'scheduled',
    },
  },
  {
    timestamps: true,
  }
);

export const Asset = mongoose.model<IAsset>('Asset', AssetSchema);
export const AssetMaintenance = mongoose.model<IAssetMaintenance>('AssetMaintenance', AssetMaintenanceSchema);
