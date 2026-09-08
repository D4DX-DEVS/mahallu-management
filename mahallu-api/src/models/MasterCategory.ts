import mongoose, { Schema, Document } from 'mongoose';

/**
 * Generic master-data (dropdown/lookup) system. MasterCategory = a grouping
 * like "Education" or "Blood Group"; MasterCategoryValue = one selectable
 * option in it.
 *
 * Named "MasterCategory" (not "Category") because 'Category' is already a
 * registered Mongoose model name for the accounting chart-of-accounts
 * feature (see models/MasterAccount.ts) — reusing it throws
 * OverwriteModelError.
 *
 * Values store a stable `code` — the exact string already written on
 * Member/Family/Welfare/Zakat documents today (e.g. 'widowed', 'A +ve') — so
 * migrating a field to this system never requires touching existing records.
 */

export interface IMasterCategory extends Document {
  key: string;
  name: string;
  description?: string;
  isSystem: boolean;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const MasterCategorySchema = new Schema<IMasterCategory>(
  {
    key: {
      type: String,
      required: [true, 'Category key is required'],
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9_]+$/, 'Key must be lowercase letters, numbers and underscores only'],
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isSystem: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

MasterCategorySchema.index({ key: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });

export interface IMasterCategoryValue extends Document {
  categoryId: mongoose.Types.ObjectId;
  categoryKey: string;
  code: string;
  label: string;
  labelMl?: string;
  description?: string;
  /**
   * Optional money figure carried by the value itself. Used by
   * 'varisangya_grade', where the grade is global master data and every
   * Mahallu bills the same amount for a given grade.
   */
  amount?: number;
  sortOrder: number;
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const MasterCategoryValueSchema = new Schema<IMasterCategoryValue>(
  {
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: 'MasterCategory',
      required: [true, 'Category is required'],
      index: true,
    },
    categoryKey: {
      type: String,
      required: [true, 'Category key is required'],
      trim: true,
      lowercase: true,
      index: true,
    },
    code: {
      type: String,
      required: [true, 'Code is required'],
      trim: true,
    },
    label: {
      type: String,
      required: [true, 'Label is required'],
      trim: true,
    },
    labelMl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    amount: {
      type: Number,
      min: 0,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: true }
);

MasterCategoryValueSchema.index(
  { categoryId: 1, code: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
MasterCategoryValueSchema.index(
  { categoryId: 1, label: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
MasterCategoryValueSchema.index({ categoryKey: 1, status: 1 });

export const MasterCategory = mongoose.model<IMasterCategory>('MasterCategory', MasterCategorySchema);
export const MasterCategoryValue = mongoose.model<IMasterCategoryValue>(
  'MasterCategoryValue',
  MasterCategoryValueSchema
);
