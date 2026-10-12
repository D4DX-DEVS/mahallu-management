import { Request, Response, NextFunction } from 'express';
import { ActivityLog } from '../models/Social';
import { AuthRequest } from './authMiddleware';
import mongoose from 'mongoose';

// Helper function to extract entity type from route path
const getEntityTypeFromPath = (path: string): string => {
  // Remove /api prefix and get the first segment
  const segments = path.replace(/^\/api\//, '').split('/');
  const entityType = segments[0] || 'unknown';
  
  // Map common route names to entity types
  const entityTypeMap: Record<string, string> = {
    'auth': 'authentication',
    'users': 'user',
    'families': 'family',
    'members': 'member',
    'institutes': 'institute',
    'programs': 'program',
    'madrasa': 'madrasa',
    'committees': 'committee',
    'meetings': 'meeting',
    'registrations': 'registration',
    'collectibles': 'collectible',
    'social': 'social',
    'reports': 'report',
    'notifications': 'notification',
    'master-accounts': 'masterAccount',
    'tenants': 'tenant',
    'dashboard': 'dashboard',
  };

  return entityTypeMap[entityType] || entityType;
};

// Helper function to extract entity ID from request
const getEntityId = (req: Request): mongoose.Types.ObjectId | undefined => {
  // Try to get from params first (for GET, PUT, DELETE)
  if (req.params.id) {
    try {
      return new mongoose.Types.ObjectId(req.params.id);
    } catch {
      return undefined;
    }
  }

  // Try to get from body (for POST, PUT)
  if (req.body?._id) {
    try {
      return new mongoose.Types.ObjectId(req.body._id);
    } catch {
      return undefined;
    }
  }

  if (req.body?.id) {
    try {
      return new mongoose.Types.ObjectId(req.body.id);
    } catch {
      return undefined;
    }
  }

  return undefined;
};

// Helper function to get action description from HTTP method
const getActionFromMethod = (method: string, entityType: string): string => {
  const methodMap: Record<string, string> = {
    'GET': 'view',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete',
  };

  const action = methodMap[method] || method.toLowerCase();
  return `${action} ${entityType}`;
};

// Helper function to sanitize sensitive data from request body
const sanitizeRequestBody = (body: any): any => {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'currentPassword', 'newPassword', 'otp', 'token', 'preAuthToken', 'secret', 'apiKey', 'authorization'];
  const sanitized = { ...body };

  for (const field of sensitiveFields) {
    if (sanitized[field]) {
      sanitized[field] = '***REDACTED***';
    }
  }

  return sanitized;
};

// Helper function to get client IP address
const getClientIp = (req: Request): string => {
  return (
    (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
    (req.headers['x-real-ip'] as string) ||
    req.socket.remoteAddress ||
    'unknown'
  );
};

// Activity logging middleware
export const activityLogger = async (
  req: AuthRequest | Request,
  res: Response,
  next: NextFunction
) => {
  // Skip logging for health checks and certain endpoints
  const skipPaths = ['/api/health', '/api/auth/login', '/api/auth/verify-otp'];
  if (skipPaths.some(path => req.path.startsWith(path))) {
    return next();
  }

  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;
  // res.json() calls res.send() internally; make sure a response is logged only once.
  let logged = false;

  // Capture request details (available at middleware execution time)
  const requestBody = sanitizeRequestBody(req.body);
  const entityType = getEntityTypeFromPath(req.path);
  const entityId = getEntityId(req);
  const action = getActionFromMethod(req.method, entityType);
  const ipAddress = getClientIp(req);
  const userAgent = req.headers['user-agent'] || 'unknown';

  // Helper function to safely convert tenantId to ObjectId and get user info
  const getUserInfo = (request: Request): { userId?: mongoose.Types.ObjectId; tenantId?: mongoose.Types.ObjectId } => {
    const authReq = request as AuthRequest;
    const userId = authReq.user?._id;
    
    let tenantId: mongoose.Types.ObjectId | undefined;
    if (authReq.tenantId) {
      // tenantId is always a string in AuthRequest, so we need to convert it
      try {
        tenantId = new mongoose.Types.ObjectId(authReq.tenantId);
      } catch {
        // Invalid ObjectId format, skip
      }
    }

    return { userId, tenantId };
  };

  // Override res.json to capture response (runs after authMiddleware)
  res.json = function (body: any) {
    logged = true;
    const statusCode = res.statusCode;
    const responseTime = Date.now() - startTime;

    // Get user and tenant info (available now that authMiddleware has run)
    const { userId, tenantId } = getUserInfo(req);

    // Create activity log entry
    const logData: any = {
      action,
      entityType,
      httpMethod: req.method,
      endpoint: req.path,
      ipAddress,
      userAgent,
      statusCode,
      requestBody: requestBody && typeof requestBody === 'object' && Object.keys(requestBody).length > 0 ? requestBody : undefined,
      details: {
        responseTime: `${responseTime}ms`,
        query: req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0 ? req.query : undefined,
      },
    };

    if (tenantId) {
      logData.tenantId = tenantId;
    }

    if (userId) {
      logData.userId = userId;
    }

    if (entityId) {
      logData.entityId = entityId;
    }

    // Add error message if status code indicates error
    if (statusCode >= 400) {
      logData.errorMessage = body?.message || `HTTP ${statusCode}`;
      // Don't log full error response for security
      logData.responseData = { success: false, message: body?.message };
    } else if (statusCode < 400 && body) {
      // Only log success response structure, not full data
      logData.responseData = {
        success: body.success !== undefined ? body.success : true,
        dataCount: Array.isArray(body.data) ? body.data.length : body.data ? 1 : 0,
      };
    }

    // Save log asynchronously (don't block response)
    // Only log if we have at least tenantId or it's a system-level action
    if (logData.tenantId || logData.userId) {
      ActivityLog.create(logData).catch((err) => {
        console.error('Failed to create activity log:', err);
      });
    }

    // Call original json method
    return originalJson.call(this, body);
  };

  // Override res.send to capture response (for non-JSON responses)
  res.send = function (body: any) {
    if (logged) {
      return originalSend.call(this, body);
    }
    const statusCode = res.statusCode;
    const responseTime = Date.now() - startTime;

    // Get user and tenant info (available now that authMiddleware has run)
    const { userId, tenantId } = getUserInfo(req);

    // Create activity log entry
    const logData: any = {
      action,
      entityType,
      httpMethod: req.method,
      endpoint: req.path,
      ipAddress,
      userAgent,
      statusCode,
      requestBody: requestBody && typeof requestBody === 'object' && Object.keys(requestBody).length > 0 ? requestBody : undefined,
      details: {
        responseTime: `${responseTime}ms`,
        query: req.query && typeof req.query === 'object' && Object.keys(req.query).length > 0 ? req.query : undefined,
      },
    };

    if (tenantId) {
      logData.tenantId = tenantId;
    }

    if (userId) {
      logData.userId = userId;
    }

    if (entityId) {
      logData.entityId = entityId;
    }

    // Add error message if status code indicates error
    if (statusCode >= 400) {
      logData.errorMessage = `HTTP ${statusCode}`;
    }

    // Save log asynchronously (don't block response)
    // Only log if we have at least tenantId or it's a system-level action
    if (logData.tenantId || logData.userId) {
      ActivityLog.create(logData).catch((err) => {
        console.error('Failed to create activity log:', err);
      });
    }

    // Call original send method
    return originalSend.call(this, body);
  };

  next();
};

