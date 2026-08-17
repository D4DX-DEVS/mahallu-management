import express from 'express';
import {
  getOwnProfile,
  getOwnOverview,
  updateOwnProfile,
  getOwnPayments,
  getOwnVarisangya,
  getOwnWallet,
  getOwnWalletTransactions,
  requestVarisangyaPayment,
  requestZakatPayment,
  getOwnRegistrations,
  requestNikahRegistration,
  requestDeathRegistration,
  requestNOC,
  resubmitRegistration,
  getOwnNotifications,
  getCommunityPrograms,
  getPublicFeeds,
  getPublicBanners,
  getOwnFamilyMembers,
} from '../controllers/memberUserController';
import { authMiddleware, memberUserOnly } from '../middleware/authMiddleware';
import { validationHandler } from '../middleware/validationHandler';

const router = express.Router();

// All routes require authentication and member user role
router.use(authMiddleware);
router.use(memberUserOnly);

/**
 * @swagger
 * /member-user/profile:
 *   get:
 *     summary: Get own member profile
 *     tags: [Member User]
 *     description: |
 *       Get the authenticated member user's own profile information.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Member profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Member'
 *       404:
 *         description: Member profile not found or not linked
 */
router.get('/profile', getOwnProfile);
router.get('/overview', getOwnOverview);

/**
 * @swagger
 * /member-user/profile:
 *   put:
 *     summary: Update own member profile
 *     tags: [Member User]
 *     description: |
 *       Update limited fields of the authenticated member user's profile.
 *       Only phone and email can be updated by member users.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               phone:
 *                 type: string
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       404:
 *         description: Member profile not found
 */
router.put('/profile', updateOwnProfile);

/**
 * @swagger
 * /member-user/payments:
 *   get:
 *     summary: Get own payment history
 *     tags: [Member User]
 *     description: |
 *       Get payment history (Varisangya and Zakat) for the authenticated member user.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [varisangya, zakat]
 *         description: Filter by payment type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 */
router.get('/payments', getOwnPayments);
router.get('/varisangya', getOwnVarisangya);

/**
 * @swagger
 * /member-user/wallet:
 *   get:
 *     summary: Get own wallet balance
 *     tags: [Member User]
 *     description: |
 *       Get wallet balance for the authenticated member user.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance retrieved successfully
 */
router.get('/wallet', getOwnWallet);

/**
 * @swagger
 * /member-user/wallet/transactions:
 *   get:
 *     summary: Get own wallet transactions
 *     tags: [Member User]
 *     description: |
 *       Get transaction history for the authenticated member user's wallet.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 */
router.get('/wallet/transactions', getOwnWalletTransactions);

/**
 * @swagger
 * /member-user/payments/varisangya:
 *   post:
 *     summary: Request Varisangya payment
 *     tags: [Member User]
 *     description: |
 *       Submit a Varisangya payment request. The payment will be linked to the authenticated member user.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentDate
 *             properties:
 *               amount:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *               receiptNo:
 *                 type: string
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment request submitted successfully
 */
router.post('/payments/varisangya', requestVarisangyaPayment);

/**
 * @swagger
 * /member-user/payments/zakat:
 *   post:
 *     summary: Request Zakat payment
 *     tags: [Member User]
 *     description: |
 *       Submit a Zakat payment request. The payment will be linked to the authenticated member user.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentDate
 *             properties:
 *               amount:
 *                 type: number
 *               paymentDate:
 *                 type: string
 *                 format: date
 *               paymentMethod:
 *                 type: string
 *               receiptNo:
 *                 type: string
 *               category:
 *                 type: string
 *               remarks:
 *                 type: string
 *     responses:
 *       201:
 *         description: Payment request submitted successfully
 */
router.post('/payments/zakat', requestZakatPayment);

/**
 * @swagger
 * /member-user/registrations:
 *   get:
 *     summary: Get own registrations
 *     tags: [Member User]
 *     description: |
 *       Get all registrations (Nikah, Death, NOC) for the authenticated member user.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [nikah, death, noc]
 *         description: Filter by registration type
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Registrations retrieved successfully
 */
