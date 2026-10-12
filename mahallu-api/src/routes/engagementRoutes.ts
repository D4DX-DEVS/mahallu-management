import express from 'express';
import campaignRoutes from './campaignRoutes';
import collectorRoutes from './collectorRoutes';
import cashClosingRoutes from './cashClosingRoutes';

/** Mounted once in index.ts: campaigns, collectors and daily cash closing. */
const router = express.Router();
router.use('/campaigns', campaignRoutes);
router.use('/collectors', collectorRoutes);
router.use('/cash-closings', cashClosingRoutes);

export default router;
