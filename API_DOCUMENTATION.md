# Jobr Platform API Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the Jobr AI-powered job search platform. The backend features 33+ endpoints across authentication, job management, AI services, and payment processing, with enterprise-grade security and production-ready integrations.

> **📋 Complete Endpoint Index**: For an authoritative list of all endpoints matching the actual implementation, see [ENDPOINT_INDEX.md](docs/ENDPOINT_INDEX.md)

**Base URL**: `https://your-domain.com`  
**API Version**: v1  
**Authentication**: JWT Bearer tokens (HS256) with multi-provider support  
**Security Features**: Enterprise-grade (see PRODUCTION_READINESS_ASSESSMENT.md for details)

## Table of Contents

1. [Authentication](#authentication)
2. [Authentication Endpoints](#authentication-endpoints)
3. [CV Management Endpoints](#cv-management-endpoints)
4. [Job Management Endpoints](#job-management-endpoints)
5. [Application Management Endpoints](#application-management-endpoints)
6. [AI Services Endpoints](#ai-services-endpoints)
7. [Subscription & Payment Endpoints](#subscription--payment-endpoints)
8. [System Endpoints](#system-endpoints)
9. [Error Codes](#error-codes)
10. [Rate Limiting](#rate-limiting)
11. [Production Validation](#production-validation)

---

## Authentication

All protected endpoints require authentication via JWT Bearer tokens:

```
Authorization: Bearer <jwt_token>
```

**Supported Authentication Methods:**
- Email/Password (local)
- Google OAuth 2.0
- Replit Authentication
- Phone/OTP verification

**Security Features:**
- Account lockout after failed attempts (5 attempts = 15 min lockout)
- Rate limiting per IP and endpoint
- JWT tokens with HMAC SHA256 signing
- Session management with httpOnly cookies
- Environment-based security configuration

---

## Authentication Endpoints

### 1. User Registration

**POST** `/api/auth/register`

Register a new user with email and password.

**Rate Limit**: 10 requests per 15 minutes

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "plan": "Free",
    "creditsRemaining": 5
  },
  "emailVerificationRequired": false,
  "message": "Registration successful"
}
```

**Errors:**
- 400: Validation errors
- 409: Email already exists (`EMAIL_EXISTS`)
- 429: Rate limit exceeded

---

### 2. User Login

**POST** `/api/auth/login`

Authenticate user with email and password.

**Rate Limit**: 20 requests per 15 minutes

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response (200):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "plan": "Free",
    "creditsRemaining": 5
  },
  "message": "Login successful"
}
```

**Errors:**
- 401: Invalid credentials (`INVALID_CREDENTIALS`)
- 423: Account locked (`ACCOUNT_LOCKED`)
- 429: Too many attempts (`TOO_MANY_ATTEMPTS`)

---

### 3. Get Current User

**GET** `/api/auth/me` 🔒

Get current authenticated user information.

**Response (200):**
```json
{
  "id": "uuid-v4",
  "email": "user@example.com",
  "firstName": "John",
  "lastName": "Doe",
  "plan": "Premium",
  "subscriptionStatus": "active",
  "creditsRemaining": 100,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 4. User Logout

**POST** `/api/auth/logout` 🔒

Logout current user and clear session.

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

### 5. Google OAuth Authentication

**GET** `/api/auth/google`

Initiates Google OAuth flow.

**Response**: Redirects to Google OAuth consent screen.

**GET** `/api/auth/google/callback`

Handles Google OAuth callback and redirects to dashboard.

---

### 6. Phone Number Registration

**POST** `/api/auth/phone/request`

Request OTP for phone number registration.

**Rate Limit**: 10 requests per 15 minutes

**Request Body:**
```json
{
  "phoneNumber": "+1234567890"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "OTP sent to phone number",
  "otpCode": "123456"
}
```
*Note: OTP code only shown in development mode*

---

### 7. Phone OTP Verification

**POST** `/api/auth/phone/verify`

Verify phone number with OTP code.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "otpCode": "123456",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response (201):**
```json
{
  "success": true,
  "user": {
    "id": "uuid-v4",
    "email": null,
    "firstName": "John",
    "lastName": "Doe",
    "plan": "Free",
    "creditsRemaining": 5
  },
  "message": "Phone authentication successful"
}
```

---

## CV Management Endpoints

### 8. Upload CV

**POST** `/api/cv/upload` 🔒

Upload and process CV file (PDF, DOC, DOCX).

**Content-Type**: `multipart/form-data`  
**File Size Limit**: 5MB  
**Supported Formats**: PDF, DOC, DOCX

**Form Data:**
- `cv`: File (required)

**Response (201):**
```json
{
  "success": true,
  "cv": {
    "id": "cv_uuid",
    "userId": "user_uuid",
    "fileName": "resume.pdf",
    "originalContent": "Extracted text content...",
    "parsedData": {
      "name": "John Doe",
      "email": "john@example.com",
      "skills": ["JavaScript", "React", "Node.js"],
      "experience": "5 years of full-stack development...",
      "education": "Bachelor's in Computer Science...",
      "processingMethod": "openai",
      "processedAt": "2024-01-01T00:00:00.000Z"
    },
    "createdAt": "2024-01-01T00:00:00.000Z"
  },
  "processingMethod": "openai",
  "message": "CV processed successfully with AI analysis"
}
```

**Processing Features:**
- OpenAI (current models, default gpt-4-turbo) powered analysis
- Fallback to basic parsing if AI unavailable
- Structured data extraction
- Skills and experience categorization

**Errors:**
- 400: Invalid file type (`INVALID_FILE_TYPE`)
- 413: File too large (`FILE_TOO_LARGE`)
- 503: AI service unavailable (`AI_SERVICE_UNAVAILABLE`)

---

### 9. Get User's CV

**GET** `/api/cv` 🔒

Retrieve user's uploaded CV.

**Response (200):**
```json
{
  "id": "cv_uuid",
  "userId": "user_uuid",
  "fileName": "resume.pdf",
  "originalContent": "Extracted text content...",
  "parsedData": {
    "name": "John Doe",
    "email": "john@example.com",
    "skills": ["JavaScript", "React", "Node.js"],
    "experience": "5 years of full-stack development...",
    "education": "Bachelor's in Computer Science...",
    "processingMethod": "openai"
  },
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

### 10. Tailor CV for Job

**POST** `/api/cv/tailor` 🔒

Generate a tailored CV for a specific job using AI.

**Request Body:**
```json
{
  "jobId": "job_uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "tailoredCv": {
    "content": "Tailored CV content optimized for the specific job...",
    "highlights": [
      "Emphasized React experience for frontend role",
      "Highlighted team leadership experience",
      "Added relevant project examples"
    ],
    "matchScore": 0.92,
    "processingTime": 3.2
  },
  "metadata": {
    "aiModel": "gpt-5",
    "tailoredAt": "2024-01-01T00:00:00.000Z",
    "optimizations": 7
  }
}
```

---

## Job Management Endpoints

### 11. Get Jobs

**GET** `/api/jobs` 🔒

Retrieve job listings.

**Query Parameters:**
- `limit`: Number of jobs to return (default: 20, max: 100)

**Response (200):**
```json
[
  {
    "id": "job_uuid",
    "title": "Senior Software Engineer",
    "company": "TechCorp Inc",
    "location": "San Francisco, CA",
    "remote": true,
    "salaryMin": 120000,
    "salaryMax": 180000,
    "currency": "USD",
    "type": "full-time",
    "experienceLevel": "senior",
    "description": "We are looking for an experienced software engineer...",
    "requirements": ["React", "Node.js", "PostgreSQL", "5+ years experience"],
    "benefits": ["Health Insurance", "401k", "Remote Work"],
    "skills": ["JavaScript", "TypeScript", "React", "Node.js"],
    "postedDate": "2024-01-01T00:00:00.000Z",
    "applicationDeadline": "2024-02-01T23:59:59.000Z"
  }
]
```

---

### 12. Create Job

**POST** `/api/jobs` 🔒

Create a new job listing (admin only).

**Request Body:**
```json
{
  "title": "Senior Software Engineer",
  "company": "TechCorp Inc",
  "location": "San Francisco, CA",
  "remote": true,
  "salaryMin": 120000,
  "salaryMax": 180000,
  "currency": "USD",
  "type": "full-time",
  "experienceLevel": "senior",
  "description": "We are looking for an experienced software engineer...",
  "requirements": ["React", "Node.js", "PostgreSQL", "5+ years experience"],
  "skills": ["JavaScript", "TypeScript", "React", "Node.js"]
}
```

**Response (201):**
```json
{
  "id": "job_uuid",
  "title": "Senior Software Engineer",
  "company": "TechCorp Inc",
  "location": "San Francisco, CA",
  "postedDate": "2024-01-01T00:00:00.000Z"
}
```

---

### 13. Get Job by ID

**GET** `/api/jobs/:id` 🔒

Get detailed information about a specific job.

**Response (200):**
```json
{
  "id": "job_uuid",
  "title": "Senior Software Engineer",
  "company": "TechCorp Inc",
  "location": "San Francisco, CA",
  "remote": true,
  "salaryMin": 120000,
  "salaryMax": 180000,
  "currency": "USD",
  "type": "full-time",
  "experienceLevel": "senior",
  "description": "We are looking for an experienced software engineer...",
  "requirements": ["React", "Node.js", "PostgreSQL", "5+ years experience"],
  "benefits": ["Health Insurance", "401k", "Remote Work"],
  "skills": ["JavaScript", "TypeScript", "React", "Node.js"],
  "postedDate": "2024-01-01T00:00:00.000Z",
  "applicationDeadline": "2024-02-01T23:59:59.000Z"
}
```

---

### 14. Get Matched Jobs

**GET** `/api/jobs/matched` 🔒

Get AI-powered job recommendations based on user's CV.

**Query Parameters:**
- `limit`: Number of matches (default: 20, max: 100)
- `location`: Preferred location filter
- `salary`: Salary expectation
- `types`: Comma-separated job types

**Response (200):**
```json
{
  "matches": [
    {
      "id": "job_uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp Inc",
      "location": "San Francisco, CA",
      "salaryMin": 120000,
      "salaryMax": 180000,
      "matchScore": 0.92,
      "matchReasons": [
        "Strong React experience match (95%)",
        "Node.js skills align perfectly",
        "Senior-level experience matches requirement",
        "Remote work preference alignment"
      ],
      "skillsMatch": {
        "matching": ["React", "Node.js", "JavaScript", "TypeScript"],
        "missing": ["PostgreSQL", "Docker"],
        "score": 0.85
      }
    }
  ],
  "total": 25,
  "processingMethod": "ai"
}
```

**Requirements:**
- User must have uploaded CV
- Returns empty array if no CV found

---

### 15. Search Jobs

**GET** `/api/jobs/search` 🔒

Search jobs with filters and AI-powered matching.

**Query Parameters:**
- `q`: Search query (job title, company, skills)
- `location`: Location filter
- `type`: Job type filter
- `minSalary`: Minimum salary filter
- `skills`: Comma-separated skills filter
- `preferredLocation`: User's preferred location
- `salaryExpectation`: User's salary expectation
- `preferredTypes`: User's preferred job types

**Response (200):**
```json
{
  "results": [
    {
      "id": "job_uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp Inc",
      "matchScore": 0.88,
      "relevanceScore": 0.95,
      "searchHighlights": ["React", "Node.js", "Senior"]
    }
  ],
  "total": 15,
  "filters": {
    "query": "senior react developer",
    "location": "San Francisco",
    "type": "full-time"
  },
  "processingMethod": "ai"
}
```

---

### 16. Apply to Job

**POST** `/api/jobs/:id/apply` 🔒

Apply to a specific job.

**Request Body:**
```json
{
  "notes": "I am very excited about this opportunity..."
}
```

**Response (200):**
```json
{
  "success": true,
  "application": {
    "id": "application_uuid",
    "userId": "user_uuid",
    "jobId": "job_uuid",
    "matchScore": 85,
    "status": "applied",
    "appliedDate": "2024-01-01T00:00:00.000Z",
    "notes": "I am very excited about this opportunity...",
    "job": {
      "title": "Senior Software Engineer",
      "company": "TechCorp Inc"
    }
  },
  "message": "Successfully applied to Senior Software Engineer at TechCorp Inc"
}
```

**Requirements:**
- User must have uploaded CV
- Cannot apply to same job twice

**Errors:**
- 400: CV required (`CV_REQUIRED`)
- 409: Already applied (`DUPLICATE_APPLICATION`)

---

## Application Management Endpoints

### 17. Create Application

**POST** `/api/applications` 🔒

Create a new job application.

**Request Body:**
```json
{
  "jobId": "job_uuid",
  "matchScore": 85,
  "status": "applied",
  "notes": "Custom application notes..."
}
```

**Subscription Limits:**
- Free: 5 applications per month
- Premium: Unlimited applications
- Pro: Unlimited applications

**Response (201):**
```json
{
  "id": "application_uuid",
  "userId": "user_uuid",
  "jobId": "job_uuid",
  "matchScore": 85,
  "status": "applied",
  "appliedDate": "2024-01-01T00:00:00.000Z",
  "notes": "Custom application notes..."
}
```

**Errors:**
- 403: Subscription limit reached (`SUBSCRIPTION_LIMIT_REACHED`)
- 409: Duplicate application (`DUPLICATE_APPLICATION`)

---

### 18. Get User Applications

**GET** `/api/applications` 🔒

Retrieve all applications for authenticated user.

**Response (200):**
```json
[
  {
    "id": "application_uuid",
    "userId": "user_uuid",
    "jobId": "job_uuid",
    "matchScore": 85,
    "status": "applied",
    "appliedDate": "2024-01-01T00:00:00.000Z",
    "notes": "Application notes...",
    "preparationStatus": "ready",
    "job": {
      "id": "job_uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp Inc",
      "location": "San Francisco, CA"
    }
  }
]
```

---

### 19. Update Application

**PUT** `/api/applications/:id` 🔒

Update application status and details.

**Allowed Updates:**
- `status`: Application status
- `notes`: Application notes
- `interviewDate`: Interview scheduling
- `tailoredCv`: Tailored CV content
- `coverLetter`: Cover letter content
- `preparationStatus`: Preparation status
- `preparationMetadata`: Preparation metadata

**Request Body:**
```json
{
  "status": "interview",
  "notes": "Scheduled for technical interview on Friday",
  "interviewDate": "2024-01-15T10:00:00.000Z"
}
```

**Response (200):**
```json
{
  "id": "application_uuid",
  "status": "interview",
  "notes": "Scheduled for technical interview on Friday",
  "interviewDate": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-10T00:00:00.000Z"
}
```

---

### 20. Delete Application

**DELETE** `/api/applications/:id` 🔒

Delete/withdraw a job application.

**Response (200):**
```json
{
  "message": "Application deleted successfully"
}
```

**Errors:**
- 404: Application not found
- 403: Not authorized to delete this application

---

### 21. Prepare Application

**POST** `/api/applications/:id/prepare` 🔒

Generate tailored CV and cover letter for application using AI.

**AI Features Required**: Premium or Pro subscription

**Response (200):**
```json
{
  "coverLetter": "Tailored cover letter content...",
  "tailoredCv": "Tailored CV content...",
  "preparationMetadata": {
    "coverLetter": {
      "wordCount": 247,
      "tone": "professional",
      "aiModel": "gpt-5",
      "processingTime": 2.3
    },
    "tailoredCv": {
      "optimizations": 8,
      "highlightedSkills": ["React", "Node.js"],
      "aiModel": "gpt-5",
      "processingTime": 3.1
    },
    "preparedAt": "2024-01-01T00:00:00.000Z"
  },
  "status": "ready"
}
```

**Errors:**
- 403: AI features required (`AI_FEATURES_REQUIRED`)
- 404: Application not found

---

## AI Services Endpoints

### 22. Generate Cover Letter

**POST** `/api/cover-letter/generate` 🔒

Generate a personalized cover letter for a specific job.

**Request Body:**
```json
{
  "jobId": "job_uuid"
}
```

**Response (200):**
```json
{
  "success": true,
  "coverLetter": {
    "content": "Dear Hiring Manager,\n\nI am writing to express my strong interest in the Senior Software Engineer position at TechCorp Inc...",
    "wordCount": 247,
    "tone": "professional",
    "estimatedReadTime": "1 min"
  },
  "metadata": {
    "aiModel": "gpt-5",
    "processingTime": 2.3,
    "confidence": 0.89,
    "highlightedSkills": ["React", "Node.js", "Team Leadership"]
  }
}
```

**Requirements:**
- User must have uploaded CV
- AI features subscription required

---

## Subscription & Payment Endpoints

### 23. Create Subscription

**POST** `/api/subscription/create` 🔒

Create a new subscription with payment processing.

**Request Body:**
```json
{
  "planId": "Premium",
  "paymentProvider": "stripe",
  "redirectUrl": "https://yourapp.com/billing/success"
}
```

**Supported Plans:**
- Premium: $49.99/month
- Pro: $99.99/month

**Supported Providers:**
- `stripe`: International payments
- `phonepe`: Indian market (UPI, wallets)

**Response (200):**
```json
{
  "success": true,
  "subscriptionId": "sub_uuid",
  "clientSecret": "pi_client_secret_here",
  "paymentUrl": "https://checkout.stripe.com/...",
  "status": "pending"
}
```

---

### 24. Create PhonePe Payment

**POST** `/api/subscription/phonepe/create-payment` 🔒

Create PhonePe payment for Indian users.

**Request Body:**
```json
{
  "planId": "Premium",
  "redirectUrl": "https://yourapp.com/billing/success"
}
```

**Response (200):**
```json
{
  "success": true,
  "paymentUrl": "https://api.phonepe.com/...",
  "merchantTransactionId": "MT1234567890",
  "status": "created"
}
```

---

### 25. Cancel Subscription

**POST** `/api/subscription/cancel` 🔒

Cancel current subscription.

**Request Body:**
```json
{
  "cancelAtPeriodEnd": true
}
```

**Response (200):**
```json
{
  "success": true,
  "cancelAtPeriodEnd": true,
  "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
  "message": "Subscription will be cancelled at the end of current period"
}
```

---

### 26. Check Payment Status

**GET** `/api/subscription/payment-status/:merchantTransactionId` 🔒

Check PhonePe payment status.

**Response (200):**
```json
{
  "success": true,
  "status": {
    "code": "PAYMENT_SUCCESS",
    "message": "Payment completed successfully",
    "data": {
      "transactionId": "TXN123456",
      "amount": 4999,
      "state": "COMPLETED"
    }
  },
  "merchantTransactionId": "MT1234567890"
}
```

---

## System Endpoints

### 27. Integration Status

**GET** `/api/integrations/status`

Get status of all third-party integrations.

**No Authentication Required**

**Response (200):**
```json
{
  "success": true,
  "summary": {
    "total_integrations": 5,
    "available": 3,
    "missing": 2,
    "core_functional": true,
    "payments_functional": true
  },
  "integrations": {
    "openai": {
      "available": true,
      "features": ["cv_parsing", "job_matching", "ai_assistance"],
      "fallback": null
    },
    "google_oauth": {
      "available": false,
      "features": ["social_login"],
      "fallback": "email_password_login"
    },
    "stripe": {
      "available": false,
      "features": ["subscription_payments", "billing_management"],
      "fallback": "phonepe_payments"
    },
    "phonepe": {
      "available": true,
      "features": ["indian_payments", "subscription_management"],
      "fallback": null,
      "test_mode": true
    },
    "sendgrid": {
      "available": false,
      "features": ["email_notifications", "password_reset"],
      "fallback": "console_logging"
    }
  },
  "recommendations": [
    "Configure Google OAuth for social login",
    "Configure SendGrid for email services"
  ]
}
```

---

### 28. Authentication Metrics

**GET** `/api/auth/metrics` 🔒

Get authentication metrics and statistics (admin only).

**Response (200):**
```json
{
  "totalLogins": 1250,
  "successfulLogins": 1180,
  "failedLogins": 70,
  "lockedAccounts": 3,
  "successRate": 94.4,
  "recentAttempts": [
    {
      "timestamp": "2024-01-01T12:00:00.000Z",
      "method": "email",
      "success": true,
      "ip": "192.168.1.1"
    }
  ],
  "authProviders": {
    "email": 850,
    "google": 300,
    "phone": 100
  }
}
```

---

## Production Validation

### Environment Validation Requirements

Before deploying to production, all critical environment variables must be validated:

**Required Variables by Feature:**

```bash
# Core Application (CRITICAL - prevents startup)
DATABASE_URL=postgresql://...
JWT_SECRET=<256-bit-secret>
SESSION_SECRET=<256-bit-secret>
NODE_ENV=production

# AI Services (Optional - graceful degradation)
OPENAI_API_KEY=sk-proj-...
OPENAI_MODEL=gpt-4-turbo

# Payment Processing (Optional)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PHONEPE_MERCHANT_ID=...
PHONEPE_SALT_KEY=...

# Email Services (Optional)
SENDGRID_API_KEY=SG....
EMAIL_FROM=noreply@yourdomain.com

# OAuth Providers (Optional)
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
```

### Fail-Fast Validation Script

Run before deployment to prevent production failures:

```bash
# Validate environment configuration
node scripts/validate-env.js

# Exit codes:
# 0 = All validations passed, safe to deploy
# 1 = Critical failures, deployment blocked
```

**Validation Features:**
- Critical variable presence and format validation
- Security configuration checks
- Feature availability assessment
- Production readiness verification

### Integration Status Monitoring

Monitor service availability in production:

```bash
# Check all integration status
curl https://your-domain.com/api/integrations/status
```

Expected response includes service availability and fallback status.

---

## Error Codes

### HTTP Status Codes

| Code | Meaning | Usage |
|------|---------|--------|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input data |
| 401 | Unauthorized | Authentication required |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Duplicate resource |
| 413 | Payload Too Large | File size limit exceeded |
| 423 | Locked | Account locked |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | External service down |

### Application Error Codes

| Code | Description | Context |
|------|-------------|---------|
| `VALIDATION_ERROR` | Input validation failed | Request body validation |
| `EMAIL_EXISTS` | Email already registered | User registration |
| `INVALID_CREDENTIALS` | Wrong email/password | User login |
| `ACCOUNT_LOCKED` | Account temporarily locked | Failed login attempts |
| `CV_REQUIRED` | CV upload required | Job applications |
| `JOB_NOT_FOUND` | Job does not exist | Job operations |
| `APPLICATION_NOT_FOUND` | Application does not exist | Application operations |
| `DUPLICATE_APPLICATION` | Already applied to job | Job applications |
| `SUBSCRIPTION_LIMIT_REACHED` | Plan limit exceeded | Feature access |
| `AI_FEATURES_REQUIRED` | AI subscription needed | AI-powered features |
| `INVALID_FILE_TYPE` | Unsupported file format | File uploads |
| `FILE_TOO_LARGE` | File exceeds size limit | File uploads |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Rate limiting |
| `INTEGRATION_UNAVAILABLE` | External service down | Third-party services |

---

## Rate Limiting

### Rate Limit Configuration

| Endpoint Category | Limit | Window | Status Codes |
|------------------|-------|--------|--------------|
| **Authentication** | 10-20 req | 15 min | 429 |
| **General API** | 100 req | 15 min | 429 |
| **File Upload** | 5MB/file | - | 413 |

### Rate Limit Headers

All responses include rate limiting headers:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

### Rate Limit Response

```json
{
  "message": "Too many requests. Please try again later.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 900
}
```

---

## Webhooks

### Stripe Webhooks

**POST** `/api/stripe/webhook`

Handles Stripe payment events.

**Supported Events:**
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### PhonePe Webhooks

**POST** `/api/phonepe/webhook`

Handles PhonePe payment events.

**Event Processing:**
- Payment completion verification
- Subscription activation
- Status updates

---

## Best Practices

### API Usage

1. **Always include authentication headers** for protected endpoints
2. **Handle rate limiting** with exponential backoff
3. **Validate file uploads** before sending to CV endpoints
4. **Check subscription limits** before creating applications
5. **Use pagination** for large data sets

### Error Handling

1. **Check HTTP status codes** first
2. **Parse error codes** for specific handling
3. **Implement retry logic** for transient errors
4. **Log errors** for debugging
5. **Provide user-friendly messages** in UI

### Security

1. **Never log or expose** JWT tokens
2. **Validate all inputs** on client side
3. **Use HTTPS** for all requests
4. **Implement CSRF protection** for web applications
5. **Rotate API keys** regularly

---

## SDKs and Examples

### JavaScript/TypeScript Example

```typescript
// Initialize API client
const apiClient = {
  baseURL: 'https://your-domain.com',
  token: localStorage.getItem('jwt_token'),
  
  async request(endpoint: string, options: RequestInit = {}) {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`,
        ...options.headers,
      },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }
};

// Upload CV
const uploadCV = async (file: File) => {
  const formData = new FormData();
  formData.append('cv', file);
  
  return apiClient.request('/api/cv/upload', {
    method: 'POST',
    body: formData,
    headers: {}, // Don't set Content-Type for FormData
  });
};

// Get matched jobs
const getMatchedJobs = async (limit = 20) => {
  return apiClient.request(`/api/jobs/matched?limit=${limit}`);
};

// Apply to job
const applyToJob = async (jobId: string, notes: string) => {
  return apiClient.request(`/api/jobs/${jobId}/apply`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
};
```

### Python Example

```python
import requests
import json

class JobrAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }
    
    def upload_cv(self, file_path):
        with open(file_path, 'rb') as file:
            files = {'cv': file}
            response = requests.post(
                f'{self.base_url}/api/cv/upload',
                files=files,
                headers={'Authorization': self.headers['Authorization']}
            )
            return response.json()
    
    def get_matched_jobs(self, limit=20):
        response = requests.get(
            f'{self.base_url}/api/jobs/matched?limit={limit}',
            headers=self.headers
        )
        return response.json()
    
    def apply_to_job(self, job_id, notes):
        data = {'notes': notes}
        response = requests.post(
            f'{self.base_url}/api/jobs/{job_id}/apply',
            headers=self.headers,
            data=json.dumps(data)
        )
        return response.json()

# Usage
api = JobrAPI('https://your-domain.com', 'your_jwt_token')
matched_jobs = api.get_matched_jobs(limit=10)
```

---

## Changelog

### Version 1.0.0 (Current)
- 37 API endpoints across all platform features
- Enterprise-grade security (9/10 security score)
- Multi-provider authentication support
- AI-powered job matching and CV processing
- Dual payment processing (Stripe + PhonePe)
- Comprehensive error handling and rate limiting
- Production-ready webhook processing
- Advanced subscription management

---

*Last Updated: September 19, 2025*  
*API Version: 1.0.0*  
*Backend Status: Production Ready*