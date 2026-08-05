import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as swaggerUi from 'swagger-ui-express';
import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { activityLogger } from './middleware/activityLogger';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/authRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import userRoutes from './routes/userRoutes';
import familyRoutes from './routes/familyRoutes';
import memberRoutes from './routes/memberRoutes';
import instituteRoutes from './routes/instituteRoutes';
import programRoutes from './routes/programRoutes';
import employeeRoutes from './routes/employeeRoutes';
import salaryRoutes from './routes/salaryRoutes';
import accountingReportRoutes from './routes/accountingReportRoutes';
import committeeRoutes from './routes/committeeRoutes';
import meetingRoutes from './routes/meetingRoutes';
import registrationRoutes from './routes/registrationRoutes';
import collectibleRoutes from './routes/collectibleRoutes';
import socialRoutes from './routes/socialRoutes';
import reportRoutes from './routes/reportRoutes';
import notificationRoutes from './routes/notificationRoutes';
import masterAccountRoutes from './routes/masterAccountRoutes';
import tenantRoutes from './routes/tenantRoutes';
import memberUserRoutes from './routes/memberUserRoutes';
import assetRoutes from './routes/assetRoutes';
import pettyCashRoutes from './routes/pettyCashRoutes';
import uploadRoutes from './routes/uploadRoutes';
import { startVarisangyaReminderScheduler } from './services/varisangyaNotificationService';
import path from 'path';

// Load environment variables from the correct path
// When running with ts-node, __dirname is src/, so go up one level
// When running compiled code, __dirname is dist/, so go up two levels
const envPath = path.resolve(__dirname, '../.env');
dotenv.config({ path: envPath });

// Verify environment variables are loaded
const requiredEnv = ['MONGODB_URI', 'JWT_SECRET', 'NODE_ENV'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error('❌ ERROR: Required environment variables are missing:', missingEnv.join(', '));
  console.error('Checked path:', envPath);
  console.error('Current __dirname:', __dirname);
  process.exit(1);
}

// Log environment presence (without secrets)
console.info('🔍 Environment check:');
console.info('NODE_ENV:', process.env.NODE_ENV);
console.info('MONGODB_URI exists:', !!process.env.MONGODB_URI);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Swagger Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Mahallu API Documentation',
}));

// Activity logging middleware (must be after body parsers, before routes)
app.use(activityLogger);

// Routes
/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Public]
 *     description: |
 *       Check if the API is running.
 *       **Public access - no authentication required**
 *     security: []
 *     responses:
 *       200:
 *         description: API is running
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                   description: API status
 *                 message:
 *                   type: string
 *                   example: Mahallu API is running
 *                   description: Status message
 *             example:
 *               status: ok
 *               message: Mahallu API is running
 */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Mahallu API is running' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tenants', tenantRoutes); // Super admin only
app.use('/api/users', userRoutes);
app.use('/api/families', familyRoutes);
app.use('/api/members', memberRoutes);
app.use('/api/institutes', instituteRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/salary-payments', salaryRoutes);
app.use('/api/accounting-reports', accountingReportRoutes);
app.use('/api/committees', committeeRoutes);
app.use('/api/meetings', meetingRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/collectibles', collectibleRoutes);
app.use('/api/social', socialRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/master-accounts', masterAccountRoutes);
app.use('/api/member-user', memberUserRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/petty-cash', pettyCashRoutes);
app.use('/api/upload', uploadRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Connect to database
connectDatabase();

// Monthly varisangya WhatsApp reminders
startVarisangyaReminderScheduler();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

