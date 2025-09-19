# Career Co-Pilot Integration Setup Guide

This document provides comprehensive setup instructions for all third-party integrations used in Career Co-Pilot. The application is designed to work with missing integrations by providing fallback functionality where possible.

## Integration Status Overview

The application currently supports 5 major integrations. You can check the real-time status of all integrations by calling the `/api/integrations/status` endpoint.

| Integration | Status | Required | Fallback Available |
|-------------|--------|----------|--------------------|
| OpenAI | ✅ Configured | Core functionality | ⚠️ Basic parsing only |
| Google OAuth | ❌ Not configured | Optional | ✅ Email/password login |
| Stripe | ❌ Not configured | Payment processing | ✅ PhonePe payments |
| PhonePe | ⚠️ Test mode | Payment processing | ✅ Test transactions |
| SendGrid | ❌ Not configured | Email services | ✅ Console logging |

## 1. OpenAI Integration (CRITICAL)

**Status**: ✅ **CONFIGURED**
**Priority**: **HIGH** - Core AI functionality depends on this

### What it enables:
- AI-powered CV parsing and data extraction
- Intelligent job matching with compatibility scores
- Personalized application preparation
- AI-generated cover letters and tailored CVs

### Configuration:
```bash
OPENAI_API_KEY=sk-...your-openai-api-key...
```

