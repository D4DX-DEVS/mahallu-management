import axios, { AxiosError, AxiosResponse } from 'axios';
import { maskPhone } from '../utils/phone';

// Create dedicated axios instance for DXING with interceptors
const dxingAxios = axios.create();

// Request interceptor - logs all outbound requests
dxingAxios.interceptors.request.use(
  (config) => {
    console.info('[DXING-INTERCEPTOR] 📤 HTTP Request initiated:', {
      url: config.url,
      method: config.method?.toUpperCase(),
      baseURL: config.baseURL,
      timeout: config.timeout,
      dataSize: config.data ? JSON.stringify(config.data).length : 0,
      timestamp: new Date().toISOString(),
    });
    return config;
  },
  (error) => {
    console.error('[DXING-INTERCEPTOR] Request setup failed:', error?.message);
    return Promise.reject(error);
  }
);

// Response interceptor - logs all responses
dxingAxios.interceptors.response.use(
  (response: AxiosResponse) => {
    console.info('[DXING-INTERCEPTOR] 📥 HTTP Response received:', {
      status: response.status,
      statusText: response.statusText,
      url: response.config.url,
      // The body is never logged: for an OTP send it contains the one-time code.
      timestamp: new Date().toISOString(),
    });
    return response;
  },
  (error: AxiosError) => {
    console.error('[DXING-INTERCEPTOR] ❌ HTTP Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      statusText: error.response?.statusText,
      url: error.config?.url,
      timestamp: new Date().toISOString(),
    });
    return Promise.reject(error);
  }
);

interface NormalizedPhone {
  normalized: string; // e.g., 919999999999
  local: string; // 10-digit local number
}

/**
 * Normalize Indian phone numbers:
 * - strips non-digits
 * - removes leading + or 91
 * - ensures exactly 10 local digits
 * - returns normalized with 91 prefix
 */
export const normalizeIndianPhone = (input: string): NormalizedPhone => {
  const digits = (input || '').replace(/\D/g, '');

  let local = digits;
  if (local.startsWith('91') && local.length === 12) {
    local = local.slice(2);
  }

  if (local.length !== 10) {
    throw new Error('Invalid Indian phone number. Provide a 10-digit number with optional +91.');
  }

  return {
    normalized: `91${local}`,
    local,
  };
};

const DXING_URL = 'https://app.dxing.in/api/send/otp'; // Corrected endpoint for OTP
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1; // total attempts = 1 + MAX_RETRIES
const DIAG = process.env.DXING_DIAG === '1';

/**
 * Validate and sanitize environment credentials
 * Note: DXING uses "secret" and "account" (not "key" and "instance_id")
 */
const validateCredentials = () => {
  const secret = process.env.DXING_SECRET?.trim();
  const account = process.env.DXING_ACCOUNT?.trim();

  if (!secret || !account) {
    throw new Error('DXing configuration missing. Please set DXING_SECRET and DXING_ACCOUNT.');
  }

  // Validate format (basic checks)
  if (secret.length < 10) {
    throw new Error('DXING_SECRET appears to be too short. Check your .env file.');
  }

  if (account.length < 5) {
    throw new Error('DXING_ACCOUNT appears to be too short. Check your .env file.');
  }

  return { secret, account };
};

export const sendWhatsAppMessage = async (phone: string, message: string) => {
  // Validate credentials first
  const { secret, account } = validateCredentials();

  // Log credential check (safely)
  const { normalized } = normalizeIndianPhone(phone);

  let lastError: any;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      // DXING OTP API expects these exact parameter names
      const payload = {
        secret: secret,
        account: account,
        phone: normalized,
        type: 'whatsapp',  // Must be 'whatsapp' not 'text'
        message,           // Should contain {{otp}} placeholder
        priority: 1,
      };

      const axiosConfig = {
        timeout: DEFAULT_TIMEOUT_MS,
        headers: { 'Content-Type': 'application/json' },
      };

      // ALWAYS log the outbound request details (safe version)
      console.info('[DXING] 🚀 Outbound Request:', {
        url: DXING_URL,
        method: 'POST',
        to: maskPhone(normalized),
        messageLength: message.length,
        payloadKeys: Object.keys(payload),
        timestamp: new Date().toISOString(),
        attempt: attempt + 1,
      });

      if (DIAG) {
        // Diagnostics are limited to shape, never values: the payload holds the API secret and the
        // response holds the one-time code.
        console.info('[DXING] Payload shape (DIAG mode):', { keys: Object.keys(payload), timeout: axiosConfig.timeout });
      }

      const response = await dxingAxios.post(
        DXING_URL,
        payload,
        axiosConfig
      );

      // ALWAYS log response summary
      console.info('[DXING] ✅ Response Received:', {
        httpStatus: response.status,
        statusText: response.statusText,
        hasData: !!response.data,
        dataType: typeof response.data,
        dataKeys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        timestamp: new Date().toISOString(),
      });

      if (DIAG) {
        console.info('[DXING] Response shape (DIAG mode):', {
          keys: response.data && typeof response.data === 'object' ? Object.keys(response.data) : [],
        });
      }

      // Strict response validation
      if (!response.data || typeof response.data !== 'object') {
        const error = new Error('[DXING] Invalid response format - expected JSON object');
        console.error('[DXING] Response validation failed:', { receivedType: typeof response.data });
        throw error;
      }

      // Check DXING OTP API response format
      // Expected: { status: 200, message: "...", data: { phone, message, messageId, otp } }
      if ('status' in response.data) {
        if (response.data.status !== 200 && response.data.status !== true) {
          console.error('[DXING] DXING API returned an error:', {
            dxingStatus: response.data.status,
            message: response.data.message,
          });
          throw new Error(`DXing API Error: ${response.data.message || 'request rejected'}`);
        }
        console.info('[DXING] ✅ DXING confirmed success:', {
          status: response.data.status,
          message: response.data.message,
          messageId: response.data.data?.messageId,
        });
      } else {
        // No status field - might be unexpected provider
        console.warn('[DXING] Response missing "status" field:', {
          keys: Object.keys(response.data),
          possibleIssue: 'Unexpected response format - verify DXING API documentation',
        });
      }

      console.info(`[DXING] Message sent to ${maskPhone(normalized)}`);
      return response.data;
    } catch (error: any) {
      lastError = error;
      const status = error?.response?.status;
      const isNetworkError = error.code === 'ECONNABORTED' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT';

      console.error('[DXING] ❌ Request failed:', {
        attempt: attempt + 1,
        errorType: error.constructor.name,
        errorCode: error.code,
        errorMessage: error.message,
        httpStatus: status,
        isNetworkError,
        url: DXING_URL,
        timestamp: new Date().toISOString(),
      });

      if (isNetworkError) {
        console.error('[DXING] 🌐 Network-level error detected:', {
          code: error.code,
          message: error.message,
          possibleCauses: ['DNS resolution failure', 'Network timeout', 'Firewall blocking', 'Proxy issue'],
        });
      }

      // Full error dump in DIAG mode
      if (DIAG) {
        // error.config would include the request body (API secret + message): stack only.
        console.error('[DXING] Error stack (DIAG mode):', { stack: error.stack });
      }

      const retriable = status && status >= 500;
      if (!retriable || attempt === MAX_RETRIES) {
        break;
      }

      console.info(`[DXING] 🔄 Retrying... (attempt ${attempt + 2}/${MAX_RETRIES + 1})`);
    }
  }

  throw lastError || new Error('Failed to send WhatsApp message via DXing after all retries.');
};


