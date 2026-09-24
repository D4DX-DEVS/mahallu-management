import express from 'express';
import {
  getAllAnnouncements,
  getAnnouncementById,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  sendAnnouncement,
} from '../controllers/announcementController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createAnnouncementValidation,
  updateAnnouncementValidation,
} from '../validations/moduleValidation';

const router = express.Router();

router.use(authMiddleware);
router.use(tenantMiddleware);
router.use(tenantFilter);

/**
 * @swagger
 * /announcements:
 *   get:
 *     summary: List announcements
 *     tags: [Communication]
 *     description: |
 *       Paginated broadcast history.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent]
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [announcement, program, emergency, welfare, education, news]
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *     responses:
 *       200:
 *         description: Announcement list
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/', listQuery(), validationHandler, getAllAnnouncements);

/**
 * @swagger
 * /announcements/{id}:
 *   get:
 *     summary: Get an announcement
 *     tags: [Communication]
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
 *         description: Announcement with delivery results
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/:id', idParam('id', 'announcement'), validationHandler, getAnnouncementById);

/**
 * @swagger
 * /announcements:
 *   post:
 *     summary: Create a draft announcement
 *     tags: [Communication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, body]
 *             properties:
 *               title:
 *                 type: string
 *               titleMl:
 *                 type: string
 *               body:
 *                 type: string
 *               category:
 *                 type: string
 *                 enum: [announcement, program, emergency, welfare, education, news]
 *               audience:
 *                 type: string
 *                 enum: [all, families, committee, cluster, custom]
 *               audienceRefIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               channels:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [push, whatsapp, sms, email]
 *     responses:
 *       201:
 *         description: Draft created
 *       403:
 *         description: Role not allowed
 */
router.post('/', createAnnouncementValidation, validationHandler, allowRoles(['mahall']), createAnnouncement);

/**
 * @swagger
 * /announcements/{id}/send:
 *   post:
 *     summary: Send an announcement on its selected channels
 *     tags: [Communication]
 *     description: |
 *       push and whatsapp deliver; sms and email report `not_configured`.
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
 *         description: Announcement marked sent with per-channel results
 *       400:
 *         description: Already sent
 */
router.post('/:id/send', idParam('id', 'announcement'), validationHandler, allowRoles(['mahall']), sendAnnouncement);

/**
 * @swagger
 * /announcements/{id}:
 *   put:
 *     summary: Update a draft announcement
 *     tags: [Communication]
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
 *         description: Updated
 *       400:
 *         description: Sent announcements cannot be edited
 */
router.put('/:id', updateAnnouncementValidation, validationHandler, allowRoles(['mahall']), updateAnnouncement);

/**
 * @swagger
 * /announcements/{id}:
 *   delete:
 *     summary: Delete an announcement
 *     tags: [Communication]
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
 */
router.delete('/:id', idParam('id', 'announcement'), validationHandler, allowRoles(['mahall']), deleteAnnouncement);

export default router;
