# Jobr Backend Architecture Documentation

## Overview
The Jobr backend is built on Node.js with Express.js, featuring a comprehensive system for AI-powered job matching, user management, payment processing, and file handling. The architecture follows modern best practices with clear separation of concerns and robust error handling.

## 🏗️ System Architecture

### Core Components

#### 1. Database Layer (`shared/schema.ts`)
**PostgreSQL Database with Drizzle ORM**

**Core Tables:**
- `users` - User profiles, subscription info, usage tracking
- `jobs` - Job listings with requirements and metadata  
- `applications` - Job applications with match scores and status
- `cvs` - CV storage and parsed data
- `subscriptions` - Subscription history and billing events
- `sessions` - Session management for Replit Auth
- `apiUsage` - API call tracking and analytics
- `templates` - CV and cover letter templates
- `authAccounts` - OAuth account linkage
- `otpCodes` - OTP verification codes
- `stripeEvents` - Webhook event processing

#### 2. Storage Layer (`server/storage.ts`)
**IStorage Interface Implementation**

**Key Operations:**
- User management (CRUD, subscriptions, billing)
- CV processing (upload, parse, store)
- Job management (listings, applications, matching)
- Authentication (accounts, OTP, sessions)
- Payment processing (Stripe events, subscription tracking)

#### 3. Authentication System (`server/authService.ts`, `server/replitAuth.ts`)
**Multi-Provider Authentication**

**Supported Providers:**
- **Replit Auth**: Native Replit authentication
- **Google OAuth**: Social authentication 
- **Local Auth**: Email/password with JWT tokens
- **OTP Verification**: Phone/email verification

**Features:**
- JWT token management
- Session handling
- Rate limiting (5 requests/15min for auth routes)
- Account linking across providers

#### 4. AI Services Integration

##### OpenAI Service (`server/openaiService.ts`)
**Model**: GPT-5 (Latest as of August 7, 2025)

**Capabilities:**
- CV parsing and data extraction
- Structured JSON responses
- Error handling with fallbacks

##### Job Matching Service (`server/jobMatchingService.ts`)
**AI-Powered Matching Algorithm**

**Features:**
- Skills compatibility analysis
- Experience level matching
- Location preference matching
- Salary expectation alignment
- Comprehensive match scoring (0-100)
- Fallback to basic matching if AI unavailable

#### 5. Payment Processing

##### Stripe Integration (`server/stripe.ts`)
**Features:**
- Subscription management
- Webhook processing
- Customer billing
- Plan upgrades/downgrades

##### PhonePe Integration (`server/phonepe.ts`)
**Features:**
- Indian market payment processing
- Webhook handling
- Transaction verification
- Test/production environment support

#### 6. File Processing (`server/fileProcessor.ts`)
**CV Upload & Processing**

**Supported Formats:**
- PDF files
- Microsoft Word (.doc, .docx)
- 5MB size limit
- Memory storage with multer

**Processing Pipeline:**
1. File validation
2. Text extraction
3. AI-powered parsing
4. Structured data storage

## 🔧 Current Configuration Status

### ✅ Working Integrations
- **Database**: PostgreSQL connected and operational
- **Replit Auth**: Fully configured and working
- **PhonePe**: Test credentials active, production-ready
- **File Upload**: CV processing pipeline functional
- **AI Services**: OpenAI integration ready (requires API key)

### ⚠️ Pending Configuration
From application logs analysis:

```
❌ Stripe not initialized: STRIPE_SECRET_KEY environment variable not found
❌ Google OAuth not configured: Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET  
⚠️  PhonePe using test credentials (production keys needed for live transactions)
⚠️  OpenAI API key needed for AI functionality
```

## 📊 API Endpoints Structure

### Authentication Routes
```
POST /api/auth/register - User registration
POST /api/auth/login - User login  
GET /api/auth/me - Get current user
POST /api/auth/logout - User logout
GET /api/auth/google - Google OAuth initiation
GET /api/auth/google/callback - Google OAuth callback
```

### User Management Routes
```
GET /api/users/profile - Get user profile
PUT /api/users/profile - Update user profile
GET /api/users/usage - Get usage statistics
```

### CV Management Routes  
```
POST /api/cv/upload - Upload CV file
GET /api/cv - Get user's CV
PUT /api/cv - Update CV data
DELETE /api/cv - Delete CV
```

