import express from 'express';
import {
  getAllInstituteAccounts,
  createInstituteAccount,
  updateInstituteAccount,
  deleteInstituteAccount,
  getAllMahalluAccounts,
  createMahalluAccount,
  updateMahalluAccount,
  deleteMahalluAccount,
  getAllCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getAllWallets,
  createWallet,
  updateWallet,
  deleteWallet,
  getAllLedgers,
  createLedger,
  updateLedger,
  deleteLedger,
  getLedgerItems,
  createLedgerItem,
  updateLedgerItem,
  deleteLedgerItem,
} from '../controllers/masterAccountController';
import { authMiddleware } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter, instituteFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import {
  createInstituteAccountValidation,
  createCategoryValidation,
  createWalletValidation,
  createLedgerValidation,
  createLedgerItemValidation,
  updateInstituteAccountValidation,
  updateCategoryValidation,
  updateWalletValidation,
  updateLedgerValidation,
  updateLedgerItemValidation,
  idParamValidation,
} from '../validations/masterAccountValidation';
import { idParam, listQuery } from '../validations/common';
import {
  createMahalluAccountValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(instituteFilter);

/**
 * @swagger
 * /master-accounts/institute:
 *   get:
 *     summary: Get all institute accounts
 *     tags: [Master Accounts]
 *     description: |
 *       Get all institute accounts with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: instituteId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439015'
 *         description: Filter by institute ID
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Filter by tenant ID (Super Admin only)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, inactive]
 *         example: active
 *         description: Filter by status
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
 *         description: List of institute accounts retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: '507f1f77bcf86cd799439032'
 *                       instituteId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                       accountName:
 *                         type: string
 *                         example: 'Main Account'
 *                       accountNumber:
 *                         type: string
 *                         example: '1234567890'
 *                       bankName:
 *                         type: string
 *                         example: 'State Bank'
 *                       ifscCode:
 *                         type: string
 *                         example: 'SBIN0001234'
 *                       balance:
 *                         type: number
 *                         example: 100000
 *                       status:
 *                         type: string
 *                         enum: [active, inactive]
 *                         example: active
 *                       tenantId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/institute', listQuery(), validationHandler, getAllInstituteAccounts);

/**
 * @swagger
 * /master-accounts/institute:
 *   post:
 *     summary: Create institute account
 *     tags: [Master Accounts]
 *     description: |
 *       Create a new institute account.
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - instituteId
 *               - accountName
 *             properties:
 *               instituteId:
 *                 type: string
 *                 example: '507f1f77bcf86cd799439015'
 *                 description: MongoDB ObjectId of the institute
 *               accountName:
 *                 type: string
 *                 example: 'Main Account'
 *                 minLength: 2
 *                 maxLength: 200
 *               accountNumber:
 *                 type: string
 *                 example: '1234567890'
 *               bankName:
 *                 type: string
 *                 example: 'State Bank'
 *               ifscCode:
 *                 type: string
 *                 example: 'SBIN0001234'
 *               balance:
 *                 type: number
 *                 example: 100000
 *                 minimum: 0
 *                 default: 0
 *               status:
 *                 type: string
 *                 enum: [active, inactive]
 *                 example: active
 *                 default: active
 *           examples:
 *             basicAccount:
 *               summary: Create basic institute account
 *               value:
 *                 instituteId: '507f1f77bcf86cd799439015'
 *                 accountName: 'Main Account'
 *             completeAccount:
 *               summary: Create institute account with all details
 *               value:
 *                 instituteId: '507f1f77bcf86cd799439015'
 *                 accountName: 'Main Account'
 *                 accountNumber: '1234567890'
 *                 bankName: 'State Bank'
 *                 ifscCode: 'SBIN0001234'
 *                 balance: 100000
 *                 status: 'active'
 *     responses:
 *       201:
 *         description: Institute account created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     instituteId:
 *                       type: string
 *                     accountName:
 *                       type: string
 *                     balance:
 *                       type: number
 *                     status:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Institute not found
 */
router.post('/institute', createInstituteAccountValidation, validationHandler, createInstituteAccount);

/**
 * @swagger
 * /master-accounts/categories:
 *   get:
 *     summary: Get all categories
 *     tags: [Master Accounts]
 *     description: |
 *       Get all categories (income/expense) with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         example: income
 *         description: Filter by category type
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Filter by tenant ID (Super Admin only)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: donation
 *         description: Search by category name
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
 *         description: List of categories retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: '507f1f77bcf86cd799439033'
 *                       name:
 *                         type: string
 *                         example: 'Donations'
 *                       description:
 *                         type: string
 *                         example: 'Charitable donations'
 *                       type:
 *                         type: string
 *                         enum: [income, expense]
 *                         example: income
 *                       tenantId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/categories', listQuery(), validationHandler, getAllCategories);

/**
 * @swagger
 * /master-accounts/categories:
 *   post:
 *     summary: Create category
 *     tags: [Master Accounts]
 *     description: |
 *       Create a new category (income or expense).
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Donations'
 *                 minLength: 2
 *                 maxLength: 200
 *                 description: Category name
 *               description:
 *                 type: string
 *                 example: 'Charitable donations and contributions'
 *                 description: Category description
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *                 example: income
 *                 description: Category type
 *           examples:
 *             incomeCategory:
 *               summary: Create income category
 *               value:
 *                 name: 'Donations'
 *                 description: 'Charitable donations'
 *                 type: 'income'
 *             expenseCategory:
 *               summary: Create expense category
 *               value:
 *                 name: 'Maintenance'
 *                 description: 'Building maintenance expenses'
 *                 type: 'expense'
 *     responses:
 *       201:
 *         description: Category created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/categories', createCategoryValidation, validationHandler, createCategory);

/**
 * @swagger
 * /master-accounts/wallets:
 *   get:
 *     summary: Get all master wallets
 *     tags: [Master Accounts]
 *     description: |
 *       Get all master wallets with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [main, reserve, charity]
 *         example: main
 *         description: Filter by wallet type
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Filter by tenant ID (Super Admin only)
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
 *         description: List of master wallets retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: '507f1f77bcf86cd799439034'
 *                       name:
 *                         type: string
 *                         example: 'Main Wallet'
 *                       balance:
 *                         type: number
 *                         example: 50000
 *                       type:
 *                         type: string
 *                         enum: [main, reserve, charity]
 *                         example: main
 *                       tenantId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/wallets', listQuery(), validationHandler, getAllWallets);

/**
 * @swagger
 * /master-accounts/wallets:
 *   post:
 *     summary: Create master wallet
 *     tags: [Master Accounts]
 *     description: |
 *       Create a new master wallet.
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Main Wallet'
 *                 minLength: 2
 *                 maxLength: 200
 *                 description: Wallet name
 *               balance:
 *                 type: number
 *                 example: 50000
 *                 minimum: 0
 *                 default: 0
 *                 description: Initial balance
 *               type:
 *                 type: string
 *                 enum: [main, reserve, charity]
 *                 example: main
 *                 description: Wallet type
 *           examples:
 *             mainWallet:
 *               summary: Create main wallet
 *               value:
 *                 name: 'Main Wallet'
 *                 type: 'main'
 *                 balance: 50000
 *             reserveWallet:
 *               summary: Create reserve wallet
 *               value:
 *                 name: 'Reserve Fund'
 *                 type: 'reserve'
 *                 balance: 100000
 *     responses:
 *       201:
 *         description: Wallet created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     balance:
 *                       type: number
 *                     type:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/wallets', createWalletValidation, validationHandler, createWallet);

/**
 * @swagger
 * /master-accounts/ledgers:
 *   get:
 *     summary: Get all ledgers
 *     tags: [Master Accounts]
 *     description: |
 *       Get all ledgers with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [income, expense]
 *         example: income
 *         description: Filter by ledger type
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Filter by tenant ID (Super Admin only)
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         example: monthly
 *         description: Search by ledger name
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
 *         description: List of ledgers retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: '507f1f77bcf86cd799439035'
 *                       name:
 *                         type: string
 *                         example: 'Monthly Income'
 *                       description:
 *                         type: string
 *                         example: 'Monthly income ledger'
 *                       type:
 *                         type: string
 *                         enum: [income, expense]
 *                         example: income
 *                       tenantId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/ledgers', listQuery(), validationHandler, getAllLedgers);

/**
 * @swagger
 * /master-accounts/ledgers:
 *   post:
 *     summary: Create ledger
 *     tags: [Master Accounts]
 *     description: |
 *       Create a new ledger (income or expense).
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - type
 *             properties:
 *               name:
 *                 type: string
 *                 example: 'Monthly Income'
 *                 minLength: 2
 *                 maxLength: 200
 *                 description: Ledger name
 *               description:
 *                 type: string
 *                 example: 'Monthly income ledger for tracking all income'
 *                 description: Ledger description
 *               type:
 *                 type: string
 *                 enum: [income, expense]
 *                 example: income
 *                 description: Ledger type
 *           examples:
 *             incomeLedger:
 *               summary: Create income ledger
 *               value:
 *                 name: 'Monthly Income'
 *                 description: 'Monthly income ledger'
 *                 type: 'income'
 *             expenseLedger:
 *               summary: Create expense ledger
 *               value:
 *                 name: 'Monthly Expenses'
 *                 description: 'Monthly expense ledger'
 *                 type: 'expense'
 *     responses:
 *       201:
 *         description: Ledger created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     type:
 *                       type: string
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.post('/ledgers', createLedgerValidation, validationHandler, createLedger);

/**
 * @swagger
 * /master-accounts/ledger-items:
 *   get:
 *     summary: Get all ledger items
 *     tags: [Master Accounts]
 *     description: |
 *       Get all ledger items with pagination and filtering.
 *       **Access:** Super Admin (all tenants), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: ledgerId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439035'
 *         description: Filter by ledger ID
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439033'
 *         description: Filter by category ID
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-01-01'
 *         description: Filter items from this date
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *         example: '2024-12-31'
 *         description: Filter items until this date
 *       - in: query
 *         name: tenantId
 *         schema:
 *           type: string
 *         example: '507f1f77bcf86cd799439012'
 *         description: Filter by tenant ID (Super Admin only)
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
 *         description: List of ledger items retrieved successfully
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
 *                     type: object
 *                     properties:
 *                       _id:
 *                         type: string
 *                         example: '507f1f77bcf86cd799439036'
 *                       ledgerId:
 *                         type: object
 *                         properties:
 *                           _id:
 *                             type: string
 *                           name:
 *                             type: string
 *                       date:
 *                         type: string
 *                         format: date-time
 *                         example: '2024-02-01T00:00:00.000Z'
 *                       amount:
 *                         type: number
 *                         example: 5000
 *                       description:
 *                         type: string
 *                         example: 'Monthly donation collection'
 *                       categoryId:
 *                         type: string
 *                       paymentMethod:
 *                         type: string
 *                         example: 'Cash'
 *                       referenceNo:
 *                         type: string
 *                         example: 'REF001'
 *                       tenantId:
 *                         type: string
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/ledger-items', listQuery(), validationHandler, getLedgerItems);

/**
 * @swagger
 * /master-accounts/ledger-items:
 *   post:
 *     summary: Create ledger item
 *     tags: [Master Accounts]
 *     description: |
 *       Create a new ledger item (transaction entry).
 *       **Access:** Super Admin (any tenant), Mahall Admin, Institute User (own tenant)
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ledgerId
 *               - date
 *               - amount
 *               - description
 *             properties:
 *               ledgerId:
 *                 type: string
 *                 example: '507f1f77bcf86cd799439035'
 *                 description: MongoDB ObjectId of the ledger
 *               date:
 *                 type: string
 *                 format: date-time
 *                 example: '2024-02-01T00:00:00.000Z'
 *                 description: Transaction date
 *               amount:
 *                 type: number
 *                 example: 5000
 *                 minimum: 0
 *                 description: Transaction amount
 *               description:
 *                 type: string
 *                 example: 'Monthly donation collection'
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Transaction description
 *               categoryId:
 *                 type: string
 *                 example: '507f1f77bcf86cd799439033'
 *                 description: MongoDB ObjectId of the category (optional)
 *               paymentMethod:
 *                 type: string
 *                 example: 'Cash'
 *                 description: Payment method (optional)
 *               referenceNo:
 *                 type: string
 *                 example: 'REF001'
 *                 description: Reference number (optional)
 *           examples:
 *             basicItem:
 *               summary: Create basic ledger item
 *               value:
 *                 ledgerId: '507f1f77bcf86cd799439035'
 *                 date: '2024-02-01T00:00:00.000Z'
 *                 amount: 5000
 *                 description: 'Monthly donation collection'
 *             completeItem:
 *               summary: Create ledger item with all details
 *               value:
 *                 ledgerId: '507f1f77bcf86cd799439035'
 *                 date: '2024-02-01T00:00:00.000Z'
 *                 amount: 5000
 *                 description: 'Monthly donation collection'
 *                 categoryId: '507f1f77bcf86cd799439033'
 *                 paymentMethod: 'Cash'
 *                 referenceNo: 'REF001'
 *     responses:
 *       201:
 *         description: Ledger item created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     _id:
 *                       type: string
 *                     ledgerId:
 *                       type: string
 *                     date:
 *                       type: string
 *                       format: date-time
 *                     amount:
 *                       type: number
 *                     description:
 *                       type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         description: Ledger not found
 */
router.post('/ledger-items', createLedgerItemValidation, validationHandler, createLedgerItem);

// ============ UPDATE ROUTES ============
router.put('/institute/:id', updateInstituteAccountValidation, validationHandler, updateInstituteAccount);
router.put('/categories/:id', updateCategoryValidation, validationHandler, updateCategory);
router.put('/wallets/:id', updateWalletValidation, validationHandler, updateWallet);
router.put('/ledgers/:id', updateLedgerValidation, validationHandler, updateLedger);
router.put('/ledger-items/:id', updateLedgerItemValidation, validationHandler, updateLedgerItem);

// ============ DELETE ROUTES ============
router.delete('/institute/:id', idParamValidation, validationHandler, deleteInstituteAccount);
router.delete('/categories/:id', idParamValidation, validationHandler, deleteCategory);
router.delete('/wallets/:id', idParamValidation, validationHandler, deleteWallet);
router.delete('/ledgers/:id', idParamValidation, validationHandler, deleteLedger);
router.delete('/ledger-items/:id', idParamValidation, validationHandler, deleteLedgerItem);

// Mahallu Accounts (tenant-level, no instituteId)
router.get('/mahallu-accounts', listQuery(), validationHandler, getAllMahalluAccounts);
router.post('/mahallu-accounts', createMahalluAccountValidation, validationHandler, createMahalluAccount);
router.put('/mahallu-accounts/:id', idParamValidation, validationHandler, updateMahalluAccount);
router.delete('/mahallu-accounts/:id', idParamValidation, validationHandler, deleteMahalluAccount);

export default router;

