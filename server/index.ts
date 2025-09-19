import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { randomUUID } from "crypto";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { StripeWebhookService } from "./stripe";
import { PhonePeService } from "./phonepe";

const app = express();

// Production environment detection
const isProduction = process.env.NODE_ENV === 'production';

// PRODUCTION: Environment variable validation for production deployment
// Core required variables that must be provided
const coreRequiredVars = [
  'DATABASE_URL',
  'OPENAI_API_KEY'
];

// Optional variables with fallback values for deployment flexibility
const optionalVars = [
  'SENDGRID_API_KEY', 
  'STRIPE_SECRET_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'JWT_SECRET',
  'SESSION_SECRET',
  'APP_BASE_URL'
];

if (isProduction) {
  // Check core required variables
  const missingCoreVars = coreRequiredVars.filter(varName => !process.env[varName]);
  if (missingCoreVars.length > 0) {
    console.error('PRODUCTION DEPLOYMENT BLOCKED: Missing core required environment variables:', missingCoreVars);
    console.error('Please configure the following core environment variables for production deployment:');
    missingCoreVars.forEach(varName => {
      console.error(`- ${varName}`);
    });
    process.exit(1);
  }
  
  // Set fallback values for optional variables
  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = require('crypto').randomBytes(32).toString('hex');
    console.log('⚠️  Using generated JWT_SECRET for this session');
  }
  
  if (!process.env.SESSION_SECRET) {
    process.env.SESSION_SECRET = require('crypto').randomBytes(32).toString('hex');
    console.log('⚠️  Using generated SESSION_SECRET for this session');
  }
  
  if (!process.env.APP_BASE_URL) {
    process.env.APP_BASE_URL = `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co` || 'https://localhost:5000';
    console.log('⚠️  Using default APP_BASE_URL:', process.env.APP_BASE_URL);
  }
  
  // Check optional variables and warn about missing ones
  const missingOptionalVars = optionalVars.filter(varName => !process.env[varName]);
  if (missingOptionalVars.length > 0) {
    console.log('⚠️  Optional services disabled due to missing environment variables:', missingOptionalVars);
    missingOptionalVars.forEach(varName => {
      console.log(`   - ${varName} (related functionality will be disabled)`);
    });
  }
  
  console.log('✅ Production environment validated - core services available, optional services configured');
}

// SECURITY: Configure helmet middleware for production security headers
// Production CSP policy removes unsafe-inline and unsafe-eval for security
const cspConfig = isProduction ? {
  // PRODUCTION CSP - Hardened security policy
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: [
      "'self'",
      "https://js.stripe.com",
      "https://checkout.stripe.com"
      // NOTE: unsafe-inline and unsafe-eval removed for production security
    ],
    styleSrc: ["'self'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: [
      "'self'",
      "https://api.openai.com",
      "https://api.sendgrid.com", 
      "https://api.stripe.com",
      "https://jobr.co.in",
      "wss://jobr.co.in" // WebSocket support for production domain
    ],
    frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
} : {
  // DEVELOPMENT CSP - More permissive for development
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://js.stripe.com"],
    styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
    fontSrc: ["'self'", "https://fonts.gstatic.com"],
    imgSrc: ["'self'", "data:", "https:"],
    connectSrc: ["'self'", "https://api.openai.com", "https://api.stripe.com", "https://api.sendgrid.com"],
    frameSrc: ["'self'", "https://js.stripe.com"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
};

app.use(helmet({
  contentSecurityPolicy: cspConfig,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  frameguard: { action: 'deny' },
  crossOriginEmbedderPolicy: false // Allow Stripe frames
}));

// SECURITY: Add request ID correlation for structured logging
app.use((req: any, res, next) => {
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});

// CRITICAL: Register Stripe webhook BEFORE body parsers
// Stripe webhooks need raw body data for signature verification
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  StripeWebhookService.handleWebhook(req, res);
});

// PhonePe webhook endpoint
app.post('/api/phonepe/webhook', express.json(), (req, res) => {
  PhonePeService.handleWebhook(req, res);
});

// Body parsers come AFTER webhook registration
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// SECURITY: Enhanced logging middleware with PII protection
app.use((req: any, res, next) => {
  const start = Date.now();
  const path = req.path;
  const requestId = req.requestId;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      // Base log line with request correlation
      let logLine = `[${requestId}] ${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // SECURITY: Only log response bodies in development to prevent PII exposure
      if (!isProduction && capturedJsonResponse) {
        // In development, still avoid logging sensitive endpoints
        const sensitiveEndpoints = ['/api/auth/login', '/api/auth/register', '/api/auth/phone/verify'];
        const isSensitiveEndpoint = sensitiveEndpoints.some(endpoint => path.includes(endpoint));
        
        if (!isSensitiveEndpoint) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } else {
          logLine += ` :: [SENSITIVE_DATA_HIDDEN]`;
        }
      } else if (isProduction) {
        // In production, only log error status codes without response body
        if (res.statusCode >= 400) {
          logLine += ` :: ERROR`;
        }
      }

      if (logLine.length > 120) {
        logLine = logLine.slice(0, 119) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  // Enhanced error handler with structured logging
  app.use((err: any, req: any, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    const requestId = req.requestId;

    // Log structured error information
    console.error(`[${requestId}] ERROR ${status}:`, {
      message: err.message,
      stack: isProduction ? undefined : err.stack,
      path: req.path,
      method: req.method,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    res.status(status).json({ 
      message: isProduction ? "Internal Server Error" : message,
      requestId
    });
    
    // Don't re-throw in production to prevent crashes
    if (!isProduction) {
      throw err;
    }
  });

  // Global error handlers for unhandled exceptions
  process.on('uncaughtException', (error) => {
    console.error('UNCAUGHT_EXCEPTION:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    // Don't exit in production - log and continue
    if (!isProduction) {
      process.exit(1);
    }
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED_REJECTION:', {
      reason: reason,
      promise: promise,
      timestamp: new Date().toISOString()
    });
    // Don't exit in production - log and continue
    if (!isProduction) {
      process.exit(1);
    }
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
