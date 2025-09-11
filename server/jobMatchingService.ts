import OpenAI from "openai";
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

export class JobMatchingService {
  static isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  static async findMatchedJobs(cv: Cv, jobs: Job[], preferences?: {
    preferredLocation?: string;
    salaryExpectation?: string;
    preferredJobTypes?: string[];
  }): Promise<JobMatchResult[]> {
    if (!cv.parsedData) {
      throw new Error('CV must be parsed before job matching');
    }

    const matches: JobMatchResult[] = [];

    if (JobMatchingService.isAvailable()) {
      try {
        // Use AI matching for better results
        for (const job of jobs) {
          const matchResult = await JobMatchingService.matchJobWithAI(cv, job, preferences);
          matches.push(matchResult);
        }
      } catch (error) {
        console.warn('AI matching failed, falling back to basic matching:', error);
        // Fall back to basic matching
        for (const job of jobs) {
          const matchResult = JobMatchingService.matchJobBasic(cv, job, preferences);
          matches.push(matchResult);
        }
      }
    } else {
      console.log('OpenAI not available, using basic matching');
      // Use basic matching
      for (const job of jobs) {
        const matchResult = JobMatchingService.matchJobBasic(cv, job, preferences);
        matches.push(matchResult);
      }
    }

    // Sort by match score (highest first) and return top matches
    return matches
      .sort((a, b) => b.matchScore - a.matchScore)
      .filter(match => match.matchScore > 20); // Filter out very low matches
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