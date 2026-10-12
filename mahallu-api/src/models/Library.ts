import mongoose, { Schema, Document } from 'mongoose';

export const BOOK_CATEGORIES = [
  'quran',
  'hadith',
  'fiqh',
  'history',
  'children',
  'women',
  'youth',
  'general',
] as const;
export type BookCategory = (typeof BOOK_CATEGORIES)[number];

export const RESOURCE_TYPES = ['physical', 'digital'] as const;
export type ResourceType = (typeof RESOURCE_TYPES)[number];

export const BOOK_STATUSES = ['active', 'inactive'] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export interface ILibraryBook extends Document {
  tenantId: mongoose.Types.ObjectId;
  title: string;
  titleMl?: string;
  author: string;
  category: BookCategory;
  resourceType: ResourceType;
  resourceUrl?: string; // Required when digital
  isbn?: string;
  copies?: number; // Only for physical
  availableCopies?: number; // Only for physical
  status: BookStatus;
  createdAt: Date;
  updatedAt: Date;
}

const LibraryBookSchema = new Schema<ILibraryBook>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    title: { type: String, required: [true, 'Title is required'], trim: true },
    titleMl: { type: String, trim: true },
    author: { type: String, required: [true, 'Author is required'], trim: true },
    category: { type: String, enum: BOOK_CATEGORIES, required: true, index: true },
    resourceType: { type: String, enum: RESOURCE_TYPES, default: 'physical', index: true },
    resourceUrl: {
      type: String,
      trim: true,
      required: [
        function (this: ILibraryBook) {
          return this.resourceType === 'digital';
        },
        'Resource URL is required for digital books',
      ],
    },
    isbn: { type: String, trim: true },
    copies: { type: Number, default: 1 },
    availableCopies: { type: Number, default: 1 },
    status: { type: String, enum: BOOK_STATUSES, default: 'active', index: true },
  },
  { timestamps: true }
);

LibraryBookSchema.index({ tenantId: 1, status: 1 });
LibraryBookSchema.index({ tenantId: 1, category: 1 });
LibraryBookSchema.index({ tenantId: 1, resourceType: 1 });

export const BOOK_ISSUE_STATUSES = ['issued', 'returned', 'overdue'] as const;
export type BookIssueStatus = (typeof BOOK_ISSUE_STATUSES)[number];

export interface IBookIssue extends Document {
  tenantId: mongoose.Types.ObjectId;
  bookId: mongoose.Types.ObjectId;
  memberId: mongoose.Types.ObjectId;
  issueDate: Date;
  dueDate: Date;
  returnDate?: Date;
  status: BookIssueStatus;
  createdAt: Date;
  updatedAt: Date;
}

const BookIssueSchema = new Schema<IBookIssue>(
  {
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: [true, 'Tenant ID is required'],
      index: true,
    },
    bookId: {
      type: Schema.Types.ObjectId,
      ref: 'LibraryBook',
      required: [true, 'Book is required'],
      index: true,
    },
    memberId: {
      type: Schema.Types.ObjectId,
      ref: 'Member',
      required: [true, 'Member is required'],
      index: true,
    },
    issueDate: { type: Date, default: Date.now },
    dueDate: {
      type: Date,
      required: [true, 'Due date is required'],
      index: true,
    },
    returnDate: { type: Date },
    status: { type: String, enum: BOOK_ISSUE_STATUSES, default: 'issued', index: true },
  },
  { timestamps: true }
);

BookIssueSchema.index({ tenantId: 1, status: 1 });
BookIssueSchema.index({ tenantId: 1, memberId: 1 });
BookIssueSchema.index({ tenantId: 1, bookId: 1 });

export const LibraryBook = mongoose.model<ILibraryBook>('LibraryBook', LibraryBookSchema);
export const BookIssue = mongoose.model<IBookIssue>('BookIssue', BookIssueSchema);
