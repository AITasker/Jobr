import OpenAI from "openai";
import memoize from "memoizee";
import crypto from "crypto";
import type { Cv, Job } from "@shared/schema";
import { ParsedCVData } from "./openaiService";

// Note: the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface JobMatchResult {
  job: Job;
  matchScore: number;
  explanation: string;
  skillsMatch: {
    matched: string[];
    missing: string[];
    score: number;
  };
  experienceMatch: {
    suitable: boolean;
    explanation: string;
    score: number;
  };
  locationMatch: {
    suitable: boolean;
    explanation: string;
    score: number;
  };
  salaryMatch: {
    suitable: boolean;
    explanation: string;
    score: number;
  };
}

export interface JobMatchingMetrics {
  tokensUsed: number;
  processingTime: number;
  cacheHit: boolean;
  retryCount: number;
  success: boolean;
  batchSize?: number;
}

export interface EnhancedJobMatchResult extends JobMatchResult {
  metrics: JobMatchingMetrics;
  personalizedScore?: number;
  recommendationReason?: string;
}

export interface UserBehaviorData {
  appliedJobs: string[];
  viewedJobs: string[];
  savedJobs: string[];
  rejectedJobs: string[];
  preferredCompanies: string[];
  preferredJobTypes: string[];
  averageViewTime: number;
}

interface MatchCacheEntry {
  result: JobMatchResult;
  timestamp: number;
  hash: string;
}

export class JobMatchingService {
  // Configuration constants for optimization
  private static readonly CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours (shorter than CV parsing for fresh job market data)
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_BASE = 1000;
  private static readonly MAX_TOKENS = 1000; // Reduced from 1500 for cost efficiency
  private static readonly TEMPERATURE = 0.2; // Lower for more consistent matching
  private static readonly BATCH_SIZE = 8; // Optimal batch size for job matching
  
  // Enhanced cache for job matching results
  private static cache = new Map<string, MatchCacheEntry>();
  
  // User behavior tracking for personalized recommendations
  private static userBehavior = new Map<string, UserBehaviorData>();
  
