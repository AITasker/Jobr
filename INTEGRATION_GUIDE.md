# Jobr Platform Integration Guide

## Overview

This guide provides comprehensive setup and configuration instructions for all third-party service integrations in the Jobr platform. Each integration includes production-ready configurations, security best practices, and troubleshooting guidance.

**Integration Overview:**
- **5 Core Integrations**: OpenAI, Stripe, PhonePe, SendGrid, Google OAuth
- **Security**: Enterprise-grade protection with comprehensive validation
- **Fallback Systems**: Every integration has robust fallback mechanisms
- **Production Ready**: Full webhook security and error handling

---

## Table of Contents

1. [Integration Overview](#integration-overview)
2. [OpenAI Integration (AI Services)](#openai-integration-ai-services)
3. [Stripe Integration (International Payments)](#stripe-integration-international-payments)
4. [PhonePe Integration (Indian Payments)](#phonepe-integration-indian-payments)
5. [SendGrid Integration (Email Services)](#sendgrid-integration-email-services)
6. [Google OAuth Integration (Social Login)](#google-oauth-integration-social-login)
7. [Environment Configuration](#environment-configuration)
8. [Development vs Production](#development-vs-production)
9. [Security Best Practices](#security-best-practices)
10. [Troubleshooting Guide](#troubleshooting-guide)

---

## Integration Overview

### Integration Status Endpoint

**GET** `/api/integrations/status`

Check the current status of all integrations:

```bash
curl https://your-domain.com/api/integrations/status
```

**Response:**
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

## OpenAI Integration (AI Services)

### Overview

OpenAI powers the core AI functionality including CV parsing, job matching, and cover letter generation using current OpenAI models.

**Features:**
- CV content analysis and structured data extraction
- Intelligent job matching with compatibility scoring
- Personalized cover letter generation
- CV tailoring for specific jobs
- Skills analysis and recommendations

### Setup Instructions

#### 1. Obtain OpenAI API Key

1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-proj-`)

#### 2. Configure Environment Variables

```bash
# Required for AI functionality
OPENAI_API_KEY=sk-proj-your_actual_openai_api_key_here

# Optional: Override default model (defaults to gpt-4-turbo)
OPENAI_MODEL=gpt-4-turbo

# Optional: Override token limits (defaults to 4000)
OPENAI_MAX_TOKENS=4000
```

#### 3. Verify Integration

```bash
# Check integration status
curl https://your-domain.com/api/integrations/status | jq '.integrations.openai'
```

### Implementation Details

**Cost Optimization Features:**
- **Response Caching**: 30-minute TTL for similar requests
- **Token Monitoring**: Real-time usage tracking
- **Fallback Processing**: Basic algorithms when AI unavailable
- **Batch Processing**: Optimized API calls for multiple operations

**Performance Features:**
- Cost reduction through intelligent caching
- High cache hit rate for similar CV content
- Optimized response times for cached results
- Performance monitoring and optimization

### Code Example

```typescript
// Check AI availability
if (OpenAIService.isAvailable()) {
  const parsedCV = await OpenAIService.parseCVContent(cvText);
  console.log('AI parsing successful:', parsedCV);
} else {
  console.log('Using fallback parsing');
  const parsedCV = OpenAIService.parseCVContentFallback(cvText);
}
```

### Troubleshooting

**Common Issues:**

1. **"OpenAI API key not configured"**
   - Verify `OPENAI_API_KEY` environment variable is set
   - Ensure API key is valid and active
   - Check account billing status

2. **"Rate limit exceeded"**
   - Implement exponential backoff
   - Monitor token usage dashboard
   - Consider upgrading OpenAI plan

3. **"AI service temporarily unavailable"**
   - Check OpenAI status page
   - Verify internet connectivity
   - Fallback processing will activate automatically

---

## Stripe Integration (International Payments)

### Overview

Stripe handles international payment processing for Premium and Pro subscriptions with comprehensive webhook support and PCI compliance.

**Features:**
- International credit/debit card processing
- Subscription management and billing
- Multiple payment methods (Apple Pay, Google Pay, etc.)
- Automatic tax calculation
- Billing portal for customers

### Setup Instructions

#### 1. Create Stripe Account

1. Visit [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account or sign in
3. Complete business verification
4. Navigate to Developers > API Keys

#### 2. Configure API Keys

**Test Environment:**
```bash
# Test credentials (for development)
STRIPE_PUBLISHABLE_KEY=pk_test_your_test_publishable_key
STRIPE_SECRET_KEY=sk_test_your_test_secret_key
```

**Production Environment:**
```bash
# Live credentials (for production)
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_publishable_key
STRIPE_SECRET_KEY=sk_live_your_live_secret_key
```

#### 3. Configure Webhooks

1. In Stripe Dashboard, go to Developers > Webhooks
2. Create new webhook endpoint
3. Set endpoint URL: `https://your-domain.com/api/stripe/webhook`
4. Select events to listen for:
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `payment_intent.succeeded`

5. Copy webhook signing secret

```bash
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_signing_secret
```

#### 4. Configure Products and Prices

Create products in Stripe Dashboard:

```bash
# Premium Plan
Product ID: prod_premium
Price ID: price_premium_monthly
Amount: $4999 (in cents)
Currency: USD
Interval: month

# Pro Plan  
Product ID: prod_pro
Price ID: price_pro_monthly
Amount: $9999 (in cents)
Currency: USD
Interval: month
```

### Implementation Details

**Subscription Flow:**
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Stripe
    
    User->>Frontend: Select Plan
    Frontend->>Backend: Create Payment Intent
    Backend->>Stripe: Create Customer & Payment
    Stripe-->>Backend: Client Secret
    Backend-->>Frontend: Payment Details
    Frontend->>Stripe: Complete Payment
    Stripe->>Backend: Webhook Event
    Backend->>Backend: Activate Subscription
    Stripe-->>Frontend: Success Redirect
```

**Security Features:**
- Webhook signature verification
- Idempotency protection
- PCI compliance (no card data stored)
- Secure customer management

### Webhook Security

**Verification Implementation:**
```typescript
app.post('/api/stripe/webhook', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    
    // Process webhook event
    await processStripeWebhook(event);
    
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send('Webhook Error');
  }
});
```

### Troubleshooting

**Common Issues:**

1. **"Stripe not configured"**
   - Verify all Stripe environment variables are set
   - Check API key format (test keys start with `sk_test_`, live with `sk_live_`)
   - Ensure account is activated

2. **"Webhook signature verification failed"**
   - Verify `STRIPE_WEBHOOK_SECRET` is correct
   - Check webhook endpoint URL
   - Ensure raw body is passed to webhook handler

3. **"Payment failed"**
   - Check Stripe Dashboard for error details
   - Verify product and price IDs exist
   - Check account restrictions

---

## PhonePe Integration (Indian Payments)

### Overview

PhonePe handles payment processing for the Indian market with support for UPI, wallets, cards, and net banking.

**Features:**
- UPI payments (most popular in India)
- Digital wallets (PhonePe, Paytm, etc.)
- Credit/debit cards
- Net banking
- EMI options

### Setup Instructions

#### 1. PhonePe Business Account

1. Visit [PhonePe Business](https://business.phonepe.com/)
2. Register business account
3. Complete KYC verification
4. Get API credentials from dashboard

#### 2. Configure Environment Variables

**Test Environment (Sandbox):**
```bash
PHONEPE_MERCHANT_ID=PGTESTPAYUAT86
PHONEPE_SALT_KEY=96434309-7796-489d-8924-ab56988a6076
PHONEPE_SALT_INDEX=1
PHONEPE_ENVIRONMENT=SANDBOX
```

**Production Environment:**
```bash
PHONEPE_MERCHANT_ID=your_production_merchant_id
PHONEPE_SALT_KEY=your_production_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENVIRONMENT=PRODUCTION
```

#### 3. Configure Webhooks

Set webhook URL in PhonePe dashboard:
```
https://your-domain.com/api/phonepe/webhook
```

### Implementation Details

**Payment Flow:**
```mermaid
sequenceDiagram
    participant User
    participant Backend
    participant PhonePe
    
    User->>Backend: Select Plan
    Backend->>PhonePe: Create Payment Request
    PhonePe-->>Backend: Payment URL
    Backend-->>User: Redirect to PhonePe
    User->>PhonePe: Complete Payment
    PhonePe->>Backend: Webhook Notification
    Backend->>Backend: Verify & Activate Subscription
    PhonePe-->>User: Redirect to Success Page
```

**Security Implementation:**
```typescript
// Checksum generation for PhonePe
private static generateChecksum(payload: string, saltKey: string, saltIndex: string): string {
  const crypto = require('crypto');
  const string = payload + '/pg/v1/pay' + saltKey;
  const sha256 = crypto.createHash('sha256').update(string).digest('hex');
  return sha256 + '###' + saltIndex;
}
```

**Pricing Configuration:**
```typescript
export const PHONEPE_PRICE_MAPPINGS: Record<string, number> = {
  "Premium": 49900, // ₹499 (in paise)
  "Pro": 99900,     // ₹999 (in paise)
};
```

### Webhook Security

**Verification Process:**
```typescript
app.post('/api/phonepe/webhook', async (req, res) => {
  try {
    const receivedChecksum = req.headers['x-verify'] as string;
    const [hash, saltIndex] = receivedChecksum.split('###');
    
    const payload = JSON.stringify(req.body);
    const expectedChecksum = PhonePeService.generateChecksum(payload, saltKey, saltIndex);
    
    if (expectedChecksum.split('###')[0] !== hash) {
      return res.status(401).json({ error: 'Invalid checksum' });
    }
    
    // Process payment event
    await processPhonePeWebhook(req.body);
    res.json({ success: true });
  } catch (error) {
    res.status(400).json({ error: 'Webhook processing failed' });
  }
});
```

### Troubleshooting

**Common Issues:**

1. **"PhonePe payment creation failed"**
   - Verify merchant credentials
   - Check amount format (must be in paise)
   - Ensure valid redirect URLs

2. **"Webhook checksum verification failed"**
   - Verify salt key and index
   - Check payload format
   - Ensure proper string encoding

3. **"Payment status not updating"**
   - Check webhook endpoint accessibility
   - Verify callback URL configuration
   - Monitor PhonePe dashboard for errors

---

## SendGrid Integration (Email Services)

### Overview

SendGrid provides reliable email delivery for transactional emails including welcome messages, password resets, and notifications.

**Features:**
- Transactional email delivery
- Email templates
- Delivery analytics
- Bounce and spam management
- High deliverability rates

### Setup Instructions

#### 1. Create SendGrid Account

1. Visit [SendGrid](https://sendgrid.com/)
2. Create account
3. Verify email address
4. Complete sender authentication

#### 2. Create API Key

1. Go to Settings > API Keys
2. Create new API key
3. Select "Full Access" or configure specific permissions
4. Copy the API key

```bash
SENDGRID_API_KEY=SG.your_actual_sendgrid_api_key_here
```

#### 3. Configure Sender Authentication

**Single Sender Verification:**
1. Go to Settings > Sender Authentication
2. Verify single sender email
3. Use verified email as `from` address

**Domain Authentication (Recommended for Production):**
1. Add your domain
2. Update DNS records as instructed
3. Verify domain authentication

### Implementation Details

**Email Service Architecture:**
```typescript
export class SendGridService {
  private static readonly DEFAULT_FROM = 'noreply@careercopilot.app';
  
  static async sendEmail(emailData: EmailData): Promise<EmailResult> {
    try {
      if (!SendGridService.isAvailable()) {
        // Fallback: Console logging
        console.log('📧 Email:', emailData);
        return { success: true, code: 'FALLBACK_CONSOLE' };
      }
      
      const msg = {
        to: emailData.to,
        from: emailData.from || SendGridService.DEFAULT_FROM,
        subject: emailData.subject,
        text: emailData.text,
        html: emailData.html,
      };
      
      await sendgrid.send(msg);
      return { success: true };
    } catch (error) {
      // Fallback: Console logging on error
      console.log('📧 Email Error Fallback:', emailData);
      return { success: false, error: error.message };
    }
  }
}
```

**Email Templates:**
```typescript
// Welcome email
static async sendWelcomeEmail(userEmail: string, userName: string) {
  return SendGridService.sendEmail({
    to: userEmail,
    subject: 'Welcome to Career Co-Pilot!',
    html: `
      <h2>Welcome to Career Co-Pilot!</h2>
      <p>Hi ${userName},</p>
      <p>Welcome to Career Co-Pilot! We're excited to help you find your next great opportunity.</p>
    `
  });
}

// Password reset email
static async sendPasswordResetEmail(userEmail: string, resetLink: string) {
  return SendGridService.sendEmail({
    to: userEmail,
    subject: 'Reset Your Password - Career Co-Pilot',
    html: `
      <h2>Reset Your Password</h2>
      <p>Click the link below to reset your password:</p>
      <a href="${resetLink}">Reset Password</a>
      <p>This link expires in 1 hour.</p>
    `
  });
}
```

### Fallback System

When SendGrid is unavailable:
- Emails are logged to console
- Application continues functioning
- No user-facing errors
- Email delivery can be retried later

### Troubleshooting

**Common Issues:**

1. **"SendGrid not initialized"**
   - Verify `SENDGRID_API_KEY` environment variable
   - Check API key permissions
   - Ensure account is not suspended

2. **"Email delivery failed"**
   - Check sender authentication
   - Verify recipient email format
   - Review SendGrid activity dashboard

3. **"High bounce rates"**
   - Verify sender domain authentication
   - Check email content for spam indicators
   - Monitor reputation metrics

---

## Google OAuth Integration (Social Login)

### Overview

Google OAuth provides seamless social login functionality, allowing users to authenticate with their Google accounts.

**Features:**
- One-click Google sign-in
- Secure OAuth 2.0 flow
- Profile information access
- Cross-platform compatibility

### Setup Instructions

#### 1. Create Google Cloud Project

1. Visit [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API
4. Go to Credentials section

#### 2. Create OAuth 2.0 Credentials

1. Click "Create Credentials" > "OAuth 2.0 Client IDs"
2. Configure OAuth consent screen
3. Add authorized domains
4. Set redirect URIs:

**Development:**
```
http://localhost:5000/api/auth/google/callback
```

**Production:**
```
https://your-domain.com/api/auth/google/callback
```

5. Copy Client ID and Client Secret

```bash
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Implementation Details

**OAuth Flow:**
```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Backend
    participant Google
    
    User->>Frontend: Click "Sign in with Google"
    Frontend->>Backend: Redirect to /api/auth/google
    Backend->>Google: OAuth Authorization Request
    Google-->>User: OAuth Consent Screen
    User->>Google: Grant Permissions
    Google->>Backend: Authorization Code
    Backend->>Google: Exchange Code for Tokens
    Google-->>Backend: Access Token & Profile
    Backend->>Backend: Create/Update User
    Backend-->>Frontend: Redirect with Auth Token
```

**Security Configuration:**
```typescript
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: '/api/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const result = await AuthService.handleGoogleAuth(profile, accessToken);
    return done(null, { user: result.user, token: result.token });
  } catch (error) {
    return done(error);
  }
}));
```

**Profile Data Mapping:**
```typescript
interface GoogleProfile {
  id: string;
  emails: [{ value: string }];
  name: {
    givenName: string;
    familyName: string;
  };
  photos: [{ value: string }];
}
```

### Fallback System

When Google OAuth is unavailable:
- Users can still register/login with email/password
- Phone OTP authentication remains available
- Clear error messages guide users to alternatives

### Troubleshooting

**Common Issues:**

1. **"Google OAuth not configured"**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
   - Check OAuth consent screen configuration
   - Ensure APIs are enabled

2. **"Redirect URI mismatch"**
   - Verify redirect URIs in Google Console
   - Check exact URL formatting
   - Ensure HTTPS in production

3. **"OAuth error: access_denied"**
   - Check OAuth consent screen setup
   - Verify app verification status
   - Review requested scopes

---

## Environment Configuration

### Complete Environment Variables Reference

```bash
# ================================
# DATABASE CONFIGURATION
# ================================
DATABASE_URL=postgresql://user:password@host:5432/database_name

# ================================
# AUTHENTICATION & SECURITY  
# ================================
JWT_SECRET=your_256_bit_jwt_secret_key_here
SESSION_SECRET=your_session_secret_key_here

# ================================
# AI SERVICES
# ================================
# OpenAI Integration
OPENAI_API_KEY=sk-proj-your_openai_api_key_here
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=4000

# ================================
# PAYMENT PROCESSING
# ================================
# Stripe (International)
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key  
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# PhonePe (India)
PHONEPE_MERCHANT_ID=your_phonepe_merchant_id
PHONEPE_SALT_KEY=your_phonepe_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENVIRONMENT=PRODUCTION

# ================================
# EMAIL SERVICES
# ================================
SENDGRID_API_KEY=SG.your_sendgrid_api_key

# ================================
# SOCIAL AUTHENTICATION
# ================================
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ================================
# APPLICATION CONFIGURATION
# ================================
NODE_ENV=production
PORT=5000
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com

# ================================
# RATE LIMITING
# ================================
RATE_LIMIT_WINDOW=900000  # 15 minutes
RATE_LIMIT_MAX=100        # requests per window
```

### Environment Validation

The application automatically validates required environment variables on startup:

```typescript
interface EnvironmentValidation {
  required: {
    DATABASE_URL: "PostgreSQL connection string";
    JWT_SECRET: "256-bit secret for JWT signing";
  };
  
  optional_with_fallbacks: {
    OPENAI_API_KEY: "AI features (falls back to basic processing)";
    STRIPE_SECRET_KEY: "International payments (falls back to PhonePe)";
    PHONEPE_MERCHANT_ID: "Indian payments (falls back to test mode)";
    SENDGRID_API_KEY: "Email delivery (falls back to console logging)";
    GOOGLE_CLIENT_ID: "Social login (falls back to email/password)";
  };
}
```

---

## Development vs Production

### Development Environment

**Characteristics:**
- Test credentials for all services
- Console logging for emails
- Detailed error messages
- Hot reloading enabled
- Debug information exposed

**Configuration:**
```bash
NODE_ENV=development

# Test credentials (safe for development)
STRIPE_SECRET_KEY=sk_test_your_test_key
PHONEPE_MERCHANT_ID=PGTESTPAYUAT86
PHONEPE_ENVIRONMENT=SANDBOX

# Development-specific settings
OPENAI_MODEL=gpt-4  # Use cheaper model for testing
```

**Features in Development:**
- OTP codes shown in API responses
- Detailed error stack traces
- Integration status endpoint accessible
- File upload debugging enabled

### Production Environment

**Characteristics:**
- Live credentials for all services
- Secure error handling
- Performance optimization
- Monitoring enabled
- Security hardening

**Configuration:**
```bash
NODE_ENV=production

# Live credentials (secure)
STRIPE_SECRET_KEY=sk_live_your_live_key
PHONEPE_ENVIRONMENT=PRODUCTION

# Production-specific settings
CORS_ORIGINS=https://your-domain.com
RATE_LIMIT_MAX=100
```

**Security Enhancements in Production:**
- Error messages sanitized
- Debug information hidden
- Rate limiting enforced
- HTTPS required
- CORS strictly configured

### Migration Checklist

**Development to Production:**
1. ✅ Replace all test credentials with live credentials
2. ✅ Set `NODE_ENV=production`
3. ✅ Configure CORS for your domain
4. ✅ Set up proper error monitoring
5. ✅ Enable SSL/HTTPS
6. ✅ Configure webhook endpoints
7. ✅ Test all integrations in production
8. ✅ Monitor error rates and performance

---

## Security Best Practices

### API Key Management

**Storage:**
- Use environment variables (never hardcode)
- Encrypt at rest in secure storage
- Rotate keys regularly
- Use different keys for different environments

**Access Control:**
- Principle of least privilege
- Regular audit of key permissions
- Immediate revocation when compromised
- Monitor key usage patterns

### Webhook Security

**Signature Verification:**
```typescript
// Always verify webhook signatures
const isValidSignature = (payload: string, signature: string, secret: string): boolean => {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
};
```

**Idempotency Protection:**
- Store processed webhook IDs
- Implement time-based windows
- Handle duplicate events gracefully
- Log all webhook processing attempts

### Network Security

**HTTPS Enforcement:**
```typescript
// Redirect HTTP to HTTPS in production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      res.redirect(`https://${req.header('host')}${req.url}`);
    } else {
      next();
    }
  });
}
```

**CORS Configuration:**
```typescript
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};
```

### Rate Limiting

**Tiered Rate Limiting:**
```typescript
const rateLimits = {
  authentication: { windowMs: 15 * 60 * 1000, max: 10 },
  general: { windowMs: 15 * 60 * 1000, max: 100 },
  fileUpload: { windowMs: 60 * 60 * 1000, max: 5 }
};
```

---

## Troubleshooting Guide

### Integration Health Monitoring

**Quick Health Check:**
```bash
# Check all integrations
curl -s https://your-domain.com/api/integrations/status | jq '.'

# Check specific integration
curl -s https://your-domain.com/api/integrations/status | jq '.integrations.openai'
```

**Expected Healthy Response:**
```json
{
  "available": true,
  "features": ["cv_parsing", "job_matching"],
  "fallback": null
}
```

### Common Error Patterns

#### 1. "Integration Unavailable" Errors

**Symptoms:**
- API returns 503 Service Unavailable
- Integration status shows `available: false`
- Fallback systems activated

**Diagnosis:**
```bash
# Check environment variables
env | grep -E "(OPENAI|STRIPE|PHONEPE|SENDGRID|GOOGLE)"

# Test API connectivity
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"max_tokens":5}'
```

**Solutions:**
1. Verify environment variables are set correctly
2. Check API key validity and permissions
3. Verify account status and billing
4. Test network connectivity to service endpoints

#### 2. Webhook Processing Failures

**Symptoms:**
- Payment status not updating
- Subscription not activating
- Webhook endpoint returning errors

**Diagnosis:**
```bash
# Check webhook endpoint
curl -X POST https://your-domain.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# Monitor webhook logs
tail -f /var/log/webhook-errors.log
```

**Solutions:**
1. Verify webhook endpoint URL is correct
2. Check webhook signature verification
3. Ensure proper content-type handling
4. Verify idempotency implementation

#### 3. Authentication Integration Issues

**Symptoms:**
- Social login buttons not working
- OAuth redirects failing
- Token validation errors

**Diagnosis:**
```typescript
// Test Google OAuth configuration
const testGoogleAuth = async () => {
  try {
    const authUrl = `https://accounts.google.com/oauth/authorize?client_id=${GOOGLE_CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=profile email&response_type=code`;
    console.log('Test this URL:', authUrl);
  } catch (error) {
    console.error('OAuth configuration error:', error);
  }
};
```

**Solutions:**
1. Verify OAuth client configuration
2. Check redirect URI whitelist
3. Ensure proper scope permissions
4. Test OAuth flow manually

### Performance Troubleshooting

#### 1. Slow AI Processing

**Symptoms:**
- CV processing takes >10 seconds
- Job matching timeouts
- High OpenAI API costs

**Solutions:**
```typescript
// Monitor AI performance
const aiMetrics = OpenAIService.getMetrics();
console.log({
  cacheHitRate: aiMetrics.cacheHitRate,
  avgResponseTime: aiMetrics.avgResponseTime,
  tokensSaved: aiMetrics.tokensSaved
});

// Optimize caching
OpenAICostOptimizer.clearExpiredCache();
```

#### 2. Database Performance Issues

**Symptoms:**
- Slow query responses
- Connection timeouts
- High memory usage

**Solutions:**
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM applications WHERE user_id = $1;

-- Monitor connection usage
SELECT count(*) as connection_count FROM pg_stat_activity;

-- Analyze slow queries
SELECT query, mean_time, calls FROM pg_stat_statements ORDER BY mean_time DESC;
```

### Error Monitoring

**Structured Error Logging:**
```typescript
interface ErrorLog {
  timestamp: string;
  level: "error" | "warn" | "info";
  integration: string;
  error_code: string;
  message: string;
  context: {
    user_id?: string;
    request_id: string;
    endpoint: string;
  };
}
```

**Alerting Rules:**
- Integration failure: Immediate alert
- High error rate (>5%): 5-minute alert
- Payment failure: Immediate alert
- AI service down: 2-minute alert

### Recovery Procedures

#### 1. Integration Outage Recovery

```bash
# 1. Identify affected integration
curl https://your-domain.com/api/integrations/status

# 2. Check service status pages
# - OpenAI: https://status.openai.com/
# - Stripe: https://status.stripe.com/
# - SendGrid: https://status.sendgrid.com/

# 3. Verify environment configuration
env | grep INTEGRATION_NAME

# 4. Test basic connectivity
curl -I https://api.service.com/health

# 5. Restart application if needed
pm2 restart jobr-backend
```

#### 2. Database Recovery

```bash
# 1. Check database connectivity
psql $DATABASE_URL -c "SELECT version();"

# 2. Monitor active connections
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# 3. Run schema migrations if needed
npm run db:push

# 4. Verify data integrity
npm run db:verify
```

### Contact Information

**Integration Support:**
- OpenAI: [OpenAI Support](https://help.openai.com/)
- Stripe: [Stripe Support](https://support.stripe.com/)
- PhonePe: [PhonePe Business Support](https://business.phonepe.com/support)
- SendGrid: [SendGrid Support](https://support.sendgrid.com/)
- Google: [Google Cloud Support](https://cloud.google.com/support)

**Emergency Procedures:**
1. Check integration status endpoint
2. Review error logs and metrics
3. Verify environment configuration
4. Test basic connectivity
5. Implement fallback procedures
6. Contact relevant support channels

---

## Conclusion

This integration guide provides comprehensive setup instructions for all third-party services in the Jobr platform. Each integration includes:

- **Production-ready configuration**
- **Security best practices**
- **Fallback mechanisms**
- **Troubleshooting guidance**
- **Performance optimization**

**Key Success Factors:**
1. **Security First**: Always verify webhook signatures and use secure credentials
2. **Fallback Systems**: Every integration has graceful degradation
3. **Monitoring**: Continuous health checks and error monitoring
4. **Documentation**: Keep configuration and credentials documented
5. **Testing**: Thoroughly test all integrations in staging before production

The platform is designed to function with partial integrations, ensuring core functionality remains available even if some services are temporarily unavailable.

---

*Last Updated: September 19, 2025*  
*Integration Guide Version: 1.0.0*  
*Status: Production Ready*