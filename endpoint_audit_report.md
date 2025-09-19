# API Endpoint Security Audit Report

## Executive Summary
Comprehensive security audit of all API endpoints for production readiness.

## Complete Endpoint Inventory

### Authentication Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/auth/register` | POST | No | authRateLimit | registerSchema | ✅ |
| `/api/auth/login` | POST | No | authRateLimit | loginSchema | ✅ |
| `/api/auth/logout` | POST | No | generalRateLimit | None | ⚠️ |
| `/api/auth/user` | GET | Yes (isAuthenticated) | generalRateLimit | None | ✅ |
| `/api/auth/me` | GET | Yes (isAuthenticated) | generalRateLimit | None | ✅ |
| `/api/auth/google` | GET | No | authRateLimit | None | ✅ |
| `/api/auth/google/callback` | GET | No | authRateLimit | None | ✅ |
| `/api/auth/phone/request` | POST | No | authRateLimit | Manual validation | ⚠️ |
| `/api/auth/phone/verify` | POST | No | authRateLimit | Manual validation | ⚠️ |

### Integration & Status Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/integrations/status` | GET | No | generalRateLimit | None | ✅ |

### CV Management Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/cv/upload` | POST | Yes (isAuthenticated) | generalRateLimit | File validation | ⚠️ |
| `/api/cv` | GET | Yes (isAuthenticated) | generalRateLimit | None | ✅ |
| `/api/cv/tailor` | POST | Yes (isAuthenticated) | generalRateLimit | Manual validation | ⚠️ |

### Job Management Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/jobs` | GET | Yes (isAuthenticated) | generalRateLimit | Query param validation | ⚠️ |
| `/api/jobs` | POST | Yes (isAuthenticated) | generalRateLimit | insertJobSchema | ✅ |
| `/api/jobs/:id` | GET | Yes (isAuthenticated) | generalRateLimit | None | ⚠️ |
| `/api/jobs/matched` | GET | Yes (isAuthenticated) | generalRateLimit | Query param validation | ⚠️ |
| `/api/jobs/search` | GET | Yes (isAuthenticated) | generalRateLimit | Query param validation | ⚠️ |
| `/api/jobs/:id/apply` | POST | Yes (isAuthenticated) | generalRateLimit | Manual validation | ⚠️ |

### Application Management Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/applications` | POST | Yes (isAuthenticated) | generalRateLimit | insertApplicationSchema | ✅ |
| `/api/applications` | GET | Yes (isAuthenticated) | generalRateLimit | Query param validation | ⚠️ |
| `/api/applications/:id` | PUT | Yes (isAuthenticated) | generalRateLimit | Manual validation | ⚠️ |
| `/api/applications/:id` | DELETE | Yes (isAuthenticated) | generalRateLimit | None | ⚠️ |
| `/api/applications/:id/prepare` | POST | Yes (isAuthenticated) | generalRateLimit | None | ⚠️ |
| `/api/applications/batch-prepare` | POST | Yes (isAuthenticated) | generalRateLimit | Manual validation | ⚠️ |

### AI Services Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/cover-letter/generate` | POST | Yes (isAuthenticated) | generalRateLimit | Manual validation | ⚠️ |

### Usage & Templates Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/usage/stats` | GET | Yes (isAuthenticated) | generalRateLimit | None | ✅ |
| `/api/templates` | GET | Yes (isAuthenticated) | generalRateLimit | Query param validation | ⚠️ |

### Subscription Management Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/subscription/usage` | GET | Yes (isAuthenticated) | generalRateLimit | None | ✅ |
| `/api/subscription` | GET | Yes (isAuthenticated) | generalRateLimit | None | ✅ |
| `/api/subscription/create` | POST | Yes (isAuthenticated) | generalRateLimit | createSubscriptionSchema | ✅ |
| `/api/subscription/cancel` | POST | Yes (isAuthenticated) | generalRateLimit | Manual validation | ⚠️ |
| `/api/subscription/payment-status/:merchantTransactionId` | GET | Yes (isAuthenticated) | generalRateLimit | None | ⚠️ |

### Webhook Endpoints
| Endpoint | Method | Auth Required | Rate Limited | Validation Schema | Status |
|----------|--------|---------------|--------------|-------------------|--------|
| `/api/stripe/webhook` | POST | No (Signature verification) | No | Stripe signature | ✅ |
| `/api/phonepe/webhook` | POST | No (Signature verification) | No | Manual validation | ⚠️ |

