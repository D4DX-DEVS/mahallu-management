import { Response } from 'express';
import mongoose from 'mongoose';
import { LibraryBook, BookIssue } from '../models/Library';
import Member from '../models/Member';
import { AuthRequest } from '../middleware/authMiddleware';
import { getPaginationParams, createPaginationResponse } from '../utils/pagination';
import { stripImmutable, refBelongsToTenant } from '../utils/sanitizeUpdate';

const tenantScope = (req: AuthRequest): Record<string, any> =>
  req.tenantId ? { tenantId: req.tenantId } : {};

/** Validate book and member references belong to tenant. */
const validateRefs = async (req: AuthRequest): Promise<string | null> => {
  const { bookId, memberId } = req.body;
  if (bookId && !(await refBelongsToTenant(LibraryBook, bookId, req.tenantId))) {
    return 'Book does not belong to this Mahallu';
  }
  if (memberId && !(await refBelongsToTenant(Member, memberId, req.tenantId))) {
    return 'Member does not belong to this Mahallu';
  }
  return null;
};

// ============ Books ============

export const getAllBooks = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.category) query.category = req.query.category;
    if (req.query.resourceType) query.resourceType = req.query.resourceType;
    if (req.query.status) query.status = req.query.status;
    if (req.query.search) {
      query.$or = [
        { title: { $regex: String(req.query.search), $options: 'i' } },
        { author: { $regex: String(req.query.search), $options: 'i' } },
      ];
    }

    const [books, total] = await Promise.all([
      LibraryBook.find(query)
        .sort({ title: 1 })
        .skip(skip)
        .limit(limit),
      LibraryBook.countDocuments(query),
    ]);

    res.json(createPaginationResponse(books, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getBookById = async (req: AuthRequest, res: Response) => {
  try {
    const book = await LibraryBook.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, data: book });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createBook = async (req: AuthRequest, res: Response) => {
  try {
    const { resourceType, resourceUrl } = req.body;

    // Validate resourceUrl for digital books
    if (resourceType === 'digital' && !resourceUrl) {
      return res.status(400).json({ success: false, message: 'resourceUrl is required for digital resources' });
    }

    const book = new LibraryBook({
      ...req.body,
      tenantId: req.tenantId,
      availableCopies: req.body.availableCopies ?? req.body.copies ?? 1,
    });

    await book.save();
    res.status(201).json({ success: true, data: book });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

/** Bulk import books (CSV parsed client-side into a JSON array). Max 500 rows. */
export const bulkImportBooks = async (req: AuthRequest, res: Response) => {
  try {
    const { books } = req.body;
    if (!Array.isArray(books) || books.length === 0) {
      return res.status(400).json({ success: false, message: 'books array is required' });
    }
    if (books.length > 500) {
      return res.status(400).json({ success: false, message: 'Maximum 500 books per import' });
    }

    const errors: { row: number; message: string }[] = [];
    const docs = books.map((b: any, i: number) => {
      if (!b.title || typeof b.title !== 'string' || !b.title.trim()) {
        errors.push({ row: i + 1, message: 'title is required' });
      }
      if (b.resourceType === 'digital' && !b.resourceUrl) {
        errors.push({ row: i + 1, message: 'resourceUrl is required for digital resources' });
      }
      const copies = Number(b.copies) > 0 ? Math.floor(Number(b.copies)) : 1;
      return {
        title: typeof b.title === 'string' ? b.title.trim() : b.title,
        titleMl: b.titleMl || b.title_ml || undefined,
        author: b.author || undefined,
        category: b.category || undefined,
        resourceType: b.resourceType === 'digital' ? 'digital' : 'physical',
        resourceUrl: b.resourceUrl || undefined,
        isbn: b.isbn || undefined,
        copies,
        availableCopies: copies,
        tenantId: req.tenantId,
      };
    });

    if (errors.length) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const created = await LibraryBook.insertMany(docs);
    res.status(201).json({ success: true, data: { imported: created.length } });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateBook = async (req: AuthRequest, res: Response) => {
  try {
    const sanitized = stripImmutable(req.body);

    const book = await LibraryBook.findOneAndUpdate(
      { _id: req.params.id, ...tenantScope(req) },
      sanitized,
      { new: true, runValidators: true }
    );

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, data: book });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteBook = async (req: AuthRequest, res: Response) => {
  try {
    // Check if there are un-returned issues for this book
    const unreturnedIssue = await BookIssue.findOne({
      bookId: req.params.id,
      status: { $in: ['issued', 'overdue'] },
    });

    if (unreturnedIssue) {
      return res
        .status(400)
        .json({ success: false, message: 'Cannot delete book with un-returned issues' });
    }

    const book = await LibraryBook.findOneAndDelete({
      _id: req.params.id,
      ...tenantScope(req),
    });

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }

    res.json({ success: true, message: 'Book deleted' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ============ Issues ============

export const getAllIssues = async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, skip } = getPaginationParams(req);
    const query: any = { ...tenantScope(req) };

    if (req.query.status) query.status = req.query.status;
    if (req.query.memberId) query.memberId = req.query.memberId;
    if (req.query.bookId) query.bookId = req.query.bookId;

    // Mark overdue issues: issued/overdue with dueDate < now
    const now = new Date();
    const [issues, total] = await Promise.all([
      BookIssue.find(query)
        .populate('bookId', 'title author')
        .populate('memberId', 'name')
        .sort({ issueDate: -1 })
        .skip(skip)
        .limit(limit),
      BookIssue.countDocuments(query),
    ]);

    // Enriched response: mark as overdue if needed (optional persist)
    const enriched = issues.map((issue) => {
      const doc = issue.toObject();
      if ((doc.status === 'issued' || doc.status === 'overdue') && doc.dueDate < now) {
        doc.status = 'overdue';
      }
      return doc;
    });

    res.json(createPaginationResponse(enriched, total, page, limit));
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getIssueById = async (req: AuthRequest, res: Response) => {
  try {
    const issue = await BookIssue.findOne({ _id: req.params.id, ...tenantScope(req) })
      .populate('bookId', 'title author')
      .populate('memberId', 'name');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    res.json({ success: true, data: issue });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createIssue = async (req: AuthRequest, res: Response) => {
  try {
    const refError = await validateRefs(req);
    if (refError) {
      return res.status(400).json({ success: false, message: refError });
    }

    // Check if book is digital
    const book = await LibraryBook.findById(req.body.bookId);
    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found' });
    }
    if (book.resourceType === 'digital') {
      return res
        .status(400)
        .json({ success: false, message: 'Digital resources are always available' });
    }

    // Check available copies (must be > 0)
    if (!book.availableCopies || book.availableCopies <= 0) {
      return res.status(400).json({ success: false, message: 'No copies available' });
    }

    // Atomically decrement availableCopies
    const updated = await LibraryBook.findOneAndUpdate(
      { _id: req.body.bookId, availableCopies: { $gt: 0 } },
      { $inc: { availableCopies: -1 } },
      { new: true }
    );

    if (!updated) {
      return res.status(400).json({ success: false, message: 'No copies available' });
    }

    const issue = new BookIssue({
      ...req.body,
      tenantId: req.tenantId,
      status: 'issued',
    });

    await issue.save();

    // Populate for response
    await issue.populate('bookId', 'title author');
    await issue.populate('memberId', 'name');

    res.status(201).json({ success: true, data: issue });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
};

export const returnIssue = async (req: AuthRequest, res: Response) => {
  try {
    const issue = await BookIssue.findOne({ _id: req.params.id, ...tenantScope(req) });

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    // Prevent double return
    if (issue.status === 'returned') {
      return res.status(400).json({ success: false, message: 'Book already returned' });
    }

    // Set return date and status
    issue.returnDate = new Date();
    issue.status = 'returned';
    await issue.save();

    // Increment availableCopies
    await LibraryBook.findByIdAndUpdate(
      issue.bookId,
      { $inc: { availableCopies: 1 } },
      { new: true }
    );

    await issue.populate('bookId', 'title author');
    await issue.populate('memberId', 'name');

    res.json({ success: true, data: issue });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getSummary = async (req: AuthRequest, res: Response) => {
  try {
    const query = tenantScope(req);

    const [bookCount, issuedCount, overdueCount, categoryBreakdown] = await Promise.all([
      LibraryBook.countDocuments({ ...query, status: 'active' }),
      BookIssue.countDocuments({ ...query, status: 'issued' }),
      BookIssue.countDocuments({
        ...query,
        status: { $in: ['issued', 'overdue'] },
        dueDate: { $lt: new Date() },
      }),
      LibraryBook.aggregate([
        { $match: { ...query, status: 'active' } },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalBooks: bookCount,
        issuedCount,
        overdueCount,
        categoryBreakdown: categoryBreakdown.map((cb) => ({
          category: cb._id,
          count: cb.count,
        })),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
