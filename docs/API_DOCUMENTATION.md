# Jobr Platform API Documentation

## Overview

This document provides comprehensive documentation for all API endpoints in the Jobr platform. The platform is built with Node.js + Express.js, featuring enterprise-grade security (9/10 security score), production-ready payment processing, AI-powered job matching, and multi-provider authentication.

**Base URL**: `https://your-domain.com`  
**API Version**: v1  
**Authentication**: JWT Bearer tokens with multi-provider support

## Table of Contents

1. [Authentication](#authentication)
2. [Authentication Endpoints](#authentication-endpoints)
3. [CV Management Endpoints](#cv-management-endpoints)
4. [Job Endpoints](#job-endpoints)
5. [Application Endpoints](#application-endpoints)
6. [Usage & Template Endpoints](#usage--template-endpoints)
7. [Subscription & Payment Endpoints](#subscription--payment-endpoints)
8. [Integration Status Endpoints](#integration-status-endpoints)
9. [Error Codes](#error-codes)
10. [Rate Limiting](#rate-limiting)

---

## Authentication

All protected endpoints require authentication via JWT Bearer tokens in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

**Supported Authentication Methods:**
- Email/Password (local)
- Google OAuth 2.0
- Replit Authentication
- Phone/OTP verification

---

## Authentication Endpoints

### 1. Email/Password Registration

**POST** `/api/auth/register`

Register a new user with email and password.

**Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "Free",
    "planStatus": "active",
    "verified": false
  },
  "token": "jwt_token_here"
}
```

**Errors:**
- 400: Validation errors
- 409: Email already exists (`EMAIL_EXISTS`)

**cURL Example:**
```bash
curl -X POST https://your-domain.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123!",
    "name": "John Doe"
  }'
```

---

### 2. Email/Password Login

**POST** `/api/auth/login`

Authenticate user with email and password.

**Headers:**
```
Content-Type: application/json
```

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
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "Free",
    "planStatus": "active",
    "verified": true
  },
  "token": "jwt_token_here"
}
```

**Errors:**
- 401: Invalid credentials (`INVALID_CREDENTIALS`)
- 423: Account locked (`ACCOUNT_LOCKED`)
- 429: Too many attempts (`TOO_MANY_ATTEMPTS`)

**Security Features:**
- Account lockout after failed attempts
- Rate limiting per IP/email
- Secure password hashing with bcrypt

---

### 3. Google OAuth Authentication

**GET** `/api/auth/google`

Initiates Google OAuth flow. Redirects to Google's authorization server.

**Response:**
Redirects to Google OAuth consent screen.

**GET** `/api/auth/google/callback`

Handles Google OAuth callback.

**Query Parameters:**
- `code`: Authorization code from Google
- `state`: CSRF protection token

**Response (302):**
Redirects to frontend with JWT token in query params or error message.

---

### 4. Phone Number Registration

**POST** `/api/auth/register/phone`

Register using phone number with OTP verification.

**Request Body:**
```json
{
  "phoneNumber": "+1234567890",
  "name": "John Doe"
}
```

**Response (200):**
```json
{
  "message": "OTP sent to phone number",
  "otpId": "otp_session_id",
  "expiresIn": 300
}
```

---

### 5. Phone OTP Verification

**POST** `/api/auth/verify-phone`

Verify phone registration with OTP code.

**Request Body:**
```json
{
  "otpId": "otp_session_id",
  "otp": "123456",
  "phoneNumber": "+1234567890"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "uuid-v4",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "plan": "Free",
    "planStatus": "active",
    "verified": true
  },
  "token": "jwt_token_here"
}
```

**Errors:**
- 400: Invalid OTP (`OTP_INVALID`)
- 410: OTP expired (`OTP_EXPIRED`)

---

### 6. Get Current User

**GET** `/api/auth/me` 🔒

Get current authenticated user information.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "user@example.com",
    "name": "John Doe",
    "plan": "Premium",
    "planStatus": "active",
    "verified": true,
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

---

### 7. Update User Profile

**PUT** `/api/auth/profile` 🔒

Update user profile information.

**Request Body:**
```json
{
  "name": "Updated Name",
  "email": "newemail@example.com"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "uuid-v4",
    "email": "newemail@example.com",
    "name": "Updated Name",
    "plan": "Premium",
    "planStatus": "active",
    "verified": true,
    "updatedAt": "2024-01-01T12:00:00.000Z"
  },
  "message": "Profile updated successfully"
}
```

---

### 8. Logout

**POST** `/api/auth/logout` 🔒

Logout current user and invalidate token.

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

---

## CV Management Endpoints

### 1. Upload CV

**POST** `/api/cv/upload` 🔒

Upload and process CV file (PDF, DOC, DOCX).

**Headers:**
```
Content-Type: multipart/form-data
Authorization: Bearer <jwt_token>
```

**Form Data:**
- `cv`: File (max 5MB, PDF/DOC/DOCX only)

**Response (201):**
```json
{
  "success": true,
  "cv": {
    "id": "cv_uuid",
    "userId": "user_uuid",
    "fileName": "resume.pdf",
    "fileSize": 1048576,
    "parsedContent": "Extracted CV text content...",
    "uploadedAt": "2024-01-01T00:00:00.000Z"
  },
  "message": "CV uploaded and processed successfully"
}
```

**Errors:**
- 400: Invalid file type (`INVALID_FILE_TYPE`)
- 413: File too large (`FILE_TOO_LARGE`)
- 422: No readable text found
- 402: Subscription limit reached (`SUBSCRIPTION_LIMIT_REACHED`)

**File Processing Features:**
- Automatic text extraction from PDF/DOC/DOCX
- File validation and sanitization  
- Virus scanning (in production)
- Content parsing and indexing

---

### 2. Get User's CVs

**GET** `/api/cv` 🔒

Retrieve all CVs for authenticated user.

**Response (200):**
```json
{
  "cvs": [
    {
      "id": "cv_uuid",
      "userId": "user_uuid", 
      "fileName": "resume.pdf",
      "fileSize": 1048576,
      "parsedContent": "CV content preview...",
      "uploadedAt": "2024-01-01T00:00:00.000Z",
      "isActive": true
    }
  ],
  "total": 1
}
```

---

### 3. Delete CV

**DELETE** `/api/cv/:id` 🔒

Delete a specific CV.

**Path Parameters:**
- `id`: CV UUID

**Response (200):**
```json
{
  "success": true,
  "message": "CV deleted successfully"
}
```

**Errors:**
- 404: CV not found (`CV_NOT_FOUND`)
- 403: Not authorized to delete this CV

---

## Job Endpoints

### 1. Get Jobs with Filtering

**GET** `/api/jobs` 🔒

Retrieve jobs with advanced filtering and search.

**Query Parameters:**
- `search`: Search term (job title, company, skills)
- `location`: Job location filter
- `remote`: Boolean for remote jobs only
- `salaryMin`: Minimum salary filter
- `salaryMax`: Maximum salary filter
- `experienceLevel`: junior|mid|senior
- `jobType`: full-time|part-time|contract|internship
- `page`: Page number (default: 1)
- `limit`: Results per page (default: 20, max: 100)
- `sortBy`: title|company|salary|postedDate
- `sortOrder`: asc|desc

**Response (200):**
```json
{
  "jobs": [
    {
      "id": "job_uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp Inc",
      "location": "San Francisco, CA",
      "remote": true,
      "salaryMin": 120000,
      "salaryMax": 180000,
      "experienceLevel": "senior",
      "jobType": "full-time",
      "description": "We are looking for...",
      "requirements": ["React", "Node.js", "PostgreSQL"],
      "postedDate": "2024-01-01T00:00:00.000Z",
      "applicationCount": 45,
      "isBookmarked": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8,
    "hasNext": true,
    "hasPrev": false
  },
  "filters": {
    "applied": {
      "location": "San Francisco, CA",
      "remote": true,
      "experienceLevel": "senior"
    }
  }
}
```

---

### 2. Get Job by ID

**GET** `/api/jobs/:id` 🔒

Get detailed information about a specific job.

**Path Parameters:**
- `id`: Job UUID

**Response (200):**
```json
{
  "job": {
    "id": "job_uuid",
    "title": "Senior Software Engineer", 
    "company": "TechCorp Inc",
    "companyLogo": "https://example.com/logo.png",
    "location": "San Francisco, CA",
    "remote": true,
    "salaryMin": 120000,
    "salaryMax": 180000,
    "currency": "USD",
    "experienceLevel": "senior",
    "jobType": "full-time",
    "description": "Detailed job description...",
    "requirements": ["React", "Node.js", "PostgreSQL"],
    "benefits": ["Health Insurance", "401k", "Remote Work"],
    "postedDate": "2024-01-01T00:00:00.000Z",
    "applicationDeadline": "2024-02-01T23:59:59.000Z",
    "applicationCount": 45,
    "isBookmarked": true,
    "hasApplied": false,
    "matchScore": 0.85,
    "aiInsights": {
      "skillsMatch": ["React: 95%", "Node.js: 90%"],
      "recommendations": ["Consider highlighting PostgreSQL experience"]
    }
  }
}
```

**Errors:**
- 404: Job not found (`JOB_NOT_FOUND`)

---

### 3. Get AI-Powered Job Matches

**GET** `/api/jobs/matches` 🔒

Get personalized job recommendations using AI matching.

**Query Parameters:**
- `cvId`: Specific CV to use for matching (optional)
- `limit`: Number of matches (default: 10, max: 50)

**Response (200):**
```json
{
  "matches": [
    {
      "job": {
        "id": "job_uuid",
        "title": "Senior Software Engineer",
        "company": "TechCorp Inc",
        "location": "San Francisco, CA",
        "salaryMin": 120000,
        "salaryMax": 180000
      },
      "matchScore": 0.92,
      "matchReasons": [
        "Strong React experience match (95%)",
        "Node.js skills align with requirements (90%)",
        "Senior-level experience matches requirement"
      ],
      "skillsAnalysis": {
        "matching": ["React", "Node.js", "JavaScript"],
        "missing": ["PostgreSQL", "Docker"],
        "recommendations": ["Consider learning PostgreSQL for better match"]
      }
    }
  ],
  "cvUsed": {
    "id": "cv_uuid",
    "fileName": "resume.pdf"
  },
  "totalMatches": 25
}
```

**Features:**
- OpenAI (current models, default gpt-4-turbo) powered analysis
- Real-time skill matching
- Personalized recommendations
- Cached results for performance

---

### 4. Bookmark Job

**POST** `/api/jobs/:id/bookmark` 🔒

Bookmark or unbookmark a job.

**Path Parameters:**
- `id`: Job UUID

**Response (200):**
```json
{
  "success": true,
  "bookmarked": true,
  "message": "Job bookmarked successfully"
}
```

---

## Application Endpoints

### 1. Apply for Job

**POST** `/api/applications/apply` 🔒

Submit job application with AI-generated cover letter.

**Request Body:**
```json
{
  "jobId": "job_uuid",
  "cvId": "cv_uuid",
  "customMessage": "I am excited to apply...",
  "generateCoverLetter": true,
  "coverLetterStyle": "professional" // professional|creative|casual
}
```

**Response (201):**
```json
{
  "success": true,
  "application": {
    "id": "application_uuid",
    "jobId": "job_uuid",
    "cvId": "cv_uuid",
    "userId": "user_uuid",
    "status": "submitted",
    "submittedAt": "2024-01-01T00:00:00.000Z",
    "coverLetter": "AI-generated cover letter content...",
    "customMessage": "I am excited to apply..."
  },
  "message": "Application submitted successfully"
}
```

**Errors:**
- 400: Missing CV (`CV_REQUIRED`)
- 409: Already applied (`DUPLICATE_APPLICATION`)
- 402: Subscription limit reached (`SUBSCRIPTION_LIMIT_REACHED`)

**AI Features:**
- Automatic cover letter generation
- Application optimization suggestions
- Skill gap analysis

---

### 2. Get User Applications

**GET** `/api/applications` 🔒

Retrieve all applications for authenticated user.

**Query Parameters:**
- `status`: submitted|reviewing|interview|rejected|accepted
- `page`: Page number (default: 1)  
- `limit`: Results per page (default: 20)
- `sortBy`: submittedAt|status|company
- `sortOrder`: asc|desc

**Response (200):**
```json
{
  "applications": [
    {
      "id": "application_uuid",
      "job": {
        "id": "job_uuid",
        "title": "Senior Software Engineer",
        "company": "TechCorp Inc",
        "location": "San Francisco, CA"
      },
      "cv": {
        "id": "cv_uuid", 
        "fileName": "resume.pdf"
      },
      "status": "reviewing",
      "submittedAt": "2024-01-01T00:00:00.000Z",
      "lastUpdated": "2024-01-02T00:00:00.000Z",
      "coverLetter": "Cover letter preview...",
      "statusHistory": [
        {
          "status": "submitted",
          "timestamp": "2024-01-01T00:00:00.000Z"
        },
        {
          "status": "reviewing", 
          "timestamp": "2024-01-02T00:00:00.000Z"
        }
      ]
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  },
  "statusCounts": {
    "submitted": 2,
    "reviewing": 2,
    "interview": 0,
    "rejected": 1,
    "accepted": 0
  }
}
```

---

### 3. Get Application by ID

**GET** `/api/applications/:id` 🔒

Get detailed information about a specific application.

**Response (200):**
```json
{
  "application": {
    "id": "application_uuid",
    "job": {
      "id": "job_uuid",
      "title": "Senior Software Engineer",
      "company": "TechCorp Inc",
      "description": "Full job description..."
    },
    "cv": {
      "id": "cv_uuid",
      "fileName": "resume.pdf",
      "content": "CV content..."
    },
    "status": "reviewing",
    "submittedAt": "2024-01-01T00:00:00.000Z",
    "coverLetter": "Full cover letter content...",
    "customMessage": "Personal message...",
    "aiAnalysis": {
      "matchScore": 0.87,
      "strengths": ["React experience", "Team leadership"],
      "improvements": ["Highlight PostgreSQL skills"]
    },
    "statusHistory": [...],
    "notes": []
  }
}
```

---

### 4. Update Application Status

**PATCH** `/api/applications/:id/status` 🔒

Update application status (typically used by employers or system).

**Request Body:**
```json
{
  "status": "interview",
  "notes": "Scheduled for technical interview on Friday"
}
```

**Response (200):**
```json
{
  "success": true,
  "application": {
    "id": "application_uuid", 
    "status": "interview",
    "lastUpdated": "2024-01-03T00:00:00.000Z"
  }
}
```

---

### 5. Withdraw Application

**DELETE** `/api/applications/:id` 🔒

Withdraw/cancel job application.

**Response (200):**
```json
{
  "success": true,
  "message": "Application withdrawn successfully"
}
```

---

### 6. Get Application Analytics

**GET** `/api/applications/analytics` 🔒

Get user's application analytics and statistics.

**Response (200):**
```json
{
  "analytics": {
    "totalApplications": 15,
    "statusBreakdown": {
      "submitted": 5,
      "reviewing": 4,
      "interview": 2,
      "rejected": 3,
      "accepted": 1
    },
    "successRate": 0.20,
    "averageResponseTime": 5.2,
    "monthlyStats": [
      {
        "month": "2024-01",
        "applications": 8,
        "interviews": 2,
        "offers": 1
      }
    ],
    "topCompanies": [
      {
        "company": "TechCorp Inc",
        "applications": 3,
        "interviews": 1
      }
    ],
    "insights": [
      "Your interview rate is above average!",
      "Consider applying to more startups - higher success rate"
    ]
  }
}
```

---

### 7. Bulk Application Actions

**POST** `/api/applications/bulk` 🔒

Perform bulk actions on multiple applications.

**Request Body:**
```json
{
  "applicationIds": ["uuid1", "uuid2", "uuid3"],
  "action": "withdraw", // withdraw|archive|mark_read
  "reason": "No longer interested"
}
```

**Response (200):**
```json
{
  "success": true,
  "processed": 3,
  "failed": 0,
  "results": [
    {
      "id": "uuid1",
      "success": true
    }
  ]
}
```

---

### 8. Get Application Templates

**GET** `/api/applications/templates` 🔒

Get AI-powered application templates and suggestions.

**Query Parameters:**
- `jobType`: Type of job for template suggestions
- `industry`: Industry for customized templates

**Response (200):**
```json
{
  "templates": [
    {
      "id": "template_uuid",
      "name": "Software Engineer Cover Letter",
      "type": "cover_letter",
      "industry": "technology",
      "template": "Dear Hiring Manager...",
      "variables": ["{{company}}", "{{position}}", "{{skills}}"],
      "tags": ["professional", "tech", "senior"]
    }
  ],
  "customTemplates": []
}
```

---

## Usage & Template Endpoints

### 1. Get Usage Statistics

**GET** `/api/usage/stats` 🔒

Get current user's API usage statistics.

**Response (200):**
```json
{
  "usage": {
    "currentPeriod": {
      "startDate": "2024-01-01T00:00:00.000Z",
      "endDate": "2024-01-31T23:59:59.000Z",
      "applications": 12,
      "cvUploads": 2,
      "aiMatches": 45,
      "coverLettersGenerated": 8
    },
    "limits": {
      "applications": 50,
      "cvUploads": 5,
      "aiMatches": 100,
      "coverLettersGenerated": 20
    },
    "plan": {
      "name": "Premium",
      "tier": "premium",
      "billingCycle": "monthly"
    },
    "resetDate": "2024-02-01T00:00:00.000Z"
  }
}
```

---

### 2. Get Cover Letter Templates

**GET** `/api/templates/cover-letters` 🔒

Get available cover letter templates.

**Query Parameters:**
- `industry`: Filter by industry
- `style`: professional|creative|casual
- `experience`: junior|mid|senior

**Response (200):**
```json
{
  "templates": [
    {
      "id": "template_uuid",
      "name": "Professional Software Engineer",
      "industry": "technology",
      "style": "professional",
      "experienceLevel": "senior",
      "preview": "Dear Hiring Manager, I am writing to express my interest...",
      "variables": ["{{name}}", "{{company}}", "{{position}}"],
      "rating": 4.8,
      "usageCount": 1250
    }
  ],
  "totalTemplates": 25
}
```

---

### 3. Generate Cover Letter

**POST** `/api/templates/generate-cover-letter` 🔒

Generate personalized cover letter using AI.

**Request Body:**
```json
{
  "jobId": "job_uuid",
  "cvId": "cv_uuid", 
  "templateId": "template_uuid",
  "style": "professional",
  "tone": "enthusiastic",
  "customInstructions": "Emphasize leadership experience"
}
```

**Response (200):**
```json
{
  "coverLetter": {
    "content": "Generated cover letter content...",
    "wordCount": 247,
    "estimatedReadTime": "1 min",
    "matchingSkills": ["React", "Node.js", "Leadership"],
    "suggestions": [
      "Consider adding specific project examples",
      "Mention the company's recent product launch"
    ]
  },
  "metadata": {
    "templateUsed": "Professional Software Engineer",
    "aiModel": "gpt-4",
    "generationTime": 2.3,
    "confidence": 0.89
  }
}
```

**Errors:**
- 402: Usage limit exceeded (`SUBSCRIPTION_LIMIT_REACHED`)
- 503: AI service unavailable (`INTEGRATION_UNAVAILABLE`)

---

## Subscription & Payment Endpoints

### 1. Get Available Plans

**GET** `/api/subscription/plans` 🔒

Get all available subscription plans.

**Response (200):**
```json
{
  "plans": [
    {
      "id": "free",
      "name": "Free",
      "price": 0,
      "currency": "USD",
      "interval": "month",
      "features": {
        "applications": 5,
        "cvUploads": 1,
        "aiMatches": 10,
        "coverLetters": 2,
        "support": "community"
      },
      "limits": {
        "applications": 5,
        "cvUploads": 1,
        "aiMatches": 10,
        "coverLetters": 2
      },
      "popular": false
    },
    {
      "id": "premium",
      "name": "Premium",
      "price": 29.99,
      "currency": "USD", 
      "interval": "month",
      "stripeId": "price_premium_monthly",
      "features": {
        "applications": "unlimited",
        "cvUploads": 10,
        "aiMatches": "unlimited",
        "coverLetters": "unlimited",
        "support": "priority",
        "analytics": true,
        "customTemplates": true
      },
      "limits": {
        "applications": -1,
        "cvUploads": 10,
        "aiMatches": -1,
        "coverLetters": -1
      },
      "popular": true,
      "discount": {
        "annual": 20,
        "annualPrice": 287.88
      }
    }
  ]
}
```

---

### 2. Get Current Subscription

**GET** `/api/subscription` 🔒

Get user's current subscription details.

**Response (200):**
```json
{
  "subscription": {
    "id": "sub_uuid",
    "userId": "user_uuid",
    "planId": "premium",
    "status": "active",
    "currentPeriodStart": "2024-01-01T00:00:00.000Z",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z",
    "cancelAtPeriodEnd": false,
    "stripeSubscriptionId": "sub_stripe_id",
    "paymentMethod": "stripe",
    "plan": {
      "name": "Premium",
      "price": 29.99,
      "currency": "USD",
      "features": {...}
    },
    "usage": {
      "applications": 12,
      "cvUploads": 2,
      "aiMatches": 45,
      "coverLetters": 8
    }
  }
}
```

**Response (200) - No Subscription:**
```json
{
  "subscription": null,
  "defaultPlan": {
    "id": "free",
    "name": "Free",
    "features": {...}
  }
}
```

---

### 3. Create Payment Intent (Stripe)

**POST** `/api/subscription/create-payment-intent` 🔒

Create Stripe payment intent for subscription.

**Request Body:**
```json
{
  "planId": "premium",
  "paymentMethodId": "pm_stripe_id"
}
```

**Response (200):**
```json
{
  "success": true,
  "clientSecret": "pi_stripe_client_secret",
  "subscription": {
    "id": "sub_uuid",
    "status": "active",
    "planId": "premium",
    "currentPeriodEnd": "2024-02-01T00:00:00.000Z"
  }
}
```

**Errors:**
- 400: Invalid plan (`INVALID_PLAN`)
- 402: Payment failed (`PAYMENT_FAILED`)
- 503: Stripe not configured (`STRIPE_NOT_CONFIGURED`)

---

### 4. Create PhonePe Payment

**POST** `/api/subscription/phonepe/create-payment` 🔒

Create PhonePe payment for subscription (India market).

**Request Body:**
```json
{
  "planId": "premium",
  "userId": "user_uuid",
  "amount": 2999
}
```

**Response (200):**
```json
{
  "success": true,
  "paymentUrl": "https://phonepe.com/pay/...",
  "merchantTransactionId": "mt_uuid",
  "expiresAt": "2024-01-01T01:00:00.000Z",
  "qrCode": "data:image/png;base64,..."
}
```

---

### 5. Cancel Subscription

**POST** `/api/subscription/cancel` 🔒

Cancel current subscription.

**Request Body:**
```json
{
  "cancelAtPeriodEnd": true,
  "reason": "Not using enough features"
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

### 6. Check Payment Status

**GET** `/api/subscription/payment-status/:merchantTransactionId` 🔒

Check PhonePe payment status.

**Path Parameters:**
- `merchantTransactionId`: PhonePe transaction ID

**Response (200):**
```json
{
  "success": true,
  "status": {
    "code": "PAYMENT_SUCCESS",
    "message": "Payment completed successfully",
    "transactionId": "phonePe_transaction_id",
    "amount": 2999,
    "currency": "INR"
  },
  "merchantTransactionId": "mt_uuid"
}
```

**Status Codes:**
- `PAYMENT_PENDING`: Payment in progress
- `PAYMENT_SUCCESS`: Payment completed
- `PAYMENT_FAILED`: Payment failed
- `PAYMENT_EXPIRED`: Payment session expired

---

## Integration Status Endpoints

### 1. Get Integration Status

**GET** `/api/integrations/status`

Get status of all external service integrations.

**Response (200):**
```json
{
  "integrations": {
    "openai": {
      "available": true,
      "status": "operational",
      "model": "gpt-4",
      "lastCheck": "2024-01-01T00:00:00.000Z",
      "responseTime": 1.2
    },
    "stripe": {
      "available": true,
      "status": "operational", 
      "environment": "live",
      "lastCheck": "2024-01-01T00:00:00.000Z"
    },
    "phonepe": {
      "available": true,
      "status": "operational",
      "environment": "production",
      "lastCheck": "2024-01-01T00:00:00.000Z"
    },
    "sendgrid": {
      "available": true,
      "status": "operational",
      "lastCheck": "2024-01-01T00:00:00.000Z"
    },
    "google_oauth": {
      "available": true,
      "status": "operational",
      "lastCheck": "2024-01-01T00:00:00.000Z"
    }
  },
  "overallStatus": "operational",
  "lastUpdated": "2024-01-01T00:00:00.000Z"
}
```

**Status Values:**
- `operational`: Service working normally
- `degraded`: Service working with issues
- `outage`: Service unavailable
- `maintenance`: Scheduled maintenance

---

## Error Codes

All API endpoints return standardized error responses:

```json
{
  "message": "Human-readable error message",
  "code": "ERROR_CODE_CONSTANT",
  "details": {},
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Authentication Errors
- `INVALID_CREDENTIALS`: Invalid email or password
- `ACCOUNT_LOCKED`: Account temporarily locked
- `TOKEN_EXPIRED`: JWT token has expired
- `TOKEN_INVALID`: JWT token is invalid
- `UNAUTHORIZED`: Authentication required
- `FORBIDDEN`: Insufficient permissions
- `TOO_MANY_ATTEMPTS`: Rate limit exceeded
- `SESSION_EXPIRED`: Session has expired

### Validation Errors
- `VALIDATION_ERROR`: Request validation failed
- `INVALID_PARAMETER`: Invalid parameter value
- `REQUIRED_FIELD_MISSING`: Required field not provided

### Resource Errors
- `NOT_FOUND`: Resource not found
- `USER_NOT_FOUND`: User not found
- `JOB_NOT_FOUND`: Job not found
- `APPLICATION_NOT_FOUND`: Application not found
- `CV_NOT_FOUND`: CV not found
- `DUPLICATE_RESOURCE`: Resource already exists
- `DUPLICATE_APPLICATION`: Already applied to this job

### Subscription Errors
- `SUBSCRIPTION_LIMIT_REACHED`: Usage limit exceeded
- `CV_REQUIRED`: CV upload required
- `INVALID_PLAN`: Invalid subscription plan
- `PAYMENT_FAILED`: Payment processing failed
- `PAYMENT_CREATE_FAILED`: Failed to create payment

### File Upload Errors
- `INVALID_FILE_TYPE`: Unsupported file format
- `FILE_TOO_LARGE`: File exceeds size limit

### Integration Errors
- `INTEGRATION_UNAVAILABLE`: External service unavailable
- `STRIPE_NOT_CONFIGURED`: Stripe not configured
- `SENDGRID_NOT_CONFIGURED`: SendGrid not configured
- `GOOGLE_OAUTH_UNAVAILABLE`: Google OAuth unavailable

### System Errors
- `INTERNAL_ERROR`: Internal server error
- `RATE_LIMIT_EXCEEDED`: Rate limit exceeded

---

## Rate Limiting

The API implements comprehensive rate limiting to ensure fair usage:

### Global Rate Limits
- **General API**: 1000 requests per hour per IP
- **Authentication**: 10 attempts per minute per IP
- **File Upload**: 5 uploads per minute per user
- **AI Services**: 50 requests per hour per user

### Rate Limit Headers
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
X-RateLimit-RetryAfter: 60
```

### Rate Limit Response (429)
```json
{
  "message": "Rate limit exceeded. Try again in 60 seconds.",
  "code": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 60,
  "limit": 1000,
  "remaining": 0,
  "resetTime": "2024-01-01T01:00:00.000Z"
}
```

---

## Webhook Endpoints

### 1. Stripe Webhooks

**POST** `/webhooks/stripe`

Handle Stripe webhook events for payment processing.

**Headers:**
```
stripe-signature: webhook_signature
```

**Supported Events:**
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

### 2. PhonePe Webhooks

**POST** `/webhooks/phonepe`

Handle PhonePe webhook events for payment processing.

**Headers:**
```
X-VERIFY: verification_checksum
```

**Supported Events:**
- `PAYMENT_SUCCESS`
- `PAYMENT_FAILED`
- `PAYMENT_CANCELLED`

---

## SDK Examples

### JavaScript/Node.js
```javascript
// Initialize API client
const JobrAPI = require('./jobr-api-client');
const client = new JobrAPI({
  baseURL: 'https://your-domain.com',
  apiKey: 'your-jwt-token'
});

// Apply for a job
const application = await client.applications.apply({
  jobId: 'job_uuid',
  cvId: 'cv_uuid',
  generateCoverLetter: true
});

console.log('Application submitted:', application.id);
```

### Python
```python
import requests

# Set up authentication
headers = {
    'Authorization': 'Bearer your-jwt-token',
    'Content-Type': 'application/json'
}

# Get job matches
response = requests.get(
    'https://your-domain.com/api/jobs/matches',
    headers=headers,
    params={'limit': 10}
)

matches = response.json()['matches']
for match in matches:
    print(f"Job: {match['job']['title']} - Match: {match['matchScore']}")
```

---

## Postman Collection

Import our complete Postman collection for testing:

**Collection URL**: `https://your-domain.com/api/postman-collection.json`

**Environment Variables:**
- `baseUrl`: https://your-domain.com
- `authToken`: Your JWT token
- `userId`: Your user ID

---

## Support

- **API Documentation**: https://docs.jobr-platform.com
- **Developer Portal**: https://developers.jobr-platform.com  
- **Status Page**: https://status.jobr-platform.com
- **Support Email**: api-support@jobr-platform.com

**Rate Limit Support**: If you need higher rate limits, please contact our enterprise team at enterprise@jobr-platform.com.

---

*Last Updated: December 19, 2024*  
*API Version: 1.0*  
*Documentation Version: 1.2*