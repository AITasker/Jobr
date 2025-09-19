// Priority 4: Error Response Standardization
export interface StandardError {
  message: string;
  code: string;
  details?: any;
  timestamp?: string;
}

export function createErrorResponse(
  message: string, 
  code: string, 
  details?: any
): StandardError {
  return {
    message,
    code,
    details,
    timestamp: new Date().toISOString()
  };
}

// Error codes constants
export const ERROR_CODES = {
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_PARAMETER: 'INVALID_PARAMETER',
  
  // Not found errors
  NOT_FOUND: 'NOT_FOUND',
  JOB_NOT_FOUND: 'JOB_NOT_FOUND',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  APPLICATION_NOT_FOUND: 'APPLICATION_NOT_FOUND',
  CV_NOT_FOUND: 'CV_NOT_FOUND',
  
  // Authorization errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  
  // Duplicate resource errors
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  DUPLICATE_APPLICATION: 'DUPLICATE_APPLICATION',
  EMAIL_EXISTS: 'EMAIL_EXISTS',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Payment errors
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_CREATE_FAILED: 'PAYMENT_CREATE_FAILED',
  INVALID_PLAN: 'INVALID_PLAN',
  
  // Subscription errors
  SUBSCRIPTION_LIMIT_REACHED: 'SUBSCRIPTION_LIMIT_REACHED',
  CV_REQUIRED: 'CV_REQUIRED',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  
  // File upload errors
  INVALID_FILE_TYPE: 'INVALID_FILE_TYPE',
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  
  // Authentication errors
  LOGIN_FAILED: 'LOGIN_FAILED',
  REGISTRATION_FAILED: 'REGISTRATION_FAILED',
  EMAIL_REQUIRED: 'EMAIL_REQUIRED',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  PHONE_VERIFICATION_FAILED: 'PHONE_VERIFICATION_FAILED',
  OTP_EXPIRED: 'OTP_EXPIRED',
  OTP_INVALID: 'OTP_INVALID',
  TOO_MANY_ATTEMPTS: 'TOO_MANY_ATTEMPTS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Integration errors
  INTEGRATION_UNAVAILABLE: 'INTEGRATION_UNAVAILABLE',
  GOOGLE_OAUTH_UNAVAILABLE: 'GOOGLE_OAUTH_UNAVAILABLE',
  STRIPE_NOT_CONFIGURED: 'STRIPE_NOT_CONFIGURED',
  SENDGRID_NOT_CONFIGURED: 'SENDGRID_NOT_CONFIGURED'
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// Helper function to sanitize errors for production
export const sanitizeError = (error: any, isProduction: boolean = process.env.NODE_ENV === 'production') => {
  if (isProduction && error.code === ERROR_CODES.INTERNAL_ERROR) {
    // Don't expose internal error details in production
    return createErrorResponse(
      "An internal server error occurred",
      ERROR_CODES.INTERNAL_ERROR
    );
  }
  return error;
};

// Authentication-specific error responses
export const AUTH_ERRORS = {
  INVALID_CREDENTIALS: createErrorResponse(
    "Invalid email or password",
    ERROR_CODES.INVALID_CREDENTIALS
  ),
  ACCOUNT_LOCKED: createErrorResponse(
    "Account temporarily locked due to too many failed login attempts. Please try again later.",
    ERROR_CODES.ACCOUNT_LOCKED
  ),
  TOKEN_EXPIRED: createErrorResponse(
    "Your session has expired. Please log in again.",
    ERROR_CODES.TOKEN_EXPIRED
  ),
  SESSION_EXPIRED: createErrorResponse(
    "Your session has expired. Please log in again.",
    ERROR_CODES.SESSION_EXPIRED
  ),
  TOO_MANY_ATTEMPTS: createErrorResponse(
    "Too many authentication attempts. Please try again later.",
    ERROR_CODES.TOO_MANY_ATTEMPTS
  )
};

// Enhanced logging for authentication events
export interface AuthLogData {
  userId?: string;
  email?: string;
  method: 'email' | 'google' | 'phone' | 'replit';
  action: 'login' | 'register' | 'logout' | 'refresh' | 'failed_attempt';
  ip?: string;
  userAgent?: string;
  success: boolean;
  errorCode?: string;
  metadata?: any;
}

export class AuthLogger {
  /**
   * Log authentication events with structured data
   */
  static logAuthEvent(data: AuthLogData): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: data.success ? 'info' : 'warn',
      category: 'authentication',
      ...data
    };

    if (data.success) {
      console.log('[AUTH_SUCCESS]', JSON.stringify(logEntry));
    } else {
      console.warn('[AUTH_FAILURE]', JSON.stringify(logEntry));
    }

    // In production, this could be sent to external logging service
    // e.g., DataDog, Splunk, CloudWatch, etc.
  }

  /**
   * Log security events that require attention
   */
  static logSecurityEvent(event: string, data: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      category: 'security',
      event,
      ...data
    };

    console.error('[SECURITY_EVENT]', JSON.stringify(logEntry));
  }
}