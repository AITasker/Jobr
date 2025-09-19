# Complete API Endpoint Index

## Overview

This document provides a comprehensive, authoritative index of all API endpoints in the Jobr platform, generated from actual route definitions in `server/routes.ts`. This ensures documentation matches the implemented code exactly.

**Total Endpoints: 33+ (including conditional routes)**
**Last Updated:** _Generated from actual route definitions_

---

## Authentication Endpoints

### Core Authentication
- **GET** `/api/auth/user` - Get current user (legacy)
- **POST** `/api/auth/register` - User registration
- **POST** `/api/auth/login` - User login  
- **GET** `/api/auth/me` - Get current user profile
- **POST** `/api/auth/logout` - User logout

### OAuth & Social Login
- **GET** `/api/auth/google` - Initiate Google OAuth (conditional)
- **GET** `/api/auth/google/callback` - Google OAuth callback (conditional)

### Phone Authentication
- **POST** `/api/auth/phone/request` - Request OTP for phone verification
- **POST** `/api/auth/phone/verify` - Verify phone OTP

---

## CV Management Endpoints

- **POST** `/api/cv/upload` - Upload and process CV file
- **GET** `/api/cv` - Get user's CV data
- **POST** `/api/cv/tailor` - Tailor CV for specific job

---

## Job Management Endpoints

- **GET** `/api/jobs` - Get job listings
- **POST** `/api/jobs` - Create new job listing
- **GET** `/api/jobs/:id` - Get specific job details
- **GET** `/api/jobs/matched` - Get matched jobs for user
- **GET** `/api/jobs/search` - Search jobs with filters
- **POST** `/api/jobs/:id/apply` - Apply to specific job

---

## Application Management Endpoints

- **POST** `/api/applications` - Create job application
- **GET** `/api/applications` - Get user's applications
- **PUT** `/api/applications/:id` - Update application
- **DELETE** `/api/applications/:id` - Delete application
- **POST** `/api/applications/:id/prepare` - Prepare application materials
- **POST** `/api/applications/batch-prepare` - Batch prepare multiple applications

---

## AI Services Endpoints

- **POST** `/api/cover-letter/generate` - Generate cover letter
- **GET** `/api/usage/stats` - Get API usage statistics
- **GET** `/api/templates` - Get preparation templates

---

## Subscription & Payment Endpoints

### Subscription Management
- **GET** `/api/subscription/usage` - Get usage statistics
- **GET** `/api/subscription` - Get current subscription
- **POST** `/api/subscription/create` - Create payment/subscription
- **POST** `/api/subscription/cancel` - Cancel subscription
- **GET** `/api/subscription/payment-status/:merchantTransactionId` - Check payment status

### Webhook Endpoints (External)
- **POST** `/api/stripe/webhook` - Stripe webhook handler
- **POST** `/api/phonepe/webhook` - PhonePe webhook handler

---

## System Endpoints

- **GET** `/api/integrations/status` - Integration status check

---

## Route Conditions & Availability

### Conditional Routes
Some endpoints have conditional availability based on configuration:

**Google OAuth Routes:**
- Available when `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are configured
- Return 503 error when OAuth is unavailable
- Graceful fallback to email/password authentication

**AI-Powered Features:**
- Fallback to basic parsing when OpenAI is unavailable
- Feature degradation with user notification

### Rate Limiting
All routes implement rate limiting:
- **Authentication routes**: 10-20 requests per 15 minutes
- **General routes**: 100 requests per 15 minutes
- **Integration status**: Exempt from rate limiting (health check)

---

## Response Schemas

### Standard Response Structure
```typescript
// Success Response
{
  success: boolean;
  data?: any;
  message?: string;
}

// Error Response  
{
  message: string;
  code: string;
  errors?: ValidationError[];
}
```

### User Object Schema
```typescript
{
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: 'Free' | 'Premium' | 'Pro';
  creditsRemaining: number;
  subscriptionStatus: string;
  createdAt: string;
}
```

### Application Object Schema
```typescript
{
  id: string;
  userId: string;
  jobId: string;
  status: 'applied' | 'viewed' | 'interviewing' | 'offered' | 'rejected';
  matchScore: number;
  tailoredCv?: string;
  coverLetter?: string;
  preparationStatus: 'pending' | 'preparing' | 'ready' | 'failed';
  appliedDate: string;
  // ... additional fields per schema.ts
}
```

### Integration Status Schema
```typescript
{
  success: boolean;
  summary: {
    total_integrations: number;
    available: number;
    missing: number;
    core_functional: boolean;
    payments_functional: boolean;
  };
  integrations: {
    [service: string]: {
      available: boolean;
      features: string[];
      fallback?: string;
    }
  };
  recommendations: string[];
}
```

---

## Implementation Notes

### Authentication Method
- **JWT Algorithm**: HS256 (HMAC SHA256)
- **Token Storage**: httpOnly cookies
- **Session Management**: PostgreSQL-backed sessions

### Error Handling
- Consistent error response format across all endpoints
- Proper HTTP status codes
- Detailed validation error messages
- Graceful fallback behavior for service unavailability

### File Upload Handling
- **CV Upload**: 5MB limit, PDF/DOC/DOCX only
- **Multer Configuration**: Memory storage with validation
- **Security**: File type validation, size limits

---

## Verification Commands

To verify endpoint availability:

```bash
# Check integration status
curl https://your-domain.com/api/integrations/status

# Test authentication
curl -X POST https://your-domain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password"}'

# Check API with authentication
curl -H "Authorization: Bearer <token>" \
  https://your-domain.com/api/auth/me
```

This index is automatically maintained to match the actual implementation in `server/routes.ts`.