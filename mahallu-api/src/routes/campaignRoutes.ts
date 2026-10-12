import express from 'express';
import * as c from '../controllers/campaignController';
import { authMiddleware, allowRoles, requirePermission } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();
router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);
router.use(allowRoles(['mahall']));

/**
 * Seasonal collection campaigns (Fitr, Udhiya, Ramadan relief, building fund, custom).
 * Reads: any mahall admin. Writes: `canManageCampaigns`. Cancelling a receipt: `canCancelReceipts`.
 * @swagger
 * /campaigns:
 *   get:
 *     summary: List campaigns with raised vs target
 *     tags: [Campaigns]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Campaigns with progress }
 */
router.get('/', c.listCampaigns);
router.get('/suggestions', c.campaignSuggestions);
router.post('/', requirePermission('canManageCampaigns'), c.createCampaign);
router.post('/contributions/:cid/cancel', requirePermission('canCancelReceipts'), c.cancelContribution);

router.get('/:id', c.getCampaign);
router.put('/:id', requirePermission('canManageCampaigns'), c.updateCampaign);
router.patch('/:id/status', requirePermission('canManageCampaigns'), c.setCampaignStatus);
router.delete('/:id', requirePermission('canManageCampaigns'), c.deleteCampaign);
router.get('/:id/progress', c.campaignProgress);
router.get('/:id/contributions', c.listContributions);
router.post('/:id/contributions', c.addContribution);

router.get('/:id/fitr', c.fitrChecklist);
router.post('/:id/fitr/:familyId/mark-paid', c.fitrMarkPaid);

router.get('/:id/udhiya', c.listUdhiya);
router.post('/:id/udhiya', requirePermission('canManageCampaigns'), c.createUdhiya);
router.put('/:id/udhiya/:bid', requirePermission('canManageCampaigns'), c.updateUdhiya);
router.delete('/:id/udhiya/:bid', requirePermission('canManageCampaigns'), c.deleteUdhiya);
router.post('/:id/udhiya/:bid/participants/:pid/pay', c.udhiyaParticipantPay);

export default router;
