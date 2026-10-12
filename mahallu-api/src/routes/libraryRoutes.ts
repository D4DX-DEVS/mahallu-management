import express from 'express';
import {
  getAllBooks,
  bulkImportBooks,
  getBookById,
  createBook,
  updateBook,
  deleteBook,
  getAllIssues,
  getIssueById,
  createIssue,
  returnIssue,
  getSummary,
} from '../controllers/libraryController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /api/library-books/summary:
 *   get:
 *     summary: Get library summary
 *     tags: [Library]
 *     responses:
 *       200:
 *         description: Summary data
 */
router.get('/summary', getSummary);

/**
 * @swagger
 * /api/library-books:
 *   get:
 *     summary: List books
 *     tags: [Library]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: category
 *         schema: { type: string }
 *       - in: query
 *         name: resourceType
 *         schema: { type: string }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Books list
 */
router.get('/', getAllBooks);

/**
 * @swagger
 * /api/library-books:
 *   post:
 *     summary: Create book
 *     tags: [Library]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, author, category]
 *     responses:
 *       201:
 *         description: Book created
 *       400:
 *         description: Invalid input
 */
router.post('/', allowRoles(['mahall', 'super_admin']), createBook);

/**
 * @swagger
 * /api/library-books/bulk-import:
 *   post:
 *     summary: Bulk import books
 *     tags: [Library]
 *     description: |
 *       Import up to 500 books at once (CSV parsed client-side into JSON rows).
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [books]
 *             properties:
 *               books:
 *                 type: array
 *                 maxItems: 500
 *                 items:
 *                   type: object
 *                   required: [title]
 *                   properties:
 *                     title:
 *                       type: string
 *                     author:
 *                       type: string
 *                     category:
 *                       type: string
 *                     isbn:
 *                       type: string
 *                     copies:
 *                       type: integer
 *                       default: 1
 *                     resourceType:
 *                       type: string
 *                       enum: [physical, digital]
 *                     resourceUrl:
 *                       type: string
 *     responses:
 *       201:
 *         description: Number of books imported
 *       400:
 *         description: Validation errors with row numbers
 */
router.post('/bulk-import', allowRoles(['mahall', 'super_admin']), bulkImportBooks);

/**
 * @swagger
 * /api/library-books/{id}:
 *   get:
 *     summary: Get book by ID
 *     tags: [Library]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Book data
 *       404:
 *         description: Book not found
 */
router.get('/:id', getBookById);

/**
 * @swagger
 * /api/library-books/{id}:
 *   put:
 *     summary: Update book
 *     tags: [Library]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Book updated
 */
router.put('/:id', allowRoles(['mahall', 'super_admin']), updateBook);

/**
 * @swagger
 * /api/library-books/{id}:
 *   delete:
 *     summary: Delete book
 *     tags: [Library]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Book deleted
 */
router.delete('/:id', allowRoles(['mahall', 'super_admin']), deleteBook);

export const booksRouter = router;

// ============ Issues Router ============

const issuesRouter = express.Router();

issuesRouter.use(authMiddleware);
issuesRouter.use(tenantMiddleware);
issuesRouter.use(tenantFilter);

/**
 * @swagger
 * /api/book-issues:
 *   get:
 *     summary: List book issues
 *     tags: [Library]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: status
 *         schema: { type: string }
 *       - in: query
 *         name: memberId
 *         schema: { type: string }
 *       - in: query
 *         name: bookId
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Issues list
 */
issuesRouter.get('/', getAllIssues);

/**
 * @swagger
 * /api/book-issues:
 *   post:
 *     summary: Create book issue
 *     tags: [Library]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [bookId, memberId, dueDate]
 *     responses:
 *       201:
 *         description: Issue created
 */
issuesRouter.post('/', allowRoles(['mahall', 'super_admin']), createIssue);

/**
 * @swagger
 * /api/book-issues/{id}:
 *   get:
 *     summary: Get issue by ID
 *     tags: [Library]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Issue data
 */
issuesRouter.get('/:id', getIssueById);

/**
 * @swagger
 * /api/book-issues/{id}/return:
 *   post:
 *     summary: Return book
 *     tags: [Library]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Book returned
 */
issuesRouter.post('/:id/return', allowRoles(['mahall', 'super_admin']), returnIssue);

export { issuesRouter };