router.get('/registrations', getOwnRegistrations);

/**
 * @swagger
 * /member-user/registrations/nikah:
 *   post:
 *     summary: Request Nikah registration
 *     tags: [Member User]
 *     description: |
 *       Submit a Nikah (marriage) registration request. The authenticated member user will be set as the groom.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - brideName
 *               - nikahDate
 *             properties:
 *               brideName:
 *                 type: string
 *               brideAge:
 *                 type: number
 *               brideId:
 *                 type: string
 *               nikahDate:
 *                 type: string
 *                 format: date
 *               waliName:
 *                 type: string
 *               witness1:
 *                 type: string
 *               witness2:
 *                 type: string
 *               mahrAmount:
 *                 type: number
 *               mahrDescription:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration request submitted successfully
 */
router.post('/registrations/nikah', requestNikahRegistration);

/**
 * @swagger
 * /member-user/registrations/death:
 *   post:
 *     summary: Request Death registration
 *     tags: [Member User]
 *     description: |
 *       Submit a Death registration request. The authenticated member user will be set as the deceased.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deathDate
 *             properties:
 *               deathDate:
 *                 type: string
 *                 format: date
 *               placeOfDeath:
 *                 type: string
 *               causeOfDeath:
 *                 type: string
 *               informantName:
 *                 type: string
 *               informantRelation:
 *                 type: string
 *               informantPhone:
 *                 type: string
 *     responses:
 *       201:
 *         description: Registration request submitted successfully
 */
router.post('/registrations/death', requestDeathRegistration);

/**
 * @swagger
 * /member-user/registrations/noc:
 *   post:
 *     summary: Request NOC (No Objection Certificate)
 *     tags: [Member User]
 *     description: |
 *       Submit a NOC request. The authenticated member user will be set as the applicant.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - purpose
 *               - type
 *             properties:
 *               purpose:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [common, nikah]
 *               nikahRegistrationId:
 *                 type: string
 *                 description: Required if type is 'nikah'
 *     responses:
 *       201:
 *         description: NOC request submitted successfully
 */
router.post('/registrations/noc', requestNOC);

// Edit + resubmit an own registration while status is pending / correction_required
router.put('/registrations/:type/:id', resubmitRegistration);

/**
 * @swagger
 * /member-user/notifications:
 *   get:
 *     summary: Get own notifications
 *     tags: [Member User]
 *     description: |
 *       Get notifications sent to the authenticated member user.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 */
router.get('/notifications', getOwnNotifications);

/**
 * @swagger
 * /member-user/programs:
 *   get:
 *     summary: Get community programs
 *     tags: [Member User]
 *     description: |
 *       Get active community programs (view only).
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Programs retrieved successfully
 */
router.get('/programs', getCommunityPrograms);

/**
 * @swagger
 * /member-user/feeds:
 *   get:
 *     summary: Get public feeds
 *     tags: [Member User]
 *     description: |
 *       Get public community feeds and announcements.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Feeds retrieved successfully
 */
/**
 * @swagger
 * /member-user/banners:
 *   get:
 *     summary: Get active banners
 *     tags: [Member User]
 *     description: |
 *       Get active banners for the member's mahallu community.
 *       Only returns banners with status 'active' and within their valid date range.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Banners retrieved successfully
 *       404:
 *         description: Member profile not found or not linked
 */
router.get('/banners', getPublicBanners);

router.get('/feeds', getPublicFeeds);

/**
 * @swagger
 * /member-user/family-members:
 *   get:
 *     summary: Get own family members
 *     tags: [Member User]
 *     description: |
 *       Get all members from the authenticated member user's family.
 *       **Access:** Member User only
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Family members retrieved successfully
 *       404:
 *         description: Member not found or not linked to a family
 */
router.get('/family-members', getOwnFamilyMembers);

export default router;

