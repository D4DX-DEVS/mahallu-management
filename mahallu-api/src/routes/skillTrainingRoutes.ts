import express from 'express';
import {
  getAllTrainings,
  getTrainingById,
  createTraining,
  updateTraining,
  deleteTraining,
  addParticipant,
  updateParticipant,
  removeParticipant,
} from '../controllers/employmentController';
import { authMiddleware, allowRoles } from '../middleware/authMiddleware';
import { tenantMiddleware, tenantFilter } from '../middleware/tenantMiddleware';
import { validationHandler } from '../middleware/validationHandler';
import { idParam, listQuery } from '../validations/common';
import {
  createTrainingValidation,
  updateTrainingValidation,
} from '../validations/moduleValidation';

const trainingsRouter = express.Router();
trainingsRouter.use(authMiddleware);
trainingsRouter.use(tenantMiddleware);
trainingsRouter.use(tenantFilter);

// ============= SKILL TRAINING ENDPOINTS =============

/**
 * @swagger
 * /api/skill-trainings:
 *   get:
 *     summary: List skill trainings
 *     tags: [Employment]
 *     description: |
 *       Paginated list of skill trainings.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by training name
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [planned, ongoing, completed, cancelled]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Paginated trainings list
 *   post:
 *     summary: Create skill training
 *     tags: [Employment]
 *     description: |
 *       Create a new skill training program.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, startDate, endDate]
 *             properties:
 *               name:
 *                 type: string
 *               trainerName:
 *                 type: string
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               participants:
 *                 type: array
 *                 items:
 *                   type: object
 *               status:
 *                 type: string
 *                 enum: [planned, ongoing, completed, cancelled]
 *     responses:
 *       201:
 *         description: Training created
 */
trainingsRouter.get('/', listQuery(), validationHandler, getAllTrainings);
trainingsRouter.post('/', createTrainingValidation, validationHandler, allowRoles(['mahall']), createTraining);

/**
 * @swagger
 * /api/skill-trainings/{id}:
 *   get:
 *     summary: Get skill training by ID
 *     tags: [Employment]
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
 *         description: Training details
 *       404:
 *         description: Training not found
 *   put:
 *     summary: Update training
 *     tags: [Employment]
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
 *     responses:
 *       200:
 *         description: Training updated
 *   delete:
 *     summary: Delete training
 *     tags: [Employment]
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
 *         description: Training deleted
 */
trainingsRouter.get('/:id', idParam('id', 'training'), validationHandler, getTrainingById);
trainingsRouter.put('/:id', updateTrainingValidation, validationHandler, allowRoles(['mahall']), updateTraining);
trainingsRouter.delete('/:id', idParam('id', 'training'), validationHandler, allowRoles(['mahall']), deleteTraining);

// ============= SKILL TRAINING PARTICIPANTS =============

/**
 * @swagger
 * /api/skill-trainings/{id}/participants:
 *   post:
 *     summary: Add participant to training
 *     tags: [Employment]
 *     description: |
 *       Add a member as a participant to a skill training.
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
 *             required: [memberId]
 *             properties:
 *               memberId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Participant added
 */
trainingsRouter.post('/:id/participants', idParam('id', 'training'), validationHandler, allowRoles(['mahall']), addParticipant);

/**
 * @swagger
 * /api/skill-trainings/{id}/participants/{memberId}:
 *   put:
 *     summary: Update participant details
 *     tags: [Employment]
 *     description: |
 *       Update certificate or employment outcome for a participant.
 *       **Access:** Super Admin, Mahall Admin
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
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
 *               certificateIssued:
 *                 type: boolean
 *               employmentOutcome:
 *                 type: string
 *                 enum: [none, employed, self_employed]
 *     responses:
 *       200:
 *         description: Participant updated
 *   delete:
 *     summary: Remove participant from training
 *     tags: [Employment]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Participant removed
 */
trainingsRouter.put('/:id/participants/:memberId', idParam('id', 'training'), idParam('memberId', 'member'), validationHandler, allowRoles(['mahall']), updateParticipant);
trainingsRouter.delete('/:id/participants/:memberId', idParam('id', 'training'), idParam('memberId', 'member'), validationHandler, allowRoles(['mahall']), removeParticipant);

export { trainingsRouter };
