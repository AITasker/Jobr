import type { Express } from "express";
import express from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import rateLimit from "express-rate-limit";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { FileProcessor } from "./fileProcessor";
import { OpenAIService } from "./openaiService";
import { JobMatchingService } from "./jobMatchingService";
import { ApplicationPreparationService } from "./applicationPreparationService";
import { AuthService } from "./authService";
import { JwtUtils } from "./jwtUtils";
import { SubscriptionService } from "./subscriptionService";
import { registerSchema, loginSchema, insertJobSchema, insertApplicationSchema, createSubscriptionSchema, updateSubscriptionSchema, VALID_PRICE_MAPPINGS } from "@shared/schema";

// Configure rate limiting for authentication routes
const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth routes
  message: {
    message: "Too many authentication attempts. Please try again in 15 minutes.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes  
  max: 100, // Limit each IP to 100 requests per windowMs for general routes
  message: {
    message: "Too many requests. Please try again later.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
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
  
  // Configure Google OAuth Strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/api/auth/google/callback'
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
  } else {
    console.warn('Google OAuth not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
  }

  // Auth middleware
  await setupAuth(app);

  // Apply general rate limiting to all routes
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
  app.post('/api/auth/register', authRateLimit, async (req: any, res) => {
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

  app.post('/api/auth/login', authRateLimit, async (req: any, res) => {
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
      const user = await storage.getUser(userId);
      
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

  // Google OAuth routes
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

  // Phone OTP routes
  app.post('/api/auth/phone/request', authRateLimit, async (req: any, res) => {
    try {
      const { phoneNumber } = req.body;
      
      if (!phoneNumber) {
        return res.status(400).json({
          message: "Phone number is required",
          code: "PHONE_REQUIRED"
        });
      }

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
      const { phoneNumber, otpCode, firstName, lastName } = req.body;
      
      if (!phoneNumber || !otpCode) {
        return res.status(400).json({
          message: "Phone number and OTP code are required",
          code: "MISSING_FIELDS"
        });
      }

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
        return res.status(400).json({ message: 'No file uploaded' });
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
        if (error.message.includes('file type') || error.message.includes('file size')) {
          return res.status(400).json({ message: error.message });
        }
        if (error.message.includes('OpenAI API')) {
          return res.status(503).json({ 
            message: 'AI processing temporarily unavailable. Please try again later.',
            details: error.message
          });
        }
      }
      
      res.status(500).json({ 
        message: "Failed to upload and process CV",
        details: error instanceof Error ? error.message : 'Unknown error'
      });
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
        return res.status(404).json({ message: "Job not found" });
      }
      res.json(job);
    } catch (error) {
      console.error("Error fetching job:", error);
      res.status(500).json({ message: "Failed to fetch job" });
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

      // Check for existing application (duplicate prevention)
      const existingApplication = await storage.checkExistingApplication(userId, jobId);
      if (existingApplication) {
        return res.status(400).json({ 
          message: "You have already applied to this job",
          code: "DUPLICATE_APPLICATION",
          existingApplication: {
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
      
      // Check subscription limits before creating application
      const canCreate = await SubscriptionService.canUserCreateApplication(userId);
      if (!canCreate.allowed) {
        return res.status(403).json({
          message: canCreate.reason,
          currentUsage: canCreate.currentUsage,
          limit: canCreate.limit,
          requiresUpgrade: true,
          code: "SUBSCRIPTION_LIMIT_REACHED"
        });
      }
      
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
      
      // Record application creation for usage tracking
      await SubscriptionService.recordApplicationCreated(userId);
      
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
      
      // Check AI feature access for preparation
      const canAccessAI = await SubscriptionService.canUserAccessAIFeatures(userId);
      if (!canAccessAI.allowed) {
        return res.status(403).json({
          message: canAccessAI.reason,
          requiresUpgrade: canAccessAI.requiresUpgrade,
          code: "AI_FEATURES_REQUIRED"
        });
      }
      
      // Get application with job details
      const applicationWithJob = await storage.getApplicationWithJob(id);
      if (!applicationWithJob || applicationWithJob.userId !== userId) {
        return res.status(404).json({ message: "Application not found" });
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

        res.status(500).json({
          message: "Failed to prepare application",
          error: result.error
        });
      }
    } catch (error) {
      console.error("Error preparing application:", error);
      res.status(500).json({ message: "Failed to prepare application" });
    }
  });

  // Generate cover letter only
  app.post('/api/cover-letter/generate', isAuthenticated, async (req: any, res) => {
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

      const coverLetter = await ApplicationPreparationService.generateCoverLetter(cv, job, user);
      res.json(coverLetter);
    } catch (error) {
      console.error("Error generating cover letter:", error);
      res.status(500).json({ message: "Failed to generate cover letter" });
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

  // Get usage statistics
  app.get('/api/subscription/usage', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const stats = await SubscriptionService.getUserUsageStats(userId);
      
      if (!stats) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(stats);
    } catch (error) {
      console.error("Error fetching usage stats:", error);
      res.status(500).json({ message: "Failed to fetch usage statistics" });
    }
  });

  // Get current subscription status
  app.get('/api/subscription', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const activeSubscription = await storage.getActiveSubscriptionByUserId(userId);
      
      res.json({
        currentPlan: user.plan,
        subscriptionStatus: user.subscriptionStatus,
        currentPeriodEnd: user.subscriptionCurrentPeriodEnd,
        applicationsThisMonth: user.applicationsThisMonth,
        applicationsLimit: user.plan === 'Free' ? 5 : -1, // -1 means unlimited
        phonepeCustomerId: user.stripeCustomerId, // Reuse field for PhonePe customer tracking
        activeSubscription,
        validPlans: Object.keys(VALID_PRICE_MAPPINGS), // Available upgrade plans
        pricing: VALID_PRICE_MAPPINGS // Include pricing information
      });
    } catch (error) {
      console.error("Error fetching subscription:", error);
      res.status(500).json({ message: "Failed to fetch subscription" });
    }
  });

  // Create PhonePe payment - SECURE PRICE VALIDATION
  app.post('/api/subscription/create', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validationResult = createSubscriptionSchema.safeParse(req.body);
      
      if (!validationResult.success) {
        return res.status(400).json({
          message: "Invalid input data",
          errors: validationResult.error.errors,
          code: "VALIDATION_ERROR"
        });
      }

      const { plan } = validationResult.data;
      
      // CRITICAL SECURITY: Server-side price validation - prevent price manipulation
      const amount = VALID_PRICE_MAPPINGS[plan];
      if (!amount) {
        return res.status(400).json({
          message: `Invalid plan selected: ${plan}`,
          code: "INVALID_PLAN"
        });
      }

      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ 
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }

      if (!user.email) {
        return res.status(400).json({ 
          message: "User email not found",
          code: "EMAIL_REQUIRED"
        });
      }

      // Create PhonePe payment request
      const redirectUrl = `${req.headers.origin}/dashboard?payment=success`;
      const paymentResponse = await PhonePeService.createPayment(
        userId,
        plan,
        user.email,
        redirectUrl
      );

      if (paymentResponse.success && paymentResponse.data) {
        res.json({
          success: true,
          paymentUrl: paymentResponse.data.instrumentResponse.redirectInfo.url,
          merchantTransactionId: paymentResponse.data.merchantTransactionId
        });
      } else {
        res.status(400).json({
          message: paymentResponse.message || "Payment creation failed",
          code: paymentResponse.code || "PAYMENT_FAILED"
        });
      }
    } catch (error) {
      console.error("Error creating PhonePe payment:", error);
      res.status(500).json({ 
        message: "Failed to create payment",
        code: "PAYMENT_CREATE_FAILED"
      });
    }
  });

  // Cancel subscription 
  app.post('/api/subscription/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { cancelAtPeriodEnd = true } = req.body;
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ 
          message: "User not found",
          code: "USER_NOT_FOUND"
        });
      }

      const activeSubscription = await storage.getActiveSubscriptionByUserId(userId);
      if (!activeSubscription) {
        return res.status(404).json({ 
          message: "No active subscription found",
          code: "NO_SUBSCRIPTION"
        });
      }

      // Update local subscription record
      await storage.updateSubscription(activeSubscription.id, {
        cancelAtPeriodEnd: cancelAtPeriodEnd,
        canceledAt: cancelAtPeriodEnd ? new Date() : null
      });

      // If canceling immediately, downgrade to Free plan
      if (!cancelAtPeriodEnd) {
        await storage.updateUserPlan(userId, 'Free', 'active');
      }

      res.json({ 
        success: true, 
        cancelAtPeriodEnd,
        currentPeriodEnd: activeSubscription.currentPeriodEnd,
        message: cancelAtPeriodEnd 
          ? "Subscription will be cancelled at the end of current period" 
          : "Subscription cancelled immediately"
      });
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      res.status(500).json({ 
        message: "Failed to cancel subscription",
        code: "SUBSCRIPTION_CANCEL_FAILED"
      });
    }
  });

  // Check payment status
  app.get('/api/subscription/payment-status/:merchantTransactionId', isAuthenticated, async (req: any, res) => {
    try {
      const { merchantTransactionId } = req.params;
      
      const status = await PhonePeService.checkPaymentStatus(merchantTransactionId);
      
      res.json({
        success: true,
        status,
        merchantTransactionId
      });
    } catch (error) {
      console.error("Error checking payment status:", error);
      res.status(500).json({ 
        message: "Failed to check payment status",
        code: "STATUS_CHECK_FAILED"
      });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}