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

  // Step 1: Extract keywords from job description using OpenAI
  private static async extractKeywords(jobDescription: string): Promise<{ must_have: string[]; nice_to_have: string[] }> {
    if (!openai) {
      throw new Error("OpenAI API not configured");
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
      throw new Error(`Failed to extract skills: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  // Step 2: Match keywords against resume using exact matching
  private static matchKeywords(keywords: string[], resumeText: string): { matched: string[]; missing: string[] } {
    const cleanResumeText = this.cleanText(resumeText);
    const matched: string[] = [];
    const missing: string[] = [];

    keywords.forEach(keyword => {
      // Exact match: check if keyword appears as substring in clean resume text
      if (cleanResumeText.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      } else {
        missing.push(keyword);
      }
    });

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
      // Step 1: Clean and normalize text
      const cleanedJD = this.cleanText(jobDescription);
      const cleanedResume = this.cleanText(resumeText);

      // Step 2: Extract keywords using AI
      const { must_have, nice_to_have } = await this.extractKeywords(jobDescription);

      // Step 3: Match keywords locally using exact matching
      const mustHaveMatching = this.matchKeywords(must_have, resumeText);
      const niceToHaveMatching = this.matchKeywords(nice_to_have, resumeText);

      // Step 4: Calculate score using specification formula
      const { score, explanation } = this.computeScore(
        must_have,
        nice_to_have,
        mustHaveMatching.matched,
        niceToHaveMatching.matched
      );

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