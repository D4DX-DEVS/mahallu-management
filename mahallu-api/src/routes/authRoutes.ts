import express from 'express';
import { login, getCurrentUser, changePassword, registerDevice, setTwoFactor, selectAccount } from '../controllers/authController';
import { sendOTP, verifyOTP } from '../controllers/otpController';
import { authMiddleware } from '../middleware/authMiddleware';
import { verifyOtpRateLimiter } from '../middleware/rateLimit';
import { validationHandler } from '../middleware/validationHandler';
import {
  loginValidation,
  sendOTPValidation,
  verifyOTPValidation,
  changePasswordValidation,
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
router.post('/login', loginValidation, validationHandler, login);

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
router.post('/send-otp', sendOTPValidation, validationHandler, sendOTP);

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

router.put('/register-device', authMiddleware, registerDevice);

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
router.put('/two-factor', authMiddleware, setTwoFactor);

router.post('/select-account', selectAccount);

export default router;

