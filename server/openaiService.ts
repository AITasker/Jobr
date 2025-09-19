import OpenAI from "openai";
import memoize from "memoizee";
import crypto from "crypto";

// Note: the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ParsedCVData {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  skills: string[];
  experience: string;
  education: string;
  summary?: string | null;
  location?: string | null;
}

export interface CVParsingMetrics {
  tokensUsed: number;
  processingTime: number;
  cacheHit: boolean;
  retryCount: number;
  success: boolean;
}

export interface CVParsingResult {
  data: ParsedCVData;
  metrics: CVParsingMetrics;
}

interface CacheEntry {
  data: ParsedCVData;
  timestamp: number;
  hash: string;
}

export class OpenAIService {
  // Test mode detection
  static isTestMode(): boolean {
    return process.env.NODE_ENV === 'test' || process.env.TEST_USE_MOCKS === 'true';
  }

  // Configuration constants for optimization
  private static readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_BASE = 1000; // 1 second
  private static readonly MAX_TOKENS = 800; // Reduced from 1000 for cost efficiency
  private static readonly TEMPERATURE = 0.05; // Lower for more consistent parsing
  
  // Enhanced cache for CV parsing results
  private static cache = new Map<string, CacheEntry>();
  
  // Performance metrics tracking
  private static metrics = {
    totalRequests: 0,
    cacheHits: 0,
    retryCount: 0,
    avgResponseTime: 0,
    tokensSaved: 0
  };

  static isAvailable(): boolean {
    if (this.isTestMode()) {
      return true; // Always available in test mode with mocks
    }
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Get current performance metrics
   */
  static getMetrics() {
    return {
      ...this.metrics,
      cacheHitRate: this.metrics.totalRequests > 0 ? (this.metrics.cacheHits / this.metrics.totalRequests) * 100 : 0,
      avgTokensSaved: this.metrics.cacheHits > 0 ? this.metrics.tokensSaved / this.metrics.cacheHits : 0
    };
  }

  /**
   * Generate content hash for caching
   */
  private static generateContentHash(content: string): string {
    // Normalize content for better cache hits
    const normalized = content
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000); // Use first 1000 chars for hash to avoid processing entire document
    
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }

  /**
   * Check cache for existing parse result
   */
  private static getCachedResult(contentHash: string): ParsedCVData | null {
    const entry = this.cache.get(contentHash);
    if (!entry) return null;

    // Check if cache entry is still valid
    if (Date.now() - entry.timestamp > this.CACHE_TTL) {
      this.cache.delete(contentHash);
      return null;
    }

    this.metrics.cacheHits++;
    this.metrics.tokensSaved += this.MAX_TOKENS; // Estimate tokens saved
    return entry.data;
  }

