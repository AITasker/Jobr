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
  EMAIL_REQUIRED: 'EMAIL_REQUIRED'
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