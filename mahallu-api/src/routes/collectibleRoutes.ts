import express from 'express';
import {
  getCollectionsSummary,
  getAllVarisangyas,
  getFamilyDues,
  getNextReceiptNumber,
  createVarisangya,
  updateVarisangya,
  deleteVarisangya,
  getAllZakats,
  createZakat,
  updateZakat,
  deleteZakat,
  getWallet,
  getWalletTransactions,
  getPaymentRequests,
  approvePaymentRequest,
  rejectPaymentRequest,
  cancelReceipt,
  recordReceiptPrint,
} from '../controllers/collectibleController';
import { authMiddleware, allowRoles, requirePermission } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createVarisangyaValidation,
  updateVarisangyaValidation,
  createZakatValidation,
  getWalletTransactionsValidation,
} from '../validations/collectibleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['super_admin', 'mahall', 'institute']));

/**
 * @swagger
 * /collectibles/varisangya:
 *   get:
 *     summary: Get all Varisangya payments
 *     tags: [Collectibles]
 *     description: |
 *       Retrieve all Varisangya (family/member contribution) payments with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: familyId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439013'
 *         description: Filter by family ID
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439014'
 *         description: Filter by member ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter payments from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter payments until this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         example: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of Varisangya payments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Varisangya'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
/**
 * @swagger
 * /collectibles/payment-requests:
 *   get:
 *     summary: List member-submitted payment requests
 *     tags: [Collectibles]
 *     description: |
 *       Varisangya/Zakat payments submitted by members through the member portal. Requests are
 *       created as `pending` and do not count in any totals until approved.
 *       **Access:** Super Admin, Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, approved, rejected]
 *           default: pending
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [varisangya, zakat]
 *         description: Restrict to one payment type
 *     responses:
 *       200:
 *         description: Requests plus per-status count/amount summary
 *       400:
 *         description: Invalid status
 */
router.get('/summary', getCollectionsSummary);
router.get('/payment-requests', getPaymentRequests);

/**
 * @swagger
 * /collectibles/payment-requests/{type}/{id}/approve:
 *   post:
 *     summary: Approve a pending member payment request
 *     tags: [Collectibles]
 *     description: |
 *       Marks the request approved, assigns a receipt number, credits the wallet (Varisangya),
 *       posts the ledger entry and sends the WhatsApp receipt, exactly like an admin-recorded payment.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [varisangya, zakat]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request approved
 *       404:
 *         description: Request not found
 *       409:
 *         description: Request already reviewed
 */
router.post('/payment-requests/:type/:id/approve', requirePermission('canApprovePayments'), approvePaymentRequest);

/**
 * @swagger
 * /collectibles/payment-requests/{type}/{id}/reject:
 *   post:
 *     summary: Reject a pending member payment request
 *     tags: [Collectibles]
 *     description: Marks the request rejected with a reason. No money, wallet or ledger effects.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [varisangya, zakat]
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason:
 *                 type: string
 *                 example: Payment not received
 *     responses:
 *       200:
 *         description: Request rejected
 *       400:
 *         description: Reason missing
 *       404:
 *         description: Request not found
 *       409:
 *         description: Request already reviewed
 */
router.post('/payment-requests/:type/:id/reject', requirePermission('canApprovePayments'), rejectPaymentRequest);

router.get('/varisangya', getAllVarisangyas);
router.get('/receipt-next', getNextReceiptNumber);
router.get('/dues', getFamilyDues);