  /**
   * Store result in cache
   */
  private static setCachedResult(contentHash: string, data: ParsedCVData): void {
    this.cache.set(contentHash, {
      data,
      timestamp: Date.now(),
      hash: contentHash
    });

    // Clean old entries if cache gets too large
    if (this.cache.size > 1000) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      const toRemove = entries.slice(0, 200); // Remove oldest 200 entries
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
   * Enhanced CV parsing with caching, retry logic, and performance monitoring
   */
  static async parseCVContent(cvText: string): Promise<ParsedCVData> {
    // Use mock service in test mode
    if (this.isTestMode()) {
      console.log('🧪 OpenAI Service: Using mock service for CV parsing in test mode');
      return await this.parseCVContentMock(cvText);
    }

    const startTime = Date.now();
    this.metrics.totalRequests++;
    
    if (!cvText.trim()) {
      throw new Error('No CV content provided for parsing');
    }

    // Generate content hash for caching
    const contentHash = this.generateContentHash(cvText);
    
    // Check cache first
    const cachedResult = this.getCachedResult(contentHash);
    if (cachedResult) {
      return cachedResult;
    }

    if (!openai) {
      console.warn('OpenAI API not available, using fallback parser');
      return this.parseCVContentFallback(cvText);
    }

    let retryCount = 0;
    let lastError: Error | null = null;

    while (retryCount <= this.MAX_RETRIES) {
      try {
        const result = await this.performCVParsing(cvText);
        
        // Cache successful result
        this.setCachedResult(contentHash, result);
        
        // Update metrics
        const processingTime = Date.now() - startTime;
        this.metrics.avgResponseTime = 
          (this.metrics.avgResponseTime * (this.metrics.totalRequests - 1) + processingTime) / this.metrics.totalRequests;
        this.metrics.retryCount += retryCount;

        return result;
      } catch (error) {
        lastError = error as Error;
        retryCount++;
        
        if (retryCount <= this.MAX_RETRIES) {
          // Exponential backoff with jitter
          const delay = this.RETRY_DELAY_BASE * Math.pow(2, retryCount - 1) + Math.random() * 1000;
          console.warn(`CV parsing attempt ${retryCount} failed, retrying in ${delay}ms:`, error);
          await this.sleep(delay);
        }
      }
    }

    // All retries exhausted, fall back to basic parsing
    console.error('All CV parsing retries exhausted, falling back to basic parsing:', lastError);
    return this.parseCVContentFallback(cvText);
  }

  /**
   * Perform the actual OpenAI CV parsing with optimized prompt
   */
  private static async performCVParsing(cvText: string): Promise<ParsedCVData> {
    // Optimized prompt for better token efficiency and accuracy
    const systemPrompt = "Extract CV data as JSON. Return only valid JSON with exact fields: name, email, phone, skills (array), experience, education, summary, location. Use null for missing string fields, empty array for missing skills.";
    
    const userPrompt = `CV text:\n${cvText.substring(0, 2000)}\n\nExtract as JSON with fields: name, email, phone, skills[], experience, education, summary, location`;

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

    const parsedData = JSON.parse(content) as ParsedCVData;

    // Validate and sanitize the response
    return {
      name: parsedData.name || null,
      email: parsedData.email || null,
      phone: parsedData.phone || null,
      skills: Array.isArray(parsedData.skills) ? 
        parsedData.skills.filter(skill => skill && typeof skill === 'string' && skill.trim()).slice(0, 20) : [], // Limit to 20 skills
      experience: (parsedData.experience || '').substring(0, 1000), // Limit length
      education: (parsedData.education || '').substring(0, 500), // Limit length
      summary: parsedData.summary?.substring(0, 300) || null, // Limit length
      location: parsedData.location || null
    };
  }

  /**
   * Enhanced fallback parser with improved pattern matching
   */
  static parseCVContentFallback(cvText: string): ParsedCVData {
    const text = cvText.toLowerCase();
    const originalText = cvText;
    
    // Enhanced regex patterns for better extraction
    const emailPattern = /[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}/g;
    const phonePattern = /(\+?\d{1,3})?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
    const namePattern = /^([A-Z][a-z]+ [A-Z][a-z]+)/m; // Basic name pattern
    
    const emailMatch = originalText.match(emailPattern);
    const phoneMatch = originalText.match(phonePattern);
    const nameMatch = originalText.match(namePattern);
    
    // Enhanced skills extraction with expanded dictionary
    const techSkills = [
      'javascript', 'typescript', 'python', 'java', 'react', 'angular', 'vue', 'svelte',
      'node.js', 'express', 'fastify', 'nestjs', 'mongodb', 'postgresql', 'mysql', 'sql',
      'html', 'css', 'sass', 'scss', 'tailwind', 'bootstrap', 'git', 'github', 'gitlab',
      'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'linux', 'windows', 'macos',
      'figma', 'photoshop', 'illustrator', 'sketch', 'adobe', 'canva',
      'c++', 'c#', 'go', 'rust', 'php', 'ruby', 'swift', 'kotlin', 'flutter', 'dart',
      'redis', 'elasticsearch', 'graphql', 'rest', 'api', 'microservices',
      'tensorflow', 'pytorch', 'machine learning', 'ai', 'data science',
      'agile', 'scrum', 'devops', 'ci/cd', 'jenkins', 'github actions'
    ];
    
    const softSkills = [
      'leadership', 'communication', 'teamwork', 'problem solving', 'project management',
      'analytical', 'creative', 'organized', 'detail-oriented', 'time management'
    ];
    
    const allSkills = [...techSkills, ...softSkills];
    const foundSkills = allSkills.filter(skill => {
      const skillVariants = [
        skill,
        skill.replace('.js', ''),
        skill.replace('-', ' '),
        skill.replace(' ', '-')
      ];
      return skillVariants.some(variant => text.includes(variant));
    });
    
    // Try to extract basic experience information
    let experienceText = 'Experience details not available without AI parsing.';
    const experienceKeywords = ['experience', 'work', 'employment', 'position', 'role'];
    const experienceMatch = experienceKeywords.find(keyword => text.includes(keyword));
    if (experienceMatch) {
      experienceText = 'Professional experience found - details require AI parsing for accuracy.';
    }
    
    // Try to extract basic education information
    let educationText = 'Education details not available without AI parsing.';
    const educationKeywords = ['education', 'degree', 'university', 'college', 'bachelor', 'master', 'phd'];
    const educationMatch = educationKeywords.find(keyword => text.includes(keyword));
    if (educationMatch) {
      educationText = 'Educational background found - details require AI parsing for accuracy.';
    }
    
    // Try to extract location
    let location = null;
    const locationPattern = /(?:location|address|based in|located in):\s*([^,\n]+)/i;
    const locationMatch = originalText.match(locationPattern);
    if (locationMatch) {
      location = locationMatch[1].trim();
    }
    
    return {
      name: nameMatch ? nameMatch[1] : null,
      email: emailMatch ? emailMatch[0] : null,
      phone: phoneMatch ? phoneMatch[0] : null,
      skills: foundSkills.slice(0, 15), // Limit to 15 skills
      experience: experienceText,
      education: educationText,
      summary: null,
      location: location
    };
  }

  /**
   * Batch process multiple CVs for improved efficiency
   */
  static async batchParseCVs(cvTexts: string[]): Promise<ParsedCVData[]> {
    if (!this.isAvailable()) {
      return cvTexts.map(text => this.parseCVContentFallback(text));
    }

    const results: ParsedCVData[] = [];
    const batchSize = 5; // Process in batches to avoid overwhelming the API

    for (let i = 0; i < cvTexts.length; i += batchSize) {
      const batch = cvTexts.slice(i, i + batchSize);
      const batchPromises = batch.map(text => this.parseCVContent(text));
      
      try {
        const batchResults = await Promise.allSettled(batchPromises);
        
        for (const result of batchResults) {
          if (result.status === 'fulfilled') {
            results.push(result.value);
          } else {
            console.error('Batch CV parsing failed:', result.reason);
            // Use fallback for failed items
            const failedIndex = batchResults.indexOf(result);
            results.push(this.parseCVContentFallback(batch[failedIndex]));
          }
        }
      } catch (error) {
        console.error('Batch processing error:', error);
        // Fallback for entire batch
        const fallbackResults = batch.map(text => this.parseCVContentFallback(text));
        results.push(...fallbackResults);
      }
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < cvTexts.length) {
        await this.sleep(1000);
      }
    }

    return results;
  }