### Job & Application Routes
```
GET /api/jobs - Get job listings
POST /api/jobs - Create job listing (admin)
GET /api/jobs/:id - Get specific job
POST /api/applications - Apply to job
GET /api/applications - Get user applications  
PUT /api/applications/:id - Update application status
DELETE /api/applications/:id - Delete application
```

### Payment Routes
```
POST /api/stripe/create-checkout-session - Create Stripe checkout
POST /api/stripe/webhook - Handle Stripe webhooks
POST /api/phonepe/create-payment - Create PhonePe payment
POST /api/phonepe/webhook - Handle PhonePe webhooks
GET /api/billing/subscription - Get subscription info
POST /api/billing/cancel - Cancel subscription
```

## 🛡️ Security Features

### Rate Limiting
- **Authentication routes**: 5 requests per 15 minutes
- **General routes**: 100 requests per 15 minutes
- **File uploads**: 5MB size limit

### Input Validation
- Zod schema validation for all endpoints
- File type restrictions (PDF, DOC, DOCX only)
- SQL injection prevention with parameterized queries

### Authentication Security
- JWT token expiration handling
- Secure session management
- OAuth state verification
- OTP-based verification system

## 🔄 Data Flow Architecture

### CV Processing Flow
```
User Upload → File Validation → Text Extraction → AI Parsing → Database Storage → Job Matching
```

### Job Application Flow  
```
Job Selection → CV Match Analysis → Application Preparation → Payment Verification → Application Submission
```

### Payment Processing Flow
```
Plan Selection → Payment Gateway → Webhook Verification → Subscription Update → Feature Access
```

## 📈 Performance & Monitoring

### API Usage Tracking
- Daily API call limits per user
- Usage analytics and reporting
- Rate limiting enforcement
- Cost monitoring for AI services

### Database Optimization
- Indexed columns for performance
- Foreign key constraints for data integrity
- Efficient query patterns with Drizzle ORM
- Connection pooling

### Error Handling
- Comprehensive try-catch blocks
- Fallback mechanisms for AI services
- Webhook idempotency handling
- Detailed logging for debugging

## 🔧 Environment Configuration

### Required Environment Variables

#### Production Environment
```bash
# Database
DATABASE_URL=postgresql://...

# Authentication  
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# AI Services
OPENAI_API_KEY=sk-...

# Payment Processing
STRIPE_SECRET_KEY=sk_live_...
PHONEPE_MERCHANT_ID=your_merchant_id
PHONEPE_SALT_KEY=your_salt_key
PHONEPE_SALT_INDEX=1

# Email Services (if using)
SENDGRID_API_KEY=SG...
```

#### Development Environment
```bash
# Development uses automatic fallbacks:
# - PhonePe test credentials 
# - In-memory sessions
# - Mock payment processing
```

## 🚀 Deployment Architecture

### Current Setup
- **Platform**: Replit Autoscale Deployment
- **Database**: Built-in PostgreSQL (Neon-backed)
- **File Storage**: In-memory processing (suitable for CV files)
- **Scaling**: Automatic based on traffic
- **SSL**: Automatic certificate management

### Production Considerations
- Environment variable management through Replit secrets
- Database migrations via `npm run db:push`
- Webhook endpoint security
- API rate limiting and abuse prevention

## 📋 Integration Requirements Summary

### Immediate Action Items
1. **Configure Stripe**: Add STRIPE_SECRET_KEY for payment processing
2. **Setup Google OAuth**: Add Google client credentials for social login
3. **Production Payment Gateways**: Switch to live payment credentials
4. **OpenAI API**: Add API key for AI-powered features

### Development Priorities
1. API endpoint testing and validation
2. Error handling enhancement  
3. Performance monitoring implementation
4. Comprehensive integration testing

## 🎯 System Strengths

### Robust Architecture
- Clean separation of concerns
- Type-safe development with TypeScript
- Comprehensive error handling
- Scalable database design

### AI Integration
- Advanced job matching algorithms
- Intelligent CV parsing
- Fallback mechanisms for reliability
- Cost-effective API usage tracking

### Payment Flexibility  
- Multiple payment gateways (global coverage)
- Subscription management
- Webhook security and idempotency
- Test/production environment support

### Security-First Design
- Multiple authentication providers
- Rate limiting and abuse prevention
- Input validation and sanitization
- Secure file handling

---

*Last Updated: Based on backend assessment as of current deployment*
*Status: Production-ready with pending integrations*