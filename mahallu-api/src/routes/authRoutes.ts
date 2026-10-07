import express from 'express';
import {
  login,
  getCurrentUser,
  changePassword,
  registerDevice,
  setTwoFactor,
  selectAccount,
  getAvailableAccounts,
  switchAccount,
  startImpersonation,
  exitImpersonation,
  logout,
} from '../controllers/authController';
import { sendOTP, verifyOTP } from '../controllers/otpController';
import { authMiddleware, superAdminOnly } from '../middleware/authMiddleware';
import { verifyOtpRateLimiter, loginRateLimiter, sendOtpRateLimiter, switchAccountRateLimiter, selectAccountRateLimiter } from '../middleware/rateLimit';
import { validationHandler } from '../middleware/validationHandler';
import {
  loginValidation,
  sendOTPValidation,
  verifyOTPValidation,
  changePasswordValidation,
  registerDeviceValidation,
  twoFactorValidation,
  selectAccountValidation,
  switchAccountValidation,
  startImpersonationValidation,
} from '../validations/authValidation';

const router = express.Router();

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login with phone and password
 *     tags: [Authentication]
 *     description: Authenticate user with phone number and password. Returns JWT token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - password
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9]{10}$'
 *                 example: '9999999999'
 *                 description: 10-digit phone number
 *               password:
 *                 type: string
 *                 example: 'admin123'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid credentials
 *       403:
 *         description: Account is inactive
 */
router.post('/login', loginValidation, validationHandler, loginRateLimiter, login);

/**
 * @swagger
 * /auth/send-otp:
 *   post:
 *     summary: Send OTP to phone number
 *     tags: [Authentication]
 *     description: Send a 6-digit OTP to the user's phone number for login
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9]{10}$'
 *                 example: '9999999999'
 *     responses:
 *       200:
 *         description: OTP sent successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 otp:
 *                   type: string
 *                   description: OTP code (only in development)
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       404:
 *         description: User not found
 *       429:
 *         description: Too many OTP requests
 */
router.post('/send-otp', sendOTPValidation, validationHandler, sendOtpRateLimiter, sendOTP);

/**
 * @swagger
 * /auth/verify-otp:
 *   post:
 *     summary: Verify OTP and login
 *     tags: [Authentication]
 *     description: Verify OTP code and authenticate user. Returns JWT token.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - otp
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^[0-9]{10}$'
 *                 example: '9999999999'
 *               otp:
 *                 type: string
 *                 pattern: '^[0-9]{6}$'
 *                 example: '123456'
 *     responses:
 *       200:
 *         description: OTP verified and login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Invalid or expired OTP
 *       403:
 *         description: Account is inactive
 *       429:
 *         description: Too many failed attempts
 */
router.post('/verify-otp', verifyOTPValidation, validationHandler, verifyOtpRateLimiter, verifyOTP);

/**
 * @swagger
 * /auth/select-account:
 *   post:
 *     summary: Select account role after multi-role OTP login
 *     tags: [Authentication]
 *     description: |
 *       When a phone number is linked to multiple roles in the same mahallu,
 *       `verify-otp` returns `requiresRoleSelection: true` with a short-lived
 *       `preAuthToken` and an `accounts` list. The client must call this endpoint
 *       with the chosen `userId` and the `preAuthToken` to receive a full session JWT.
 *
 *       The `preAuthToken` expires in **5 minutes**.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - preAuthToken
 *               - userId
 *             properties:
 *               preAuthToken:
 *                 type: string
 *                 description: Short-lived JWT returned by verify-otp when multiple accounts exist
 *                 example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *               userId:
 *                 type: string
 *                 description: The _id of the user account the person wants to log in as
 *                 example: '6997f318f8c021897f8de3ca'
 *     responses:
 *       200:
 *         description: Account selected, session JWT issued
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     token:
 *                       type: string
 *                       description: 7-day session JWT
 *                       example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
 *       400:
 *         description: preAuthToken and userId are required
 *       401:
 *         description: Invalid or expired preAuthToken, or userId does not match the token phone
 *       403:
 *         description: Selected account is inactive
 *       404:
 *         description: User account not found
 */

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get current authenticated user
 *     tags: [Authentication]
 *     description: Get details of the currently authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', authMiddleware, getCurrentUser);

/**
 * @swagger
 * /auth/change-password:
 *   post:
 *     summary: Change user password
 *     tags: [Authentication]
 *     description: Change password for the authenticated user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: 'oldpassword123'
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 example: 'newpassword123'
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         description: Current password is incorrect
 */
router.post('/change-password', authMiddleware, changePasswordValidation, validationHandler, changePassword);

router.put('/register-device', authMiddleware, registerDeviceValidation, validationHandler, registerDevice);

