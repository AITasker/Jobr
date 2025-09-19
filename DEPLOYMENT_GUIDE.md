# Jobr Platform Deployment Guide

## Overview

This guide provides comprehensive instructions for deploying the Jobr AI-powered job search platform to production. The platform is designed for enterprise deployment with comprehensive security and production-ready integrations.

**Deployment Summary:**
- **Platform**: Replit Autoscale Deployment (Recommended)
- **Database**: PostgreSQL (Neon-backed)
- **Security**: Enterprise-grade with comprehensive protection
- **Monitoring**: Built-in observability and health checks
- **Scalability**: Auto-scaling with horizontal scaling support

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Database Configuration](#database-configuration)
4. [Security Configuration](#security-configuration)
5. [Integration Configuration](#integration-configuration)
6. [Production Deployment](#production-deployment)
7. [Post-Deployment Verification](#post-deployment-verification)
8. [Monitoring and Maintenance](#monitoring-and-maintenance)
9. [Scaling Considerations](#scaling-considerations)
10. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### System Requirements

**Minimum Requirements:**
- Node.js 18+
- PostgreSQL 14+
- 2GB RAM minimum
- 20GB storage minimum
- SSL certificate for HTTPS

**Recommended Production Setup:**
- Node.js 20+
- PostgreSQL 15+
- 4GB RAM
- 50GB SSD storage
- CDN for static assets
- Load balancer for high availability

### Environment Validation

**Pre-Deployment Validation:**
Before deploying to production, run the environment validation script:

```bash
# Install dependencies (if needed)
npm install chalk

# Run environment validation
node scripts/validate-env.js
```

This script performs fail-fast validation of:
- Required environment variables
- Security configuration
- Feature availability
- Production readiness checks

**Exit Codes:**
- `0`: All validations passed, safe to deploy
- `1`: Critical failures, deployment blocked

**CI/CD Integration:**
For production deployments, integrate the environment validation script into your CI/CD pipeline:

```yaml
# Example CI/CD step (GitHub Actions, GitLab CI, etc.)
- name: Validate Environment Configuration
  run: |
    npm install chalk
    node scripts/validate-env.js
```

This ensures environment validation runs automatically before each deployment, preventing configuration issues in production.

### Required Accounts and Credentials

**Essential Services:**
1. **Database**: PostgreSQL instance (Neon recommended)
2. **AI Services**: OpenAI API account
3. **Payments**: 
   - Stripe account (international)
   - PhonePe account (India)
4. **Email**: SendGrid account
5. **Authentication**: Google OAuth 2.0 credentials

**Optional but Recommended:**
- Error monitoring service (Sentry, DataDog)
- CDN service (CloudFlare, AWS CloudFront)
- SSL certificate provider

---

## Environment Setup

### Production Environment Variables

Create a comprehensive `.env` file for production:

```bash
# ================================
# APPLICATION CONFIGURATION
# ================================
NODE_ENV=production
PORT=5000

# Domain and CORS
CORS_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
BASE_URL=https://yourdomain.com

# ================================
# DATABASE CONFIGURATION
# ================================
DATABASE_URL=postgresql://username:password@host:5432/database_name

# Connection pooling
DB_POOL_SIZE=20
DB_CONNECTION_TIMEOUT=5000
DB_IDLE_TIMEOUT=30000

# ================================
# SECURITY CONFIGURATION
# ================================
# Generate 256-bit secrets
JWT_SECRET=your_256_bit_jwt_secret_key_here
JWT_REFRESH_SECRET=your_256_bit_refresh_secret_here
SESSION_SECRET=your_session_secret_key_here

# Rate limiting
RATE_LIMIT_WINDOW=900000  # 15 minutes in milliseconds
RATE_LIMIT_MAX=100        # requests per window
AUTH_RATE_LIMIT_MAX=10    # auth requests per window

# ================================
# AI SERVICES
# ================================
OPENAI_API_KEY=sk-proj-your_production_openai_api_key
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=4000
OPENAI_TEMPERATURE=0.3

# ================================
# PAYMENT PROCESSING
# ================================
# Stripe (International Markets)
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret

# PhonePe (Indian Market)
PHONEPE_MERCHANT_ID=your_production_phonepe_merchant_id
PHONEPE_SALT_KEY=your_production_phonepe_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENVIRONMENT=PRODUCTION

# ================================
# EMAIL SERVICES
# ================================
SENDGRID_API_KEY=SG.your_production_sendgrid_api_key
EMAIL_FROM=noreply@yourdomain.com

# ================================
# SOCIAL AUTHENTICATION
# ================================
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# ================================
# MONITORING AND LOGGING
# ================================
LOG_LEVEL=info
SENTRY_DSN=your_sentry_dsn_for_error_tracking

# ================================
# PERFORMANCE OPTIMIZATION
# ================================
CACHE_TTL=1800           # 30 minutes
AI_CACHE_TTL=1800        # 30 minutes
SESSION_TTL=86400        # 24 hours
```

### Environment Validation Script

Create `scripts/validate-env.js`:

```javascript
const requiredVars = [
  'DATABASE_URL',
  'JWT_SECRET',
  'SESSION_SECRET'
];

const recommendedVars = [
  'OPENAI_API_KEY',
  'STRIPE_SECRET_KEY',
  'PHONEPE_MERCHANT_ID',
  'SENDGRID_API_KEY',
  'GOOGLE_CLIENT_ID'
];

function validateEnvironment() {
  console.log('🔍 Validating environment configuration...\n');
  
  let hasErrors = false;
  let hasWarnings = false;
  
  // Check required variables
  console.log('📋 Required Variables:');
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      console.log(`❌ ${varName} - MISSING (REQUIRED)`);
      hasErrors = true;
    } else {
      console.log(`✅ ${varName} - OK`);
    }
  });
  
  // Check recommended variables
  console.log('\n🔧 Recommended Variables:');
  recommendedVars.forEach(varName => {
    if (!process.env[varName]) {
      console.log(`⚠️  ${varName} - MISSING (features will be limited)`);
      hasWarnings = true;
    } else {
      console.log(`✅ ${varName} - OK`);
    }
  });
  
  // Security checks
  console.log('\n🔒 Security Validation:');
  
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.log('❌ JWT_SECRET - Too short (minimum 32 characters)');
    hasErrors = true;
  } else if (process.env.JWT_SECRET) {
    console.log('✅ JWT_SECRET - OK');
  }
  
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️  NODE_ENV - Not set to production');
    hasWarnings = true;
  } else {
    console.log('✅ NODE_ENV - Production mode');
  }
  
  // Results
  console.log('\n📊 Validation Results:');
  if (hasErrors) {
    console.log('❌ Environment validation failed - fix required variables');
    process.exit(1);
  } else if (hasWarnings) {
    console.log('⚠️  Environment validation passed with warnings');
    console.log('   Some integrations may not be available');
  } else {
    console.log('✅ Environment validation passed - all systems ready');
  }
}

validateEnvironment();
```

Run validation:
```bash
node scripts/validate-env.js
```

---

## Database Configuration

### Database Setup

#### Option 1: Neon PostgreSQL (Recommended)

1. **Create Neon Account**
   ```bash
   # Visit https://neon.tech/
   # Create new project
   # Copy connection string
   ```

2. **Configure Connection**
   ```bash
   DATABASE_URL=postgresql://username:password@ep-xxx.neon.tech/dbname?sslmode=require
   ```

#### Option 2: Self-Hosted PostgreSQL

1. **Install PostgreSQL**
   ```bash
   # Ubuntu/Debian
   sudo apt update
   sudo apt install postgresql postgresql-contrib
   
   # CentOS/RHEL
   sudo yum install postgresql-server postgresql-contrib
   sudo postgresql-setup initdb
   sudo systemctl start postgresql
   ```

2. **Create Database and User**
   ```sql
   -- Connect as postgres user
   sudo -u postgres psql
   
   -- Create database
   CREATE DATABASE jobr_production;
   
   -- Create user
   CREATE USER jobr_user WITH ENCRYPTED PASSWORD 'your_secure_password';
   
   -- Grant privileges
   GRANT ALL PRIVILEGES ON DATABASE jobr_production TO jobr_user;
   
   -- Exit
   \q
   ```

3. **Configure Connection String**
   ```bash
   DATABASE_URL=postgresql://jobr_user:your_secure_password@localhost:5432/jobr_production
   ```

### Database Schema Migration

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Run Schema Migration**
   ```bash
   # Push schema to database
   npm run db:push
   
   # If prompted for data loss, force if acceptable
   npm run db:push --force
   ```

3. **Verify Schema**
   ```bash
   # Connect to database and verify tables
   psql $DATABASE_URL -c "\dt"
   ```

   Expected tables:
   ```
   applications
   authAccounts
   cvs
   jobs
   otpCodes
   paymentRequests
   sessions
   stripeEvents
   subscriptions
   templates
   users
   ```

### Database Optimization

1. **Create Performance Indexes**
   ```sql
   -- User operations
   CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
   CREATE INDEX CONCURRENTLY idx_users_plan_status ON users(plan, "subscriptionStatus");
   
   -- Application queries
   CREATE INDEX CONCURRENTLY idx_applications_user_status ON applications("userId", status);
   CREATE INDEX CONCURRENTLY idx_applications_created ON applications("createdAt" DESC);
   
   -- Job search optimization
   CREATE INDEX CONCURRENTLY idx_jobs_title_gin ON jobs USING gin(to_tsvector('english', title));
   CREATE INDEX CONCURRENTLY idx_jobs_skills_gin ON jobs USING gin(skills);
   CREATE INDEX CONCURRENTLY idx_jobs_location ON jobs(location);
   
   -- Subscription management
   CREATE INDEX CONCURRENTLY idx_subscriptions_user_status ON subscriptions("userId", status);
   ```

2. **Configure Connection Pooling**
   ```javascript
   // In your database configuration
   const poolConfig = {
     max: 20,                    // Maximum connections
     min: 5,                     // Minimum connections
     acquire: 30000,             // Max time to get connection
     idle: 10000,                // Max idle time
     evict: 1000,                // Eviction interval
   };
   ```

---

## Security Configuration

### SSL/TLS Certificate

#### Option 1: Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt install certbot

# Get certificate
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Option 2: CloudFlare SSL (Recommended)

1. Add domain to CloudFlare
2. Update nameservers
3. Enable SSL/TLS encryption (Full Strict)
4. Configure automatic HTTPS redirects

### Security Headers

Configure security headers in your application:

```javascript
// Add to your Express app
app.use((req, res, next) => {
  // HTTPS redirect in production
  if (process.env.NODE_ENV === 'production' && req.header('x-forwarded-proto') !== 'https') {
    return res.redirect(`https://${req.header('host')}${req.url}`);
  }
  
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  
  // HSTS in production
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  }
  
  next();
});
```

### Firewall Configuration

```bash
# Ubuntu/Debian with ufw
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# CentOS/RHEL with firewalld
sudo firewall-cmd --permanent --add-service=ssh
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload
```

### Secrets Management

#### Option 1: Environment Variables (Simple)

```bash
# Store in .env file (not in version control)
cp .env.example .env
nano .env
# Set all required variables
```

#### Option 2: External Secrets Manager

```bash
# AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id jobr/production/database

# HashiCorp Vault
vault kv get secret/jobr/production

# Azure Key Vault
az keyvault secret show --vault-name jobr-vault --name database-url
```

---

## Integration Configuration

### Payment Processor Setup

#### Stripe Configuration

1. **Create Stripe Account**
   - Visit [Stripe Dashboard](https://dashboard.stripe.com/)
   - Complete business verification
   - Activate live mode

2. **Configure Products**
   ```bash
   # Create products via Stripe CLI or Dashboard
   stripe products create --name="Premium Plan" --description="Monthly Premium Subscription"
   stripe prices create --unit-amount=4999 --currency=usd --recurring-interval=month --product=prod_xxx
   ```

3. **Set Up Webhooks**
   - URL: `https://yourdomain.com/api/stripe/webhook`
   - Events: `invoice.payment_succeeded`, `customer.subscription.updated`

#### PhonePe Configuration

1. **Business Account Setup**
   - Register at [PhonePe Business](https://business.phonepe.com/)
   - Complete KYC verification
   - Get production credentials

2. **Configure Environment**
   ```bash
   PHONEPE_MERCHANT_ID=your_production_merchant_id
   PHONEPE_SALT_KEY=your_production_salt_key
   PHONEPE_ENVIRONMENT=PRODUCTION
   ```

### AI Services Setup

#### OpenAI Configuration

1. **API Key Setup**
   ```bash
   # Get API key from https://platform.openai.com/
   OPENAI_API_KEY=sk-proj-your_production_key
   ```

2. **Usage Monitoring**
   ```bash
   # Set up usage alerts in OpenAI dashboard
   # Configure billing limits
   # Monitor token usage
   ```

### Email Service Setup

#### SendGrid Configuration

1. **Account Setup**
   ```bash
   # Create account at https://sendgrid.com/
   # Verify sender authentication
   # Configure domain authentication
   ```

2. **API Key Configuration**
   ```bash
   SENDGRID_API_KEY=SG.your_production_api_key
   ```

---

## Production Deployment

### Deployment Options

#### Option 1: Replit Deployment (Recommended)

**Advantages:**
- Automatic scaling
- Built-in SSL
- Zero-downtime deployments
- Integrated monitoring

**Steps:**
1. **Prepare Repository**
   ```bash
   # Ensure package.json has correct scripts
   {
     "scripts": {
       "start": "node server/index.js",
       "build": "tsc",
       "db:push": "drizzle-kit push:pg"
     }
   }
   ```

2. **Configure Replit Secrets**
   ```bash
   # In Replit interface, add all environment variables
   # Go to Secrets tab and add each variable
   ```

3. **Deploy**
   ```bash
   # Push to repository
   git push origin main
   
   # Replit auto-deploys on push
   ```

#### Option 2: VPS Deployment

**Steps:**
1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PM2
   sudo npm install -g pm2
   ```

2. **Application Deployment**
   ```bash
   # Clone repository
   git clone https://github.com/yourusername/jobr-platform.git
   cd jobr-platform
   
   # Install dependencies
   npm install
   
   # Build application
   npm run build
   
   # Setup environment
   cp .env.example .env
   nano .env  # Configure all variables
   
   # Run database migrations
   npm run db:push
   
   # Start with PM2
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

3. **PM2 Configuration** (`ecosystem.config.js`)
   ```javascript
   module.exports = {
     apps: [{
       name: 'jobr-backend',
       script: 'server/index.js',
       instances: 'max',
       exec_mode: 'cluster',
       env: {
         NODE_ENV: 'production',
         PORT: 5000
       },
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_file: './logs/combined.log',
       time: true,
       max_memory_restart: '1G',
       node_args: '--max-old-space-size=1024'
     }]
   };
   ```

#### Option 3: Docker Deployment

1. **Dockerfile**
   ```dockerfile
   FROM node:20-alpine
   
   WORKDIR /app
   
   # Copy package files
   COPY package*.json ./
   RUN npm ci --only=production
   
   # Copy application
   COPY . .
   
   # Build application
   RUN npm run build
   
   # Create non-root user
   RUN addgroup -g 1001 -S nodejs
   RUN adduser -S jobr -u 1001
   USER jobr
   
   EXPOSE 5000
   
   CMD ["npm", "start"]
   ```

2. **Docker Compose** (`docker-compose.yml`)
   ```yaml
   version: '3.8'
   
   services:
     app:
       build: .
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
       env_file:
         - .env
       depends_on:
         - postgres
       restart: unless-stopped
   
     postgres:
       image: postgres:15
       environment:
         POSTGRES_DB: jobr_production
         POSTGRES_USER: jobr_user
         POSTGRES_PASSWORD: ${DB_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
       restart: unless-stopped
   
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./ssl:/etc/ssl
       depends_on:
         - app
       restart: unless-stopped
   
   volumes:
     postgres_data:
   ```

3. **Deploy**
   ```bash
   docker-compose up -d
   ```

### Load Balancer Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;
    
    ssl_certificate /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/s;
    
    location /api/auth/ {
        limit_req zone=auth burst=10 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## Post-Deployment Verification

### Health Check Script

Create `scripts/health-check.js`:

```javascript
const fetch = require('node-fetch');

const BASE_URL = process.env.BASE_URL || 'https://yourdomain.com';

async function runHealthChecks() {
  console.log('🏥 Running post-deployment health checks...\n');
  
  const checks = [
    {
      name: 'Application Health',
      url: `${BASE_URL}/health`,
      expected: 200
    },
    {
      name: 'Integration Status',
      url: `${BASE_URL}/api/integrations/status`,
      expected: 200
    },
    {
      name: 'Database Connection',
      url: `${BASE_URL}/api/auth/me`,
      expected: [401, 200] // Either unauthorized or valid user
    }
  ];
  
  let allPassed = true;
  
  for (const check of checks) {
    try {
      const response = await fetch(check.url);
      const expectedCodes = Array.isArray(check.expected) ? check.expected : [check.expected];
      
      if (expectedCodes.includes(response.status)) {
        console.log(`✅ ${check.name} - OK (${response.status})`);
      } else {
        console.log(`❌ ${check.name} - Failed (${response.status})`);
        allPassed = false;
      }
    } catch (error) {
      console.log(`❌ ${check.name} - Error: ${error.message}`);
      allPassed = false;
    }
  }
  
  // Test specific integrations
  console.log('\n🔌 Testing integrations...');
  
  try {
    const integrationResponse = await fetch(`${BASE_URL}/api/integrations/status`);
    const integrations = await integrationResponse.json();
    
    Object.entries(integrations.integrations).forEach(([name, config]) => {
      if (config.available) {
        console.log(`✅ ${name} - Available`);
      } else {
        console.log(`⚠️  ${name} - Unavailable (${config.fallback || 'no fallback'})`);
      }
    });
  } catch (error) {
    console.log(`❌ Integration check failed: ${error.message}`);
    allPassed = false;
  }
  
  // Summary
  console.log('\n📊 Health Check Results:');
  if (allPassed) {
    console.log('✅ All checks passed - deployment successful');
    process.exit(0);
  } else {
    console.log('❌ Some checks failed - review deployment');
    process.exit(1);
  }
}

runHealthChecks().catch(console.error);
```

Run health checks:
```bash
node scripts/health-check.js
```

### Manual Verification

1. **Test Authentication**
   ```bash
   # Test registration
   curl -X POST https://yourdomain.com/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!","firstName":"Test","lastName":"User"}'
   
   # Test login
   curl -X POST https://yourdomain.com/api/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"Test123!"}'
   ```

2. **Test File Upload**
   ```bash
   # Test CV upload (requires authentication)
   curl -X POST https://yourdomain.com/api/cv/upload \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -F "cv=@sample-cv.pdf"
   ```

3. **Test Payment Integration**
   ```bash
   # Test payment creation
   curl -X POST https://yourdomain.com/api/subscription/create \
     -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"planId":"Premium","paymentProvider":"stripe"}'
   ```

### Performance Testing

1. **Load Testing Script**
   ```bash
   # Install artillery
   npm install -g artillery
   
   # Create test config
   cat > load-test.yml << EOF
   config:
     target: 'https://yourdomain.com'
     phases:
       - duration: 60
         arrivalRate: 10
         name: "Warm up"
       - duration: 300
         arrivalRate: 50
         name: "Load test"
   scenarios:
     - name: "API health check"
       weight: 100
       flow:
         - get:
             url: "/api/integrations/status"
   EOF
   
   # Run load test
   artillery run load-test.yml
   ```

2. **Database Performance**
   ```sql
   -- Monitor query performance
   SELECT query, mean_time, calls, total_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 10;
   
   -- Check connection usage
   SELECT count(*) as connection_count, state
   FROM pg_stat_activity
   GROUP BY state;
   ```

---

## Monitoring and Maintenance

### Application Monitoring

#### Health Endpoints

```javascript
// Basic health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version
  });
});

// Deep health check
app.get('/health/deep', async (req, res) => {
  const checks = {
    database: await checkDatabaseHealth(),
    integrations: await checkIntegrationHealth(),
    memory: process.memoryUsage(),
    cpu: process.cpuUsage()
  };
  
  const healthy = checks.database.healthy && 
                  Object.values(checks.integrations).every(i => i.available || i.fallback);
  
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  });
});
```

#### Logging Configuration

```javascript
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Usage
logger.info('Application started', { port: 5000 });
logger.error('Database connection failed', { error: error.message });
```

### Database Maintenance

#### Automated Backups

```bash
#!/bin/bash
# backup-db.sh

BACKUP_DIR="/backups/jobr"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="jobr_backup_${DATE}.sql"

# Create backup directory
mkdir -p $BACKUP_DIR

# Create backup
pg_dump $DATABASE_URL > "${BACKUP_DIR}/${BACKUP_FILE}"

# Compress backup
gzip "${BACKUP_DIR}/${BACKUP_FILE}"

# Remove backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

echo "Backup completed: ${BACKUP_FILE}.gz"
```

Add to crontab:
```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup-db.sh
```

#### Database Monitoring

```sql
-- Monitor table sizes
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_tup_read DESC;

-- Check for missing indexes
SELECT 
  schemaname,
  tablename,
  seq_scan,
  seq_tup_read,
  seq_tup_read / seq_scan as avg_tup_per_scan
FROM pg_stat_user_tables
WHERE seq_scan > 0
ORDER BY seq_tup_read DESC;
```

### Error Monitoring

#### Sentry Integration

```javascript
const Sentry = require('@sentry/node');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1, // Adjust based on traffic
  });
  
  // Express error handler
  app.use(Sentry.Handlers.errorHandler());
}

// Custom error tracking
function trackError(error, context = {}) {
  if (process.env.SENTRY_DSN) {
    Sentry.captureException(error, { extra: context });
  }
  logger.error(error.message, { error: error.stack, ...context });
}
```

### Performance Monitoring

#### Metrics Collection

```javascript
const prometheus = require('prom-client');

// Create metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new prometheus.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

// Middleware to track request duration
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  
  next();
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.set('Content-Type', prometheus.register.contentType);
  res.end(prometheus.register.metrics());
});
```

### Automated Monitoring Scripts

#### System Resource Monitor

```bash
#!/bin/bash
# monitor-resources.sh

THRESHOLD_CPU=80
THRESHOLD_MEMORY=80
THRESHOLD_DISK=90

# Check CPU usage
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | awk -F'%' '{print $1}')
if (( $(echo "$CPU_USAGE > $THRESHOLD_CPU" | bc -l) )); then
  echo "HIGH CPU USAGE: ${CPU_USAGE}%" | mail -s "Alert: High CPU Usage" admin@yourdomain.com
fi

# Check memory usage
MEMORY_USAGE=$(free | grep Mem | awk '{printf("%.2f"), $3/$2 * 100.0}')
if (( $(echo "$MEMORY_USAGE > $THRESHOLD_MEMORY" | bc -l) )); then
  echo "HIGH MEMORY USAGE: ${MEMORY_USAGE}%" | mail -s "Alert: High Memory Usage" admin@yourdomain.com
fi

# Check disk usage
DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ $DISK_USAGE -gt $THRESHOLD_DISK ]; then
  echo "HIGH DISK USAGE: ${DISK_USAGE}%" | mail -s "Alert: High Disk Usage" admin@yourdomain.com
fi
```

---

## Scaling Considerations

### Horizontal Scaling

#### Load Balancer Configuration

```nginx
upstream jobr_backend {
    least_conn;
    server 10.0.1.10:5000 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.11:5000 weight=1 max_fails=3 fail_timeout=30s;
    server 10.0.1.12:5000 weight=1 max_fails=3 fail_timeout=30s;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;
    
    location /api/ {
        proxy_pass http://jobr_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Health check
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
}
```

#### Session Management for Multiple Instances

```javascript
// Use PostgreSQL for session storage
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

app.use(session({
  store: new pgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    tableName: 'sessions',
    createTableIfMissing: true,
  }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
```

### Database Scaling

#### Read Replicas

```javascript
// Database connection with read replicas
const masterConfig = {
  connectionString: process.env.DATABASE_URL,
  max: 10,
};

const replicaConfig = {
  connectionString: process.env.DATABASE_REPLICA_URL,
  max: 20,
};

// Use read replica for queries
async function getJobs(limit) {
  return await replicaConnection.select().from(jobs).limit(limit);
}

// Use master for writes
async function createJob(jobData) {
  return await masterConnection.insert(jobs).values(jobData);
}
```

#### Database Partitioning

```sql
-- Partition applications table by created date
CREATE TABLE applications_2024 PARTITION OF applications
FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE applications_2025 PARTITION OF applications
FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

-- Create indexes on partitions
CREATE INDEX idx_applications_2024_user_id ON applications_2024(user_id);
CREATE INDEX idx_applications_2025_user_id ON applications_2025(user_id);
```

### Caching Strategy

#### Redis Implementation

```javascript
const redis = require('redis');
const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

// Cache middleware
function cacheMiddleware(ttl = 300) {
  return async (req, res, next) => {
    const key = `cache:${req.originalUrl}`;
    
    try {
      const cached = await client.get(key);
      if (cached) {
        return res.json(JSON.parse(cached));
      }
      
      // Override res.json to cache response
      const originalJson = res.json;
      res.json = function(data) {
        client.setex(key, ttl, JSON.stringify(data));
        return originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      // If Redis fails, continue without caching
      next();
    }
  };
}

// Usage
app.get('/api/jobs', cacheMiddleware(600), getJobs); // Cache for 10 minutes
```

### CDN Configuration

#### CloudFlare Setup

```javascript
// Cache-Control headers for static assets
app.use('/assets', express.static('public', {
  maxAge: '1y',
  setHeaders: (res, path) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
}));

// API response caching
app.use('/api/jobs', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minutes
  next();
});

app.use('/api/integrations/status', (req, res, next) => {
  res.setHeader('Cache-Control', 'public, max-age=60'); // 1 minute
  next();
});
```

---

## Troubleshooting

### Common Deployment Issues

#### 1. Environment Variables Not Loading

**Symptoms:**
- Application fails to start
- Integrations show as unavailable
- Database connection errors

**Solutions:**
```bash
# Check environment variables
printenv | grep -E "(DATABASE|OPENAI|STRIPE)"

# Verify .env file loading
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL ? 'OK' : 'Missing');"

# Check file permissions
ls -la .env
chmod 600 .env
```

#### 2. Database Connection Issues

**Symptoms:**
- "Connection refused" errors
- "Authentication failed" messages
- Timeout errors

**Diagnosis:**
```bash
# Test database connection
psql $DATABASE_URL -c "SELECT version();"

# Check connection string format
echo $DATABASE_URL

# Test network connectivity
telnet your-db-host 5432
```

**Solutions:**
```bash
# Fix connection string format
# Correct: postgresql://user:pass@host:5432/db
# Common mistake: postgres:// (should be postgresql://)

# Check firewall rules
sudo ufw status
sudo firewall-cmd --list-all

# Verify SSL requirements
psql "$DATABASE_URL?sslmode=require" -c "SELECT 1;"
```

#### 3. SSL Certificate Issues

**Symptoms:**
- "Certificate verification failed"
- Mixed content warnings
- HTTPS redirects not working

**Solutions:**
```bash
# Check certificate validity
openssl s_client -connect yourdomain.com:443 -servername yourdomain.com

# Verify certificate chain
curl -I https://yourdomain.com

# Check SSL configuration
nginx -t
systemctl reload nginx
```

#### 4. Payment Webhook Failures

**Symptoms:**
- Payments not updating subscription status
- Webhook endpoint returning errors
- Signature verification failures

**Diagnosis:**
```bash
# Test webhook endpoint
curl -X POST https://yourdomain.com/api/stripe/webhook \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: test" \
  -d '{"test": true}'

# Check webhook logs
tail -f /var/log/nginx/access.log | grep webhook
```

**Solutions:**
```javascript
// Verify webhook configuration
app.post('/webhooks/stripe', express.raw({type: 'application/json'}), (req, res) => {
  console.log('Webhook received:', {
    headers: req.headers,
    body: req.body.toString(),
    signature: req.headers['stripe-signature']
  });
  
  // Continue with processing...
});
```

### Performance Issues

#### 1. Slow Database Queries

**Diagnosis:**
```sql
-- Enable query logging
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000; -- Log queries > 1s

-- Check slow queries
SELECT query, mean_time, calls, total_time
FROM pg_stat_statements
WHERE mean_time > 1000
ORDER BY mean_time DESC;

-- Check missing indexes
SELECT schemaname, tablename, attname, n_distinct, correlation
FROM pg_stats
WHERE schemaname = 'public'
  AND n_distinct > 0;
```

**Solutions:**
```sql
-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_applications_user_created 
ON applications(user_id, created_at DESC);

-- Analyze tables
ANALYZE applications;
ANALYZE jobs;
ANALYZE users;

-- Update table statistics
VACUUM ANALYZE;
```

#### 2. High Memory Usage

**Diagnosis:**
```bash
# Check Node.js memory usage
ps aux | grep node
top -p $(pgrep node)

# Monitor heap usage
node --inspect server/index.js
# Open chrome://inspect in Chrome
```

**Solutions:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=4096 server/index.js

# Add to PM2 config
{
  "node_args": "--max-old-space-size=4096"
}

# Monitor for memory leaks
npm install -g clinic
clinic doctor -- node server/index.js
```

#### 3. AI Service Timeouts

**Diagnosis:**
```bash
# Check OpenAI service status
curl -s https://status.openai.com/api/v2/status.json

# Test API connectivity
curl -X POST https://api.openai.com/v1/chat/completions \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4","messages":[{"role":"user","content":"test"}],"max_tokens":5}'
```

**Solutions:**
```javascript
// Implement retry logic with exponential backoff
async function callOpenAIWithRetry(payload, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await openai.chat.completions.create(payload);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      
      const delay = Math.min(1000 * Math.pow(2, i), 10000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Increase timeout
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000 // 60 seconds
});
```

### Emergency Recovery Procedures

#### 1. Database Recovery

```bash
# Stop application
pm2 stop jobr-backend

# Restore from backup
gunzip latest_backup.sql.gz
psql $DATABASE_URL < latest_backup.sql

# Verify data integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM applications;"

# Restart application
pm2 start jobr-backend
```

#### 2. Service Recovery

```bash
# Quick service restart
pm2 restart jobr-backend

# Full system restart
sudo systemctl restart nginx
sudo systemctl restart postgresql
pm2 restart all

# Check service status
pm2 status
systemctl status nginx
systemctl status postgresql
```

#### 3. Rollback Deployment

```bash
# Git rollback
git log --oneline -10
git checkout previous-stable-commit
npm install
npm run build
pm2 restart jobr-backend

# Database rollback (if needed)
# Restore from backup taken before deployment
```

### Support and Escalation

#### Monitoring Alerts

Set up automated alerts for:

```bash
# CPU usage > 80%
# Memory usage > 80%
# Disk usage > 90%
# Error rate > 5%
# Response time > 2 seconds
# Database connections > 80% of limit
```

#### Contact Information

**Infrastructure Support:**
- Database (Neon): [Neon Support](https://neon.tech/support)
- CDN (CloudFlare): [CloudFlare Support](https://support.cloudflare.com/)
- Server Monitoring: Internal team

**Integration Support:**
- OpenAI: [OpenAI Support](https://help.openai.com/)
- Stripe: [Stripe Support](https://support.stripe.com/)
- PhonePe: [PhonePe Business Support](https://business.phonepe.com/support)
- SendGrid: [SendGrid Support](https://support.sendgrid.com/)

**Emergency Procedures:**
1. Check application health endpoints
2. Review error logs and monitoring dashboards
3. Verify all integrations are functioning
4. Test critical user flows
5. Escalate to appropriate support channels

---

## Conclusion

This deployment guide provides comprehensive instructions for deploying the Jobr platform to production with enterprise-grade security and reliability.

**Key Deployment Success Factors:**

1. **Security**: Proper SSL, environment variable management, and security headers
2. **Monitoring**: Comprehensive health checks and performance monitoring
3. **Scalability**: Designed for horizontal scaling and high availability
4. **Reliability**: Robust error handling and recovery procedures
5. **Performance**: Optimized database queries and caching strategies

**Post-Deployment Checklist:**
- ✅ All environment variables configured
- ✅ Database migrations completed
- ✅ SSL certificates installed and valid
- ✅ All integrations tested and functional
- ✅ Health checks passing
- ✅ Monitoring and alerting configured
- ✅ Backup procedures established
- ✅ Performance baselines established

The platform is now ready for production use with enterprise-grade reliability and security.

---

*Last Updated: September 19, 2025*  
*Deployment Guide Version: 1.0.0*  
*Status: Production Ready*