## DETAILED AUDIT FINDINGS

### 1. INPUT VALIDATION GAPS

#### CRITICAL - Missing Zod Schemas (High Priority)
| Endpoint | Issue | Risk Level | Recommended Fix |
|----------|-------|------------|-----------------|
| `/api/auth/phone/request` | Manual phone number validation only | HIGH | Create phoneRequestSchema with phone number format validation |
| `/api/auth/phone/verify` | Manual validation for phone + OTP | HIGH | Create phoneVerifySchema with phone/OTP/name validation |
| `/api/cv/tailor` | Only manual jobId validation | MEDIUM | Create cvTailorSchema with jobId UUID validation |
| `/api/cover-letter/generate` | Only manual jobId validation | MEDIUM | Create coverLetterSchema with jobId validation |
| `/api/jobs/:id/apply` | Manual validation only | HIGH | Create jobApplySchema for application data |
| `/api/applications/:id` (PUT) | Manual validation for updates | MEDIUM | Create applicationUpdateSchema |
| `/api/applications/batch-prepare` | Manual array validation | MEDIUM | Create batchPrepareSchema with applicationIds array |
| `/api/subscription/cancel` | Manual cancelAtPeriodEnd validation | LOW | Create subscriptionCancelSchema |

#### Query Parameter Validation Missing
| Endpoint | Missing Validation | Risk Level |
|----------|-------------------|------------|
| `/api/jobs` | limit parameter (integer bounds) | LOW |
| `/api/jobs/matched` | limit, location, salary, types parameters | MEDIUM |
| `/api/jobs/search` | search query parameters | MEDIUM |
| `/api/applications` | status, limit, offset parameters | LOW |
| `/api/templates` | type parameter validation | LOW |

#### Path Parameter Validation Missing
| Endpoint | Missing Validation | Risk Level |
|----------|-------------------|------------|
| `/api/jobs/:id` | UUID format validation | MEDIUM |
| `/api/applications/:id` | UUID format validation | MEDIUM |
| `/api/subscription/payment-status/:merchantTransactionId` | Transaction ID format validation | LOW |

### 2. AUTHENTICATION & AUTHORIZATION ANALYSIS

#### ✅ PROPERLY PROTECTED ENDPOINTS
All sensitive endpoints correctly use `isAuthenticated` middleware:
- All CV operations require authentication
- All job operations require authentication  
- All application management requires authentication
- All subscription operations require authentication
- User profile endpoints require authentication

#### ✅ CORRECTLY UNPROTECTED ENDPOINTS
Public endpoints that should remain unprotected:
- `/api/auth/register`, `/api/auth/login` - Authentication endpoints
- `/api/auth/google/*` - OAuth flows
- `/api/auth/phone/*` - Phone authentication flows
- `/api/integrations/status` - Public integration status
- `/api/stripe/webhook`, `/api/phonepe/webhook` - Webhook endpoints (use signature verification)

### 3. ERROR HANDLING CONSISTENCY AUDIT

#### ✅ EXCELLENT ERROR HANDLING
These endpoints have consistent, structured error responses:
- `/api/auth/register` - Proper error codes (VALIDATION_ERROR, EMAIL_EXISTS, etc.)
- `/api/auth/login` - Consistent error structure with codes
- `/api/subscription/create` - Good validation and error handling
- Webhook endpoints - Comprehensive error handling with specific codes

#### ⚠️ INCONSISTENT ERROR HANDLING
| Endpoint | Issue | Recommendation |
|----------|-------|----------------|
| `/api/cv/upload` | Mixed error formats, some without codes | Standardize all errors with message/code structure |
| `/api/jobs/:id` | Simple "Job not found" without error code | Add error codes (JOB_NOT_FOUND) |
| `/api/applications/:id/prepare` | Basic error messages without codes | Add structured error responses |
| `/api/cover-letter/generate` | Basic error without proper structure | Add error codes and consistent format |

### 4. RATE LIMITING ANALYSIS

#### ✅ WELL-IMPLEMENTED RATE LIMITING
- **Auth Rate Limiting**: 5 requests/15min on all authentication endpoints (excellent)
- **General Rate Limiting**: 100 requests/15min on all other endpoints (appropriate)
- **Sensitive Endpoints Covered**: All auth, payment, and sensitive operations are rate-limited

#### ✅ APPROPRIATE RATE LIMITS
- Authentication endpoints: 5/15min prevents brute force attacks
- Payment operations: Protected by general rate limiting (sufficient)
- Webhook endpoints: Not rate-limited (correct - handled by signature verification)

