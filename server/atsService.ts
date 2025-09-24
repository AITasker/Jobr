import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

export interface ATSScoreResult {
  ats_score: number;
  matched_must_haves: string[];
  missing_must_haves: string[];
  matched_nice_haves: string[];
  missing_nice_haves: string[];
  explanation: string;
}


export class ATSService {
  // Text cleaning and normalization
  private static cleanText(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ') // Replace punctuation with spaces
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  // Dynamic keyword extraction that analyzes any job description contextually  
  private static extractKeywordsFallback(jobDescription: string): { must_have: string[]; nice_to_have: string[] } {
    const text = jobDescription.toLowerCase();
    console.log("=== DYNAMIC ATS FALLBACK DEBUG ===");
    console.log("Job Description sample:", text.substring(0, 200) + "...");

    const must_have: string[] = [];
    const nice_to_have: string[] = [];

    // Split into sections to analyze context
    const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(s => s.length > 10);
    
    // Context markers that indicate importance
    const mustHaveMarkers = ['required', 'must have', 'essential', 'mandatory', 'minimum', 'need', 'necessary'];
    const preferredMarkers = ['preferred', 'nice to have', 'bonus', 'plus', 'advantage', 'desired', 'ideal'];
    
    // Dynamic skill patterns - more comprehensive and flexible
    const skillExtractionPatterns = [
      // Technical skills and tools (exact matches likely in resumes)
      /\b(python|java|javascript|react|angular|vue|node\.?js|typescript|sql|html|css|php|ruby|go|rust|scala|kotlin|aws|azure|gcp|docker|kubernetes|git|linux|mysql|postgresql|mongodb|redis|elasticsearch|spark|hadoop|tensorflow|pytorch|scikit-learn|pandas|numpy|matplotlib|tableau|powerbi|excel|jira|confluence|slack|figma|sketch|photoshop|illustrator|autocad|solidworks|matlab|r|sas|spss)\b/g,
      
      // Management and business skills (common resume phrases)
      /\b(project\s+management|program\s+management|product\s+management|stakeholder\s+management|team\s+leadership|cross-functional\s+coordination|agile|scrum|kanban|devops|operations|business\s+analysis|data\s+analysis|problem\s+solving|strategic\s+planning|budget\s+management|vendor\s+management|client\s+management|relationship\s+management)\b/g,
      
      // Education and certifications
      /\b(bachelor|master|mba|phd|degree|certification|certified|licensed)\b/g,
      
      // Experience levels (only capture specific numbers, not generic phrases)
      /\b(\d+\+?\s*years?\s+(?:of\s+)?experience)\b/g,
      
      // Industry specific terms (extracted dynamically)
      /\b(healthcare|finance|fintech|edtech|e-commerce|retail|manufacturing|automotive|aerospace|telecommunications|media|gaming|blockchain|cryptocurrency|machine\s+learning|artificial\s+intelligence|data\s+science|cybersecurity|cloud\s+computing|mobile\s+development|web\s+development|frontend|backend|fullstack|full-stack|devops|qa|testing|automation|ci\/cd)\b/g
    ];

    // Extract skills from all patterns and filter out generic scaffolding
    const allExtractedSkills = new Set<string>();
    const genericScaffolding = [
      'experience in', 'experience with', 'background in', 'expertise in', 
      'knowledge of', 'proficiency in', 'familiarity with', 'understanding of',
      'years of experience', 'years experience', 'experience', 'background',
      'knowledge', 'proficiency', 'familiarity', 'understanding'
    ];
    
    skillExtractionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        matches.forEach(match => {
          const cleaned = this.cleanText(match);
          // Filter out generic scaffolding phrases that will match any resume
          if (cleaned.length > 2 && !genericScaffolding.includes(cleaned)) {
            allExtractedSkills.add(cleaned);
          }
        });
      }
    });

    console.log("All extracted skills:", Array.from(allExtractedSkills));

    // Analyze each sentence for context and categorize skills
    sentences.forEach(sentence => {
      const hasMustHave = mustHaveMarkers.some(marker => sentence.includes(marker));
      const hasPreferred = preferredMarkers.some(marker => sentence.includes(marker));
      
      // Extract skills from this sentence
      skillExtractionPatterns.forEach(pattern => {
        const matches = sentence.match(pattern);
        if (matches) {
          matches.forEach(match => {
            const cleaned = this.cleanText(match);
            if (cleaned.length > 2) {
              if (hasMustHave || (!hasPreferred && sentence.includes('require'))) {
                if (!must_have.includes(cleaned)) {
                  must_have.push(cleaned);
                }
              } else if (hasPreferred) {
                if (!nice_to_have.includes(cleaned)) {
                  nice_to_have.push(cleaned);
                }
              }
            }
          });
        }
      });
    });

    // If no explicit categorization found, use intelligent defaults based on skill types
    if (must_have.length === 0 && nice_to_have.length === 0) {
      Array.from(allExtractedSkills).forEach(skill => {
        // Core technical skills, education, and experience requirements typically must-have
        if (skill.includes('experience') || skill.includes('degree') || skill.includes('bachelor') || skill.includes('master') ||
            /\b(python|java|javascript|react|sql|aws|project management|stakeholder management)\b/.test(skill)) {
          must_have.push(skill);
        } else {
          nice_to_have.push(skill);
        }
      });
    }

    // Distribute remaining skills if categorization is too unbalanced
    const totalSkills = must_have.length + nice_to_have.length;
    if (totalSkills > 4 && must_have.length < 2) {
      // Move some nice-to-haves to must-haves for balance
      const toMove = nice_to_have.splice(0, Math.min(3, nice_to_have.length));
      must_have.push(...toMove);
    }

    const result = { 
      must_have: must_have.slice(0, 8), // Limit to reasonable number
      nice_to_have: nice_to_have.slice(0, 8) 
    };
    
    console.log("Dynamic extraction result:", result);
    console.log("=== END DYNAMIC ATS FALLBACK DEBUG ===");

    return result;
  }

  // Step 1: Extract keywords from job description using OpenAI with fallback
  private static async extractKeywords(jobDescription: string): Promise<{ must_have: string[]; nice_to_have: string[] }> {
    if (!openai) {
      console.log("OpenAI API not configured, using fallback keyword extraction");
      return this.extractKeywordsFallback(jobDescription);
    }

    const prompt = `Extract two lists of skills from this job description:
Must-have (explicitly required) and Nice-to-have (preferred/optional).
Respond ONLY in JSON with keys must_have and nice_to_have.

JD:
${jobDescription}

Rules:
- Must-have: Look for words like "required", "must have", "mandatory", "essential"
- Nice-to-have: Look for words like "preferred", "good to have", "plus", "bonus"
- Deduplicate similar terms (e.g., "Python programming" and "Python" → one entry)
- Normalize to lowercase, singular form
- Return empty arrays if no skills found in a category

Response format:
{
  "must_have": ["skill1", "skill2", ...],
  "nice_to_have": ["skill3", "skill4", ...]
}`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5", // the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
        messages: [
          {
            role: "system",
            content: "You are an expert skill extraction system. Extract skills from job descriptions. Always respond with valid JSON only."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" }
      });

      const result = response.choices[0].message.content;
      if (!result) {
        throw new Error("No response from OpenAI");
      }

      const parsedResult = JSON.parse(result);
      
      // Validate the response structure
      if (!Array.isArray(parsedResult.must_have) ||
          !Array.isArray(parsedResult.nice_to_have)) {
        throw new Error("Invalid keyword extraction response format from OpenAI");
      }

      // Normalize keywords to lowercase
      const mustHave = parsedResult.must_have.map((skill: string) => skill.toLowerCase());
      const niceToHave = parsedResult.nice_to_have.map((skill: string) => skill.toLowerCase());

      return { must_have: mustHave, nice_to_have: niceToHave };
    } catch (error) {
      console.error("Skills extraction error:", error);
      // If OpenAI fails (quota exceeded, rate limits, etc.), use fallback
      if (error instanceof Error && (error.message.includes('429') || error.message.includes('quota') || error.message.includes('rate limit'))) {
        console.log("OpenAI quota/rate limit exceeded, using fallback keyword extraction");
        return this.extractKeywordsFallback(jobDescription);
      }
      throw new Error(`Failed to extract skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Step 2: Match keywords against resume using exact matching
  private static matchKeywords(keywords: string[], resumeText: string): { matched: string[]; missing: string[] } {
    const cleanResumeText = this.cleanText(resumeText);
    const matched: string[] = [];
    const missing: string[] = [];

    console.log("=== KEYWORD MATCHING DEBUG ===");
    console.log("Clean resume text length:", cleanResumeText.length);
    console.log("Clean resume sample:", cleanResumeText.substring(0, 400) + "...");
    console.log("Keywords to match:", keywords);

    keywords.forEach(keyword => {
      const keywordLower = keyword.toLowerCase();
      // Exact match: check if keyword appears as substring in clean resume text
      if (cleanResumeText.includes(keywordLower)) {
        console.log(`✓ MATCH: "${keyword}" found in resume`);
        matched.push(keyword);
      } else {
        console.log(`✗ MISS: "${keyword}" NOT found in resume`);
        // Help debug by showing if any part of the keyword is present
        const words = keywordLower.split(' ');
        const partialMatches = words.filter(word => cleanResumeText.includes(word));
        if (partialMatches.length > 0) {
          console.log(`  → Partial matches found: ${partialMatches.join(', ')}`);
        }
        missing.push(keyword);
      }
    });

    console.log("Final matched:", matched);
    console.log("Final missing:", missing);
    console.log("=== END KEYWORD MATCHING DEBUG ===");

    return { matched, missing };
  }

  // Step 3: Calculate ATS score using exact specification formula
  private static computeScore(
    mustHave: string[], 
    niceToHave: string[], 
    matchedMustHave: string[], 
    matchedNiceToHave: string[]
  ): { score: number; explanation: string } {
    const M = mustHave.length;
    const N = niceToHave.length;
    const Nm = matchedMustHave.length;
    const Nn = matchedNiceToHave.length;

    // Handle edge cases as per specification
    if (M === 0 && N === 0) {
      return {
        score: 0,
        explanation: "No skills were identified in the job description for scoring."
      };
    }

    // Calculate scores using exact specification formula
    const mustScore = M > 0 ? (Nm / M) * 70 : 0;
    const niceScore = N > 0 ? (Nn / N) * 30 : 0;
    const atsScore = Math.round(mustScore + niceScore);

    const explanation = `Matched ${Nm}/${M} must-have and ${Nn}/${N} nice-to-have skills.`;

    return { score: atsScore, explanation };
  }

  // Main public method - implements exact specification flow
  static async calculateATSScore(jobDescription: string, resumeText: string): Promise<ATSScoreResult> {
    try {
      console.log("=== ATS SCORE CALCULATION START ===");
      console.log("Job description length:", jobDescription.length);
      console.log("Resume text length:", resumeText.length);
      
      // Step 1: Clean and normalize text
      const cleanedJD = this.cleanText(jobDescription);
      const cleanedResume = this.cleanText(resumeText);

      // Step 2: Extract keywords using AI
      const { must_have, nice_to_have } = await this.extractKeywords(jobDescription);
      
      console.log("EXTRACTED KEYWORDS:");
      console.log("Must-have:", must_have);
      console.log("Nice-to-have:", nice_to_have);

      // Step 3: Match keywords locally using exact matching
      console.log("MATCHING MUST-HAVE KEYWORDS:");
      const mustHaveMatching = this.matchKeywords(must_have, resumeText);
      
      console.log("MATCHING NICE-TO-HAVE KEYWORDS:");
      const niceToHaveMatching = this.matchKeywords(nice_to_have, resumeText);

      // Step 4: Calculate score using specification formula
      const { score, explanation } = this.computeScore(
        must_have,
        nice_to_have,
        mustHaveMatching.matched,
        niceToHaveMatching.matched
      );

      console.log("FINAL SCORE CALCULATION:");
      console.log(`Must-have: ${mustHaveMatching.matched.length}/${must_have.length}`);
      console.log(`Nice-to-have: ${niceToHaveMatching.matched.length}/${nice_to_have.length}`);
      console.log(`Final ATS Score: ${score}%`);
      console.log("=== ATS SCORE CALCULATION END ===");

      // Step 5: Return result in specification format
      return {
        ats_score: score,
        matched_must_haves: mustHaveMatching.matched,
        missing_must_haves: mustHaveMatching.missing,
        matched_nice_haves: niceToHaveMatching.matched,
        missing_nice_haves: niceToHaveMatching.missing,
        explanation
      };
    } catch (error) {
      console.error("ATS Score calculation error:", error);
      throw new Error(`Failed to calculate ATS score: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}