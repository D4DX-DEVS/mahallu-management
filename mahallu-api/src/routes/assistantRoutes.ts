import express from 'express';
import { queryAssistant } from '../controllers/assistantController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /assistant/query:
 *   post:
 *     summary: Ask the Mahallu AI assistant a question
 *     tags: [Assistant]
 *     description: |
 *       Answers questions over read-only aggregates (community registers, finance,
 *       welfare, zakat, education, employment, programs and projects). The model
 *       can only call a whitelisted set of aggregate tools, and each one runs with
 *       the caller's tenant filter applied server-side — it never reaches a
 *       collection directly. Answers come back in the language of the question
 *       (Malayalam questions get Malayalam answers).
 *       Returns 503 `not_configured` until `OPENROUTER_API_KEY` is set.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [question]
 *             properties:
 *               question:
 *                 type: string
 *                 maxLength: 1000
 *                 example: 'ഈ വർഷം എത്ര സകാത്ത് ശേഖരിച്ചു?'
 *               history:
 *                 type: array
 *                 description: Prior turns (last 10 kept)
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [user, assistant]
 *                     content:
 *                       type: string
 *     responses:
 *       200:
 *         description: Answer generated
 *       400:
 *         description: Missing or oversized question, or missing tenant
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Role not permitted
 *       503:
 *         description: AI provider not configured
 *       504:
 *         description: Tool-call limit reached without an answer
 */
router.post('/query', allowRoles(['super_admin', 'mahall']), queryAssistant);

export default router;
