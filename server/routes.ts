import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import crypto from "crypto";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { FileProcessor } from "./fileProcessor";
import { OpenAIService } from "./openaiService";
import OpenAI from "openai";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
import { JobMatchingService } from "./jobMatchingService";
import { ApplicationPreparationService } from "./applicationPreparationService";
import { AuthService } from "./authService";
import { JwtUtils } from "./jwtUtils";
import { EmailMonitoringService } from "./emailMonitoringService";
import { ApplicationLifecycleService } from "./applicationLifecycleService";
import { NotificationService } from "./notificationService";
import { AnalyticsService } from "./analyticsService";
import { PhonePeService, PHONEPE_PRICE_MAPPINGS } from "./phonepe";
import { registerSchema, loginSchema, insertJobSchema, insertApplicationSchema, phoneRequestSchema, phoneVerifySchema, jobApplySchema, cvTailorSchema, applicationUpdateSchema, batchPrepareSchema, bookmarkJobSchema, jobSearchSchema, saveSearchSchema, updatePreferencesSchema } from "@shared/schema";
import { checkDatabaseHealth } from "./db";
import { createErrorResponse, ERROR_CODES } from "./utils/errorHandler";
import { addAuthMetricsRoute } from "./authMetricsRoute";

// Configure rate limiting for authentication routes (disabled in test mode)
const loginRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true' ? 10000 : 20, // High limit in test mode
  message: {
    message: "Too many login attempts. Please try again in 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true', // Skip rate limiting in test mode
});

const registerRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true' ? 10000 : 10, // High limit in test mode
  message: {
    message: "Too many registration attempts. Please try again in 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true', // Skip rate limiting in test mode
});

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true' ? 10000 : 10, // High limit in test mode
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true', // Skip rate limiting in test mode
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true' ? 10000 : 100, // High limit in test mode
  message: {
    message: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true', // Skip rate limiting in test mode
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, and DOCX files are allowed.'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Initialize Passport
  app.use(passport.initialize());
  
  // Configure Google OAuth Strategy and track initialization success
  let googleStrategyInitialized = false;
  
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    try {
      passport.use(new GoogleStrategy({
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: `${process.env.APP_BASE_URL || process.env.REPLIT_DOMAINS?.split(',')[0] || 'http://localhost:5000'}/api/auth/google/callback`
      }, async (accessToken, refreshToken, profile, done) => {
        try {
          const result = await AuthService.handleGoogleAuth(profile, accessToken);
          if (result.success && result.user && result.token) {
            return done(null, { user: result.user, token: result.token });
          } else {
            return done(new Error(result.error || 'Google authentication failed'));
          }
        } catch (error) {
          return done(error);
        }
      }));
      googleStrategyInitialized = true;
      console.log('Google OAuth enabled: true');
    } catch (error) {
      console.error('Failed to initialize Google OAuth strategy:', error);
      console.log('Google OAuth enabled: false');
    }
  } else {
    console.log('Google OAuth enabled: false - Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
  }
  
  // Verify strategy is actually registered with passport
  const googleEnabled = googleStrategyInitialized && ((passport as any)._strategies?.google != null);

  // Auth middleware
  await setupAuth(app);

  // Test hook endpoint - only available in test mode
  app.get('/api/test/mock-status', (req, res) => {
    if (process.env.NODE_ENV !== 'test' && process.env.TEST_USE_MOCKS !== 'true') {
      return res.status(404).json({ message: 'Not found' });
    }

    try {
      const mockStatus = {
        testMode: true,
        services: {
          openai: {
            available: true,
            usingMock: OpenAIService.isTestMode(),
            realService: !!process.env.OPENAI_API_KEY
          },
          sendgrid: {
            available: true,
            usingMock: process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true',
            realService: !!process.env.SENDGRID_API_KEY
          },
          phonepe: {
            available: true,
            usingMock: process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true',
            realService: !!(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY)
          }
        },
        rateLimiting: {
          disabled: true,
          environment: process.env.NODE_ENV
        },
        timestamp: new Date().toISOString()
      };

      res.json(mockStatus);
    } catch (error) {
      res.status(500).json({ error: 'Failed to get mock status', message: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Health check endpoint - simple liveness check
  app.get('/api/health', (req, res) => {
    try {
      const health = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        node_version: process.version,
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          limit: Math.round(process.memoryUsage().rss / 1024 / 1024)
        }
      };
      
      res.json(health);
    } catch (error) {
      console.error("Health check error:", error);
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed'
      });
    }
  });

  // Integration status endpoint - exempt from rate limiting for health checks
  app.get('/api/integrations/status', (req, res) => {
    try {
      const integrations = {
        openai: {
          available: !!process.env.OPENAI_API_KEY,
          features: ['cv_parsing', 'job_matching', 'ai_assistance'],
          fallback: process.env.OPENAI_API_KEY ? null : 'basic_parsing'
        },
        google_oauth: {
          available: googleEnabled,
          features: ['social_login'],
          fallback: 'email_password_login'
        },
        phonepe: {
          available: !!(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY),
          features: ['indian_payments', 'subscription_management'],
          fallback: process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY ? null : 'test_mode',
          test_mode: !(process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY)
        },
        sendgrid: {
          available: !!process.env.SENDGRID_API_KEY,
          features: ['email_notifications', 'password_reset', 'email_verification'],
          fallback: 'console_logging'
        }
      };

      const summary = {
        total_integrations: Object.keys(integrations).length,
        available: Object.values(integrations).filter(i => i.available).length,
        missing: Object.values(integrations).filter(i => !i.available).length,
        core_functional: integrations.openai.available, // Core AI functionality status
        payments_functional: integrations.phonepe.available
      };

      res.json({
        success: true,
        summary,
        integrations,
        recommendations: [
          !integrations.openai.available && "Configure OPENAI_API_KEY for full AI functionality",
          !integrations.google_oauth.available && "Configure Google OAuth for social login",
          !integrations.phonepe.available && "Configure PhonePe for payment processing",
          !integrations.sendgrid.available && "Configure SendGrid for email services"
        ].filter(Boolean)
      });
    } catch (error) {
      console.error("Integration status error:", error);
      res.status(500).json({
        message: "Failed to fetch integration status",
        code: "INTEGRATION_STATUS_ERROR"
      });
    }
  });

  // Apply general rate limiting to all routes (after exempt routes)
  app.use(generalRateLimit);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // New JWT-based authentication routes
  app.post('/api/auth/register', registerRateLimit, async (req: any, res) => {
    try {
      // Validate input
      const validationResult = registerSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      // Register user
      const result = await AuthService.register(validationResult.data);
      
      if (result.success && result.user && result.token) {
        // Set JWT cookie
        JwtUtils.setTokenCookie(res, result.token);
        
        res.status(201).json({
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            plan: result.user.plan,
            creditsRemaining: result.user.creditsRemaining
          },
          emailVerificationRequired: result.emailVerificationRequired,
          message: "Registration successful"
        });
      } else {
        res.status(400).json({
          message: result.error || "Registration failed",
          code: result.code || "REGISTRATION_FAILED"
        });
      }
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({
        message: "Internal server error during registration",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.post('/api/auth/login', loginRateLimit, async (req: any, res) => {
    try {
      // Validate input
      const validationResult = loginSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      // Login user
      const result = await AuthService.login(validationResult.data);
      
      if (result.success && result.user && result.token) {
        // Set JWT cookie
        JwtUtils.setTokenCookie(res, result.token);
        
        res.json({
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            plan: result.user.plan,
            creditsRemaining: result.user.creditsRemaining
          },
          message: "Login successful"
        });
      } else {
        res.status(401).json({
          message: result.error || "Login failed",
          code: result.code || "LOGIN_FAILED"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({
        message: "Internal server error during login",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.get('/api/auth/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      // If user doesn't exist, create them automatically (for Replit auth users)
      if (!user && req.user.authMethod === 'replit') {
        const claims = req.user.claims;
        user = await storage.upsertUser({
          id: userId,
          email: claims.email,
          firstName: claims.first_name || '',
          lastName: claims.last_name || '',
          profileImageUrl: claims.profile_image_url || null,
          plan: 'Free',
          cvDownloadsThisMonth: 0,
          cvDownloadsRemaining: 2,
          monthlyDownloadsReset: new Date(),
          subscriptionStatus: 'active'
        });
      }
      
      if (!user) {
        return res.status(404).json({
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }

      // Return just the user object to match useAuth contract expectations
      res.json(user);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({
        message: "Failed to fetch user profile",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.post('/api/auth/logout', async (req: any, res) => {
    try {
      // Clear JWT cookie
      JwtUtils.clearTokenCookie(res);
      
      res.json({
        success: true,
        message: "Logged out successfully"
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({
        message: "Logout failed",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Integration status endpoint moved above to exempt from rate limiting
  
  // Register auth metrics routes (admin-protected)
  addAuthMetricsRoute(app);

  // Google OAuth routes - only register if strategy is properly initialized
  if (googleEnabled) {
    app.get('/api/auth/google', 
      authRateLimit,
      passport.authenticate('google', { 
        scope: ['profile', 'email'],
        session: false 
      })
    );

    app.get('/api/auth/google/callback',
      authRateLimit,
      passport.authenticate('google', { session: false }),
      async (req: any, res) => {
        try {
          const authData = req.user;
          if (!authData || !authData.user || !authData.token) {
            return res.redirect('/auth/error?message=Google authentication failed');
          }

          // Set JWT cookie
          JwtUtils.setTokenCookie(res, authData.token);

          // Redirect to dashboard on success
          res.redirect('/dashboard?auth=google');
        } catch (error) {
          console.error("Google auth callback error:", error);
          res.redirect('/auth/error?message=Authentication failed');
        }
      }
    );
  } else {
    // Provide 503 error responses when Google OAuth strategy is not available
    app.get('/api/auth/google', authRateLimit, (req, res) => {
      res.status(503).json({
        message: "Google OAuth service is currently unavailable. Please use email/password login or try again later.",
        code: "GOOGLE_OAUTH_UNAVAILABLE",
        integration: "google_oauth",
        available: false
      });
    });

    app.get('/api/auth/google/callback', authRateLimit, (req, res) => {
      res.status(503).json({
        message: "Google OAuth service is currently unavailable. Please use email/password login or try again later.",
        code: "GOOGLE_OAUTH_UNAVAILABLE",
        integration: "google_oauth",
        available: false
      });
    });
  }

  // Phone OTP routes
  app.post('/api/auth/phone/request', authRateLimit, async (req: any, res) => {
    try {
      // Priority 3: Phone Auth Validation - Use Zod schema
      const validationResult = phoneRequestSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const { phoneNumber } = validationResult.data;

      const result = await AuthService.requestPhoneOTP(phoneNumber);
      
      if (result.success) {
        res.json({
          success: true,
          message: result.message,
          // Only include OTP code in development for testing
          ...(process.env.NODE_ENV === 'development' && result.code && { otpCode: result.code })
        });
      } else {
        res.status(400).json({
          message: result.message,
          code: result.code || "OTP_REQUEST_FAILED"
        });
      }
    } catch (error) {
      console.error("Phone OTP request error:", error);
      res.status(500).json({
        message: "Failed to send OTP",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.post('/api/auth/phone/verify', authRateLimit, async (req: any, res) => {
    try {
      // Priority 3: Phone Auth Validation - Use Zod schema
      const validationResult = phoneVerifySchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const { phoneNumber, otpCode, firstName, lastName } = validationResult.data;

      const result = await AuthService.verifyPhoneOTP(phoneNumber, otpCode, firstName, lastName);
      
      if (result.success && result.user && result.token) {
        // Set JWT cookie
        JwtUtils.setTokenCookie(res, result.token);
        
        res.json({
          success: true,
          user: {
            id: result.user.id,
            email: result.user.email,
            firstName: result.user.firstName,
            lastName: result.user.lastName,
            plan: result.user.plan,
            creditsRemaining: result.user.creditsRemaining
          },
          message: "Phone authentication successful"
        });
      } else {
        res.status(401).json({
          message: result.error || "Phone verification failed",
          code: result.code || "VERIFY_FAILED"
        });
      }
    } catch (error) {
      console.error("Phone OTP verification error:", error);
      res.status(500).json({
        message: "Failed to verify OTP",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Multer error handling middleware for consistent JSON responses
  const handleMulterError = (error: any, req: any, res: any, next: any) => {
    if (error instanceof multer.MulterError) {
      switch (error.code) {
        case 'LIMIT_FILE_SIZE':
          return res.status(400).json({ 
            message: 'File size exceeds 5MB limit',
            error: 'FILE_TOO_LARGE'
          });
        case 'LIMIT_UNEXPECTED_FILE':
          return res.status(400).json({ 
            message: 'Unexpected file field',
            error: 'INVALID_FIELD'
          });
        default:
          return res.status(400).json({ 
            message: error.message || 'File upload error',
            error: 'UPLOAD_ERROR'
          });
      }
    }
    
    // Handle custom file filter errors
    if (error && error.message && error.message.includes('Invalid file type')) {
      return res.status(400).json({ 
        message: 'Invalid file type. Only PDF, DOC, and DOCX files are allowed.',
        error: 'INVALID_FILE_TYPE'
      });
    }
    
    next(error);
  };

  // CV routes
  app.post('/api/cv/upload', isAuthenticated, upload.single('cv'), handleMulterError, async (req: any, res: any) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json(createErrorResponse(
          'No file uploaded',
          ERROR_CODES.VALIDATION_ERROR
        ));
      }

      // Extract text from the uploaded file
      const processedFile = await FileProcessor.extractText(file);

      // Parse CV content with OpenAI or fallback
      let parsedData;
      let processingMethod = 'fallback';
      
      if (OpenAIService.isAvailable()) {
        try {
          parsedData = await OpenAIService.parseCVContent(processedFile.text);
          processingMethod = 'openai';
        } catch (aiError) {
          console.warn('OpenAI parsing failed, using fallback:', aiError);
          parsedData = OpenAIService.parseCVContentFallback(processedFile.text);
        }
      } else {
        console.log('OpenAI not available, using fallback parsing');
        parsedData = OpenAIService.parseCVContentFallback(processedFile.text);
      }

      // Create CV record in database
      const cv = await storage.createCv({
        userId,
        fileName: processedFile.fileName,
        originalContent: processedFile.text,
        parsedData: {
          ...parsedData,
          processingMethod,
          fileSize: processedFile.fileSize,
          fileType: processedFile.fileType,
          processedAt: new Date().toISOString()
        },
        skills: parsedData.skills,
        experience: parsedData.experience,
        education: parsedData.education,
      });

      // Return success response with parsed data
      res.json({
        success: true,
        cv,
        parsedData,
        processingMethod,
        message: processingMethod === 'openai' 
          ? 'CV processed successfully with AI analysis' 
          : 'CV processed with basic parsing (OpenAI unavailable)'
      });
    } catch (error) {
      console.error("Error uploading CV:", error);
      
      // Handle specific error types
      if (error instanceof Error) {
        if (error.message.includes('file type')) {
          return res.status(400).json(createErrorResponse(
            error.message,
            ERROR_CODES.INVALID_FILE_TYPE
          ));
        }
        if (error.message.includes('file size')) {
          return res.status(400).json(createErrorResponse(
            error.message,
            ERROR_CODES.FILE_TOO_LARGE
          ));
        }
        if (error.message.includes('OpenAI API')) {
          return res.status(503).json(createErrorResponse( 
            'AI processing temporarily unavailable. Please try again later.',
            ERROR_CODES.INTERNAL_ERROR,
            { service: 'openai', originalError: error.message }
          ));
        }
      }
      
      res.status(500).json(createErrorResponse(
        "Failed to upload and process CV",
        ERROR_CODES.INTERNAL_ERROR,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  });

  app.get('/api/cv', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cv = await storage.getCvByUserId(userId);
      res.json(cv);
    } catch (error) {
      console.error("Error fetching CV:", error);
      res.status(500).json({ message: "Failed to fetch CV" });
    }
  });

  // AI CV Analysis endpoint - provides detailed analysis and recommendations
  app.post('/api/cv/analyze', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cv = await storage.getCvByUserId(userId);
      
      if (!cv || !cv.parsedData) {
        return res.status(400).json(createErrorResponse(
          "Please upload your CV before requesting analysis",
          ERROR_CODES.CV_REQUIRED
        ));
      }

      // Perform AI analysis if available
      let analysis;
      let recommendations = [];
      let processingMethod = 'basic';

      if (OpenAIService.isAvailable()) {
        try {
          // Generate comprehensive CV analysis using AI
          const analysisPrompt = `
            Analyze this CV data and provide detailed feedback and recommendations:
            
            Skills: ${cv.parsedData.skills?.join(', ') || 'Not specified'}
            Experience: ${cv.parsedData.experience || 'Not specified'}
            Education: ${cv.parsedData.education || 'Not specified'}
            
            Provide analysis in JSON format with:
            - skillsAnalysis: categorize skills and rate proficiency levels
            - experienceAnalysis: evaluate experience relevance and level
            - strengthsAndWeaknesses: identify key strengths and areas for improvement
            - recommendations: specific suggestions for CV improvement
            - completenessScore: overall CV completeness (0-100)
            - industryFit: likely industry matches based on profile
          `;

          // Use OpenAI for analysis instead of parsing
          const response = await openai!.chat.completions.create({
            model: "gpt-5",
            messages: [
              { role: "system", content: "You are an expert CV analyst. Provide detailed analysis in JSON format." },
              { role: "user", content: analysisPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 800
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            analysis = JSON.parse(content);
            processingMethod = 'ai';
          }

          // Generate specific recommendations
          recommendations = [
            'Consider adding quantified achievements to strengthen your experience section',
            'Add relevant technical skills based on your target roles',
            'Include certifications or training to validate your expertise',
            'Optimize keywords for better job matching'
          ];

        } catch (aiError) {
          console.warn('AI analysis failed, providing basic analysis:', aiError);
          processingMethod = 'basic_fallback';
        }
      }

      // Basic analysis fallback
      if (!analysis) {
        const skillCount = cv.parsedData.skills?.length || 0;
        const hasExperience = cv.parsedData.experience && cv.parsedData.experience.length > 50;
        const hasEducation = cv.parsedData.education && cv.parsedData.education.length > 20;
        
        analysis = {
          skillsAnalysis: {
            totalSkills: skillCount,
            categories: skillCount > 0 ? ['Technical', 'Professional'] : [],
            recommendations: skillCount < 5 ? ['Add more relevant skills'] : ['Skills section looks good']
          },
          experienceAnalysis: {
            hasRelevantExperience: hasExperience,
            level: hasExperience ? 'Professional' : 'Entry-level',
            recommendations: hasExperience ? [] : ['Add more detailed work experience']
          },
          completenessScore: Math.min(100, (skillCount * 10) + (hasExperience ? 40 : 0) + (hasEducation ? 30 : 0)),
          strengthsAndWeaknesses: {
            strengths: [],
            weaknesses: []
          }
        };

        recommendations = [
          skillCount < 5 && 'Consider adding more relevant skills to improve job matching',
          !hasExperience && 'Add detailed work experience with achievements',
          !hasEducation && 'Include educational background',
          'Review CV formatting and ensure all sections are complete'
        ].filter(Boolean);
      }

      res.json({
        success: true,
        analysis,
        recommendations,
        processingMethod,
        cvData: {
          skills: cv.parsedData.skills || [],
          experience: cv.parsedData.experience || 'Not specified',
          education: cv.parsedData.education || 'Not specified',
          name: cv.parsedData.name || null,
          email: cv.parsedData.email || null,
          location: cv.parsedData.location || null
        },
        metrics: {
          skillsCount: cv.parsedData.skills?.length || 0,
          completeness: analysis.completenessScore || 0
        }
      });

    } catch (error) {
      console.error("Error analyzing CV:", error);
      res.status(500).json(createErrorResponse(
        "Failed to analyze CV",
        ERROR_CODES.INTERNAL_ERROR,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  });

  // AI Personalization endpoint - provides personalized recommendations
  app.post('/api/ai/personalize', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cv = await storage.getCvByUserId(userId);
      const { preferences, targetRole, targetIndustry } = req.body;
      
      if (!cv || !cv.parsedData) {
        return res.status(400).json(createErrorResponse(
          "Please upload your CV before requesting personalized recommendations",
          ERROR_CODES.CV_REQUIRED
        ));
      }

      let personalizedRecommendations;
      let processingMethod = 'basic';

      if (OpenAIService.isAvailable() && targetRole) {
        try {
          // Generate personalized recommendations based on target role
          const personalizationPrompt = `
            Based on this CV profile, provide personalized recommendations for targeting: ${targetRole}
            ${targetIndustry ? `in the ${targetIndustry} industry` : ''}
            
            Current Profile:
            - Skills: ${cv.parsedData.skills?.join(', ') || 'Not specified'}
            - Experience: ${cv.parsedData.experience || 'Not specified'}
            - Education: ${cv.parsedData.education || 'Not specified'}
            
            User Preferences: ${JSON.stringify(preferences || {})}
            
            Provide specific, actionable recommendations in JSON format:
            - skillGaps: skills to develop for the target role
            - experienceGaps: experience areas to focus on
            - learningPath: suggested courses or certifications
            - networkingTips: industry-specific networking advice
            - jobSearchStrategy: tailored job search recommendations
          `;

          // Use OpenAI for personalization
          const response = await openai!.chat.completions.create({
            model: "gpt-5", 
            messages: [
              { role: "system", content: "You are a career advisor. Provide personalized recommendations in JSON format." },
              { role: "user", content: personalizationPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3,
            max_tokens: 800
          });

          const content = response.choices[0]?.message?.content;
          if (content) {
            personalizedRecommendations = JSON.parse(content);
            processingMethod = 'ai';
          }

        } catch (aiError) {
          console.warn('AI personalization failed, providing basic recommendations:', aiError);
        }
      }

      // Basic personalization fallback
      if (!personalizedRecommendations) {
        personalizedRecommendations = {
          skillGaps: ['Industry-specific technical skills', 'Leadership and communication skills'],
          experienceGaps: ['Project management experience', 'Team collaboration'],
          learningPath: ['Consider online courses in your field', 'Professional certifications'],
          networkingTips: ['Join professional associations', 'Attend industry events'],
          jobSearchStrategy: ['Tailor CV for each application', 'Use industry keywords']
        };
      }

      res.json({
        success: true,
        personalizedRecommendations,
        targetRole: targetRole || 'General',
        targetIndustry: targetIndustry || 'General',
        processingMethod,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error("Error generating personalized recommendations:", error);
      res.status(500).json(createErrorResponse(
        "Failed to generate personalized recommendations",
        ERROR_CODES.INTERNAL_ERROR,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  });

  // Job routes
  app.get('/api/jobs', isAuthenticated, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const jobs = await storage.getJobs(limit);
      res.json(jobs);
    } catch (error) {
      console.error("Error fetching jobs:", error);
      res.status(500).json({ message: "Failed to fetch jobs" });
    }
  });

  app.post('/api/jobs', isAuthenticated, async (req: any, res) => {
    try {
      // Validate input data
      const validationResult = insertJobSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid job data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const job = await storage.createJob(validationResult.data);
      res.status(201).json(job);
    } catch (error) {
      console.error("Error creating job:", error);
      
      // Handle database constraint violations
      if (error instanceof Error && (
        error.message.includes('duplicate') || 
        error.message.includes('unique') ||
        error.message.includes('constraint')
      )) {
        return res.status(409).json({ 
          message: "Job already exists or violates constraints",
          code: "CONSTRAINT_VIOLATION"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create job",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.get('/api/jobs/:id', isAuthenticated, async (req: any, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json(createErrorResponse(
          "Job not found",
          ERROR_CODES.JOB_NOT_FOUND
        ));
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json(createErrorResponse(
        "Failed to fetch job",
        ERROR_CODES.INTERNAL_ERROR
      ));
    }
  });

  // Job matching routes
  app.get('/api/jobs/matched', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cv = await storage.getCvByUserId(userId);
      
      if (!cv || !cv.parsedData) {
        return res.status(400).json({ 
          message: "Please upload and process your CV before viewing matched jobs",
          code: "CV_REQUIRED"
        });
      }

      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const allJobs = await storage.getJobs(100); // Get more jobs for matching
      
      // Get user preferences from query parameters
      const preferences = {
        preferredLocation: req.query.location as string,
        salaryExpectation: req.query.salary as string,
        preferredJobTypes: req.query.types ? (req.query.types as string).split(',') : undefined
      };

      const matchedJobs = await JobMatchingService.getTopMatches(cv, allJobs, limit, preferences);
      
      res.json({
        matches: matchedJobs,
        total: matchedJobs.length,
        processingMethod: JobMatchingService.isAvailable() ? 'ai' : 'basic'
      });
    } catch (error) {
      console.error("Error fetching matched jobs:", error);
      res.status(500).json({ 
        message: "Failed to fetch matched jobs",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  app.get('/api/jobs/search', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cv = await storage.getCvByUserId(userId);
      
      if (!cv || !cv.parsedData) {
        return res.status(400).json({ 
          message: "Please upload and process your CV before searching jobs",
          code: "CV_REQUIRED"
        });
      }

      const allJobs = await storage.getJobs(200); // Get more jobs for searching
      
      // Parse search filters from query parameters
      const filters = {
        query: req.query.q as string,
        location: req.query.location as string,
        type: req.query.type as string,
        minSalary: req.query.minSalary ? parseInt(req.query.minSalary as string) : undefined,
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined
      };

      const preferences = {
        preferredLocation: req.query.preferredLocation as string,
        salaryExpectation: req.query.salaryExpectation as string,
        preferredJobTypes: req.query.preferredTypes ? (req.query.preferredTypes as string).split(',') : undefined
      };

      const searchResults = await JobMatchingService.searchJobs(cv, allJobs, filters, preferences);
      
      res.json({
        results: searchResults,
        total: searchResults.length,
        filters,
        processingMethod: JobMatchingService.isAvailable() ? 'ai' : 'basic'
      });
    } catch (error) {
      console.error("Error searching jobs:", error);
      res.status(500).json({ 
        message: "Failed to search jobs",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Job bookmark routes
  app.post('/api/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate input data
      const validationResult = bookmarkJobSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid bookmark data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const { jobId, notes } = validationResult.data;

      // Check if job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ 
          message: "Job not found",
          code: "JOB_NOT_FOUND"
        });
      }

      // Check if already bookmarked
      const isAlreadyBookmarked = await storage.isJobBookmarked(userId, jobId);
      if (isAlreadyBookmarked) {
        return res.status(409).json({
          message: "Job is already bookmarked",
          code: "ALREADY_BOOKMARKED"
        });
      }

      const bookmark = await storage.createJobBookmark({
        userId,
        jobId,
        notes: notes || null
      });

      res.status(201).json({
        success: true,
        bookmark,
        message: `${job.title} has been bookmarked`
      });
    } catch (error) {
      console.error("Error creating bookmark:", error);
      res.status(500).json({
        message: "Failed to bookmark job",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.get('/api/bookmarks', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookmarks = await storage.getJobBookmarksByUserId(userId);
      
      res.json({
        success: true,
        bookmarks,
        total: bookmarks.length
      });
    } catch (error) {
      console.error("Error fetching bookmarks:", error);
      res.status(500).json({
        message: "Failed to fetch bookmarks",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.get('/api/bookmarks/check', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId } = req.query;

      if (!jobId || typeof jobId !== 'string') {
        return res.status(400).json({
          message: "jobId is required as query parameter",
          code: "VALIDATION_ERROR"
        });
      }

      const isBookmarked = await storage.isJobBookmarked(userId, jobId);
      
      res.json({
        success: true,
        isBookmarked
      });
    } catch (error) {
      console.error("Error checking bookmark status:", error);
      res.status(500).json({
        message: "Failed to check bookmark status",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.delete('/api/bookmarks/:jobId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId } = req.params;

      // Check if bookmark exists
      const isBookmarked = await storage.isJobBookmarked(userId, jobId);
      if (!isBookmarked) {
        return res.status(404).json({
          message: "Bookmark not found",
          code: "BOOKMARK_NOT_FOUND"
        });
      }

      await storage.deleteJobBookmark(userId, jobId);
      
      res.json({
        success: true,
        message: "Bookmark removed successfully"
      });
    } catch (error) {
      console.error("Error removing bookmark:", error);
      res.status(500).json({
        message: "Failed to remove bookmark",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Enhanced search suggestions API
  app.get('/api/search/suggestions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const query = (req.query.q as string) || '';
      
      // Get user's CV for personalized suggestions
      const cv = await storage.getCvByUserId(userId);
      
      const suggestions = await JobMatchingService.generateSearchSuggestions(userId, query, cv || undefined);
      
      res.json({
        success: true,
        suggestions,
        query
      });
    } catch (error) {
      console.error("Error generating search suggestions:", error);
      res.status(500).json({
        message: "Failed to generate search suggestions",
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Job market insights and career recommendations API
  app.get('/api/jobs/insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get user's CV
      const cv = await storage.getCvByUserId(userId);
      if (!cv || !cv.parsedData) {
        return res.status(400).json({
          message: "Please upload and process your CV before viewing job insights",
          code: "CV_REQUIRED"
        });
      }
      
      // Get recent jobs for market analysis
      const jobs = await storage.getJobs(100);
      
      // Generate comprehensive job insights
      const insights = await JobMatchingService.generateJobInsights(userId, cv, jobs);
      
      if (!insights) {
        return res.status(500).json({
          message: "Failed to generate job insights",
          code: "INSIGHTS_GENERATION_FAILED"
        });
      }
      
      res.json({
        success: true,
        insights,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error generating job insights:", error);
      res.status(500).json({
        message: "Failed to generate job insights", 
        details: error instanceof Error ? error.message : 'Unknown error',
        code: "INTERNAL_ERROR"
      });
    }
  });

  // Enhanced job search with semantic capabilities
  app.get('/api/jobs/search/enhanced', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const cv = await storage.getCvByUserId(userId);
      
      if (!cv || !cv.parsedData) {
        return res.status(400).json({ 
          message: "Please upload and process your CV before searching for jobs",
          code: "CV_REQUIRED"
        });
      }

      // Get all jobs for enhanced search
      const allJobs = await storage.getJobs();
      
      // Enhanced filters with semantic search support
      const filters = {
        query: req.query.q as string,
        location: req.query.location as string,
        type: req.query.type as string,
        minSalary: req.query.minSalary ? parseInt(req.query.minSalary as string) : undefined,
        maxSalary: req.query.maxSalary ? parseInt(req.query.maxSalary as string) : undefined,
        skills: req.query.skills ? (req.query.skills as string).split(',') : undefined,
        experience: req.query.experience as string,
        remote: req.query.remote === 'true',
        datePosted: req.query.datePosted as string
      };

      const preferences = {
        userId,
        preferredLocation: req.query.preferredLocation as string,
        salaryExpectation: req.query.salaryExpectation as string,
        preferredJobTypes: req.query.preferredTypes ? (req.query.preferredTypes as string).split(',') : undefined
      };

      // Use enhanced search with semantic capabilities
      const searchResults = await JobMatchingService.searchJobs(cv, allJobs, filters, preferences);
      
      // Get search suggestions for this query
      const suggestions = filters.query ? 
        await JobMatchingService.generateSearchSuggestions(userId, filters.query, cv) : [];
      
      res.json({
        success: true,
        results: searchResults,
        total: searchResults.length,
        filters,
        suggestions: suggestions.slice(0, 5),
        processingMethod: JobMatchingService.isAvailable() ? 'ai-enhanced' : 'basic',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error in enhanced job search:", error);
      res.status(500).json({ 
        message: "Failed to perform enhanced search",
        details: error instanceof Error ? error.message : 'Unknown error',
        code: "SEARCH_FAILED"
      });
    }
  });

  // Search metrics and analytics API
  app.get('/api/search/metrics', isAuthenticated, async (req: any, res) => {
    try {
      const metrics = JobMatchingService.getMetrics();
      
      res.json({
        success: true,
        metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Error fetching search metrics:", error);
      res.status(500).json({
        message: "Failed to fetch search metrics",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.post('/api/jobs/:id/apply', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const jobId = req.params.id;
      const cv = await storage.getCvByUserId(userId);
      
      if (!cv) {
        return res.status(400).json({ 
          message: "Please upload your CV before applying to jobs",
          code: "CV_REQUIRED"
        });
      }

      // Check if job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Priority 2: Duplicate Application Prevention - Use proper 409 status code
      const existingApplication = await storage.checkExistingApplication(userId, jobId);
      if (existingApplication) {
        return res.status(409).json({ 
          message: "You have already applied to this job",
          code: "DUPLICATE_APPLICATION",
          existingApplicationId: existingApplication.id,
          details: {
            id: existingApplication.id,
            status: existingApplication.status,
            appliedDate: existingApplication.appliedDate
          }
        });
      }

      // Calculate match score if not provided
      let matchScore = req.body.matchScore;
      if (!matchScore && cv.parsedData) {
        try {
          const matches = await JobMatchingService.findMatchedJobs(cv, [job]);
          matchScore = matches.length > 0 ? matches[0].matchScore : 50;
        } catch (error) {
          console.warn('Failed to calculate match score:', error);
          matchScore = 50; // Default score
        }
      }

      // Create application record
      const application = await storage.createApplication({
        userId,
        jobId,
        matchScore: matchScore || 50,
        status: 'applied',
        emailOpened: false,
        notes: req.body.notes || ''
      });

      // Return application with job details
      const applicationWithJob = await storage.getApplicationWithJob(application.id);
      
      res.json({
        success: true,
        application: applicationWithJob,
        message: `Successfully applied to ${job.title} at ${job.company}`
      });
    } catch (error) {
      console.error("Error applying to job:", error);
      
      // Handle database constraint violations (backup protection)
      if (error instanceof Error && (
        error.message.includes('duplicate') || 
        error.message.includes('unique') ||
        error.message.includes('constraint')
      )) {
        return res.status(400).json({ 
          message: "You have already applied to this job",
          code: "DUPLICATE_APPLICATION"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to apply to job",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Application routes
  app.post('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      
      // Validate input data
      const validationResult = insertApplicationSchema.safeParse({ ...req.body, userId });
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid application data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const applicationData = validationResult.data;
      
      // Ensure required fields have defaults
      if (!applicationData.status) applicationData.status = 'applied';
      if (applicationData.emailOpened === undefined) applicationData.emailOpened = false;
      if (!applicationData.matchScore && applicationData.matchScore !== 0) applicationData.matchScore = 50;
      
      const application = await storage.createApplication(applicationData);
      
      
      res.status(201).json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      
      // Handle database constraint violations (duplicate applications)
      if (error instanceof Error && (
        error.message.includes('duplicate') || 
        error.message.includes('unique') ||
        error.message.includes('constraint')
      )) {
        return res.status(409).json({ 
          message: "Application already exists for this job",
          code: "DUPLICATE_APPLICATION"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to create application",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.get('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const applications = await storage.getApplicationsByUserId(userId);
      
      // Get job details for each application
      const applicationsWithJobs = await Promise.all(
        applications.map(async (app) => {
          const job = await storage.getJobById(app.jobId);
          return {
            ...app,
            job
          };
        })
      );
      
      res.json(applicationsWithJobs);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ 
        message: "Failed to fetch applications",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.put('/api/applications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const updates = req.body;
      
      // First verify the application belongs to the user
      const existingApplication = await storage.getApplicationWithJob(id);
      if (!existingApplication || existingApplication.userId !== userId) {
        return res.status(404).json({ 
          message: "Application not found",
          code: "APPLICATION_NOT_FOUND"
        });
      }
      
      // Validate update data (partial validation)
      const allowedUpdates = ['status', 'notes', 'interviewDate', 'tailoredCv', 'coverLetter', 'preparationStatus', 'preparationMetadata'];
      const filteredUpdates: any = {};
      
      for (const [key, value] of Object.entries(updates)) {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = value;
        }
      }
      
      const application = await storage.updateApplication(id, filteredUpdates);
      res.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      
      // Handle database constraint violations
      if (error instanceof Error && (
        error.message.includes('duplicate') || 
        error.message.includes('unique') ||
        error.message.includes('constraint')
      )) {
        return res.status(409).json({ 
          message: "Update violates constraints",
          code: "CONSTRAINT_VIOLATION"
        });
      }
      
      res.status(500).json({ 
        message: "Failed to update application",
        code: "INTERNAL_ERROR"
      });
    }
  });

  app.delete('/api/applications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      // First verify the application belongs to the user
      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({ message: "Application not found" });
      }
      
      await storage.deleteApplication(id);
      res.json({ message: "Application deleted successfully" });
    } catch (error) {
      console.error("Error deleting application:", error);
      res.status(500).json({ message: "Failed to delete application" });
    }
  });

  // Application preparation routes
  app.post('/api/applications/:id/prepare', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      
      
      // Get application with job details
      const applicationWithJob = await storage.getApplicationWithJob(id);
      if (!applicationWithJob || applicationWithJob.userId !== userId) {
        return res.status(404).json(createErrorResponse(
          "Application not found",
          ERROR_CODES.APPLICATION_NOT_FOUND
        ));
      }

      // Check if already prepared
      if (applicationWithJob.preparationStatus === 'ready') {
        return res.json({
          coverLetter: applicationWithJob.coverLetter,
          tailoredCv: applicationWithJob.tailoredCv,
          preparationMetadata: applicationWithJob.preparationMetadata,
          status: 'ready'
        });
      }

      // Update status to preparing
      await storage.updateApplication(id, {
        preparationStatus: 'preparing'
      });

      // Prepare the application
      const result = await ApplicationPreparationService.prepareApplication({
        userId,
        jobId: applicationWithJob.jobId,
        cvId: applicationWithJob.id // Using application id as reference
      });

      if (result.success) {
        // Update application with generated content
        const updatedApplication = await storage.updateApplication(id, {
          coverLetter: result.coverLetter.content,
          tailoredCv: result.tailoredCv.content,
          preparationStatus: 'ready',
          preparationMetadata: {
            coverLetter: result.coverLetter.metadata,
            tailoredCv: result.tailoredCv.metadata,
            preparedAt: new Date().toISOString()
          }
        });

        res.json({
          coverLetter: result.coverLetter.content,
          tailoredCv: result.tailoredCv.content,
          preparationMetadata: updatedApplication.preparationMetadata,
          status: 'ready'
        });
      } else {
        await storage.updateApplication(id, {
          preparationStatus: 'failed',
          preparationMetadata: {
            error: result.error,
            failedAt: new Date().toISOString()
          }
        });

        res.status(500).json(createErrorResponse(
          "Failed to prepare application",
          ERROR_CODES.INTERNAL_ERROR,
          { error: result.error }
        ));
      }
    } catch (error) {
      console.error("Error preparing application:", error);
      res.status(500).json(createErrorResponse(
        "Failed to prepare application",
        ERROR_CODES.INTERNAL_ERROR,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  });

  // Generate cover letter only
  app.post('/api/cover-letter/generate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Priority 3: Use cvTailorSchema for validation
      const validationResult = cvTailorSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const { jobId } = validationResult.data;

      const [user, cv, job] = await Promise.all([
        storage.getUser(userId),
        storage.getCvByUserId(userId),
        storage.getJobById(jobId)
      ]);

      if (!user) {
        return res.status(404).json(createErrorResponse(
          "User not found",
          ERROR_CODES.USER_NOT_FOUND
        ));
      }

      if (!cv) {
        return res.status(400).json(createErrorResponse(
          "CV required. Please upload your CV first.",
          ERROR_CODES.CV_REQUIRED
        ));
      }

      if (!job) {
        return res.status(404).json(createErrorResponse(
          "Job not found",
          ERROR_CODES.JOB_NOT_FOUND
        ));
      }

      const coverLetter = await ApplicationPreparationService.generateCoverLetter(cv, job, user);
      res.json(coverLetter);
    } catch (error) {
      console.error("Error generating cover letter:", error);
      res.status(500).json(createErrorResponse(
        "Failed to generate cover letter",
        ERROR_CODES.INTERNAL_ERROR,
        { details: error instanceof Error ? error.message : 'Unknown error' }
      ));
    }
  });

  // Tailor CV for specific job
  app.post('/api/cv/tailor', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId } = req.body;

      const [user, cv, job] = await Promise.all([
        storage.getUser(userId),
        storage.getCvByUserId(userId),
        storage.getJobById(jobId)
      ]);

      if (!user || !cv || !job) {
        return res.status(400).json({ 
          message: "Missing required data (user, CV, or job)" 
        });
      }

      const tailoredCv = await ApplicationPreparationService.tailorCv(cv, job, user);
      res.json(tailoredCv);
    } catch (error) {
      console.error("Error tailoring CV:", error);
      res.status(500).json({ message: "Failed to tailor CV" });
    }
  });

  // Get API usage statistics
  app.get('/api/usage/stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Get today's usage
      const today = new Date();
      const todayUsage = await storage.getDailyApiUsage(userId, today);
      
      // Get recent usage history
      const recentUsage = await storage.getApiUsageByUserId(userId, 30);
      
      // Calculate usage by endpoint
      const usageByEndpoint = recentUsage.reduce((acc, usage) => {
        acc[usage.endpoint] = (acc[usage.endpoint] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const stats = {
        creditsRemaining: user.creditsRemaining,
        apiCallsToday: user.apiCallsToday,
        maxDailyApiCalls: ApplicationPreparationService['MAX_DAILY_API_CALLS'],
        canMakeApiCall: await ApplicationPreparationService.canMakeApiCall(userId),
        usageByEndpoint,
        recentUsage: recentUsage.slice(0, 10), // Last 10 calls
        totalTokensUsed: recentUsage.reduce((sum, usage) => sum + (usage.tokensUsed || 0), 0)
      };

      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ message: "Failed to fetch usage statistics" });
    }
  });

  // Get templates
  app.get('/api/templates', isAuthenticated, async (req: any, res) => {
    try {
      const { type } = req.query;
      const templates = await storage.getTemplates(type as string);
      res.json(templates);
    } catch (error) {
      console.error("Error fetching templates:", error);
      res.status(500).json({ message: "Failed to fetch templates" });
    }
  });

  // Batch prepare multiple applications
  app.post('/api/applications/batch-prepare', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { applicationIds } = req.body;

      if (!Array.isArray(applicationIds) || applicationIds.length === 0) {
        return res.status(400).json({ message: "applicationIds must be a non-empty array" });
      }

      if (applicationIds.length > 5) {
        return res.status(400).json({ message: "Maximum 5 applications can be prepared in batch" });
      }

      // Check if user can make API calls
      if (!(await ApplicationPreparationService.canMakeApiCall(userId))) {
        return res.status(429).json({ 
          message: "Daily API limit reached or no credits remaining" 
        });
      }

      const results = [];
      
      // Process applications sequentially to avoid overwhelming the API
      for (const applicationId of applicationIds) {
        try {
          const applicationWithJob = await storage.getApplicationWithJob(applicationId);
          
          if (!applicationWithJob || applicationWithJob.userId !== userId) {
            results.push({
              applicationId,
              success: false,
              error: "Application not found or access denied"
            });
            continue;
          }

          if (applicationWithJob.preparationStatus === 'ready') {
            results.push({
              applicationId,
              success: true,
              status: 'already_ready',
              coverLetter: applicationWithJob.coverLetter,
              tailoredCv: applicationWithJob.tailoredCv
            });
            continue;
          }

          const result = await ApplicationPreparationService.prepareApplication({
            userId,
            jobId: applicationWithJob.jobId,
            cvId: applicationId
          });

          if (result.success) {
            await storage.updateApplication(applicationId, {
              coverLetter: result.coverLetter.content,
              tailoredCv: result.tailoredCv.content,
              preparationStatus: 'ready',
              preparationMetadata: {
                coverLetter: result.coverLetter.metadata,
                tailoredCv: result.tailoredCv.metadata,
                preparedAt: new Date().toISOString()
              }
            });

            results.push({
              applicationId,
              success: true,
              status: 'prepared',
              coverLetter: result.coverLetter.content,
              tailoredCv: result.tailoredCv.content
            });
          } else {
            await storage.updateApplication(applicationId, {
              preparationStatus: 'failed'
            });

            results.push({
              applicationId,
              success: false,
              error: result.error
            });
          }
        } catch (error) {
          results.push({
            applicationId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      res.json({
        success: true,
        results,
        totalProcessed: results.length,
        successCount: results.filter(r => r.success).length
      });
    } catch (error) {
      console.error("Error batch preparing applications:", error);
      res.status(500).json({ message: "Failed to batch prepare applications" });
    }
  });

  // PhonePe subscription routes with comprehensive security
  // Note: PhonePe webhook is handled in server/index.ts
  
  // Import PhonePe service
  const { PhonePeService } = await import('./phonepe');

  // Subscription management routes






  // =======================================
  // COMPREHENSIVE APPLICATION TRACKING API
  // =======================================

  // Import the new services for comprehensive application management
  // (Note: These services are imported at the top of the file)

  // =======================================
  // SENDGRID WEBHOOK SECURITY MIDDLEWARE
  // =======================================

  /**
   * Verify SendGrid webhook signature to prevent forged events
   */
  const verifyWebhookSignature = (req: any, res: any, next: any) => {
    const signature = req.headers['x-eventwebhook-signature'];
    const timestamp = req.headers['x-eventwebhook-timestamp'];
    const body = req.body;
    
    // Get webhook secret from environment
    const webhookSecret = process.env.SENDGRID_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      console.error('SendGrid webhook signature verification failed: SENDGRID_WEBHOOK_SECRET not configured');
      return res.status(500).json({
        success: false,
        message: 'Webhook signature verification not configured'
      });
    }

    if (!signature || !timestamp) {
      console.warn('SendGrid webhook signature verification failed: Missing signature or timestamp headers');
      return res.status(401).json({
        success: false,
        message: 'Missing required webhook headers'
      });
    }

    try {
      // Parse the signature header
      const signatureObj = JSON.parse(signature);
      const providedSignature = signatureObj.v1;
      
      if (!providedSignature) {
        console.warn('SendGrid webhook signature verification failed: Invalid signature format');
        return res.status(401).json({
          success: false,
          message: 'Invalid signature format'
        });
      }

      // Create verification payload: timestamp + body
      const payload = timestamp + JSON.stringify(body);
      
      // Generate expected signature using HMAC-SHA256
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload, 'utf8')
        .digest('base64');

      // Verify signature using constant-time comparison
      const isValidSignature = crypto.timingSafeEqual(
        Buffer.from(providedSignature, 'base64'),
        Buffer.from(expectedSignature, 'base64')
      );

      if (!isValidSignature) {
        console.warn('SendGrid webhook signature verification failed: Invalid signature');
        return res.status(401).json({
          success: false,
          message: 'Invalid webhook signature'
        });
      }

      // Check for replay attacks (timestamp should be within 10 minutes)
      const eventTimestamp = parseInt(timestamp);
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const timeDifference = Math.abs(currentTimestamp - eventTimestamp);
      
      if (timeDifference > 600) { // 10 minutes
        console.warn('SendGrid webhook signature verification failed: Timestamp too old (replay attack protection)');
        return res.status(401).json({
          success: false,
          message: 'Webhook timestamp too old'
        });
      }

      // Signature and timestamp are valid, proceed to next middleware
      next();
    } catch (error) {
      console.error('SendGrid webhook signature verification error:', error);
      return res.status(401).json({
        success: false,
        message: 'Webhook signature verification failed'
      });
    }
  };

  // =======================================
  // EMAIL MONITORING ROUTES
  // =======================================

  // Send application email with comprehensive tracking
  app.post('/api/applications/:id/email/send', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { recipientEmail, subject, htmlContent, textContent } = req.body;

      // Validate input
      if (!recipientEmail || !subject || !htmlContent) {
        return res.status(400).json({
          success: false,
          message: 'recipientEmail, subject, and htmlContent are required'
        });
      }

      // Get application
      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      // Send email with tracking
      const result = await EmailMonitoringService.sendApplicationEmail(
        application,
        recipientEmail,
        subject,
        htmlContent,
        textContent
      );

      res.json(result);
    } catch (error) {
      console.error('Error sending application email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send application email'
      });
    }
  });

  // Send follow-up email with tracking
  app.post('/api/applications/:id/email/follow-up', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { recipientEmail, subject, htmlContent, textContent } = req.body;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const result = await EmailMonitoringService.sendFollowUpEmail(
        application,
        recipientEmail,
        subject,
        htmlContent,
        textContent
      );

      res.json(result);
    } catch (error) {
      console.error('Error sending follow-up email:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to send follow-up email'
      });
    }
  });

  // SendGrid webhook handler for email event tracking (secured with signature verification)
  app.post('/api/email/webhook', verifyWebhookSignature, async (req: any, res) => {
    try {
      const events = req.body;
      
      if (!Array.isArray(events)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid webhook payload'
        });
      }

      await EmailMonitoringService.handleSendGridWebhook(events);
      
      res.json({ success: true, processed: events.length });
    } catch (error) {
      console.error('Error processing SendGrid webhook:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process webhook'
      });
    }
  });

  // Get email analytics for specific application
  app.get('/api/applications/:id/email/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const analytics = await EmailMonitoringService.getEmailAnalytics(userId, [id]);
      res.json({ success: true, analytics });
    } catch (error) {
      console.error('Error getting email analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get email analytics'
      });
    }
  });

  // Get user email analytics
  app.get('/api/user/email/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { applicationIds, startDate, endDate } = req.query;

      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;

      const applicationIdArray = applicationIds ? 
        (applicationIds as string).split(',') : undefined;

      const analytics = await EmailMonitoringService.getEmailAnalytics(
        userId, 
        applicationIdArray, 
        dateRange
      );
      
      res.json({ success: true, analytics });
    } catch (error) {
      console.error('Error getting user email analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get email analytics'
      });
    }
  });

  // =======================================
  // APPLICATION LIFECYCLE MANAGEMENT ROUTES
  // =======================================

  // Update application status with comprehensive tracking
  app.put('/api/applications/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { newStatus, reason, metadata, notes, scheduledDate } = req.body;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const result = await ApplicationLifecycleService.updateApplicationStatus({
        applicationId: id,
        newStatus,
        reason,
        metadata,
        notes,
        scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined
      });

      res.json(result);
    } catch (error) {
      console.error('Error updating application status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update application status'
      });
    }
  });

  // Schedule interview with comprehensive tracking
  app.post('/api/applications/:id/interview', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { interviewDate, interviewType, details } = req.body;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const result = await ApplicationLifecycleService.scheduleInterview(
        id,
        new Date(interviewDate),
        interviewType,
        details
      );

      res.json(result);
    } catch (error) {
      console.error('Error scheduling interview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to schedule interview'
      });
    }
  });

  // Get application insights and analytics
  app.get('/api/applications/:id/insights', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const insights = await ApplicationLifecycleService.getApplicationInsights(id);
      res.json({ success: true, insights });
    } catch (error) {
      console.error('Error getting application insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get application insights'
      });
    }
  });

  // Get comprehensive application timeline
  app.get('/api/applications/:id/timeline', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const timeline = await ApplicationLifecycleService.getApplicationTimeline(id);
      res.json({ success: true, ...timeline });
    } catch (error) {
      console.error('Error getting application timeline:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get application timeline'
      });
    }
  });

  // Withdraw application with proper cleanup
  app.post('/api/applications/:id/withdraw', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = req.user.claims.sub;
      const { reason, notifyEmployer = false } = req.body;

      const application = await storage.getApplicationWithJob(id);
      if (!application || application.userId !== userId) {
        return res.status(404).json({
          success: false,
          message: 'Application not found or access denied'
        });
      }

      const result = await ApplicationLifecycleService.withdrawApplication(
        id,
        reason || 'User initiated withdrawal',
        notifyEmployer
      );

      res.json(result);
    } catch (error) {
      console.error('Error withdrawing application:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to withdraw application'
      });
    }
  });

  // Bulk update applications
  app.post('/api/applications/bulk-update', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { applicationIds, updates, reason } = req.body;

      // Verify all applications belong to the user
      for (const applicationId of applicationIds) {
        const application = await storage.getApplicationWithJob(applicationId);
        if (!application || application.userId !== userId) {
          return res.status(403).json({
            success: false,
            message: `Access denied for application ${applicationId}`
          });
        }
      }

      const result = await ApplicationLifecycleService.bulkUpdateApplications(
        applicationIds,
        updates,
        reason
      );

      res.json(result);
    } catch (error) {
      console.error('Error bulk updating applications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to bulk update applications'
      });
    }
  });

  // =======================================
  // NOTIFICATION MANAGEMENT ROUTES
  // =======================================

  // Get user notifications with pagination
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { 
        unreadOnly = 'false', 
        limit = '20', 
        offset = '0', 
        type 
      } = req.query;

      const options = {
        unreadOnly: unreadOnly === 'true',
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        type: type as string
      };

      const result = await NotificationService.getUserNotifications(userId, options);
      res.json({ success: true, ...result });
    } catch (error) {
      console.error('Error getting notifications:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notifications'
      });
    }
  });

  // Mark notification as read
  app.post('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      const result = await NotificationService.markNotificationAsRead(id);
      res.json(result);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to mark notification as read'
      });
    }
  });

  // Get notification preferences
  app.get('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const preferences = await NotificationService.initializeUserPreferences(userId);
      res.json({ success: true, preferences });
    } catch (error) {
      console.error('Error getting notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get notification preferences'
      });
    }
  });

  // Update notification preferences
  app.put('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = req.body;
      
      const result = await NotificationService.updateUserPreferences(userId, preferences);
      res.json(result);
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update notification preferences'
      });
    }
  });

  // =======================================
  // ANALYTICS AND REPORTING ROUTES
  // =======================================

  // Get comprehensive application insights
  app.get('/api/analytics/insights', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;

      const dateRange = startDate && endDate ? {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      } : undefined;

      const insights = await AnalyticsService.generateApplicationInsights(userId, dateRange);
      res.json({ success: true, insights });
    } catch (error) {
      console.error('Error getting application insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get application insights'
      });
    }
  });

  // Get success rate analytics
  app.get('/api/analytics/success-rates', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = req.query;

      const successRates = await AnalyticsService.trackSuccessRates(userId, filters);
      res.json({ success: true, successRates });
    } catch (error) {
      console.error('Error getting success rates:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get success rate analytics'
      });
    }
  });

  // Get response time analytics
  app.get('/api/analytics/response-times', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const filters = req.query;

      const responseTimes = await AnalyticsService.analyzeResponseTimes(userId, filters);
      res.json({ success: true, responseTimes });
    } catch (error) {
      console.error('Error getting response time analytics:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get response time analytics'
      });
    }
  });

  // Get industry-specific insights
  app.get('/api/analytics/industry-insights/:industry', isAuthenticated, async (req: any, res) => {
    try {
      const { industry } = req.params;
      const { role } = req.query;

      const insights = await AnalyticsService.generateIndustryInsights(
        industry, 
        role as string
      );
      res.json({ success: true, insights });
    } catch (error) {
      console.error('Error getting industry insights:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get industry insights'
      });
    }
  });

  // Start A/B test
  app.post('/api/analytics/ab-test', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const testConfig = { ...req.body, userId };

      const result = await AnalyticsService.runA_BTest(testConfig);
      res.json(result);
    } catch (error) {
      console.error('Error starting A/B test:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to start A/B test'
      });
    }
  });

  // Get A/B test results
  app.get('/api/analytics/ab-test/:testId', isAuthenticated, async (req: any, res) => {
    try {
      const { testId } = req.params;

      const results = await AnalyticsService.analyzeA_BTestResults(testId);
      if (!results) {
        return res.status(404).json({
          success: false,
          message: 'A/B test not found'
        });
      }

      res.json({ success: true, results });
    } catch (error) {
      console.error('Error getting A/B test results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get A/B test results'
      });
    }
  });

  // Get ROI analysis
  app.get('/api/analytics/roi', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'startDate and endDate are required'
        });
      }

      const timeframe = {
        start: new Date(startDate as string),
        end: new Date(endDate as string)
      };

      const roiAnalysis = await AnalyticsService.calculateApplicationROI(userId, timeframe);
      res.json({ success: true, roiAnalysis });
    } catch (error) {
      console.error('Error calculating ROI:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to calculate ROI analysis'
      });
    }
  });

  // Enhanced existing analytics endpoint
  app.get('/api/applications/analytics', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const applications = await storage.getApplicationsByUserId(userId);

      // Get basic analytics
      const statusCounts = applications.reduce((counts: any, app) => {
        counts[app.status] = (counts[app.status] || 0) + 1;
        return counts;
      }, {});

      const totalApplications = applications.length;
      const appliedApplications = applications.filter(app => app.status === 'applied').length;
      const successfulApplications = applications.filter(app => 
        ['offered', 'accepted'].includes(app.status)
      ).length;

      // Get comprehensive insights (last 90 days)
      const comprehensiveInsights = await AnalyticsService.generateApplicationInsights(userId);

      res.json({
        success: true,
        basic: {
          totalApplications,
          appliedApplications,
          successfulApplications,
          successRate: totalApplications > 0 ? (successfulApplications / totalApplications) * 100 : 0,
          statusCounts
        },
        comprehensive: comprehensiveInsights
      });
    } catch (error) {
      console.error("Error fetching application analytics:", error);
      res.status(500).json({ 
        success: false,
        message: "Failed to fetch analytics" 
      });
    }
  });

  // Subscription Usage API
  app.get("/api/subscription/usage", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.id;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Calculate usage stats based on new schema
      const currentPlan = user.plan || 'Free';
      const cvDownloadLimit = currentPlan === 'Premium' ? -1 : 2; // Unlimited for Premium, 2 for Free
      const cvDownloadsThisMonth = user.cvDownloadsThisMonth || 0;
      const remainingDownloads = cvDownloadLimit === -1 ? -1 : Math.max(0, cvDownloadLimit - cvDownloadsThisMonth);
      
      // Calculate next reset date (first day of next month)
      const now = new Date();
      const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      res.json({
        success: true,
        currentPlan,
        cvDownloadsThisMonth,
        cvDownloadLimit,
        remainingDownloads,
        hasFullAccess: currentPlan === 'Premium',
        daysSinceReset: Math.floor((now.getTime() - (user.monthlyDownloadsReset?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)),
        nextResetDate: nextReset.toISOString()
      });
    } catch (error) {
      console.error("Error fetching subscription usage:", error);
      res.status(500).json({ success: false, message: "Failed to fetch usage stats" });
    }
  });

  // Activate Free Trial Plan
  app.post("/api/subscription/activate-free", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.claims.sub;
      console.log("Activate-free: userId from claims:", userId);
      console.log("Activate-free: authMethod:", (req as any).user.authMethod);
      let user = await storage.getUserById(userId);
      console.log("Activate-free: user found:", !!user);
      
      // If user doesn't exist, create them automatically (for Replit auth users)
      if (!user && (req as any).user.authMethod === 'replit') {
        const claims = (req as any).user.claims;
        user = await storage.upsertUser({
          id: userId,
          email: claims.email,
          firstName: claims.first_name || '',
          lastName: claims.last_name || '',
          profileImageUrl: claims.profile_image_url || null,
          plan: 'Free',
          cvDownloadsThisMonth: 0,
          cvDownloadsRemaining: 2,
          monthlyDownloadsReset: new Date(),
          subscriptionStatus: 'active'
        });
      }
      
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Check if user already activated free trial or has another plan
      if (user.plan === 'Premium') {
        return res.status(400).json({ 
          success: false, 
          message: "User already has Premium plan" 
        });
      }

      // Prevent multiple free trial activations - only allow if user has never downloaded (fresh state)
      if (user.plan === 'Free' && user.cvDownloadsThisMonth > 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Free trial already activated. Upgrade to Premium for more downloads." 
        });
      }

      // Activate free trial with proper limits
      const updatedUser = await storage.updateUser(userId, {
        plan: 'Free',
        cvDownloadsThisMonth: 0,
        cvDownloadsRemaining: 2,
        monthlyDownloadsReset: new Date(),
        subscriptionStatus: 'active'
      });

      res.json({
        success: true,
        message: "Free trial activated successfully",
        user: {
          id: updatedUser.id,
          plan: updatedUser.plan,
          cvDownloadsRemaining: updatedUser.cvDownloadsRemaining,
          hasFullAccess: false
        }
      });
    } catch (error) {
      console.error("Error activating free trial:", error);
      res.status(500).json({ 
        success: false, 
        message: "Failed to activate free trial" 
      });
    }
  });

  // Secure UPI Payment Routes using PhonePe
  app.post("/api/payments/upi/create", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.claims.sub;
      const { couponCode } = req.body;
      const user = await storage.getUserById(userId);
      
      if (!user) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      // Check if user already has Premium
      if (user.plan === 'Premium') {
        return res.status(400).json({ success: false, message: "User already has Premium plan" });
      }

      // Calculate payment amount with coupon discount
      let finalAmount = PHONEPE_PRICE_MAPPINGS['Premium'];
      let couponUsed = null;
      let discountApplied = 0;

      if (couponCode) {
        const couponValidation = await storage.validateCoupon(couponCode, userId, 'Premium');
        if (!couponValidation.valid) {
          return res.status(400).json({ 
            success: false, 
            message: couponValidation.error || "Invalid coupon code" 
          });
        }

        couponUsed = couponValidation.coupon!;
        const originalAmount = finalAmount;
        finalAmount = calculateDiscountedPrice(originalAmount, couponUsed.discountType, couponUsed.discountValue);
        discountApplied = originalAmount - finalAmount;
      }

      // Create PhonePe payment using the secure service with discounted amount
      const redirectUrl = `${process.env.APP_BASE_URL || 'http://localhost:5000'}/billing?payment=success`;
      const phonepeResponse = await PhonePeService.createPayment(
        userId,
        'Premium', // Plan name 
        user.email || '',
        redirectUrl,
        finalAmount // Use discounted amount
      );

      if (!phonepeResponse.success) {
        throw new Error(phonepeResponse.message || 'Payment creation failed');
      }

      // Create UPI payment record for tracking
      const paymentData = {
        userId,
        amount: finalAmount, // Use discounted amount
        status: 'pending' as const,
        notes: couponUsed 
          ? `Upgrade to Premium plan via PhonePe (Coupon: ${couponCode}, Discount: ₹${discountApplied / 100})`
          : 'Upgrade to Premium plan via PhonePe',
        paymentReference: phonepeResponse.data?.merchantTransactionId
      };

      const payment = await storage.createUpiPayment(paymentData);

      // Return payment details with PhonePe URL
      res.json({
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          status: payment.status,
          merchantTransactionId: phonepeResponse.data?.merchantTransactionId,
          paymentUrl: phonepeResponse.data?.instrumentResponse?.redirectInfo?.url,
          qrCode: {
            upiId: "phonepe@secure", // PhonePe handles the actual UPI details
            amount: payment.amount,
            transactionNote: `Jobr Premium Plan - ${phonepeResponse.data?.merchantTransactionId}`,
            merchantCode: "PHONEPE"
          }
        }
      });
    } catch (error) {
      console.error("Error creating PhonePe payment:", error);
      res.status(500).json({ success: false, message: "Failed to create payment" });
    }
  });

  app.post("/api/payments/upi/verify", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user.claims.sub;
      const { merchantTransactionId } = req.body;
      
      if (!merchantTransactionId) {
        return res.status(400).json({ success: false, message: "Merchant transaction ID is required" });
      }

      // SECURITY: Use PhonePe API to verify payment status (never trust client input)
      const statusResponse = await PhonePeService.checkPaymentStatus(merchantTransactionId);
      
      if (!statusResponse.success) {
        console.error('PhonePe status check failed:', statusResponse.message);
        return res.status(400).json({ 
          success: false, 
          message: "Payment verification failed. Please try again later." 
        });
      }

      const { data } = statusResponse;
      if (!data) {
        return res.status(400).json({ 
          success: false, 
          message: "No payment data returned from PhonePe" 
        });
      }

      // Verify payment is completed and successful
      if (data.state !== 'COMPLETED' || data.responseCode !== 'SUCCESS') {
        return res.status(400).json({ 
          success: false, 
          message: `Payment not completed. Status: ${data.state}, Code: ${data.responseCode}` 
        });
      }

      // Verify the transaction belongs to this user by checking our payment record first
      const userPayments = await storage.getUserUpiPayments(userId);
      const payment = userPayments.find(p => p.paymentReference === merchantTransactionId);
      
      if (!payment) {
        return res.status(404).json({ 
          success: false, 
          message: "Payment record not found for this user" 
        });
      }

      // CRITICAL: Verify amount matches the actual payment record (supports coupon discounts)
      if (data.amount !== payment.amount) {
        console.error(`[SECURITY] Amount mismatch for ${merchantTransactionId}: paid=${data.amount}, expected=${payment.amount}`);
        return res.status(400).json({ 
          success: false, 
          message: "Payment amount does not match recorded payment amount" 
        });
      }

      if (payment.status === 'completed') {
        return res.status(400).json({ 
          success: false, 
          message: "Payment already processed" 
        });
      }

      // Update payment status to completed
      await storage.updateUpiPaymentStatus(payment.id, 'completed', merchantTransactionId);
      
      // Track coupon usage if this payment used a coupon
      if (payment.notes?.includes('Coupon:')) {
        try {
          // Extract coupon code from payment notes (format: "Coupon: CODE, Discount: ₹XXX")
          const couponMatch = payment.notes.match(/Coupon: ([^,]+)/);
          if (couponMatch) {
            const couponCode = couponMatch[1].trim();
            const coupon = await storage.getCouponByCode(couponCode);
            if (coupon) {
              // Calculate discount applied (original amount - paid amount)
              const originalAmount = PHONEPE_PRICE_MAPPINGS['Premium'];
              const discountApplied = originalAmount - payment.amount;
              
              await storage.applyCoupon(coupon.id, userId, merchantTransactionId, discountApplied);
              console.log(`[COUPON] Applied coupon ${couponCode} for user ${userId}, discount: ₹${discountApplied / 100}`);
            }
          }
        } catch (error) {
          console.error('Error tracking coupon usage:', error);
          // Don't fail the payment if coupon tracking fails
        }
      }
      
      // Upgrade user to Premium plan (secured by PhonePe verification)
      const nextPeriodEnd = new Date();
      nextPeriodEnd.setMonth(nextPeriodEnd.getMonth() + 1); // One month from now
      
      await storage.updateUserPlan(userId, 'Premium', 'active', nextPeriodEnd);

      console.log(`[SECURITY] Payment verified via PhonePe API for user ${userId}, transaction: ${merchantTransactionId}`);

      res.json({
        success: true,
        message: "Payment verified and plan upgraded successfully",
        newPlan: 'Premium'
      });
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({ success: false, message: "Failed to verify payment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}