/**
 * @swagger
 * /collectibles/varisangya:
 *   post:
 *     summary: Create a new Varisangya payment
 *     tags: [Collectibles]
 *     description: |
 *       Create a new Varisangya (family/member contribution) payment record.
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateVarisangyaRequest'
 *           examples:
 *             familyVarisangya:
 *               summary: Create Varisangya for family
 *               value:
 *                 familyId: '507f1f77bcf86cd799439013'
 *                 amount: 500
 *                 paymentDate: '2024-02-01T00:00:00.000Z'
 *                 paymentMethod: 'Cash'
 *                 receiptNo: 'REC001'
 *             memberVarisangya:
 *               summary: Create Varisangya for member
 *               value:
 *                 memberId: '507f1f77bcf86cd799439014'
 *                 amount: 300
 *                 paymentDate: '2024-02-01T00:00:00.000Z'
 *                 paymentMethod: 'Online'
 *                 receiptNo: 'REC002'
 *                 remarks: 'Monthly contribution'
 *     responses:
 *       201:
 *         description: Varisangya payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Varisangya'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/varisangya', createVarisangyaValidation, validationHandler, createVarisangya);
router.put('/varisangya/:id', updateVarisangyaValidation, validationHandler, updateVarisangya);
// Hard delete is super admin only; mahall admins cancel (void) receipts instead.
router.delete('/varisangya/:id', allowRoles(['super_admin']), deleteVarisangya);

/**
 * @swagger
 * /collectibles/zakat:
 *   get:
 *     summary: Get all Zakat payments
 *     tags: [Collectibles]
 *     description: |
 *       Retrieve all Zakat payments with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: payerId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439014'
 *         description: Filter by payer member ID
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         example: 'annual'
 *         description: Filter by category
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter payments from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter payments until this date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         example: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: List of Zakat payments retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Zakat'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/zakat', getAllZakats);

/**
 * @swagger
 * /collectibles/zakat:
 *   post:
 *     summary: Create a new Zakat payment
 *     tags: [Collectibles]
 *     description: |
 *       Create a new Zakat payment record.
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateZakatRequest'
 *           examples:
 *             basicZakat:
 *               summary: Create basic Zakat payment
 *               value:
 *                 payerName: 'Ahmed Ali'
 *                 amount: 1000
 *                 paymentDate: '2024-02-01T00:00:00.000Z'
 *             completeZakat:
 *               summary: Create Zakat payment with all details
 *               value:
 *                 payerName: 'Ahmed Ali'
 *                 payerId: '507f1f77bcf86cd799439014'
 *                 amount: 1000
 *                 paymentDate: '2024-02-01T00:00:00.000Z'
 *                 paymentMethod: 'Bank Transfer'
 *                 receiptNo: 'ZAK001'
 *                 category: 'Annual Zakat'
 *                 remarks: 'Zakat for the year 2024'
 *     responses:
 *       201:
 *         description: Zakat payment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Zakat'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/zakat', createZakatValidation, validationHandler, createZakat);
router.put('/zakat/:id', updateZakat);
router.delete('/zakat/:id', allowRoles(['super_admin']), deleteZakat);

/**
 * @swagger
 * /collectibles/{type}/{id}/cancel:
 *   post:
 *     summary: Cancel (void) a Varisangya or Zakat receipt
 *     tags: [Collectibles]
 *     description: |
 *       Keeps the receipt and its number, marks it cancelled and reverses wallet and ledger amounts.
 *       Requires the canCancelReceipts permission (mahall admin by default). Cannot be undone.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: type
 *         required: true
 *         schema: { type: string, enum: [varisangya, zakat] }
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [reason]
 *             properties:
 *               reason: { type: string, minLength: 5 }
 *     responses:
 *       200: { description: Receipt cancelled }
 *       400: { description: Reason missing or too short }
 *       409: { description: Already cancelled, or not an issued receipt }
 */
router.post('/:type/:id/cancel', requirePermission('canCancelReceipts'), cancelReceipt);

/**
 * @swagger
 * /collectibles/{type}/{id}/print-log:
 *   post:
 *     summary: Record a receipt print
 *     tags: [Collectibles]
 *     description: The first print is logged as original, later prints as duplicate. The server decides which.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200: { description: "{ kind, isDuplicate, printLog }" }
 */
router.post('/:type/:id/print-log', recordReceiptPrint);

/**
 * @swagger
 * /collectibles/wallet:
 *   get:
 *     summary: Get wallet information
 *     tags: [Collectibles]
 *     description: |
 *       Get wallet information for families/members.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: familyId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439013'
 *         description: Filter by family ID
 *       - in: query
 *         name: memberId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439014'
 *         description: Filter by member ID
 *     responses:
 *       200:
 *         description: Wallet information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Wallet'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/wallet', getWallet);

/**
 * @swagger
 * /collectibles/wallet/{walletId}/transactions:
 *   get:
 *     summary: Get wallet transactions
 *     tags: [Collectibles]
 *     description: |
 *       Get all transactions for a specific wallet.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: walletId
 *         required: true
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439023'
 *         description: MongoDB ObjectId of the wallet
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [credit, debit]
 *         example: credit
 *         description: Filter by transaction type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         example: 1
 *         description: Page number for pagination
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         example: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Wallet transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/wallet/:walletId/transactions', getWalletTransactionsValidation, validationHandler, getWalletTransactions);

export default router;