### 5. IDEMPOTENCY AUDIT

#### ✅ EXCELLENT IDEMPOTENCY (Webhook Endpoints)
- **Stripe Webhooks**: 
  - ✅ Event ID tracking in database
  - ✅ Duplicate processing prevention
  - ✅ Persistent idempotency with `processed` flag
  - ✅ Error tracking and retry handling

- **PhonePe Webhooks**:
  - ✅ Transaction ID tracking  
  - ✅ Duplicate processing prevention
  - ✅ Proper status checking

#### ⚠️ MISSING IDEMPOTENCY
| Endpoint | Issue | Risk Level |
|----------|-------|------------|
| `/api/jobs/:id/apply` | No duplicate application prevention | HIGH |
| `/api/applications/batch-prepare` | No idempotency for batch operations | MEDIUM |
| `/api/subscription/create` | Could create duplicate payment requests | HIGH |

### 6. SECURITY AUDIT

#### ✅ SECURITY STRENGTHS
- **No sensitive data in error messages**: Errors don't expose internal details
- **Proper JWT cookie handling**: Secure token management
- **Environment variable protection**: API keys properly handled
- **File upload security**: Proper file type and size validation
- **SQL injection prevention**: Using parameterized queries via Drizzle ORM
- **Webhook signature verification**: Both Stripe and PhonePe properly verify signatures

#### ⚠️ SECURITY CONCERNS
| Issue | Location | Risk Level | Fix Required |
|-------|----------|------------|--------------|
| Detailed error logging to console | Multiple endpoints | LOW | Sanitize logged data in production |
| File upload path traversal potential | `/api/cv/upload` | LOW | Add filename sanitization |
| Missing request size limits | General middleware | LOW | Add request size limits |

### 7. PRIORITY RECOMMENDATIONS

#### 🔴 HIGH PRIORITY (Fix Immediately)
1. **Add Zod validation schemas** for phone authentication endpoints
2. **Implement duplicate application prevention** for job applications
3. **Add idempotency handling** for subscription creation
4. **Standardize error response format** across all endpoints

#### 🟡 MEDIUM PRIORITY (Fix Soon)
1. Add UUID validation for path parameters
2. Implement query parameter validation schemas
3. Add proper error codes to remaining endpoints
4. Enhance file upload security measures

#### 🟢 LOW PRIORITY (Future Enhancement)
1. Add request size limits
2. Implement comprehensive audit logging
3. Add more granular rate limiting for different operations
4. Enhance error message localization

## IMPLEMENTATION RECOMMENDATIONS

### HIGH PRIORITY FIXES (Implement Immediately)

#### 1. Add Missing Zod Validation Schemas
Add these schemas to `shared/schema.ts`:

```typescript
// Phone authentication schemas
export const phoneRequestSchema = z.object({
  phoneNumber: z.string()
    .regex(/^\+[1-9]\d{1,14}$/, "Invalid international phone number format")
    .min(10, "Phone number too short")
    .max(15, "Phone number too long")
});

export const phoneVerifySchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/),
  otpCode: z.string().length(6, "OTP code must be 6 digits").regex(/^\d{6}$/),
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional()
});

// Job application schemas
export const jobApplySchema = z.object({
  jobId: z.string().uuid("Invalid job ID"),
  notes: z.string().max(1000).optional()
});

export const cvTailorSchema = z.object({
  jobId: z.string().uuid("Invalid job ID")
});

export const applicationUpdateSchema = z.object({
  status: z.enum(["applied", "viewed", "interviewing", "offered", "rejected"]).optional(),
  notes: z.string().max(1000).optional(),
  interviewDate: z.string().datetime().optional()
});

export const batchPrepareSchema = z.object({
  applicationIds: z.array(z.string().uuid()).min(1).max(5)
});

export const subscriptionCancelSchema = z.object({
  cancelAtPeriodEnd: z.boolean().default(true)
});
```

#### 2. Implement Duplicate Application Prevention
Add to `/api/jobs/:id/apply` endpoint:

```typescript
// Before creating application, check for existing
const existingApplication = await storage.getApplicationByUserAndJob(userId, jobId);
if (existingApplication) {
  return res.status(409).json({
    message: "You have already applied to this job",
    code: "DUPLICATE_APPLICATION",
    existingApplicationId: existingApplication.id
  });
}
```

#### 3. Add Idempotency to Subscription Creation
Modify `/api/subscription/create` endpoint:

