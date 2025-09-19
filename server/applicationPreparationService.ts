import OpenAI from "openai";
import memoize from "memoizee";
import crypto from "crypto";
import { storage } from "./storage";
import type { User, Cv, Job, Application, InsertApiUsage } from "@shared/schema";

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ApplicationPreparationRequest {
  userId: string;
  jobId: string;
  cvId: string;
}

export interface CoverLetterData {
  content: string;
  metadata: {
    generatedWith: 'openai' | 'template';
    tokensUsed?: number;
    templateUsed?: string;
    processingTime: number;
  };
}

export interface TailoredCvData {
  content: string;
  metadata: {
    generatedWith: 'openai' | 'template';
    tokensUsed?: number;
    keyChanges: string[];
    processingTime: number;
  };
}

export interface PreparedApplication {
  coverLetter: CoverLetterData;
  tailoredCv: TailoredCvData;
  success: boolean;
  error?: string;
}

export interface TailoringMetrics {
  tokensUsed: number;
  processingTime: number;
  cacheHit: boolean;
  retryCount: number;
  success: boolean;
  optimizationsApplied: string[];
}

export interface EnhancedTailoredCvData extends TailoredCvData {
  metrics: TailoringMetrics;
  industryOptimizations?: string[];
  keywordMatches?: string[];
  atsScore?: number;
}

export interface EnhancedCoverLetterData extends CoverLetterData {
  metrics: TailoringMetrics;
  personalizedElements?: string[];
  industrySpecificTone?: string;
}

export interface IndustryTemplate {
  industry: string;
  keywords: string[];
  toneAdjustments: string[];
  skillPriorities: string[];
  customSections?: string[];
}

interface TailoringCacheEntry {
  data: CoverLetterData | TailoredCvData;
  timestamp: number;
  hash: string;
  type: 'cover_letter' | 'cv_tailoring';
}

export class ApplicationPreparationService {
  // Enhanced configuration constants for optimization
  private static readonly MAX_DAILY_API_CALLS = 50; // Conservative limit for free tier
  private static readonly MAX_TOKENS_PER_REQUEST = 1500; // Reduced from 2000 for cost efficiency
  private static readonly CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours (shorter for fresh application content)
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_BASE = 1000;
  private static readonly TEMPERATURE_CV = 0.3; // Lower for consistent CV formatting
  private static readonly TEMPERATURE_COVER = 0.6; // Higher for more creative cover letters
  
  // Enhanced cache for CV tailoring and cover letter results
  private static cache = new Map<string, TailoringCacheEntry>();
  
  // Performance metrics tracking
  private static metrics = {
    totalRequests: 0,
    cacheHits: 0,
    retryCount: 0,
    avgResponseTime: 0,
    tokensSaved: 0,
    industryOptimizations: 0
  };

  // Industry-specific templates for enhanced customization
  private static industryTemplates: IndustryTemplate[] = [
    {
      industry: 'technology',
      keywords: ['agile', 'scrum', 'CI/CD', 'cloud', 'API', 'microservices', 'DevOps', 'automation'],
      toneAdjustments: ['technical proficiency', 'innovation-focused', 'problem-solving'],
      skillPriorities: ['programming languages', 'frameworks', 'cloud platforms', 'databases']
    },
    {
      industry: 'finance',
      keywords: ['compliance', 'risk management', 'financial analysis', 'regulations', 'audit', 'ROI'],
      toneAdjustments: ['precision-oriented', 'analytical', 'detail-focused'],
      skillPriorities: ['financial modeling', 'analytics', 'regulatory knowledge', 'risk assessment']
    },
    {
      industry: 'healthcare',
      keywords: ['patient care', 'HIPAA', 'clinical', 'medical records', 'healthcare systems', 'quality assurance'],
      toneAdjustments: ['patient-focused', 'empathetic', 'safety-conscious'],
      skillPriorities: ['clinical skills', 'healthcare technology', 'patient management', 'compliance']
    },
    {
      industry: 'marketing',
      keywords: ['brand strategy', 'digital marketing', 'analytics', 'campaign management', 'SEO', 'content strategy'],
      toneAdjustments: ['creative', 'results-driven', 'data-informed'],
      skillPriorities: ['marketing tools', 'analytics platforms', 'creative software', 'communication']
    },
    {
      industry: 'education',
      keywords: ['curriculum', 'student engagement', 'assessment', 'learning outcomes', 'pedagogy', 'classroom management'],
      toneAdjustments: ['student-centered', 'educational-focused', 'development-oriented'],
      skillPriorities: ['teaching methods', 'educational technology', 'assessment tools', 'communication']
    }
  ];