  // Performance metrics tracking
  private static metrics = {
    totalRequests: 0,
    cacheHits: 0,
    batchedRequests: 0,
    retryCount: 0,
    avgResponseTime: 0,
    tokensSaved: 0,
    personalizedRecommendations: 0
  };

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
      batchEfficiency: this.metrics.totalRequests > 0 ? (this.metrics.batchedRequests / this.metrics.totalRequests) * 100 : 0,
      avgTokensSaved: this.metrics.cacheHits > 0 ? this.metrics.tokensSaved / this.metrics.cacheHits : 0,
      personalizationRate: this.metrics.totalRequests > 0 ? (this.metrics.personalizedRecommendations / this.metrics.totalRequests) * 100 : 0
    };
  }

  /**
   * Generate cache key for job matching results
   */
  private static generateMatchCacheKey(cvId: string, jobId: string, preferences?: any): string {
    const prefString = preferences ? JSON.stringify(preferences) : '';
    const input = `${cvId}-${jobId}-${prefString}`;
    return crypto.createHash('sha256').update(input).digest('hex');
  }

  /**
   * Check cache for existing match result
   */
  private static getCachedMatch(cacheKey: string): JobMatchResult | null {
    const entry = this.cache.get(cacheKey);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(cacheKey);
      return null;
    }

    this.metrics.cacheHits++;
    this.metrics.tokensSaved += this.MAX_TOKENS; // Estimate tokens saved
    return entry.result;
  }

  /**
   * Store result in cache
   */
  private static setCachedMatch(cacheKey: string, result: JobMatchResult): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      hash: cacheKey
    });

    // Clean old entries if cache gets too large
    if (this.cache.size > 2000) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, 400); // Remove oldest 400 entries
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
   * Track user behavior for personalized recommendations
   */
  static trackUserBehavior(userId: string, action: string, jobId: string, metadata?: any): void {
    if (!this.userBehavior.has(userId)) {
      this.userBehavior.set(userId, {
        appliedJobs: [],
        viewedJobs: [],
        savedJobs: [],
        rejectedJobs: [],
        preferredCompanies: [],
        preferredJobTypes: [],
        averageViewTime: 0
      });
    }

    const behavior = this.userBehavior.get(userId)!;

    switch (action) {
      case 'apply':
        if (!behavior.appliedJobs.includes(jobId)) {
          behavior.appliedJobs.push(jobId);
        }
        break;
      case 'view':
        if (!behavior.viewedJobs.includes(jobId)) {
          behavior.viewedJobs.push(jobId);
        }
        if (metadata?.viewTime) {
          behavior.averageViewTime = (behavior.averageViewTime + metadata.viewTime) / 2;
        }
        break;
      case 'save':
        if (!behavior.savedJobs.includes(jobId)) {
          behavior.savedJobs.push(jobId);
        }
        break;
      case 'reject':
        if (!behavior.rejectedJobs.includes(jobId)) {
          behavior.rejectedJobs.push(jobId);
        }
        break;
    }

    // Keep only recent behavior (last 1000 actions per type)
    Object.keys(behavior).forEach(key => {
      if (Array.isArray(behavior[key as keyof UserBehaviorData])) {
        const arr = behavior[key as keyof UserBehaviorData] as string[];
        if (arr.length > 1000) {
          behavior[key as keyof UserBehaviorData] = arr.slice(-1000) as any;
        }
      }
    });
  }

  /**
   * Get personalized score boost based on user behavior
   */
  private static getPersonalizedBoost(userId: string, job: Job): number {
    const behavior = this.userBehavior.get(userId);
    if (!behavior) return 0;

    let boost = 0;

    // Boost similar companies
    if (behavior.preferredCompanies.includes(job.company)) {
      boost += 15;
    }

    // Boost similar job types
    if (behavior.preferredJobTypes.some(type => job.type.toLowerCase().includes(type.toLowerCase()))) {
      boost += 10;
    }

    // Penalize if user has rejected similar jobs
    if (behavior.rejectedJobs.length > 0) {
      // This would require job similarity analysis, simplified for now
      boost -= 5;
    }

    // Boost if user has applied to similar positions
    if (behavior.appliedJobs.length > 0) {
      boost += 5;
    }

    return Math.max(-20, Math.min(20, boost)); // Cap boost between -20 and +20
  }

  /**
   * Enhanced job matching with caching, batch processing, and personalization
   */
  static async findMatchedJobs(cv: Cv, jobs: Job[], preferences?: {
    preferredLocation?: string;
    salaryExpectation?: string;
    preferredJobTypes?: string[];
    userId?: string;
  }): Promise<JobMatchResult[]> {
    const startTime = Date.now();
    this.metrics.totalRequests += jobs.length;

    if (!cv.parsedData) {
      throw new Error('CV must be parsed before job matching');
    }

    const matches: JobMatchResult[] = [];
    const uncachedJobs: Job[] = [];
    const cachedResults: JobMatchResult[] = [];

    // Check cache for existing results
    for (const job of jobs) {
      const cacheKey = this.generateMatchCacheKey(cv.id, job.id, preferences);
      const cachedMatch = this.getCachedMatch(cacheKey);
      
      if (cachedMatch) {
        // Apply personalization boost to cached results
        if (preferences?.userId) {
          const personalizedMatch = this.applyPersonalization(cachedMatch, preferences.userId);
          cachedResults.push(personalizedMatch);
        } else {
          cachedResults.push(cachedMatch);
        }
      } else {
        uncachedJobs.push(job);
      }
    }

    // Process uncached jobs
    if (uncachedJobs.length > 0) {
      if (this.isAvailable()) {
        try {
          // Use batch processing for better efficiency
          const newMatches = await this.batchMatchJobs(cv, uncachedJobs, preferences);
          matches.push(...newMatches);
        } catch (error) {
          console.warn('AI batch matching failed, falling back to basic matching:', error);
          // Fall back to basic matching for uncached jobs
          for (const job of uncachedJobs) {
            const matchResult = this.matchJobBasic(cv, job, preferences);
            matches.push(matchResult);
          }
        }
      } else {
        console.log('OpenAI not available, using basic matching');
        // Use basic matching for uncached jobs
        for (const job of uncachedJobs) {
          const matchResult = this.matchJobBasic(cv, job, preferences);
          matches.push(matchResult);
        }
      }
    }

    // Combine cached and new results
    const allMatches = [...cachedResults, ...matches];

    // Update metrics
    const processingTime = Date.now() - startTime;
    this.metrics.avgResponseTime = 
      (this.metrics.avgResponseTime * (this.metrics.totalRequests - jobs.length) + processingTime) / this.metrics.totalRequests;

    // Sort by match score (highest first) and return top matches
    return allMatches
      .sort((a, b) => b.matchScore - a.matchScore)
      .filter(match => match.matchScore > 20); // Filter out very low matches
  }

  /**
   * Apply personalization boost to match results
   */
  private static applyPersonalization(match: JobMatchResult, userId: string): JobMatchResult {
    const personalizedBoost = this.getPersonalizedBoost(userId, match.job);
    
    if (personalizedBoost !== 0) {
      this.metrics.personalizedRecommendations++;
      
      return {
        ...match,
        matchScore: Math.max(0, Math.min(100, match.matchScore + personalizedBoost))
      };
    }
    
    return match;
  }

  /**
   * Batch process multiple job matches for improved efficiency
   */
  private static async batchMatchJobs(cv: Cv, jobs: Job[], preferences?: any): Promise<JobMatchResult[]> {
    const results: JobMatchResult[] = [];
    this.metrics.batchedRequests += jobs.length;

    // Process jobs in batches
    for (let i = 0; i < jobs.length; i += this.BATCH_SIZE) {
      const batch = jobs.slice(i, i + this.BATCH_SIZE);
      
      try {
        // Process batch with retry logic
        const batchResults = await this.processBatchWithRetry(cv, batch, preferences);
        results.push(...batchResults);
        
        // Cache successful results
        batchResults.forEach(result => {
          const cacheKey = this.generateMatchCacheKey(cv.id, result.job.id, preferences);
          this.setCachedMatch(cacheKey, result);
        });
      } catch (error) {
        console.error('Batch processing failed, falling back to individual processing:', error);
        
        // Fall back to individual processing for this batch
        for (const job of batch) {
          try {
            const result = await this.matchJobWithAI(cv, job, preferences);
            results.push(result);
            
            const cacheKey = this.generateMatchCacheKey(cv.id, job.id, preferences);
            this.setCachedMatch(cacheKey, result);
          } catch (jobError) {
            console.warn(`Individual job matching failed for ${job.id}, using basic matching:`, jobError);
            const basicResult = this.matchJobBasic(cv, job, preferences);
            results.push(basicResult);
          }
        }
      }
      
      // Add delay between batches to respect rate limits
      if (i + this.BATCH_SIZE < jobs.length) {
        await this.sleep(500);
      }
    }

    return results;
  }

  /**
   * Process batch with retry logic
   */
  private static async processBatchWithRetry(cv: Cv, jobs: Job[], preferences?: any): Promise<JobMatchResult[]> {
    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.MAX_RETRIES) {
      try {
        return await this.processBatch(cv, jobs, preferences);
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        this.metrics.retryCount++;
        
        if (retryCount <= this.MAX_RETRIES) {
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, retryCount - 1) + Math.random() * 1000;
          console.warn(`Batch processing attempt ${retryCount} failed, retrying in ${delay}ms:`, error);
          await this.sleep(delay);
        }
      }
    }

    throw lastError || new Error('Batch processing failed after all retries');
  }

  /**
   * Process a batch of jobs with optimized AI calls
   */
  private static async processBatch(cv: Cv, jobs: Job[], preferences?: any): Promise<JobMatchResult[]> {
    // For now, process jobs individually but with optimized prompts
    // In the future, this could be enhanced to use a single AI call for multiple jobs
    const results: JobMatchResult[] = [];
    
    for (const job of jobs) {
      const result = await this.performOptimizedJobMatch(cv, job, preferences);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Perform optimized job matching with efficient prompts
   */
  private static async performOptimizedJobMatch(cv: Cv, job: Job, preferences?: any): Promise<JobMatchResult> {
    const cvData = cv.parsedData as ParsedCVData;
    const userPreferences = preferences || {};

    // Optimized system prompt for better token efficiency
    const systemPrompt = "Analyze job-candidate compatibility. Return JSON with matchScore (0-100), explanation, skillsMatch {matched[], missing[], score}, experienceMatch {suitable, explanation, score}, locationMatch {suitable, explanation, score}, salaryMatch {suitable, explanation, score}.";
    
    // Optimized user prompt with truncated content
    const candidateSkills = cvData.skills?.slice(0, 15).join(', ') || 'Not specified';
    const jobReqs = (job.requirements || []).slice(0, 10).join(', ') || 'Not specified';
    
    const userPrompt = `Job: ${job.title} at ${job.company}
Location: ${job.location}
Requirements: ${jobReqs}
Salary: ${job.salary || 'Not specified'}

Candidate Skills: ${candidateSkills}
Experience: ${(cvData.experience || '').substring(0, 300)}
Location: ${cvData.location || 'Not specified'}

User Preferences:
- Location: ${userPreferences.preferredLocation || 'Any'}
- Salary: ${userPreferences.salaryExpectation || 'Not specified'}
- Job Types: ${userPreferences.preferredJobTypes?.join(', ') || 'Any'}

Analyze compatibility as JSON.`;

    try {
      const response = await openai!.chat.completions.create({
        model: "gpt-5",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: this.TEMPERATURE,
        max_tokens: this.MAX_TOKENS
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      const matchData = JSON.parse(content);

      return {
        job,
        matchScore: Math.max(0, Math.min(100, matchData.matchScore || 0)),
        explanation: matchData.explanation || 'AI analysis completed',
        skillsMatch: {
          matched: Array.isArray(matchData.skillsMatch?.matched) ? matchData.skillsMatch.matched : [],
          missing: Array.isArray(matchData.skillsMatch?.missing) ? matchData.skillsMatch.missing : [],
          score: Math.max(0, Math.min(100, matchData.skillsMatch?.score || 0))
        },
        experienceMatch: {
          suitable: !!matchData.experienceMatch?.suitable,
          explanation: matchData.experienceMatch?.explanation || 'Experience compatibility analyzed',
          score: Math.max(0, Math.min(100, matchData.experienceMatch?.score || 0))
        },
        locationMatch: {
          suitable: !!matchData.locationMatch?.suitable,
          explanation: matchData.locationMatch?.explanation || 'Location compatibility analyzed',
          score: Math.max(0, Math.min(100, matchData.locationMatch?.score || 0))
        },
        salaryMatch: {
          suitable: !!matchData.salaryMatch?.suitable,
          explanation: matchData.salaryMatch?.explanation || 'Salary compatibility analyzed',
          score: Math.max(0, Math.min(100, matchData.salaryMatch?.score || 0))
        }
      };
    } catch (error) {
      console.error('Optimized AI matching error:', error);
      // Fall back to basic matching if AI fails
      return this.matchJobBasic(cv, job, preferences);
    }
  }

  private static async matchJobWithAI(cv: Cv, job: Job, preferences?: any): Promise<JobMatchResult> {
    if (!openai) {
      throw new Error('OpenAI not configured');
    }

    const cvData = cv.parsedData as ParsedCVData;
    const userPreferences = preferences || {};

    const prompt = `
You are an expert job matching AI. Analyze the compatibility between a candidate's CV and a job posting.

CANDIDATE PROFILE:
- Name: ${cvData.name || 'Not provided'}
- Skills: ${cvData.skills?.join(', ') || 'Not provided'}
- Experience: ${cvData.experience || 'Not provided'}
- Education: ${cvData.education || 'Not provided'}
- Location: ${cvData.location || 'Not provided'}
- Summary: ${cvData.summary || 'Not provided'}

USER PREFERENCES:
- Preferred Location: ${userPreferences.preferredLocation || 'Not specified'}
- Salary Expectation: ${userPreferences.salaryExpectation || 'Not specified'}
- Preferred Job Types: ${userPreferences.preferredJobTypes?.join(', ') || 'Not specified'}

JOB POSTING:
- Title: ${job.title}
- Company: ${job.company}
- Location: ${job.location}
- Type: ${job.type}
- Salary: ${job.salary || 'Not specified'}
- Description: ${job.description}
- Requirements: ${(job.requirements || []).join(', ')}

Provide a comprehensive job match analysis in the following JSON format:
{
  "matchScore": 0-100,
  "explanation": "Brief explanation of overall compatibility",
  "skillsMatch": {
    "matched": ["skill1", "skill2"],
    "missing": ["skill3", "skill4"],
    "score": 0-100
  },
  "experienceMatch": {
    "suitable": true/false,
    "explanation": "Experience compatibility explanation",
    "score": 0-100
  },
  "locationMatch": {
    "suitable": true/false,
    "explanation": "Location compatibility explanation",
    "score": 0-100
  },
  "salaryMatch": {
    "suitable": true/false,
    "explanation": "Salary compatibility explanation",
    "score": 0-100
  }
}

Consider:
- Skills overlap and technical requirements fit
- Experience level appropriateness
- Location preferences and remote work options
- Salary range alignment with expectations
- Career progression alignment
- Company culture fit based on job description`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025
        messages: [
          {
            role: "system",
            content: "You are an expert job matching AI that provides detailed compatibility analysis between candidates and job postings. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1500
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI API');
      }

      const matchData = JSON.parse(content);

      return {
        job,
        matchScore: Math.max(0, Math.min(100, matchData.matchScore || 0)),
        explanation: matchData.explanation || 'AI analysis unavailable',
        skillsMatch: {
          matched: Array.isArray(matchData.skillsMatch?.matched) ? matchData.skillsMatch.matched : [],
          missing: Array.isArray(matchData.skillsMatch?.missing) ? matchData.skillsMatch.missing : [],
          score: Math.max(0, Math.min(100, matchData.skillsMatch?.score || 0))
        },
        experienceMatch: {
          suitable: !!matchData.experienceMatch?.suitable,
          explanation: matchData.experienceMatch?.explanation || 'Experience analysis unavailable',
          score: Math.max(0, Math.min(100, matchData.experienceMatch?.score || 0))
        },
        locationMatch: {
          suitable: !!matchData.locationMatch?.suitable,
          explanation: matchData.locationMatch?.explanation || 'Location analysis unavailable',
          score: Math.max(0, Math.min(100, matchData.locationMatch?.score || 0))
        },
        salaryMatch: {
          suitable: !!matchData.salaryMatch?.suitable,
          explanation: matchData.salaryMatch?.explanation || 'Salary analysis unavailable',
          score: Math.max(0, Math.min(100, matchData.salaryMatch?.score || 0))
        }
      };
    } catch (error) {
      console.error('AI matching error:', error);
      // Fall back to basic matching if AI fails
      return JobMatchingService.matchJobBasic(cv, job, preferences);
    }
  }

  private static matchJobBasic(cv: Cv, job: Job, preferences?: any): JobMatchResult {
    const cvData = cv.parsedData as ParsedCVData;
    const userPreferences = preferences || {};
    
    // Skills matching
    const candidateSkills = (cvData.skills || []).map(s => s.toLowerCase());
    const jobRequirements = (job.requirements || []).map(r => r.toLowerCase());
    
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];
    
    jobRequirements.forEach(req => {
      const isMatched = candidateSkills.some(skill => 
        skill.includes(req) || req.includes(skill) ||
        this.areSkillsSimilar(skill, req)
      );
      
      if (isMatched) {
        matchedSkills.push(req);
      } else {
        missingSkills.push(req);
      }
    });

    const skillsScore = matchedSkills.length > 0 
      ? Math.round((matchedSkills.length / jobRequirements.length) * 100)
      : 0;

    // Experience matching (basic analysis)
    const experienceText = (cvData.experience || '').toLowerCase();
    const jobTitle = job.title.toLowerCase();
    
    let experienceScore = 50; // Base score
    
    // Look for experience indicators
    const experienceKeywords = ['years', 'experience', 'worked', 'developed', 'managed', 'led'];
    const hasExperienceKeywords = experienceKeywords.some(keyword => experienceText.includes(keyword));
    
    if (hasExperienceKeywords) {
      experienceScore += 20;
    }
    
    // Check if job title or similar terms appear in experience
    const jobTitleWords = jobTitle.split(' ').filter(word => word.length > 3);
    const titleMatch = jobTitleWords.some(word => experienceText.includes(word));
    if (titleMatch) {
      experienceScore += 15;
    }

    // Location matching
    let locationScore = 50; // Base score
    let locationSuitable = true;
    let locationExplanation = 'Location compatibility needs review';

    if (job.location.toLowerCase().includes('remote')) {
      locationScore = 90;
      locationSuitable = true;
      locationExplanation = 'Remote position - location flexible';
    } else if (cvData.location && job.location) {
      const candidateLocation = cvData.location.toLowerCase();
      const jobLocation = job.location.toLowerCase();
      
      if (candidateLocation.includes(jobLocation) || jobLocation.includes(candidateLocation)) {
        locationScore = 90;
        locationSuitable = true;
        locationExplanation = 'Location matches candidate preference';
      } else {
        locationScore = 30;
        locationSuitable = false;
        locationExplanation = 'Location may require relocation';
      }
    }

    // Salary matching (basic)
    let salaryScore = 70; // Base score when no salary info
    let salarySuitable = true;
    let salaryExplanation = 'Salary range needs discussion';

    if (!job.salary) {
      salaryExplanation = 'Salary not specified in job posting';
    } else {
      salaryExplanation = 'Salary compatibility needs review';
    }

    // Calculate overall match score
    const overallScore = Math.round(
      (skillsScore * 0.4) +
      (experienceScore * 0.3) +
      (locationScore * 0.2) +
      (salaryScore * 0.1)
    );

    let explanation = `${Math.round(skillsScore)}% skills match with ${matchedSkills.length}/${jobRequirements.length} requirements met.`;
    
    if (matchedSkills.length > 0) {
      explanation += ` Strong match in: ${matchedSkills.slice(0, 3).join(', ')}.`;
    }
    
    if (missingSkills.length > 0 && missingSkills.length <= 3) {
      explanation += ` May need development in: ${missingSkills.join(', ')}.`;
    }

    return {
      job,
      matchScore: overallScore,
      explanation,
      skillsMatch: {
        matched: matchedSkills,
        missing: missingSkills,
        score: skillsScore
      },
      experienceMatch: {
        suitable: experienceScore >= 60,
        explanation: experienceScore >= 60 ? 'Experience appears suitable' : 'Experience may need review',
        score: experienceScore
      },
      locationMatch: {
        suitable: locationSuitable,
        explanation: locationExplanation,
        score: locationScore
      },
      salaryMatch: {
        suitable: salarySuitable,
        explanation: salaryExplanation,
        score: salaryScore
      }
    };
  }

  private static areSkillsSimilar(skill1: string, skill2: string): boolean {
    // Basic similarity check for common skill variations
    const skillMappings: Record<string, string[]> = {
      'javascript': ['js', 'ecmascript', 'es6', 'es2015'],
      'typescript': ['ts'],
      'react': ['reactjs', 'react.js'],
      'node.js': ['nodejs', 'node'],
      'python': ['py'],
      'java': ['jdk', 'jre'],
      'css': ['css3', 'cascading style sheets'],
      'html': ['html5', 'hypertext markup language'],
      'sql': ['mysql', 'postgresql', 'postgres'],
      'aws': ['amazon web services'],
      'docker': ['containerization'],
      'kubernetes': ['k8s'],
      'git': ['version control', 'github', 'gitlab']
    };

    const normalized1 = skill1.toLowerCase().trim();
    const normalized2 = skill2.toLowerCase().trim();

    // Direct match
    if (normalized1 === normalized2) return true;

    // Check mappings
    for (const [key, variations] of Object.entries(skillMappings)) {
      if ((normalized1 === key || variations.includes(normalized1)) &&
          (normalized2 === key || variations.includes(normalized2))) {
        return true;
      }
    }

    // Check if one contains the other (for compound skills)
    return normalized1.includes(normalized2) || normalized2.includes(normalized1);
  }

  static async getTopMatches(cv: Cv, jobs: Job[], limit: number = 20, preferences?: any): Promise<JobMatchResult[]> {
    // Performance optimization: prefilter jobs to reduce AI calls
    const preFilteredJobs = this.preFilterJobs(jobs, cv, preferences);
    
    // Limit jobs sent to AI matching to avoid excessive API calls
    const jobsToMatch = preFilteredJobs.slice(0, Math.min(50, preFilteredJobs.length));
    
    const matches = await JobMatchingService.findMatchedJobs(cv, jobsToMatch, preferences);
    return matches.slice(0, limit);
  }

  static preFilterJobs(jobs: Job[], cv: Cv, preferences?: {
    preferredLocation?: string;
    salaryExpectation?: string;
    preferredJobTypes?: string[];
  }): Job[] {
    // Performance optimization: prefilter to reduce AI calls
    const cvData = cv.parsedData as ParsedCVData;
    
    return jobs.filter(job => {
      // Filter by user preferences first
      if (preferences?.preferredJobTypes?.length) {
        const jobTypeLower = job.type.toLowerCase();
        const hasTypeMatch = preferences.preferredJobTypes.some(type => 
          type.toLowerCase().includes(jobTypeLower) || 
          jobTypeLower.includes(type.toLowerCase())
        );
        if (!hasTypeMatch) return false;
      }

      // Location preference filtering (unless remote)
      if (preferences?.preferredLocation && !job.location.toLowerCase().includes('remote')) {
        const prefLocationLower = preferences.preferredLocation.toLowerCase();
        const jobLocationLower = job.location.toLowerCase();
        if (!jobLocationLower.includes(prefLocationLower) && 
            !prefLocationLower.includes(jobLocationLower)) {
          return false;
        }
      }

      // Basic skills overlap check to reduce obviously mismatched jobs
      if (cvData.skills && cvData.skills.length > 0) {
        const candidateSkills = cvData.skills.map(s => s.toLowerCase());
        const hasSkillOverlap = (job.requirements || []).some(req => 
          candidateSkills.some(skill => 
            skill.includes(req.toLowerCase()) || 
            req.toLowerCase().includes(skill) ||
            this.areSkillsSimilar(skill, req.toLowerCase())
          )
        );
        
        // Keep jobs that have at least some skill overlap OR are entry-level positions
        const isEntryLevel = job.title.toLowerCase().includes('junior') || 
                           job.title.toLowerCase().includes('entry') ||
                           job.title.toLowerCase().includes('intern') ||
                           job.title.toLowerCase().includes('graduate');
        
        if (!hasSkillOverlap && !isEntryLevel) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      // Prioritize jobs that are more likely to be good matches
      let scoreA = 0;
      let scoreB = 0;
      
      // Boost remote jobs
      if (a.location.toLowerCase().includes('remote')) scoreA += 10;
      if (b.location.toLowerCase().includes('remote')) scoreB += 10;
      
      // Boost jobs with skill overlap if we have CV skills
      if (cvData.skills && cvData.skills.length > 0) {
        const candidateSkills = cvData.skills.map(s => s.toLowerCase());
        
        const aSkillMatches = (a.requirements || []).filter(req => 
          candidateSkills.some(skill => 
            skill.includes(req.toLowerCase()) || req.toLowerCase().includes(skill)
          )
        ).length;
        
        const bSkillMatches = (b.requirements || []).filter(req => 
          candidateSkills.some(skill => 
            skill.includes(req.toLowerCase()) || req.toLowerCase().includes(skill)
          )
        ).length;
        
        scoreA += aSkillMatches * 5;
        scoreB += bSkillMatches * 5;
      }
      
      return scoreB - scoreA;
    });
  }

  /**
   * Clear job matching cache manually
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('Job matching cache cleared');
  }

  /**
   * Get cache statistics
   */
  static getCacheStats() {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.values()).map(entry => ({
        hash: entry.hash.substring(0, 8),
        timestamp: entry.timestamp,
        age: Date.now() - entry.timestamp
      }))
    };
  }

  /**
   * Get user behavior data
   */
  static getUserBehavior(userId: string): UserBehaviorData | null {
    return this.userBehavior.get(userId) || null;
  }

  /**
   * Clear user behavior data
   */
  static clearUserBehavior(userId?: string): void {
    if (userId) {
      this.userBehavior.delete(userId);
    } else {
      this.userBehavior.clear();
    }
  }

  static async searchJobs(
    cv: Cv,
    jobs: Job[], 
    filters: {
      query?: string;
      location?: string;
      type?: string;
      minSalary?: number;
      skills?: string[];
    },
    preferences?: any
  ): Promise<JobMatchResult[]> {
    // First filter jobs based on search criteria
    let filteredJobs = jobs.filter(job => {
      // Text search filter
      if (filters.query) {
        const query = filters.query.toLowerCase();
        const searchText = `${job.title} ${job.company} ${job.description} ${(job.requirements || []).join(' ')}`.toLowerCase();
        if (!searchText.includes(query)) return false;
      }

      // Location filter
      if (filters.location) {
        const locationLower = filters.location.toLowerCase();
        const jobLocationLower = job.location.toLowerCase();
        if (!jobLocationLower.includes(locationLower) && !locationLower.includes(jobLocationLower)) {
          return false;
        }
      }

      // Job type filter
      if (filters.type) {
        const typeLower = filters.type.toLowerCase();
        const jobTypeLower = job.type.toLowerCase();
        if (jobTypeLower !== typeLower) return false;
      }

      // Salary filter with better parsing
      if (filters.minSalary) {
        if (!job.salary) return false;
        
        // Extract all numbers from salary string and use the largest one
        const salaryNumbers = job.salary.match(/\d+/g);
        if (!salaryNumbers) return false;
        
        const maxSalary = Math.max(...salaryNumbers.map(num => parseInt(num)));
        
        // Convert to thousands if needed (e.g., "50" -> 50000 for $50k)
        const normalizedSalary = maxSalary < 1000 ? maxSalary * 1000 : maxSalary;
        
        if (normalizedSalary < filters.minSalary) return false;
      }

      // Skills filter with improved matching
      if (filters.skills && filters.skills.length > 0) {
        const hasRequiredSkill = filters.skills.some(skill =>
          (job.requirements || []).some(req => 
            req.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(req.toLowerCase()) ||
            this.areSkillsSimilar(skill.toLowerCase(), req.toLowerCase())
          )
        );
        if (!hasRequiredSkill) return false;
      }

      return true;
    });

    // Apply performance optimization with prefiltering
    const preFilteredJobs = this.preFilterJobs(filteredJobs, cv, preferences);
    
    // Limit jobs sent to AI matching to avoid excessive API calls
    const jobsToMatch = preFilteredJobs.slice(0, Math.min(30, preFilteredJobs.length));
    
    // Get matches for filtered and prefiltered jobs
    return JobMatchingService.findMatchedJobs(cv, jobsToMatch, preferences);
  }
}