  /**
   * Clear cache manually (useful for testing and maintenance)
   */
  static clearCache(): void {
    this.cache.clear();
    console.log('CV parsing cache cleared');
  }

  /**
   * Mock CV parsing implementation for testing
   */
  private static async parseCVContentMock(cvText: string): Promise<ParsedCVData> {
    // Simple mock implementation that extracts basic info from CV text
    const lines = cvText.split('\n').filter(line => line.trim());
    
    // Extract name (usually first line or contains common name patterns)
    let name = null;
    for (const line of lines.slice(0, 5)) {
      if (line.match(/^[A-Z][a-z]+ [A-Z][a-z]+/) && !line.includes('@') && !line.includes('Engineer')) {
        name = line.trim();
        break;
      }
    }
    
    // Extract email
    const emailMatch = cvText.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch ? emailMatch[0] : null;
    
    // Extract phone
    const phoneMatch = cvText.match(/[\+]?[\d\s\(\)\-]{10,}/);
    const phone = phoneMatch ? phoneMatch[0] : null;
    
    // Extract skills (look for common technical terms)
    const skillsKeywords = [
      'JavaScript', 'TypeScript', 'React', 'Node.js', 'Python', 'Java', 'C++',
      'AWS', 'Docker', 'Kubernetes', 'PostgreSQL', 'MongoDB', 'HTML', 'CSS',
      'Git', 'Vue.js', 'Angular', 'GraphQL', 'REST', 'API'
    ];
    const skills = skillsKeywords.filter(skill => 
      cvText.toLowerCase().includes(skill.toLowerCase())
    );
    
    // Extract experience (look for years of experience)
    const experienceMatch = cvText.match(/(\d+)\+?\s*years?\s*(of\s*)?experience/i);
    const experience = experienceMatch 
      ? `${experienceMatch[1]} years of experience in software development`
      : 'Software development experience';
    
    // Extract education
    const educationKeywords = ['University', 'College', 'Bachelor', 'Master', 'PhD', 'Degree'];
    const educationLine = lines.find(line => 
      educationKeywords.some(keyword => line.includes(keyword))
    );
    const education = educationLine || 'Computer Science education';
    
    return {
      name,
      email,
      phone,
      skills,
      experience,
      education,
      summary: name ? `Experienced professional with expertise in ${skills.slice(0, 3).join(', ')}` : null,
      location: null
    };
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
}