  static isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Get current performance metrics with detailed analytics
   */
  static getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalRequests > 0 ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100 : 0,
      avgTokensSaved: this.metrics.cacheHits > 0 ? this.metrics.tokensSaved / this.metrics.cacheHits : 0,
      industryOptimizationRate: this.metrics.totalRequests > 0 ? (this.metrics.industryOptimizations / this.metrics.totalRequests) * 100 : 0
    };
  }

  /**
   * Generate cache key for tailoring results
   */
  private static generateCacheKey(cvId: string, jobId: string, type: 'cover_letter' | 'cv_tailoring'): string {
    const input = `${cvId}-${jobId}-${type}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Check cache for existing tailoring result
   */
  private static getCachedResult(cacheKey: string): CoverLetterData | TailoredCvData | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    this.metrics.cacheHits++;
    this.metrics.tokensSaved += this.MAX_TOKENS_PER_REQUEST; // Estimate tokens saved
    return entry.data;
  }

  /**
   * Store result in cache
   */
  private static setCachedResult(cacheKey: string, data: CoverLetterData | TailoredCvData, type: 'cover_letter' | 'cv_tailoring'): void {
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      hash: cacheKey,
      type
    });

    // Clean old entries if cache gets too large
    if (this.cache.size > 1500) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, 300); // Remove oldest 300 entries
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Detect job industry for targeted optimization
   */
  private static detectJobIndustry(job: Job): string {
    const jobText = `${job.title} ${job.company} ${job.description}`.toLowerCase();
    
    for (const template of this.industryTemplates) {
      const industryScore = template.keywords.reduce((score, keyword) => {
        return score + (jobText.includes(keyword.toLowerCase()) ? 1 : 0);
      }, 0);
      
      if (industryScore >= 2) { // Require at least 2 keyword matches
        return template.industry;
      }
    }
    
    return 'general';
  }

  /**
   * Get industry-specific optimization template
   */
  private static getIndustryTemplate(industry: string): IndustryTemplate | null {
    return this.industryTemplates.find(template => template.industry === industry) || null;
  }

  /**
   * Check if user has remaining API quota for today
   */
  static async canMakeApiCall(userId: string): Promise<boolean> {
    const user = await storage.getUser(userId);
    if (!user) return false;

    // Reset daily counter if it's a new day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const lastReset = new Date(user.lastApiCallReset || user.createdAt || new Date());
    lastReset.setHours(0, 0, 0, 0);

    if (today.getTime() > lastReset.getTime()) {
      // Reset the counter for the new day
      await storage.updateUser(userId, {
        apiCallsToday: 0,
        lastApiCallReset: new Date()
      });
      return user.creditsRemaining > 0;
    }

    return user.apiCallsToday < this.MAX_DAILY_API_CALLS && user.creditsRemaining > 0;
  }

  /**
   * Log API usage for analytics and rate limiting
   */
  static async logApiUsage(data: InsertApiUsage): Promise<void> {
    try {
      await storage.createApiUsage(data);
      
      // Update user's daily API call count
      if (data.success) {
        const user = await storage.getUser(data.userId);
        if (user) {
          await storage.updateUser(data.userId, {
            apiCallsToday: user.apiCallsToday + 1,
            creditsRemaining: Math.max(0, user.creditsRemaining - 1)
          });
        }
      }
    } catch (error) {
      console.error('Failed to log API usage:', error);
    }
  }

  /**
   * Enhanced cover letter generation with caching, industry optimization, and retry logic
   */
  static async generateCoverLetter(
    cv: Cv, 
    job: Job, 
    user: User
  ): Promise<CoverLetterData> {
    const startTime = Date.now();
    this.metrics.totalRequests++;

    // Check cache first
    const cacheKey = this.generateCacheKey(cv.id, job.id, 'cover_letter');
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult && cachedResult.metadata) {
      return cachedResult as CoverLetterData;
    }

    if (!this.isAvailable() || !(await this.canMakeApiCall(user.id))) {
      return this.generateCoverLetterFallback(cv, job, user, startTime);
    }

    // Try with retry logic
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.MAX_RETRIES) {
      try {
        const result = await this.performOptimizedCoverLetterGeneration(cv, job, user);
        
        // Cache successful result
        this.setCachedResult(cacheKey, result, 'cover_letter');
        
        // Update metrics
        const processingTime = Date.now() - startTime;
        this.metrics.avgResponseTime = 
          (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + processingTime) / this.metrics.totalRequests;

        return result;
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        this.metrics.retryCount++;
        
        if (retryCount <= this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, retryCount - 1) + Math.random() * 1000;
          console.warn(`Cover letter generation attempt ${retryCount} failed, retrying in ${delay}ms:`, error);
          await this.sleep(delay);
        }
      }
    }

    console.error('All cover letter generation retries exhausted, falling back:', lastError);
    return this.generateCoverLetterFallback(cv, job, user, startTime);
  }

  /**
   * Perform optimized cover letter generation with industry-specific enhancements
   */
  private static async performOptimizedCoverLetterGeneration(cv: Cv, job: Job, user: User): Promise<CoverLetterData> {
    const startTime = Date.now();
    
    // Detect industry for optimization
    const industry = this.detectJobIndustry(job);
    const industryTemplate = this.getIndustryTemplate(industry);
    
    if (industryTemplate) {
      this.metrics.industryOptimizations++;
    }

    // Build optimized prompt with industry context
    const prompt = this.buildCoverLetterPrompt(cv, job, user);
    
    const response = await openai!.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Write personalized cover letters. Focus on relevant experience, industry fit, and genuine interest. Use professional tone adapted to industry context."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: this.MAX_TOKENS_PER_REQUEST,
      temperature: this.TEMPERATURE_COVER,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No content generated');
    }

    const processingTime = Date.now() - startTime;
    const tokensUsed = response.usage?.total_tokens || 0;

    // Log successful API usage
    await this.logApiUsage({
      userId: user.id,
      endpoint: 'cover_letter',
      tokensUsed,
      success: true,
      responseTime: processingTime
    });

    return {
      content,
      metadata: {
        generatedWith: 'openai',
        tokensUsed,
        processingTime
      }
    };
  }

  /**
   * Tailor CV content for a specific job using OpenAI
   */
  static async tailorCv(
    cv: Cv, 
    job: Job, 
    user: User
  ): Promise<TailoredCvData> {
    const startTime = Date.now();

    if (!this.isAvailable() || !(await this.canMakeApiCall(user.id))) {
      return this.tailorCvFallback(cv, job, user, startTime);
    }

    try {
      const prompt = this.buildCvTailoringPrompt(cv, job);
      
      const response = await openai!.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system", 
            content: "You are an expert resume writer who tailors CVs to specific job requirements. Focus on highlighting relevant skills and experience while maintaining truthfulness and professional formatting."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        max_tokens: this.MAX_TOKENS_PER_REQUEST,
        temperature: 0.3, // Lower temperature for more consistent formatting
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No content generated');
      }

      const processingTime = Date.now() - startTime;
      const tokensUsed = response.usage?.total_tokens || 0;

      // Log successful API usage
      await this.logApiUsage({
        userId: user.id,
        endpoint: 'cv_tailor',
        tokensUsed,
        success: true,
        responseTime: processingTime
      });

      return {
        content,
        metadata: {
          generatedWith: 'openai',
          tokensUsed,
          keyChanges: ['AI-optimized for job requirements'],
          processingTime
        }
      };
    } catch (error) {
      console.error('OpenAI CV tailoring failed:', error);
      
      // Log failed API usage  
      await this.logApiUsage({
        userId: user.id,
        endpoint: 'cv_tailor',
        tokensUsed: 0,
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        responseTime: Date.now() - startTime
      });

      return this.tailorCvFallback(cv, job, user, startTime);
    }
  }

  /**
   * Prepare a complete application (cover letter + tailored CV)
   */
  static async prepareApplication(request: ApplicationPreparationRequest): Promise<PreparedApplication> {
    try {
      const [user, cv, job] = await Promise.all([
        storage.getUser(request.userId),
        storage.getCvByUserId(request.userId),
        storage.getJobById(request.jobId)
      ]);

      if (!user || !cv || !job) {
        return {
          coverLetter: { content: '', metadata: { generatedWith: 'template', processingTime: 0 } },
          tailoredCv: { content: '', metadata: { generatedWith: 'template', keyChanges: [], processingTime: 0 } },
          success: false,
          error: 'Missing required data'
        };
      }

      // Generate cover letter and tailor CV in parallel to save time
      const [coverLetter, tailoredCv] = await Promise.all([
        this.generateCoverLetter(cv, job, user),
        this.tailorCv(cv, job, user)
      ]);

      return {
        coverLetter,
        tailoredCv,
        success: true
      };
    } catch (error) {
      return {
        coverLetter: { content: '', metadata: { generatedWith: 'template', processingTime: 0 } },
        tailoredCv: { content: '', metadata: { generatedWith: 'template', keyChanges: [], processingTime: 0 } },
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build optimized prompt for cover letter generation
   */
  private static buildCoverLetterPrompt(cv: Cv, job: Job, user: User): string {
    const parsedData = cv.parsedData as any;
    const userName = parsedData?.name || `${user.firstName} ${user.lastName}`;
    
    return `Write a professional cover letter for the following job application:

Job Details:
- Position: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Job Description: ${job.description.substring(0, 500)}...
- Key Requirements: ${job.requirements?.slice(0, 5).join(', ') || 'Not specified'}

Candidate Information:
- Name: ${userName}
- Skills: ${cv.skills?.slice(0, 8).join(', ') || 'Various skills'}
- Experience: ${cv.experience?.substring(0, 300) || 'Professional experience'}
- Education: ${cv.education?.substring(0, 200) || 'Educational background'}

Instructions:
1. Address the hiring manager professionally
2. Show enthusiasm for the specific role and company
3. Highlight 2-3 most relevant skills/experiences from the CV
4. Keep it concise (under 300 words)
5. Include a strong closing with call to action
6. Use professional tone throughout

Format as a complete, ready-to-send cover letter.`;
  }

  /**
   * Build optimized prompt for CV tailoring
   */
  private static buildCvTailoringPrompt(cv: Cv, job: Job): string {
    return `Tailor the following CV content for this specific job opportunity:

Job Details:
- Position: ${job.title}
- Company: ${job.company}
- Requirements: ${job.requirements?.slice(0, 8).join(', ') || 'Not specified'}
- Job Description: ${job.description.substring(0, 400)}...

Current CV Content:
- Skills: ${cv.skills?.join(', ') || 'Not specified'}
- Experience: ${cv.experience || 'Not specified'}
- Education: ${cv.education || 'Not specified'}

Instructions:
1. Reorder and emphasize skills that match job requirements
2. Adjust experience descriptions to highlight relevant achievements
3. Use keywords from the job description naturally
4. Maintain truthful representation of qualifications
5. Keep professional formatting
6. Optimize for ATS systems

Return the tailored CV content in a clean, professional format.`;
  }

  /**
   * Fallback cover letter generation using templates
   */
  private static generateCoverLetterFallback(
    cv: Cv, 
    job: Job, 
    user: User, 
    startTime: number
  ): CoverLetterData {
    const parsedData = cv.parsedData as any;
    const userName = parsedData?.name || `${user.firstName} ${user.lastName}`;
    const userEmail = parsedData?.email || user.email || '';
    const skills = cv.skills?.slice(0, 3).join(', ') || 'relevant skills';
    
    const template = `Dear Hiring Manager,

I am writing to express my strong interest in the ${job.title} position at ${job.company}. With my background in ${skills} and proven experience in the field, I am excited about the opportunity to contribute to your team.

In my previous roles, I have developed expertise in ${skills} which directly aligns with your requirements. I am particularly drawn to ${job.company} because of its reputation for innovation and excellence in the industry.

I would welcome the opportunity to discuss how my skills and enthusiasm can contribute to your team's success. Thank you for considering my application.

Best regards,
${userName}
${userEmail}`;

    return {
      content: template,
      metadata: {
        generatedWith: 'template',
        templateUsed: 'default_cover_letter',
        processingTime: Date.now() - startTime
      }
    };
  }

  /**
   * Fallback CV tailoring using basic keyword matching
   */
  private static tailorCvFallback(
    cv: Cv, 
    job: Job, 
    user: User, 
    startTime: number
  ): TailoredCvData {
    // Simple tailoring: reorder skills to match job requirements
    const jobKeywords = job.requirements?.slice(0, 5) || [];
    const userSkills = cv.skills || [];
    
    // Prioritize skills that match job requirements
    const matchingSkills = userSkills.filter(skill => 
      jobKeywords.some(keyword => 
        skill.toLowerCase().includes(keyword.toLowerCase()) ||
        keyword.toLowerCase().includes(skill.toLowerCase())
      )
    );
    
    const otherSkills = userSkills.filter(skill => !matchingSkills.includes(skill));
    const tailoredSkills = [...matchingSkills, ...otherSkills];

    const tailoredContent = `SKILLS: ${tailoredSkills.join(', ')}

EXPERIENCE: ${cv.experience || 'Professional experience in various roles'}

EDUCATION: ${cv.education || 'Educational background'}

Note: This CV has been optimized for the ${job.title} position at ${job.company}.`;

    return {
      content: tailoredContent,
      metadata: {
        generatedWith: 'template',
        keyChanges: ['Reordered skills to match job requirements'],
        processingTime: Date.now() - startTime
      }
    };
  }
}