```typescript
// Generate idempotency key from user + plan + timestamp window
const idempotencyWindow = Math.floor(Date.now() / (5 * 60 * 1000)); // 5-minute window
const idempotencyKey = `${userId}_${plan}_${idempotencyWindow}`;

// Check for existing payment request
const existingPayment = await storage.getPaymentRequestByKey(idempotencyKey);
if (existingPayment) {
  return res.json({
    success: true,
    paymentUrl: existingPayment.paymentUrl,
    merchantTransactionId: existingPayment.merchantTransactionId,
    status: 'existing'
  });
}
```

#### 4. Standardize Error Response Format
Create error handler utility in `server/utils/errorHandler.ts`:

```typescript
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
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  DUPLICATE_RESOURCE: 'DUPLICATE_RESOURCE',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
} as const;
```

### MEDIUM PRIORITY FIXES

#### 1. Add Path Parameter Validation Middleware
Create `server/middleware/validateParams.ts`:

```typescript
import { z } from 'zod';

export const validateUUIDParam = (paramName: string) => {
  return (req: any, res: any, next: any) => {
    const schema = z.string().uuid(`Invalid ${paramName} format`);
    const result = schema.safeParse(req.params[paramName]);
    
    if (!result.success) {
      return res.status(400).json({
        message: `Invalid ${paramName} parameter`,
        code: 'INVALID_PARAMETER',
        errors: result.error.errors
      });
    }
    
    next();
  };
};
```

#### 2. Query Parameter Validation Schemas
Add to `shared/schema.ts`:

```typescript
export const jobsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const jobMatchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  location: z.string().max(100).optional(),
  salary: z.string().max(50).optional(),
  types: z.string().optional() // comma-separated values
});

export const applicationQuerySchema = z.object({
  status: z.enum(["applied", "viewed", "interviewing", "offered", "rejected"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});
```

### SECURITY ENHANCEMENTS

#### 1. Request Size Limits
Add to `server/index.ts`:

```typescript
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
```

#### 2. Production Error Sanitization
Add to error handler:

```typescript
const sanitizeError = (error: any, isProduction: boolean) => {
  if (isProduction) {
    // Don't expose internal error details in production
    return {
      message: "An error occurred",
      code: "INTERNAL_ERROR"
    };
  }
  return error;
};
```

### TESTING CHECKLIST

#### Security Test Cases to Implement:
- [ ] Test rate limiting enforcement on auth endpoints
- [ ] Verify JWT token validation and expiration
- [ ] Test file upload restrictions (size, type)
- [ ] Validate webhook signature verification
- [ ] Test input validation with malformed data
- [ ] Verify idempotency for payment operations
- [ ] Test error response consistency
- [ ] Validate authorization on protected endpoints

#### Load Testing Recommendations:
- [ ] Test concurrent job applications
- [ ] Stress test batch preparation endpoint
- [ ] Verify webhook handling under load
- [ ] Test rate limiting under high traffic

## CRITICAL PRODUCTION READINESS GAPS

### Must Fix Before Production:
1. **Phone Authentication Validation** - Currently vulnerable to invalid input
2. **Duplicate Job Applications** - No prevention mechanism
3. **Payment Idempotency** - Risk of duplicate charges
4. **Error Format Inconsistency** - Poor API consumer experience

### Database Security:
- ✅ Using Drizzle ORM (prevents SQL injection)
- ✅ Parameterized queries throughout
- ✅ Proper connection security
- ⚠️ Missing request rate limiting at database level

### API Security Score Breakdown:
- **Authentication & Authorization**: 9/10 (Excellent)
- **Input Validation**: 6/10 (Needs improvement)
- **Error Handling**: 7/10 (Good but inconsistent)
- **Rate Limiting**: 9/10 (Well implemented)
- **Idempotency**: 8/10 (Great for webhooks, poor for user operations)
- **Data Protection**: 9/10 (Excellent)

## OVERALL SECURITY SCORE: 7.5/10

**Summary**: The application has a solid security foundation with excellent authentication, proper rate limiting, and good webhook handling. The main vulnerabilities are in input validation and idempotency for user-facing operations. With the recommended high-priority fixes, this would become a production-ready API with a security score of 9/10.

**Estimated Fix Time**: 
- High Priority: 2-3 days
- Medium Priority: 1-2 days  
- Low Priority: 1 day

**Total Implementation Time**: 4-6 days for full production readiness.
