# Jobr Platform Production Operations Guide

## Overview

This comprehensive guide covers all aspects of production deployment, monitoring, and maintenance for the Jobr platform. The platform is designed for enterprise-grade operations with 99.9% uptime targets and robust disaster recovery capabilities.

**Deployment Strategy**: Blue-Green with Rolling Updates  
**Infrastructure**: Cloud-Native with Auto-Scaling  
**Monitoring**: Full-Stack Observability  
**Backup**: Automated with Point-in-Time Recovery

---

## Table of Contents

1. [Environment Configuration](#environment-configuration)
2. [Deployment Procedures](#deployment-procedures)
3. [Database Operations](#database-operations)
4. [Monitoring and Alerting](#monitoring-and-alerting)
5. [Backup and Recovery](#backup-and-recovery)
6. [Scaling Operations](#scaling-operations)
7. [Security Operations](#security-operations)
8. [Troubleshooting Runbook](#troubleshooting-runbook)
9. [Maintenance Procedures](#maintenance-procedures)
10. [Disaster Recovery](#disaster-recovery)

---

## Environment Configuration

### 1. Production Environment Variables

**Critical Configuration:**
```bash
# Node.js Environment
NODE_ENV=production
PORT=5000

# Application Configuration
BASE_URL=https://your-domain.com
CORS_ORIGINS=https://your-domain.com,https://www.your-domain.com
API_VERSION=v1

# Security Configuration
JWT_SECRET=your-256-bit-secret-key-here
JWT_REFRESH_SECRET=your-refresh-secret-key-here
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Session Configuration
SESSION_SECRET=your-session-secret-here
SESSION_MAX_AGE=86400000
SESSION_SECURE=true
SESSION_SAME_SITE=strict

# Rate Limiting
RATE_LIMIT_WINDOW=3600000
RATE_LIMIT_MAX=1000
RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS=true

# Database Configuration
DATABASE_URL=postgresql://username:password@host:5432/jobr_production?sslmode=require
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=2000

# Redis Configuration (Optional)
REDIS_URL=redis://username:password@redis-host:6379
REDIS_TLS=true
REDIS_MAX_RETRIES=3

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-your-production-openai-key
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=4000
OPENAI_TIMEOUT=30000

# Stripe Configuration
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# PhonePe Configuration (India)
PHONEPE_MERCHANT_ID=YOUR_LIVE_MERCHANT_ID
PHONEPE_SALT_KEY=your_production_salt_key
PHONEPE_SALT_INDEX=1
PHONEPE_ENVIRONMENT=PRODUCTION

# SendGrid Configuration
SENDGRID_API_KEY=SG.your_production_sendgrid_key
SENDGRID_FROM_EMAIL=noreply@your-domain.com
SENDGRID_FROM_NAME="Your App Name"

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your_google_client_id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your_google_client_secret

# File Upload Configuration
MAX_FILE_SIZE=5242880
UPLOAD_PATH=/var/uploads
ALLOWED_FILE_TYPES=application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document

# Monitoring and Logging
LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_REQUEST_LOGGING=true

# Performance Configuration
CLUSTER_WORKERS=4
MEMORY_LIMIT=1024
CPU_LIMIT=1000

# Health Check Configuration
HEALTH_CHECK_INTERVAL=30000
HEALTH_CHECK_TIMEOUT=5000
```

### 2. Environment-Specific Configurations

**Staging Environment:**
```bash
NODE_ENV=staging
BASE_URL=https://staging.your-domain.com
DATABASE_URL=postgresql://user:pass@staging-db:5432/jobr_staging
STRIPE_SECRET_KEY=sk_test_staging_key
PHONEPE_ENVIRONMENT=SANDBOX
LOG_LEVEL=debug
```

**Development Environment:**
```bash
NODE_ENV=development
BASE_URL=http://localhost:5000
DATABASE_URL=postgresql://user:pass@localhost:5432/jobr_dev
STRIPE_SECRET_KEY=sk_test_dev_key
LOG_LEVEL=debug
ENABLE_HOT_RELOAD=true
```

### 3. Configuration Validation

**Startup Validation Script:**
```typescript
// config/validate.ts
export const validateProductionConfig = (): void => {
  const requiredVars = [
    'DATABASE_URL',
    'JWT_SECRET',
    'STRIPE_SECRET_KEY',
    'OPENAI_API_KEY',
    'SENDGRID_API_KEY'
  ];

  const missingVars = requiredVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:');
    missingVars.forEach(varName => console.error(`   - ${varName}`));
    process.exit(1);
  }

  // Validate critical configurations
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      console.error('❌ JWT_SECRET must be at least 32 characters in production');
      process.exit(1);
    }

    if (!process.env.DATABASE_URL?.includes('sslmode=require')) {
      console.warn('⚠️ Database SSL should be enabled in production');
    }

    if (process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_')) {
      console.error('❌ Using test Stripe keys in production');
      process.exit(1);
    }
  }

  console.log('✅ Configuration validation passed');
};
```

---

## Deployment Procedures

### 1. Blue-Green Deployment Strategy

**Deployment Architecture:**
```yaml
# Blue-Green Setup
Production:
  Blue Environment:
    - Current live traffic (100%)
    - Version: v1.5.0
    - Status: Active
  
  Green Environment:
    - New version deployment
    - Version: v1.6.0
    - Status: Staging
    - Health checks: Passing
    
Load Balancer:
  - Routes 100% traffic to Blue
  - Health checks both environments
  - Instant cutover capability
```

**Deployment Steps:**

1. **Pre-Deployment Checks:**
   ```bash
   #!/bin/bash
   # scripts/pre-deploy.sh
   
   echo "🔍 Pre-deployment checks..."
   
   # Check database connectivity
   npm run db:check || exit 1
   
   # Run migration dry-run
   npm run db:migrate:dry-run || exit 1
   
   # Run test suite
   npm test || exit 1
   
   # Check external service connectivity
   npm run integration:check || exit 1
   
   # Validate configuration
   npm run config:validate || exit 1
   
   echo "✅ Pre-deployment checks passed"
   ```

2. **Green Environment Deployment:**
   ```bash
   #!/bin/bash
   # scripts/deploy-green.sh
   
   echo "🚀 Deploying to Green environment..."
   
   # Deploy new version to Green
   docker build -t jobr:${VERSION} .
   docker tag jobr:${VERSION} jobr:green
   
   # Update Green environment
   docker-compose -f docker-compose.green.yml up -d
   
   # Wait for health checks
   ./scripts/wait-for-health.sh green
   
   # Run smoke tests
   npm run test:smoke -- --env=green
   
   echo "✅ Green deployment completed"
   ```

3. **Traffic Cutover:**
   ```bash
   #!/bin/bash
   # scripts/cutover.sh
   
   echo "🔄 Switching traffic to Green..."
   
   # Update load balancer configuration
   ./scripts/update-lb-config.sh green
   
   # Monitor for 5 minutes
   sleep 300
   
   # Check error rates
   ERROR_RATE=$(./scripts/check-error-rate.sh)
   if [ $ERROR_RATE -gt 1 ]; then
     echo "❌ High error rate detected, rolling back"
     ./scripts/rollback.sh
     exit 1
   fi
   
   echo "✅ Cutover successful"
   ```

### 2. Rolling Updates

**For Minor Updates:**
```bash
#!/bin/bash
# scripts/rolling-update.sh

echo "🔄 Performing rolling update..."

INSTANCES=(instance-1 instance-2 instance-3 instance-4)

for INSTANCE in "${INSTANCES[@]}"; do
  echo "Updating $INSTANCE..."
  
  # Remove from load balancer
  ./scripts/lb-remove.sh $INSTANCE
  
  # Wait for connections to drain
  sleep 30
  
  # Update instance
  ./scripts/update-instance.sh $INSTANCE
  
  # Health check
  ./scripts/health-check.sh $INSTANCE || exit 1
  
  # Add back to load balancer
  ./scripts/lb-add.sh $INSTANCE
  
  # Wait before next instance
  sleep 30
done

echo "✅ Rolling update completed"
```

### 3. Database Migrations

**Safe Migration Process:**
```bash
#!/bin/bash
# scripts/migrate.sh

echo "🗄️ Running database migrations..."

# Create backup before migration
./scripts/backup-db.sh pre-migration

# Run migrations with timeout
timeout 300 npm run db:migrate

if [ $? -eq 0 ]; then
  echo "✅ Migrations completed successfully"
else
  echo "❌ Migration failed, restoring backup"
  ./scripts/restore-db.sh pre-migration
  exit 1
fi

# Verify database integrity
npm run db:verify || {
  echo "❌ Database verification failed"
  exit 1
}
```

### 4. Rollback Procedures

**Automatic Rollback:**
```bash
#!/bin/bash
# scripts/rollback.sh

echo "🔙 Initiating rollback..."

# Switch load balancer back to Blue
./scripts/update-lb-config.sh blue

# Wait for traffic to stabilize
sleep 60

# Check if rollback resolved issues
ERROR_RATE=$(./scripts/check-error-rate.sh)
if [ $ERROR_RATE -lt 1 ]; then
  echo "✅ Rollback successful"
  # Notify team
  ./scripts/notify-rollback.sh "Automatic rollback successful"
else
  echo "❌ Rollback did not resolve issues"
  # Escalate to on-call team
  ./scripts/escalate.sh "Critical: Rollback failed"
fi
```

---

## Database Operations

### 1. Database Configuration

**Production Database Settings:**
```sql
-- PostgreSQL configuration optimizations
-- postgresql.conf

# Connection settings
max_connections = 200
shared_buffers = 256MB
effective_cache_size = 1GB
maintenance_work_mem = 64MB
checkpoint_completion_target = 0.9
wal_buffers = 16MB
default_statistics_target = 100

# Logging
log_destination = 'stderr'
logging_collector = on
log_directory = '/var/log/postgresql'
log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log'
log_rotation_age = 1d
log_rotation_size = 100MB
log_min_duration_statement = 1000ms
log_statement = 'mod'
log_checkpoints = on
log_connections = on
log_disconnections = on

# Replication
wal_level = replica
max_wal_senders = 3
wal_keep_segments = 32
```

### 2. Migration Management

**Migration Scripts:**
```typescript
// migrations/001_create_indexes.sql
-- Performance-critical indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_applications_user_status 
  ON applications(user_id, status);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_posted_date 
  ON jobs(posted_date DESC);

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_jobs_search 
  ON jobs USING gin(to_tsvector('english', title || ' ' || company || ' ' || description));
```

**Migration Validation:**
```typescript
// scripts/validate-migration.ts
import { db } from '../server/db';

const validateMigration = async (): Promise<void> => {
  console.log('🔍 Validating database migration...');
  
  try {
    // Check table existence
    const tables = await db.execute(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    const requiredTables = [
      'users', 'jobs', 'applications', 'cvs', 
      'subscriptions', 'payments'
    ];
    
    const existingTables = tables.rows.map(row => row.table_name);
    const missingTables = requiredTables.filter(
      table => !existingTables.includes(table)
    );
    
    if (missingTables.length > 0) {
      throw new Error(`Missing tables: ${missingTables.join(', ')}`);
    }
    
    // Check indexes
    const indexes = await db.execute(`
      SELECT indexname FROM pg_indexes 
      WHERE schemaname = 'public'
    `);
    
    const criticalIndexes = [
      'idx_users_email',
      'idx_applications_user_status',
      'idx_jobs_posted_date'
    ];
    
    const existingIndexes = indexes.rows.map(row => row.indexname);
    const missingIndexes = criticalIndexes.filter(
      index => !existingIndexes.includes(index)
    );
    
    if (missingIndexes.length > 0) {
      console.warn(`⚠️ Missing indexes: ${missingIndexes.join(', ')}`);
    }
    
    // Test basic queries
    await db.execute('SELECT COUNT(*) FROM users');
    await db.execute('SELECT COUNT(*) FROM jobs');
    
    console.log('✅ Database validation passed');
  } catch (error) {
    console.error('❌ Database validation failed:', error);
    process.exit(1);
  }
};
```

### 3. Database Monitoring

**Performance Monitoring Queries:**
```sql
-- Monitor slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows,
  100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0) AS hit_percent
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Monitor connection usage
SELECT 
  state,
  COUNT(*) as connections
FROM pg_stat_activity 
GROUP BY state;

-- Monitor index usage
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_tup_read,
  idx_tup_fetch,
  idx_tup_read / GREATEST(idx_tup_fetch, 1) as reads_per_fetch
FROM pg_stat_user_indexes 
ORDER BY idx_tup_read DESC 
LIMIT 10;

-- Monitor database size
SELECT 
  pg_database.datname,
  pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database 
ORDER BY pg_database_size(pg_database.datname) DESC;
```

**Automated Monitoring Script:**
```bash
#!/bin/bash
# scripts/monitor-db.sh

echo "📊 Database Health Check - $(date)"

# Connection count
CONNECTIONS=$(psql $DATABASE_URL -t -c "SELECT count(*) FROM pg_stat_activity;")
echo "Active Connections: $CONNECTIONS/200"

if [ $CONNECTIONS -gt 180 ]; then
  echo "⚠️ Warning: High connection count"
  ./scripts/alert.sh "Database connection count high: $CONNECTIONS"
fi

# Slow queries
SLOW_QUERIES=$(psql $DATABASE_URL -t -c "
  SELECT count(*) FROM pg_stat_activity 
  WHERE state = 'active' AND now() - query_start > interval '30 seconds';
")
echo "Slow Queries (>30s): $SLOW_QUERIES"

if [ $SLOW_QUERIES -gt 5 ]; then
  echo "⚠️ Warning: Multiple slow queries detected"
  ./scripts/alert.sh "Multiple slow database queries detected: $SLOW_QUERIES"
fi

# Database size
DB_SIZE=$(psql $DATABASE_URL -t -c "
  SELECT pg_size_pretty(pg_database_size(current_database()));
")
echo "Database Size: $DB_SIZE"

echo "✅ Database health check completed"
```

---

## Monitoring and Alerting

### 1. Health Check Endpoints

**Application Health Check:**
```typescript
// routes/health.ts
import express from 'express';
import { db } from '../db';

const router = express.Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    external_services: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
}

router.get('/health', async (req, res) => {
  const startTime = Date.now();
  const healthStatus: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || '1.0.0',
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      external_services: await checkExternalServices(),
      memory: checkMemoryUsage(),
      disk: await checkDiskSpace()
    }
  };

  // Determine overall status
  const failedChecks = Object.values(healthStatus.checks)
    .filter(check => !check.healthy);

  if (failedChecks.length > 0) {
    healthStatus.status = failedChecks.length > 2 ? 'unhealthy' : 'degraded';
  }

  const responseTime = Date.now() - startTime;
  res.set('X-Response-Time', `${responseTime}ms`);
  
  res.status(healthStatus.status === 'healthy' ? 200 : 503)
     .json(healthStatus);
});

const checkDatabase = async (): Promise<HealthCheck> => {
  try {
    const startTime = Date.now();
    await db.execute('SELECT 1');
    
    return {
      healthy: true,
      responseTime: Date.now() - startTime,
      message: 'Database connection successful'
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      message: 'Database connection failed'
    };
  }
};

const checkExternalServices = async (): Promise<HealthCheck> => {
  const services = ['openai', 'stripe', 'sendgrid'];
  let healthyCount = 0;
  
  for (const service of services) {
    try {
      await checkServiceHealth(service);
      healthyCount++;
    } catch (error) {
      console.warn(`Service ${service} health check failed:`, error.message);
    }
  }
  
  const allHealthy = healthyCount === services.length;
  
  return {
    healthy: allHealthy,
    message: `${healthyCount}/${services.length} external services healthy`,
    details: { healthy_services: healthyCount, total_services: services.length }
  };
};
```

### 2. Metrics Collection

**Application Metrics:**
```typescript
// monitoring/metrics.ts
import * as prometheus from 'prom-client';

// Create metrics registry
const register = new prometheus.Register();

// Application metrics
const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10]
});

const httpRequestTotal = new prometheus.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const databaseQueryDuration = new prometheus.Histogram({
  name: 'database_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['operation', 'table'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5]
});

const activeConnections = new prometheus.Gauge({
  name: 'database_connections_active',
  help: 'Number of active database connections'
});

const memoryUsage = new prometheus.Gauge({
  name: 'process_memory_usage_bytes',
  help: 'Process memory usage in bytes',
  labelNames: ['type']
});

// Register metrics
register.registerMetric(httpRequestDuration);
register.registerMetric(httpRequestTotal);
register.registerMetric(databaseQueryDuration);
register.registerMetric(activeConnections);
register.registerMetric(memoryUsage);

// Middleware to collect HTTP metrics
export const metricsMiddleware = (req: any, res: any, next: any) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - startTime) / 1000;
    const route = req.route?.path || req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    httpRequestTotal
      .labels(req.method, route, res.statusCode.toString())
      .inc();
  });
  
  next();
};

// Collect system metrics
const collectSystemMetrics = () => {
  const memUsage = process.memoryUsage();
  memoryUsage.labels('rss').set(memUsage.rss);
  memoryUsage.labels('heapUsed').set(memUsage.heapUsed);
  memoryUsage.labels('heapTotal').set(memUsage.heapTotal);
  memoryUsage.labels('external').set(memUsage.external);
};

// Update system metrics every 10 seconds
setInterval(collectSystemMetrics, 10000);

// Metrics endpoint
export const getMetrics = async (req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
};
```

### 3. Alerting Configuration

**Alert Rules (Prometheus/Grafana):**
```yaml
# alerts/rules.yml
groups:
  - name: application-alerts
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status_code=~"5.."}[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is above 5% for 2 minutes"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, http_request_duration_seconds_bucket) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time above 2 seconds"

      - alert: DatabaseConnectionHigh
        expr: database_connections_active > 180
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "High database connection usage"
          description: "Database connections above 180 (90% of max)"

      - alert: MemoryUsageHigh
        expr: process_memory_usage_bytes{type="rss"} > 1073741824 # 1GB
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Process memory usage above 1GB"

  - name: external-service-alerts
    rules:
      - alert: OpenAIServiceDown
        expr: up{job="openai"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "OpenAI service unavailable"
          description: "OpenAI integration health check failing"

      - alert: StripeServiceDown
        expr: up{job="stripe"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Stripe service unavailable"
          description: "Payment processing may be affected"
```

**Notification Channels:**
```typescript
// monitoring/notifications.ts
import { WebClient } from '@slack/web-api';

class NotificationService {
  private slack = new WebClient(process.env.SLACK_BOT_TOKEN);
  
  async sendAlert(alert: Alert): Promise<void> {
    const color = alert.severity === 'critical' ? '#FF0000' : '#FFA500';
    
    try {
      await this.slack.chat.postMessage({
        channel: '#ops-alerts',
        attachments: [{
          color,
          title: alert.summary,
          text: alert.description,
          fields: [
            { title: 'Severity', value: alert.severity, short: true },
            { title: 'Time', value: new Date().toISOString(), short: true },
            { title: 'Environment', value: process.env.NODE_ENV, short: true }
          ]
        }]
      });
    } catch (error) {
      console.error('Failed to send Slack notification:', error);
      // Fallback to email or other notification method
    }
  }
  
  async sendRecoveryNotification(alert: Alert): Promise<void> {
    await this.slack.chat.postMessage({
      channel: '#ops-alerts',
      text: `✅ RESOLVED: ${alert.summary}`,
      attachments: [{
        color: '#00FF00',
        text: 'Alert has been resolved',
        fields: [
          { title: 'Recovery Time', value: new Date().toISOString(), short: true }
        ]
      }]
    });
  }
}
```

---

## Backup and Recovery

### 1. Database Backup Strategy

**Automated Backup Script:**
```bash
#!/bin/bash
# scripts/backup-db.sh

BACKUP_DIR="/var/backups/postgresql"
DATE=$(date +%Y%m%d_%H%M%S)
DB_NAME=$(echo $DATABASE_URL | sed 's/.*\/\([^?]*\).*/\1/')
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.sql"

echo "🗄️ Starting database backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Create full database backup
pg_dump $DATABASE_URL > $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "✅ Database backup completed: $BACKUP_FILE"
  
  # Compress backup
  gzip $BACKUP_FILE
  
  # Upload to cloud storage (AWS S3, Google Cloud, etc.)
  aws s3 cp "${BACKUP_FILE}.gz" s3://your-backup-bucket/database/
  
  # Clean up old local backups (keep last 7 days)
  find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete
  
  echo "✅ Backup uploaded and old backups cleaned"
else
  echo "❌ Database backup failed"
  exit 1
fi
```

**Continuous WAL Archiving:**
```bash
#!/bin/bash
# scripts/wal-archive.sh

# PostgreSQL WAL archiving configuration
# Add to postgresql.conf:
# wal_level = replica
# archive_mode = on
# archive_command = '/path/to/scripts/wal-archive.sh %p %f'

WAL_FILE=$1
WAL_PATH=$2
ARCHIVE_DIR="/var/backups/postgresql/wal"

mkdir -p $ARCHIVE_DIR

# Copy WAL file to archive location
cp $WAL_PATH "${ARCHIVE_DIR}/${WAL_FILE}"

if [ $? -eq 0 ]; then
  # Upload to cloud storage
  aws s3 cp "${ARCHIVE_DIR}/${WAL_FILE}" s3://your-backup-bucket/wal/
  echo "WAL file archived: $WAL_FILE"
else
  echo "Failed to archive WAL file: $WAL_FILE"
  exit 1
fi
```

### 2. Point-in-Time Recovery

**Recovery Script:**
```bash
#!/bin/bash
# scripts/restore-db.sh

RESTORE_TIME=$1
BACKUP_FILE=$2

if [ -z "$RESTORE_TIME" ] || [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <restore_time> <backup_file>"
  echo "Example: $0 '2024-01-01 12:00:00' /backups/db_20240101.sql"
  exit 1
fi

echo "🔄 Starting point-in-time recovery to $RESTORE_TIME"

# Stop application
systemctl stop jobr-app

# Create recovery database
createdb jobr_recovery

# Restore base backup
echo "Restoring base backup..."
psql jobr_recovery < $BACKUP_FILE

# Create recovery configuration
cat > /tmp/recovery.conf << EOF
restore_command = 'cp /var/backups/postgresql/wal/%f %p'
recovery_target_time = '$RESTORE_TIME'
recovery_target_timeline = 'latest'
EOF

# Start PostgreSQL in recovery mode
cp /tmp/recovery.conf $PGDATA/
systemctl start postgresql

# Wait for recovery to complete
echo "Waiting for recovery to complete..."
while [ -f "$PGDATA/recovery.conf" ]; do
  sleep 10
done

echo "✅ Point-in-time recovery completed"

# Rename databases
psql -c "ALTER DATABASE jobr_production RENAME TO jobr_old;"
psql -c "ALTER DATABASE jobr_recovery RENAME TO jobr_production;"

# Restart application
systemctl start jobr-app

echo "✅ Recovery completed and application restarted"
```

### 3. Application Data Backup

**File System Backup:**
```bash
#!/bin/bash
# scripts/backup-files.sh

BACKUP_DIR="/var/backups/application"
DATE=$(date +%Y%m%d_%H%M%S)
APP_DIR="/var/www/jobr"

echo "📁 Starting application file backup..."

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup uploaded files
tar -czf "${BACKUP_DIR}/uploads_${DATE}.tar.gz" "${APP_DIR}/uploads"

# Backup configuration files
tar -czf "${BACKUP_DIR}/config_${DATE}.tar.gz" \
  "${APP_DIR}/.env" \
  "${APP_DIR}/package.json" \
  "${APP_DIR}/package-lock.json"

# Upload to cloud storage
aws s3 sync $BACKUP_DIR s3://your-backup-bucket/application/

# Clean up old backups
find $BACKUP_DIR -name "*.tar.gz" -mtime +30 -delete

echo "✅ Application file backup completed"
```

---

## Scaling Operations

### 1. Horizontal Scaling

**Auto-Scaling Configuration:**
```yaml
# docker-compose.scale.yml
version: '3.8'
services:
  app:
    image: jobr:latest
    deploy:
      replicas: 4
      update_config:
        parallelism: 1
        delay: 30s
        order: start-first
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1024M
        reservations:
          cpus: '0.5'
          memory: 512M
    networks:
      - app-network
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**Load Balancer Configuration:**
```nginx
# nginx.conf
upstream app_servers {
    least_conn;
    server app_1:5000 max_fails=3 fail_timeout=30s;
    server app_2:5000 max_fails=3 fail_timeout=30s;
    server app_3:5000 max_fails=3 fail_timeout=30s;
    server app_4:5000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name your-domain.com;
    
    # Health check endpoint
    location /health {
        access_log off;
        proxy_pass http://app_servers;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
        proxy_read_timeout 30s;
        proxy_connect_timeout 5s;
    }
    
    # Main application
    location / {
        proxy_pass http://app_servers;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Host $host;
        proxy_read_timeout 120s;
        proxy_connect_timeout 10s;
        
        # Enable connection pooling
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
    
    # Static files
    location /static/ {
        root /var/www;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

### 2. Database Scaling

**Read Replica Setup:**
```bash
#!/bin/bash
# scripts/setup-read-replica.sh

echo "🔄 Setting up database read replica..."

# Create read replica (using cloud provider CLI)
# Example for AWS RDS
aws rds create-db-instance-read-replica \
  --db-instance-identifier jobr-db-replica \
  --source-db-instance-identifier jobr-db-primary \
  --db-instance-class db.t3.medium \
  --publicly-accessible \
  --auto-minor-version-upgrade

echo "✅ Read replica creation initiated"
```

**Connection Pool Configuration:**
```typescript
// db/pool.ts
import { Pool } from 'pg';

const primaryPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15, // Reserve some connections for writes
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const readReplicaPool = new Pool({
  connectionString: process.env.READ_REPLICA_URL,
  max: 20, // More connections for reads
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export class DatabaseRouter {
  static async query(sql: string, params?: any[], readOnly: boolean = false) {
    const pool = readOnly ? readReplicaPool : primaryPool;
    
    try {
      const result = await pool.query(sql, params);
      return result;
    } catch (error) {
      // Fallback to primary on read replica failure
      if (readOnly && readReplicaPool) {
        console.warn('Read replica failed, falling back to primary');
        return primaryPool.query(sql, params);
      }
      throw error;
    }
  }
}
```

---

## Security Operations

### 1. SSL/TLS Management

**Certificate Management:**
```bash
#!/bin/bash
# scripts/renew-ssl.sh

echo "🔒 Renewing SSL certificates..."

# Renew Let's Encrypt certificates
certbot renew --nginx --quiet

if [ $? -eq 0 ]; then
  echo "✅ SSL certificates renewed"
  
  # Test nginx configuration
  nginx -t
  
  if [ $? -eq 0 ]; then
    # Reload nginx
    systemctl reload nginx
    echo "✅ Nginx reloaded with new certificates"
  else
    echo "❌ Nginx configuration test failed"
    exit 1
  fi
else
  echo "❌ SSL certificate renewal failed"
  exit 1
fi
```

### 2. Security Monitoring

**Intrusion Detection:**
```bash
#!/bin/bash
# scripts/security-check.sh

echo "🔍 Running security checks..."

# Check for failed login attempts
FAILED_LOGINS=$(tail -1000 /var/log/auth.log | grep "Failed password" | wc -l)
if [ $FAILED_LOGINS -gt 10 ]; then
  echo "⚠️ High number of failed logins: $FAILED_LOGINS"
  ./scripts/alert.sh "Security: High failed login attempts: $FAILED_LOGINS"
fi

# Check for unusual network connections
CONNECTIONS=$(netstat -an | grep ESTABLISHED | wc -l)
echo "Active connections: $CONNECTIONS"

# Check file integrity
tripwire --check --quiet
if [ $? -ne 0 ]; then
  echo "⚠️ File integrity check failed"
  ./scripts/alert.sh "Security: File integrity violation detected"
fi

# Check for rootkits
rkhunter --check --skip-keypress --report-warnings-only

echo "✅ Security check completed"
```

### 3. Access Control

**API Key Rotation:**
```typescript
// scripts/rotate-api-keys.ts
class SecurityOperations {
  static async rotateAPIKeys(): Promise<void> {
    console.log('🔄 Starting API key rotation...');
    
    // Generate new keys
    const newOpenAIKey = await this.generateNewOpenAIKey();
    const newStripeKey = await this.generateNewStripeKey();
    
    // Update configuration
    await this.updateEnvironmentVariable('OPENAI_API_KEY', newOpenAIKey);
    await this.updateEnvironmentVariable('STRIPE_SECRET_KEY', newStripeKey);
    
    // Validate new keys
    await this.validateAPIKeys();
    
    // Update deployment
    await this.deployWithNewKeys();
    
    // Revoke old keys (after successful deployment)
    setTimeout(() => {
      this.revokeOldKeys();
    }, 300000); // 5 minutes delay
    
    console.log('✅ API key rotation completed');
  }
  
  private static async validateAPIKeys(): Promise<void> {
    // Test OpenAI
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'test' }],
      max_tokens: 1
    });
    
    // Test Stripe
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    await stripe.balance.retrieve();
    
    console.log('✅ New API keys validated');
  }
}
```

---

## Troubleshooting Runbook

### 1. Common Issues

**Application Won't Start:**
```bash
# Check process status
systemctl status jobr-app

# Check logs
journalctl -u jobr-app -n 50

# Check configuration
npm run config:validate

# Check database connectivity
npm run db:check

# Common fixes:
# 1. Missing environment variables
# 2. Database connection issues
# 3. Port already in use
# 4. Permission issues
```

**High Memory Usage:**
```bash
# Check memory usage by process
ps aux --sort=-%mem | head

# Check for memory leaks
node --inspect=0.0.0.0:9229 server.js

# Generate heap dump
kill -USR2 <node_pid>

# Analyze heap dump with tools like Chrome DevTools
```

**Database Connection Issues:**
```bash
# Test database connectivity
psql $DATABASE_URL -c "SELECT 1;"

# Check connection pool
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"

# Check for long-running queries
psql $DATABASE_URL -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE state = 'active' AND now() - pg_stat_activity.query_start > interval '5 minutes';
"

# Kill long-running queries if needed
psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE ..."
```

### 2. Performance Issues

**Slow API Response Times:**
```bash
# 1. Check application logs
tail -f /var/log/jobr/app.log | grep "slow"

# 2. Monitor system resources
top
iotop
nethogs

# 3. Check database performance
psql $DATABASE_URL -c "
  SELECT query, calls, total_time, mean_time 
  FROM pg_stat_statements 
  ORDER BY mean_time DESC 
  LIMIT 10;
"

# 4. Profile application
npm run profile

# 5. Common solutions:
# - Add database indexes
# - Optimize queries
# - Increase cache TTL
# - Scale horizontally
```

**High CPU Usage:**
```bash
# Find CPU-intensive processes
ps aux --sort=-%cpu | head -20

# Profile Node.js application
node --prof server.js

# Generate profiling report
node --prof-process isolate-*.log > processed.txt

# Check for infinite loops or heavy computations
strace -p <pid>
```

### 3. Emergency Procedures

**Service Outage Response:**
```bash
#!/bin/bash
# scripts/emergency-response.sh

echo "🚨 Emergency Response Activated"

# 1. Assess the situation
./scripts/health-check-all.sh

# 2. Check external dependencies
./scripts/check-integrations.sh

# 3. Review recent changes
git log --oneline -10

# 4. Check system resources
df -h
free -h
top -n 1

# 5. Activate maintenance mode if needed
./scripts/maintenance-mode.sh enable

# 6. Notify stakeholders
./scripts/notify-incident.sh "Service outage detected - investigating"

# 7. Start incident log
echo "$(date): Incident detected - starting investigation" >> /var/log/incidents.log
```

**Data Corruption Recovery:**
```bash
#!/bin/bash
# scripts/data-recovery.sh

echo "🔄 Data recovery procedure initiated"

# 1. Stop application immediately
systemctl stop jobr-app

# 2. Assess data integrity
npm run db:check-integrity

# 3. Restore from latest good backup
LATEST_BACKUP=$(ls -t /var/backups/postgresql/*.sql.gz | head -1)
./scripts/restore-db.sh $LATEST_BACKUP

# 4. Verify data integrity
npm run db:verify

# 5. Start application
systemctl start jobr-app

# 6. Verify application functionality
npm run smoke-test

echo "✅ Data recovery completed"
```

---

*Last Updated: December 19, 2024*  
*Operations Version: 1.0*  
*Document Version: 1.0*