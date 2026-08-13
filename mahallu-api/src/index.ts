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
import registerRoutes from './routes/registerRoutes';
import surveyRoutes from './routes/surveyRoutes';
import localityFacilityRoutes from './routes/localityFacilityRoutes';
import clusterRoutes from './routes/clusterRoutes';
import clusterVisitRoutes from './routes/clusterVisitRoutes';
import welfareRoutes from './routes/welfareRoutes';
import mosqueRoutes from './routes/mosqueRoutes';
import announcementRoutes from './routes/announcementRoutes';
import zakatDistributionRoutes from './routes/zakatDistributionRoutes';
import qardRoutes from './routes/qardRoutes';
import reliefRoutes from './routes/reliefRoutes';
import madrasaRoutes from './routes/madrasaRoutes';
import attendanceRoutes from './routes/attendanceRoutes';
import examRoutes from './routes/examRoutes';
import { scholarshipsRouter, awardsRouter, supportRouter } from './routes/scholarshipRoutes';
import { employersRouter, vacanciesRouter, trainingsRouter, summaryRouter } from './routes/employmentRoutes';
import { volunteersRouter, assignmentsRouter } from './routes/volunteerRoutes';
import healthRoutes from './routes/healthRoutes';
import khutbahRoutes from './routes/khutbahRoutes';
import { counsellingRouter, disputeRouter, inheritanceRouter } from './routes/counsellingRoutes';
import marriageAssistanceRoutes from './routes/marriageAssistanceRoutes';
import { cemeteriesRouter, gravesRouter } from './routes/cemeteryRoutes';
import { booksRouter, issuesRouter } from './routes/libraryRoutes';
import developmentRoutes from './routes/developmentRoutes';
import developmentIndexRoutes from './routes/developmentIndexRoutes';
import assistantRoutes from './routes/assistantRoutes';
import { startVarisangyaReminderScheduler } from './services/varisangyaNotificationService';
import { startCommitteeTermScheduler } from './services/committeeTermService';
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
app.use('/api/registers', registerRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/locality-facilities', localityFacilityRoutes);
app.use('/api/clusters', clusterRoutes);
app.use('/api/cluster-visits', clusterVisitRoutes);
app.use('/api/welfare', welfareRoutes);
app.use('/api/mosque-profile', mosqueRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/zakat', zakatDistributionRoutes);
app.use('/api/qard', qardRoutes);
app.use('/api/relief', reliefRoutes);
app.use('/api/madrasa', madrasaRoutes);
app.use('/api/class-attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/scholarships', scholarshipsRouter);
app.use('/api/scholarship-awards', awardsRouter);
app.use('/api/academic-support', supportRouter);
app.use('/api/employers', employersRouter);
app.use('/api/job-vacancies', vacanciesRouter);
app.use('/api/skill-trainings', trainingsRouter);
app.use('/api/employment', summaryRouter);
app.use('/api/volunteers', volunteersRouter);
app.use('/api/volunteer-assignments', assignmentsRouter);
// healthRoutes defines its own '/health-resources/...' and '/medical-camps/...' paths.
app.use('/api', healthRoutes);
app.use('/api', khutbahRoutes);
// counsellingRoutes with sensitiveAccess middleware
app.use('/api', counsellingRouter);
app.use('/api', disputeRouter);
app.use('/api', inheritanceRouter);
app.use('/api/marriage-assistance', marriageAssistanceRoutes);
app.use('/api/cemeteries', cemeteriesRouter);
app.use('/api/grave-records', gravesRouter);
app.use('/api/library-books', booksRouter);
app.use('/api/book-issues', issuesRouter);
app.use('/api/development-projects', developmentRoutes);
app.use('/api/development-index', developmentIndexRoutes);
app.use('/api/assistant', assistantRoutes);

// Error handling middleware (must be last)
app.use(errorHandler);

// Connect to database
connectDatabase();

// Monthly varisangya WhatsApp reminders
startVarisangyaReminderScheduler();

// Daily committee term-expiry notifications
startCommitteeTermScheduler();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

