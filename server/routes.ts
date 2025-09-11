import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { FileProcessor } from "./fileProcessor";
import { OpenAIService } from "./openaiService";

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
  // Auth middleware
  await setupAuth(app);

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

  // Application routes
  app.post('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId, matchScore } = req.body;
      
      // TODO: Implement AI-powered CV tailoring and cover letter generation
      const application = await storage.createApplication({
        userId,
        jobId,
        matchScore,
        status: 'applied',
        emailOpened: false,
      });

      res.json(application);
    } catch (error) {
      console.error("Error creating application:", error);
      res.status(500).json({ message: "Failed to create application" });
    }
  });

  app.get('/api/applications', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const applications = await storage.getApplicationsByUserId(userId);
      res.json(applications);
    } catch (error) {
      console.error("Error fetching applications:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  app.put('/api/applications/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const application = await storage.updateApplication(id, updates);
      res.json(application);
    } catch (error) {
      console.error("Error updating application:", error);
      res.status(500).json({ message: "Failed to update application" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}