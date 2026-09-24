import express from 'express';
import {
  getAllBeneficiaries,
  getBeneficiaryById,
  createBeneficiary,
  updateBeneficiary,
  verifyBeneficiary,
  deleteBeneficiary,
  getAllDistributions,
  createDistribution,
  updateDistribution,
  deleteDistribution,
  getZakatSummary,
} from '../controllers/zakatDistributionController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { validCategoryValue } from '../validations/categoryValueValidation';
import { idParam, listQuery } from '../validations/common';
import {
  createZakatDistributionValidation,
  updateZakatDistributionValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /zakat/summary:
 *   get:
 *     summary: Zakat collected vs distributed for a year
 *     tags: [Zakat]
 *     description: |
 *       Totals from existing zakat collections against recorded distributions.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *         example: 2026
 *     responses:
 *       200:
 *         description: Collected, distributed, balance and beneficiary counts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/summary', listQuery(), validationHandler, getZakatSummary);

/**
 * @swagger
 * /zakat/beneficiaries:
 *   get:
 *     summary: List zakat beneficiaries
 *     tags: [Zakat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: verificationStatus
 *         schema:
 *           type: string
 *           enum: [pending, verified, rejected]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [fakir, miskin, amil, muallaf, riqab, gharim, fisabilillah, ibnussabil, other]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Beneficiary list
 */
router.get('/beneficiaries', listQuery(), validationHandler, getAllBeneficiaries);

/**
 * @swagger
 * /zakat/beneficiaries/{id}:
 *   get:
 *     summary: Get a beneficiary with their distribution history
 *     tags: [Zakat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Beneficiary and distributions
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/beneficiaries/:id', idParam('id', 'record'), validationHandler, getBeneficiaryById);

/**
 * @swagger
 * /zakat/beneficiaries:
 *   post:
 *     summary: Register a zakat beneficiary
 *     tags: [Zakat]
 *     description: |
 *       Always created as `pending`; verification is a separate step.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               memberId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               name:
 *                 type: string
 *                 description: Required when no memberId is given
 *               category:
 *                 type: string
 *               priorityArea:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Member or name missing
 */
router.post(
  '/beneficiaries',
  allowRoles(['mahall']),
  validCategoryValue('zakat_asnaf_category', 'category'),
  validationHandler,
  createBeneficiary
);

/**
 * @swagger
 * /zakat/beneficiaries/{id}:
 *   put:
 *     summary: Update a beneficiary's details
 *     tags: [Zakat]
 *     description: |
 *       Details only - verification status is changed through
 *       `/beneficiaries/{id}/verify`. `tenantId` is ignored, and a
 *       `memberId`/`familyId` belonging to another tenant is rejected with 400.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             properties:
 *               memberId:
 *                 type: string
 *               familyId:
 *                 type: string
 *               name:
 *                 type: string
 *               category:
 *                 type: string
 *               priorityArea:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated beneficiary
 *       400:
 *         description: Referenced member or family belongs to another tenant
 *       404:
 *         description: Beneficiary not found
 *   delete:
 *     summary: Delete a beneficiary
 *     tags: [Zakat]
 *     description: |
 *       Refused when the beneficiary already has recorded distributions.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       400:
 *         description: Blocked by existing distributions
 *       404:
 *         description: Beneficiary not found
 */
router.put(
  '/beneficiaries/:id', idParam('id', 'record'),
  allowRoles(['mahall']),
  validCategoryValue('zakat_asnaf_category', 'category'),
  validationHandler,
  updateBeneficiary
);

/**
 * @swagger
 * /zakat/beneficiaries/{id}/verify:
 *   put:
 *     summary: Verify or reject a beneficiary
 *     tags: [Zakat]
 *     description: |
 *       Only a verified beneficiary can receive distributions. Rejecting a
 *       beneficiary who already has distributions is refused.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             required: [verificationStatus]
 *             properties:
 *               verificationStatus:
 *                 type: string
 *                 enum: [pending, verified, rejected]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated beneficiary
 *       400:
 *         description: Invalid status, or rejection blocked by existing distributions
 */
router.put('/beneficiaries/:id/verify', idParam('id', 'record'), validationHandler, allowRoles(['mahall']), verifyBeneficiary);
router.delete('/beneficiaries/:id', idParam('id', 'record'), validationHandler, allowRoles(['mahall']), deleteBeneficiary);

/**
 * @swagger
 * /zakat/distributions:
 *   get:
 *     summary: List zakat distributions
 *     tags: [Zakat]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [regular, monthly, fitr, qurbani]
 *       - in: query
 *         name: beneficiaryId
 *         schema:
 *           type: string
 *       - in: query
 *         name: year
 *         schema:
 *           type: integer
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Distribution list
 */
router.get('/distributions', listQuery(), validationHandler, getAllDistributions);

/**
 * @swagger
 * /zakat/distributions:
 *   post:
 *     summary: Record a zakat distribution
 *     tags: [Zakat]
 *     description: |
 *       Rejected unless the beneficiary is verified. Set `postToLedger` to also
 *       write an expense ledger entry.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [beneficiaryId, amount]
 *             properties:
 *               beneficiaryId:
 *                 type: string
 *               amount:
 *                 type: number
 *               distributionDate:
 *                 type: string
 *                 format: date
 *               type:
 *                 type: string
 *                 enum: [regular, monthly, fitr, qurbani]
 *               paymentMethod:
 *                 type: string
 *               receiptNo:
 *                 type: string
 *               postToLedger:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Created
 *       400:
 *         description: Beneficiary not verified
 */
router.post('/distributions', createZakatDistributionValidation, validationHandler, allowRoles(['mahall']), createDistribution);

/**
 * @swagger
 * /zakat/distributions/{id}:
 *   put:
 *     summary: Update a zakat distribution
 *     tags: [Zakat]
 *     description: |
 *       Details only - the beneficiary cannot be changed here (delete and
 *       re-record instead). Does not re-post or adjust any ledger entry.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *             properties:
 *               amount:
 *                 type: number
 *               distributionDate:
 *                 type: string
 *                 format: date
 *               type:
 *                 type: string
 *                 enum: [regular, monthly, fitr, qurbani]
 *               paymentMethod:
 *                 type: string
 *               receiptNo:
 *                 type: string
 *               remarks:
 *                 type: string
 *     responses:
 *       200:
 *         description: Updated distribution
 *       404:
 *         description: Distribution not found
 *   delete:
 *     summary: Delete a zakat distribution
 *     tags: [Zakat]
 *     description: |
 *       Removes the distribution record. Any ledger entry posted for it is not
 *       reversed automatically - reverse it from the ledger if needed.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: Distribution not found
 */
router.put('/distributions/:id', updateZakatDistributionValidation, validationHandler, allowRoles(['mahall']), updateDistribution);
router.delete('/distributions/:id', idParam('id', 'record'), validationHandler, allowRoles(['mahall']), deleteDistribution);

export default router;