### How to get your API key:
1. Visit [OpenAI Platform](https://platform.openai.com/)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Add billing information (required for API access)

### Fallback behavior when not configured:
- Basic CV parsing using regex patterns
- No AI-powered job matching
- No personalized content generation
- Application features severely limited

### Cost considerations:
- Charges per API call based on token usage
- Typical CV parsing: ~$0.01-0.05 per CV
- Job matching: ~$0.02-0.10 per job comparison
- Cover letter generation: ~$0.05-0.20 per letter

---

## 2. Google OAuth Integration (OPTIONAL)

**Status**: ❌ **NOT CONFIGURED**
**Priority**: Medium - Improves user experience

### What it enables:
- One-click social login with Google accounts
- Automatic profile information import
- Seamless account creation

### Configuration:
```bash
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### How to set up:
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Go to Credentials > Create Credentials > OAuth client ID
5. Configure OAuth consent screen
6. Add authorized redirect URIs:
   - `https://your-domain.com/api/auth/google/callback`
   - `http://localhost:5000/api/auth/google/callback` (for development)

### Fallback behavior when not configured:
- Users can still register/login with email and password
- Phone number authentication is also available
- Google OAuth routes return proper error messages

### API Endpoints affected:
- `GET /api/auth/google` - Returns 503 error when not configured
- `GET /api/auth/google/callback` - Returns 503 error when not configured

---

## 3. Stripe Integration (PAYMENT PROCESSING)

**Status**: ❌ **NOT CONFIGURED**
**Priority**: Medium - Required for subscription payments

### What it enables:
- Subscription plan management
- International payment processing
- Automated billing and invoicing
- Webhook handling for payment events

### Configuration:
```bash
STRIPE_SECRET_KEY=sk_live_...your-stripe-secret-key...
STRIPE_WEBHOOK_SECRET=whsec_...your-webhook-secret...
```

### How to set up:
1. Create account at [Stripe Dashboard](https://dashboard.stripe.com/)
2. Complete business verification
3. Get API keys from Developers > API keys
4. Set up webhook endpoint:
   - URL: `https://your-domain.com/api/stripe/webhook`
   - Events: All subscription and payment events
5. Note the webhook secret for verification

### Fallback behavior when not configured:
- Subscription creation routes return 503 errors
- PhonePe is used as primary payment processor
- Billing management features unavailable

### Pricing plans supported:
- Premium: ₹499/month
- Pro: ₹999/month

---

## 4. PhonePe Integration (INDIAN PAYMENTS)

**Status**: ⚠️ **TEST MODE**
**Priority**: Medium - Primary payment processor for Indian market

### What it enables:
- Indian payment processing (UPI, cards, wallets)
- Subscription management for Indian users
- Local payment methods

### Configuration:
```bash
PHONEPE_MERCHANT_ID=your-merchant-id
PHONEPE_SALT_KEY=your-salt-key
PHONEPE_SALT_INDEX=1
```

### How to set up:
1. Apply for PhonePe merchant account
2. Complete KYC and business verification
3. Get merchant credentials from PhonePe dashboard
4. Set up webhook endpoint:
   - URL: `https://your-domain.com/api/phonepe/webhook`

### Current behavior (test mode):
- Uses PhonePe sandbox environment
- Test merchant ID: `PGTESTPAYUAT86`
- Test transactions only
- Full payment flow available for testing

### Production deployment:
- Requires business verification
- Update environment variables with production credentials
- Switch to production PhonePe API endpoints

---

## 5. SendGrid Integration (EMAIL SERVICES)

**Status**: ❌ **NOT CONFIGURED**
**Priority**: Low - Email functionality has fallbacks

### What it enables:
- Transactional email delivery
- Welcome emails for new users
- Password reset emails
- Application confirmation emails
- Email verification

### Configuration:
```bash
SENDGRID_API_KEY=SG.your-sendgrid-api-key
```

### How to set up:
1. Create account at [SendGrid](https://sendgrid.com/)
2. Verify your domain or use single sender verification
3. Create API key with Mail Send permissions
4. Configure sender identity

### Fallback behavior when not configured:
- All emails are logged to console for development
- No actual emails are sent
- Application continues to function normally
- Users see success messages but no emails received

### Email templates available:
- Welcome email
- Password reset
- Email verification
- Application confirmation

---

## Integration Dependencies by Feature

### Core Features (Work without external integrations)
- ✅ User registration/login (email/password)
- ✅ Phone number authentication
- ✅ Job browsing and searching
- ✅ Application tracking
- ✅ Basic profile management

### AI-Powered Features (Require OpenAI)
- ⚠️ CV parsing and data extraction
- ⚠️ Job matching with compatibility scores
- ⚠️ Personalized cover letter generation
- ⚠️ CV tailoring for specific jobs

### Payment Features (Require Stripe OR PhonePe)
- ⚠️ Subscription upgrades
- ⚠️ Premium plan access
- ⚠️ Billing management

### Enhanced UX Features (Optional)
- 🔄 Google social login (Google OAuth)
- 📧 Email notifications (SendGrid)

---

## Environment Variables Summary

Create a `.env` file in your project root with the following variables:

```bash
# Database (Auto-configured in Replit)
DATABASE_URL=your-database-url

# Core AI Functionality (CRITICAL)
OPENAI_API_KEY=sk-...your-openai-api-key...

# Payment Processing (Choose one or both)
STRIPE_SECRET_KEY=sk_live_...your-stripe-secret-key...
STRIPE_WEBHOOK_SECRET=whsec_...your-webhook-secret...

# Indian Payments (PhonePe)
PHONEPE_MERCHANT_ID=your-merchant-id
PHONEPE_SALT_KEY=your-salt-key
PHONEPE_SALT_INDEX=1

# Social Login (Optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email Services (Optional)
SENDGRID_API_KEY=SG.your-sendgrid-api-key

# Application Settings
NODE_ENV=production
```

---

## Quick Setup for Development

For a minimal working setup:

1. **Essential**: Configure OpenAI for core functionality
2. **Payment Testing**: PhonePe works in test mode by default
3. **Optional**: Add Google OAuth for better UX
4. **Optional**: Add SendGrid for email features

## Checking Integration Status

Use the integration status endpoint to verify your setup:

```bash
curl https://your-domain.com/api/integrations/status
```

This returns detailed information about each integration's availability and fallback behavior.

---

## Troubleshooting

### Common Issues:

1. **OpenAI Rate Limits**: Add billing information to your OpenAI account
2. **Stripe Webhooks**: Ensure webhook URL is publicly accessible
3. **PhonePe Testing**: Use test credentials for development
4. **Google OAuth**: Check redirect URI configuration
5. **SendGrid Domain**: Verify sender domain or use single sender verification

### Integration Testing:

1. Check `/api/integrations/status` for overall health
2. Test individual features to verify integration behavior
3. Monitor logs for integration-specific error messages
4. Use test modes when available for development

---

## Security Notes

- Never commit API keys to version control
- Use environment variables for all sensitive data
- Rotate API keys regularly
- Monitor usage and billing for external services
- Use webhook secrets to verify callback authenticity
- Implement rate limiting for integration endpoints