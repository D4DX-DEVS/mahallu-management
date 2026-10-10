// First import on purpose: this registers a global Mongoose plugin, and a
// plugin only reaches schemas compiled after it is registered.
import './config/schemaGuards';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import * as swaggerUi from 'swagger-ui-express';
import { errorHandler } from './middleware/errorHandler';
import { sanitizeRequest } from './middleware/sanitizeRequest';
import { publicVerifyRateLimiter } from './middleware/rateLimit';
import { activityLogger } from './middleware/activityLogger';
import { swaggerSpec } from './config/swagger';
import { getIndexReadiness } from './utils/indexMonitor';
import { buildCorsOptions, parseTrustProxy, decideDocsPolicy, docsBasicAuth } from './config/security';
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
import categoryRoutes from './routes/categoryRoutes';
import pettyCashRoutes from './routes/pettyCashRoutes';
import uploadRoutes from './routes/uploadRoutes';
import reconciliationRoutes from './routes/reconciliationRoutes';
import documentRoutes from './routes/documentRoutes';
import certificateRoutes from './routes/certificateRoutes';
import changeRequestRoutes from './routes/changeRequestRoutes';
import demoRequestRoutes from './routes/demoRequestRoutes';
import exportRoutes from './routes/exportRoutes';
import { verifyCertificate } from './controllers/certificateController';
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

/** Shared flags the bootstrap flips; read by the readiness probe. */
export const appState = { shuttingDown: false };

export const createApp = (): express.Express => {
  const app = express();
  // How many reverse proxies are in front (TRUST_PROXY). Default: none, so req.ip is the socket address
  // and X-Forwarded-For cannot be used to pick the IP that rate limiting and the audit log see.
  app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

  // Middleware
  // Security headers first, so even error and 404 responses carry them.
  app.use(helmet());
  // Explicit allow-list (CORS_ORIGINS). Outside development an unset list allows no browser origin.
  app.use(cors(buildCorsOptions()));
  // An explicit cap, rather than body-parser's default, so the limit is a
  // decision recorded here: forms and bulk-import payloads fit well inside 1 MB,
  // and anything larger is answered 413 instead of being buffered.
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb', parameterLimit: 1000 }));

  /*
   * A truncated or malformed body used to answer with the parser's own words —
   * "Unexpected end of JSON input" — which reads as a bug in the app rather than
   * a bad request. Body-parser failures are caught here, before any route sees
   * them, so the caller gets one sentence it can act on.
   */
  app.use((err: any, _req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError) && 'body' in err) {
      return res.status(400).json({
        success: false,
        message: "We couldn't read that request. Please try again.",
      });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({
        success: false,
        message: 'That request is too large. Please send less data at a time.',
      });
    }
    return next(err);
  });

  // Swagger Documentation: open in development, otherwise only when explicitly enabled AND behind
  // HTTP Basic auth (see config/security.ts). It describes every endpoint, so it is not public.
  const docsPolicy = decideDocsPolicy();
  if (docsPolicy.mount) {
    const docsMiddleware: express.RequestHandler[] = [];
    if (docsPolicy.protectedByBasicAuth) {
      docsMiddleware.push(docsBasicAuth(process.env.API_DOCS_USER as string, process.env.API_DOCS_PASSWORD as string));
    }
    app.use(
      '/api-docs',
      ...docsMiddleware,
      swaggerUi.serve,
      swaggerUi.setup(swaggerSpec, {
        customCss: '.swagger-ui .topbar { display: none }',
        customSiteTitle: 'Mahallu API Documentation',
      })
    );
  } else {
    console.info(`[security] /api-docs not mounted: ${docsPolicy.reason}`);
  }

  // Mongo operator syntax out of query, body and params before any route runs.
  app.use(sanitizeRequest);

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
    // Liveness only: the process is up. Whether it should receive traffic is /api/ready.
    res.json({ status: 'ok', message: 'Mahallu API is running' });
  });

  /**
   * Readiness: 200 only when the database is connected and the process is not shutting down. A load
   * balancer or orchestrator should route traffic on this, not on /api/health.
   */
  app.get('/api/ready', (_req, res) => {
    const databaseUp = mongoose.connection.readyState === 1;
    if (!databaseUp || appState.shuttingDown) {
      return res.status(503).json({
        status: 'unavailable',
        database: databaseUp ? 'up' : 'down',
        shuttingDown: appState.shuttingDown,
      });
    }
    // Not a failure (the contract is unchanged: 200 = database up, not shutting down), but an ACCURATE
    // report of uniqueness: `indexesEnforced` is true only when every registered unique index is verified
    // to exist; blocked (duplicate data), failed or not-yet-built ones keep it false. Counts only (no names,
    // no ids); the detail goes to the startup log (see utils/indexMonitor.ts, services/indexBuild.ts).
    res.json({ status: 'ready', ...getIndexReadiness() });
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
  app.use('/api/categories', categoryRoutes);
  app.use('/api/petty-cash', pettyCashRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/reconciliation', reconciliationRoutes); // money flows needing administrator review
  app.use('/api/documents', documentRoutes);
  app.use('/api/certificates', certificateRoutes);
  app.get('/api/verify/:certificateNo', publicVerifyRateLimiter, verifyCertificate); // public certificate verification
  app.use('/api/change-requests', changeRequestRoutes);
  app.use('/api/demo-requests', demoRequestRoutes); // public landing-page form + super admin inbox
  app.use('/api/export', exportRoutes);
  app.use('/api/registers', registerRoutes);
  app.use('/api/surveys', surveyRoutes);
  app.use('/api/locality-facilities', localityFacilityRoutes);
  app.use('/api/clusters', clusterRoutes);
  app.use('/api/cluster-visits', clusterVisitRoutes);
  app.use('/api/welfare', welfareRoutes);
  app.use('/api/mosques', mosqueRoutes);
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

  // Unmatched routes: answer in JSON, never Express's default HTML page (it
  // echoes the request path back to whoever asked).
  app.use((_req, res) => {
    res.status(404).json({
      success: false,
      message: "We couldn't find what you were looking for. It may have been removed.",
    });
  });

  // Error handling middleware (must be last)
  app.use(errorHandler);

  return app;
};