/**
 * @swagger
 * /auth/two-factor:
 *   put:
 *     summary: Turn two-factor (OTP) login on or off for your own account
 *     tags: [Auth]
 *     description: |
 *       When enabled, `POST /auth/login` stops after the password check and
 *       returns `{ requiresOtp: true }` — the client must then call
 *       `/auth/send-otp` and `/auth/verify-otp` to receive a token.
 *       **Access:** any authenticated user, own account only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [enabled]
 *             properties:
 *               enabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Updated
 *       400:
 *         description: enabled must be a boolean
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/two-factor', authMiddleware, twoFactorValidation, validationHandler, setTwoFactor);

router.post('/select-account', selectAccountValidation, validationHandler, selectAccountRateLimiter, selectAccount);

/**
 * @swagger
 * /auth/available-accounts:
 *   get:
 *     summary: List the authenticated person's other active accounts
 *     tags: [Auth]
 *     description: |
 *       Identity comes entirely from the request's own JWT. Finds every active
 *       User account sharing the authenticated user's own phone number, using
 *       the same phone-variant matching login/verifyOTP/selectAccount already
 *       use. Never accepts a phone number, role, tenantId or instituteId from
 *       the client. The caller's own current account is included, flagged
 *       with `isCurrent: true`.
 *       **Access:** any authenticated user, own accounts only
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Available accounts
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.get('/available-accounts', authMiddleware, getAvailableAccounts);

/**
 * @swagger
 * /auth/logout:
 *   post:
 *     summary: Sign out of every session of this account
 *     tags: [Authentication]
 *     description: Revokes all existing tokens of the signed-in account (all devices).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Signed out
 */
router.post('/logout', authMiddleware, logout);

/**
 * @swagger
 * /auth/switch-account:
 *   post:
 *     summary: Switch the current session to another of your own accounts
 *     tags: [Auth]
 *     description: |
 *       Not a general role-change endpoint. The request may only name WHICH
 *       account (`targetUserId`) — role, tenantId and instituteId are never
 *       read from the body. The target is authorized only when it is active
 *       and shares the CURRENT authenticated user's own phone number, checked
 *       with the same logic `selectAccount` uses. A Super Admin can only
 *       switch into an account that already exists for their own phone, never
 *       into an arbitrary Mahallu's admin context.
 *       **Access:** any authenticated user, own accounts only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetUserId]
 *             properties:
 *               targetUserId:
 *                 type: string
 *     responses:
 *       200:
 *         description: New session for the target account
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Target account is inactive or does not belong to you
 *       404:
 *         description: Target account not found
 */
router.post(
  '/switch-account',
  authMiddleware,
  switchAccountRateLimiter,
  switchAccountValidation,
  validationHandler,
  switchAccount
);

/**
 * @swagger
 * /auth/impersonate:
 *   post:
 *     summary: "Super Admin only — temporarily view/act as another role's context"
 *     tags: [Auth]
 *     description: |
 *       Not a general role switch. Requires `superAdminOnly` (`req.isSuperAdmin`,
 *       which is false during an existing impersonation session, so this can
 *       never chain a second one on top of the first). The backend
 *       independently validates the tenant is active and, when applicable,
 *       that the institute/member actually belongs to that tenant — a
 *       mismatched combination is always rejected, never trusted from the
 *       client. Mints a clearly-marked impersonation session that retains the
 *       real Super Admin's own id for traceability and exit.
 *       **Access:** Super Admin only
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [targetRole, tenantId]
 *             properties:
 *               targetRole:
 *                 type: string
 *                 enum: [mahall, survey, institute, member]
 *               tenantId:
 *                 type: string
 *               instituteId:
 *                 type: string
 *                 description: Required when targetRole is "institute"
 *               memberId:
 *                 type: string
 *                 description: Required when targetRole is "member"
 *     responses:
 *       200:
 *         description: New impersonation session
 *       400:
 *         description: Invalid role/tenant/institute/member combination
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Caller is not a Super Admin
 */
router.post(
  '/impersonate',
  authMiddleware,
  superAdminOnly,
  switchAccountRateLimiter,
  startImpersonationValidation,
  validationHandler,
  startImpersonation
);

/**
 * @swagger
 * /auth/exit-impersonation:
 *   post:
 *     summary: Return to the real Super Admin session
 *     tags: [Auth]
 *     description: |
 *       Only valid while the current session IS an impersonation session
 *       (`req.impersonation`, set by authMiddleware from the token's own
 *       `imp` claim). Re-verifies the original account is still an active
 *       Super Admin before restoring it, then mints an ordinary, unmarked
 *       session token — identical in shape to a fresh login.
 *       **Access:** any account currently impersonating another role
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Restored Super Admin session
 *       400:
 *         description: Not currently impersonating
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: Original account could not be restored
 */
router.post('/exit-impersonation', authMiddleware, exitImpersonation);

export default router;

